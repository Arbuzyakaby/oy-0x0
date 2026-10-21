/* =========================================================================
   Fyr H1 — первый телефон Fyr. Один телефон на общем холсте, поза — ключевые
   кадры по главам (js/core/keys.js). Пролёты: облёт корпуса на 360°,
   экран разгоняется от 1 до 165 Гц, разлёт по слоям, пролёт камеры по
   объективам. Поверх первого экрана — иней, который тает при прокрутке.
   Демо: иней на стекле, ядра и 1536 точек Adreno, плёнки Kodak, сейф
   Citadel Extreme, «Рубильник», фонарь, пять цветов, цены в hex.
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

const CHAPTERS = ['intro', 'promise', 'body', 'frost-glass', 'display', 'chip', 'cores', 'camera', 'kodak', 'citadel', 'rubilnik', 'torch', 'camelos', 'colors', 'specs', 'price'];
const PINNED = { promise: '+=180%', body: '+=300%', display: '+=220%', chip: '+=300%', camera: '+=440%' };
const sections = Object.fromEntries(CHAPTERS.map((id) => [id, document.getElementById(id)]));
const railItems = Object.fromEntries($$('[data-rail-item]').map((a) => [a.dataset.railItem, a]));
let current = 'intro';

function detectChapter() {
  const line = window.innerHeight * 0.5;
  let id = CHAPTERS[0];
  for (const c of CHAPTERS) if (sections[c].getBoundingClientRect().top <= line) id = c;
  if (id === current) return;
  railItems[current]?.classList.remove('is-on');
  current = id;
  railItems[current]?.classList.add('is-on');
  updateScreen();
}

/* ---------- Состояние демо ---------- */

const demo = { hz: 1, rub: 0, torch: 'off', film: 'warm', color: 'sea', cam: 'island' };
const FILMS = {
  warm: { name: 'ТЁПЛАЯ 200', css: 'sepia(.22) saturate(1.18) contrast(1.04) brightness(1.04)' },
  portrait: { name: 'ПОРТРЕТ 400', css: 'saturate(.88) contrast(.94) brightness(1.07) hue-rotate(-6deg)' },
  slide: { name: 'СЛАЙД 100', css: 'saturate(1.5) contrast(1.22) brightness(.97)' },
  bw: { name: 'Ч/Б 400', css: 'grayscale(1) contrast(1.28) brightness(1.02)' },
  cine: { name: 'КИНО 500T', css: 'hue-rotate(14deg) saturate(.86) contrast(1.12) brightness(.95)' },
};
const LENS_LABEL = { island: '1× · 24 мм', main: '1× · 24 мм', tele: '3× · 73 мм', wide: '0,6× · 15 мм', front: 'фронтальная · 21 мм' };

/* ---------- Экран телефона ---------- */

let lastScreenKey = '';
function updateScreen(force = false) {
  if (!stage) return;
  let mode = 'lock';
  const extra = { rub: demo.rub };
  if (current === 'display' || current === 'chip') { mode = 'hz'; extra.hz = demo.hz; }
  else if (current === 'camera' || current === 'kodak') { mode = 'camera'; extra.film = FILMS[demo.film].name; extra.lens = LENS_LABEL[demo.cam]; }
  else if (current === 'rubilnik') mode = 'kill';
  else if (current === 'torch') { mode = 'torch'; extra.torch = demo.torch === 'off' ? 0 : 1; extra.torchColor = demo.torch === 'red' ? 'red' : 'white'; extra.torchMode = TORCH_NOTES[demo.torch].mode; }
  else if (current === 'camelos' || current === 'colors' || current === 'specs') mode = 'desk';
  const key = mode + JSON.stringify(extra);
  if (key === lastScreenKey && !force) return;
  lastScreenKey = key;
  stage.setScreen(mode, extra);
}

/* ---------- Позы ---------- */

