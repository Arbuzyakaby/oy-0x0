/* =========================================================================
   Fyr H1 — первый телефон Fyr. Кино, как у Apple: телефон на общем холсте
   висит над гигантской типографикой, поза — ключевые кадры по главам
   (js/core/keys.js), фон страницы перетекает от главы к главе.
   Сцены: иней тает на первом экране; облёт корпуса, за телефоном
   проплывают 199 / 8,2 / 96,4 / 7000; цвета едут лентой вбок и
   перекрашивают телефон; камера влетает в экран, и он занимает окно
   (мячик бегает на реальной частоте кадров); разлёт по слоям; камера
   влетает в объектив, диафрагма раскрывается в видоискатель с зумом
   0,6× / 1× / 3×; плёнка Kodak едет лентой; фонарь светит в тёмной главе;
   цена перебирает hex-цифры.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage } from '../core/stage.js';
import { createKeys } from '../core/keys.js';
import { createFyrH1, drawLighthouse, H1_COLORS } from '../models/fyrh1.js';
import { $, $$, clamp01, createToast, syncRadio, initRadioGroup } from '../core/ui.js';
import { createSmoothScroll } from '../core/scroll.js';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const root = document.documentElement;
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const params = new URLSearchParams(location.search);
const toast = createToast($('#toast'), gsap);
const ease = (t) => { const c = clamp01(t); return c * c * (3 - 2 * c); };
const PI = Math.PI;

/* ---------- 3D ---------- */

const canvas = $('#stage');
let stage = null;
try {
  stage = createStage(canvas, createFyrH1, { forceFallback: params.has('fallback') });
} catch (err) {
  console.warn('[Fyr] WebGL недоступен, 3D отключено.', err);
  canvas.style.display = 'none';
}

/* ---------- Главы ---------- */

const CHAPTERS = ['intro', 'promise', 'design', 'colors', 'frost-glass', 'display', 'chip', 'cores', 'camera', 'kodak', 'citadel', 'rubilnik', 'torch', 'camelos', 'specs', 'price'];
const PINNED = { promise: '+=160%', design: '+=340%', colors: '+=400%', display: '+=320%', chip: '+=280%', camera: '+=520%', kodak: '+=300%', citadel: '+=260%' };
const sections = Object.fromEntries(CHAPTERS.map((id) => [id, document.getElementById(id)]));
const railItems = Object.fromEntries($$('[data-rail-item]').map((a) => [a.dataset.railItem, a]));
let current = '';

// фон страницы перетекает к цвету главы
const BG = Object.fromEntries(CHAPTERS.map((id) => [id, sections[id].dataset.bg || '#05070A']));
function detectChapter() {
  const line = window.innerHeight * 0.5;
  let id = CHAPTERS[0];
  for (const c of CHAPTERS) if (sections[c].getBoundingClientRect().top <= line) id = c;
  if (id === current) return;
  railItems[current]?.classList.remove('is-on');
  current = id;
  railItems[current]?.classList.add('is-on');
  if (id !== 'colors') gsap.to(root, { '--page-bg': BG[id], duration: reducedMode ? 0 : 0.9, ease: 'power2.out', overwrite: true });
  updateScreen();
}

/* ---------- Состояние демо ---------- */

const demo = { hz: 1, rub: 0, torch: 'white', film: 'warm', color: 'sea', cam: '' };
const FILMS = {
  warm: { name: 'ТЁПЛАЯ 200', note: 'Тёплая 200 · золотистый, мягкий контраст', css: 'sepia(.22) saturate(1.18) contrast(1.04) brightness(1.04)' },
  portrait: { name: 'ПОРТРЕТ 400', note: 'Портрет 400 · кожа без красноты, мягкие тени', css: 'saturate(.88) contrast(.94) brightness(1.07) hue-rotate(-6deg)' },
  slide: { name: 'СЛАЙД 100', note: 'Слайд 100 · насыщенный, глубокие тени', css: 'saturate(1.5) contrast(1.22) brightness(.97)' },
  bw: { name: 'Ч/Б 400', note: 'Ч/Б 400 · зерно и чёрное серебро', css: 'grayscale(1) contrast(1.28) brightness(1.02)' },
  cine: { name: 'КИНО 500T', note: 'Кино 500T · вечер, сине-оранжевый', css: 'hue-rotate(14deg) saturate(.86) contrast(1.12) brightness(.95)' },
};
const LENS_LABEL = { main: '1× · 24 мм', tele: '3× · 73 мм', wide: '0,6× · 15 мм', front: 'фронтальная · 21 мм' };

/* ---------- Экран телефона ---------- */

let lastScreenKey = '';
function updateScreen(force = false) {
  if (!stage) return;
  let mode = 'lock';
  const extra = { rub: demo.rub };
  if (current === 'display' || current === 'chip') { mode = 'hz'; extra.hz = demo.hz; }
  else if (current === 'camera' || current === 'kodak') { mode = 'camera'; extra.film = FILMS[demo.film].name; extra.lens = LENS_LABEL[demo.cam] || LENS_LABEL.main; }
  else if (current === 'rubilnik') mode = 'kill';
  else if (current === 'torch') { mode = 'torch'; extra.torch = demo.torch === 'off' ? 0 : 1; extra.torchColor = demo.torch === 'red' ? 'red' : 'white'; extra.torchMode = TORCH_NOTES[demo.torch].mode; }
  else if (current === 'camelos' || current === 'colors') mode = 'desk';
  const key = mode + JSON.stringify(extra);
  if (key === lastScreenKey && !force) return;
  lastScreenKey = key;
  stage.setScreen(mode, extra);
}

/* ---------- Позы ---------- */

