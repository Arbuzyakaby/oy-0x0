/* =========================================================================
   Прощальный салют 0X0: при первом заходе за сессию поверх страницы
   взлетают ракеты в двух цветах 0X0 — «Сигнальный Красный» и «Арктический
   ледник» — и висит подпись «Спасибо, 0X0». Закрывается сам через несколько
   секунд, по клику, Esc или кнопкой. С prefers-reduced-motion — без
   полёта ракет: один неподвижный кадр и подпись.
   ========================================================================= */

const KEY = 'oy-0x0-farewell';
const COLORS = ['#E2505A', '#B3202A', '#FF8A92', '#DCE6EC', '#FFFFFF', '#A9C9DA'];

export function playFarewell({ force = false } = {}) {
  if (!force) {
    try { if (sessionStorage.getItem(KEY)) return null; sessionStorage.setItem(KEY, '1'); } catch { /* без хранилища — просто играем */ }
  }
  if (document.querySelector('.salute')) return null;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const wrap = document.createElement('div');
  wrap.className = 'salute';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-label', 'Прощание с OY 0X0');
  wrap.innerHTML = `
    <canvas class="salute__sky" aria-hidden="true"></canvas>
    <div class="salute__text">
      <svg class="salute__mark" viewBox="0 0 64 24" aria-hidden="true"><circle cx="10" cy="12" r="8.2"/><path d="M28 6.5l8 11M36 6.5l-8 11"/><circle cx="54" cy="12" r="8.2"/></svg>
      <p class="salute__title">Спасибо, 0X0.</p>
      <p class="salute__sub">2027–2031 · первый OY снят с&nbsp;продажи</p>
      <a class="salute__link" href="/0x3e/">Его наследник — 0X3 Essential →</a>
    </div>
    <button type="button" class="salute__close" aria-label="Закрыть салют">Закрыть</button>`;
  document.body.appendChild(wrap);

  const cv = wrap.querySelector('canvas');
  const g = cv.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  const size = () => { W = window.innerWidth; H = window.innerHeight; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size();
  window.addEventListener('resize', size);

  const rockets = [];
  const sparks = [];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = () => COLORS[(Math.random() * COLORS.length) | 0];
  const launch = () => rockets.push({ x: rnd(W * 0.15, W * 0.85), y: H + 10, vx: rnd(-40, 40), vy: rnd(-H * 1.05, -H * 0.8), top: rnd(H * 0.12, H * 0.45), c: pick() });
  const burst = (x, y, c) => {
    const n = 70 + ((Math.random() * 40) | 0);
    const ring = Math.random() < 0.35;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd(-0.05, 0.05);
      const s = ring ? rnd(170, 190) : rnd(40, 230);
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(1.1, 1.9), age: 0, c: Math.random() < 0.8 ? c : '#FFFFFF' });
    }
  };

  let raf = 0;
  let last = performance.now();
  let next = 0;
  const t0 = last;
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - t0) / 1000;
    if (t < 5.2 && now > next) { launch(); if (Math.random() < 0.4) launch(); next = now + rnd(220, 520); }
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = 'rgba(0,0,0,.22)';
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.x += r.vx * dt; r.y += r.vy * dt; r.vy += 420 * dt;
      g.fillStyle = r.c;
      g.beginPath(); g.arc(r.x, r.y, 2.2, 0, Math.PI * 2); g.fill();
      if (r.y <= r.top || r.vy >= 0) { burst(r.x, r.y, r.c); rockets.splice(i, 1); }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.age += dt;
      if (p.age > p.life) { sparks.splice(i, 1); continue; }
      p.vx *= 1 - 1.6 * dt; p.vy = p.vy * (1 - 1.6 * dt) + 90 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      g.globalAlpha = 1 - p.age / p.life;
      g.fillStyle = p.c;
      g.fillRect(p.x - 1.2, p.y - 1.2, 2.4, 2.4);
    }
    g.globalAlpha = 1;
    if (t < 9 || sparks.length) raf = requestAnimationFrame(frame);
  };

  if (reduce) {
    // один неподвижный кадр: три «застывших» вспышки
    g.globalCompositeOperation = 'lighter';
    [[0.25, 0.3], [0.72, 0.24], [0.5, 0.18]].forEach(([fx, fy], k) => {
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2, s = 60 + (i % 3) * 18;
        g.fillStyle = COLORS[(k * 2 + i) % COLORS.length];
        g.globalAlpha = 0.7;
        g.fillRect(fx * W + Math.cos(a) * s, fy * H + Math.sin(a) * s, 2.4, 2.4);
      }
    });
    g.globalAlpha = 1;
  } else {
    raf = requestAnimationFrame(frame);
  }

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    wrap.classList.add('is-out');
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', size);
    setTimeout(() => { cancelAnimationFrame(raf); wrap.remove(); }, 600);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', (e) => { if (!e.target.closest('a')) close(); });
  const timer = setTimeout(close, reduce ? 4500 : 9000);
  wrap.querySelector('.salute__close').addEventListener('click', () => { clearTimeout(timer); close(); });
  requestAnimationFrame(() => wrap.classList.add('is-in'));
  return { close };
}
