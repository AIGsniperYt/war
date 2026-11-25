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

  const state = { team: TEAM_RED, brush: 1, mode: 'place', debug: false };

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
      inspector.innerHTML = '';
    } else {
      const i = selectedId;
      const cfg = simState.configOf(i);
      const action = getAction(cfg, simState.actionId[i]);
      const target = simState.targetId[i];
      const teamName = simState.team[i] === TEAM_RED ? 'Red' : 'Blue';
      const teamColor = simState.team[i] === TEAM_RED ? 'var(--red)' : 'var(--blue)';
      inspector.style.display = 'block';
      inspector.innerHTML = `
        <div class="title">UNIT INSPECTOR</div>
        <div class="stat"><strong style="color:${teamColor}">${teamName}</strong> soldier #${i} ${simState.alive[i] ? '' : '<span style="color:#ff8080">(dead)</span>'}</div>
        <div class="stat">HP: <strong>${fmt(simState.hp[i],1)}</strong> / ${fmt(cfg.hp,0)}</div>
        <div class="stat">Stamina: <strong>${fmt(simState.stamina[i],1)}</strong> / ${fmt(cfg.stamina,0)} (regen ${fmt(cfg.staminaRegen,1)}/s)</div>
        <div class="stat">Pos: ${fmt(simState.x[i],1)}, ${fmt(simState.y[i],1)}</div>
        <div class="stat">Vel: ${fmt(simState.vx[i],1)}, ${fmt(simState.vy[i],1)} | speed ${fmt(Math.hypot(simState.vx[i], simState.vy[i]),1)}</div>
        <div class="stat">Facing: ${fmt(simState.facing[i],2)} rad | desired ${fmt(simState.desiredFacing[i],2)}</div>
        <div class="stat">Move intent: ${fmt(simState.moveX[i],2)}, ${fmt(simState.moveY[i],2)}</div>
        <div class="stat">Target: <strong>${target >= 0 ? '#' + target : 'none'}</strong> | commit ${fmt(simState.targetCommit[i],2)}s</div>
        <div class="stat">Reaction timer: ${fmt(simState.reactionTimer[i],2)}s / ${fmt(cfg.reactionInterval,2)}s</div>
        <div class="stat">Action: <strong>${action ? action.name : 'None'}</strong> | phase ${phaseName(simState.actionPhase[i])} | t ${fmt(simState.actionTimer[i],2)}s</div>
        <div class="stat">Action target: ${simState.actionTargetId[i] >= 0 ? '#' + simState.actionTargetId[i] : 'none'} | didHit ${simState.actionDidHit[i]}</div>
        <div class="stat">Hit flash: ${fmt(simState.hitFlash[i],2)}</div>
        <hr style="border:0;border-top:1px solid rgba(255,255,255,0.08);margin:8px 0;">
        <div class="stat">Config: ${cfg.name}</div>
        <div class="stat">Speed ${fmt(cfg.speed,0)} | Accel ${fmt(cfg.accel,0)} | Turn ${fmt(cfg.turnSpeed,2)}</div>
        <div class="stat">Perception ${fmt(cfg.perceptionRange,0)} | FOV ${fmt(cfg.fov,2)} | Aggro ${fmt(cfg.aggression,2)}</div>
        <div class="stat">Actions: ${cfg.actions.map(a => a.name).join(', ')}</div>
      `;
    }
  }

  return { state, update };
}
