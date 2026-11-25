import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldState } from '../src/sim/state.js';
import { Simulation } from '../src/sim/sim.js';
import { ACTION_BLOCK, ACTION_PHASE_ACTIVE, ACTION_PHASE_WINDUP, TEAM_RED, TEAM_BLUE } from '../src/sim/constants.js';
import { tryStartAction } from '../src/sim/combat.js';

function runSim(world, steps, dt = 1 / 60) {
  const sim = new Simulation(world);
  sim.startBattle();
  for (let i = 0; i < steps; i++) sim.step(dt);
  return sim;
}

function snapshot(world) {
  const s = [];
  for (let i = 0; i < world.count; i++) {
    s.push({
      i, alive: world.alive[i], hp: world.hp[i], x: +world.x[i].toFixed(4), y: +world.y[i].toFixed(4),
      vx: +world.vx[i].toFixed(4), vy: +world.vy[i].toFixed(4), target: world.targetId[i], action: world.actionId[i], phase: world.actionPhase[i],
    });
  }
  return s;
}

test('deterministic reproduction', () => {
  function scenario() {
    const w = new WorldState();
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      w.addSoldier(-60 + c * 14, -30 + r * 14, TEAM_RED, 0);
      w.addSoldier(60 - c * 14, -30 + r * 14, TEAM_BLUE, Math.PI);
    }
    const sim = runSim(w, 600);
    return { snap: snapshot(w), stats: w.stats(), time: w.time };
  }
  const a = scenario();
  const b = scenario();
  assert.deepEqual(a, b);
});

test('target retention keeps valid target', () => {
  const w = new WorldState();
  const a = w.addSoldier(0, 0, TEAM_RED, 0);
  const b = w.addSoldier(30, 0, TEAM_BLUE, Math.PI);
  const sim = new Simulation(w);
  sim.startBattle();
  // run a few decision ticks
  for (let i = 0; i < 60; i++) sim.step(1 / 60);
  assert.equal(w.targetId[a], b);
  const first = w.targetId[a];
  for (let i = 0; i < 120; i++) sim.step(1 / 60);
  assert.ok(w.targetId[a] === first || !w.alive[b] || w.targetId[a] === -1);
});

test('1v1 combat produces damage and a winner', () => {
  const w = new WorldState();
  w.addSoldier(0, 0, TEAM_RED, 0);
  w.addSoldier(18, 0, TEAM_BLUE, Math.PI);
  runSim(w, 60 * 20);
  const s = w.stats();
  assert.ok(s.redKills + s.blueKills >= 1);
  assert.ok(s.winner === TEAM_RED || s.winner === TEAM_BLUE || s.winner === -1);
});

test('2v1 local numerical superiority', () => {
  function duel() {
    const w = new WorldState();
    w.addSoldier(-20, 0, TEAM_RED, 0);
    w.addSoldier(20, 0, TEAM_BLUE, Math.PI);
    runSim(w, 60 * 30);
    return w.stats();
  }
  function twoVsOne() {
    const w = new WorldState();
    w.addSoldier(-20, -10, TEAM_RED, 0);
    w.addSoldier(-20, 10, TEAM_RED, 0);
    w.addSoldier(20, 0, TEAM_BLUE, Math.PI);
    runSim(w, 60 * 30);
    return w.stats();
  }
  // Run a few trials with slight position variations to be robust
  let twoWins = 0, oneWins = 0;
  for (let k = 0; k < 5; k++) {
    const w = new WorldState();
    w.addSoldier(-20, -10 + k * 0.5, TEAM_RED, 0);
    w.addSoldier(-20, 10 - k * 0.5, TEAM_RED, 0);
    w.addSoldier(20, k * 0.2, TEAM_BLUE, Math.PI);
    runSim(w, 60 * 40);
    const s = w.stats();
    if (s.winner === TEAM_RED) twoWins++;
    if (s.winner === TEAM_BLUE) oneWins++;
  }
  assert.ok(twoWins >= 3, `expected 2v1 to usually win, got red=${twoWins} blue=${oneWins}`);
});

