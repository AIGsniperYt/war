import { Camera } from './render/camera.js';
import { Renderer } from './render/renderer.js';
import { createUI } from './ui/ui.js';
import { WorldState } from './sim/state.js';
import { Simulation } from './sim/sim.js';
import { PHASE_DEPLOYMENT, TEAM_RED } from './sim/constants.js';

const canvas = document.getElementById('battlefield');
const uiRoot = document.getElementById('ui');

const camera = new Camera();
const renderer = new Renderer(canvas, camera);
const world = new WorldState();
const sim = new Simulation(world);

let debug = false;
let selectedId = -1;
const ui = createUI(uiRoot, {
  onStart() {
    if (world.phase === PHASE_DEPLOYMENT) sim.startBattle();
    else if (world.phase === 'ended') sim.startBattle();
  },
  onPause() {
    sim.togglePause();
  },
  onReset() {
    sim.resetToDeployment();
    selectedId = -1;
  },
  onClear() {
    sim.clearAll();
    selectedId = -1;
  },
  onDebug(v) { debug = !!v; },
});

let mouse = { x: 0, y: 0, world: { x: 0, y: 0 }, down: false, button: 0 };
let dragging = false;
let dragLast = null;
let lastTime = performance.now();

function resize() { renderer.resize(); }
window.addEventListener('resize', resize);
resize();
camera.x = 0;
camera.y = 0;
camera.zoom = 1;

function screenPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function updateMouseWorld() {
  mouse.world = camera.screenToWorld(mouse.x, mouse.y);
}

function placeBrush(wx, wy) {
  if (world.phase !== PHASE_DEPLOYMENT) return;
  const n = Math.sqrt(ui.state.brush);
  const spacing = 16;
  const offset = (n - 1) * spacing * 0.5;
  const facing = ui.state.team === TEAM_RED ? 0 : Math.PI;
  for (let gy = 0; gy < n; gy++) {
    for (let gx = 0; gx < n; gx++) {
      const x = wx + gx * spacing - offset;
      const y = wy + gy * spacing - offset;
      world.addSoldier(x, y, ui.state.team, facing, 0);
    }
  }
}

function removeAt(wx, wy) {
  if (world.phase !== PHASE_DEPLOYMENT) return;
  const radius = 18;
  const r2 = radius * radius;
  // remove closest within radius
  let best = -1;
  let bestD2 = r2;
  for (let i = 0; i < world.count; i++) {
    const dx = world.x[i] - wx;
    const dy = world.y[i] - wy;
    const d2 = dx * dx + dy * dy;
    if (d2 <= bestD2) { bestD2 = d2; best = i; }
  }
  if (best >= 0) {
    world.removeAt(best);
    if (selectedId === best) selectedId = -1;
    else if (selectedId === world.count) selectedId = best; // swapped element moved here
  }
}

function pickSoldier(wx, wy) {
  const radius = 16 / camera.zoom + 8;
  let best = -1;
  let bestD2 = radius * radius;
  for (let i = 0; i < world.count; i++) {
    if (!world.alive[i]) continue;
    const dx = world.x[i] - wx;
    const dy = world.y[i] - wy;
    const d2 = dx * dx + dy * dy;
    if (d2 <= bestD2) { bestD2 = d2; best = i; }
  }
  selectedId = best;
}

canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('mousedown', e => {
  const p = screenPos(e);
  mouse.x = p.x; mouse.y = p.y; mouse.down = true; mouse.button = e.button;
  updateMouseWorld();

  if (e.button === 1 || e.button === 2) {
    dragging = true;
    dragLast = { x: p.x, y: p.y };
    canvas.style.cursor = 'grabbing';
    return;
  }

  if (e.button === 0) {
    if (world.phase === PHASE_DEPLOYMENT) {
      if (ui.state.mode === 'place') placeBrush(mouse.world.x, mouse.world.y);
      else removeAt(mouse.world.x, mouse.world.y);
    } else {
      pickSoldier(mouse.world.x, mouse.world.y);
    }
  }
});

window.addEventListener('mousemove', e => {
  const p = screenPos(e);
  mouse.x = p.x; mouse.y = p.y;
  updateMouseWorld();
  if (dragging && dragLast) {
    const dx = p.x - dragLast.x;
    const dy = p.y - dragLast.y;
    camera.pan(dx, dy);
    dragLast = { x: p.x, y: p.y };
  }
});

window.addEventListener('mouseup', e => {
  if (dragging && (e.button === 1 || e.button === 2)) {
    dragging = false;
    dragLast = null;
    canvas.style.cursor = 'crosshair';
  }
  if (e.button === 0) mouse.down = false;
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const p = screenPos(e);
  const factor = Math.pow(1.0015, -e.deltaY);
  camera.zoomAt(p.x, p.y, factor);
}, { passive: false });

// touch support basic
let touchPan = null;
canvas.addEventListener('touchstart', e => {
  if (e.touches.length === 1) {
    const t = e.touches[0];
    const p = screenPos(t);
    mouse.x = p.x; mouse.y = p.y; updateMouseWorld();
    if (world.phase === PHASE_DEPLOYMENT) {
      if (ui.state.mode === 'place') placeBrush(mouse.world.x, mouse.world.y);
      else removeAt(mouse.world.x, mouse.world.y);
    }
  } else if (e.touches.length === 2) {
    touchPan = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 };
  }
}, { passive: true });
canvas.addEventListener('touchmove', e => {
  if (e.touches.length === 2 && touchPan) {
    const nx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const ny = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    camera.pan(nx - touchPan.x, ny - touchPan.y);
    touchPan = { x: nx, y: ny };
  }
}, { passive: true });
canvas.addEventListener('touchend', () => { touchPan = null; });

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  sim.update(dt);

  if (!dragging) {
    canvas.style.cursor = world.phase === PHASE_DEPLOYMENT ? 'crosshair' : 'default';
  }

  renderer.clear();
  renderer.drawGrid();
  renderer.drawSoldiers(world, debug, selectedId);
  renderer.drawBrushPreview(mouse.world, ui.state.brush, ui.state.team, world.phase);
  ui.update(world, sim, selectedId);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
