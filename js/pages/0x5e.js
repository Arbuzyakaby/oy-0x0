/* =========================================================================
   OY 0X5 Essential — «Из одного куска». Страница-цех.
   Светлый шлифованный алюминий, главы — операции технологической карты
   (ОП 005 … ОП 100), прогресс внизу — брусок, с которого прокрутка снимает
   стружку. «Брусок» — закреплённая сцена: фреза торцует заготовку, обходит
   контур, выбирает карман, режет окна и «Швы», снимает фаску, и деталь
   уходит в анод; летит стружка, считаются граммы. «Шов» — швы на модели
   светятся петлёй резонатора. «Сквозь металл» — сцена сбоку: индукция
   против «Резонанса» на 6,78 МГц, зазор и преграды. Cesium 5 — кристалл
   по блокам; Palladium 5 — «Пломба»: вскрыть корпус и увидеть время
   вскрытия. Видоискатель над цехом в Тулузе: 1×, 2× и «Портрет».
   «Рубильник», фонарь, пять анодов, калькулятор цены с hex.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage } from '../core/stage.js';
import { createKeys } from '../core/keys.js';
import { createOY0X5E, E5_COLORS, SEAM_LOOP, seamPath, seamPads, drawShop } from '../models/oy0x5e.js';
import { $, $$, clamp01, createToast, syncRadio, initRadioGroup, store } from '../core/ui.js';
import { createSmoothScroll } from '../core/scroll.js';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const root = document.documentElement;
const params = new URLSearchParams(location.search);
const toast = createToast($('#toast'), gsap);
const ease = (t) => { const c = clamp01(t); return c * c * (3 - 2 * c); };
const span = (p, a, b) => clamp01((p - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const PI = Math.PI;
const num = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const pad2 = (n) => String(n).padStart(2, '0');
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ---------- 3D ---------- */

const canvas = $('#stage');
let stage = null;
try {
  stage = createStage(canvas, createOY0X5E, { forceFallback: params.has('fallback') });
} catch (err) {
  console.warn('[OY] WebGL недоступен, 3D отключено.', err);
  canvas.style.display = 'none';
}

/* ---------- Состояние демо ---------- */

const demo = { color: 'blank', colorIdx: 0, torch: 'off', sw: 0, twirl: 0, opened: false, when: '', rebooting: false, hours: 0 };

/* ---------- Главы и брусок-прогресс ---------- */

const CHAPTERS = ['hero', 'mill', 'seam', 'glow', 'resonance', 'cesium', 'seal', 'camera', 'switch', 'torch', 'colors', 'buy', 'specs'];
const PINNED = { mill: '+=320%', colors: '+=240%' };
const OPS = { hero: '005', mill: '010', seam: '020', glow: '025', resonance: '030', cesium: '040', seal: '050', camera: '060', switch: '070', torch: '080', colors: '090', buy: '100', specs: '100' };
const sections = Object.fromEntries(CHAPTERS.map((id) => [id, document.getElementById(id)]));
const ticks = $$('[data-op]');
const OP_OF = { specs: 'buy' };
let current = '';
let reducedMode = false;

const barCut = $('[data-bar-cut]');
const barTool = $('[data-bar-tool]');
const barG = $('[data-bar-g]');
const barOp = $('[data-bar-op]');
function paintBar(f) {
  const pct = `${(f * 100).toFixed(2)}%`;
  barCut.style.width = pct;
  barTool.style.left = pct;
  barG.textContent = Math.round(405 * f);
}

function detectChapter() {
  const line = window.innerHeight * 0.5;
  let id = CHAPTERS[0];
  for (const c of CHAPTERS) if (sections[c].getBoundingClientRect().top <= line) id = c;
  if (id === current) return;
  current = id;
  const on = OP_OF[id] || id;
  const idx = ticks.findIndex((a) => a.dataset.op === on);
  ticks.forEach((a, i) => { a.classList.toggle('is-on', i === idx); a.classList.toggle('is-past', i < idx); });
  barOp.textContent = `ОП ${OPS[id]}`;
  updateScreen();
}

/* ---------- Экран телефона ---------- */

let lastScreenKey = '';
function updateScreen(force = false) {
  if (!stage) return;
  let mode = 'lock';
  const extra = { sw: demo.sw, pct: 72 };
  if (current === 'cesium') mode = 'chip';
  else if (current === 'seal') { mode = demo.rebooting ? 'off' : 'seal'; Object.assign(extra, { opened: demo.opened, when: demo.when }); }
  else if (current === 'switch') mode = 'switch';
  else if (current === 'torch') { mode = 'torch'; extra.torch = demo.torch === 'off' ? 0 : 1; extra.torchColor = demo.torch === 'red' || demo.torch === 'sos' ? 'red' : 'white'; extra.torchMode = TORCH[demo.torch].mode; }
  const key = mode + JSON.stringify(extra);
  if (key === lastScreenKey && !force) return;
  lastScreenKey = key;
  stage.setScreen(mode, extra);
}

/* ---------- Позы ---------- */

// x/y — доля половины видимой ширины/высоты; fx/fy/fz — точка модели (единицы сцены: мм × 0,01)
const BASE = { x: 0, y: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: 0, rz: 0, s: 1, dist: 5.4, float: 1, vis: 1, spin: 0, sw: 0, torch: 0, screen: 1, seam: 0, glow: 0 };
const SW_Y = 0.482;          // «Рубильник» по высоте
function makePoses(mobile) {
  const P = {
    far: { x: 0.2, y: 0.1, rx: 0.3, ry: PI - 0.1, rz: -0.2, dist: 30, float: 0 },
    // спинкой: «пилюля», знак OY и швы
    hero: { x: 0.3, y: 0.1, rx: 0.06, ry: PI - 0.4, rz: 0.05, dist: 6.6 },
    seam: { x: 0.34, rx: 0.12, ry: PI - 0.22, rz: 0.03, dist: 5.1 },
    glow: { x: 0.3, rx: 0.06, ry: PI - 0.1, rz: 0.02, dist: 5.0, float: 0.6 },
    cesium: { x: 0.34, rx: 0.05, ry: -0.3, rz: 0.03, dist: 5.4 },
    // все главы с телефоном держат его справа: между ними он не перелетает через текст
    seal: { x: 0.32, rx: 0.03, ry: -0.1, rz: 0.02, dist: 5.2 },
    switch: { x: 0.26, fy: SW_Y - 0.1, rx: 0.06, ry: PI / 2 - 0.42, dist: 3.4, float: 0.3 },
    torch: { x: 0.34, y: 0.02, fy: 0.6, rx: 0.85, ry: -0.42, rz: 0.06, dist: 4.6, float: 0.15 },
    colors: { x: 0.28, rx: 0.1, ry: PI - 0.4, rz: 0.04, dist: 5.1 },
    hidden: { rx: 0.3, ry: PI - 0.8, dist: 16, float: 0, vis: 0 },
  };
  for (const k in P) P[k] = { ...BASE, ...P[k] };
  P.seam.seam = 1;
  P.glow = { ...P.glow, glow: 1, screen: 0 };
  if (!mobile) return P;
  for (const k in P) {
    const p = P[k];
    P[k] = { ...p, x: 0, y: 0.5, dist: p.dist * (p.dist < 4 ? 2.7 : 1.9) };
  }
  P.hero = { ...P.hero, x: 0.38, y: 0.5, dist: 9.8 };
  P.far = { ...P.far, y: 0.45 };
  P.mobile = true;
  return P;
}

