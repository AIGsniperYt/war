import { TEAM_RED } from '../sim/constants.js';

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

  drawSoldiers(state) {
    const { ctx, camera } = this;
    const w = camera.width, h = camera.height;
    const z = camera.zoom;
    const size = Math.max(3, 5.5 * z);
    ctx.save();
    for (let i = 0; i < state.count; i++) {
      if (!state.alive[i]) continue;
      const wx = state.x[i], wy = state.y[i];
      const sx = (wx - camera.x) * z + w / 2;
      const sy = (wy - camera.y) * z + h / 2;
      if (sx < -20 || sy < -20 || sx > w + 20 || sy > h + 20) continue;
      const f = state.facing[i];
      const cos = Math.cos(f), sin = Math.sin(f);
      const isRed = state.team[i] === TEAM_RED;
      ctx.fillStyle = isRed ? '#ff5f6d' : '#5da9ff';
      ctx.strokeStyle = isRed ? 'rgba(255,95,109,0.35)' : 'rgba(93,169,255,0.35)';
      ctx.lineWidth = Math.max(0.5, 0.8 * z);
      // chevron pointing in facing direction
      // local points: tip forward, two back wings
      const tipX = sx + cos * size;
      const tipY = sy + sin * size;
      const backX = sx - cos * size * 0.7;
      const backY = sy - sin * size * 0.7;
      const px = -sin, py = cos; // perpendicular
      const wing = size * 0.75;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(backX + px * wing, backY + py * wing);
      ctx.lineTo(backX + cos * size * 0.25, backY + sin * size * 0.25);
      ctx.lineTo(backX - px * wing, backY - py * wing);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
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
