# WAR — TODO / Ideas Dump

> Informal, living dump. Not a commitment list. Stuff I want to try, stuff that's missing, stuff that's probably a bad idea but maybe cool.

## Now / M0-M3 finish
- [ ] Wire `main.js` + input + game loop (pan/zoom/place/remove/start/reset).
- [ ] Verify M0 deployment flow end-to-end in browser.
- [ ] Verify M1: soldiers steer around allies/congestion, no dumb beeline pileups.
- [ ] Verify M2: dense crowds compress/squeeze, no jitter-lock, displacement opens space.
- [ ] Verify M3: strike/block/barge/kick feel readable; battles end cleanly; reset works.
- [ ] Add simple battle outcome banner + restart flow polish.
- [ ] Basic performance sanity check (500/1000/2000 agents) and note results.

## Soon / polish
- [ ] Soldier inspector/debug overlay (target, action state, decision score, nearby counts).
- [ ] Pause/step/speed controls (0.5x/1x/2x).
- [ ] Deterministic seed / replay-friendly RNG option.
- [ ] Better visual feedback for hits, blocks, deaths (subtle, no clutter).
- [ ] Formation stamp presets as deployment templates (line, wedge, column) - templates only, not magic behavior.
- [ ] Configurable soldier archetypes in UI (speed/reaction/aggression etc.).

## Ideas / maybe later
- [ ] Terrain: hills, rivers, bridges, forests.
- [ ] Fortifications / obstacles.
- [ ] More action families / weapons with clear trade-offs.
- [ ] Morale/suppression as emergent-ish mechanic? careful - don't fake it.
- [ ] Commanders / squad directives (big jump).
- [ ] RL/self-play sandbox, headless sim, Rust/WASM sim core.
- [ ] Replay export / battle analytics.
- [ ] Campaign layer - very later.

## Notes / reminders
- Keep it explainable. If a soldier does something weird, we should be able to say why.
- No arbitrary buffs. No hidden dice.
- Simple rules first, watch what emerges, then tune.
