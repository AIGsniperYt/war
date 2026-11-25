import {
  ACTION_NONE, ACTION_PHASE_IDLE, MAX_SOLDIERS, PHASE_DEPLOYMENT, TEAM_RED
} from './constants.js';
import { DEFAULT_CONFIG } from './actions.js';

export class WorldState {
  constructor(capacity = MAX_SOLDIERS) {
    this.capacity = capacity;
    this.count = 0;

    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.facing = new Float32Array(capacity);
    this.desiredFacing = new Float32Array(capacity);
    this.moveX = new Float32Array(capacity);
    this.moveY = new Float32Array(capacity);

    this.team = new Uint8Array(capacity);
    this.alive = new Uint8Array(capacity);
    this.hp = new Float32Array(capacity);
    this.stamina = new Float32Array(capacity);

    this.reactionTimer = new Float32Array(capacity);
    this.targetId = new Int32Array(capacity);
    this.targetCommit = new Float32Array(capacity);

    this.actionId = new Uint8Array(capacity);
    this.actionPhase = new Uint8Array(capacity);
    this.actionTimer = new Float32Array(capacity);
    this.actionTargetId = new Int32Array(capacity);
    this.actionDirX = new Float32Array(capacity);
    this.actionDirY = new Float32Array(capacity);
    this.actionDidHit = new Uint8Array(capacity);
    this.hitFlash = new Float32Array(capacity);

    this.cfg = new Uint16Array(capacity);

    this.targetId.fill(-1);
    this.actionTargetId.fill(-1);

    this.phase = PHASE_DEPLOYMENT;
    this.time = 0;
    this.tick = 0;
    this.winner = null; // 0 red, 1 blue, -1 draw, null ongoing
    this.killsRed = 0;
    this.killsBlue = 0;
    this.configs = [DEFAULT_CONFIG];
    this._deploymentSnapshot = null;
  }

  configOf(i) {
    return this.configs[this.cfg[i]] || DEFAULT_CONFIG;
  }

  addSoldier(x, y, team, facing, configIndex = 0) {
    if (this.count >= this.capacity) return -1;
    const i = this.count++;
    const c = this.configs[configIndex] || DEFAULT_CONFIG;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = 0;
    this.vy[i] = 0;
    const f = facing !== undefined ? facing : (team === TEAM_RED ? 0 : Math.PI);
    this.facing[i] = f;
    this.desiredFacing[i] = f;
    this.moveX[i] = 0;
    this.moveY[i] = 0;
    this.team[i] = team;
    this.alive[i] = 1;
    this.hp[i] = c.hp;
    this.stamina[i] = c.stamina;
    this.reactionTimer[i] = Math.random() * c.reactionInterval;
    this.targetId[i] = -1;
    this.targetCommit[i] = 0;
    this.actionId[i] = ACTION_NONE;
    this.actionPhase[i] = ACTION_PHASE_IDLE;
    this.actionTimer[i] = 0;
    this.actionTargetId[i] = -1;
    this.actionDirX[i] = Math.cos(f);
    this.actionDirY[i] = Math.sin(f);
    this.actionDidHit[i] = 0;
    this.hitFlash[i] = 0;
    this.cfg[i] = configIndex;
    return i;
  }

  removeAt(index) {
    if (index < 0 || index >= this.count) return;
    const last = this.count - 1;
    if (index !== last) this.copySoldier(last, index);
    this.count = last;
  }

  copySoldier(src, dst) {
    this.x[dst] = this.x[src]; this.y[dst] = this.y[src];
    this.vx[dst] = this.vx[src]; this.vy[dst] = this.vy[src];
    this.facing[dst] = this.facing[src]; this.desiredFacing[dst] = this.desiredFacing[src];
    this.moveX[dst] = this.moveX[src]; this.moveY[dst] = this.moveY[src];
    this.team[dst] = this.team[src]; this.alive[dst] = this.alive[src];
    this.hp[dst] = this.hp[src]; this.stamina[dst] = this.stamina[src];
    this.reactionTimer[dst] = this.reactionTimer[src];
    this.targetId[dst] = this.targetId[src]; this.targetCommit[dst] = this.targetCommit[src];
    this.actionId[dst] = this.actionId[src]; this.actionPhase[dst] = this.actionPhase[src];
    this.actionTimer[dst] = this.actionTimer[src]; this.actionTargetId[dst] = this.actionTargetId[src];
    this.actionDirX[dst] = this.actionDirX[src]; this.actionDirY[dst] = this.actionDirY[src];
    this.actionDidHit[dst] = this.actionDidHit[src];
    this.hitFlash[dst] = this.hitFlash[src];
    this.cfg[dst] = this.cfg[src];
  }

  clearAll() {
    this.count = 0;
    this.time = 0;
    this.tick = 0;
    this.winner = null;
    this.killsRed = 0;
    this.killsBlue = 0;
    this.phase = PHASE_DEPLOYMENT;
    this._deploymentSnapshot = null;
  }

  snapshotDeployment() {
    const n = this.count;
    const snap = {
      count: n,
      x: this.x.slice(0, n), y: this.y.slice(0, n),
      facing: this.facing.slice(0, n), team: this.team.slice(0, n),
      cfg: this.cfg.slice(0, n),
    };
    this._deploymentSnapshot = snap;
  }

  restoreDeployment() {
    const snap = this._deploymentSnapshot;
    if (!snap) return false;
    this.count = 0;
    this.time = 0;
    this.tick = 0;
    this.winner = null;
    this.killsRed = 0;
    this.killsBlue = 0;
    this.phase = PHASE_DEPLOYMENT;
    for (let i = 0; i < snap.count; i++) {
      this.addSoldier(snap.x[i], snap.y[i], snap.team[i], snap.facing[i], snap.cfg[i]);
    }
    this.time = 0;
    this.tick = 0;
    this.winner = null;
    this.killsRed = 0;
    this.killsBlue = 0;
    this.phase = PHASE_DEPLOYMENT;
    // Re-snapshot so repeated resets work
    this.snapshotDeployment();
    return true;
  }

  stats() {
    let redAlive = 0, blueAlive = 0, redTotal = 0, blueTotal = 0;
    for (let i = 0; i < this.count; i++) {
      const isRed = this.team[i] === TEAM_RED;
      if (isRed) redTotal++; else blueTotal++;
      if (this.alive[i]) { if (isRed) redAlive++; else blueAlive++; }
    }
    return {
      redAlive, blueAlive, redTotal, blueTotal,
      redKills: this.killsRed, blueKills: this.killsBlue,
      time: this.time, winner: this.winner, phase: this.phase,
    };
  }
}