// x/y — доля половины видимой ширины/высоты; fx/fy/fz — точка модели (единицы сцены: мм × 0,01)
const BASE = { x: 0, y: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: 0, rz: 0, dist: 7, float: 1, vis: 1, spin: 0, explode: 0, citadel: 0, screen: 1 };
// объективы со спины (см. blender/build_fyrh1.py): X модели, высота, вершина обода
const LENS = { main: { fx: 0.196, fy: 0.64, fz: -0.07 } };
function makePoses(mobile) {
  const P = {
    far: { y: 0.05, rx: 0.6, ry: PI - 2.8, rz: -0.35, dist: 38, float: 0 },
    hero: { y: 0.06, rx: 0.1, ry: PI - 0.42, rz: 0.06, dist: 6.6 },
    hidden: { rx: 0.3, ry: PI - 0.9, dist: 18, float: 0, vis: 0 },
    orbit0: { rx: 0.16, ry: PI - 0.42, dist: 6.2, float: 0.3 },
    orbit1: { rx: -0.18, ry: PI + 1.3, rz: -0.08, dist: 5.4, float: 0.3 },
    orbit2: { rx: 0.28, ry: PI + 3.3, rz: 0.1, dist: 6.0, float: 0.3 },
    orbit3: { rx: 0.08, ry: PI + 4.8, rz: -0.04, dist: 5.6, float: 0.3 },
    orbit4: { rx: 0.14, ry: PI + 5.86, dist: 6.4, float: 0.3 },
    colors: { x: 0.4, rx: 0.12, ry: PI + 0.4, rz: 0.05, dist: 6.2, float: 0.4 },
    display0: { rx: 0.08, ry: -0.35, dist: 6.6, float: 0.2 },
    display1: { fy: 0, fz: 0.045, rx: 0, ry: 0, dist: 1.5, float: 0 },
    chip0: { x: 0.34, rx: 0.32, ry: -1.05, rz: 0.04, dist: 8, float: 0 },
    chip1: { x: 0.34, rx: 0.62, ry: -1.18, rz: 0.1, dist: 12, float: 0, explode: 1 },
    chip2: { x: 0.34, rx: 0.5, ry: -1.42, rz: 0.08, dist: 11.4, float: 0, explode: 1, citadel: 1 },
    cam0: { rx: 0.1, ry: PI + 0.35, dist: 6.4, float: 0.1 },
    camIsland: { ...LENS.main, fx: 0.106, fy: 0.54, rx: 0.06, ry: PI + 0.22, dist: 2.4, float: 0 },
    camIn: { ...LENS.main, rx: 0.02, ry: PI + 0.04, dist: 0.32, float: 0 },
    rub: { x: 0.36, y: -0.04, fx: -0.12, fy: 0.2, rx: 0.1, ry: 0.72, dist: 5.4, float: 0.1 },
    torch: { x: -0.5, y: -0.3, fy: 0.3, rx: 0.9, ry: 0.4, rz: -0.12, dist: 7.6, float: 0.1 },
    camelos: { x: 0.38, rx: 0.06, ry: -0.3, dist: 6.4 },
  };
  for (const k in P) P[k] = { ...BASE, ...P[k] };
  if (!mobile) return P;
  // телефон: модель в центре или в верхней части экрана, текст ниже
  for (const k in P) {
    const p = P[k];
    if (k === 'display1' || k === 'camIn' || k === 'camIsland') continue;
    const centered = p.x === 0;
    // на первом экране телефон поднят над заголовком
    if (k === 'hero' || k === 'far') { P[k] = { ...p, y: 0.4, dist: p.dist * 1.8 }; continue; }
    P[k] = { ...p, x: 0, y: centered ? p.y + 0.12 : 0.48, dist: p.dist * (centered ? 1.5 : 1.9) };
  }
  return P;
}

const Keys = createKeys();
const sts = {};
let reducedMode = reduceMQ.matches;
const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ });

/* ---------- Буквы заголовков ---------- */

function splitChars(el) {
  if (el.dataset.split) return $$('.ch', el);
  el.dataset.split = '1';
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  el.innerHTML = text.split(/(\s+)/).map((w) => (/^\s+$/.test(w) ? ' ' : `<span class="w" aria-hidden="true">${[...w].map((c) => `<span class="ch">${c}</span>`).join('')}</span>`)).join('');
  return $$('.ch', el);
}
const charHeads = $$('[data-chars]').map((el) => ({ el, chars: splitChars(el) }));

/* ---------- 0. Иней поверх первого экрана ---------- */

const frostCanvas = $('#frost');
function drawFrost(c, { density = 1, alpha = 1, uniform = false } = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = c.clientWidth || window.innerWidth, h = c.clientHeight || window.innerHeight;
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  // холодная дымка: плотнее по краям (на макро спинки — ровным слоем)
  if (!uniform) {
    const v = g.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.2, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    v.addColorStop(0, `rgba(200,225,255,${0.05 * alpha})`);
    v.addColorStop(1, `rgba(220,235,255,${0.42 * alpha})`);
    g.fillStyle = v;
    g.fillRect(0, 0, w, h);
  }
  // кристаллы: перистые ветки по 60°, от краёв к центру. Штрихи копятся в путях
  // по глубине ветки и рисуются разом: так в десятки раз быстрее, чем по одному
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const DEPTH = 4;
  const paths = Array.from({ length: DEPTH + 1 }, () => new Path2D());
  const branch = (x, y, a, len, depth) => {
    if (depth <= 0 || len < 1.5) return;
    const bend = (rnd() - 0.5) * 0.25;
    const x2 = x + Math.cos(a + bend) * len, y2 = y + Math.sin(a + bend) * len;
    paths[depth].moveTo(x, y);
    paths[depth].lineTo(x2, y2);
    // перья: короткие боковые ветки парами по обе стороны
    const n = 1 + Math.floor(rnd() * 2);
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      const bx = x + (x2 - x) * t, by = y + (y2 - y) * t;
      const l = len * (0.38 + rnd() * 0.2);
      branch(bx, by, a + PI / 3, l, depth - 1);
      branch(bx, by, a - PI / 3, l, depth - 1);
    }
    branch(x2, y2, a + (rnd() - 0.5) * 0.5, len * 0.7, depth - 1);
  };
  const seeds = Math.round((w + h) / 18 * density);
  for (let i = 0; i < seeds; i++) {
    const edge = Math.floor(rnd() * 4);
    const t = rnd();
    // на макро спинки кристаллы растут и по всей площади, а не только от краёв
    const [x, y, a] = uniform && i % 3 === 0 ? [rnd() * w, rnd() * h, rnd() * PI * 2]
      : edge === 0 ? [t * w, -4, PI / 2] : edge === 1 ? [w + 4, t * h, PI] : edge === 2 ? [t * w, h + 4, -PI / 2] : [-4, t * h, 0];
    branch(x, y, a + (rnd() - 0.5) * 1.4, 18 + rnd() * Math.min(w, h) * 0.12, DEPTH);
  }
  g.lineCap = 'round';
  for (let d = 1; d <= DEPTH; d++) {
    // мягкое свечение — широкий бледный проход под каждым слоем
    g.strokeStyle = `rgba(200,225,255,${0.04 * alpha})`;
    g.lineWidth = d * 1.4 + 1.5;
    g.stroke(paths[d]);
    g.strokeStyle = `rgba(236,245,255,${(0.05 + d * 0.05) * alpha})`;
    g.lineWidth = Math.max(0.35, d * 0.32);
    g.stroke(paths[d]);
  }
  // иней-крупа
  for (let i = 0; i < (w * h) / 900 * density; i++) {
    g.fillStyle = `rgba(240,248,255,${rnd() * 0.32 * alpha})`;
    g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 1.4, 1 + rnd() * 1.4);
  }
}
// иней тает от двух причин: прилёт телефона в начале и прокрутка — берём большее
const melt = { intro: 0, scroll: 0 };
function applyMelt() { setMelt(Math.max(melt.intro, melt.scroll)); }
function setMelt(m) {
  frostCanvas.style.setProperty('--melt', m.toFixed(3));
  frostCanvas.style.opacity = (1 - ease((m - 0.55) / 0.45)).toFixed(3);
  frostCanvas.style.visibility = m >= 0.999 ? 'hidden' : 'visible';
}

/* ---------- 0. Гигантское H1 уходит назад ---------- */

const megaHero = $('[data-mega-hero]');
function setIntro(p) {
  megaHero.style.transform = `scale(${(1 + p * 0.7).toFixed(3)}) translateY(${(-p * 12).toFixed(2)}vh)`;
  megaHero.style.opacity = (1 - ease(p / 0.8)).toFixed(3);
  megaHero.style.filter = `blur(${(p * 14).toFixed(1)}px)`;
}

/* ---------- 1. Обещание: слова по прокрутке ---------- */

