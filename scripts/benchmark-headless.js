import { execSync } from 'node:child_process';
import { WorldState } from '../src/sim/state.js';
import { Simulation } from '../src/sim/sim.js';

function getCommit() {
  try { return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); }
  catch { return 'unknown'; }
}

function makeFrontline(countPerSide, cols, spacing, gap) {
  const w = new WorldState();
  const sim = new Simulation(w);
  const rows = Math.ceil(countPerSide / cols);
  const halfY = (cols - 1) * spacing * 0.5;
  for (let i = 0; i < countPerSide; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const y = c * spacing - halfY;
    w.addSoldier(-gap / 2 - r * spacing, y, 0, 0, 0);
    w.addSoldier(gap / 2 + r * spacing, y, 1, Math.PI, 0);
  }
  sim.startBattle();
  for (let i = 0; i < 120; i++) sim.step(1 / 60); // 2s warmup
  const steps = 300; // 5s measured
  const t0 = performance.now();
  for (let i = 0; i < steps; i++) sim.step(1 / 60);
  const total = performance.now() - t0;
  const s = w.stats();
  return {
    scenario: `frontline-${countPerSide}v${countPerSide}`,
    totalSoldiers: w.count,
    alive: s.redAlive + s.blueAlive,
    redAlive: s.redAlive,
    blueAlive: s.blueAlive,
    steps,
    totalMs: +total.toFixed(2),
    msPerStep: +(total / steps).toFixed(3),
    stepsPerSec: +(1000 / (total / steps)).toFixed(1),
  };
}

const scenarios = [
  [100, 25, 14, 140],
  [200, 40, 14, 180],
  [500, 50, 14, 220],
];

const commit = getCommit();
console.log(`WAR headless benchmark`);
console.log(`commit: ${commit}`);
console.log(`node: ${process.version}`);
console.log(`platform: ${process.platform} ${process.arch}`);
console.log('');
for (const args of scenarios) {
  const r = makeFrontline(...args);
  console.log(JSON.stringify(r));
}