const Keys = createKeys();
const sts = {};
const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ });

/* ---------- Заголовки по словам ---------- */

function splitWords(el) {
  const words = [];
  const walk = (node) => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const part of n.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { frag.append(part); continue; }
          const w = document.createElement('span');
          w.className = 'x-w';
          const inner = document.createElement('span');
          inner.textContent = part;
          w.append(inner);
          frag.append(w);
          words.push(inner);
        }
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    }
  };
  walk(el);
  return words;
}
const splitHeads = $$('[data-split]').map((el) => ({ el, words: splitWords(el) }));

/* ---------- ОП 010. Брусок: фреза по прокрутке ---------- */

// Вид сверху, изнутри корпуса (поэтому «пилюля» — справа). Всё в мм, центр детали — 0, 0
const PART = { w: 75.2, h: 156.4, r: 12.6 };
const BILLET = { w: 88, h: 170 };
const WALL = 0.9;
const STAGES = [
  { id: 'face', name: 'Торец', a: 0, b: 0.14, g0: 0, g1: 22 },
  { id: 'contour', name: 'Контур', a: 0.14, b: 0.4, g0: 22, g1: 248 },
  { id: 'pocket', name: 'Карман', a: 0.4, b: 0.68, g0: 248, g1: 396 },
  { id: 'holes', name: 'Окна', a: 0.68, b: 0.8, g0: 396, g1: 401 },
  { id: 'chamfer', name: 'Фаска', a: 0.8, b: 0.9, g0: 401, g1: 405 },
  { id: 'anod', name: 'Анод', a: 0.9, b: 1, g0: 405, g1: 405 },
];
// окна изнутри: камеры и вспышка справа сверху, «Швы», порт, разъём 3,5 мм
const HOLES = [
  { k: 'c', x: 37.6 - 6.4 - 13.7 - 6.75, y: 78.2 - 12.8, r: 4.95 },
  { k: 'c', x: 37.6 - 6.4 - 13.7 + 6.75, y: 78.2 - 12.8, r: 4.95 },
  { k: 'c', x: 37.6 - 6.4 - 27.4 - 8.2 + 0.4, y: 78.2 - 12.8, r: 2.1 },
  { k: 'loop', x: SEAM_LOOP.x, y: SEAM_LOOP.top - SEAM_LOOP.r },
  { k: 'pads', x: SEAM_LOOP.gap / 2, y: SEAM_LOOP.bottom },
  { k: 'p', x: 0, y: -78.2, w: 8.4, h: 2.5 },
  { k: 'c', x: -14.5, y: -77, r: 1.75 },
];
const millCv = $('[data-mill]');
const millOp = $('[data-mill-op]');
const millG = $('[data-mill-g]');
const millMin = $('[data-mill-min]');
const stepItems = $$('[data-steps] li');
const mill = { p: 0, lastP: 0, visible: false, raf: 0, chips: [], w: 0, h: 0, s: 1, cx: 0, cy: 0, stageIdx: -1, sawCv: null };