const promiseWords = (() => {
  const el = $('[data-scrub-words]');
  const words = el.innerHTML.split(/\s+/);
  el.innerHTML = words.map((w) => `<span class="h1-word">${w}</span>`).join(' ');
  return $$('.h1-word', el);
})();
const quoteOld = $('.h1-quote__old');
const phonesOut = $('[data-phones]');
function setPromise(p) {
  quoteOld.style.setProperty('--cross', ease((p - 0.04) / 0.22).toFixed(3));
  promiseWords.forEach((w, i) => w.style.setProperty('--o', ease((p - 0.24 - i * 0.05) / 0.12).toFixed(3)));
  phonesOut.textContent = p > 0.74 ? '0x1' : '0x0';
  phonesOut.classList.toggle('is-new', p > 0.74);
}

/* ---------- 2. Корпус: цифры на весь экран за телефоном ---------- */

const stats = $$('[data-stats] .h1-stat');
const orbitOut = $('[data-orbit-readout]');
function setDesign(p) {
  const n = stats.length;
  stats.forEach((el, i) => {
    const t = clamp01((p - i / n) / (1 / n));
    // вплывает справа, на середине стоит, уплывает влево
    const x = (0.5 - t) * 110;
    const o = 1 - Math.abs(t - 0.5) * 2;
    el.style.transform = `translateX(${x.toFixed(2)}vw) scale(${(0.9 + o * 0.1).toFixed(3)})`;
    el.style.opacity = (ease(o * 1.6)).toFixed(3);
  });
  orbitOut.textContent = `${Math.round(clamp01(p) * 360)}°`;
}

/* ---------- 3. Цвета: лента панелей ---------- */

const colorsTrack = $('[data-colors-track]');
const colorPanels = $$('[data-color-panel]');
const colorGrp = $('[data-colors]');
function applyColor(v, { fromScroll = false } = {}) {
  if (v === demo.color && fromScroll) return;
  demo.color = v;
  syncRadio(colorGrp, v);
  root.dataset.color = v;
  stage?.setBodyColor(v);
  ice.draw();
}
function setColors(p) {
  const span = colorsTrack.scrollWidth - window.innerWidth;
  colorsTrack.style.transform = `translateX(${(-p * span).toFixed(1)}px)`;
  const i = Math.round(p * (colorPanels.length - 1));
  applyColor(colorPanels[i].dataset.colorPanel, { fromScroll: true });
  // фон страницы — тёмный тон текущей панели, чтобы стыки глав не мелькали
  root.style.setProperty('--page-bg', getComputedStyle(colorPanels[i]).getPropertyValue('--c1').trim() || '#05070A');
}
initRadioGroup(colorGrp, (v) => {
  // клик по образцу прокручивает ленту к нужной панели
  const st = sts.colors;
  const i = colorPanels.findIndex((el) => el.dataset.colorPanel === v);
  if (st && smooth.lenis && !reducedMode) smooth.lenis.scrollTo(st.start + (st.end - st.start) * (i / (colorPanels.length - 1)), { duration: 1.2 });
  else applyColor(v);
});

/* ---------- 5. Экран на всё окно ---------- */

const take = $('[data-take]');
const displayCap = $('[data-display-cap]');
const hzOut = $('[data-hz]');
const hzBar = $('[data-hz-bar]');
const hzNote = $('[data-hz-note]');
const HZ_NOTES = [[1, '1 Гц: заставка. Экран почти спит.'], [24, 'Кино: ровно столько кадров, сколько снято.'], [60, '60 Гц: обычный телефон.'], [120, '120 Гц: прокрутка без шлейфа.'], [165, '165 Гц: игры. Больше, чем видит глаз.']];
function setDisplay(p) {
  const t = ease((p - 0.26) / 0.12);
  take.style.opacity = t.toFixed(3);
  take.style.visibility = t > 0.01 ? 'visible' : 'hidden';
  take.style.transform = `scale(${(1.08 - t * 0.08).toFixed(3)})`;
  displayCap.style.opacity = (1 - ease((p - 0.12) / 0.14)).toFixed(3);
  const hz = Math.max(1, Math.round(1 + ease((p - 0.4) / 0.5) * 164));
  if (hz === demo.hz) return;
  demo.hz = hz;
  hzOut.textContent = String(hz);
  hzBar.style.transform = `scaleX(${(hz / 165).toFixed(3)})`;
  let note = HZ_NOTES[0][1];
  for (const [h, n] of HZ_NOTES) if (hz >= h) note = n;
  hzNote.textContent = note;
  if (current === 'display') updateScreen();
}
// мячик рисуется ровно с частотой экрана: на 1 Гц он прыгает, на 165 — летит
const ball = (() => {
  const c = $('[data-hz-ball]');
  const st = { raf: 0, last: 0, x: 0 };
  function loop(now) {
    if (current !== 'display' || reducedMode) { st.raf = 0; return; }
    st.raf = requestAnimationFrame(loop);
    if (now - st.last < 1000 / demo.hz) return;
    st.last = now;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const period = 1600;
    const u = (now % period) / period;
    const x = 40 + (w - 80) * (0.5 - 0.5 * Math.cos(u * PI * 2));
    g.fillStyle = 'rgba(127,164,255,.12)';
    g.fillRect(40, h / 2 - 1, w - 80, 2);
    g.beginPath();
    g.arc(x, h / 2, 22, 0, PI * 2);
    g.fillStyle = '#F4F7FF';
    g.shadowColor = 'rgba(127,164,255,.9)';
    g.shadowBlur = 24;
    g.fill();
    g.shadowBlur = 0;
  }
  return { start() { if (!st.raf) st.raf = requestAnimationFrame(loop); } };
})();

/* ---------- 6. Разлёт ---------- */

const layerItems = $$('[data-layers] li');
const megaChip = $('[data-mega-chip]');
function setChip(p) {
  layerItems.forEach((li) => li.classList.toggle('is-on', p >= Number(li.dataset.layerAt)));
  megaChip.style.transform = `translateX(${((0.5 - p) * 30).toFixed(2)}vw)`;
  megaChip.style.opacity = (0.4 + ease(p / 0.3) * 0.6).toFixed(3);
}

/* ---------- 8. Камеры: диафрагма и видоискатель ---------- */

