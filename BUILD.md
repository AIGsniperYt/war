# WAR — Build & Run Guide

> **Stack:** Plain JavaScript (ES modules) + Canvas 2D + DOM UI  
> **Entry:** `index.html` → `src/main.js`  
> **Build:** none required for dev; static files are deployable as-is.

---

## 1. Project structure

```
war/
├── index.html            # dev/prod entry (loads src/main.js directly)
├── styles.css            # battlefield + UI styles
├── package.json          # optional convenience scripts (static server)
├── CHANGELOG.md          # developer changelog
├── README.md
├── BUILD.md
├── assets/
│   └── changelog.md      # player-facing changelog
├── docs/
│   └── todo.md           # informal planned features / todo dump
└── src/
    ├── main.js           # boot, input, loop
    ├── sim/              # deterministic simulation
    ├── render/           # Canvas 2D
    ├── ui/               # DOM UI
    └── util/             # math/helpers
```

---

## 2. Run locally

No install required.

```bash
python3 -m http.server 5173
# open http://localhost:5173
```

Or any static server. ES modules must be served over HTTP (not `file://`) in most browsers.

---

## 3. Dev workflow

- Edit files in `src/`, refresh browser.
- Simulation logic goes in `src/sim/`; rendering in `src/render/`; DOM/UI in `src/ui/`.
- Keep sim deterministic: fixed timestep, no render-frame-dependent decisions.
- Prefer simple, inspectable mechanisms over opaque cleverness.

---

## 4. "Build"

There is no bundler/build pipeline by design right now. The source tree is the deployable artifact. If a build step is added later (e.g. for asset packing or WASM sim), document it here and keep the dev path runnable.

---

## 5. Deploy

Copy the repo/static files to any static host. Ensure `index.html`, `styles.css`, `assets/`, and `src/` are served together.

---

## 6. Checklist before sharing

1. `python3 -m http.server 5173` and open locally.
2. Place red/blue soldiers, start battle, confirm movement/combat/end state.
3. Reset returns to deployment snapshot; Clear wipes field.
4. Check browser console for errors.
5. Update `CHANGELOG.md` and `assets/changelog.md`.