// x/y — доля половины видимой ширины/высоты; fx/fy/fz — точка модели (единицы сцены: мм × 0,01)
const BASE = { x: 0, y: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: 0, rz: 0, dist: 7, float: 1, vis: 1, spin: 0, explode: 0, citadel: 0, screen: 1 };
// объективы со спины (см. blender/build_fyrh1.py): X модели, высота, вершина обода
const LENS = {
  main: { fx: 0.196, fy: 0.64, fz: -0.07 },
  tele: { fx: 0.016, fy: 0.64, fz: -0.07 },
  wide: { fx: 0.196, fy: 0.44, fz: -0.07 },
  front: { fx: 0, fy: 0.762, fz: 0.045 },
};
function makePoses(mobile) {
  const P = {
    far: { x: 0.36, y: 0.05, rx: 0.5, ry: PI - 2.6, rz: -0.3, dist: 34, float: 0 },
    hero: { x: 0.36, y: -0.02, rx: 0.12, ry: PI - 0.5, rz: 0.07, dist: 7.2 },
    hidden: { x: 0.36, rx: 0.3, ry: PI - 0.9, dist: 16, float: 0, vis: 0 },
    orbit0: { x: 0.38, rx: 0.18, ry: PI - 0.5, dist: 6.8, float: 0.3 },
    orbit1: { x: 0.38, rx: -0.12, ry: PI + 1.2, dist: 6.2, float: 0.3 },
    orbit2: { x: 0.38, rx: 0.22, ry: PI + 3.4, dist: 6.6, float: 0.3 },
    orbit3: { x: 0.38, rx: 0.1, ry: PI + 5.78, dist: 6.8, float: 0.3 },
    display0: { x: 0.38, rx: 0.05, ry: -0.18, dist: 6.4, float: 0.2 },
    display1: { x: 0.36, rx: 0.02, ry: 0.06, dist: 5.4, float: 0.1 },
    chip0: { x: 0.36, rx: 0.32, ry: -1.05, rz: 0.04, dist: 7.4, float: 0, explode: 0 },
    chip1: { x: 0.34, rx: 0.62, ry: -1.18, rz: 0.1, dist: 12, float: 0, explode: 1 },
    chip2: { x: 0.34, rx: 0.5, ry: -1.42, rz: 0.08, dist: 11.4, float: 0, explode: 1, citadel: 1 },
    cam0: { x: 0.4, rx: 0.1, ry: PI + 0.35, dist: 6.6, float: 0.1 },
    camIsland: { x: 0.34, ...LENS.main, fx: 0.106, fy: 0.54, rx: 0.08, ry: PI + 0.3, dist: 2.6, float: 0 },
    camMain: { x: 0.36, ...LENS.main, rx: 0.06, ry: PI + 0.22, dist: 1.25, float: 0 },
    camTele: { x: 0.36, ...LENS.tele, rx: 0.06, ry: PI - 0.1, dist: 1.25, float: 0 },
    camWide: { x: 0.36, ...LENS.wide, rx: -0.1, ry: PI + 0.18, dist: 1.25, float: 0 },
    camFront: { x: 0.36, ...LENS.front, rx: 0.12, ry: -0.2, dist: 2.4, float: 0 },
    rub: { x: 0.36, y: -0.04, fx: -0.12, fy: 0.2, rx: 0.1, ry: 0.72, dist: 5.4, float: 0.1 },
    torch: { x: -0.52, y: -0.28, fy: 0.3, rx: 0.9, ry: 0.4, rz: -0.12, dist: 7.6, float: 0.1 },
    camelos: { x: 0.38, rx: 0.06, ry: -0.3, dist: 6.4 },
    colors: { x: -0.36, rx: 0.12, ry: PI + 0.55, dist: 6.8 },
    specs: { x: 0.56, rx: 0.2, ry: PI - 0.6, rz: 0.05, dist: 8.4 },
  };
  for (const k in P) P[k] = { ...BASE, ...P[k] };
  if (!mobile) return P;
  // телефон: модель в верхней части экрана, текст ниже
  for (const k in P) {
    const p = P[k];
    const close = k.startsWith('cam') && k !== 'cam0';
    P[k] = { ...p, x: 0, y: 0.5, dist: close ? p.dist * 1.6 : p.dist * 1.9 };
  }
  return P;
}

const Keys = createKeys();
const sts = {};
let reducedMode = reduceMQ.matches;
const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ });

/* ---------- 0. Иней поверх первого экрана ---------- */

const frostCanvas = $('#frost');
function drawFrost(c, { density = 1, alpha = 1 } = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = c.clientWidth || window.innerWidth, h = c.clientHeight || window.innerHeight;
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  // холодная дымка: плотнее по краям
  const v = g.createRadialGradient(w * 0.6, h * 0.5, Math.min(w, h) * 0.2, w * 0.6, h * 0.5, Math.max(w, h) * 0.75);
  v.addColorStop(0, `rgba(200,225,255,${0.05 * alpha})`);
  v.addColorStop(1, `rgba(220,235,255,${0.42 * alpha})`);
  g.fillStyle = v;
  g.fillRect(0, 0, w, h);
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
    const [x, y, a] = edge === 0 ? [t * w, -4, PI / 2] : edge === 1 ? [w + 4, t * h, PI] : edge === 2 ? [t * w, h + 4, -PI / 2] : [-4, t * h, 0];
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
  promiseWords.forEach((w, i) => w.style.setProperty('--o', ease((p - 0.26 - i * 0.045) / 0.12).toFixed(3)));
  phonesOut.textContent = p > 0.72 ? '0x1' : '0x0';
  phonesOut.classList.toggle('is-new', p > 0.72);
}

/* ---------- 2. Облёт ---------- */

const callouts = $$('[data-callouts] [data-at]');
const bodySteps = $$('[data-body-steps] li');
const orbitOut = $('[data-orbit-readout]');
function setBody(p) {
  callouts.forEach((c) => c.classList.toggle('is-on', p >= Number(c.dataset.at) && p < Number(c.dataset.at) + 0.34));
  bodySteps.forEach((li, i) => li.classList.toggle('is-on', p >= i * 0.22));
  orbitOut.textContent = `${Math.round(clamp01(p) * 360)}°`;
}

/* ---------- 4. Экран: 1 → 165 Гц ---------- */

const hzOut = $('[data-hz]');
const hzBar = $('[data-hz-bar]');
function setDisplay(p) {
  const hz = Math.round(1 + ease((p - 0.08) / 0.8) * 164);
  if (hz === demo.hz) return;
  demo.hz = hz;
  hzOut.textContent = String(hz);
  hzBar.style.transform = `scaleX(${(hz / 165).toFixed(3)})`;
  if (current === 'display') updateScreen();
}

/* ---------- 5. Разлёт: слои ---------- */

const layerItems = $$('[data-layers] li');
function setChip(p) {
  layerItems.forEach((li) => li.classList.toggle('is-on', p >= Number(li.dataset.layerAt)));
}

/* ---------- 7. Камеры: пролёт по объективам ---------- */

const camCards = Object.fromEntries($$('[data-cam]').map((c) => [c.dataset.cam, c]));
const camExtra = $('.h1-cam--extra');
const lensName = $('[data-lensname]');
const CAM_NAMES = { island: 'Остров камер · 40 × 42 мм', main: 'Основная · 50 Мп · 1/1,56"', tele: 'Телевик 3× · перископ', wide: 'Сверхширокая · 116°', front: 'Фронтальная · 32 Мп' };
function setCamera(p) {
  const cam = p < 0.2 ? 'island' : p < 0.42 ? 'main' : p < 0.6 ? 'tele' : p < 0.78 ? 'wide' : 'front';
  if (cam === demo.cam) return;
  demo.cam = cam;
  for (const [id, el] of Object.entries(camCards)) el.classList.toggle('is-on', id === cam);
  camExtra.classList.toggle('is-on', cam === 'island');
  lensName.textContent = CAM_NAMES[cam];
  if (current === 'camera') updateScreen();
}

/* ---------- Хореография ---------- */