const vf = $('[data-vf]');
const vfScene = $('[data-vf-scene]');
const vfEv = $('[data-vf-ev]');
const vfZoom = Object.fromEntries($$('[data-vf-zoom] [data-z]').map((s) => [s.dataset.z, s]));
const camCap = $('[data-cam-cap]');
const megaCam = $('[data-mega-cam]');
const camCards = Object.fromEntries($$('[data-cam]').map((c) => [c.dataset.cam, c]));
// зум кадра: сверхширокая — весь пейзаж, основная — ближе, телевик — маяк крупно
const CAM_VIEW = {
  main: { s: 1.55, flip: 1, ev: 'ISO 100 · 1/250 · f/1.8' },
  tele: { s: 3.4, flip: 1, ev: 'ISO 200 · 1/500 · f/2.8' },
  wide: { s: 1.0, flip: 1, ev: 'ISO 100 · 1/200 · f/2.0' },
  front: { s: 1.25, flip: -1, ev: 'ISO 160 · 1/120 · f/2.2' },
};
let vfVisible = false;
function setCamera(p) {
  const iris = ease((p - 0.24) / 0.12);
  vf.style.setProperty('--iris', `${(iris * 150).toFixed(2)}%`);
  vf.style.visibility = iris > 0.001 ? 'visible' : 'hidden';
  const wasVisible = vfVisible;
  vfVisible = iris > 0.001;
  if (vfVisible && !wasVisible) renderScene.start();
  camCap.style.opacity = (1 - ease((p - 0.16) / 0.1)).toFixed(3);
  megaCam.style.opacity = (0.8 - ease((p - 0.1) / 0.14) * 0.8).toFixed(3);
  megaCam.style.transform = `scale(${(1 + p * 0.8).toFixed(3)})`;
  const cam = p < 0.4 ? '' : p < 0.55 ? 'main' : p < 0.7 ? 'tele' : p < 0.84 ? 'wide' : 'front';
  if (cam === demo.cam) return;
  demo.cam = cam;
  for (const [id, el] of Object.entries(camCards)) el.classList.toggle('is-on', id === cam);
  const view = CAM_VIEW[cam || 'main'];
  for (const [id, el] of Object.entries(vfZoom)) el.classList.toggle('is-on', id === (cam || 'main'));
  vfEv.textContent = view.ev;
  gsap.to(vfScene, { scaleX: view.s * view.flip, scaleY: view.s, duration: reducedMode ? 0 : 0.9, ease: 'power3.inOut', overwrite: true });
  if (current === 'camera') updateScreen();
}
const renderScene = (() => {
  const st = { raf: 0, last: 0 };
  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    vfScene.width = Math.round(vfScene.clientWidth * dpr);
    vfScene.height = Math.round(vfScene.clientHeight * dpr);
  }
  function step(now) {
    if (!vfVisible) { st.raf = 0; return; }
    st.raf = requestAnimationFrame(step);
    if (now - st.last < 50) return;
    st.last = now;
    if (!vfScene.width) size();
    drawLighthouse(vfScene.getContext('2d'), vfScene.width, vfScene.height, { t: reducedMode ? 0 : now / 1000 });
  }
  window.addEventListener('resize', () => { if (vfScene.width) size(); });
  return { start() { if (!st.raf) st.raf = requestAnimationFrame(step); } };
})();

/* ---------- 9. Kodak: лента плёнки ---------- */

const film = (() => {
  const track = $('[data-film-track]');
  const frames = $$('.h1-film__frame', track);
  const now = $('[data-film-now]');
  const flash = $('[data-film-flash]');
  const count = $('[data-film-count]');
  const d = new Date();
  const stamp = `'31 ${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}`;
  $$('[data-film-date]').forEach((el) => { el.textContent = stamp; });
  const st = { ready: false, shots: 0, i: -1 };
  function size() {
    st.ready = true;
    frames.forEach((f, i) => {
      const c = $('canvas', f);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      c.width = Math.round(c.clientWidth * dpr);
      c.height = Math.round(c.clientHeight * dpr);
      drawLighthouse(c.getContext('2d'), c.width, c.height, { t: i * 0.9 });
    });
  }
  function set(p) {
    if (!st.ready) size();
    const fw = frames[0].offsetWidth + 26;
    const vw = window.innerWidth;
    const x0 = vw / 2 - fw / 2 - 26;
    const x = x0 - p * fw * (frames.length - 1);
    track.style.transform = `translateX(${x.toFixed(1)}px)`;
    const i = Math.round(p * (frames.length - 1));
    if (i === st.i) return;
    st.i = i;
    frames.forEach((f, k) => f.classList.toggle('is-on', k === i));
    demo.film = frames[i].dataset.profile;
    now.textContent = FILMS[demo.film].note;
    if (current === 'kodak') updateScreen();
  }
  $('[data-film-shoot]').addEventListener('click', () => {
    st.shots = st.shots >= 36 ? 1 : st.shots + 1;
    count.textContent = `Кадров: ${st.shots} из 36.`;
    if (st.shots === 36) toast('Плёнка кончилась. Шутка: перемотки нет, она бесконечная.');
    if (!reducedMode) {
      gsap.fromTo(flash, { opacity: 0.95 }, { opacity: 0, duration: 0.7, ease: 'power2.out' });
      const f = frames[Math.max(0, st.i)];
      gsap.fromTo(f, { scale: 0.96 }, { scale: 1, duration: 0.6, ease: 'back.out(2)', clearProps: 'scale' });
    }
  });
  window.addEventListener('resize', () => { if (st.ready) size(); });
  return { set, size };
})();

/* ---------- Хореография ---------- */

