/* =========================================================================
   Fyr — «Хроника»: как OY стала Fyr. Обычная прокрутка, сцены глав держит
   GSAP ScrollTrigger со scrub: газета со штампом, карта мира из точек —
   граница по Атлантике делит OY на XNA и OY Europe, а Китай (XZF) уплывает
   к Huawei; облако зажигает 83 дата-центра и выгружает данные, 70 клеток
   из 100 становятся синими, ключ падает в залив, 0X2 Pro выходит на первое
   место. Шапка показывает главу и прогресс. При reduced-motion — сразу
   конечный вид.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { $, $$ } from '../core/ui.js';
import { createSmoothScroll } from '../core/scroll.js';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ });
const SVG = 'http://www.w3.org/2000/svg';

/* ---------- Карта мира из точек ---------- */

// Сетка 72×25: столбец — 5° долготы от −180°, строка — 6° широты от 90° N.
// Строка: [номер, от столбца, до столбца] включительно. Грубо, но узнаваемо.
const LAND = {
  na: [[2, 14, 24], [3, 3, 24], [4, 2, 26], [5, 3, 16], [5, 20, 25], [6, 5, 25], [7, 6, 25], [8, 7, 24], [9, 8, 23], [10, 9, 21], [11, 11, 18], [12, 13, 18], [13, 16, 19]],
  eu: [[3, 38, 41], [4, 31, 32], [4, 36, 42], [5, 35, 43], [6, 34, 44], [7, 34, 44], [8, 34, 43], [9, 35, 42]],
  cn: [[6, 59, 62], [7, 53, 63], [8, 52, 61], [9, 51, 61], [10, 51, 60], [11, 53, 60]],
  rest: [
    // Гренландия
    [1, 26, 32], [2, 25, 33], [3, 26, 32], [4, 27, 30], [5, 28, 30],
    // Южная Америка
    [13, 20, 27], [14, 20, 28], [15, 20, 29], [16, 21, 30], [17, 21, 29], [18, 22, 28], [19, 22, 27], [20, 22, 26], [21, 22, 25], [22, 22, 24], [23, 22, 23],
    // Африка
    [10, 33, 45], [11, 33, 46], [12, 33, 47], [13, 33, 46], [14, 34, 45], [15, 37, 44], [16, 38, 44], [17, 38, 43], [17, 45, 45], [18, 38, 43], [18, 45, 45], [19, 39, 42], [20, 39, 42], [21, 40, 41],
    // Азия без Китая
    [2, 50, 62], [3, 44, 70], [4, 45, 71], [5, 44, 71], [6, 45, 58], [6, 63, 70], [7, 45, 52], [7, 64, 66], [8, 44, 51], [8, 62, 64], [9, 43, 50], [9, 62, 64], [10, 46, 50], [10, 61, 62], [11, 46, 52], [11, 61, 61], [12, 50, 58], [13, 52, 57], [14, 55, 58], [15, 56, 60], [16, 57, 66],
    // Австралия и Новая Зеландия
    [17, 60, 65], [18, 58, 66], [19, 57, 66], [20, 57, 66], [21, 59, 65], [21, 69, 69], [22, 69, 70],
  ],
};

function buildMap(host) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 72 25');
  const groups = {};
  for (const [name, spans] of Object.entries(LAND)) {
    const g = document.createElementNS(SVG, 'g');
    g.dataset.region = name;
    for (const [r, c0, c1] of spans) {
      for (let c = c0; c <= c1; c++) {
        const dot = document.createElementNS(SVG, 'circle');
        dot.setAttribute('cx', c + 0.5);
        dot.setAttribute('cy', r + 0.5);
        dot.setAttribute('r', 0.36);
        g.append(dot);
      }
    }
    svg.append(g);
    groups[name] = g;
  }
  const add = (tag, attrs, text) => {
    const el = document.createElementNS(SVG, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (text) el.textContent = text;
    svg.append(el);
    return el;
  };
  host.append(svg);
  return { svg, groups, add };
}

// Глава II: OY — одна (синие точки на трёх рынках), потом граница по Атлантике
const split = buildMap($('[data-map="split"]'));
const cut = split.add('path', { class: 'm-cut', d: 'M30 0.5 V24.5' });
const naLabel = split.add('text', { class: 'm-label m-label--na', x: 9, y: 16.8 }, 'XNA');
const euLabel = split.add('text', { class: 'm-label m-label--eu', x: 33.5, y: 2.4 }, 'OY Europe');
const cnGone = split.add('text', { class: 'm-label m-label--cn', x: 51, y: 13.6 }, 'XZF');

// Глава III: Китай краснеет и уплывает к Huawei
const xzf = buildMap($('[data-map="xzf"]'));
const hw = xzf.add('text', { class: 'm-label m-label--hw', x: 59, y: 15.4 }, '→ Huawei');
const xzfLabel = xzf.add('text', { class: 'm-label m-label--cn', x: 52, y: 5.4 }, 'XZF');

