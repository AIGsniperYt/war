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