function buildChoreography({ isMobile, reduce }) {
  reducedMode = reduce;
  stage?.setReduced(reduce);
  if (reduce) smooth.disable(); else smooth.enable();
  Keys.reset();
  const P = makePoses(isMobile);
  const SETTERS = { promise: setPromise, design: setDesign, colors: setColors, display: setDisplay, chip: setChip, camera: setCamera, kodak: film.set, citadel: setCitadel };

  for (const id of CHAPTERS) {
    if (PINNED[id]) {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: sections[id],
          start: 'top top', end: reduce ? 'bottom top' : PINNED[id], pin: !reduce, scrub: reduce ? false : true, anticipatePin: 1,
          onUpdate: (st) => SETTERS[id](st.progress),
        },
      });
      tl.set({}, {}, 1);
      sts[id] = tl.scrollTrigger;
    } else {
      sts[id] = ScrollTrigger.create({ trigger: sections[id], start: 'top top', end: 'bottom top' });
    }
  }
  // иней тает и гигантское H1 уходит назад за первый экран
  ScrollTrigger.create({
    trigger: sections.intro, start: 'top top', end: 'bottom top',
    onUpdate: (st) => {
      melt.scroll = reduce ? 1 : st.progress > 0 ? 0.16 + st.progress * 0.84 : 0;
      applyMelt();
      setIntro(reduce ? 0 : st.progress);
    },
  });
  if (reduce) { for (const id in SETTERS) SETTERS[id](id === 'display' ? 0.95 : id === 'camera' ? 0.5 : 1); melt.scroll = 1; applyMelt(); }

  const K = (id, f, props) => Keys.add(sts[id], f, props);
  // поза держится до трети главы: короткие главы не должны залезать на ключи следующей
  const hold = (id, pose) => { K(id, -0.4, pose); K(id, 0.3, pose); };
  K('intro', -1, P.hero);
  K('intro', 0, P.hero);
  K('intro', 0.6, { ...P.hero, ry: P.hero.ry + 0.5, dist: P.hero.dist + 1.5 });
  hold('promise', { ...P.hidden, ry: PI + 0.6 });
  K('promise', 1, { ...P.hidden, ry: PI + 0.6 });
  K('design', -0.3, P.orbit0);
  K('design', 0, P.orbit0);
  K('design', 0.25, P.orbit1);
  K('design', 0.5, P.orbit2);
  K('design', 0.75, P.orbit3);
  K('design', 1, P.orbit4);
  K('colors', -0.35, P.colors);
  K('colors', 1, { ...P.colors, ry: P.colors.ry + 0.3 });
  hold('frost-glass', P.hidden);
  K('display', -0.35, P.display0);
  K('display', 0, P.display0);
  K('display', 0.3, P.display1);
  K('display', 0.36, { ...P.display1, vis: 0 });
  K('display', 1, { ...P.display1, vis: 0 });
  K('chip', -0.3, { ...P.chip0, vis: 0 });
  K('chip', 0, P.chip0);
  K('chip', 0.45, P.chip1);
  K('chip', 0.62, P.chip2);
  K('chip', 1, P.chip2);
  hold('cores', { ...P.chip2, vis: 0, dist: 14, explode: 0, citadel: 0 });
  K('camera', -0.4, P.cam0);
  K('camera', 0, P.cam0);
  K('camera', 0.16, P.camIsland);
  K('camera', 0.3, P.camIn);
  K('camera', 0.34, { ...P.camIn, vis: 0 });
  K('camera', 1, { ...P.camIn, vis: 0 });
  hold('kodak', P.hidden);
  hold('citadel', P.hidden);
  K('rubilnik', -0.4, { ...P.rub, vis: 0 });
  K('rubilnik', -0.1, P.rub);
  K('rubilnik', 0.3, P.rub);
  hold('torch', P.torch);
  hold('camelos', P.camelos);
  hold('specs', P.hidden);
  K('price', 1, P.hidden);

  if (!reduce) {
    // буквы заголовков вылетают по одной
    for (const { el, chars } of charHeads) {
      if (el.closest('#intro')) continue;
      gsap.fromTo(chars, { yPercent: 110, rotateX: -70, opacity: 0 }, {
        yPercent: 0, rotateX: 0, opacity: 1, duration: 0.9, ease: 'power4.out', stagger: 0.022,
        scrollTrigger: { trigger: el, start: 'top 86%', toggleActions: 'play none none reverse' },
      });
    }
    // остальной текст глав — коротким сдвигом
    $$('.h1s__text > :not([data-chars]), .h1-band .h1-stb > div > *, .h1-tile, .h1-specgrid .h1-tile, .h1-fullspec').forEach((el) => {
      gsap.fromTo(el, { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.85, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none none' } });
    });
    // плитки въезжают каскадом
    $$('.h1-bento, .h1-specgrid').forEach((g) => gsap.fromTo($$('.h1-tile', g), { y: 60, opacity: 0, scale: 0.96 }, {
      y: 0, opacity: 1, scale: 1, duration: 0.9, ease: 'power3.out', stagger: 0.08,
      scrollTrigger: { trigger: g, start: 'top 85%', toggleActions: 'play none none none' },
    }));
  }
  bindOnEnter(reduce);

  ScrollTrigger.refresh();
  return () => Keys.reset();
}
ScrollTrigger.addEventListener('refresh', () => { Keys.compile(window.innerHeight); detectChapter(); });

/* ---------- Сцены, которые запускаются при входе ---------- */

let enterBound = false;
function bindOnEnter(reduce) {
  if (enterBound) return;
  enterBound = true;
  // экран к корпусу: 0 → 96,4 %
  const stbNum = $('[data-stb-num]');
  const stbScr = $('[data-stb-screen]');
  ScrollTrigger.create({
    trigger: '[data-stb]', start: 'top 75%', once: true,
    onEnter: () => {
      const o = { v: 0 };
      gsap.to(o, {
        v: 1, duration: reduce ? 0 : 1.8, ease: 'power3.out',
        onUpdate: () => {
          stbNum.textContent = (o.v * 96.4).toFixed(1).replace('.', ',');
          const m = 38 - o.v * 33.6;
          stbScr.setAttribute('x', (2 + m).toFixed(2));
          stbScr.setAttribute('y', (2 + m * 1.3).toFixed(2));
          stbScr.setAttribute('width', (196 - 2 * m).toFixed(2));
          stbScr.setAttribute('height', (416 - 2 * m * 1.3).toFixed(2));
          stbScr.setAttribute('rx', (16 + o.v * 10).toFixed(2));
        },
      });
    },
  });
  ScrollTrigger.create({ trigger: '[data-cores]', start: 'top 72%', once: true, onEnter: () => runCores(reduce) });
  ScrollTrigger.create({ trigger: '[data-vc]', start: 'top 85%', end: 'bottom top', onToggle: (st) => $('[data-vc]').classList.toggle('is-on', st.isActive) });
  // иней в главе «Замороженное стекло» нарастает, как только глава показалась
  ScrollTrigger.create({ trigger: sections['frost-glass'], start: 'top 70%', end: 'bottom top', onToggle: (st) => { ice.visible = st.isActive; if (st.isActive) ice.start(); } });
  ScrollTrigger.create({ trigger: sections.display, start: 'top top', end: () => sts.display.end, onToggle: (st) => { if (st.isActive) ball.start(); } });
  // цена: hex перебирается при входе
  ScrollTrigger.create({ trigger: '[data-prices]', start: 'top 80%', once: true, onEnter: () => $$('[data-prices] .fy-hex').forEach((b, i) => scramble(b, b.firstChild.textContent.trim(), i * 120)) });
}

/* ---------- 7. Ядра, частота и 1536 точек Adreno ---------- */

const gpuCanvas = $('[data-gpu]');
const GPU = { cols: 48, rows: 32, lit: 0 };
let gpuRaf = 0;
function drawGpu(now = 0) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = gpuCanvas.clientWidth, h = gpuCanvas.clientHeight;
  if (!w) return;
  if (gpuCanvas.width !== Math.round(w * dpr)) { gpuCanvas.width = Math.round(w * dpr); gpuCanvas.height = Math.round(h * dpr); }
  const g = gpuCanvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const cw = w / GPU.cols, ch = h / GPU.rows, r = Math.min(cw, ch) * 0.32;
  const n = GPU.cols * GPU.rows;
  for (let i = 0; i < n; i++) {
    const cx = (i % GPU.cols + 0.5) * cw, cy = (Math.floor(i / GPU.cols) + 0.5) * ch;
    const on = i < GPU.lit;
    const tw = on ? 0.55 + 0.45 * Math.sin(now / 260 + i * 1.37) : 0;
    g.fillStyle = on ? `rgba(${120 + 60 * tw | 0},${170 + 40 * tw | 0},255,${0.45 + 0.55 * tw})` : 'rgba(160,190,255,.12)';
    g.beginPath();
    g.arc(cx, cy, r, 0, PI * 2);
    g.fill();
  }
}
const gpuVisible = () => { const r = gpuCanvas.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight && !document.hidden; };
function runCores(reduce) {
  $('[data-cores]').classList.add('is-on');
  const freq = $('[data-freq]');
  const flops = $('[data-flops]');
  const o = { f: 0 };
  gsap.to(o, {
    f: 1, duration: reduce ? 0 : 2.2, ease: 'power2.out',
    onUpdate: () => {
      freq.textContent = String(Math.round(o.f * 5010));
      flops.textContent = (o.f * 4454.4).toFixed(1).replace('.', ',');
      GPU.lit = Math.round(o.f * GPU.cols * GPU.rows);
      if (reduce) drawGpu();
    },
  });
  if (reduce) return;
  const loop = (now) => {
    if (!gpuVisible()) { gpuRaf = 0; return; }
    drawGpu(now);
    gpuRaf = requestAnimationFrame(loop);
  };
  gpuRaf = requestAnimationFrame(loop);
  ScrollTrigger.create({ trigger: gpuCanvas, start: 'top bottom', end: 'bottom top', onToggle: (st) => { if (st.isActive && !gpuRaf) gpuRaf = requestAnimationFrame(loop); } });
}
drawGpu();
// блик на плитках идёт за курсором
$$('.h1-tile').forEach((t) => t.addEventListener('pointermove', (e) => {
  const r = t.getBoundingClientRect();
  t.style.setProperty('--mx', `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%`);
  t.style.setProperty('--my', `${((e.clientY - r.top) / r.height * 100).toFixed(1)}%`);
}));