function buildChoreography({ isMobile, reduce }) {
  reducedMode = reduce;
  stage?.setReduced(reduce);
  if (reduce) smooth.disable(); else smooth.enable();
  Keys.reset();
  const P = makePoses(isMobile);

  for (const id of CHAPTERS) {
    if (PINNED[id]) {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: sections[id],
          start: 'top top', end: reduce ? 'bottom top' : PINNED[id], pin: !reduce, scrub: reduce ? false : true, anticipatePin: 1,
          onUpdate: (st) => {
            const p = st.progress;
            if (id === 'promise') setPromise(p);
            else if (id === 'body') setBody(p);
            else if (id === 'display') setDisplay(p);
            else if (id === 'chip') setChip(p);
            else if (id === 'camera') setCamera(p);
          },
        },
      });
      tl.set({}, {}, 1);
      sts[id] = tl.scrollTrigger;
    } else {
      sts[id] = ScrollTrigger.create({ trigger: sections[id], start: 'top top', end: 'bottom top' });
    }
  }
  // иней тает за первый экран
  ScrollTrigger.create({
    trigger: sections.intro, start: 'top top', end: 'bottom top',
    onUpdate: (st) => { melt.scroll = reduce ? 1 : st.progress > 0 ? 0.16 + st.progress * 0.84 : 0; applyMelt(); },
  });
  if (reduce) { setPromise(1); setBody(1); setDisplay(1); setChip(1); melt.scroll = 1; applyMelt(); }

  const K = (id, f, props) => Keys.add(sts[id], f, props);
  // поза держится до трети главы: короткие главы не должны залезать на ключи следующей
  const hold = (id, pose) => { K(id, -0.4, pose); K(id, 0.3, pose); };
  K('intro', -1, P.hero);
  K('intro', 0, P.hero);
  K('intro', 0.5, P.hero);
  hold('promise', { ...P.hidden, ry: PI + 0.6 });
  K('promise', 1, { ...P.hidden, ry: PI + 0.6 });
  K('body', -0.3, P.orbit0);
  K('body', 0, P.orbit0);
  K('body', 0.33, P.orbit1);
  K('body', 0.66, P.orbit2);
  K('body', 1, P.orbit3);
  hold('frost-glass', { ...P.hidden, ry: PI + 5.9 });
  K('display', -0.35, P.display0);
  K('display', 0, P.display0);
  K('display', 1, P.display1);
  K('chip', -0.35, P.chip0);
  K('chip', 0, P.chip0);
  K('chip', 0.45, P.chip1);
  K('chip', 0.62, P.chip2);
  K('chip', 1, P.chip2);
  hold('cores', { ...P.chip2, vis: 0, dist: 14, explode: 0, citadel: 0 });
  K('camera', -0.4, P.cam0);
  K('camera', 0, P.cam0);
  K('camera', 0.15, P.camIsland);
  K('camera', 0.22, P.camIsland);
  K('camera', 0.32, P.camMain);
  K('camera', 0.4, P.camMain);
  K('camera', 0.5, P.camTele);
  K('camera', 0.58, P.camTele);
  K('camera', 0.68, P.camWide);
  K('camera', 0.76, P.camWide);
  K('camera', 0.9, P.camFront);
  K('camera', 1, P.camFront);
  hold('kodak', { ...P.camFront, vis: 0, dist: 6 });
  // в «Citadel» телефон не виден: сейф нарисован, модель собрана заранее
  hold('citadel', P.hidden);
  hold('rubilnik', P.rub);
  hold('torch', P.torch);
  hold('camelos', P.camelos);
  hold('colors', P.colors);
  K('specs', -0.3, { ...P.specs, vis: 0 });
  K('specs', 0, P.specs);
  K('specs', 0.55, P.specs);
  K('price', -0.2, P.hidden);
  K('price', 1, P.hidden);

  // Цитата и тексты глав появляются коротким сдвигом
  if (!reduce) {
    $$('.h1s:not(.h1s--promise) .h1s__text > *, .h1-band .h1-stb > div > *, .h1-film, .h1-cores, .h1-vc').forEach((el) => {
      gsap.fromTo(el, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none none' } });
    });
    // заголовки ловят параллакс
    $$('.h1s .fy__h').forEach((h) => gsap.fromTo(h, { yPercent: 18 }, { yPercent: -10, ease: 'none', scrollTrigger: { trigger: h, start: 'top bottom', end: 'bottom top', scrub: true } }));
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
  // ядра и графика
  ScrollTrigger.create({ trigger: '[data-cores]', start: 'top 72%', once: true, onEnter: () => runCores(reduce) });
  // испарительная камера
  ScrollTrigger.create({ trigger: '[data-vc]', start: 'top 80%', onToggle: (st) => $('[data-vc]').classList.toggle('is-on', st.isActive), end: 'bottom top' });
  // сейф: кольца крутятся от прокрутки
  const vault = $('[data-vault]');
  ScrollTrigger.create({
    trigger: sections.citadel, start: 'top bottom', end: 'bottom top', scrub: !reduce,
    onUpdate: (st) => vault.style.setProperty('--turn', st.progress.toFixed(3)),
  });
  // плёнка живёт, только когда видна
  // иней на стекле и плёнка рисуются при первом показе, а не при загрузке
  ScrollTrigger.create({ trigger: '[data-film]', start: 'top bottom', end: 'bottom top', onToggle: (st) => { film.visible = st.isActive; if (st.isActive) { if (!film.ready) film.size(); film.loop(); } } });
  ScrollTrigger.create({ trigger: '[data-frostpad]', start: 'top bottom', end: 'bottom top', onToggle: (st) => { pad.visible = st.isActive; if (st.isActive) { if (!pad.ready) pad.size(); pad.loop(); } } });
}

/* ---------- 6. Ядра, частота и 1536 точек Adreno ---------- */

const gpuCanvas = $('[data-gpu]');
const GPU = { cols: 48, rows: 32, lit: 0, t: 0 };
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
let gpuRaf = 0;
const gpuVisible = () => { const r = gpuCanvas.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight && !document.hidden; };
drawGpu();

/* ---------- 3. Иней на стекле: провести пальцем ---------- */

const pad = (() => {
  const el = $('[data-frostpad-canvas]');
  const hint = $('[data-frostpad-hint]');
  const frost = document.createElement('canvas');   // слой инея, его стирает палец
  const fresh = document.createElement('canvas');   // эталон: из него иней нарастает обратно
  const st = { visible: false, raf: 0, w: 0, h: 0, dpr: 1, touched: false, ready: false };
  function size() {
    st.dpr = Math.min(window.devicePixelRatio || 1, 2);
    st.w = el.clientWidth; st.h = el.clientHeight;
    if (!st.w) return;
    st.ready = true;
    for (const c of [el, frost, fresh]) { c.width = Math.round(st.w * st.dpr); c.height = Math.round(st.h * st.dpr); }
    fresh.style.width = `${st.w}px`; fresh.style.height = `${st.h}px`;
    // эталонный иней рисуем в своих координатах
    const tmp = document.createElement('canvas');
    tmp.style.cssText = `position:absolute;width:${st.w}px;height:${st.h}px`;
    document.body.append(tmp);
    drawFrost(tmp, { density: 1.8, alpha: 1.6 });
    tmp.remove();
    const fg = fresh.getContext('2d');
    fg.clearRect(0, 0, fresh.width, fresh.height);
    fg.fillStyle = 'rgba(225,238,255,.38)';
    fg.fillRect(0, 0, fresh.width, fresh.height);
    fg.drawImage(tmp, 0, 0, fresh.width, fresh.height);
    const g = frost.getContext('2d');
    g.clearRect(0, 0, frost.width, frost.height);
    g.drawImage(fresh, 0, 0);
    draw();
  }
  function draw() {
    if (!st.ready) return;
    const g = el.getContext('2d');
    const c = H1_COLORS[demo.color];
    const hex = (n) => '#' + n.toString(16).padStart(6, '0');
    const bg = g.createLinearGradient(0, 0, el.width, el.height);
    if (c.grad) { bg.addColorStop(0, c.grad[2]); bg.addColorStop(0.5, c.grad[1]); bg.addColorStop(1, c.grad[0]); }
    else { bg.addColorStop(0, hex(c.body)); bg.addColorStop(1, hex(new ColorShade(c.body).mul(0.6))); }
    g.fillStyle = bg;
    g.fillRect(0, 0, el.width, el.height);
    g.drawImage(frost, 0, 0);
  }
  function melt(x, y) {
    const g = frost.getContext('2d');
    g.save();
    g.globalCompositeOperation = 'destination-out';
    const r = 46 * st.dpr;
    const grd = g.createRadialGradient(x * st.dpr, y * st.dpr, 0, x * st.dpr, y * st.dpr, r);
    grd.addColorStop(0, 'rgba(0,0,0,.9)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x * st.dpr, y * st.dpr, r, 0, PI * 2);
    g.fill();
    g.restore();
    if (!st.touched) { st.touched = true; hint.classList.add('is-hidden'); }
  }
  function loop() {
    if (!st.visible || reducedMode) { st.raf = 0; draw(); return; }
    if (st.raf) return;
    const step = () => {
      if (!st.visible) { st.raf = 0; return; }
      // иней нарастает обратно: эталон поверх с малой прозрачностью
      const g = frost.getContext('2d');
      g.globalAlpha = 0.012;
      g.drawImage(fresh, 0, 0);
      g.globalAlpha = 1;
      draw();
      st.raf = requestAnimationFrame(step);
    };
    st.raf = requestAnimationFrame(step);
  }
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    melt(e.clientX - r.left, e.clientY - r.top);
    if (reducedMode) draw();
  });
  el.addEventListener('pointerdown', (e) => {
    const r = el.getBoundingClientRect();
    melt(e.clientX - r.left, e.clientY - r.top);
    draw();
  });
  window.addEventListener('resize', () => { if (st.ready) size(); });
  return Object.assign(st, { size, draw, loop });
})();

