/* =========================================================================
   OY — блоки CPix (Curtain Pixels) для страницы 0X2 Pro.
   Экран делится на «слипшиеся» блоки неправильной формы (1–3 клетки сетки,
   форма зависит только от зерна и размера экрана). Блок — копия элемента,
   обрезанная по форме блока через clip-path: path(). Уход: блоки гаснут
   и уезжают влево под соседей (левые лежат выше), справа налево волной.
   Возврат — та же анимация задом наперёд. grab() — один блок, который
   тянут рукой: в оригинале на его месте вырезается окно.
   ========================================================================= */

function mulberry32(a) {
  return function rnd() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Сетка → блоки из соседних клеток. Возвращает [{ cells:[{x,y,w,h}], cx, cy, minX, maxX, minY, maxY, path }]. */
export function makeClumps(w, h, { seed = 2029, cols } = {}) {
  const c = cols || (w > 760 ? 8 : 4);
  const r = Math.max(4, Math.min(9, Math.round((c * h) / w)));
  const rnd = mulberry32(seed + c * 31 + r);
  const owner = new Array(c * r).fill(-1);
  const order = owner.map((_, i) => i).sort(() => rnd() - 0.5);
  const groups = [];
  for (const start of order) {
    if (owner[start] >= 0) continue;
    const id = groups.length;
    const g = [start];
    owner[start] = id;
    const want = rnd() < 0.3 ? 1 : rnd() < 0.65 ? 2 : 3;
    while (g.length < want) {
      const free = [];
      for (const i of g) {
        const x = i % c, y = (i / c) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= c || ny >= r) continue;
          const j = ny * c + nx;
          if (owner[j] < 0) free.push(j);
        }
      }
      if (!free.length) break;
      const j = free[(rnd() * free.length) | 0];
      owner[j] = id;
      g.push(j);
    }
    groups.push(g);
  }
  const X = (i) => Math.round((i * w) / c);
  const Y = (j) => Math.round((j * h) / r);
  return groups.map((g) => {
    const cells = g.map((i) => {
      const x = i % c, y = (i / c) | 0;
      return { x: X(x), y: Y(y), w: X(x + 1) - X(x), h: Y(y + 1) - Y(y) };
    });
    const minX = Math.min(...cells.map((q) => q.x)), maxX = Math.max(...cells.map((q) => q.x + q.w));
    const minY = Math.min(...cells.map((q) => q.y)), maxY = Math.max(...cells.map((q) => q.y + q.h));
    // клетки чуть внахлёст, чтобы на стыках не было волосяных щелей
    const path = cells.map((q) => `M${q.x - 0.5} ${q.y - 0.5}h${q.w + 1}v${q.h + 1}h${-(q.w + 1)}Z`).join(' ');
    const cx = cells.reduce((s, q) => s + q.x + q.w / 2, 0) / cells.length;
    const cy = cells.reduce((s, q) => s + q.y + q.h / 2, 0) / cells.length;
    return { cells, cx, cy, minX, maxX, minY, maxY, path };
  });
}

/** Копия элемента для блока: без id, недоступна с клавиатуры и для экранных читалок. */
function cloneFor(el, freeze) {
  const c = el.cloneNode(true);
  c.removeAttribute('id');
  c.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  c.setAttribute('aria-hidden', 'true');
  c.inert = true;
  c.setAttribute('data-tile-src', '');
  c.classList.remove('is-current', 'is-under', 'is-holed');
  if (freeze) {
    const cs = getComputedStyle(el);
    c.style.background = cs.background;
    c.style.opacity = cs.opacity;
  }
  return c;
}

export function createCPix({ gsap }) {
  function build(el, { host = null, freeze = false, seed } = {}) {
    const box = host ? { left: 0, top: 0, width: host.clientWidth, height: host.clientHeight } : el.getBoundingClientRect();
    const wrap = document.createElement('div');
    wrap.className = 'cpix-tiles';
    wrap.setAttribute('aria-hidden', 'true');
    if (host) Object.assign(wrap.style, { position: 'absolute', inset: '0', zIndex: '-1' });
    else Object.assign(wrap.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`, right: 'auto', bottom: 'auto' });
    const clumps = makeClumps(box.width, box.height, { seed });
    const tiles = clumps.map((k) => {
      const t = document.createElement('div');
      t.className = 'cpix-tile';
      t.style.clipPath = `path("${k.path}")`;
      // левые блоки лежат выше: правый уезжает влево ПОД соседа
      t.style.zIndex = String(10000 - Math.round(k.cx));
      const copy = cloneFor(el, freeze);
      const dim = document.createElement('div');
      dim.className = 'cpix-tile__dim';
      t.append(copy, dim);
      wrap.append(t);
      return { t, dim, copy, k };
    });
    (host || document.body).append(wrap);
    const st = el.scrollTop;
    if (st) tiles.forEach(({ copy }) => { copy.scrollTop = st; });
    // справа налево: первым уходит самый правый блок
    tiles.sort((a, b) => b.k.cx - a.k.cx || a.k.cy - b.k.cy);
    const n = tiles.length;
    const tl = gsap.timeline({ paused: true });
    tiles.forEach(({ t, dim, k }, i) => {
      const at = (i / n) * 0.5 + (k.cy / box.height) * 0.06;
      tl.to(dim, { opacity: 0.82, duration: 0.2, ease: 'power1.out' }, at);
      tl.to(t, { x: -(k.maxX + 24), duration: 0.6, ease: 'power3.in' }, at + 0.1);
    });
    return { wrap, tl };
  }

  return {
    /** Элемент уходит под пиксели. Копии рисуются сразу — сам элемент можно прятать. */
    leave(el, opts) {
      const { wrap, tl } = build(el, opts);
      return new Promise((resolve) => {
        tl.eventCallback('onComplete', () => { wrap.remove(); resolve(); });
        tl.play(0);
      });
    },
    /** Элемент возвращается из-под пикселей поверх текущего. */
    enter(el, opts) {
      const { wrap, tl } = build(el, opts);
      tl.progress(1);
      return new Promise((resolve) => {
        tl.eventCallback('onReverseComplete', () => { wrap.remove(); resolve(); });
        tl.reverse();
      });
    },
    /** Один блок под пальцем: копия едет за рукой, в оригинале — окно на его месте. */
    grab(el, clump) {
      const box = el.getBoundingClientRect();
      const wrap = document.createElement('div');
      wrap.className = 'drag-tile';
      wrap.setAttribute('aria-hidden', 'true');
      const t = document.createElement('div');
      t.className = 'cpix-tile';
      t.style.clipPath = `path("${clump.path}")`;
      const copy = cloneFor(el);
      const dim = document.createElement('div');
      dim.className = 'cpix-tile__dim';
      t.append(copy, dim);
      wrap.append(t);
      document.body.append(wrap);
      copy.scrollTop = el.scrollTop;
      el.style.clipPath = `path(evenodd, "M0 0H${box.width}V${box.height}H0Z ${clump.path}")`;
      el.classList.add('is-holed');
      gsap.fromTo(dim, { opacity: 0 }, { opacity: 0.55, duration: 0.15 });
      return {
        move(dx) { gsap.set(t, { x: Math.min(0, dx) }); },
        release() {
          return new Promise((resolve) => {
            gsap.to(dim, { opacity: 0, duration: 0.35, delay: 0.2 });
            gsap.to(t, {
              x: 0, duration: 0.55, ease: 'power3.inOut',
              onComplete: () => { wrap.remove(); el.style.clipPath = ''; el.classList.remove('is-holed'); resolve(); },
            });
          });
        },
      };
    },
  };
}
