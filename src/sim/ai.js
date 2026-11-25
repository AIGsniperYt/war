import {
  ACTION_PHASE_IDLE, ACTION_PHASE_WINDUP, ACTION_PHASE_ACTIVE,
  ACTION_STRIKE, ACTION_BARGE, ACTION_KICK, ACTION_BLOCK,
} from './constants.js';
import { tryStartAction } from './combat.js';
import { angleDiff, clamp } from '../util/math.js';

const DIR_COUNT = 16;
const DIRS = [];
for (let i = 0; i < DIR_COUNT; i++) {
  const a = (i / DIR_COUNT) * Math.PI * 2;
  DIRS.push({ x: Math.cos(a), y: Math.sin(a), a });
}

const _perceive = [];
const _allies = [];
const _enemies = [];

const TWO_PI = Math.PI * 2;

function canSee(state, i, j) {
  const cfg = state.configOf(i);
  const dx = state.x[j] - state.x[i];
  const dy = state.y[j] - state.y[i];
  const d2 = dx * dx + dy * dy;
  const r = cfg.perceptionRange;
  if (d2 > r * r) return false;
  const ang = Math.atan2(dy, dx);
  return Math.abs(angleDiff(state.facing[i], ang)) <= cfg.fov * 0.5;
}

function normalizeAngle(a) {
  let r = a % TWO_PI;
  if (r < 0) r += TWO_PI;
  return r;
}