// множитель яркости hex-цвета для градиента под инеем
function ColorShade(n) { this.n = n; }
ColorShade.prototype.mul = function mul(k) {
  const r = Math.round(((this.n >> 16) & 255) * k), g = Math.round(((this.n >> 8) & 255) * k), b = Math.round((this.n & 255) * k);
  return (r << 16) | (g << 8) | b;
};

/* ---------- 8. Плёнки Kodak ---------- */

const film = (() => {
  const view = $('[data-film-canvas]');
  const grain = $('[data-film-grain]');
  const flash = $('[data-film-flash]');
  const roll = $('[data-film-roll]');
  const count = $('[data-film-count]');
  const date = $('[data-film-date]');
  const d = new Date();
  date.textContent = `'31 ${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}`;
  const st = { visible: false, raf: 0, shots: 0, last: 0, ready: false };
  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.width = Math.round(view.clientWidth * dpr);
    view.height = Math.round(view.clientHeight * dpr);
    grain.width = 240; grain.height = 150;
    st.ready = true;
    render(performance.now());
  }
  function render(now) {
    const g = view.getContext('2d');
    drawLighthouse(g, view.width, view.height, { t: reducedMode ? 0 : now / 1000 });
    const gg = grain.getContext('2d');
    const img = gg.createImageData(grain.width, grain.height);
    const strong = demo.film === 'bw' || demo.film === 'cine' ? 70 : 46;
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (Math.random() - 0.5) * strong * 2;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    gg.putImageData(img, 0, 0);
  }
  function apply() {
    view.style.filter = FILMS[demo.film].css;
    view.closest('[data-film]').dataset.profile = demo.film;
  }
  function loop() {
    if (st.raf || reducedMode) { render(0); return; }
    const step = (now) => {
      if (!st.visible) { st.raf = 0; return; }
      if (now - st.last > 70) { render(now); st.last = now; }
      st.raf = requestAnimationFrame(step);
    };
    st.raf = requestAnimationFrame(step);
  }
  const strip = $('[data-film-strip]');
  initRadioGroup(strip, (v) => {
    demo.film = v;
    syncRadio(strip, v);
    apply();
    if (current === 'kodak' || current === 'camera') updateScreen();
  });
  $('[data-film-shoot]').addEventListener('click', () => {
    if (st.shots >= 36) { toast('Плёнка кончилась. Шутка: перемотайте страницу, она бесконечная.'); st.shots = 0; roll.innerHTML = ''; }
    st.shots++;
    if (!st.ready) size();
    render(performance.now());
    // кадр в ленту: тот же снимок с фильтром профиля
    const thumb = document.createElement('canvas');
    thumb.width = 240; thumb.height = 160;
    const tg = thumb.getContext('2d');
    tg.filter = FILMS[demo.film].css;
    tg.drawImage(view, 0, 0, thumb.width, thumb.height);
    tg.filter = 'none';
    tg.globalAlpha = 0.18;
    tg.globalCompositeOperation = 'overlay';
    tg.drawImage(grain, 0, 0, thumb.width, thumb.height);
    tg.globalAlpha = 1;
    tg.globalCompositeOperation = 'source-over';
    tg.font = '600 13px "JetBrains Mono", monospace';
    tg.fillStyle = '#FF8A2A';
    tg.textAlign = 'right';
    tg.fillText(date.textContent, thumb.width - 10, thumb.height - 12);
    const li = document.createElement('li');
    li.className = 'h1-film__frame';
    const img = new Image();
    img.alt = `Кадр ${st.shots}, профиль «${FILMS[demo.film].name.toLowerCase()}»`;
    img.src = thumb.toDataURL('image/jpeg', 0.85);
    const cap = document.createElement('span');
    cap.className = 'mono';
    cap.textContent = `${String(st.shots).padStart(2, '0')} · ${FILMS[demo.film].name}`;
    li.append(img, cap);
    roll.prepend(li);
    count.textContent = `Кадров на плёнке: ${st.shots} из 36. Плёнку не надо покупать.`;
    if (!reducedMode) {
      gsap.fromTo(flash, { opacity: 1 }, { opacity: 0, duration: 0.6, ease: 'power2.out' });
      gsap.fromTo(li, { y: -30, opacity: 0, rotate: -4 }, { y: 0, opacity: 1, rotate: 0, duration: 0.6, ease: 'back.out(1.6)' });
    }
  });
  window.addEventListener('resize', () => { if (st.ready) size(); });
  apply();
  return Object.assign(st, { size, loop });
})();