test('directional blocking reduces damage', () => {
  function damageReceived(withBlock) {
    const w = new WorldState();
    const attacker = w.addSoldier(0, 0, TEAM_RED, 0);
    const defender = w.addSoldier(16, 0, TEAM_BLUE, Math.PI);
    const sim = new Simulation(w);
    sim.startBattle();
    // Prevent AI from interfering with controlled setup
    w.reactionTimer[attacker] = 999;
    w.reactionTimer[defender] = 999;
    if (withBlock) {
      w.desiredFacing[defender] = Math.PI;
      w.facing[defender] = Math.PI;
      tryStartAction(w, defender, ACTION_BLOCK, attacker);
      for (let i = 0; i < 8; i++) { w.reactionTimer[attacker] = 999; w.reactionTimer[defender] = 999; sim.step(1/60); }
    }
    const before = w.hp[defender];
    w.facing[attacker] = 0;
    w.desiredFacing[attacker] = 0;
    w.actionPhase[attacker] = 0; w.actionId[attacker] = 0; w.actionTimer[attacker] = 0; w.actionDidHit[attacker] = 0;
    w.reactionTimer[attacker] = 999; w.reactionTimer[defender] = 999;
    tryStartAction(w, attacker, 1, defender); // strike
    for (let i = 0; i < 60; i++) { w.reactionTimer[attacker] = 999; w.reactionTimer[defender] = 999; sim.step(1/60); }
    return before - w.hp[defender];
  }
  const blocked = damageReceived(true);
  const unblocked = damageReceived(false);
  assert.ok(unblocked > 0, 'unblocked should take damage');
  assert.ok(blocked < unblocked, `blocked ${blocked} should be less than unblocked ${unblocked}`);
});

test('exact-overlap stability is deterministic and finite', () => {
  function scenario() {
    const w = new WorldState();
    for (let i = 0; i < 10; i++) w.addSoldier(0, 0, TEAM_RED, 0);
    for (let i = 0; i < 10; i++) w.addSoldier(0, 0, TEAM_BLUE, Math.PI);
    runSim(w, 240);
    let ok = true;
    for (let i = 0; i < w.count; i++) {
      if (!Number.isFinite(w.x[i]) || !Number.isFinite(w.y[i]) || !Number.isFinite(w.vx[i]) || !Number.isFinite(w.vy[i])) ok = false;
    }
    return { ok, snap: snapshot(w) };
  }
  const a = scenario();
  const b = scenario();
  assert.equal(a.ok, true);
  assert.deepEqual(a.snap, b.snap);
});

test('crowd compression and squeezing', () => {
  const w = new WorldState();
  // Dense red block moves toward target through a narrow gap.
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) w.addSoldier(-60 + c * 12, -18 + r * 12, TEAM_RED, 0);
  // Blue wall with a narrow gap around y=0
  for (let r = 0; r < 8; r++) {
    const y = -70 + r * 20;
    if (Math.abs(y) < 15) continue; // leave gap
    w.addSoldier(0, y, TEAM_BLUE, Math.PI);
  }
  w.addSoldier(70, 0, TEAM_BLUE, Math.PI); // target behind wall
  runSim(w, 60 * 15);
  let progressed = 0;
  for (let i = 0; i < 16; i++) if (w.alive[i] && w.x[i] > -20) progressed++;
  assert.ok(progressed >= 3, `expected some soldiers to squeeze/progress, got ${progressed}`);
});

test('mirrored deployment consistency', () => {
  function mirrored() {
    const w = new WorldState();
    const coords = [[-60,-20],[-60,0],[-60,20],[-40,-10],[-40,10]];
    for (const [x,y] of coords) w.addSoldier(x, y, TEAM_RED, 0);
    for (const [x,y] of coords) w.addSoldier(-x, y, TEAM_BLUE, Math.PI);
    runSim(w, 600);
    return w.stats();
  }
  const s = mirrored();
  // Mirrored setup should not produce wildly one-sided result; small asymmetry can come from deterministic ID-based scheduling.
  assert.ok(Math.abs(s.redAlive - s.blueAlive) <= 3, `mirrored should be close: red ${s.redAlive} blue ${s.blueAlive}`);
  assert.ok(Math.abs(s.redKills - s.blueKills) <= 3, `kills close: red ${s.redKills} blue ${s.blueKills}`);
});

test('opposing dense formations do not freeze', () => {
  const w = new WorldState();
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    w.addSoldier(-30 + c * 10, -20 + r * 10, TEAM_RED, 0);
    w.addSoldier(30 - c * 10, -20 + r * 10, TEAM_BLUE, Math.PI);
  }
  const sim = new Simulation(w);
  sim.startBattle();
  for (let i = 0; i < 60 * 10; i++) sim.step(1 / 60);
  const s = w.stats();
  assert.ok(s.redKills + s.blueKills > 0, 'dense formations should engage and produce casualties');
  let moved = 0;
  for (let i = 0; i < w.count; i++) {
    if (Math.abs(w.x[i]) < 200 && Math.abs(w.y[i]) < 200) moved++;
  }
  assert.ok(moved > 0, 'soldiers should remain finite/in-bounds');
});