/* ---------- 4. Иней: макро спинки на весь экран ---------- */

// Слои: стекло цвета телефона с бликом за курсором → иней (эталон, проявляется от краёв к центру)
// минус «проталины». Проталины — отдельный холст: курсор дышит на стекло, капли стекают вниз,
// а проталины медленно затягиваются обратно
const ice = (() => {
  const section = sections['frost-glass'];
  const el = $('[data-ice]');
  const hint = $('[data-ice-hint]');
  const fresh = document.createElement('canvas');
  const holes = document.createElement('canvas');
  const layer = document.createElement('canvas');
  const st = { visible: false, ready: false, raf: 0, w: 0, h: 0, dpr: 1, grow: 0, growT: 0, mx: 0.7, my: 0.4, touched: false, drops: [] };
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  const mix = (n, k, to = 0) => { const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (to - v) * k)); return `rgb(${c.join(',')})`; };
  function size() {
    st.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    st.w = el.clientWidth; st.h = el.clientHeight;
    if (!st.w) return;
    st.ready = true;
    for (const c of [el, fresh, holes, layer]) { c.width = Math.round(st.w * st.dpr); c.height = Math.round(st.h * st.dpr); }
    const tmp = document.createElement('canvas');
    tmp.style.cssText = `position:absolute;left:-9999px;width:${st.w}px;height:${st.h}px`;
    document.body.append(tmp);
    drawFrost(tmp, { density: 3, alpha: 2.4, uniform: true });
    tmp.remove();
    const fg = fresh.getContext('2d');
    fg.clearRect(0, 0, fresh.width, fresh.height);
    // матовая изморозь ровным слоем и кристаллы поверх
    fg.fillStyle = 'rgba(222,236,255,.46)';
    fg.fillRect(0, 0, fresh.width, fresh.height);
    fg.drawImage(tmp, 0, 0, fresh.width, fresh.height);
    draw();
  }
  function base(g) {
    const c = H1_COLORS[demo.color];
    const w = el.width, h = el.height;
    const bg = g.createLinearGradient(0, 0, w, h);
    if (c.grad) { bg.addColorStop(0, c.grad[2]); bg.addColorStop(0.5, c.grad[1]); bg.addColorStop(1, c.grad[0]); }
    else { bg.addColorStop(0, mix(c.body, 0.18, 255)); bg.addColorStop(0.55, hex(c.body)); bg.addColorStop(1, mix(c.body, 0.55)); }
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    // блик стекла идёт за курсором
    const sx = st.mx * w, sy = st.my * h;
    const sh = g.createRadialGradient(sx, sy, 0, sx, sy, Math.max(w, h) * 0.45);
    sh.addColorStop(0, 'rgba(255,255,255,.28)');
    sh.addColorStop(0.4, 'rgba(255,255,255,.08)');
    sh.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sh;
    g.fillRect(0, 0, w, h);
  }
  function draw() {
    if (!st.ready) return;
    const g = el.getContext('2d');
    base(g);
    const lg = layer.getContext('2d');
    lg.globalCompositeOperation = 'source-over';
    lg.clearRect(0, 0, layer.width, layer.height);
    lg.drawImage(fresh, 0, 0);
    // иней нарастает от краёв к центру
    if (st.grow < 1) {
      const cx = layer.width / 2, cy = layer.height / 2;
      const R = Math.hypot(cx, cy);
      const r = R * (1 - ease(st.grow));
      const m = lg.createRadialGradient(cx, cy, Math.max(0, r - R * 0.05), cx, cy, r + R * 0.22);
      m.addColorStop(0, 'rgba(0,0,0,0)');
      m.addColorStop(1, 'rgba(0,0,0,1)');
      lg.globalCompositeOperation = 'destination-in';
      lg.fillStyle = m;
      lg.fillRect(0, 0, layer.width, layer.height);
    }
    lg.globalCompositeOperation = 'destination-out';
    lg.drawImage(holes, 0, 0);
    g.drawImage(layer, 0, 0);
  }
  function breathe(x, y, strong = 1) {
    if (!st.ready) return;
    const hg = holes.getContext('2d');
    const r = (54 + Math.random() * 14) * st.dpr * strong;
    const px = x * st.dpr, py = y * st.dpr;
    const grd = hg.createRadialGradient(px, py, 0, px, py, r);
    grd.addColorStop(0, 'rgba(0,0,0,.85)');
    grd.addColorStop(0.6, 'rgba(0,0,0,.35)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    hg.fillStyle = grd;
    hg.beginPath();
    hg.arc(px, py, r, 0, PI * 2);
    hg.fill();
    // иногда из проталины стекает капля
    if (Math.random() < 0.08 && st.drops.length < 24) st.drops.push({ x: px + (Math.random() - 0.5) * r, y: py + r * 0.4, v: 0.6 + Math.random() * 1.2, life: 60 + Math.random() * 90 });
    if (!st.touched) { st.touched = true; hint.classList.add('is-hidden'); }
  }
  function step() {
    if (!st.visible) { st.raf = 0; return; }
    st.raf = requestAnimationFrame(step);
    if (st.grow < 1) st.grow = Math.min(1, (performance.now() - st.growT) / 2400);
    const hg = holes.getContext('2d');
    // проталины затягиваются инеем обратно
    hg.globalCompositeOperation = 'destination-out';
    hg.fillStyle = 'rgba(0,0,0,.008)';
    hg.fillRect(0, 0, holes.width, holes.height);
    hg.globalCompositeOperation = 'source-over';
    for (const d of st.drops) {
      d.y += d.v * st.dpr;
      d.v += 0.02;
      d.life--;
      hg.fillStyle = 'rgba(0,0,0,.7)';
      hg.beginPath();
      hg.arc(d.x, d.y, 3.2 * st.dpr, 0, PI * 2);
      hg.fill();
    }
    st.drops = st.drops.filter((d) => d.life > 0);
    draw();
  }
  function start() {
    if (!st.ready) size();
    if (reducedMode) { st.grow = 1; draw(); return; }
    if (st.grow === 0 && !st.growT) st.growT = performance.now();
    if (!st.raf) st.raf = requestAnimationFrame(step);
  }
  const pos = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, r]; };
  section.addEventListener('pointermove', (e) => {
    const [x, y, r] = pos(e);
    st.mx = x / r.width; st.my = y / r.height;
    if (e.pointerType === 'mouse' || e.pressure > 0) breathe(x, y);
    if (reducedMode) draw();
  });
  section.addEventListener('pointerdown', (e) => { const [x, y] = pos(e); breathe(x, y, 1.3); draw(); });
  window.addEventListener('resize', () => { if (st.ready) size(); });
  return Object.assign(st, { size, draw, start });
})();