/* ---------- 9. Сейф Citadel Extreme ---------- */

{
  const NS = 'http://www.w3.org/2000/svg';
  const bolts = $('[data-vault-bolts]');
  for (let i = 0; i < 12; i++) {
    const r = document.createElementNS(NS, 'rect');
    const a = (i / 12) * PI * 2;
    r.setAttribute('x', String(200 + Math.cos(a) * 160 - 7));
    r.setAttribute('y', String(200 + Math.sin(a) * 160 - 7));
    r.setAttribute('width', '14'); r.setAttribute('height', '14'); r.setAttribute('rx', '3');
    bolts.append(r);
  }
  const log = $('[data-vault-log]');
  const vault = $('[data-vault]');
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
    }, reducedMode ? 0 : 420 * (i + 1)));
  });
}

/* ---------- 10. Рубильник ---------- */

const rubGrp = $('[data-rub]');
const rubItems = $$('[data-rub-list] li');
initRadioGroup(rubGrp, (v) => {
  demo.rub = Number(v);
  syncRadio(rubGrp, v);
  rubItems.forEach((li, i) => setTimeout(() => {
    const off = demo.rub >= Number(li.dataset.at);
    li.classList.toggle('is-off', off);
    li.querySelector('b').textContent = off ? 'обесточено' : 'вкл';
  }, reducedMode ? 0 : i * 80));
  updateScreen();
});

