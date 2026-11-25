export const TAU = Math.PI * 2;

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function lengthSq(x, y) {
  return x * x + y * y;
}

export function length(x, y) {
  return Math.sqrt(x * x + y * y);
}

export function normalize(x, y) {
  const l = Math.sqrt(x * x + y * y);
  if (l <= 1e-8) return { x: 0, y: 0 };
  return { x: x / l, y: y / l };
}

export function dot(ax, ay, bx, by) {
  return ax * bx + ay * by;
}

export function wrapAngle(a) {
  let r = a % TAU;
  if (r > Math.PI) r -= TAU;
  if (r < -Math.PI) r += TAU;
  return r;
}

export function angleDiff(a, b) {
  return wrapAngle(b - a);
}

export function rotateTowards(current, target, maxDelta) {
  const diff = angleDiff(current, target);
  const ad = Math.abs(diff);
  if (ad <= maxDelta) return wrapAngle(target);
  return wrapAngle(current + Math.sign(diff) * maxDelta);
}

export function distSq(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}