function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function sizeMill() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(millCv.clientWidth * dpr), h = Math.round(millCv.clientHeight * dpr);
  if (!w || !h) return false;
  if (millCv.width !== w || millCv.height !== h) { millCv.width = w; millCv.height = h; mill.sawCv = null; }
  mill.w = w; mill.h = h;
  mill.s = Math.min(w / (BILLET.w + 26), h / (BILLET.h + 22));
  mill.cx = w / 2; mill.cy = h / 2 - mill.s * 3;
  return true;
}
// мм → пиксели холста
const MX = (x) => mill.cx + x * mill.s;
const MY = (y) => mill.cy - y * mill.s;
// пилёная корка заготовки — дуги от дисковой пилы
function sawTexture() {
  if (mill.sawCv) return mill.sawCv;
  const cv = document.createElement('canvas');
  cv.width = mill.w; cv.height = mill.h;
  const g = cv.getContext('2d');
  g.fillStyle = '#AEB4BA';
  g.fillRect(0, 0, cv.width, cv.height);
  g.strokeStyle = 'rgba(70,76,82,.22)';
  g.lineWidth = Math.max(1, mill.s * 0.25);
  for (let i = -40; i < 80; i++) {
    g.beginPath();
    g.arc(MX(-200), MY(i * 4), mill.s * 220, -0.5, 0.5);
    g.stroke();
  }
  mill.sawCv = cv;
  return cv;
}
function partPath(g, inset = 0) {
  rr(g, MX(-PART.w / 2 + inset), MY(PART.h / 2 - inset), (PART.w - 2 * inset) * mill.s, (PART.h - 2 * inset) * mill.s, Math.max(0.5, PART.r - inset) * mill.s);
}
function stageOf(p) {
  for (let i = 0; i < STAGES.length; i++) if (p < STAGES[i].b || i === STAGES.length - 1) return i;
  return STAGES.length - 1;
}
// где сейчас фреза — по той же арифметике, что и рисунок
function toolAt(p) {
  const i = stageOf(p), st = STAGES[i], f = span(p, st.a, st.b);
  if (st.id === 'face') {
    const n = 17, k = f * n, row = Math.min(n - 1, Math.floor(k)), q = k - row;
    const y = BILLET.h / 2 - (row + 0.5) * (BILLET.h / n);
    const x = row % 2 ? BILLET.w / 2 - q * BILLET.w : -BILLET.w / 2 + q * BILLET.w;
    return { x, y };
  }
  if (st.id === 'contour') {
    const w = lerp(BILLET.w, PART.w, f) / 2, h = lerp(BILLET.h, PART.h, f) / 2;
    const a = f * PI * 2 * 7;
    return { x: Math.cos(a) * w, y: Math.sin(a) * h };
  }
  if (st.id === 'pocket') {
    const iw = PART.w - 2 * WALL - 6, ih = PART.h - 2 * WALL - 6;
    const n = 24, k = f * n, row = Math.min(n - 1, Math.floor(k)), q = k - row;
    const y = ih / 2 - (row + 0.5) * (ih / n);
    const x = row % 2 ? iw / 2 - q * iw : -iw / 2 + q * iw;
    return { x, y };
  }
  if (st.id === 'holes') {
    const h = HOLES[Math.min(HOLES.length - 1, Math.floor(f * HOLES.length))];
    // петлю «Шва» фреза обходит по правой стороне снизу вверх
    if (h.k === 'loop') return { x: h.x, y: lerp(SEAM_LOOP.bottom, SEAM_LOOP.top, (f * HOLES.length) % 1) };
    return { x: h.x, y: h.y };
  }
  if (st.id === 'chamfer') {
    const a = f * PI * 2 + PI / 2;
    return { x: Math.cos(a) * PART.w / 2, y: Math.sin(a) * PART.h / 2 };
  }
  return { x: PART.w / 2 + 16, y: PART.h / 2 + 4 };
}
function drawMill(now) {
  if (!sizeMill()) return;
  const g = millCv.getContext('2d');
  const { w, h, s } = mill;
  const p = mill.p;
  const t = now / 1000;
  g.clearRect(0, 0, w, h);
  const fFace = span(p, 0, 0.14), fCont = span(p, 0.14, 0.4), fPock = span(p, 0.4, 0.68);
  const fHole = span(p, 0.68, 0.8), fCham = span(p, 0.8, 0.9), fAnod = span(p, 0.9, 1);
  const bx = MX(-BILLET.w / 2), by = MY(BILLET.h / 2), bw = BILLET.w * s, bh = BILLET.h * s;
  const accent = getComputedStyle(root).getPropertyValue('--accent').trim() || '#1F4FD8';
  const body = '#' + E5_COLORS[demo.color].body.toString(16).padStart(6, '0');

  // тиски: две губки по бокам
  g.fillStyle = '#4A5056';
  g.globalAlpha = 1 - fAnod;
  g.fillRect(bx - 9 * s, MY(30), 8 * s, 60 * s);
  g.fillRect(bx + bw + s, MY(30), 8 * s, 60 * s);
  g.globalAlpha = 1;

  // пол вокруг детали: то, что осталось от бруска после контура; в аноде уходит
  const floorA = 1 - fAnod;
  if (floorA > 0.01) {
    g.save();
    g.globalAlpha = floorA;
    g.shadowColor = 'rgba(0,0,0,.25)';
    g.shadowBlur = 24 * (w / 1000);
    g.shadowOffsetY = 10 * (w / 1000);
    g.fillStyle = '#B8BEC4';
    g.fillRect(bx, by, bw, bh);
    g.restore();
    g.save();
    g.globalAlpha = floorA;
    g.beginPath(); g.rect(bx, by, bw, bh); g.clip();
    // пилёная корка
    g.drawImage(sawTexture(), 0, 0);
    // торцевание: полосы по 10 мм змейкой, свежий металл
    const n = 17, done = fFace * n;
    const shine = g.createLinearGradient(bx, 0, bx + bw, 0);
    shine.addColorStop(0, '#D9DDE0'); shine.addColorStop(0.5, '#F4F6F7'); shine.addColorStop(1, '#D2D6DA');
    g.fillStyle = shine;
    for (let r = 0; r < Math.ceil(done); r++) {
      const q = Math.min(1, done - r);
      const ry = by + r * (bh / n);
      const rw = bw * q;
      g.fillRect(r % 2 ? bx + bw - rw : bx, ry, rw, bh / n + 0.5);
    }
    g.strokeStyle = 'rgba(0,0,0,.05)';
    g.lineWidth = 1;
    for (let r = 1; r < Math.floor(done); r++) { g.beginPath(); g.moveTo(bx, by + r * (bh / n)); g.lineTo(bx + bw, by + r * (bh / n)); g.stroke(); }
    // контур: всё между краем бруска и сужающимся силуэтом опускается на дно
    if (fCont > 0) {
      const cw = lerp(BILLET.w, PART.w, fCont), ch = lerp(BILLET.h, PART.h, fCont), cr = lerp(2, PART.r, fCont);
      g.beginPath();
      g.rect(bx, by, bw, bh);
      rr(g, MX(-cw / 2), MY(ch / 2), cw * s, ch * s, cr * s);
      g.fillStyle = '#868D94';
      g.fill('evenodd');
      // следы фрезы — концентрические кольца
      g.strokeStyle = 'rgba(255,255,255,.12)';
      g.lineWidth = 1;
      for (let k = 0; k < 6; k++) {
        const kk = (k / 6) * fCont;
        const ww = lerp(BILLET.w, PART.w, kk), hh = lerp(BILLET.h, PART.h, kk);
        g.beginPath(); rr(g, MX(-ww / 2), MY(hh / 2), ww * s, hh * s, lerp(2, PART.r, kk) * s); g.stroke();
      }
      // стенка уступа
      g.beginPath(); rr(g, MX(-cw / 2), MY(ch / 2), cw * s, ch * s, cr * s);
      g.strokeStyle = 'rgba(30,34,38,.55)';
      g.lineWidth = Math.max(1.5, s * 0.7);
      g.stroke();
    }
    g.restore();
  }

  // деталь: после контура — силуэт телефона
  if (fCont >= 1) {
    g.save();
    if (floorA <= 0.01) {
      g.shadowColor = 'rgba(0,0,0,.28)';
      g.shadowBlur = 30 * (w / 1000);
      g.shadowOffsetY = 14 * (w / 1000);
    }
    g.beginPath(); partPath(g);
    const al = g.createLinearGradient(MX(-PART.w / 2), 0, MX(PART.w / 2), 0);
    al.addColorStop(0, '#CDD2D6'); al.addColorStop(0.5, '#F5F7F8'); al.addColorStop(1, '#C6CBD0');
    g.fillStyle = al;
    g.fill();
    g.restore();
    // карман: змейкой сверху вниз, до стенок 0,9 мм
    if (fPock > 0) {
      g.save();
      g.beginPath(); partPath(g, WALL); g.clip();
      const iw = PART.w - 2 * WALL, ih = PART.h - 2 * WALL;
      const n = 24, done = fPock * n;
      g.fillStyle = '#A3AAB1';
      for (let r = 0; r < Math.ceil(done); r++) {
        const q = Math.min(1, done - r);
        const ry = MY(ih / 2) + r * (ih * s / n);
        const rw = (iw * s) * q;
        g.fillRect(r % 2 ? MX(iw / 2) - rw : MX(-iw / 2), ry - 0.5, rw, ih * s / n + 1);
      }
      g.strokeStyle = 'rgba(255,255,255,.14)';
      g.lineWidth = 1;
      for (let r = 1; r < Math.floor(done); r++) {
        const ry = MY(ih / 2) + r * (ih * s / n);
        g.beginPath(); g.moveTo(MX(-iw / 2), ry); g.lineTo(MX(iw / 2), ry); g.stroke();
      }
      g.restore();
      // стенка 0,9 мм — светлая кромка
      g.beginPath(); partPath(g, WALL);
      g.strokeStyle = 'rgba(30,34,38,.45)';
      g.lineWidth = Math.max(1, s * 0.35);
      g.stroke();
    }
    // окна и «Швы»
    if (fHole > 0) {
      const shown = Math.ceil(fHole * HOLES.length - 0.001);
      HOLES.slice(0, shown).forEach((hl, i) => {
        const a = clamp01(fHole * HOLES.length - i);
        g.globalAlpha = a;
        g.fillStyle = '#262A2F';
        if (hl.k === 'c') { g.beginPath(); g.arc(MX(hl.x), MY(hl.y), hl.r * s, 0, PI * 2); g.fill(); }
        else if (hl.k === 'p') { g.beginPath(); rr(g, MX(hl.x - hl.w / 2), MY(hl.y + hl.h / 2), hl.w * s, hl.h * s, hl.h * s / 2); g.fill(); }
        else {
          // «Шов»: петля с разрывом внизу прорезается по мере хода; после фаски её заливают полимером
          const poly = fCham > 0.3 ? E5_COLORS[demo.color].seam : '#262A2F';
          g.strokeStyle = poly; g.fillStyle = poly; g.lineWidth = Math.max(1.5, 0.5 * s); g.lineCap = 'round';
          if (hl.k === 'loop') { const per = 2 * (2 * SEAM_LOOP.x + SEAM_LOOP.top - SEAM_LOOP.bottom) * s; g.save(); g.setLineDash([per * a, per]); seamPath(g, MX, MY, s); g.stroke(); g.restore(); }
          else seamPads(g, MX, MY, s);
        }
        g.globalAlpha = 1;
      });
    }
    // фаска алмазом: яркая кромка бежит по контуру
    if (fCham > 0) {
      const per = 2 * (PART.w + PART.h) * s;
      g.save();
      g.beginPath(); partPath(g, 0.4);
      g.setLineDash([per * fCham, per]);
      g.strokeStyle = '#FFFFFF';
      g.lineWidth = Math.max(2, s * 0.9);
      g.shadowColor = 'rgba(255,255,255,.9)';
      g.shadowBlur = 8;
      g.stroke();
      g.restore();
    }
    // анод: цвет садится на металл
    if (fAnod > 0 && demo.color !== 'blank') {
      g.save();
      g.beginPath(); partPath(g); g.clip();
      g.globalCompositeOperation = 'multiply';
      g.globalAlpha = fAnod * 0.9;
      g.fillStyle = body;
      g.fillRect(MX(-PART.w / 2), MY(PART.h / 2), PART.w * s, PART.h * s);
      g.restore();
    }
    if (fAnod > 0.5) {
      g.save();
      g.globalAlpha = span(fAnod, 0.5, 1);
      g.font = `800 ${Math.round(s * 9)}px "Onest", system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = demo.color === 'lacquer' || demo.color === 'anod' || demo.color === 'signal' ? 'rgba(255,255,255,.85)' : 'rgba(20,23,26,.75)';
      g.fillText('27 г', MX(0), MY(0));
      g.font = `700 ${Math.round(s * 3.4)}px "JetBrains Mono", monospace`;
      g.fillText('ИЗ 432 Г БРУСКА', MX(0), MY(-10));
      g.restore();
    }
  }

  // стружка
  for (const c of mill.chips) {
    g.save();
    g.globalAlpha = clamp01(c.life);
    g.translate(MX(c.x), MY(c.y));
    g.rotate(c.rot);
    g.strokeStyle = c.tone;
    g.lineWidth = Math.max(1, s * 0.45);
    g.beginPath();
    g.arc(0, 0, c.size * s, 0, PI * 1.4);
    g.stroke();
    g.restore();
  }

  // фреза: держатель с цветным кольцом, вращающиеся зубья
  if (p < 0.995) {
    const tp = toolAt(p);
    const tx = MX(tp.x), ty = MY(tp.y), tr = 5.5 * s;
    g.save();
    g.fillStyle = 'rgba(0,0,0,.18)';
    g.beginPath(); g.arc(tx + tr * 0.5, ty + tr * 0.7, tr * 1.3, 0, PI * 2); g.fill();
    g.fillStyle = '#E6E9EB';
    g.beginPath(); g.arc(tx, ty, tr * 1.25, 0, PI * 2); g.fill();
    g.strokeStyle = accent;
    g.lineWidth = tr * 0.28;
    g.beginPath(); g.arc(tx, ty, tr * 1.1, 0, PI * 2); g.stroke();
    g.fillStyle = '#5A6168';
    g.beginPath(); g.arc(tx, ty, tr * 0.8, 0, PI * 2); g.fill();
    g.strokeStyle = '#DCE0E3';
    g.lineWidth = Math.max(1, tr * 0.12);
    const spin = reducedMode ? 0 : t * 30;
    for (let k = 0; k < 4; k++) {
      const a = spin + (k * PI) / 2;
      g.beginPath();
      g.arc(tx, ty, tr * 0.55, a, a + 0.9);
      g.stroke();
    }
    g.restore();
  }
}
function setMill(p) {
  const prev = mill.p;
  mill.p = p;
  const i = stageOf(p);
  const st = STAGES[i];
  const grams = Math.round(lerp(st.g0, st.g1, span(p, st.a, st.b)));
  millG.textContent = grams;
  millMin.textContent = Math.round(41 * p);
  if (i !== mill.stageIdx) {
    mill.stageIdx = i;
    millOp.textContent = st.name;
    stepItems.forEach((li, k) => { li.classList.toggle('is-on', k <= i); li.classList.toggle('is-now', k === i); });
  }
  // стружка вылетает из-под фрезы, сколько сняли — столько и летит
  if (!reducedMode && p > prev && p < 0.9) {
    const tp = toolAt(p);
    const n = Math.min(14, Math.ceil((p - prev) * 900));
    for (let k = 0; k < n && mill.chips.length < 160; k++) {
      const a = Math.random() * PI * 2, v = 14 + Math.random() * 40;
      mill.chips.push({ x: tp.x, y: tp.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, life: 1, size: 0.8 + Math.random() * 1.4, tone: Math.random() < 0.5 ? '#9CA3AA' : '#E2E6E9' });
    }
  }
  if (!mill.raf) mill.raf = requestAnimationFrame(millLoop);
}
let millLast = 0;
function millLoop(now) {
  mill.raf = 0;
  const dt = Math.min(0.05, (now - (millLast || now)) / 1000);
  millLast = now;
  for (const c of mill.chips) {
    c.x += c.vx * dt; c.y += c.vy * dt;
    c.vx *= 1 - dt * 2.2; c.vy *= 1 - dt * 2.2;
    c.rot += c.vr * dt;
    c.life -= dt * 0.9;
  }
  mill.chips = mill.chips.filter((c) => c.life > 0);
  drawMill(now);
  if (mill.visible && !document.hidden && !reducedMode) mill.raf = requestAnimationFrame(millLoop);
}

/* ---------- ОП 030. Сквозь металл ---------- */

const resField = $('[data-res-field]');
const resPhone = $('[data-res-phone]');
const resPad = $('[data-res-pad]');
const resTable = $('[data-res-table]');
const resBook = $('[data-res-book]');
const resHeat = $('[data-res-heat]');
const resW = $('[data-res-w]');
const resEff = $('[data-res-eff]');
const resDist = $('[data-res-dist]');
const resNote = $('[data-res-note]');
const gapIn = $('[data-gap]');
const gapOut = $('[data-gap-out]');
const modeGrp = $('[data-res-mode]');
const thruGrp = $('[data-res-through]');
// начинаем со столешницы: телефон лежит на столе, плита прикручена снизу
const res = { mode: 'res', through: 'table', gap: 4 };
const PX_MM = 4;              // мм → пиксели сцены
const PAD_Y = 290;            // верх плиты
const OBST = { air: 0, table: 18, book: 30 };
// «Резонанс»: мощность по расстоянию до плиты, мм → Вт
const RES_CURVE = [[0, 20], [10, 18], [20, 15], [30, 11], [40, 7], [50, 4]];
function resPower(d) {
  for (let i = 1; i < RES_CURVE.length; i++) {
    const [d0, p0] = RES_CURVE[i - 1], [d1, p1] = RES_CURVE[i];
    if (d <= d1) return lerp(p0, p1, (d - d0) / (d1 - d0));
  }
  return RES_CURVE.at(-1)[1];
}
function paintRes() {
  const obst = OBST[res.through];
  const dist = obst + res.gap;
  // плита: под столом — прикручена снизу; иначе — на полу сцены
  const padTop = PAD_Y;
  const obstTop = padTop - obst * PX_MM;
  resPad.setAttribute('transform', `translate(0 ${padTop})`);
  resTable.setAttribute('y', res.through === 'table' ? obstTop : padTop);
  resTable.setAttribute('height', res.through === 'table' ? obst * PX_MM : 0);
  resBook.setAttribute('y', res.through === 'book' ? obstTop : padTop);
  resBook.setAttribute('height', res.through === 'book' ? obst * PX_MM : 0);
  const phoneBottom = obstTop - res.gap * PX_MM;
  resPhone.setAttribute('transform', `translate(0 ${phoneBottom - 18})`);

  const isRes = res.mode === 'res';
  const watts = isRes ? resPower(dist) : 0;
  const eff = isRes ? Math.round(82 - dist * 0.5) : 0;
  const heat = isRes ? 1 : dist <= 8 ? Math.round(9 * (1 - dist / 8)) : 0;
  resW.textContent = `${Math.round(watts)} Вт`;
  resEff.textContent = `${eff} %`;
  resDist.textContent = `${dist} мм`;
  resW.classList.toggle('is-zero', watts < 0.5);
  resEff.classList.toggle('is-zero', eff === 0);
  resHeat.textContent = `+${heat} °C`;
  resHeat.classList.toggle('is-hot', heat > 3);
  gapOut.textContent = res.gap;

  // линии поля: от катушки вверх; у индукции они гаснут в металле или не доходят
  const reach = isRes ? phoneBottom : Math.max(phoneBottom, padTop - 8 * PX_MM);
  let d = '';
  const lines = 7;
  for (let i = 0; i < lines; i++) {
    const k = (i - (lines - 1) / 2) / ((lines - 1) / 2);
    const x0 = 320 + k * 60, x1 = 320 + k * (isRes ? 120 : 90);
    const y0 = padTop, y1 = reach + (isRes ? 2 : 0);
    const mid = (y0 + y1) / 2;
    d += `<path class="${isRes ? '' : 'is-dead'}" d="M${x0} ${y0} C ${x0 + k * 30} ${mid}, ${x1} ${mid}, ${x1} ${y1}"/>`;
  }
  resField.innerHTML = d;

  let note;
  if (isRes) {
    if (dist === 0) note = 'Вплотную: 20 Вт, как у хорошей плиты для стеклянных телефонов.';
    else if (res.through === 'table') note = `Сквозь 18 мм дуба: ${Math.round(watts)} Вт. Плита прикручена к столу снизу, сверху — чистая столешница.`;
    else if (res.through === 'book') note = `Сквозь книгу в 30 мм: ${Math.round(watts)} Вт. Медленнее, но заряжается.`;
    else note = `В воздухе на ${dist} мм: ${Math.round(watts)} Вт. Класть точно в центр не нужно.`;
  } else if (dist > 8) note = 'Индукция дальше 8 мм не дотягивается даже до стеклянного телефона. До металла — тем более.';
  else note = `Индукция: поле тонет в алюминии. Вихревые токи греют корпус на +${heat} °C, а заряда — 0 Вт. Поэтому металлическим телефонам обычно ставят стеклянную спинку.`;
  resNote.textContent = note;
}
initRadioGroup(modeGrp, (v) => { syncRadio(modeGrp, v); res.mode = v; paintRes(); });
initRadioGroup(thruGrp, (v) => {
  syncRadio(thruGrp, v);
  res.through = v;
  // над толстой преградой зазор поменьше, чтобы сцена помещалась
  gapIn.max = v === 'air' ? 40 : 20;
  if (res.gap > Number(gapIn.max)) { res.gap = Number(gapIn.max); gapIn.value = res.gap; }
  paintRes();
});
gapIn.addEventListener('input', () => { res.gap = Number(gapIn.value); paintRes(); });
gapIn.max = 20;
paintRes();

/* ---------- ОП 040. Cesium 5 ---------- */

const DIE = {
  big: 'Одно большое ядро до 3,8 ГГц — открывает приложения и тяжёлые страницы и снова засыпает.',
  mid: 'Три средних по 3,2 ГГц: на них живёт почти всё, что вы делаете за день.',
  eco: 'Четыре экономных по 2,1 ГГц — фон, музыка, будильник. Благодаря им 5100 мАч хватает почти на два дня.',
  gpu: 'Графика на 6 ядер — своя, OY. На 70 % быстрее, чем у Cesium 1.',
  npu: 'Нейроядро на 40 TOPS: «Погонщик» работает на устройстве и не знает, что такое интернет.',
  nc5: 'Модем NC5 — пятый модем OY. Две из восьми его антенн — «Швы» корпуса.',
  pd: 'Palladium 5 — соседний кристалл в том же корпусе. С Cesium 5 его связывает одна шина, по ней ходят только просьбы «подпиши» и «проверь».',
};
const dieBtns = $$('[data-block]');
const dieNote = $('[data-die-note]');
dieBtns.forEach((b) => b.addEventListener('click', () => {
  dieBtns.forEach((x) => x.classList.toggle('is-on', x === b));
  dieNote.textContent = DIE[b.dataset.block];
}));

/* ---------- ОП 050. Palladium 5: «Пломба» ---------- */

const openBtn = $('[data-open]');
const resealBtn = $('[data-reseal]');
const sealNote = $('[data-seal-note]');
openBtn.addEventListener('click', () => {
  openBtn.disabled = true;
  const d = new Date();
  demo.when = `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.2033 · ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  demo.rebooting = true;
  sealNote.textContent = 'Нить в клее порвана. Телефон выключился, Palladium 5 записал время…';
  updateScreen();
  setTimeout(() => {
    demo.rebooting = false;
    demo.opened = true;
    updateScreen();
    sealNote.textContent = `При включении: «Корпус вскрывали ${demo.when}». Ключи на месте, решать вам.`;
    toast('«Пломба» сработала: время вскрытия записано в Palladium 5.');
    resealBtn.disabled = false;
  }, reducedMode ? 200 : 1100);
});
resealBtn.addEventListener('click', () => {
  demo.opened = false;
  resealBtn.disabled = true;
  openBtn.disabled = false;
  sealNote.textContent = 'Новый телефон с завода: «Пломба» цела, вскрытий ноль.';
  updateScreen();
});

/* ---------- ОП 060. Видоискатель ---------- */

const ZOOM_INFO = {
  1: { z: 1, portrait: 0, label: '1× · 50 Мп · 24 мм', note: '1×: основная камера, сенсор 1/1,56″. Утро в цехе в Тулузе.' },
  2: { z: 2, portrait: 0, label: '2× · телевик 50 Мп · 48 мм', note: '2×: телевик. Настоящие 48 мм, а не кроп: кружка и свежий корпус во весь кадр.' },
  portrait: { z: 2, portrait: 1, label: 'Портрет · 2× · глубина от двух камер', note: '«Портрет»: камеры смотрят с точек в 13,5 мм друг от друга. Станок размыт, ручка кружки — нет.' },
};
const zoomGrp = $('[data-zoom]');
const viewCanvas = $('[data-view]');
const viewLabel = $('[data-view-label]');
const camNote = $('[data-cam-note]');
const view = { zoom: 1, portrait: 0, raf: 0, visible: false };
function setZoom(k) {
  const info = ZOOM_INFO[k];
  syncRadio(zoomGrp, k);
  viewLabel.textContent = info.label;
  camNote.textContent = info.note;
  const to = { zoom: info.z, portrait: info.portrait };
  if (reducedMode) Object.assign(view, to); else gsap.to(view, { ...to, duration: 0.9, ease: 'power3.inOut', overwrite: true });
  if (!view.raf) view.raf = requestAnimationFrame(viewLoop);
}
function drawView(now) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(viewCanvas.clientWidth * dpr), h = Math.round(viewCanvas.clientHeight * dpr);
  if (!w || !h) return;
  if (viewCanvas.width !== w || viewCanvas.height !== h) { viewCanvas.width = w; viewCanvas.height = h; }
  drawShop(viewCanvas.getContext('2d'), w, h, { t: now / 1000, zoom: view.zoom, portrait: view.portrait, accent: E5_COLORS[demo.color].ui });
}
function viewLoop(now) {
  view.raf = 0;
  if (!view.visible || document.hidden) return;
  drawView(now);
  if (!reducedMode) view.raf = requestAnimationFrame(viewLoop);
}
initRadioGroup(zoomGrp, (v) => setZoom(v));