/* ---------- 11. Фонарь ---------- */

const TORCH_NOTES = {
  off: { mode: 'выкл', note: 'Видно за 3 км. Красный не сбивает ночное зрение.' },
  white: { mode: 'свет · 1200 лм', note: '1200 люмен, белый. Светит вперёд по линии телефона.' },
  red: { mode: 'красный · 80 лм', note: 'Красный: читать карту ночью и не ослепнуть.' },
  beacon: { mode: 'маяк · Fl(2) 6s', note: 'Две вспышки каждые 6 секунд — позывной «Маяка». Свой задаётся в настройках.' },
  sos: { mode: 'SOS · · · — — — · · ·', note: 'SOS азбукой Морзе. Включается и тройным нажатием кнопки питания.' },
};
const torchGrp = $('[data-torch]');
const torchNote = $('[data-torch-note]');
initRadioGroup(torchGrp, (v) => {
  demo.torch = v;
  syncRadio(torchGrp, v);
  torchNote.textContent = TORCH_NOTES[v].note;
  stage?.setTorchColor(v === 'red' ? 'red' : 'white');
  updateScreen();
});
// Морзе SOS: точка 1, тире 3, пауза между знаками 1, между буквами 3, после слова 7 (единица 0,2 с)
const SOS = (() => {
  const seq = [];
  const letter = (marks) => { marks.forEach((m, i) => { seq.push([1, m]); if (i < marks.length - 1) seq.push([0, 1]); }); };
  letter([1, 1, 1]); seq.push([0, 3]); letter([3, 3, 3]); seq.push([0, 3]); letter([1, 1, 1]); seq.push([0, 7]);
  const total = seq.reduce((s, [, d]) => s + d, 0);
  return { seq, total };
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

/* ---------- 13. Цвета ---------- */

const NOTES = {
  sea: 'Глубокая бирюза Балтики под инеем. Рамка в тон.',
  mars: 'Ржавая пыль Марса: терракота с медной рамкой.',
  sunset: 'Переливается: персик, роза и сирень, как небо за минуту до заката. Цвет меняется, когда поворачиваете телефон.',
  mountain: 'Спецверсия. Сланцевая спинка и снежная вершина: белые остров и рамка.',
  kodak: 'Спецверсия в цветах Kodak: жёлтая спинка, красные остров и рамка, чёрный знак.',
};
const colorGrp = $('[data-colors]');
const colorNote = $('[data-color-note]');
initRadioGroup(colorGrp, (v) => {
  demo.color = v;
  syncRadio(colorGrp, v);
  root.dataset.color = v;
  colorNote.textContent = NOTES[v];
  stage?.setBodyColor(v);
  pad.draw();
});

/* ---------- 15. Цена: память и hex ---------- */

function bindHex(b) {
  const hex = b.textContent.trim();
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
  $$('[data-prices] .fy-hex').forEach((b) => {
    const big = v === '24/1024';
    if (!b.dataset.baseHex) { b.dataset.baseHex = b.firstChild.textContent.trim(); b.dataset.baseDec = b.dataset.hex; }
    const hex = big ? b.dataset.altHex : b.dataset.baseHex;
    b.dataset.hex = big ? b.dataset.altDec : b.dataset.baseDec;
    b.firstChild.textContent = hex;
    bindHex(b);
    if (!reducedMode) gsap.fromTo(b, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out' });
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

let lastY = -1;
function tick() {
  const y = window.scrollY;
  if (y !== lastY) { lastY = y; detectChapter(); }
  if (Keys.empty || !stage) return;
  const now = performance.now();
  const v = Keys.sample(y, reducedMode);
  v.rub = current === 'rubilnik' || current === 'torch' ? demo.rub : 0;
  v.torch = current === 'torch' ? torchLevel(now) : 0;
  // в «Цветах» телефон покачивается, чтобы «Предзакатный» переливался
  if (current === 'colors' && !reducedMode) v.spin = Math.sin(now / 1600) * 0.55;
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
  railItems.intro?.classList.add('is-on');
  updateScreen(true);
  typeIn();

  // Первый экран: телефон прилетает из глубины, вращаясь, иней оттаивает вокруг него
  if (!reducedMode && stage && window.scrollY < 10) {
    const P = makePoses(window.matchMedia('(max-width: 760px)').matches);
    stage.setTarget(P.far);
    stage.snap();
    gsap.ticker.remove(tick);
    const o = { t: 0, m: 0 };
    const intro = gsap.to(o, {
      t: 1, m: 0.16, duration: 2.4, ease: 'power3.out', delay: 0.15,
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
    gsap.from('[data-hero-lines] > span', { yPercent: 110, opacity: 0, duration: 1.1, ease: 'power4.out', stagger: 0.12, delay: 0.35 });
    gsap.from('[data-hero-sub]', { opacity: 0, filter: 'blur(8px)', duration: 1.4, ease: 'power2.out', delay: 1.1 });
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
