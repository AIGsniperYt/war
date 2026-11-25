import { PHASE_DEPLOYMENT, PHASE_ENDED, PHASE_RUNNING, TEAM_BLUE, TEAM_RED } from '../sim/constants.js';

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
        <button id="reset-btn">Reset</button>
        <button id="clear-btn" class="danger">Clear</button>
      </div>
      <div class="stat" id="stats"></div>
      <div class="help">
        Left click: place/remove. Right/middle drag: pan. Wheel: zoom.<br>
        Deployment only until battle starts. Reset restores last deployment.
      </div>
    </div>
    <div class="top-right" id="phase-indicator"></div>
    <div class="banner" id="banner" style="display:none"></div>
  `;

  const teamRow = root.querySelector('#team-row');
  const brushRow = root.querySelector('#brush-row');
  const modeRow = root.querySelector('#mode-row');
  const startBtn = root.querySelector('#start-btn');
  const resetBtn = root.querySelector('#reset-btn');
  const clearBtn = root.querySelector('#clear-btn');
  const statsEl = root.querySelector('#stats');
  const phaseEl = root.querySelector('#phase-indicator');
  const banner = root.querySelector('#banner');

  const state = { team: TEAM_RED, brush: 1, mode: 'place' };

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
  resetBtn.addEventListener('click', () => callbacks.onReset?.());
  clearBtn.addEventListener('click', () => callbacks.onClear?.());

  function update(simState) {
    const s = simState.stats();
    statsEl.innerHTML = `
      <strong style="color:var(--red)">Red</strong> ${s.redAlive}/${s.redTotal} alive &nbsp;|&nbsp;
      <strong style="color:var(--blue)">Blue</strong> ${s.blueAlive}/${s.blueTotal} alive<br>
      Kills: <span style="color:var(--red)">${s.redKills}</span> - <span style="color:var(--blue)">${s.blueKills}</span>
      &nbsp;|&nbsp; Time: ${s.time.toFixed(1)}s
    `;
    const phaseLabel = s.phase === PHASE_DEPLOYMENT ? 'Deployment' : s.phase === PHASE_RUNNING ? 'Battle Running' : 'Battle Ended';
    phaseEl.innerHTML = `<strong>${phaseLabel}</strong>`;
    startBtn.textContent = s.phase === PHASE_RUNNING ? 'Running...' : (s.phase === PHASE_ENDED ? 'Restart Battle' : 'Start Battle');
    startBtn.disabled = s.phase === PHASE_RUNNING;

    if (s.phase === PHASE_ENDED) {
      let msg = 'Draw';
      if (s.winner === TEAM_RED) msg = 'Red wins';
      if (s.winner === TEAM_BLUE) msg = 'Blue wins';
      banner.style.display = 'block';
      banner.textContent = `${msg} — reset to adjust deployment or restart battle`;
    } else if (s.phase === PHASE_RUNNING) {
      banner.style.display = 'none';
    } else {
      banner.style.display = 'none';
    }
  }

  return { state, update };
}