// circle наследует fill от группы, только если у него нет своего: снимаем общий из CSS
$$('.chr-map__svg g[data-region]:not([data-region="rest"]) circle').forEach((c) => c.style.fill = 'inherit');

const OY = '#7FA4FF';
const RED = '#FF5A4E';
// начальное состояние: OY на трёх рынках
gsap.set([split.groups.na, split.groups.eu, split.groups.cn], { fill: OY });
gsap.set([xzf.groups.na, xzf.groups.eu], { fill: 'rgba(127, 164, 255, .45)' });
gsap.set(xzf.groups.cn, { fill: OY });

/* ---------- Облако, выгрузка, 70 % ---------- */

const dots = $('[data-cloud-dots]');
dots.innerHTML = '<i></i>'.repeat(84);          // 83 дата-центра и пустое место в сетке 12×7
const dotEls = $$('i', dots).slice(0, 83);
const cloudN = $('[data-cloud-n]');
const setCloud = (p) => {
  const n = Math.round(83 * p);
  dotEls.forEach((d, i) => d.classList.toggle('is-on', i < n));
  cloudN.textContent = String(n);
};

const bars = $$('[data-export-bar]');
const exportState = $('[data-export-state]');
const exportBtn = $('[data-export-go]');
const setExport = (p) => {
  bars.forEach((b, i) => gsap.set(b, { scaleX: Math.min(1, Math.max(0, p * 1.6 - i * 0.2)) }));
  exportState.textContent = p >= 1 ? 'готово' : p > 0 ? `${Math.round(p * 100)} %` : 'ожидает';
};
exportBtn.addEventListener('click', () => {
  exportBtn.disabled = true;
  const st = { p: 0 };
  gsap.to(st, {
    p: 1, duration: reduceMQ.matches ? 0 : 2.4, ease: 'power1.inOut',
    onUpdate: () => setExport(st.p),
    onComplete: () => { setExport(1); exportBtn.textContent = 'Выгружено'; $('[data-export-note]').hidden = false; },
  });
});

const grid = $('[data-exodus-grid]');
grid.innerHTML = '<i></i>'.repeat(100);
// семьдесят клеток из ста — вразброс, но одинаково при каждом заходе
const cells = $$('i', grid);
const order = cells.map((_, i) => i).sort((a, b) => ((a * 37) % 100) - ((b * 37) % 100));
const fyrCells = order.slice(0, 70).map((i) => cells[i]);
const num = $('[data-exodus-num]');
const setExodus = (p) => {
  const n = Math.round(70 * p);
  fyrCells.forEach((c, i) => c.classList.toggle('is-fyr', i < n));
  num.textContent = String(n);
};

/* ---------- Шапка: глава и прогресс ---------- */

const navLinks = $$('[data-chr-nav] a');
const chapters = navLinks.map((a) => document.querySelector(a.getAttribute('href')));
const progress = $('[data-progress]');
function onScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
  const line = window.innerHeight * 0.45;
  let on = -1;
  chapters.forEach((c, i) => { if (c.getBoundingClientRect().top <= line) on = i; });
  navLinks.forEach((a, i) => a.classList.toggle('is-on', i === on));
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---------- Появление текста ---------- */

const reveals = $$('[data-reveal]');
const io = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
}), { rootMargin: '0px 0px -10% 0px' });

/* ---------- Хореография ---------- */

const scene = (id) => ({ trigger: `#${id}`, start: 'top 75%', end: 'center 45%', scrub: 0.6 });
const depthEl = $('[data-depth]');

function finalState() {
  reveals.forEach((el) => el.classList.add('is-in'));
  setCloud(1);
  setExodus(1);
  gsap.set(split.groups.na, { fill: '#2F6BFF' });
  gsap.set(split.groups.eu, { fill: '#F4F7FF' });
  gsap.set(split.groups.cn, { fill: 'rgba(255, 90, 78, .35)' });
  gsap.set([xzf.groups.cn, xzfLabel], { x: 5 });
  gsap.set(xzf.groups.cn, { fill: RED });
  gsap.set([xzf.groups.na, xzf.groups.eu], { fill: 'rgba(244, 247, 255, .3)' });
  gsap.set('[data-key]', { opacity: 0 });
  depthEl.textContent = 'на дне';
}

