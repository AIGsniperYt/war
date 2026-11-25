import { SPATIAL_CELL_SIZE } from './constants.js';

export class SpatialHash {
  constructor(cellSize = SPATIAL_CELL_SIZE) {
    this.cellSize = cellSize;
    this.invCell = 1 / cellSize;
    this.map = new Map();
    this._queryStamp = 1;
    this._stamps = null;
  }

  clear() {
    this.map.clear();
  }

  _key(cx, cy) {
    // numeric hash for integer cell coords
    return ((cx * 73856093) ^ (cy * 19349663)) >>> 0;
  }

  insert(id, x, y) {
    const cx = Math.floor(x * this.invCell);
    const cy = Math.floor(y * this.invCell);
    const k = this._key(cx, cy);
    let arr = this.map.get(k);
    if (!arr) { arr = []; this.map.set(k, arr); }
    arr.push(id);
  }

  rebuild(state) {
    this.clear();
    for (let i = 0; i < state.count; i++) {
      if (!state.alive[i]) continue;
      this.insert(i, state.x[i], state.y[i]);
    }
  }

  queryRadius(x, y, radius, out) {
    out.length = 0;
    const minCx = Math.floor((x - radius) * this.invCell);
    const maxCx = Math.floor((x + radius) * this.invCell);
    const minCy = Math.floor((y - radius) * this.invCell);
    const maxCy = Math.floor((y + radius) * this.invCell);
    const stamp = ++this._queryStamp;
    if (!this._stamps) this._stamps = new Uint32Array(8192);
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const arr = this.map.get(this._key(cx, cy));
        if (!arr) continue;
        for (let j = 0; j < arr.length; j++) {
          const id = arr[j];
          if (id >= this._stamps.length) {
            const ns = new Uint32Array(Math.max(id + 1, this._stamps.length * 2));
            ns.set(this._stamps);
            this._stamps = ns;
          }
          if (this._stamps[id] === stamp) continue;
          this._stamps[id] = stamp;
          out.push(id);
        }
      }
    }
    return out;
  }
}
