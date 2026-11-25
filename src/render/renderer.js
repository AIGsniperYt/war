import {
  TEAM_RED, ACTION_PHASE_WINDUP, ACTION_PHASE_ACTIVE, ACTION_PHASE_RECOVERY,
  ACTION_NONE
} from '../sim/constants.js';
import { getAction } from '../sim/actions.js';

export class Renderer {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = camera;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.camera.resize(w, h, dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  clear() {
    const { ctx } = this;
    const w = this.camera.width;
    const h = this.camera.height;
    ctx.setTransform(this.camera.dpr, 0, 0, this.camera.dpr, 0, 0);
    ctx.fillStyle = '#141821';
    ctx.fillRect(0, 0, w, h);
  }

  drawGrid() {
    const { ctx, camera } = this;
    const w = camera.width, h = camera.height;
    const topLeft = camera.screenToWorld(0, 0);
    const bottomRight = camera.screenToWorld(w, h);
    const grid = 40;
    const startX = Math.floor(topLeft.x / grid) * grid;
    const endX = Math.ceil(bottomRight.x / grid) * grid;
    const startY = Math.floor(topLeft.y / grid) * grid;
    const endY = Math.ceil(bottomRight.y / grid) * grid;

    ctx.save();
    ctx.lineWidth = 1;
    for (let x = startX; x <= endX; x += grid) {
      const sx = (x - camera.x) * camera.zoom + w / 2;
      ctx.strokeStyle = (Math.round(x / grid) % 5 === 0) ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.035)';
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke();
    }
    for (let y = startY; y <= endY; y += grid) {
      const sy = (y - camera.y) * camera.zoom + h / 2;
      ctx.strokeStyle = (Math.round(y / grid) % 5 === 0) ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.035)';
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(w, sy); ctx.stroke();
    }
    ctx.restore();
  }

  drawSoldiers(state, debug = false, selectedId = -1, hoverId = -1, inspect = {}) {
    const { ctx, camera } = this;
    const w = camera.width, h = camera.height;
    const z = camera.zoom;
    const size = Math.max(3, 5.5 * z);
    ctx.save();

    if (debug) this._drawDebugAll(state, w, h, z);
    this._drawInspectOverlays(state, selectedId, inspect, w, h, z);
    this._drawActionArcs(state, w, h, z);

    for (let i = 0; i < state.count; i++) {
      if (!state.alive[i]) continue;
      const wx = state.x[i], wy = state.y[i];
      const sx = (wx - camera.x) * z + w / 2;
      const sy = (wy - camera.y) * z + h / 2;
      if (sx < -20 || sy < -20 || sx > w + 20 || sy > h + 20) continue;
      const f = state.facing[i];
      const cos = Math.cos(f), sin = Math.sin(f);
      const isRed = state.team[i] === TEAM_RED;
      const flash = state.hitFlash[i] || 0;
      ctx.fillStyle = flash > 0 ? `rgba(255,255,255,${0.55 + flash * 0.45})` : (isRed ? '#ff5f6d' : '#5da9ff');
      const tipX = sx + cos * size;
      const tipY = sy + sin * size;
      const backX = sx - cos * size * 0.7;
      const backY = sy - sin * size * 0.7;
      const px = -sin, py = cos;
      const wing = size * 0.75;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(backX + px * wing, backY + py * wing);
      ctx.lineTo(backX + cos * size * 0.25, backY + sin * size * 0.25);
      ctx.lineTo(backX - px * wing, backY - py * wing);
      ctx.closePath();
      ctx.fill();
    }

    this._drawHoverSelection(state, selectedId, hoverId, w, h, z);
    ctx.restore();
  }

  _drawDebugAll(state, w, h, z) {
    const { ctx, camera } = this;
    for (let i = 0; i < state.count; i++) {
      if (!state.alive[i]) continue;
      const sx = (state.x[i] - camera.x) * z + w / 2;
      const sy = (state.y[i] - camera.y) * z + h / 2;
      if (sx < -200 || sy < -200 || sx > w + 200 || sy > h + 200) continue;
      const cfg = state.configOf(i);
      const facing = state.facing[i];
      const range = cfg.perceptionRange * z;
      const halfFov = cfg.fov * 0.5;
      const isRed = state.team[i] === TEAM_RED;
      ctx.strokeStyle = isRed ? 'rgba(255,95,109,0.08)' : 'rgba(93,169,255,0.08)';
      ctx.fillStyle = isRed ? 'rgba(255,95,109,0.03)' : 'rgba(93,169,255,0.03)';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.arc(sx, sy, range, facing - halfFov, facing + halfFov);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      const tid = state.targetId[i];
      if (tid >= 0 && tid < state.count && state.alive[tid]) {
        const tx = (state.x[tid] - camera.x) * z + w / 2;
        const ty = (state.y[tid] - camera.y) * z + h / 2;
        ctx.strokeStyle = isRed ? 'rgba(255,95,109,0.18)' : 'rgba(93,169,255,0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
      }
    }
  }

  _drawInspectOverlays(state, selectedId, inspect, w, h, z) {
    if (selectedId < 0 || selectedId >= state.count) return;
    const { ctx, camera } = this;
    const i = selectedId;
    const sx = (state.x[i] - camera.x) * z + w / 2;
    const sy = (state.y[i] - camera.y) * z + h / 2;
    const isRed = state.team[i] === TEAM_RED;
    const color = isRed ? '255,95,109' : '93,169,255';

    if (inspect.fov) {
      const cfg = state.configOf(i);
      const facing = state.facing[i];
      const range = cfg.perceptionRange * z;
      const halfFov = cfg.fov * 0.5;
      ctx.fillStyle = `rgba(${color},0.06)`;
      ctx.strokeStyle = `rgba(${color},0.22)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.arc(sx, sy, range, facing - halfFov, facing + halfFov);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    if (inspect.move) {
      const mx = state.moveX[i], my = state.moveY[i];
      const mag = Math.sqrt(mx * mx + my * my);
      if (mag > 0.01) {
        const ex = sx + (mx / mag) * 36 * z;
        const ey = sy + (my / mag) * 36 * z;
        this._arrow(ctx, sx, sy, ex, ey, 'rgba(255,255,255,0.55)');
      }
    }

    if (inspect.target) {
      const tid = state.targetId[i];
      if (tid >= 0 && tid < state.count && state.alive[tid]) {
        const tx = (state.x[tid] - camera.x) * z + w / 2;
        const ty = (state.y[tid] - camera.y) * z + h / 2;
        this._arrow(ctx, sx, sy, tx, ty, `rgba(${color},0.75)`);
        ctx.strokeStyle = `rgba(${color},0.9)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(tx, ty, Math.max(7, 7 * z), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (inspect.action) {
      const phase = state.actionPhase[i];
      if (phase === ACTION_PHASE_WINDUP || phase === ACTION_PHASE_ACTIVE || phase === ACTION_PHASE_RECOVERY) {
        const action = getAction(state.configOf(i), state.actionId[i]);
        if (action) {
          const dir = Math.atan2(state.actionDirY[i], state.actionDirX[i]);
          const reach = (action.reach + 6) * z;
          const halfArc = action.arc * 0.5;
          ctx.strokeStyle = `rgba(255,255,255,0.6)`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.arc(sx, sy, reach, dir - halfArc, dir + halfArc);
          ctx.closePath();
          ctx.stroke();
        }
      }
    }
  }

  _arrow(ctx, x1, y1, x2, y2, color) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;
    const ux = dx / len, uy = dy / len;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const ah = Math.min(10, len * 0.25);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - ux * ah - uy * ah * 0.5, y2 - uy * ah + ux * ah * 0.5);
    ctx.lineTo(x2 - ux * ah + uy * ah * 0.5, y2 - uy * ah - ux * ah * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  _drawActionArcs(state, w, h, z) {
    const { ctx, camera } = this;
    for (let i = 0; i < state.count; i++) {
      if (!state.alive[i]) continue;
      const phase = state.actionPhase[i];
      if (phase !== ACTION_PHASE_WINDUP && phase !== ACTION_PHASE_ACTIVE && phase !== ACTION_PHASE_RECOVERY) continue;
      const action = getAction(state.configOf(i), state.actionId[i]);
      if (!action || action.id === ACTION_NONE) continue;
      const sx = (state.x[i] - camera.x) * z + w / 2;
      const sy = (state.y[i] - camera.y) * z + h / 2;
      if (sx < -100 || sy < -100 || sx > w + 100 || sy > h + 100) continue;
      const dir = Math.atan2(state.actionDirY[i], state.actionDirX[i]);
      const reach = (action.reach + 6) * z;
      const halfArc = action.arc * 0.5;
      const isRed = state.team[i] === TEAM_RED;
      let alpha = 0.08;
      if (phase === ACTION_PHASE_WINDUP) alpha = action.defensive ? 0.12 : 0.10;
      if (phase === ACTION_PHASE_ACTIVE) alpha = action.defensive ? 0.18 : 0.22;
      if (phase === ACTION_PHASE_RECOVERY) alpha = 0.05;
      ctx.fillStyle = action.defensive
        ? (isRed ? `rgba(255,180,180,${alpha})` : `rgba(160,210,255,${alpha})`)
        : (isRed ? `rgba(255,95,109,${alpha})` : `rgba(93,169,255,${alpha})`);
      ctx.strokeStyle = action.defensive
        ? (isRed ? `rgba(255,200,200,${alpha + 0.08})` : `rgba(180,220,255,${alpha + 0.08})`)
        : (isRed ? `rgba(255,120,130,${alpha + 0.1})` : `rgba(120,180,255,${alpha + 0.1})`);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.arc(sx, sy, reach, dir - halfArc, dir + halfArc);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  _drawHoverSelection(state, selectedId, hoverId, w, h, z) {
    const { ctx, camera } = this;
    const drawRing = (id, style, lw, r) => {
      if (id < 0 || id >= state.count) return;
      const sx = (state.x[id] - camera.x) * z + w / 2;
      const sy = (state.y[id] - camera.y) * z + h / 2;
      if (sx < -40 || sy < -40 || sx > w + 40 || sy > h + 40) return;
      ctx.strokeStyle = style;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.stroke();
    };
    if (hoverId >= 0 && hoverId !== selectedId) {
      drawRing(hoverId, 'rgba(255,255,255,0.35)', 1, Math.max(8, 8.5 * z));
    }
    if (selectedId >= 0) {
      const alive = state.alive[selectedId];
      drawRing(selectedId, alive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.4)', 2, Math.max(9, 10 * z));
      drawRing(selectedId, alive ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)', 4, Math.max(11, 12 * z));
    }
  }

  drawBrushPreview(mouseWorld, brushSize, team, phase) {
    if (!mouseWorld || phase !== 'deployment') return;
    const { ctx, camera } = this;
    const w = camera.width, h = camera.height;
    const z = camera.zoom;
    const n = Math.sqrt(brushSize);
    const spacing = 16;
    const offset = (n - 1) * spacing * 0.5;
    const isRed = team === TEAM_RED;
    ctx.save();
    ctx.globalAlpha = 0.45;
    for (let gy = 0; gy < n; gy++) {
      for (let gx = 0; gx < n; gx++) {
        const wx = mouseWorld.x + gx * spacing - offset;
        const wy = mouseWorld.y + gy * spacing - offset;
        const sx = (wx - camera.x) * z + w / 2;
        const sy = (wy - camera.y) * z + h / 2;
        ctx.fillStyle = isRed ? '#ff5f6d' : '#5da9ff';
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(2, 4.5 * z), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
