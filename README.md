# WAR

Browser-based real-time military battlefield simulation. No game engine, no build step, plain JavaScript ES modules.

> Purposeful simplicity, emergent behaviour, explainability, computational efficiency, and incremental development.

## What it is right now

An M0-M3 prototype: deploy red and blue armies on an open grid, start the battle, and watch autonomous soldiers perceive, steer, collide, and fight until one side is eliminated.

## Run locally

```bash
cd war
python3 -m http.server 5173
# open http://localhost:5173
```

Any static server works. The dev entry is `index.html` loading `src/main.js` directly.

## Controls

- **Left click** — place/remove soldiers (deployment phase)
- **Right / middle drag** — pan camera
- **Mouse wheel** — zoom
- **UI panel** — team, brush size (1/4/9/16), place/remove mode, start/reset/clear

## Project layout

```
war/
├── index.html              # entry
├── styles.css              # UI/battlefield styling
├── CHANGELOG.md            # developer changelog
├── BUILD.md                # run/build notes
├── assets/
│   └── changelog.md        # player-facing changelog
├── docs/
│   └── todo.md             # informal planned features / ideas dump
└── src/
    ├── main.js             # boot + game loop wiring
    ├── sim/                # deterministic simulation (no DOM)
    │   ├── constants.js
    │   ├── actions.js
    │   ├── state.js        # SoA soldier state
    │   ├── spatial.js      # spatial hash
    │   ├── ai.js           # perception, target selection, steering
    │   ├── combat.js       # action state machine, damage, defense
    │   ├── physics.js      # movement, soft collision, compression
    │   └── sim.js          # fixed-timestep orchestrator
    ├── render/             # Canvas 2D rendering
    │   ├── camera.js
    │   └── renderer.js
    ├── ui/                 # DOM controls
    │   └── ui.js
    └── util/
        └── math.js
```

## Design guardrails

- No game engines. Browser-first.
- Sim and rendering are separated; sim is deterministic and fixed-timestep.
- Simple local rules, emergent collective behaviour. No hardcoded formations/tactics.
- Explainable, purposeful mechanics. No arbitrary stat boosts or random hit rolls.
- Performance-aware from the start (typed arrays, spatial hash, squared distances, staggered decisions).

## Status

M0-M3 prototype in active development. See `CHANGELOG.md` for dev detail and `docs/todo.md` for planned ideas.