/* ---------- ОП 070. «Рубильник» ---------- */

const swGrp = $('[data-sw]');
const swNote = $('[data-sw-note]');
const SW_TOAST = {
  1: '«Эфир»: Palladium 5 обесточил модем, Wi-Fi, Bluetooth и GPS.',
  0: 'Середина: всё включено.',
  '-1': '«Тишина»: ещё и камеры с микрофонами обесточены. Проводами, а не настройкой.',
};
const SW_NOTE = {
  1: 'Язычок наверху. Телефон без сети, но камера и фонарь работают.',
  0: 'Переключите и посмотрите на язычок на грани.',
  '-1': 'Язычок внизу. Камеры и микрофоны обесточены, звонки не придут.',
};
initRadioGroup(swGrp, (v) => {
  syncRadio(swGrp, v);
  demo.sw = Number(v);
  toast(SW_TOAST[v]);
  swNote.textContent = SW_NOTE[v];
  updateScreen();
});

/* ---------- ОП 080. Фонарь ---------- */

const TORCH = {
  off: { mode: 'выключен', note: 'Фонарь выключен. Включите красный.' },
  white: { mode: 'белый · около 3000 м', note: 'Белый: видно примерно за 3 км.' },
  red: { mode: 'красный · до 5000 м', note: 'Красный: виден за 5 км и бережёт ночное зрение.' },
  sos: { mode: 'SOS · ··· ——— ···', note: 'SOS азбукой Морзе. Palladium 5 включит его сам, если сработает «Мёртвая рука».' },
};
const torchGrp = $('[data-torch]');
const torchNote = $('[data-torch-note]');
const darkEl = $('[data-dark]');
initRadioGroup(torchGrp, (v) => {
  syncRadio(torchGrp, v);
  demo.torch = v;
  torchNote.textContent = TORCH[v].note;
  stage?.setTorchColor(v === 'red' || v === 'sos' ? 'red' : 'white');
  updateScreen();
});
const SOS = [1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0];
function torchLevel(now) {
  if (demo.torch === 'off') return 0;
  if (demo.torch === 'sos') return SOS[Math.floor(now / 220) % SOS.length];
  return 1;
}

