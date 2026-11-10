const active = [];
export const ease = {
  linear: (k) => k,
  inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  out: (k) => 1 - Math.pow(1 - k, 3),
  in: (k) => k * k,
  outBack: (k) => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2),
};
export function tween(dur, fn, e = ease.inOut) {
  return new Promise((res) => active.push({ t: 0, dur, fn, e, res }));
}
export const wait = (s) => tween(s, () => {}, ease.linear);
export function updateTweens(dt) {
  for (let i = active.length - 1; i >= 0; i--) {
    const a = active[i];
    a.t += dt;
    const k = Math.min(1, a.t / a.dur);
    a.fn(a.e(k));
    if (k >= 1) {
      active.splice(active.indexOf(a), 1);
      a.res();
    }
  }
}
export const lerp = (a, b, k) => a + (b - a) * k;
