import { ACTION_PHASE_ACTIVE, ACTION_PHASE_WINDUP, SOLDIER_DIAMETER, SOLDIER_RADIUS } from './constants.js';
import { clamp, rotateTowards } from '../util/math.js';

let _corrX = null;
let _corrY = null;
let _corrN = null;

function ensureScratch(capacity) {
  if (_corrX && _corrX.length >= capacity) return;
  _corrX = new Float32Array(capacity);
  _corrY = new Float32Array(capacity);
  _corrN = new Uint16Array(capacity);
}

export function updatePhysics(state, spatial, dt) {
  const count = state.count;
  ensureScratch(state.capacity);

  // Integrate desired movement into velocity
  for (let i = 0; i < count; i++) {
    if (!state.alive[i]) continue;
    const cfg = state.configOf(i);

    const maxTurn = cfg.turnSpeed * dt;
    state.facing[i] = rotateTowards(state.facing[i], state.desiredFacing[i], maxTurn);

    let mx = state.moveX[i];
    let my = state.moveY[i];
    const ml = Math.sqrt(mx * mx + my * my);
    if (ml > 1) { mx /= ml; my /= ml; }

    const phase = state.actionPhase[i];
    let moveScale = 1;
    if (phase === ACTION_PHASE_WINDUP) moveScale = 0.25;
    else if (phase === ACTION_PHASE_ACTIVE) moveScale = 0.15;

    const desiredVx = mx * cfg.speed * moveScale;
    const desiredVy = my * cfg.speed * moveScale;
    const ax = clamp(desiredVx - state.vx[i], -cfg.accel * dt, cfg.accel * dt);
    const ay = clamp(desiredVy - state.vy[i], -cfg.accel * dt, cfg.accel * dt);
    state.vx[i] += ax;
    state.vy[i] += ay;

    if (ml < 0.01 && phase === 0) {
      const damp = Math.exp(-6 * dt);
      state.vx[i] *= damp;
      state.vy[i] *= damp;
    } else {
      const damp = Math.exp(-2.5 * dt);
      state.vx[i] *= damp;
      state.vy[i] *= damp;
    }
  }

  // Soft separation/compression using spatial hash (already rebuilt for this tick)
  const neighbors = [];
  const sepDist = SOLDIER_DIAMETER;
  const softExtra = SOLDIER_RADIUS * 1.4;
  const maxDist = sepDist + softExtra;

  _corrX.fill(0, 0, count);
  _corrY.fill(0, 0, count);
  _corrN.fill(0, 0, count);

  for (let i = 0; i < count; i++) {
    if (!state.alive[i]) continue;
    neighbors.length = 0;
    spatial.queryRadius(state.x[i], state.y[i], maxDist, neighbors);
    for (let k = 0; k < neighbors.length; k++) {
      const j = neighbors[k];
      if (j <= i || !state.alive[j]) continue;
      let dx = state.x[j] - state.x[i];
      let dy = state.y[j] - state.y[i];
      let d2 = dx * dx + dy * dy;
      if (d2 > maxDist * maxDist) continue;
      if (d2 < 1e-6) {
        const h = (((i + 1) * 73856093) ^ ((j + 1) * 19349663)) >>> 0;
        const a = (h / 4294967296) * Math.PI * 2;
        dx = Math.cos(a) * 0.1; dy = Math.sin(a) * 0.1;
        d2 = dx * dx + dy * dy;
      }
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const overlap = sepDist - d;

      if (overlap > 0) {
        const compress = clamp(overlap / sepDist, 0, 1);
        const push = overlap * 0.35 * (0.35 + 0.65 * (1 - compress * 0.5));
        _corrX[i] -= nx * push; _corrY[i] -= ny * push; _corrN[i]++;
        _corrX[j] += nx * push; _corrY[j] += ny * push; _corrN[j]++;

        // Dampen relative velocity along normal only (preserve tangential sliding)
        const rvx = state.vx[j] - state.vx[i];
        const rvy = state.vy[j] - state.vy[i];
        const relNormal = rvx * nx + rvy * ny;
        if (relNormal < 0) {
          const impulse = -relNormal * 0.45;
          state.vx[i] -= nx * impulse;
          state.vy[i] -= ny * impulse;
          state.vx[j] += nx * impulse;
          state.vy[j] += ny * impulse;
        }
        // Extra normal resistance in dense crowd, applied along normal only
        const resistance = 8 * compress + 2;
        const normalDrag = Math.exp(-resistance * dt);
        const viN = state.vx[i] * nx + state.vy[i] * ny;
        const vjN = state.vx[j] * nx + state.vy[j] * ny;
        state.vx[i] += nx * (viN * normalDrag - viN);
        state.vy[i] += ny * (viN * normalDrag - viN);
        state.vx[j] += nx * (vjN * normalDrag - vjN);
        state.vy[j] += ny * (vjN * normalDrag - vjN);
      } else {
        const gap = d - sepDist;
        if (gap < softExtra) {
          const t = 1 - gap / softExtra;
          const nudge = t * 2.0 * dt;
          state.vx[i] -= nx * nudge;
          state.vy[i] -= ny * nudge;
          state.vx[j] += nx * nudge;
          state.vy[j] += ny * nudge;
        }
      }
    }
  }

  // Apply accumulated position corrections (reduces iteration-order dependence)
  for (let i = 0; i < count; i++) {
    if (!state.alive[i]) continue;
    const n = _corrN[i];
    if (n > 0) {
      // Clamp total correction to avoid explosions in very dense piles
      const cx = _corrX[i];
      const cy = _corrY[i];
      const cl = Math.sqrt(cx * cx + cy * cy);
      const maxC = SOLDIER_RADIUS * 1.5;
      if (cl > maxC) {
        const s = maxC / cl;
        state.x[i] += cx * s;
        state.y[i] += cy * s;
      } else {
        state.x[i] += cx;
        state.y[i] += cy;
      }
    }
  }

  // Integrate positions
  for (let i = 0; i < count; i++) {
    if (!state.alive[i]) continue;
    const sp = Math.sqrt(state.vx[i] * state.vx[i] + state.vy[i] * state.vy[i]);
    const maxSp = state.configOf(i).speed * 2.2;
    if (sp > maxSp) { const s = maxSp / sp; state.vx[i] *= s; state.vy[i] *= s; }
    state.x[i] += state.vx[i] * dt;
    state.y[i] += state.vy[i] * dt;
  }
}