/* ---------- 10. Сейф Citadel Extreme: собирается кольцо за кольцом ---------- */

const vault = $('[data-vault]');
const vaultTags = $$('[data-tag-at]');
const vaultBolts = [];
{
  const NS = 'http://www.w3.org/2000/svg';
  const bolts = $('[data-vault-bolts]');
  for (let i = 0; i < 12; i++) {
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('width', '14'); r.setAttribute('height', '14'); r.setAttribute('rx', '3');
    bolts.append(r);
    vaultBolts.push({ r, a: (i / 12) * PI * 2 });
  }
}
// засовы: стоят снаружи, на «замке» въезжают внутрь кольца
function placeBolts(lock) {
  const rad = 196 - lock * 40;
  for (const { r, a } of vaultBolts) {
    r.setAttribute('x', (200 + Math.cos(a) * rad - 7).toFixed(2));
    r.setAttribute('y', (200 + Math.sin(a) * rad - 7).toFixed(2));
  }
}
placeBolts(0);
function setCitadel(p) {
  // кольца появляются по одному, сейф растёт, потом засовы защёлкиваются и за ним встаёт «0»
  vault.style.setProperty('--turn', p.toFixed(3));
  vault.style.setProperty('--build', ease(p / 0.3).toFixed(3));
  for (let i = 0; i < 4; i++) vault.style.setProperty(`--b${i}`, ease((p - i * 0.06) / 0.1).toFixed(3));
  vaultTags.forEach((t) => t.classList.toggle('is-on', p >= Number(t.dataset.tagAt)));
  const lock = ease((p - 0.66) / 0.14);
  vault.style.setProperty('--lock', lock.toFixed(3));
  placeBolts(lock);
  vault.style.setProperty('--zero', ease((p - 0.74) / 0.16).toFixed(3));
}
{
  const log = $('[data-vault-log]');
  const TRIES = [
    'попытка 0x1 · ключ производителя → отказ: такого ключа нет',
    'попытка 0x2 · перебор кода → после 0xA ошибок ключи стёрты',
    'попытка 0x3 · вскрытие корпуса → сетка порвана, ключи стёрты',
    'попытка 0x4 · заморозить чип → он и так в замороженном стекле. отказ',
    'итог · 0 из 4. Citadel Extreme на месте, секреты тоже',
  ];
  let busy = false;
  $('[data-vault-try]').addEventListener('click', () => {
    if (busy) return;
    busy = true;
    log.innerHTML = '';
    vault.classList.add('is-alarm');
    TRIES.forEach((t, i) => setTimeout(() => {
      const li = document.createElement('li');
      li.textContent = t;
      log.append(li);
      if (i === TRIES.length - 1) { busy = false; vault.classList.remove('is-alarm'); }
    }, reducedMode ? 0 : 520 * (i + 1)));
  });
}

/* ---------- 11. Рубильник ---------- */

const rubGrp = $('[data-rub]');
const rubItems = $$('[data-rub-list] li');
initRadioGroup(rubGrp, (v) => {
  demo.rub = Number(v);
  syncRadio(rubGrp, v);
  rubGrp.style.setProperty('--pos', String(demo.rub));
  rubItems.forEach((li, i) => setTimeout(() => {
    const off = demo.rub >= Number(li.dataset.at);
    li.classList.toggle('is-off', off);
    li.querySelector('b').textContent = off ? 'обесточено' : 'вкл';
  }, reducedMode ? 0 : i * 80));
  updateScreen();
});

/* ---------- 12. Фонарь ---------- */

const TORCH_NOTES = {
  off: { mode: 'выкл', note: 'Выключен. Глава снова в темноте.' },
  white: { mode: 'свет · 1200 лм', note: '1200 люмен, белый. Светит вперёд по линии телефона.' },
  red: { mode: 'красный · 80 лм', note: 'Красный: читать карту ночью и не ослепнуть.' },
  beacon: { mode: 'маяк · Fl(2) 6s', note: 'Две вспышки каждые 6 секунд — позывной «Маяка». Свой задаётся в настройках.' },
  sos: { mode: 'SOS · · · — — — · · ·', note: 'SOS азбукой Морзе. Включается и тройным нажатием кнопки питания.' },
};
const torchGrp = $('[data-torch]');
const torchNote = $('[data-torch-note]');
const dark = $('[data-dark]');
initRadioGroup(torchGrp, (v) => {
  demo.torch = v;
  syncRadio(torchGrp, v);
  torchNote.textContent = TORCH_NOTES[v].note;
  sections.torch.dataset.torchColor = v === 'red' ? 'red' : 'white';
  stage?.setTorchColor(v === 'red' ? 'red' : 'white');
  updateScreen();
});
// Морзе SOS: точка 1, тире 3, пауза между знаками 1, между буквами 3, после слова 7 (единица 0,2 с)
const SOS = (() => {
  const seq = [];
  const letter = (marks) => { marks.forEach((m, i) => { seq.push([1, m]); if (i < marks.length - 1) seq.push([0, 1]); }); };
  letter([1, 1, 1]); seq.push([0, 3]); letter([3, 3, 3]); seq.push([0, 3]); letter([1, 1, 1]); seq.push([0, 7]);
  return { seq, total: seq.reduce((s, [, d]) => s + d, 0) };
})();
function torchLevel(now) {
  if (demo.torch === 'off') return 0;
  if (demo.torch === 'white' || demo.torch === 'red') return 1;
  if (demo.torch === 'beacon') {
    const t = (now / 1000) % 6;
    return (t < 0.35 || (t > 0.9 && t < 1.25)) ? 1 : 0;
  }
  let u = ((now / 200) % SOS.total);
  for (const [on, d] of SOS.seq) { if (u < d) return on; u -= d; }
  return 0;
}
let darkLevel = 0;
function setDark(level, dt) {
  // луч расходится плавно, а гаснет быстро, как настоящий светодиод
  const k = 1 - Math.exp(-dt * (level > darkLevel ? 9 : 14));
  darkLevel += (level - darkLevel) * k;
  dark.style.setProperty('--r', `${(darkLevel * (demo.torch === 'red' ? 22 : 34)).toFixed(1)}%`);
}

/* ---------- 15. Цена: память, hex и перебор цифр ---------- */

