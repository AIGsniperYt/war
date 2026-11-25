# WAR — Headless Benchmarks (Raw Sim Capacity)

> Sim-only benchmarks run in Node (no browser, no rendering, no DOM). Useful for measuring raw simulation throughput and regressions in AI/physics/combat/spatial logic. **Not a substitute for real browser FPS** — browser rendering, layout, GC, and frame pacing matter.

## How to run

From `war/`:

```bash
node --input-type=module -e "<script>"
```

Or use the snippet below (adjust scenario as needed). Record the commit hash and paste results into a new entry.

### Standard scenario snippet

```js
import { WorldState } from './src/sim/state.js';
import { Simulation } from './src/sim/sim.js';

function makeFrontline(countPerSide, cols, spacing, gap) {
  const w = new WorldState();
  const sim = new Simulation(w);
  const rows = Math.ceil(countPerSide / cols);
  const halfY = (cols - 1) * spacing * 0.5;
  for (let i = 0; i < countPerSide; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const y = c * spacing - halfY;
    w.addSoldier(-gap/2 - r*spacing, y, 0, 0, 0);
    w.addSoldier(gap/2 + r*spacing, y, 1, Math.PI, 0);
  }
  sim.startBattle();
  for (let i = 0; i < 120; i++) sim.step(1/60); // 2s warmup
  const steps = 300; // 5s measured
  const t0 = performance.now();
  for (let i = 0; i < steps; i++) sim.step(1/60);
  const total = performance.now() - t0;
  const s = w.stats();
  console.log(JSON.stringify({
    scenario: `frontline-${countPerSide}v${countPerSide}`,
    totalSoldiers: w.count,
    alive: s.redAlive + s.blueAlive,
    steps,
    totalMs: +total.toFixed(2),
    msPerStep: +(total / steps).toFixed(3),
    stepsPerSec: +(1000 / (total / steps)).toFixed(1),
  }));
}

makeFrontline(100, 25, 14, 140);
makeFrontline(200, 40, 14, 180);
makeFrontline(500, 50, 14, 220);
```

## Recording format

Each entry should include:

- **Commit**: short hash
- **Description**: human-readable key points of this version
- **Machine/env**: CPU/OS/Node version (brief)
- **Scenario results**: table
- **Delta vs previous**: better/worse/same, key numbers
- **Delta vs last MAJOR checkpoint**: same format

---

## Entries

### 98b45a0 — Frontline presets + inspector/perf polish *(baseline)*

**Description:** M0-M3 prototype with tabbed controls, battle presets, unit inspector, hover/selection, debug overlays, and in-panel perf stats. Frontline preset placement fixed.

**Env:** Linux, Node (local dev machine) — fill exact CPU/Node if needed.

| Scenario | Soldiers | Alive (after warmup+5s) | Total ms | ms/step | steps/sec |
|---|---:|---:|---:|---:|---:|
| frontline-100v100 | 200 | 200 | 2962.01 | 9.873 | 101.3 |
| frontline-200v200 | 400 | 400 | 8474.39 | 28.248 | 35.4 |
| frontline-500v500 | 1000 | 1000 | 20916.22 | 69.721 | 14.3 |

**Delta vs previous:** N/A (baseline)
**Delta vs last MAJOR checkpoint:** N/A (baseline, checkpoint: 98b45a0)
