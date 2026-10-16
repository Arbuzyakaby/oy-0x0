/* =========================================================================
   OY 0X Nova — ночное небо страницы и перо 0Pen.
   Небо рисуется на своём fixed-canvas за всеми главами: фон с Млечным
   путём, четыре слоя звёзд для бесконечного зума (каждый слой растёт от 1×
   до 2× и гаснет, его место занимает следующий), яркие «опорные» звёзды,
   между которыми пером рисуются созвездия, и сама Nova в центре зума.
   ========================================================================= */

const LAYERS = 4;
const PER_LAYER = 150;
const BRIGHT = 96;           // опорные звёзды для созвездий
const SKY_SCREENS = 2.4;     // высота «неба» в экранах: при прокрутке звёзды плывут и повторяются
const PARALLAX = 0.16;
const STORE_KEY = 'nova-sky';
const MAX_LINES = 160;

function rng(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

const smooth = (t) => t * t * (3 - 2 * t);

export function createSky(canvas, { store, reduce = false } = {}) {
  const g = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1;
  let reduced = reduce;

  // Слои зума: точки в [-1, 1]²
  const rnd = rng(11);
  const layers = Array.from({ length: LAYERS }, () => Array.from({ length: PER_LAYER }, () => ({
    x: rnd() * 2 - 1, y: rnd() * 2 - 1, r: 0.4 + rnd() * rnd() * 1.6, a: 0.4 + rnd() * 0.6,
    tw: 0.6 + rnd() * 2.4, ph: rnd() * 6.28, warm: rnd(),
  })));
  // Опорные звёзды: x — доля ширины, y — доля высоты неба
  const r2 = rng(29);
  const bright = Array.from({ length: BRIGHT }, () => ({
    x: 0.03 + r2() * 0.94, y: r2(), r: 1.3 + r2() * 1.5, warm: r2(), ph: r2() * 6.28,
  }));

  // Млечный путь — один раз в offscreen
  const milky = document.createElement('canvas');
  function paintMilky() {
    milky.width = Math.max(1, Math.round(w * dpr * 0.5));
    milky.height = Math.max(1, Math.round(h * dpr * 0.5));
    const m = milky.getContext('2d');
    const mw = milky.width, mh = milky.height;
    const bg = m.createLinearGradient(0, 0, 0, mh);
    bg.addColorStop(0, '#0B0B1E');
    bg.addColorStop(0.55, '#07070F');
    bg.addColorStop(1, '#040408');
    m.fillStyle = bg;
    m.fillRect(0, 0, mw, mh);
    // полоса Млечного пути по диагонали: много мягких пятен
    const rr = rng(5);
    m.save();
    m.translate(mw / 2, mh / 2);
    m.rotate(-0.42);
    for (let i = 0; i < 160; i++) {
      const x = (rr() - 0.5) * mw * 1.6;
      const y = (rr() - 0.5) * mh * 0.22 * (1 + rr());
      const rad = (20 + rr() * 80) * (mw / 900);
      const gr = m.createRadialGradient(x, y, 0, x, y, rad);
      const tone = rr();
      gr.addColorStop(0, tone > 0.7 ? 'rgba(233,201,140,.06)' : tone > 0.35 ? 'rgba(140,120,220,.05)' : 'rgba(200,210,255,.045)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      m.fillStyle = gr;
      m.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    m.restore();
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    paintMilky();
  }
  resize();

  /* ---------- Состояние ---------- */

  const st = {
    scroll: 0,
    zoom: 1,          // во сколько раз приближено (1 — обычное небо)
    zoomOn: 0,        // 0..1: насколько небо в режиме зума (гаснут созвездия, растёт Nova)
    heroNova: 1,      // вспышка на первом экране
    flash: 0,         // 0..1 — анимация вспышки
    dim: 0,           // затемнение (глава «Фонарь»)
    mono: false,
  };

  /* ---------- Созвездия ---------- */

  let lines = [];
  try { lines = JSON.parse(store?.get(STORE_KEY) || '[]').filter((l) => Array.isArray(l) && l.length === 2 && l.every((i) => i >= 0 && i < BRIGHT)); } catch { lines = []; }
  let chain = null;              // последняя звезда незаконченного созвездия
  let hover = null;
  const cursor = { x: -1e4, y: -1e4, on: false };
  const listeners = new Set();
  const save = () => { store?.set(STORE_KEY, JSON.stringify(lines)); listeners.forEach((f) => f(lines.length)); };

  const skyH = () => h * SKY_SCREENS;
  function starPos(s) {
    const H = skyH();
    let y = (s.y * H - st.scroll * PARALLAX) % H;
    if (y < 0) y += H;
    return { x: s.x * w, y: y - (H - h) / 2 };
  }
  function nearest(x, y, radius) {
    if (st.zoomOn > 0.5) return null;
    let best = null, bd = radius * radius;
    bright.forEach((s, i) => {
      const p = starPos(s);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }
  function tap(x, y, radius) {
    const i = nearest(x, y, radius);
    if (i === null) {
      const ended = chain !== null;
      chain = null;
      return ended ? 'end' : 'none';
    }
    if (chain !== null && chain !== i && !lines.some(([a, b]) => (a === chain && b === i) || (a === i && b === chain))) {
      lines.push([chain, i]);
      if (lines.length > MAX_LINES) lines.shift();
      save();
    }
    chain = i;
    return 'star';
  }

  /* ---------- Рисование ---------- */

  function drawStar(x, y, r, alpha, warm) {
    g.globalAlpha = alpha;
    g.fillStyle = st.mono ? '#FFFFFF' : warm > 0.82 ? '#FFDDA8' : warm < 0.14 ? '#BCCBFF' : '#FFFFFF';
    g.beginPath();
    g.arc(x, y, r, 0, 6.2832);
    g.fill();
  }

  function render(time) {
    const t = time / 1000;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalAlpha = 1;
    // фон: Млечный путь плывёт медленнее звёзд
    g.drawImage(milky, 0, 0, w, h);

    const cx = w / 2, cy = h / 2;
    const R = Math.max(w, h) * 0.62;
    const lz = Math.log2(Math.max(1, st.zoom));
    const tw = reduced ? 0 : 1;
    const drift = reduced ? 0 : st.scroll * 0.00004;

    // Слои бесконечного зума
    for (let L = 0; L < LAYERS; L++) {
      const tt = (lz + L / LAYERS) % 1;
      const scale = 2 ** tt;
      const fade = Math.sin(Math.PI * tt);
      for (const s of layers[L]) {
        const x = cx + (s.x + drift) * scale * R;
        const y = cy + s.y * scale * R;
        if (x < -4 || y < -4 || x > w + 4 || y > h + 4) continue;
        const a = s.a * fade * (0.72 + 0.28 * Math.sin(t * s.tw + s.ph) * tw);
        drawStar(x, y, s.r * (0.6 + scale * 0.5), a, s.warm);
      }
    }

    // Опорные звёзды и созвездия гаснут, пока идёт зум
    const ba = 1 - st.zoomOn;
    if (ba > 0.01) {
      const pos = bright.map(starPos);
      // линии
      g.lineCap = 'round';
      g.strokeStyle = st.mono ? 'rgba(255,255,255,.7)' : 'rgba(233,201,140,.75)';
      g.lineWidth = 1.4;
      g.shadowColor = 'rgba(233,201,140,.6)';
      g.shadowBlur = 8;
      g.globalAlpha = ba;
      g.beginPath();
      for (const [a, b] of lines) {
        const p = pos[a], q = pos[b];
        if (Math.abs(p.y - q.y) > h) continue;   // одна из звёзд «перескочила» через край неба
        g.moveTo(p.x, p.y);
        g.lineTo(q.x, q.y);
      }
      g.stroke();
      // резинка от последней звезды к перу
      if (chain !== null && cursor.on) {
        const p = pos[chain];
        g.setLineDash([4, 6]);
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(cursor.x, cursor.y);
        g.stroke();
        g.setLineDash([]);
      }
      g.shadowBlur = 0;
      // звёзды
      bright.forEach((s, i) => {
        const p = pos[i];
        if (p.y < -10 || p.y > h + 10) return;
        const lit = chain === i || lines.some(([a, b]) => a === i || b === i);
        const a = ba * (0.8 + 0.2 * Math.sin(t * 1.3 + s.ph) * tw);
        if (lit) {
          const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, s.r * 6);
          gr.addColorStop(0, 'rgba(255,231,176,.55)');
          gr.addColorStop(1, 'rgba(255,231,176,0)');
          g.globalAlpha = a;
          g.fillStyle = gr;
          g.fillRect(p.x - s.r * 6, p.y - s.r * 6, s.r * 12, s.r * 12);
        }
        drawStar(p.x, p.y, s.r * (lit ? 1.3 : 1), a, s.warm);
      });
      if (hover !== null) {
        const p = pos[hover];
        g.globalAlpha = ba;
        g.strokeStyle = 'rgba(233,201,140,.9)';
        g.lineWidth = 1.2;
        g.beginPath();
        g.arc(p.x, p.y, 11, 0, 6.2832);
        g.stroke();
      }
    }

    // Nova: на первом экране — справа сверху, в зуме — в центре и растёт
    const heroA = st.heroNova * (1 - st.zoomOn);
    if (heroA > 0.01) nova(w * 0.74, h * 0.28, 1 + st.flash * 2.2, heroA, t);
    if (st.zoomOn > 0.01) nova(cx, cy, Math.sqrt(st.zoom) * 0.9, st.zoomOn, t);

    if (st.dim > 0.01) {
      g.globalAlpha = st.dim;
      g.fillStyle = '#000';
      g.fillRect(0, 0, w, h);
    }
    g.globalAlpha = 1;
  }

  function nova(x, y, k, alpha, t) {
    const r = 5 * k;
    const pulse = reduced ? 1 : 1 + Math.sin(t * 2.2) * 0.06;
    const gr = g.createRadialGradient(x, y, 0, x, y, r * 9 * pulse);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.08, st.mono ? 'rgba(240,240,240,.9)' : 'rgba(255,236,190,.9)');
    gr.addColorStop(0.3, st.mono ? 'rgba(160,160,160,.22)' : 'rgba(233,170,110,.22)');
    gr.addColorStop(0.6, st.mono ? 'rgba(90,90,90,.08)' : 'rgba(140,100,220,.1)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = alpha;
    g.fillStyle = gr;
    g.fillRect(x - r * 9, y - r * 9, r * 18, r * 18);
    // лучи
    g.strokeStyle = st.mono ? 'rgba(255,255,255,.55)' : 'rgba(255,240,210,.6)';
    g.lineWidth = 1.2;
    g.beginPath();
    const L = r * 7 * pulse;
    g.moveTo(x - L, y); g.lineTo(x + L, y);
    g.moveTo(x, y - L); g.lineTo(x, y + L);
    g.stroke();
  }

  /* ---------- Снимок нарисованного (для «Затвора») ---------- */

  function snapshot(W = 480, H = 320) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const m = c.getContext('2d');
    const bg = m.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0C0C20');
    bg.addColorStop(1, '#040408');
    m.fillStyle = bg;
    m.fillRect(0, 0, W, H);
    // кадр — рамка вокруг нарисованного (или середина неба, если ничего нет)
    const used = new Set(lines.flat());
    const SH = SKY_SCREENS;
    let pts = [...used].map((i) => ({ x: bright[i].x, y: bright[i].y * SH }));
    if (!pts.length) pts = [{ x: 0.3, y: SH * 0.4 }, { x: 0.7, y: SH * 0.6 }];
    let x0 = Math.min(...pts.map((p) => p.x)), x1 = Math.max(...pts.map((p) => p.x));
    let y0 = Math.min(...pts.map((p) => p.y)), y1 = Math.max(...pts.map((p) => p.y));
    const pad = 0.08;
    x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
    const sc = Math.min(W / (x1 - x0), H / (y1 - y0));
    const ox = (W - (x1 - x0) * sc) / 2, oy = (H - (y1 - y0) * sc) / 2;
    const map = (s) => ({ x: ox + (s.x - x0) * sc, y: oy + (s.y * SH - y0) * sc });
    const fr = rng(3);
    for (let i = 0; i < 160; i++) {
      m.globalAlpha = 0.2 + fr() * 0.5;
      m.fillStyle = '#fff';
      m.fillRect(fr() * W, fr() * H, 1.2, 1.2);
    }
    m.globalAlpha = 1;
    m.strokeStyle = '#E9C98C';
    m.lineWidth = 2;
    m.lineCap = 'round';
    m.beginPath();
    for (const [a, b] of lines) {
      const p = map(bright[a]), q = map(bright[b]);
      m.moveTo(p.x, p.y);
      m.lineTo(q.x, q.y);
    }
    m.stroke();
    bright.forEach((s) => {
      const p = map(s);
      if (p.x < 0 || p.y < 0 || p.x > W || p.y > H) return;
      m.fillStyle = '#FFF4D8';
      m.beginPath();
      m.arc(p.x, p.y, s.r * 1.4, 0, 6.2832);
      m.fill();
    });
    return c;
  }

  // Подпись кадра: короткий хеш нарисованного — как будто от Citadel
  function signature() {
    let hsh = 2166136261;
    for (const [a, b] of lines) {
      hsh ^= a * 131 + b;
      hsh = Math.imul(hsh, 16777619) >>> 0;
    }
    return hsh.toString(16).toUpperCase().padStart(8, '0');
  }

  return {
    resize,
    render,
    state: st,
    setReduced(v) { reduced = v; },
    pointer(x, y, on = true) {
      cursor.x = x; cursor.y = y; cursor.on = on;
      hover = on ? nearest(x, y, 18) : null;
    },
    tap,
    endChain() { chain = null; },
    clear() { lines = []; chain = null; save(); },
    get count() { return lines.length; },
    onChange(f) { listeners.add(f); f(lines.length); },
    snapshot,
    signature,
    // для e2e: опорные звёзды, видимые сейчас на экране
    starsOnScreen: () => bright.map(starPos).filter((p) => p.x > 40 && p.y > 120 && p.x < w - 40 && p.y < h - 40),
  };
}
