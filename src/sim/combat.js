import {
  ACTION_BARGE, ACTION_BLOCK, ACTION_KICK, ACTION_NONE, ACTION_PHASE_ACTIVE, ACTION_PHASE_IDLE,
  ACTION_PHASE_RECOVERY, ACTION_PHASE_WINDUP, ACTION_STRIKE, TEAM_RED
} from './constants.js';
import { getAction } from './actions.js';
import { angleDiff, distSq, normalize } from '../util/math.js';

export function tryStartAction(state, i, actionId, targetId = -1) {
  if (state.actionPhase[i] !== ACTION_PHASE_IDLE) return false;
  const cfg = state.configOf(i);
  const action = getAction(cfg, actionId);
  if (!action) return false;
  if (state.stamina[i] < action.staminaCost) return false;

  state.actionId[i] = action.id;
  state.actionPhase[i] = ACTION_PHASE_WINDUP;
  state.actionTimer[i] = action.windup;
  state.actionTargetId[i] = targetId;
  state.actionDidHit[i] = 0;

  if (targetId >= 0 && targetId < state.count && state.alive[targetId]) {
    const dx = state.x[targetId] - state.x[i];
    const dy = state.y[targetId] - state.y[i];
    const n = normalize(dx, dy);
    if (n.x !== 0 || n.y !== 0) {
      state.actionDirX[i] = n.x;
      state.actionDirY[i] = n.y;
      state.desiredFacing[i] = Math.atan2(n.y, n.x);
    }
  } else {
    state.actionDirX[i] = Math.cos(state.facing[i]);
    state.actionDirY[i] = Math.sin(state.facing[i]);
  }

  state.stamina[i] = Math.max(0, state.stamina[i] - action.staminaCost);
  return true;
}

function isInArc(state, attacker, target, action) {
  const dx = state.x[target] - state.x[attacker];
  const dy = state.y[target] - state.y[attacker];
  const d2 = dx * dx + dy * dy;
  const reach = action.reach + 6 + 6; // target radius + attacker radius approx
  if (d2 > reach * reach) return false;
  const ang = Math.atan2(dy, dx);
  const f = Math.atan2(state.actionDirY[attacker], state.actionDirX[attacker]);
  return Math.abs(angleDiff(f, ang)) <= action.arc * 0.5;
}

function isBlocked(state, defender, attacker, incomingAngle) {
  // Active block defends within its arc relative to defender facing/action dir
  if (state.actionId[defender] !== ACTION_BLOCK) return false;
  if (state.actionPhase[defender] !== ACTION_PHASE_ACTIVE && state.actionPhase[defender] !== ACTION_PHASE_WINDUP) return false;
  const cfg = state.configOf(defender);
  const block = getAction(cfg, ACTION_BLOCK);
  if (!block) return false;
  // Defender blocks attacks coming from front: attack direction toward defender should be within block arc of defender facing
  const toAttacker = Math.atan2(state.y[attacker] - state.y[defender], state.x[attacker] - state.x[defender]);
  const facing = state.facing[defender];
  return Math.abs(angleDiff(facing, toAttacker)) <= block.arc * 0.5;
}

function applyHit(state, attacker, target, action) {
  if (!state.alive[target]) return;
  if (action.defensive) return;

  const toTargetAng = Math.atan2(state.y[target] - state.y[attacker], state.x[target] - state.x[attacker]);
  if (isBlocked(state, target, attacker, toTargetAng)) {
    // blocked: reduced displacement and no damage
    if (action.displacement > 0) {
      const n = normalize(state.x[target] - state.x[attacker], state.y[target] - state.y[attacker]);
      const impulse = action.displacement * 0.25;
      state.vx[target] += n.x * impulse;
      state.vy[target] += n.y * impulse;
    }
    return;
  }

  if (action.damage > 0) {
    state.hp[target] -= action.damage;
    if (state.hp[target] <= 0 && state.alive[target]) {
      state.alive[target] = 0;
      state.hp[target] = 0;
      state.vx[target] = 0;
      state.vy[target] = 0;
      state.actionPhase[target] = ACTION_PHASE_IDLE;
      state.actionId[target] = ACTION_NONE;
      state.targetId[target] = -1;
      if (state.team[attacker] === TEAM_RED) state.killsRed++;
      else state.killsBlue++;
    }
  }

  if (action.displacement > 0 && state.alive[target]) {
    const n = normalize(state.x[target] - state.x[attacker], state.y[target] - state.y[attacker]);
    const impulse = action.displacement;
    state.vx[target] += n.x * impulse;
    state.vy[target] += n.y * impulse;
  }
}

export function updateCombat(state, dt) {
  for (let i = 0; i < state.count; i++) {
    if (!state.alive[i]) continue;
    const cfg = state.configOf(i);
    // stamina regen
    state.stamina[i] = Math.min(cfg.stamina, state.stamina[i] + cfg.staminaRegen * dt);

    const phase = state.actionPhase[i];
    if (phase === ACTION_PHASE_IDLE) continue;
    const action = getAction(cfg, state.actionId[i]);
    if (!action) { state.actionPhase[i] = ACTION_PHASE_IDLE; state.actionId[i] = ACTION_NONE; continue; }

    state.actionTimer[i] -= dt;

    if (phase === ACTION_PHASE_WINDUP) {
      // face action direction during windup
      state.desiredFacing[i] = Math.atan2(state.actionDirY[i], state.actionDirX[i]);
      if (state.actionTimer[i] <= 0) {
        state.actionPhase[i] = ACTION_PHASE_ACTIVE;
        state.actionTimer[i] = action.active;
        state.actionDidHit[i] = 0;
      }
    } else if (phase === ACTION_PHASE_ACTIVE) {
      // attacker follow-through for displacement actions
      if (action.attackerAdvance > 0) {
        state.vx[i] += state.actionDirX[i] * action.attackerAdvance * 60 * dt;
        state.vy[i] += state.actionDirY[i] * action.attackerAdvance * 60 * dt;
      }

      if (!action.defensive && !state.actionDidHit[i]) {
        // apply to primary target if valid, else any enemy in arc
        const tid = state.actionTargetId[i];
        if (tid >= 0 && tid < state.count && state.alive[tid] && state.team[tid] !== state.team[i] && isInArc(state, i, tid, action)) {
          applyHit(state, i, tid, action);
          state.actionDidHit[i] = 1;
        } else {
          // fallback: first enemy in arc
          for (let j = 0; j < state.count; j++) {
            if (i === j || !state.alive[j] || state.team[j] === state.team[i]) continue;
            if (isInArc(state, i, j, action)) { applyHit(state, i, j, action); state.actionDidHit[i] = 1; break; }
          }
        }
      }

      if (state.actionTimer[i] <= 0) {
        state.actionPhase[i] = ACTION_PHASE_RECOVERY;
        state.actionTimer[i] = action.recovery;
      }
    } else if (phase === ACTION_PHASE_RECOVERY) {
      if (state.actionTimer[i] <= 0) {
        state.actionPhase[i] = ACTION_PHASE_IDLE;
        state.actionId[i] = ACTION_NONE;
        state.actionTargetId[i] = -1;
        state.actionDidHit[i] = 0;
      }
    }
  }
}