/* ---------- ОП 090. Анод ---------- */

const COLOR_ORDER = ['blank', 'anod', 'chips', 'signal', 'lacquer'];
const COLOR_NOTES = {
  blank: '«Заготовка». Сырой алюминий после дробеструя, как он вышел из станка.',
  anod: '«Анод». Глубокий синий: цвет растёт в порах самого алюминия и не облезает.',
  chips: '«Стружка». Тёплое шампанское — как завиток, который летит из-под фрезы.',
  signal: '«Сигнальный». Красный OY со времён 0X0, теперь в металле.',
  lacquer: '«Чёрный лак». Полировка и пять слоёв лака — единственный глянцевый цвет. Мелкие царапины будут, честно.',
};
const colorGrps = [$('[data-colors]'), $('[data-colors-buy]')];
const colorNote = $('[data-color-note]');
const buyColor = $('[data-buy-color]');
function applyColor(v, { instant = false, twirl = true } = {}) {
  if (!E5_COLORS[v]) return;
  const changed = v !== demo.color;
  demo.color = v;
  colorGrps.forEach((g) => syncRadio(g, v));
  root.dataset.color = v;
  store.set('oy-e5-color', v);
  colorNote.textContent = COLOR_NOTES[v];
  buyColor.textContent = E5_COLORS[v].label;
  stage?.setBodyColor(v, instant);
  if (!mill.raf) mill.raf = requestAnimationFrame(millLoop);
  if (changed && twirl && !instant && !reducedMode) gsap.fromTo(demo, { twirl: 0 }, { twirl: 1, duration: 1.1, ease: 'power3.inOut', onComplete: () => { demo.twirl = 0; } });
}
colorGrps.forEach((g) => initRadioGroup(g, (v) => applyColor(v)));
function setColors(p) {
  const idx = Math.min(COLOR_ORDER.length - 1, Math.floor(span(p, 0.05, 0.95) * COLOR_ORDER.length));
  if (idx !== demo.colorIdx) { demo.colorIdx = idx; applyColor(COLOR_ORDER[idx]); }
}
const saved = root.dataset.color;
if (saved && saved !== 'blank') { applyColor(saved, { instant: true }); demo.colorIdx = COLOR_ORDER.indexOf(saved); }

