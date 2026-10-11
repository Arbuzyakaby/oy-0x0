/* =========================================================================
   OY — ключевые кадры модели
   Ключи привязаны к ScrollTrigger секций: f ≥ 0 — доля пина, f < 0 — экраны
   до начала секции. sample(y) превращает позицию прокрутки в целевое
   состояние детерминированно — при любом прыжке скролла.
   ========================================================================= */

export function createKeys() {
  let defs = [];
  let tracks = {};
  const smooth = (t) => t * t * (3 - 2 * t);
  return {
    reset() { defs = []; tracks = {}; },
    add(st, f, props, linear = false) { defs.push({ st, f, props, linear }); },
    compile(vh) {
      tracks = {};
      for (const d of defs) {
        const s = d.st;
        if (!s) continue;
        const pos = d.f >= 0 ? s.start + d.f * (s.end - s.start) : s.start + d.f * vh;
        for (const k in d.props) (tracks[k] ||= []).push({ pos, v: d.props[k], linear: d.linear });
      }
      for (const k in tracks) tracks[k].sort((a, b) => a.pos - b.pos);
    },
    sample(y, step = false) {
      const out = {};
      for (const k in tracks) {
        const arr = tracks[k];
        const first = arr[0], lastK = arr[arr.length - 1];
        if (y <= first.pos) { out[k] = first.v; continue; }
        if (y >= lastK.pos) { out[k] = lastK.v; continue; }
        let i = 0;
        while (i < arr.length - 2 && arr[i + 1].pos <= y) i++;
        const a = arr[i], b = arr[i + 1];
        const span = b.pos - a.pos;
        const t = span > 0 ? (y - a.pos) / span : 1;
        out[k] = step ? (t < 0.5 ? a.v : b.v) : a.v + (b.v - a.v) * (b.linear ? t : smooth(t));
      }
      return out;
    },
    get empty() { return Object.keys(tracks).length === 0; },
  };
}
