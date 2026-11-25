import {
  ACTION_PHASE_IDLE, ACTION_STRIKE, ACTION_BARGE, ACTION_KICK, ACTION_BLOCK,
  TEAM_RED
} from './constants.js';
import { tryStartAction } from './combat.js';
import { angleDiff, clamp, distSq, length, normalize } from '../util/math.js';

const DIR_COUNT = 16;
const DIRS = [];
for (let i = 0; i < DIR_COUNT; i++) {
  const a = (i / DIR_COUNT) * Math.PI * 2;
  DIRS.push({ x: Math.cos(a), y: Math.sin(a), a });
}

function canSee(state, i, j) {
  const cfg = state.configOf(i);
  const dx = state.x[j] - state.x[i];
  const dy = state.y[j] - state.y[i];
  const d2 = dx * dx + dy * dy;
  const r = cfg.perceptionRange;
  if (d2 > r * r) return false;
  const ang = Math.atan2(dy, dx);
  const diff = Math.abs(angleDiff(state.facing[i], ang));
  return diff <= cfg.fov * 0.5;
}

function targetScore(state, i, j) {
  const cfg = state.configOf(i);
  const dx = state.x[j] - state.x[i];
  const dy = state.y[j] - state.y[i];
  const d = Math.sqrt(dx * dx + dy * dy) + 1e-6;
  const proximity = 1 - clamp(d / cfg.perceptionRange, 0, 1);
  const facingAng = Math.atan2(dy, dx);
  const facingBonus = 1 - Math.abs(angleDiff(state.facing[i], facingAng)) / Math.PI;

  // engagement/congestion around target: count nearby allies of j (enemies of i)
  let enemyCongestion = 0;
  let allyNearTarget = 0;
  // cheap local scan over all? no, use spatial later; but for simplicity at decision time, O(n) is bad at 5k. We have spatial.
  return { proximity, facingBonus, d };
}