/* ---------- ОП 025. Ночь: шов светится в темноте ---------- */

// Люминофор на алюминате стронция: яркость падает быстро в первый час и медленно потом
const glowLeft = (h) => 1 / (1 + h * 0.85);
const hoursIn = $('[data-hours]');
const hoursOut = $('[data-hours-out]');
const glowNote = $('[data-glow-note]');
function paintGlow() {
  const h = demo.hours;
  hoursOut.textContent = String(h).replace('.', ',');
  glowNote.textContent = h === 0 ? 'Свет только что выключили: петлю видно через всю комнату.'
    : h <= 2 ? 'Через пару часов шов всё ещё легко найти на тумбочке, не включая экран.'
      : h <= 5 ? 'Середина ночи: свечение мягкое, но телефон на месте видно.'
        : 'Под утро шов едва светится — но если знать, куда смотреть, найдёте.';
}
hoursIn.addEventListener('input', () => { demo.hours = Number(hoursIn.value); paintGlow(); });
paintGlow();

/* ---------- ОП 100. Купить ---------- */

const curGrp = $('[data-cur]');
const memGrp = $('[data-mem]');
const totalOut = $('[data-total]');
const totalK = $('[data-total-k]');
const totalHex = $('[data-total-hex]');
const CUR = {
  usd: { k: 'США', sym: '$', f: (n) => `$${num(n)}` },
  cad: { k: 'Канада', sym: 'C$', f: (n) => `C$${num(n)}` },
  eur: { k: 'Евросоюз', sym: '€', f: (n) => `€${num(n)}` },
  sek: { k: 'Швеция', sym: 'kr', f: (n) => `${num(n)} kr` },
};
let cur = 'usd';
function paintTotal(animate = true) {
  const mem = memGrp.querySelector('[aria-checked="true"]');
  const total = Number(mem.dataset[cur]);
  totalK.textContent = `Итого · ${CUR[cur].k}`;
  totalHex.textContent = `Fyr пишет: 0x${total.toString(16).toUpperCase()} ${CUR[cur].sym}`;
  if (!animate || reducedMode) { totalOut.textContent = CUR[cur].f(total); return; }
  const from = Number(totalOut.textContent.replace(/[^0-9]/g, '')) || total;
  const o = { v: from };
  gsap.to(o, { v: total, duration: 0.6, ease: 'power2.out', onUpdate: () => { totalOut.textContent = CUR[cur].f(Math.round(o.v)); } });
}
initRadioGroup(curGrp, (v) => { syncRadio(curGrp, v); cur = v; paintTotal(); });
initRadioGroup(memGrp, (v) => { syncRadio(memGrp, v); paintTotal(); });
paintTotal(false);
$('[data-buy]').addEventListener('click', () => toast('Купить здесь нельзя: это концепт. Но брусок был настоящий — у нас в голове.'));

