# WAR — Browser Benchmarks (Real-World)

> Real browser measurements reported by running the game and capturing console/perf output. This is the source of truth for actual playable performance. Headless raw sim capacity is tracked separately in `BENCHMARK_HEADLESS.md`.

## How to capture

1. Run `python3 -m http.server 5173` in `war/` and open the game.
2. Load a preset from the **Battles** tab (e.g. Frontline 500v500).
3. Start battle, let it settle for a few seconds.
4. Click **Log Benchmark** (Battles tab) or run `window.WAR_BENCH.log()` in DevTools console.
5. Paste the console output into a new entry below.

## What to record

- **Commit**: short hash (shown in log)
- **Description**: human-readable key points of this version
- **Machine/browser**: CPU/GPU/browser/OS (brief)
- **Scenario**: preset/scenario name
- **Results**: FPS, frame ms, sim ms/frame, steps/frame, soldiers/alive, time observed
- **Delta vs previous**: better/worse/same
- **Delta vs last MAJOR checkpoint**: better/worse/same

## Recording format

```text
=== WAR BENCHMARK ===
commit: <hash>
scenario: <name>
time: <s>
soldiers: <total> (alive <n>)
fps: <n>
frameMs: <n>
simMs: <n>
steps/frame: <n>
=====================
```

---

## Entries

<!-- Paste new entries above this line, newest first. -->

### Template

**Commit:** `<hash>`
**Description:** ...
**Machine/browser:** ...
**Scenario:** ...

| Metric | Value |
|---|---:|
| FPS |  |
| Frame ms |  |
| Sim ms/frame |  |
| Steps/frame |  |
| Soldiers total |  |
| Alive |  |

**Delta vs previous:** ...
**Delta vs last MAJOR checkpoint:** ...
