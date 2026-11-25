import { ACTION_PHASE_ACTIVE, ACTION_PHASE_WINDUP, SOLDIER_DIAMETER, SOLDIER_RADIUS } from './constants.js';
import { clamp, length, rotateTowards } from '../util/math.js';

export function updatePhysics(state, spatial, dt) {
  const count = state.count;
  // Integrate desired movement into velocity
  for (let i = 0; i < count; i++) {
    if (!state.alive[i]) continue;
    const cfg = state.configOf(i);

    // Turning
    const maxTurn = cfg.turnSpeed * dt;
    state.facing[i] = rotateTowards(state.facing[i], state.desiredFacing[i], maxTurn);

    // Movement: desired moveX/moveY are direction/intention (-1..1), scaled by speed
    let mx = state.moveX[i];
    let my = state.moveY[i];
    const ml = Math.sqrt(mx * mx + my * my);
    if (ml > 1) { mx /= ml; my /= ml; }

    // During windup/active attack, reduce locomotion
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

    // Passive damping
    const damp = Math.exp(-2.5 * dt);
    if (ml < 0.01 && phase === 0) {
      state.vx[i] *= Math.exp(-6 * dt);
      state.vy[i] *= Math.exp(-6 * dt);
    } else {
      state.vx[i] *= damp;
      state.vy[i] *= damp;
    }
  }

  // Soft separation/compression using spatial hash
  spatial.rebuild(state);
  const neighbors = [];
  const sepDist = SOLDIER_DIAMETER;
  const sepDistSq = sepDist * sepDist;
  const softExtra = SOLDIER_RADIUS * 1.4; // allow squeeze
  const maxDist = sepDist + softExtra;

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
      if (d2 < 1e-6) { dx = (Math.random() - 0.5) * 0.1; dy = (Math.random() - 0.5) * 0.1; d2 = dx * dx + dy * dy; }
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const overlap = sepDist - d;

      if (overlap > 0) {
        // Soft repulsion: stronger as they compress, but not infinite.
        const compress = clamp(overlap / sepDist, 0, 1);
        // Allow squeezing: displacement correction is softened, velocity resistance increases
        const push = overlap * 0.35 * (0.35 + 0.65 * (1 - compress * 0.5));
        state.x[i] -= nx * push;
        state.y[i] -= ny * push;
        state.x[j] += nx * push;
        state.y[j] += ny * push;

        // Dampen relative velocity along normal to simulate crowd resistance
        const rvx = state.vx[j] - state.vx[i];
        const rvy = state.vy[j] - state.vy[i];
        const relNormal = rvx * nx + rvy * ny;
        const resistance = 8 * compress + 2;
        if (relNormal < 0) {
          const impulse = -relNormal * 0.45;
          state.vx[i] -= nx * impulse;
          state.vy[i] -= ny * impulse;
          state.vx[j] += nx * impulse;
          state.vy[j] += ny * impulse;
        }
        // Extra drag in dense crowd
        const drag = Math.exp(-resistance * dt);
        state.vx[i] *= drag; state.vy[i] *= drag;
        state.vx[j] *= drag; state.vy[j] *= drag;
      } else {
        // Mild separation to avoid touching
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

  // Integrate positions
  for (let i = 0; i < count; i++) {
    if (!state.alive[i]) continue;
    // Speed cap (allow some displacement burst but clamp)
    const sp = Math.sqrt(state.vx[i] * state.vx[i] + state.vy[i] * state.vy[i]);
    const maxSp = state.configOf(i).speed * 2.2;
    if (sp > maxSp) { const s = maxSp / sp; state.vx[i] *= s; state.vy[i] *= s; }
    state.x[i] += state.vx[i] * dt;
    state.y[i] += state.vy[i] * dt;
  }
}