/* ---------- Хореография ---------- */

// Ключи в том порядке, в каком их ставит хореография; ?debug проверяет, что по прокрутке порядок тот же
const keyLog = [];
function checkKeys() {
  const vh = window.innerHeight;
  const order = [...keyLog].sort((a, b) => CHAPTERS.indexOf(a.id) - CHAPTERS.indexOf(b.id) || a.f - b.f);
  const pos = order.map(({ id, f }) => { const s = sts[id]; return { id, f, y: Math.round(f >= 0 ? s.start + f * (s.end - s.start) : s.start + f * vh) }; });
  const bad = [];
  for (let i = 1; i < pos.length; i++) if (pos[i].y < pos[i - 1].y) bad.push([pos[i - 1], pos[i]]);
  return bad;
}

function addKeys(P) {
  // Телефон не исчезает и не летает поверх текста. Во всех главах с телефоном он стоит справа и между
  // соседними главами плавно перетекает из позы в позу, как деталь, которую поворачивают в руке.
  // Где телефона нет (брусок, «Сквозь металл», камеры, покупка), он целиком уезжает за правый край
  // экрана и оттуда же возвращается; гаснет (vis 0) только уже за краем, где его не видно.
  keyLog.length = 0;
  const K = (id, f, props) => { keyLog.push({ id, f }); Keys.add(sts[id], f, props); };
  const out = (pose) => ({ ...pose, x: pose.x + 1.55, ry: pose.ry - 0.5, float: 0 });
  const parked = (pose) => ({ ...out(pose), vis: 0 });
  // уехать перед главой без телефона и стоять за краем
  const away = (id, prev) => { K(id, -0.5, out(prev)); K(id, -0.32, parked(prev)); };
  // приехать справа уже развёрнутым
  const arrive = (id, pose, end) => { K(id, -0.62, parked(pose)); K(id, -0.45, out(pose)); K(id, -0.08, pose); K(id, end, pose); };
  // перетечь из прошлой главы в эту, не уходя с экрана
  const glide = (id, pose, end) => { K(id, 0.04, pose); K(id, end, pose); };
  K('hero', -1, P.hero);
  K('hero', 0, P.hero);
  away('mill', P.hero);
  if (P.mobile) {
    // на телефоне текст глав на подложке уезжает под модель — она уезжает вбок раньше
    for (const id of ['seam', 'glow', 'cesium', 'seal', 'switch', 'torch']) {
      arrive(id, P[id], 0.06);
      K(id, 0.24, out(P[id]));
    }
    K('camera', -0.5, parked(P.seal));
    K('colors', -0.5, parked(P.torch));
  } else {
    arrive('seam', P.seam, 0.3);
    glide('glow', P.glow, 0.45);
    away('resonance', P.glow);
    arrive('cesium', P.cesium, 0.3);
    glide('seal', P.seal, 0.35);
    away('camera', P.seal);
    arrive('switch', P.switch, 0.3);
    glide('torch', P.torch, 0.35);
  }
  // в «Аноде» телефон приходит из «Фонаря» (на телефоне — справа из-за края)
  if (P.mobile) K('colors', -0.45, out(P.colors));
  K('colors', -0.08, P.colors);
  K('colors', 0.7, P.colors);
  away('buy', P.colors);
}