const HEX = '0123456789ABCDEF';
function scramble(b, target, delay = 0) {
  if (reducedMode) { b.firstChild.textContent = target; return; }
  const [num, unit] = target.split(' ');
  const o = { t: 0 };
  gsap.to(o, {
    t: 1, duration: 0.9, delay, ease: 'power2.out',
    onUpdate: () => {
      const fixed = Math.floor(o.t * (num.length - 2));
      const s = '0x' + [...num.slice(2)].map((c, i) => (i < fixed ? c : HEX[(Math.random() * 16) | 0])).join('');
      b.firstChild.textContent = `${s} ${unit}`;
    },
    onComplete: () => { b.firstChild.textContent = target; },
  });
}
function bindHex(b) {
  const hex = b.firstChild.textContent.trim();
  b.setAttribute('aria-label', `${hex} — это ${b.dataset.hex}`);
  let tip = b.querySelector('.fy-hex__tip');
  if (!tip) {
    tip = document.createElement('span');
    tip.className = 'fy-hex__tip';
    tip.setAttribute('aria-hidden', 'true');
    tip.innerHTML = '<span class="fy-hex__tip-head"></span><span class="fy-hex__tip-val"></span><span class="fy-hex__tip-note">base 16 → base 10</span>';
    b.append(tip);
  }
  tip.children[0].textContent = `${hex.split(' ')[0]} → DEC`;
  tip.children[1].textContent = b.dataset.hex;
}
$$('.fy-hex').forEach((b) => {
  bindHex(b);
  b.addEventListener('click', () => {
    const open = !b.classList.contains('is-open');
    $$('.fy-hex').forEach((o) => o.classList.remove('is-open'));
    b.classList.toggle('is-open', open);
  });
});
const memGrp = $('[data-mem]');
initRadioGroup(memGrp, (v) => {
  syncRadio(memGrp, v);
  $$('[data-prices] .fy-hex').forEach((b, i) => {
    const big = v === '24/1024';
    if (!b.dataset.baseHex) { b.dataset.baseHex = b.firstChild.textContent.trim(); b.dataset.baseDec = b.dataset.hex; }
    const hex = big ? b.dataset.altHex : b.dataset.baseHex;
    b.dataset.hex = big ? b.dataset.altDec : b.dataset.baseDec;
    b.firstChild.textContent = hex;
    bindHex(b);
    scramble(b, hex, i * 90);
  });
});
$('[data-calm]').addEventListener('click', () => toast('Мы тоже не торопились. 0X00 ждал этого с 2030 года.'));
$$('.fy-hero__buy a[href="#price"]').forEach((a) => a.addEventListener('click', () => setTimeout(() => toast('Не торопитесь. Сначала дайте инею растаять.'), 300)));

/* ---------- Печать строки статуса ---------- */

const typeEl = $('[data-type]');
const typeText = typeEl.textContent;
function typeIn() {
  if (reducedMode) return;
  typeEl.textContent = '';
  let i = 0;
  const step = () => {
    typeEl.textContent = typeText.slice(0, ++i);
    if (i < typeText.length) setTimeout(step, 16 + Math.random() * 28);
  };
  step();
}

/* ---------- Каждый тик: прокрутка → модель ---------- */

const progressBar = $('[data-progress]');
let lastY = -1;
let lastT = performance.now();
function tick() {
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  const y = window.scrollY;
  if (y !== lastY) {
    lastY = y;
    detectChapter();
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progressBar.style.transform = `scaleX(${(max > 0 ? y / max : 0).toFixed(4)})`;
  }
  const torchOn = current === 'torch' ? torchLevel(now) : 0;
  if (current === 'torch' || darkLevel > 0.001) setDark(reducedMode && current === 'torch' ? 1 : torchOn, dt);
  if (Keys.empty || !stage) return;
  const v = Keys.sample(y, reducedMode);
  v.rub = current === 'rubilnik' || current === 'torch' ? demo.rub : 0;
  v.torch = torchOn;
  // в «Цветах» телефон покачивается, чтобы «Предзакатный» переливался
  if (current === 'colors' && !reducedMode) v.spin = Math.sin(now / 1500) * 0.5;
  v.dark = current === 'intro' ? 0.3 : 0;
  const vis = clamp01(v.vis ?? 1);
  canvas.style.opacity = vis.toFixed(3);
  stage.setActive(vis > 0.02 && !document.hidden);
  stage.setTarget(v);
}
gsap.ticker.add(tick);
if (params.has('debug')) window.__h1 = { stage, Keys, ScrollTrigger, sts, demo };

window.addEventListener('pointermove', (e) => {
  if (!stage || reducedMode || e.pointerType === 'touch') return;
  stage.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
}, { passive: true });
window.addEventListener('resize', () => { stage?.resize(); drawFrost(frostCanvas); drawGpu(); });

/* ---------- Запуск ---------- */

async function boot() {
  const timeout = (ms) => new Promise((r) => setTimeout(r, ms));
  const fonts = document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve();
  await Promise.race([Promise.all([fonts, stage ? stage.ready : null, timeout(300)]), timeout(12000)]);
  stage?.redrawScreen();
  drawFrost(frostCanvas);
  melt.intro = reducedMode ? 1 : 0;
  applyMelt();

  const mm = gsap.matchMedia();
  mm.add({
    isMobile: '(max-width: 760px)', isDesktop: '(min-width: 761px)',
    reduce: '(prefers-reduced-motion: reduce)', motion: '(prefers-reduced-motion: no-preference)',
  }, (ctx) => buildChoreography(ctx.conditions));

  const loader = $('#loader');
  loader.classList.add('is-done');
  loader.setAttribute('aria-hidden', 'true');
  updateScreen(true);
  typeIn();

  // Первый экран: телефон прилетает из глубины, вращаясь; H1 вырастает за ним, буквы падают
  if (!reducedMode && stage && window.scrollY < 10) {
    const P = makePoses(window.matchMedia('(max-width: 760px)').matches);
    stage.setTarget(P.far);
    stage.snap();
    gsap.ticker.remove(tick);
    const o = { t: 0, m: 0 };
    const intro = gsap.to(o, {
      t: 1, m: 0.16, duration: 2.6, ease: 'power3.out', delay: 0.1,
      onUpdate: () => {
        melt.intro = o.m;
        applyMelt();
        // начали листать раньше, чем телефон прилетел, — дальше ведёт прокрутка
        if (window.scrollY > 40) { intro.kill(); gsap.ticker.add(tick); return; }
        const pose = {};
        for (const key in P.hero) pose[key] = P.far[key] + (P.hero[key] - P.far[key]) * o.t;
        stage.setTarget(pose);
      },
      onComplete: () => gsap.ticker.add(tick),
    });
    gsap.from('[data-mega-hero] span', { yPercent: 40, opacity: 0, scale: 1.3, filter: 'blur(30px)', duration: 2, ease: 'power3.out', stagger: 0.15 });
    const hero = charHeads.find(({ el }) => el.closest('#intro'));
    if (hero) gsap.from(hero.chars, { yPercent: 120, rotateX: -80, opacity: 0, duration: 1.1, ease: 'power4.out', stagger: 0.03, delay: 0.6 });
    gsap.from('[data-hero-sub]', { opacity: 0, filter: 'blur(8px)', duration: 1.4, ease: 'power2.out', delay: 1.4 });
    gsap.from('.h1-intro__side > :not([data-hero-sub])', { opacity: 0, y: 20, duration: 0.9, ease: 'power3.out', stagger: 0.1, delay: 1.6 });
  }
  window.addEventListener('load', () => ScrollTrigger.refresh());

  let hashTarget = null;
  try { hashTarget = location.hash.length > 1 ? document.querySelector(location.hash) : null; } catch { /* неверный якорь */ }
  if (hashTarget) {
    requestAnimationFrame(() => {
      if (smooth.lenis) { smooth.lenis.resize(); smooth.lenis.scrollTo(hashTarget, { immediate: true, force: true }); }
      else hashTarget.scrollIntoView();
    });
  }
}
boot();
