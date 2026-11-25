import { PHASE_DEPLOYMENT, PHASE_ENDED, PHASE_RUNNING, TEAM_BLUE, TEAM_RED, ACTION_PHASE_IDLE, ACTION_PHASE_WINDUP, ACTION_PHASE_ACTIVE, ACTION_PHASE_RECOVERY } from '../sim/constants.js';
import { getAction } from '../sim/actions.js';

export function createUI(root, callbacks) {
  root.innerHTML = `
    <div class="panel">
      <div class="title">WAR</div>
      <div class="label">Team</div>
      <div class="row" id="team-row">
        <button data-team="red" class="red active">Red</button>
        <button data-team="blue" class="blue">Blue</button>
      </div>
      <div class="label">Brush</div>
      <div class="row" id="brush-row">
        <button data-brush="1" class="active">1x1</button>
        <button data-brush="4">2x2</button>
        <button data-brush="9">3x3</button>
        <button data-brush="16">4x4</button>
      </div>
      <div class="label">Mode</div>
      <div class="row" id="mode-row">
        <button data-mode="place" class="active">Place</button>
        <button data-mode="remove">Remove</button>
      </div>
      <div class="row">
        <button id="start-btn" class="primary">Start Battle</button>
        <button id="pause-btn">Pause</button>
      </div>
      <div class="row">
        <button id="reset-btn">Reset</button>
        <button id="clear-btn" class="danger">Clear</button>
        <button id="debug-btn">Debug</button>
      </div>
      <div class="stat" id="stats"></div>
      <div class="help">
        Deploy: LMB place/remove. Sim: LMB inspect unit.<br>
        RMB/MMB drag: pan. Wheel: zoom. Debug shows FOV, targets, and arcs.
      </div>
    </div>
    <div class="banner" id="banner"></div>
    <div class="inspector" id="inspector"></div>
  `;

  const teamRow = root.querySelector('#team-row');
  const brushRow = root.querySelector('#brush-row');
  const modeRow = root.querySelector('#mode-row');
  const startBtn = root.querySelector('#start-btn');
  const pauseBtn = root.querySelector('#pause-btn');
  const resetBtn = root.querySelector('#reset-btn');
  const clearBtn = root.querySelector('#clear-btn');
  const debugBtn = root.querySelector('#debug-btn');
  const statsEl = root.querySelector('#stats');
  const banner = root.querySelector('#banner');
  const inspector = root.querySelector('#inspector');
  let lastInspectorId = -2;
  inspector.addEventListener('change', e => {
    const t = e.target;
    if (t && t.dataset && t.dataset.inspect) {
      state.inspect[t.dataset.inspect] = !!t.checked;
      if (t.dataset.inspect === 'details') {
        const d = inspector.querySelector('#insp-details');
        if (d) d.style.display = t.checked ? 'block' : 'none';
      }
    }
  });

  const state = {
    team: TEAM_RED,
    brush: 1,
    mode: 'place',
    debug: false,
    inspect: { target: true, move: true, fov: false, action: true, details: false },
  };

  function setActive(row, attr, value) {
    row.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset[attr] === String(value)));
  }

  teamRow.addEventListener('click', e => {
    const btn = e.target.closest('button[data-team]');
    if (!btn) return;
    state.team = btn.dataset.team === 'blue' ? TEAM_BLUE : TEAM_RED;
    setActive(teamRow, 'team', btn.dataset.team);
    callbacks.onChange?.(state);
  });
  brushRow.addEventListener('click', e => {
    const btn = e.target.closest('button[data-brush]');
    if (!btn) return;
    state.brush = parseInt(btn.dataset.brush, 10);
    setActive(brushRow, 'brush', state.brush);
    callbacks.onChange?.(state);
  });
  modeRow.addEventListener('click', e => {
    const btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    state.mode = btn.dataset.mode;
    setActive(modeRow, 'mode', state.mode);
    callbacks.onChange?.(state);
  });

  startBtn.addEventListener('click', () => callbacks.onStart?.());
  pauseBtn.addEventListener('click', () => callbacks.onPause?.());
  resetBtn.addEventListener('click', () => callbacks.onReset?.());
  clearBtn.addEventListener('click', () => callbacks.onClear?.());
  debugBtn.addEventListener('click', () => {
    state.debug = !state.debug;
    debugBtn.classList.toggle('active', state.debug);
    callbacks.onDebug?.(state.debug);
  });

  function fmt(n, d = 1) { return Number(n).toFixed(d); }
  function phaseName(p) {
    if (p === ACTION_PHASE_WINDUP) return 'windup';
    if (p === ACTION_PHASE_ACTIVE) return 'active';
    if (p === ACTION_PHASE_RECOVERY) return 'recovery';
    return 'idle';
  }

  function update(simState, sim, selectedId = -1) {
    const s = simState.stats();
    const paused = !!sim.paused;
    statsEl.innerHTML = `
      <strong style="color:var(--red)">Red</strong> ${s.redAlive}/${s.redTotal} alive &nbsp;|&nbsp;
      <strong style="color:var(--blue)">Blue</strong> ${s.blueAlive}/${s.blueTotal} alive<br>
      Kills: <span style="color:var(--red)">${s.redKills}</span> - <span style="color:var(--blue)">${s.blueKills}</span>
      &nbsp;|&nbsp; Time: ${s.time.toFixed(1)}s
    `;

    if (s.phase === PHASE_DEPLOYMENT) {
      banner.style.display = 'block';
      banner.textContent = 'Deployment — place both armies, then start the battle';
      startBtn.textContent = 'Start Battle';
      startBtn.disabled = false;
      pauseBtn.disabled = true;
      pauseBtn.textContent = 'Pause';
    } else if (s.phase === PHASE_RUNNING) {
      banner.style.display = 'block';
      banner.textContent = paused ? 'Paused' : 'Battle running';
      startBtn.textContent = 'Running...';
      startBtn.disabled = true;
      pauseBtn.disabled = false;
      pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    } else {
      let msg = 'Draw';
      if (s.winner === TEAM_RED) msg = 'Red wins';
      if (s.winner === TEAM_BLUE) msg = 'Blue wins';
      banner.style.display = 'block';
      banner.textContent = `${msg} — Reset to adjust deployment, or Start to replay`;
      startBtn.textContent = 'Restart Battle';
      startBtn.disabled = false;
      pauseBtn.disabled = true;
      pauseBtn.textContent = 'Pause';
    }

    if (selectedId < 0 || selectedId >= simState.count) {
      inspector.style.display = 'none';
      if (lastInspectorId !== -1) { inspector.innerHTML = ''; lastInspectorId = -1; }
    } else {
      if (lastInspectorId !== selectedId) buildInspector(selectedId, simState);
      updateInspector(selectedId, simState);
    }

    function buildInspector(id, st) {
      lastInspectorId = id;
      const cfg = st.configOf(id);
      const teamColor = st.team[id] === TEAM_RED ? 'var(--red)' : 'var(--blue)';
      inspector.style.display = 'block';
      inspector.innerHTML = `
        <div class="insp-head">
          <div>
            <div class="title" style="margin-bottom:2px">UNIT INSPECTOR</div>
            <div class="stat"><strong style="color:${teamColor}" id="insp-team"></strong> <span id="insp-id"></span> <span id="insp-dead" style="color:#ff8080"></span></div>
          </div>
          <button id="insp-close" class="insp-close">×</button>
        </div>

        <div class="insp-section">
          <div class="insp-row"><span>HP</span><span id="insp-hp-text"></span></div>
          <div class="bar"><div class="bar-fill hp" id="insp-hp-bar"></div></div>
          <div class="insp-row"><span>Stamina</span><span id="insp-sta-text"></span></div>
          <div class="bar"><div class="bar-fill sta" id="insp-sta-bar"></div></div>
        </div>

        <div class="insp-section">
          <div class="insp-kv"><span>Speed</span><strong id="insp-speed"></strong></div>
          <div class="insp-kv"><span>Target</span><strong id="insp-target"></strong></div>
          <div class="insp-kv"><span>Action</span><strong id="insp-action"></strong></div>
          <div class="insp-kv"><span>Reaction</span><strong id="insp-reaction"></strong></div>
        </div>

        <div class="insp-section">
          <div class="label" style="margin-bottom:8px">Visual overlays</div>
          <label class="toggle"><input type="checkbox" data-inspect="target" ${state.inspect.target ? 'checked' : ''}><span>Target line</span></label>
          <label class="toggle"><input type="checkbox" data-inspect="move" ${state.inspect.move ? 'checked' : ''}><span>Move intent</span></label>
          <label class="toggle"><input type="checkbox" data-inspect="fov" ${state.inspect.fov ? 'checked' : ''}><span>FOV cone</span></label>
          <label class="toggle"><input type="checkbox" data-inspect="action" ${state.inspect.action ? 'checked' : ''}><span>Action arc highlight</span></label>
        </div>

        <div class="insp-section">
          <label class="toggle"><input type="checkbox" data-inspect="details" ${state.inspect.details ? 'checked' : ''}><span>Show detailed stats</span></label>
          <div id="insp-details" style="display:${state.inspect.details ? 'block' : 'none'}; margin-top:8px;">
            <div class="insp-kv"><span>Position</span><strong id="insp-pos"></strong></div>
            <div class="insp-kv"><span>Velocity</span><strong id="insp-vel"></strong></div>
            <div class="insp-kv"><span>Facing</span><strong id="insp-facing"></strong></div>
            <div class="insp-kv"><span>Move intent</span><strong id="insp-move"></strong></div>
            <div class="insp-kv"><span>Action target</span><strong id="insp-atarget"></strong></div>
            <div class="insp-kv"><span>Hit flash</span><strong id="insp-flash"></strong></div>
          </div>
        </div>

        <div class="insp-section" style="margin-bottom:0">
          <div class="label" style="margin-bottom:8px">Config</div>
          <div class="insp-kv"><span>Archetype</span><strong>${cfg.name}</strong></div>
          <div class="insp-kv"><span>Speed / Accel</span><strong>${fmt(cfg.speed,0)} / ${fmt(cfg.accel,0)}</strong></div>
          <div class="insp-kv"><span>Turn / Reaction</span><strong>${fmt(cfg.turnSpeed,2)} / ${fmt(cfg.reactionInterval,2)}s</strong></div>
          <div class="insp-kv"><span>Perception / FOV</span><strong>${fmt(cfg.perceptionRange,0)} / ${fmt(cfg.fov,2)}</strong></div>
          <div class="insp-kv"><span>Aggression</span><strong>${fmt(cfg.aggression,2)}</strong></div>
        </div>
      `;
      const close = inspector.querySelector('#insp-close');
      if (close) close.addEventListener('click', () => { callbacks.onClearSelection?.(); });
    }

    function updateInspector(id, st) {
      if (id < 0 || id >= st.count) return;
      const cfg = st.configOf(id);
      const action = getAction(cfg, st.actionId[id]);
      const target = st.targetId[id];
      const hpPct = Math.max(0, Math.min(1, st.hp[id] / cfg.hp));
      const staPct = Math.max(0, Math.min(1, st.stamina[id] / cfg.stamina));
      const speed = Math.hypot(st.vx[id], st.vy[id]);
      const teamName = st.team[id] === TEAM_RED ? 'Red' : 'Blue';
      const set = (sel, txt) => { const el = inspector.querySelector(sel); if (el) el.textContent = txt; };
      set('#insp-team', teamName);
      set('#insp-id', `soldier #${id}`);
      set('#insp-dead', st.alive[id] ? '' : '(dead)');
      set('#insp-hp-text', `${fmt(st.hp[id],1)} / ${fmt(cfg.hp,0)}`);
      set('#insp-sta-text', `${fmt(st.stamina[id],1)} / ${fmt(cfg.stamina,0)}`);
      set('#insp-speed', `${fmt(speed,1)} (max ${fmt(cfg.speed,0)})`);
      set('#insp-target', target >= 0 ? `#${target} · ${fmt(st.targetCommit[id],1)}s commit` : 'none');
      set('#insp-action', `${action ? action.name : 'None'} · ${phaseName(st.actionPhase[id])} ${fmt(st.actionTimer[id],2)}s`);
      set('#insp-reaction', `${fmt(st.reactionTimer[id],2)}s / ${fmt(cfg.reactionInterval,2)}s`);
      // Detailed stats
      set('#insp-pos', `${fmt(st.x[id],1)}, ${fmt(st.y[id],1)}`);
      set('#insp-vel', `${fmt(st.vx[id],1)}, ${fmt(st.vy[id],1)}`);
      set('#insp-facing', `${fmt(st.facing[id],2)} rad`);
      set('#insp-move', `${fmt(st.moveX[id],2)}, ${fmt(st.moveY[id],2)}`);
      set('#insp-atarget', st.actionTargetId[id] >= 0 ? `#${st.actionTargetId[id]}` : 'none');
      set('#insp-flash', `${fmt(st.hitFlash[id],2)}`);
      const hpBar = inspector.querySelector('#insp-hp-bar');
      const staBar = inspector.querySelector('#insp-sta-bar');
      if (hpBar) hpBar.style.width = `${hpPct * 100}%`;
      if (staBar) staBar.style.width = `${staPct * 100}%`;
    }
  }

  return { state, update };
}