const mm = gsap.matchMedia();
mm.add({ reduce: '(prefers-reduced-motion: reduce)', motion: '(prefers-reduced-motion: no-preference)' }, ({ conditions: { reduce } }) => {
  if (reduce) { smooth.disable(); finalState(); return; }
  smooth.enable();
  reveals.forEach((el) => io.observe(el));

  // I. Газета выезжает, штамп падает сверху
  gsap.timeline({ scrollTrigger: scene('arrest') })
    .fromTo('[data-paper]', { y: 80, rotate: 4, opacity: 0.2 }, { y: 0, rotate: -3, opacity: 1, ease: 'none', duration: 0.6 }, 0)
    .fromTo('[data-paper-stamp]', { scale: 2.6, opacity: 0 }, { scale: 1, opacity: 1, ease: 'power2.in', duration: 0.25 }, 0.65);

  // II. Граница по Атлантике: Америка синеет, Европа белеет, Китай гаснет — XZF ушла раньше
  gsap.timeline({ scrollTrigger: scene('split') })
    .fromTo(cut, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'none' }, 0)
    .to(split.groups.cn, { fill: 'rgba(255, 90, 78, .35)', duration: 0.2 }, 0.05)
    .fromTo(cnGone, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.1)
    .to(split.groups.na, { fill: '#2F6BFF', x: -1.2, duration: 0.5, ease: 'none' }, 0.3)
    .to(split.groups.eu, { fill: '#F4F7FF', x: 1.2, duration: 0.5, ease: 'none' }, 0.3)
    .fromTo([naLabel, euLabel], { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.55);

  // III. Китай краснеет и уходит вправо, к Huawei; остальная OY тускнеет
  gsap.timeline({ scrollTrigger: scene('xzf') })
    .to(xzf.groups.cn, { fill: RED, duration: 0.3, ease: 'none' }, 0)
    .to([xzf.groups.na, xzf.groups.eu], { fill: 'rgba(244, 247, 255, .3)', duration: 0.4, ease: 'none' }, 0)
    .fromTo([xzf.groups.cn, xzfLabel], { x: 0 }, { x: 5, duration: 0.6, ease: 'none' }, 0.3)
    .fromTo(hw, { opacity: 0, x: -3 }, { opacity: 1, x: 0, duration: 0.3 }, 0.6);

  // IV. Облако зажигается, выгрузка идёт вместе с прокруткой, пока не нажали кнопку
  ScrollTrigger.create({ ...scene('cloud'), onUpdate: (st) => { setCloud(st.progress); if (!exportBtn.disabled) setExport(st.progress); } });

  // V. 70 из 100
  ScrollTrigger.create({ ...scene('exodus'), onUpdate: (st) => setExodus(st.progress) });

  // VI. Ключ падает, вода принимает, круги и пузыри, глубиномер, подпись
  const key = $('[data-key]');
  const water = $('.chr-key__water');
  // центр ключа приходит на линию воды. Ключ — <svg>, у него нет offsetTop/offsetHeight:
  // место и размер берём из вычисленных стилей (без transform, который крутит GSAP)
  const keyBox = () => { const cs = getComputedStyle(key); return { top: parseFloat(cs.top) || 0, h: parseFloat(cs.height) || 0 }; };
  const fall = () => { const k = keyBox(); return water.offsetTop - k.top - k.h * 0.5 + 24; };
  const DEPTH = ['над водой', 'падает', 'падает', 'тонет', 'на дне'];
  gsap.timeline({
    scrollTrigger: {
      trigger: '#key', start: 'top top', end: 'bottom bottom', scrub: 0.8, invalidateOnRefresh: true,
      onUpdate: (st) => { depthEl.textContent = DEPTH[Math.min(4, Math.floor(st.progress * 5.2))]; },
    },
  })
    .fromTo(key, { y: -40, rotate: -18, opacity: 1 }, { y: () => fall() * 0.55, rotate: 120, ease: 'none', duration: 0.4 }, 0.05)
    .to(key, { y: () => fall(), rotate: 200, ease: 'power1.in', duration: 0.18 }, 0.45)
    .to(key, { y: () => fall() + keyBox().h * 0.9, opacity: 0, ease: 'none', duration: 0.12 }, 0.63)
    .fromTo('[data-ripples] i', { scale: 0.05, opacity: 0.9 }, { scale: 1.6, opacity: 0, stagger: 0.07, duration: 0.25, ease: 'none' }, 0.62)
    .fromTo('[data-bubbles] i', { y: 60, opacity: 0 }, { y: -10, opacity: 0.9, stagger: 0.03, duration: 0.15, ease: 'none' }, 0.66)
    .to('[data-bubbles] i', { opacity: 0, duration: 0.08 }, 0.86)
    .fromTo('[data-key-cap]', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.15, ease: 'none' }, 0.78);

  // VII. Кубок и 0X2 Pro на первом месте
  gsap.timeline({ scrollTrigger: scene('win') })
    .fromTo('.trophy__cup', { y: -30, opacity: 0, rotate: -8 }, { y: 0, opacity: 1, rotate: 0, ease: 'none', duration: 0.4 }, 0)
    .fromTo('[data-win]', { y: 40, scale: 0.9, opacity: 0.3 }, { y: 0, scale: 1, opacity: 1, ease: 'none', duration: 0.6 }, 0.2);

  return () => { reveals.forEach((el) => io.unobserve(el)); };
});

window.addEventListener('load', () => ScrollTrigger.refresh());
