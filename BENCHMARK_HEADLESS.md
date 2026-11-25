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

### c781fb2 — Determinism + AI/physics/combat perf pass

**Description:** Deterministic sim (no Math.random in sim), contextual deterministic AI action selection, O(k+16) steering accumulation, normal-only collision resistance with accumulated corrections, local spatial combat fallback, single spatial rebuild per tick, spatial bucket reuse, discarded-time tracking, node:test suite, benchmark script dirty-hash guard.

**Env:** Intel(R) Core(TM) i7-4790 CPU @ 3.60GHz, Linux 7.0.0-44-generic x86_64, Node v24.18.1.

| Scenario | Total agents | Surviving (after warmup+5s) | Total ms | ms/step | steps/sec |
|---|---:|---:|---:|---:|---:|
| frontline-100v100 | 200 | 183 | 743.17 | 2.477 | 403.7 |
| frontline-200v200 | 400 | 385 | 1942.96 | 6.477 | 154.4 |
| frontline-500v500 | 1000 | 1000 | 4149.60 | 13.832 | 72.3 |

**Delta vs previous (98b45a0 baseline):** 100v100 ms/step 9.873 -> 2.477 (-74.9%), 200v200 28.248 -> 6.477 (-77.1%), 500v500 69.721 -> 13.832 (-80.2%). Steps/sec improved across all scenarios. Survivors differ because combat/AI behavior changed (deterministic, different decisions).

**Delta vs last MAJOR checkpoint (98b45a0):** Same as previous (98b45a0 is current checkpoint).

### 98b45a0 — Frontline presets + inspector/perf polish *(baseline, MAJOR checkpoint)*

**Description:** M0-M3 prototype with tabbed controls, battle presets, unit inspector, hover/selection, debug overlays, and in-panel perf stats. Frontline preset placement fixed.

**Env:** Intel(R) Core(TM) i7-4790 CPU @ 3.60GHz, Linux 7.0.0-44-generic x86_64, Node v24.18.1.

| Scenario | Total agents | Surviving (after warmup+5s) | Total ms | ms/step | steps/sec |
|---|---:|---:|---:|---:|---:|
| frontline-100v100 | 200 | 200 | 2962.01 | 9.873 | 101.3 |
| frontline-200v200 | 400 | 400 | 8474.39 | 28.248 | 35.4 |
| frontline-500v500 | 1000 | 1000 | 20916.22 | 69.721 | 14.3 |

**Delta vs previous:** N/A (baseline)
**Delta vs last MAJOR checkpoint:** N/A (baseline checkpoint)