function chooseAction(state, i, targetId, targetDist, targetAngDiff, neighbors) {
  // Deterministic, contextual action selection. Called on reaction ticks only.
  if (state.actionPhase[i] !== ACTION_PHASE_IDLE) return 0;
  const cfg = state.configOf(i);
  const stamina = state.stamina[i];

  // Block if a relevant incoming attack is detected and can be defended against.
  if (stamina >= 6) {
    for (let n = 0; n < neighbors.length; n++) {
      const j = neighbors[n];
      if (j === i || !state.alive[j] || state.team[j] === state.team[i]) continue;
      const phase = state.actionPhase[j];
      if (phase !== ACTION_PHASE_WINDUP) continue;
      const ax = state.x[i] - state.x[j];
      const ay = state.y[i] - state.y[j];
      const d2 = ax * ax + ay * ay;
      if (d2 > 30 * 30) continue;
      const attackDir = Math.atan2(state.actionDirY[j], state.actionDirX[j]);
      const toMe = Math.atan2(ay, ax);
      if (Math.abs(angleDiff(attackDir, toMe)) > Math.PI * 0.45) continue;
      // Threat is telegraphed and aimed at us; block if facing attacker and can raise guard in time.
      const toAttacker = Math.atan2(-ay, -ax);
      if (Math.abs(angleDiff(state.facing[i], toAttacker)) <= Math.PI * 0.55 && state.actionTimer[j] > 0.08) {
        return ACTION_BLOCK;
      }
    }
  }

  if (targetId < 0) return 0;
  if (targetDist > 22 || targetAngDiff > 0.7) return 0;

  // KICK: create separation or interrupt an opponent (e.g. winding up, or very close/crowded)
  if (stamina >= 12 && targetDist < 16) {
    const tPhase = state.actionPhase[targetId];
    if (tPhase === ACTION_PHASE_WINDUP) return ACTION_KICK;
    // If crowded behind us or need space, kick.
    let closeAllies = 0;
    for (let n = 0; n < neighbors.length; n++) {
      const j = neighbors[n];
      if (j === i || !state.alive[j] || state.team[j] !== state.team[i]) continue;
      const dx = state.x[j] - state.x[i];
      const dy = state.y[j] - state.y[i];
      if (dx * dx + dy * dy < 20 * 20) closeAllies++;
    }
    if (closeAllies >= 3 && stamina >= 14) return ACTION_KICK;
  }

  // BARGE: displacement and forward penetration useful when lane behind target is open-ish.
  if (stamina >= 14 && targetDist < 18) {
    const tdx = state.x[targetId] - state.x[i];
    const tdy = state.y[targetId] - state.y[i];
    const td = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
    const nx = tdx / td, ny = tdy / td;
    let blockedBehind = 0;
    for (let n = 0; n < neighbors.length; n++) {
      const j = neighbors[n];
      if (j === i || j === targetId || !state.alive[j]) continue;
      const ox = state.x[j] - state.x[targetId];
      const oy = state.y[j] - state.y[targetId];
      const od2 = ox * ox + oy * oy;
      if (od2 > 28 * 28) continue;
      const forward = ox * nx + oy * ny;
      if (forward > 0) blockedBehind++;
    }
    if (blockedBehind <= 1) return ACTION_BARGE;
  }

  // Strike when an appropriate attack opportunity exists.
  if (stamina >= 8) return ACTION_STRIKE;
  return 0;
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
    }

    // Local neighbor query for steering/cohesion (smaller radius for perf)
    neighbors.length = 0;
    spatial.queryRadius(state.x[i], state.y[i], 100, neighbors);

    let allyCx = 0, allyCy = 0, allyVx = 0, allyVy = 0, allyCount = 0;
    let nearestAllyDist = Infinity, nearestAllyDx = 0, nearestAllyDy = 0;
    for (let n = 0; n < neighbors.length; n++) {
      const j = neighbors[n];
      if (j === i || !state.alive[j] || state.team[j] !== state.team[i]) continue;
      const dx = state.x[j] - state.x[i];
      const dy = state.y[j] - state.y[i];
      const od = Math.sqrt(dx * dx + dy * dy);
      if (od <= 140) {
        allyCount++;
        allyCx += dx; allyCy += dy;
        allyVx += state.vx[j]; allyVy += state.vy[j];
        if (od < nearestAllyDist) { nearestAllyDist = od; nearestAllyDx = dx; nearestAllyDy = dy; }
      }
    }
    if (allyCount > 0) { allyCx /= allyCount; allyCy /= allyCount; allyVx /= allyCount; allyVy /= allyCount; }

    // Target selection on reaction ticks (perception radius)
    if (decide) {
      const perceive = _perceive;
      perceive.length = 0;
      spatial.queryRadius(state.x[i], state.y[i], cfg.perceptionRange, perceive);
      // Precollect visible enemies and nearby allies for accessibility check (no per-candidate spatial query)
      const allies = _allies;
      const enemies = _enemies;
      allies.length = 0;
      enemies.length = 0;
      for (let n = 0; n < perceive.length; n++) {
        const j = perceive[n];
        if (j === i || !state.alive[j]) continue;
        const dx = state.x[j] - state.x[i];
        const dy = state.y[j] - state.y[i];
        const d2 = dx * dx + dy * dy;
        if (state.team[j] === state.team[i]) {
          allies.push(j, dx, dy, d2);
        } else if (canSee(state, i, j)) {
          enemies.push(j, dx, dy, d2);
        }
      }
      let bestId = -1, bestScore = -Infinity;
      let currentScore = -Infinity, currentValid = false;
      for (let e = 0; e < enemies.length; e += 4) {
        const j = enemies[e];
        const dx = enemies[e + 1];
        const dy = enemies[e + 2];
        const d = Math.sqrt(enemies[e + 3]) + 1e-6;
        const bearing = Math.atan2(dy, dx);
        const bearingDiff = Math.abs(angleDiff(state.facing[i], bearing));
        const proximity = 1 - clamp(d / cfg.perceptionRange, 0, 1);
        const bearingScore = 1 - bearingDiff / Math.PI;
        let blocked = 0;
        for (let a = 0; a < allies.length; a += 4) {
          const k = allies[a];
          if (k === j) continue;
          const kx = allies[a + 1];
          const ky = allies[a + 2];
          const kd = Math.sqrt(allies[a + 3]);
          if (kd < 8 || kd > d) continue;
          const proj = (kx * dx + ky * dy) / (d * kd);
          if (proj > 0.92) {
            const perp = Math.abs(kx * dy - ky * dx) / d;
            if (perp < 10) { blocked++; break; }
          }
        }
        const accessibility = blocked > 0 ? 0.75 : 1.0;
        const score = proximity * 1.8 + bearingScore * 0.5 + accessibility * 0.4;
        if (j === state.targetId[i]) { currentValid = true; currentScore = score; }
        if (score > bestScore) { bestScore = score; bestId = j; }
      }

      const prev = state.targetId[i];
      if (prev >= 0 && (prev >= count || !state.alive[prev] || state.team[prev] === state.team[i])) {
        state.targetId[i] = -1;
        state.targetCommit[i] = 0;
      }
      if (currentValid) {
        if (bestId !== prev && bestScore > currentScore + 0.25) {
          state.targetId[i] = bestId;
          state.targetCommit[i] = 0.9;
        } else {
          state.targetId[i] = prev;
          state.targetCommit[i] = Math.max(state.targetCommit[i], 0.45);
        }
      } else {
        state.targetId[i] = bestId;
        state.targetCommit[i] = bestId >= 0 ? 0.8 : 0;
      }
    } else {
      state.targetCommit[i] = Math.max(0, state.targetCommit[i] - dt);
      const tid0 = state.targetId[i];
      if (tid0 >= 0 && (tid0 >= count || !state.alive[tid0] || state.team[tid0] === state.team[i])) {
        state.targetId[i] = -1;
      }
    }

    const tid = state.targetId[i];
    const hasTarget = tid >= 0 && tid < count && state.alive[tid] && state.team[tid] !== state.team[i];
    let tx = 0, ty = 0, tdist = Infinity;
    if (hasTarget) {
      tx = state.x[tid] - state.x[i];
      ty = state.y[tid] - state.y[i];
      tdist = Math.sqrt(tx * tx + ty * ty);
    }

    // Tactical action selection respects reaction intervals.
    if (decide && hasTarget) {
      const tAng = Math.atan2(ty, tx);
      const facingDiff = Math.abs(angleDiff(state.facing[i], tAng));
      const action = chooseAction(state, i, tid, tdist, facingDiff, neighbors);
      if (action) tryStartAction(state, i, action, tid);
    }

    // Steering: accumulate weighted influence vectors in one neighbor pass (O(k)), then evaluate 16 dirs.
    let steerX = 0, steerY = 0;
    const curSpeed = Math.sqrt(state.vx[i] * state.vx[i] + state.vy[i] * state.vy[i]);
    const curDirX = curSpeed > 1e-6 ? state.vx[i] / curSpeed : Math.cos(state.facing[i]);
    const curDirY = curSpeed > 1e-6 ? state.vy[i] / curSpeed : Math.sin(state.facing[i]);

    if (hasTarget) {
      const toTargetN = tdist > 1e-6 ? { x: tx / tdist, y: ty / tdist } : { x: 0, y: 0 };
      const desiredDist = 16;
      const distFactor = tdist > desiredDist ? 1 : clamp((tdist - 8) / 8, -0.5, 1);
      steerX += toTargetN.x * 1.8 * distFactor;
      steerY += toTargetN.y * 1.8 * distFactor;
      // facing alignment as mild movement bias
      steerX += Math.cos(state.facing[i]) * 0.08;
      steerY += Math.sin(state.facing[i]) * 0.08;
    } else if (allyCount > 0) {
      const acd = Math.sqrt(allyCx * allyCx + allyCy * allyCy) + 1e-6;
      steerX += (allyCx / acd) * 0.9;
      steerY += (allyCy / acd) * 0.9;
      const avd = Math.sqrt(allyVx * allyVx + allyVy * allyVy);
      if (avd > 2) { steerX += (allyVx / avd) * 0.45; steerY += (allyVy / avd) * 0.45; }
    }

    // continuity
    if (curSpeed > 1) { steerX += curDirX * 0.25; steerY += curDirY * 0.25; }

    // Single neighbor pass for separation/cohesion/alignment/enemy avoidance
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

      if (state.team[j] === state.team[i]) {
        if (od < 18) {
          const w = (18 - od) / 18;
          congestion += w;
          steerX -= onx * 1.2 * w;
          steerY -= ony * 1.2 * w;
        } else if (od < 28) {
          const w = (28 - od) / 10;
          steerX -= onx * 0.25 * w;
          steerY -= ony * 0.25 * w;
        }
        if (od > 30 && od < 85) {
          const cohesionW = hasTarget ? 0.08 : 0.22;
          const w = cohesionW * clamp((od - 30) / 55, 0, 1);
          steerX += onx * w;
          steerY += ony * w;
        }
        const av = Math.sqrt(state.vx[j] * state.vx[j] + state.vy[j] * state.vy[j]);
        if (av > 2) {
          const alignW = hasTarget ? 0.08 : 0.16;
          steerX += (state.vx[j] / av) * alignW;
          steerY += (state.vy[j] / av) * alignW;
        }
      } else if (j !== tid) {
        if (od < 20) {
          const w = (20 - od) / 20;
          steerX -= onx * 0.35 * w;
          steerY -= ony * 0.35 * w;
        }
      }
    }
    // Congestion penalty as radial resistance (directionless) - apply by shrinking steer magnitude slightly
    if (congestion > 0) {
      const shrink = 1 / (1 + congestion * 0.4);
      steerX *= shrink; steerY *= shrink;
    }

    // Regroup if isolated from allies and not actively engaging
    if (allyCount > 0 && nearestAllyDist > 55 && !hasTarget) {
      const nad = nearestAllyDist + 1e-6;
      steerX += (nearestAllyDx / nad) * 0.7;
      steerY += (nearestAllyDy / nad) * 0.7;
    }

    // Evaluate resulting steering vector against 16 candidate directions
    let bestDirX = 0, bestDirY = 0, bestDirScore = -Infinity;
    for (let d = 0; d < DIR_COUNT; d++) {
      const dir = DIRS[d];
      const score = dir.x * steerX + dir.y * steerY;
      if (score > bestDirScore) { bestDirScore = score; bestDirX = dir.x; bestDirY = dir.y; }
    }

    // Movement magnitude / facing
    let moveMag = 1;
    if (hasTarget) {
      if (tdist < 14) moveMag = 0.15;
      else if (tdist < 20) moveMag = 0.45;
      else moveMag = 1;
      state.desiredFacing[i] = Math.atan2(ty, tx);
    } else if (allyCount > 0) {
      const acd = Math.sqrt(allyCx * allyCx + allyCy * allyCy);
      if (acd > 28) moveMag = 0.85;
      else if (acd > 14) moveMag = 0.35;
      else moveMag = 0.1;
      if (bestDirX !== 0 || bestDirY !== 0) state.desiredFacing[i] = Math.atan2(bestDirY, bestDirX);
    } else {
      moveMag = 0;
      // Deterministic scan when isolated
      state.desiredFacing[i] = state.facing[i] + dt * 0.8;
    }

    state.moveX[i] = bestDirX * moveMag;
    state.moveY[i] = bestDirY * moveMag;
  }
}
