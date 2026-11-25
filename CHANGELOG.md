# Developer Changelog

---

## 2026-11-25

### M0 — Deployment playground scaffold (`index.html`, `styles.css`, `src/main.js`, `src/sim/*`, `src/render/*`, `src/ui/*`)
- **Project bootstrap** — plain JavaScript ES modules, no bundler, no framework. `index.html` loads `src/main.js` directly; `styles.css` at root. Static server (`python3 -m http.server`) for local dev.
- **Sim/render split** — simulation state and stepping live under `src/sim/`, Canvas 2D rendering under `src/render/`, DOM controls under `src/ui/`. Fixed-timestep sim decoupled from render FPS.
- **Deployment playground** — dark grid battlefield, camera pan (RMB/MMB drag) and wheel zoom, red/blue directional chevron soldiers, place/remove mode, square brush sizes 1/4/9/16 with preview, start/reset/clear controls, basic battle phase state.
- **Data layout** — typed-array SoA soldier state (`WorldState`) for hot fields (position, velocity, facing, hp, stamina, action state, AI state). Capacity-capped, swap-remove for deployment edits.

### M1 — Autonomous movement (in progress)
- **Perception** — spatial hash neighbor queries, distance + directional FOV checks, no omniscience.
- **Target selection** — weighted utility score (proximity, facing, opportunity, congestion/threat penalties) with target commitment/hysteresis to avoid thrashing.
- **Steering** — candidate-direction evaluation (16 directions) scoring target progress, ally separation, local congestion, enemy threat, movement continuity; not naive beeline-only.
- **Reaction scheduling** — per-soldier reaction interval with staggered timers; decision updates spread across ticks.

### M2 — Physical interactions (in progress)
- **Soft separation** — circular footprints with damped repulsion, compression resistance, squeeze-through behavior; no rigid locking.
- **Spatial hash** — grid-based neighbor queries for AI/physics/combat.

### M3 — Combat (in progress)
- **Action system** — data-driven action defs with reach, arc, windup, active, recovery, damage, displacement, attacker advance, stamina cost.
- **Baseline actions** — Strike, Block, Barge, Kick (Barge/Kick share displacement action family with different physical parameters).
- **Resolution** — deterministic arc+reach checks, directional block defense, health/death, battle termination, basic results.

### Post-scaffold polish (2026-11-25)
- **Pause/resume** — simulation can be paused/resumed during battle; accumulator freezes while paused.
- **UI layout** — controls moved to top-right; centered status banner replaces the top-right phase pill. Banner reflects deployment/running/paused/ended states.
- **Battle readability** — hit flashes on damage, action arc indicators for windup/active/recovery, optional debug overlay (FOV cones + target lines).
- **Cohesion/alignment fix** — stronger ally cohesion and alignment, regrouping when no target is visible, isolated units scan instead of wandering off. Reduces "deserting" behavior.
- **Unit inspector** — during sim/ended phases cursor returns to pointer; hovering highlights units, clicking selects with a clear ring, and a left-side inspector shows organized stats (HP/stamina bars), compact state (position/speed/facing/target/action/reaction), and visual overlay toggles (target line, move intent, FOV, action arc).

### Correctness & performance audit patch (2026-11-25)
- **Determinism** — removed `Math.random()` from sim (reaction offsets use deterministic ID-based scheduling; exact-overlap separation uses deterministic pair hash; combat/action decisions are contextual/deterministic). Identical deployments reproduce identical results.
- **AI** — removed unused target scoring/dead code; target selection uses distance, bearing, accessibility, and commitment with no per-candidate spatial scans; no 2v1 focus-fire penalty, only direct-line accessibility penalty. Action selection is deterministic and contextual (strike/block/barge/kick) and runs on reaction intervals; execution/physics continue every tick.
- **Steering** — preserved 16-direction evaluation but accumulated linear influence vectors in one neighbor pass (O(k+16) per agent instead of O(16k)); extensible for future obstacles.
- **Physics** — normal-only collision resistance preserves tangential sliding; accumulated pairwise position corrections reduce iteration-order dependence; dense crowds resist freezing.
- **Combat** — local spatial fallback for hits (nearest eligible in arc), preserves original target when valid; block defense applies on active block phase; deterministic directional geometry preserved.
- **Perf/sim** — single spatial-hash rebuild per tick, bucket reuse in spatial hash, fixed-timestep constants used consistently, anti-spiral discard time measured (`sim.discardedTime`).
- **Tests** — added Node built-in test suite (`npm test`) covering determinism, target retention, 1v1, 2v1 local superiority, directional blocking, exact-overlap stability, crowd squeezing, mirrored deployment, opposing dense formations.
- **Benchmarks** — `BENCHMARK_HEADLESS.md`/`BENCHMARK_BROWSER.md` updated; headless suite in `scripts/benchmark-headless.js` reports dirty commit hashes to avoid misattribution; browser logger includes discarded sim time.