function buildChoreography({ isMobile, reduce }) {
  reducedMode = reduce;
  stage?.setReduced(reduce);
  if (reduce) smooth.disable(); else smooth.enable();
  const SETTERS = { mill: setMill, colors: setColors };

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
  setMill(reduce ? 1 : 0);

  const poses = makePoses(isMobile);
  Keys.reset();
  addKeys(poses);

  if (!reduce) {
    for (const { el, words } of splitHeads) {
      if (el.closest('#hero')) continue;
      gsap.fromTo(words, { yPercent: 110, opacity: 0 }, {
        yPercent: 0, opacity: 1, duration: 0.9, ease: 'power4.out', stagger: 0.05,
        scrollTrigger: { trigger: el, start: 'top 86%', toggleActions: 'play none none reverse' },
      });
    }
    // строки техкарты «печатаются» слева направо
    $$('.e-op').forEach((s) => {
      if (s.closest('#hero')) return;
      gsap.fromTo(s, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.7, ease: 'power2.out', scrollTrigger: { trigger: s, start: 'top 90%', toggleActions: 'play none none none' } });
    });
    $$('[data-reveal], .e-lead, .e-specs div, .e-buy__panel, .e-res__scene, .e-die, .e-loop').forEach((el) => {
      if (el.closest('#hero')) return;
      gsap.fromTo(el, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.85, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none none' } });
    });
  }
  bindOnEnter();
  ScrollTrigger.refresh();
  return () => Keys.reset();
}
ScrollTrigger.addEventListener('refresh', () => { Keys.compile(window.innerHeight); detectChapter(); mill.sawCv = null; });

let enterBound = false;
function bindOnEnter() {
  if (enterBound) return;
  enterBound = true;
  ScrollTrigger.create({ trigger: '.e-bench', start: 'top 85%', once: true, onEnter: () => $('.e-bench').classList.add('is-in') });
  ScrollTrigger.create({ trigger: '[data-view]', start: 'top bottom', end: 'bottom top', onToggle: (st) => { view.visible = st.isActive; if (st.isActive && !view.raf) view.raf = requestAnimationFrame(viewLoop); } });
  ScrollTrigger.create({ trigger: '#mill', start: 'top bottom', end: 'bottom top', onToggle: (st) => { mill.visible = st.isActive; if (st.isActive && !mill.raf) mill.raf = requestAnimationFrame(millLoop); } });
}

/* ---------- Каждый тик: прокрутка → модель ---------- */

let lastY = -1;
let lastDetect = 0;
let dark = 0;
let lastT = performance.now();
function tick() {
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  const y = window.scrollY;
  if (y !== lastY || now - lastDetect > 500) {
    lastY = y;
    lastDetect = now;
    detectChapter();
    const max = document.documentElement.scrollHeight - window.innerHeight;
    paintBar(max > 0 ? clamp01(y / max) : 0);
  }

  const torch = current === 'torch' ? torchLevel(now) : 0;
  const wantDark = current === 'torch' && demo.torch !== 'off' ? 0.82 : 0;
  dark += (wantDark - dark) * (reducedMode ? 1 : 1 - Math.exp(-dt * 4));
  darkEl.style.opacity = dark.toFixed(3);
  root.classList.toggle('e-dark', dark > 0.4);
  if (Keys.empty || !stage) return;
  const v = Keys.sample(y, reducedMode);

  if (demo.twirl) v.spin = ease(demo.twirl) * 2 * PI;
  v.sw = current === 'switch' ? demo.sw : 0;
  v.torch = torch;
  // «Ночь»: свет в сцене гаснет, люминофор шва тускнеет с часами без света
  const night = clamp01(v.glow ?? 0);
  v.glow = night * glowLeft(demo.hours);
  stage.renderer.toneMappingExposure = 1.05 - 0.9 * night;
  const vis = clamp01(v.vis ?? 1);
  canvas.style.opacity = vis.toFixed(3);
  stage.setActive(vis > 0.02 && !document.hidden);
  stage.setTarget(v);
}
gsap.ticker.add(tick);
if (params.has('debug')) window.__e5 = { stage, Keys, ScrollTrigger, sts, demo, mill, res, checkKeys };

window.addEventListener('pointermove', (e) => {
  if (!stage || reducedMode || e.pointerType === 'touch') return;
  stage.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
}, { passive: true });
window.addEventListener('resize', () => { stage?.resize(); lastY = -1; mill.sawCv = null; });

/* ---------- Запуск ---------- */

async function boot() {
  const timeout = (ms) => new Promise((r) => setTimeout(r, ms));
  const fonts = document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve();
  await Promise.race([Promise.all([fonts, stage ? stage.ready : null, timeout(300)]), timeout(12000)]);
  stage?.redrawScreen();

  const mm = gsap.matchMedia();
  mm.add({
    isMobile: '(max-width: 760px)', isDesktop: '(min-width: 761px)',
    reduce: '(prefers-reduced-motion: reduce)', motion: '(prefers-reduced-motion: no-preference)',
  }, (ctx) => buildChoreography(ctx.conditions));

  if (reducedMode) { drawMill(performance.now()); drawView(performance.now()); }

  const loader = $('#loader');
  const hideLoader = () => { loader.classList.add('is-done'); loader.setAttribute('aria-hidden', 'true'); };
  setTimeout(hideLoader, reducedMode ? 0 : 700);
  setTimeout(hideLoader, 1600);
  updateScreen(true);

  // ?og — кадр для превью ссылки (og-0x5e.jpg): без заставки, штампа и бруска, телефон крупнее
  if (params.has('og') && stage) {
    root.classList.add('e-og');
    hideLoader();
    const P = makePoses(false);
    const og = { ...P.hero, x: 0.5, y: 0.02, dist: 5.2, float: 0 };
    Keys.sample = () => og;
    stage.setTarget(og);
    stage.snap();
    return;
  }

  // первый экран: телефон издалека встаёт на место, как деталь, которую вынули из тисков
  if (!reducedMode && stage && window.scrollY < 10) {
    const P = makePoses(window.matchMedia('(max-width: 760px)').matches);
    stage.setTarget(P.far);
    stage.snap();
    const k = { t: 0 };
    let introDone = false;
    const sample = Keys.sample.bind(Keys);
    Keys.sample = (yy, r) => {
      if (!introDone && window.scrollY > 40) { introDone = true; intro?.kill(); Keys.sample = sample; }
      if (introDone) return sample(yy, r);
      const pose = {};
      for (const key in P.hero) pose[key] = P.far[key] + (P.hero[key] - P.far[key]) * k.t;
      return pose;
    };
    let intro = null;
    intro = gsap.to(k, {
      t: 1, duration: 2.2, ease: 'expo.out', delay: 0.6,
      onUpdate: () => { if (window.scrollY > 40) { intro.kill(); introDone = true; Keys.sample = sample; } },
      onComplete: () => { introDone = true; Keys.sample = sample; },
    });
    const hero = splitHeads.find(({ el }) => el.closest('#hero'));
    if (hero) gsap.from(hero.words, { yPercent: 115, opacity: 0, duration: 1.1, ease: 'power4.out', stagger: 0.1, delay: 0.9 });
    gsap.from('.e-hero > *:not(.e-hero__title)', { opacity: 0, y: 20, duration: 0.9, ease: 'power3.out', stagger: 0.08, delay: 1.2 });
    gsap.from('.e-card > div', { opacity: 0, x: 16, duration: 0.6, ease: 'power3.out', stagger: 0.06, delay: 1.4 });
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
