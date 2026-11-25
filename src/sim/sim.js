import { FIXED_DT, PHASE_DEPLOYMENT, PHASE_ENDED, PHASE_RUNNING, TEAM_RED, TEAM_BLUE } from './constants.js';
import { SpatialHash } from './spatial.js';
import { updateAI } from './ai.js';
import { updateCombat } from './combat.js';
import { updatePhysics } from './physics.js';

export class Simulation {
  constructor(state) {
    this.state = state;
    this.spatial = new SpatialHash();
    this.accumulator = 0;
  }

  startBattle() {
    const s = this.state;
    if (s.phase === PHASE_RUNNING) return;
    if (s.phase === PHASE_ENDED) this.resetToDeployment();
    // snapshot deployment for reset
    s.snapshotDeployment();
    s.phase = PHASE_RUNNING;
    s.time = 0;
    s.tick = 0;
    s.winner = null;
    s.killsRed = 0;
    s.killsBlue = 0;
    this.accumulator = 0;
    // reset dynamic state for soldiers
    for (let i = 0; i < s.count; i++) {
      const cfg = s.configOf(i);
      s.alive[i] = 1;
      s.hp[i] = cfg.hp;
      s.stamina[i] = cfg.stamina;
      s.vx[i] = 0; s.vy[i] = 0;
      s.moveX[i] = 0; s.moveY[i] = 0;
      s.targetId[i] = -1;
      s.targetCommit[i] = 0;
      s.actionId[i] = 0; s.actionPhase[i] = 0; s.actionTimer[i] = 0;
      s.actionTargetId[i] = -1; s.actionDidHit[i] = 0;
      s.reactionTimer[i] = Math.random() * cfg.reactionInterval;
      s.desiredFacing[i] = s.facing[i];
    }
  }

  resetToDeployment() {
    this.state.restoreDeployment();
    this.accumulator = 0;
  }

  clearAll() {
    this.state.clearAll();
    this.accumulator = 0;
  }

  step(dt) {
    const s = this.state;
    if (s.phase !== PHASE_RUNNING) return;
    s.time += dt;
    s.tick++;

    this.spatial.rebuild(s);
    updateAI(s, this.spatial, dt);
    updateCombat(s, dt);
    updatePhysics(s, this.spatial, dt);
    this.checkWinner();
  }

  checkWinner() {
    const s = this.state;
    if (s.phase !== PHASE_RUNNING) return;
    let red = 0, blue = 0;
    for (let i = 0; i < s.count; i++) {
      if (!s.alive[i]) continue;
      if (s.team[i] === TEAM_RED) red++; else blue++;
    }
    if (red === 0 && blue === 0) { s.winner = -1; s.phase = PHASE_ENDED; }
    else if (red === 0) { s.winner = TEAM_BLUE; s.phase = PHASE_ENDED; }
    else if (blue === 0) { s.winner = TEAM_RED; s.phase = PHASE_ENDED; }
  }

  update(frameDt) {
    if (this.state.phase !== PHASE_RUNNING) return;
    this.accumulator += Math.min(frameDt, 0.1);
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < 6) {
      this.step(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps++;
      if (this.state.phase === PHASE_ENDED) break;
    }
    if (steps === 6) this.accumulator = 0; // avoid spiral
  }
}