export function updateAI(state, spatial, dt) {
  const count = state.count;
  const neighbors = [];

  for (let i = 0; i < count; i++) {
    if (!state.alive[i]) continue;
    const cfg = state.configOf(i);

    state.reactionTimer[i] -= dt;
    const decide = state.reactionTimer[i] <= 0;
    if (decide) {
      state.reactionTimer[i] += cfg.reactionInterval;
      if (state.reactionTimer[i] < 0) state.reactionTimer[i] = cfg.reactionInterval;
      // Perception and target selection
      neighbors.length = 0;
      spatial.queryRadius(state.x[i], state.y[i], cfg.perceptionRange, neighbors);

      let bestId = -1;
      let bestScore = -Infinity;
      let currentTargetStillValid = false;
      let currentScore = -Infinity;

      // Precompute congestion around potential targets by a second pass is expensive; approximate using nearby counts.
      for (let n = 0; n < neighbors.length; n++) {
        const j = neighbors[n];
        if (j === i || !state.alive[j]) continue;
        if (state.team[j] === state.team[i]) continue;
        if (!canSee(state, i, j)) continue;

        const dx = state.x[j] - state.x[i];
        const dy = state.y[j] - state.y[i];
        const d = Math.sqrt(dx * dx + dy * dy) + 1e-6;
        const proximity = 1 - clamp(d / cfg.perceptionRange, 0, 1);
        const facingBonus = 1 - Math.abs(angleDiff(state.facing[i], Math.atan2(dy, dx))) / Math.PI;

        // local congestion: count allies near this enemy and allies near me
        let alliesNearTarget = 0;
        let enemiesNearMe = 0;
        let alliesNearMe = 0;
        // small radius check using neighbor list? neighbors are within perceptionRange of i, not around j.
        // Approximate: use distance from i to j and ally proximity to line; cheap heuristic.
        for (let m = 0; m < neighbors.length; m++) {
          const k = neighbors[m];
          if (k === i || k === j || !state.alive[k]) continue;
          const dkx = state.x[k] - state.x[i];
          const dky = state.y[k] - state.y[i];
          const dk = Math.sqrt(dkx * dkx + dky * dky);
          if (state.team[k] === state.team[i]) {
            if (dk < 40) alliesNearMe++;
            const dtj = distSq(state.x[k], state.y[k], state.x[j], state.y[j]);
            if (dtj < 40 * 40) alliesNearTarget++;
          } else {
            if (dk < 60) enemiesNearMe++;
          }
        }

        const congestion = clamp(alliesNearTarget / 4, 0, 1);
        const threat = clamp(enemiesNearMe / 5, 0, 1);
        const opportunity = clamp(1 - congestion * 0.7 + (alliesNearTarget > 0 ? 0.15 : 0), 0, 1.3);
        const score = proximity * 1.6 + facingBonus * 0.4 + opportunity * 0.6 + cfg.aggression * 0.3 - congestion * 0.8 - threat * 0.15;

        if (j === state.targetId[i]) { currentTargetStillValid = true; currentScore = score; }
        if (score > bestScore) { bestScore = score; bestId = j; }
      }

      // Target commitment / hysteresis
      const prev = state.targetId[i];
      if (prev >= 0 && (!state.alive[prev] || state.team[prev] === state.team[i])) {
        state.targetId[i] = -1;
        state.targetCommit[i] = 0;
      }
      if (currentTargetStillValid) {
        // keep current unless clearly worse
        if (bestId !== prev && bestScore > currentScore + 0.35) {
          state.targetId[i] = bestId;
          state.targetCommit[i] = 0.9;
        } else {
          state.targetId[i] = prev;
          state.targetCommit[i] = Math.max(state.targetCommit[i], 0.4);
        }
      } else {
        state.targetId[i] = bestId;
        state.targetCommit[i] = bestId >= 0 ? 0.8 : 0;
      }
    } else {
      state.targetCommit[i] = Math.max(0, state.targetCommit[i] - dt);
      const tid = state.targetId[i];
      if (tid >= 0 && (tid >= count || !state.alive[tid] || state.team[tid] === state.team[i])) {
        state.targetId[i] = -1;
      }
    }

    // Steering / movement evaluation every tick
    neighbors.length = 0;
    spatial.queryRadius(state.x[i], state.y[i], 70, neighbors);
    const tid = state.targetId[i];
    let hasTarget = tid >= 0 && tid < count && state.alive[tid] && state.team[tid] !== state.team[i];
    let tx = 0, ty = 0, tdist = Infinity;
    if (hasTarget) {
      tx = state.x[tid] - state.x[i];
      ty = state.y[tid] - state.y[i];
      tdist = Math.sqrt(tx * tx + ty * ty);
    }

    // Decide combat action if in range
    if (hasTarget && state.actionPhase[i] === ACTION_PHASE_IDLE) {
      const dx = tx, dy = ty;
      const d = tdist;
      const ang = Math.atan2(dy, dx);
      const facingDiff = Math.abs(angleDiff(state.facing[i], ang));
      if (d < 22 && facingDiff < 0.6) {
        // choose action: strike default, occasional barge/kick based on situation
        let action = ACTION_STRIKE;
        const stamina = state.stamina[i];
        const crowded = neighbors.length > 5;
        if (stamina > 25 && d < 18) {
          if (crowded && Math.random() < 0.15) action = ACTION_BARGE;
          else if (Math.random() < 0.1) action = ACTION_KICK;
        }
        // if low stamina, maybe block
        if (stamina < 15 && Math.random() < 0.3) action = ACTION_BLOCK;
        tryStartAction(state, i, action, tid);
      } else if (d < 28 && facingDiff < 1.0 && Math.random() < 0.01) {
        // opportunistic block
        if (state.stamina[i] > 20) tryStartAction(state, i, ACTION_BLOCK, tid);
      }
    }

    // Local ally/enemy summary for cohesion/alignment/regrouping
    let allyCx = 0, allyCy = 0, allyVx = 0, allyVy = 0, allyCount = 0;
    let nearestAllyDist = Infinity, nearestAllyDx = 0, nearestAllyDy = 0;
    for (let n = 0; n < neighbors.length; n++) {
      const j = neighbors[n];
      if (j === i || !state.alive[j] || state.team[j] !== state.team[i]) continue;
      const ox = state.x[j] - state.x[i];
      const oy = state.y[j] - state.y[i];
      const od = Math.sqrt(ox * ox + oy * oy);
      if (od > 140) continue;
      allyCount++;
      allyCx += ox; allyCy += oy;
      allyVx += state.vx[j]; allyVy += state.vy[j];
      if (od < nearestAllyDist) { nearestAllyDist = od; nearestAllyDx = ox; nearestAllyDy = oy; }
    }
    if (allyCount > 0) { allyCx /= allyCount; allyCy /= allyCount; allyVx /= allyCount; allyVy /= allyCount; }

    // Candidate direction evaluation
    let bestDirX = 0, bestDirY = 0, bestDirScore = -Infinity;
    const curMoveAng = Math.atan2(state.vy[i], state.vx[i]);
    const curSpeed = Math.sqrt(state.vx[i] * state.vx[i] + state.vy[i] * state.vy[i]);

    for (let d = 0; d < DIR_COUNT; d++) {
      const dir = DIRS[d];
      let score = 0;

      // target progress
      if (hasTarget) {
        const toTargetN = tdist > 1e-6 ? { x: tx / tdist, y: ty / tdist } : { x: 0, y: 0 };
        const progress = dir.x * toTargetN.x + dir.y * toTargetN.y;
        const desiredDist = 16; // preferred engagement distance
        const distFactor = tdist > desiredDist ? 1 : clamp((tdist - 8) / 8, -0.5, 1);
        score += progress * 1.8 * distFactor;
        // facing alignment with movement
        const faceAlign = Math.cos(angleDiff(state.facing[i], dir.a));
        score += faceAlign * 0.15;
      } else {
        // No visible target: regroup with allies, do not desert/wander aimlessly.
        if (allyCount > 0) {
          const acd = Math.sqrt(allyCx * allyCx + allyCy * allyCy) + 1e-6;
          score += (dir.x * (allyCx / acd) + dir.y * (allyCy / acd)) * 0.9;
          const avd = Math.sqrt(allyVx * allyVx + allyVy * allyVy);
          if (avd > 2) score += (dir.x * (allyVx / avd) + dir.y * (allyVy / avd)) * 0.45;
        } else {
          // isolated, no target: hold/scan slowly instead of wandering off
          score -= 0.15;
        }
      }

      // continuity
      if (curSpeed > 1) {
        score += Math.cos(angleDiff(curMoveAng, dir.a)) * 0.25;
      }

      // local allies/enemies influence
      let congestion = 0;
      for (let n = 0; n < neighbors.length; n++) {
        const j = neighbors[n];
        if (j === i || !state.alive[j]) continue;
        const ox = state.x[j] - state.x[i];
        const oy = state.y[j] - state.y[i];
        const od2 = ox * ox + oy * oy;
        if (od2 > 90 * 90) continue;
        const od = Math.sqrt(od2) + 1e-6;
        const onx = ox / od, ony = oy / od;
        const toward = dir.x * onx + dir.y * ony; // 1 means moving toward neighbor

        if (state.team[j] === state.team[i]) {
          // ally separation and congestion
          if (od < 18) { congestion += (18 - od) / 18; score -= toward * 1.2 * ((18 - od) / 18); }
          else if (od < 28) { score -= toward * 0.25 * ((28 - od) / 10); }
          // cohesion: keep formation together, stronger when no target
          if (od > 30 && od < 85) {
            const cohesionW = hasTarget ? 0.08 : 0.22;
            score += toward * cohesionW * clamp((od - 30) / 55, 0, 1);
          }
          // alignment with nearby allies
          const av = Math.sqrt(state.vx[j] * state.vx[j] + state.vy[j] * state.vy[j]);
          if (av > 2) {
            const align = dir.x * (state.vx[j] / av) + dir.y * (state.vy[j] / av);
            score += align * (hasTarget ? 0.08 : 0.16);
          }
        } else {
          // enemy: avoid getting too close from bad angle if not targeting
          if (j !== tid) {
            if (od < 20) { score -= toward * 0.35 * ((20 - od) / 20); }
          }
        }
      }

      score -= congestion * 0.4;

      // If isolated from allies, bias back toward nearest ally unless actively engaging
      if (allyCount > 0 && nearestAllyDist > 55 && !hasTarget) {
        const nad = nearestAllyDist + 1e-6;
        score += (dir.x * (nearestAllyDx / nad) + dir.y * (nearestAllyDy / nad)) * 0.7;
      }

      if (score > bestDirScore) { bestDirScore = score; bestDirX = dir.x; bestDirY = dir.y; }
    }

    // If close to target, slow down instead of ramming
    let moveMag = 1;
    if (hasTarget) {
      if (tdist < 14) moveMag = 0.15;
      else if (tdist < 20) moveMag = 0.45;
      else moveMag = 1;
      state.desiredFacing[i] = Math.atan2(ty, tx);
    } else if (allyCount > 0) {
      // No target: stay with the army.
      const acd = Math.sqrt(allyCx * allyCx + allyCy * allyCy);
      if (acd > 28) moveMag = 0.85;
      else if (acd > 14) moveMag = 0.35;
      else moveMag = 0.1;
      if (bestDirX !== 0 || bestDirY !== 0) state.desiredFacing[i] = Math.atan2(bestDirY, bestDirX);
    } else {
      // Isolated with no target: hold position and scan.
      moveMag = 0;
      state.desiredFacing[i] = state.facing[i] + dt * 0.8;
    }

    state.moveX[i] = bestDirX * moveMag;
    state.moveY[i] = bestDirY * moveMag;
  }
}
