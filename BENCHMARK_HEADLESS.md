# WAR — Headless Benchmarks (Raw Sim Capacity)

> Sim-only benchmarks run in Node (no browser, no rendering, no DOM). Useful for measuring raw simulation throughput and regressions in AI/physics/combat/spatial logic. **Not a substitute for real browser FPS** — browser rendering, layout, GC, and frame pacing matter.

## How to run

From `war/`:

```bash
npm run bench:headless
# or: node scripts/benchmark-headless.js
```

The benchmark suite lives in `scripts/benchmark-headless.js`. Add scenarios there when needed; keep this doc for recorded results and comparisons.

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
