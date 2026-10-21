/* =========================================================================
   OY 0X Butterfly — первый OY от Fyr. Телефон висит на общем холсте, поза
   и состояние модели — ключевые кадры по главам (js/core/keys.js).
   Сцены: сложенный телефон прилетает спинкой; «Раскрытие» — книжка
   раскрывается, а 5,6″ за ней растёт до 7,8″; петля и фонарь «Маяк» в её
   торце; «Глаз» — камера подлетает к кольцу, лепестки закрывают объективы,
   и диафрагма на всё окно закрывает страницу, чтобы открыться уже
   видоискателем; GP10 Semi; двери Citadel 5X; два рубильника; цвета; цена.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage } from '../core/stage.js';
import { createKeys } from '../core/keys.js';
import { createOYButterfly, drawDunes, BF_COLORS } from '../models/oybutterfly.js';
import { $, $$, clamp01, createToast, syncRadio, initRadioGroup, store } from '../core/ui.js';
import { createSmoothScroll } from '../core/scroll.js';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const root = document.documentElement;
const params = new URLSearchParams(location.search);
const toast = createToast($('#toast'), gsap);
const ease = (t) => { const c = clamp01(t); return c * c * (3 - 2 * c); };
const span = (p, a, b) => clamp01((p - a) / (b - a));
const PI = Math.PI;
const fmt = (n, d = 1) => n.toFixed(d).replace('.', ',');

/* ---------- 3D ---------- */

const canvas = $('#stage');
let stage = null;
try {
  stage = createStage(canvas, createOYButterfly, { forceFallback: params.has('fallback') });
} catch (err) {
  console.warn('[OY] WebGL недоступен, 3D отключено.', err);
  canvas.style.display = 'none';
}

/* ---------- Главы ---------- */

const CHAPTERS = ['hero', 'promise', 'unfold', 'screens', 'hinge', 'eye', 'cameras', 'chip', 'citadel', 'switches', 'colors', 'power', 'buy', 'specs'];
const PINNED = { promise: '+=140%', unfold: '+=260%', eye: '+=300%' };
const sections = Object.fromEntries(CHAPTERS.map((id) => [id, document.getElementById(id)]));
const railItems = Object.fromEntries($$('[data-rail-item]').map((a) => [a.dataset.railItem, a]));
const RAIL_OF = { promise: 'hero', specs: 'buy' };
let current = '';
let reducedMode = false;

function detectChapter() {
  const line = window.innerHeight * 0.5;
  let id = CHAPTERS[0];
  for (const c of CHAPTERS) if (sections[c].getBoundingClientRect().top <= line) id = c;
  if (id === current) return;
  railItems[RAIL_OF[current] || current]?.classList.remove('is-on');
  current = id;
  railItems[RAIL_OF[current] || current]?.classList.add('is-on');
  updateScreen();
}

/* ---------- Состояние демо ---------- */

const demo = { color: 'signal', torch: 'off', rub: 0, rub2: 0, door: 'outer', iris: 0, irisManual: null, zoom: 'main', unfold: 1, eye: 0 };
const ZOOM = {
  wide: { z: 0.5, label: '0,5', lens: '0,5× · 13 мм', ev: '50 Мп · 13 мм · f/2.0 · 122°' },
  main: { z: 1, label: '1×', lens: '1× · 24 мм', ev: '50 Мп · 24 мм · f/1.6' },
  tele: { z: 3, label: '3', lens: '3× · 72 мм', ev: '50 Мп · 72 мм · f/2.4' },
  peri: { z: 6, label: '6', lens: '6× · 145 мм', ev: '50 Мп · 145 мм · f/3.2 · призма' },
};

/* ---------- Экраны телефона ---------- */

let lastScreenKey = '';
function updateScreen(force = false) {
  if (!stage) return;
  let mode = 'lock';
  const extra = { rub: demo.rub, rub2: demo.rub2 };
  if (current === 'unfold' || current === 'colors' || current === 'power') mode = 'desk';
  else if (current === 'hinge') { mode = 'torch'; extra.torch = demo.torch === 'off' ? 0 : 1; extra.torchColor = demo.torch === 'red' ? 'red' : 'white'; extra.torchMode = TORCH[demo.torch].mode; }
  else if (current === 'eye' || current === 'cameras') { mode = 'camera'; extra.zlabel = ZOOM[demo.zoom].label; extra.lens = ZOOM[demo.zoom].lens; }
  else if (current === 'citadel') { mode = demo.door === 'outer' ? 'guest' : 'lock'; extra.guest = demo.door === 'outer'; }
  else if (current === 'switches') mode = 'kill';
  const key = mode + JSON.stringify(extra);
  if (key === lastScreenKey && !force) return;
  lastScreenKey = key;
  stage.setScreen(mode, extra);
}

/* ---------- Позы ---------- */

// x/y — доля половины видимой ширины/высоты; fx/fy/fz — точка модели (единицы сцены: мм × 0,01)
const BASE = { x: 0, y: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: 0, rz: 0, dist: 5.2, float: 1, vis: 1, spin: 0, fold: 0, iris: 0, screen: 1, cover: 1 };
// «Глаз» у сложенного телефона: центр кольца со спины (blender/build_oybutterfly.py, модель сдвинута к центру)
const EYE = { fx: 0.026, fy: 0.306, fz: -0.072 };
function makePoses(mobile) {
  const P = {
    far: { x: 0.4, rx: 0.9, ry: PI + 2.4, rz: -0.5, dist: 30, float: 0, fold: 1 },
    hero: { x: 0.4, y: 0.02, rx: 0.12, ry: PI - 0.5, rz: 0.06, dist: 6, fold: 1 },
    hidden: { rx: 0.3, ry: PI - 0.8, dist: 16, float: 0, vis: 0, fold: 1 },
    unfold0: { rx: 0.05, ry: -0.12, dist: 5.4, float: 0.2, fold: 1 },
    unfold1: { rx: 0.04, ry: 0, dist: 5.8, float: 0.2, fold: 0 },
    hinge: { x: 0.34, y: -0.02, rx: 0.22, ry: -0.62, rz: 0.02, dist: 5.6, float: 0.3, fold: 0.38 },
    eye0: { rx: 0.05, ry: PI + 0.2, dist: 4.6, float: 0.2, fold: 1 },
    eye1: { ...EYE, x: 0.3, rx: 0.02, ry: PI, dist: 1.75, float: 0, fold: 1 },
    citadelOut: { x: -0.3, rx: 0.08, ry: 0.3, dist: 4.8, float: 0.5, fold: 1 },
    citadelIn: { x: -0.3, rx: 0.06, ry: 0.22, dist: 6.6, float: 0.5, fold: 0 },
    // сложенный, верхней гранью к нам: оба ползунка у петли лежат рядом
    switches: { x: 0.3, y: 0.1, fx: -0.16, fy: 0.56, rx: 1.05, ry: 0.35, rz: -0.08, dist: 2.3, float: 0.15, fold: 1 },
    colors: { x: -0.3, rx: 0.12, ry: PI + 0.45, rz: -0.05, dist: 4.6, float: 0.6, fold: 1 },
  };
  for (const k in P) P[k] = { ...BASE, ...P[k] };
  if (!mobile) return P;
  // телефон: модель в верхней половине экрана, текст ниже
  for (const k in P) {
    const p = P[k];
    if (k === 'eye1') { P[k] = { ...p, x: 0, y: -0.06, dist: 3.3 }; continue; }
    const wide = p.fold < 0.5;
    P[k] = { ...p, x: 0, y: k === 'unfold0' || k === 'unfold1' ? 0.12 : 0.44, dist: p.dist * (wide ? 2.1 : 1.65) };
  }
  P.hero = { ...P.hero, y: 0.5, dist: 7.2 };
  P.far = { ...P.far, y: 0.5 };
  return P;
}

const Keys = createKeys();
const sts = {};
const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ: window.matchMedia('(prefers-reduced-motion: reduce)') });

/* ---------- Заголовки по словам ---------- */

function splitWords(el) {
  const words = [];
  const walk = (node) => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const part of n.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part) && !part.includes(' ')) { frag.append(part); continue; }
          const w = document.createElement('span');
          w.className = 'bf-w';
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

/* ---------- Диафрагма: лепестки для лоадера и для всего окна ---------- */

// та же геометрия, что у модели: 16 лепестков — кольцевые секторы 19,7–25,0 мм на 120°,
// ось на 22,35 мм; поворот на 64° закрывает окно радиусом 19,6 мм целиком
const IRIS = { n: 16, r0: 19.7, r1: 25, pivot: 22.35, span: 120, close: 64, aperture: 19.6 };
function irisPaths(c, k = 1) {
  const th = (IRIS.close * ease(c) * PI) / 180;
  const out = [];
  for (let i = 0; i < IRIS.n; i++) {
    const phi = (2 * PI * i) / IRIS.n;
    const sp = (IRIS.span * PI) / 180;
    const px = IRIS.pivot * Math.cos(phi), py = IRIS.pivot * Math.sin(phi);
    const pts = [];
    for (let j = 0; j <= 24; j++) { const a = phi + (sp * j) / 24; pts.push([IRIS.r1 * Math.cos(a), IRIS.r1 * Math.sin(a)]); }
    for (let j = 24; j >= 0; j--) { const a = phi + (sp * j) / 24; pts.push([IRIS.r0 * Math.cos(a), IRIS.r0 * Math.sin(a)]); }
    const cs = Math.cos(th), sn = Math.sin(th);
    const d = pts.map(([x, y]) => {
      const rx = px + (x - px) * cs - (y - py) * sn, ry = py + (x - px) * sn + (y - py) * cs;
      return `${(rx * k).toFixed(2)} ${(-ry * k).toFixed(2)}`;
    });
    out.push(`<path d="M${d.join('L')}Z"/>`);
  }
  return out.join('');
}

const wipe = $('[data-wipe]');
let wipeLevel = -1;
function setWipe(c) {
  c = clamp01(c);
  if (Math.abs(c - wipeLevel) < 0.002) return;
  wipeLevel = c;
  wipe.style.visibility = c > 0.001 ? 'visible' : 'hidden';
  if (c <= 0.001) return;
  const w = window.innerWidth, h = window.innerHeight;
  const k = (Math.hypot(w, h) / 2 / IRIS.aperture) * 1.04;
  wipe.setAttribute('viewBox', `${-w / 2} ${-h / 2} ${w} ${h}`);
  wipe.innerHTML = irisPaths(c, k);
}

const loaderIris = $('[data-loader-iris]');
loaderIris.innerHTML = irisPaths(1, 1.05) + '<circle r="27"/>';

/* ---------- 1. Обещание: слова по прокрутке ---------- */

const promiseWords = (() => {
  const el = $('[data-scrub-words]');
  const words = splitWords(el);
  words.forEach((w) => w.parentElement.classList.add('w'));
  return words.map((w) => w.parentElement);
})();
function setPromise(p) {
  const n = Math.round(span(p, 0.05, 0.8) * promiseWords.length);
  promiseWords.forEach((w, i) => w.classList.toggle('is-on', i < n));
}

/* ---------- 2. Раскрытие: 5,6″ → 7,8″ ---------- */

const diagOut = $('[data-diag]');
const thickOut = $('[data-thick]');
const angleOut = $('[data-angle]');
const stateOut = $('[data-unfold-state]');
const unfoldL = $('[data-unfold-l]');
const unfoldR = $('[data-unfold-r]');
function setUnfold(p) {
  const t = ease(span(p, 0.12, 0.72));
  demo.unfold = 1 - t;
  diagOut.textContent = fmt(5.6 + 2.2 * t);
  thickOut.textContent = fmt(9.9 - 5.3 * t);
  angleOut.textContent = String(Math.round(180 * t));
  stateOut.textContent = t < 0.02 ? 'сложен' : t > 0.98 ? 'раскрыт' : 'раскрывается';
  unfoldL.style.opacity = (1 - span(p, 0.1, 0.35)).toFixed(3);
  unfoldR.style.opacity = span(p, 0.62, 0.85).toFixed(3);
}

/* ---------- 5. «Глаз»: кольцо поворачивается ---------- */

const eyeArc = $('[data-eye-arc]');
const eyeDeg = $('[data-eye-deg]');
const eyeState = $('[data-eye-state]');
const eyeSteps = $$('[data-step-at]');
const irisBtn = $('[data-iris-toggle]');
function paintDial(c) {
  // дуга шкалы: полный круг — 60°, как ход кольца
  eyeArc.style.strokeDashoffset = (327 * (1 - c)).toFixed(1);
  eyeDeg.textContent = `${Math.round(60 * c)}°`;
  eyeState.textContent = c < 0.02 ? 'открыт' : c > 0.98 ? 'закрыт' : 'закрывается';
}
function setEye(p) {
  // модель сама сглаживает ход лепестков — здесь линейно
  const c = span(p, 0.22, 0.66);
  demo.eye = c;
  if (demo.irisManual === null) paintDial(c);
  eyeSteps.forEach((li) => li.classList.toggle('is-on', p >= Number(li.dataset.stepAt)));
  // в конце главы диафрагма закрывает всё окно
  setWipe(reducedMode ? 0 : span(p, 0.8, 0.99));
}
irisBtn.addEventListener('click', () => {
  const close = irisBtn.getAttribute('aria-pressed') !== 'true';
  irisBtn.setAttribute('aria-pressed', String(close));
  irisBtn.textContent = close ? 'Открыть глаз' : 'Закрыть глаз';
  const from = demo.irisManual ?? demo.eye;
  const o = { v: from };
  gsap.to(o, {
    v: close ? 1 : 0, duration: reducedMode ? 0 : 1.4, ease: 'power2.inOut',
    onUpdate: () => { demo.irisManual = o.v; paintDial(o.v); },
  });
  toast(close ? 'Глаз закрыт. Citadel 5X обесточил четыре камеры.' : 'Глаз открыт. Камеры снова под питанием.');
});

/* ---------- 6. Камеры: видоискатель ---------- */

const vfCanvas = $('[data-vf-scene]');
const vfEv = $('[data-vf-ev]');
const zoomGrp = $('[data-zoom]');
const camCards = Object.fromEntries($$('[data-cam]').map((c) => [c.dataset.cam, c]));
const vf = { s: 1, ts: 1, raf: 0, visible: false };
const vfScale = (z) => Math.pow(z / 0.5, 0.62);
// караван на гребне дальней дюны у солнца: на 0,5× его почти не видно, на 6× — пять верблюдов
function drawCaravan(g, w, h, t) {
  const ridge = (u) => h * (0.6 + 0.035 * Math.sin(u * 5.2 + 0.4 + t * 0.05) + 0.035 * 0.35 * Math.sin(u * 5.2 * 2.3 + 0.4));
  const s = h * 0.0045;
  g.fillStyle = '#2A1A14';
  g.strokeStyle = '#2A1A14';
  g.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const u = 0.575 + i * 0.016 + ((t * 0.0016) % 0.02);
    const x = w * u, y = ridge(u) - s * 5.2;
    const step = Math.sin(t * 3 + i * 1.3) * s * 0.9;
    g.lineWidth = s * 0.55;
    for (const [dx, k] of [[-2.2, 1], [-1.4, -1], [1.4, 1], [2.2, -1]]) {
      g.beginPath(); g.moveTo(x + dx * s, y + s); g.lineTo(x + dx * s + step * k, y + 5 * s); g.stroke();
    }
    g.beginPath(); g.ellipse(x, y, s * 3.2, s * 1.5, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(x - s * 0.4, y - s * 1.3, s * 1.5, s * 1.2, 0, Math.PI, 0); g.fill();
    g.lineWidth = s * 0.9;
    g.beginPath(); g.moveTo(x + s * 2.8, y - s * 0.3); g.lineTo(x + s * 3.9, y - s * 2.6); g.lineTo(x + s * 4.9, y - s * 2.5); g.stroke();
  }
}
function drawVf(now = performance.now()) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(vfCanvas.clientWidth * dpr), h = Math.round(vfCanvas.clientHeight * dpr);
  if (!w || !h) return;
  if (vfCanvas.width !== w || vfCanvas.height !== h) { vfCanvas.width = w; vfCanvas.height = h; }
  const g = vfCanvas.getContext('2d');
  vf.s += (vf.ts - vf.s) * (reducedMode ? 1 : 0.12);
  g.save();
  g.translate(w * 0.62, h * 0.6);
  g.scale(vf.s, vf.s);
  g.translate(-w * 0.62, -h * 0.6);
  drawDunes(g, w, h, { accent: BF_COLORS[demo.color].ui, t: now / 1000 });
  drawCaravan(g, w, h, now / 1000);
  g.restore();
  // сверхширокая: лёгкая виньетка по краям
  const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, `rgba(0,0,0,${demo.zoom === 'wide' ? 0.45 : 0.25})`);
  g.fillStyle = vg;
  g.fillRect(0, 0, w, h);
}
function vfLoop(now) {
  vf.raf = 0;
  if (!vf.visible || document.hidden) return;
  drawVf(now);
  vf.raf = requestAnimationFrame(vfLoop);
}
initRadioGroup(zoomGrp, (v) => {
  syncRadio(zoomGrp, v);
  demo.zoom = v;
  vf.ts = vfScale(ZOOM[v].z);
  vfEv.textContent = ZOOM[v].ev;
  for (const k in camCards) camCards[k].classList.toggle('is-on', k === v);
  updateScreen();
  if (!vf.raf && vf.visible) vf.raf = requestAnimationFrame(vfLoop);
});
vf.s = vf.ts = vfScale(1);
camCards.main.classList.add('is-on');

/* ---------- 4. Фонарь «Маяк» в петле ---------- */

const TORCH = {
  off: { mode: 'выключен', note: 'Фонарь выключен. Нажмите «Белый».' },
  white: { mode: 'свет из петли · 900 лм', note: '900 люмен, белый. Светит вверх из торца петли.' },
  red: { mode: 'красный · бережёт ночное зрение', note: 'Красный: глаза не перестраиваются, звёзды остаются видны.' },
  beacon: { mode: '«Маяк» · Fl(2) 6s', note: '«Маяк»: две вспышки каждые шесть секунд, как у настоящего маяка.' },
  sos: { mode: 'SOS · ··· ——— ···', note: 'SOS азбукой Морзе. Видно за несколько километров.' },
};
const torchGrp = $('[data-torch]');
const torchNote = $('[data-torch-note]');
const darkEl = $('[data-dark]');
initRadioGroup(torchGrp, (v) => {
  syncRadio(torchGrp, v);
  demo.torch = v;
  torchNote.textContent = TORCH[v].note;
  stage?.setTorchColor(v === 'red' ? 'red' : 'white');
  updateScreen();
});
const SOS = [1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0];
function torchLevel(now) {
  if (demo.torch === 'off') return 0;
  if (demo.torch === 'beacon') { const t = (now / 1000) % 6; return (t < 0.35 || (t > 0.9 && t < 1.25)) ? 1 : 0; }
  if (demo.torch === 'sos') return SOS[Math.floor(now / 220) % SOS.length];
  return 1;
}

/* ---------- 7. GP10 Semi: ядра ---------- */

function runCores() {
  const bars = $$('[data-cores] i');
  const heights = bars.map((b) => (b.classList.contains('is-big') ? 1 : b.classList.contains('is-perf') ? 0.85 : 0.61));
  bars.forEach((b, i) => setTimeout(() => b.style.setProperty('--h', heights[i]), reducedMode ? 0 : i * 70));
  const out = $('[data-ghz]');
  const o = { v: 0 };
  gsap.to(o, { v: 4.6, duration: reducedMode ? 0 : 1.8, ease: 'power3.out', onUpdate: () => { out.textContent = fmt(o.v); } });
}

/* ---------- 8. Citadel 5X: две двери ---------- */

const doorsGrp = $('[data-doors]');
const doorsNote = $('[data-doors-note]');
initRadioGroup(doorsGrp, (v) => {
  syncRadio(doorsGrp, v);
  demo.door = v;
  doorsNote.textContent = v === 'outer'
    ? 'Снаружи открыта гостевая дверь. Внутренняя заперта.'
    : 'Телефон раскрыт, «Шарнир» отдал ключи внутренней двери. Её PIN и палец — другие.';
  updateScreen();
  rebuildPoses();
});

/* ---------- 9. Рубильники ---------- */

const rubItems = $$('[data-rub-list] li');
function paintRubs() {
  rubItems.forEach((li) => {
    const off = demo[li.dataset.rubKey] >= Number(li.dataset.at);
    li.classList.toggle('is-off', off);
    li.querySelector('b').textContent = off ? 'обесточено' : 'вкл';
  });
}
$$('[data-rub]').forEach((grp) => initRadioGroup(grp, (v) => {
  syncRadio(grp, v);
  demo[grp.dataset.rub] = Number(v);
  paintRubs();
  updateScreen();
}));

/* ---------- 10. Цвета ---------- */

const COLOR_NOTES = {
  signal: ['Сигнальный Красный', '«Сигнальный Красный». Главный цвет OY со времён первого 0X0: его видно издалека, как сигнальный огонь.'],
  morpho: ['Морфо', '«Морфо». Глубокий синий, который переливается в фиолетовый, когда поворачиваешь телефон.'],
  swallowtail: ['Махаон', '«Махаон». Сливочно-жёлтая спинка, чёрные рамка, кольцо и петля.'],
  cabbage: ['Капустница', '«Капустница». Молочно-белая спинка и серебро. Самый тихий из четырёх.'],
  admiral: ['Адмирал', '«Адмирал». Чёрный, а петля — красная, как полоса на крыле.'],
};
const colorGrps = [$('[data-colors]'), $('[data-colors-buy]')];
const colorNote = $('[data-color-note]');
const buyColor = $('[data-buy-color]');
function applyColor(v, instant = false) {
  if (!BF_COLORS[v]) return;
  demo.color = v;
  colorGrps.forEach((g) => syncRadio(g, v));
  root.dataset.color = v;
  store.set('oy-bf-color', v);
  colorNote.textContent = COLOR_NOTES[v][1];
  buyColor.textContent = COLOR_NOTES[v][0];
  stage?.setBodyColor(v, instant);
}
colorGrps.forEach((g) => initRadioGroup(g, (v) => applyColor(v)));
const saved = root.dataset.color;
if (saved && saved !== 'signal') applyColor(saved, true);

/* ---------- 12. Цена: hex по нажатию ---------- */

const memGrp = $('[data-mem]');
const HEX = '0123456789ABCDEF';
const toHex = (n) => '0x' + n.toString(16).toUpperCase();
function bindHex(b, dec, hex) {
  b.firstChild.textContent = dec;
  b.setAttribute('aria-label', `${dec}, в шестнадцатеричной — ${hex}`);
  let tip = b.querySelector('.bf-hex__tip');
  if (!tip) { tip = document.createElement('span'); tip.className = 'bf-hex__tip'; tip.setAttribute('aria-hidden', 'true'); b.append(tip); }
  tip.innerHTML = `<small>как пишет Fyr</small>${hex}`;
}
function scramble(b, target, delay = 0) {
  if (reducedMode) { b.firstChild.textContent = target; return; }
  const o = { t: 0 };
  gsap.to(o, {
    t: 1, duration: 0.8, delay, ease: 'power2.out',
    onUpdate: () => {
      const keep = Math.floor(o.t * target.length);
      b.firstChild.textContent = [...target].map((ch, i) => (i < keep || !/[0-9]/.test(ch) ? ch : HEX[(Math.random() * 10) | 0])).join('');
    },
    onComplete: () => { b.firstChild.textContent = target; },
  });
}
function paintPrices(animate = true) {
  const btn = memGrp.querySelector('[aria-checked="true"]');
  const vals = { usd: `$${btn.dataset.usd}`, eur: `€${btn.dataset.eur}`, sek: `${btn.dataset.sek} kr` };
  const hexes = { usd: `${toHex(+btn.dataset.usd)} $`, eur: `${toHex(+btn.dataset.eur)} €`, sek: `${toHex(+btn.dataset.sek.replace(/\s/g, ''))} kr` };
  $$('[data-prices] .bf-hex').forEach((b, i) => {
    bindHex(b, vals[b.dataset.cur], hexes[b.dataset.cur]);
    if (animate) scramble(b, vals[b.dataset.cur], i * 90);
  });
}
initRadioGroup(memGrp, (v) => { syncRadio(memGrp, v); paintPrices(); });
$$('.bf-hex').forEach((b) => {
  if (!b.firstChild || b.firstChild.nodeType !== 3) b.prepend(document.createTextNode(b.textContent));
  if (b.dataset.hex) bindHex(b, b.firstChild.textContent.trim(), b.dataset.hex);
  b.addEventListener('click', () => {
    const open = !b.classList.contains('is-open');
    $$('.bf-hex').forEach((o) => o.classList.remove('is-open'));
    b.classList.toggle('is-open', open);
  });
});
paintPrices(false);
$('[data-buy]').addEventListener('click', () => toast('Купить здесь нельзя: это концепт. Но выбор вы сделали правильный.'));

// подсветка плиток под курсором
$$('.bf-tile').forEach((t) => t.addEventListener('pointermove', (e) => {
  const r = t.getBoundingClientRect();
  t.style.setProperty('--mx', `${e.clientX - r.left}px`);
  t.style.setProperty('--my', `${e.clientY - r.top}px`);
}));

/* ---------- Хореография ---------- */

let poses = null;
function rebuildPoses() {
  if (!poses) return;
  Keys.reset();
  addKeys(poses);
  Keys.compile(window.innerHeight);
}
function addKeys(P) {
  const K = (id, f, props) => Keys.add(sts[id], f, props);
  const hold = (id, pose) => { K(id, -0.4, pose); K(id, 0.3, pose); };
  K('hero', -1, P.hero);
  K('hero', 0, P.hero);
  K('hero', 0.6, { ...P.hero, ry: P.hero.ry + 0.6, dist: P.hero.dist + 1.2 });
  hold('promise', P.hidden);
  K('promise', 1, P.hidden);
  K('unfold', -0.35, P.unfold0);
  K('unfold', 0, P.unfold0);
  K('unfold', 0.72, P.unfold1);
  K('unfold', 1, P.unfold1);
  hold('screens', { ...P.unfold1, vis: 0, dist: 9, fold: 0 });
  K('hinge', -0.45, P.hinge);
  K('hinge', 0.6, { ...P.hinge, ry: P.hinge.ry + 0.25 });
  K('eye', -0.4, P.eye0);
  K('eye', 0, P.eye0);
  K('eye', 0.2, P.eye1);
  K('eye', 0.8, P.eye1);
  K('eye', 0.98, { ...P.eye1, vis: 0 });
  K('eye', 1, { ...P.eye1, vis: 0 });
  hold('cameras', { ...P.hidden });
  hold('chip', P.hidden);
  const cit = demo.door === 'outer' ? P.citadelOut : P.citadelIn;
  K('citadel', -0.4, cit);
  K('citadel', 0.5, cit);
  K('switches', -0.4, P.switches);
  K('switches', 0.5, P.switches);
  K('colors', -0.4, P.colors);
  K('colors', 0.6, { ...P.colors, ry: P.colors.ry + 0.3 });
  hold('power', P.hidden);
  hold('buy', P.hidden);
  K('specs', 1, P.hidden);
}

function buildChoreography({ isMobile, reduce }) {
  reducedMode = reduce;
  stage?.setReduced(reduce);
  if (reduce) smooth.disable(); else smooth.enable();
  const SETTERS = { promise: setPromise, unfold: setUnfold, eye: setEye };

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
  if (reduce) { setPromise(1); setUnfold(1); setEye(0); }

  // гигантская надпись на первом экране расходится крыльями
  ScrollTrigger.create({
    trigger: sections.hero, start: 'top top', end: 'bottom top',
    onUpdate: (st) => {
      if (reduce) return;
      const [a, b] = $$('[data-mega] span');
      a.style.transform = `translateX(${-st.progress * 30}vw)`;
      b.style.transform = `translateX(${st.progress * 30}vw)`;
    },
  });
  // в «Камерах» диафрагма на всё окно открывается обратно
  ScrollTrigger.create({
    trigger: sections.cameras, start: 'top bottom', end: 'top 20%',
    onUpdate: (st) => { if (!reduce && current !== 'eye') setWipe(1 - ease(st.progress)); },
    onLeave: () => setWipe(0),
    onLeaveBack: () => { if (!reduce) setWipe(1); },
  });

  poses = makePoses(isMobile);
  Keys.reset();
  addKeys(poses);

  if (!reduce) {
    for (const { el, words } of splitHeads) {
      if (el.closest('#hero')) continue;
      gsap.fromTo(words, { yPercent: 110, opacity: 0 }, {
        yPercent: 0, opacity: 1, duration: 0.95, ease: 'power4.out', stagger: 0.05,
        scrollTrigger: { trigger: el, start: 'top 86%', toggleActions: 'play none none reverse' },
      });
    }
    $$('.bf-lead, .bf-fact, .bf-cam, .bf-frontcard, .bf-feats li, .bf-specs div, .bf-pillcard, .bf-buy__panel, .bf-tags li').forEach((el) => {
      gsap.fromTo(el, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.85, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none none' } });
    });
    $$('.bf-bento').forEach((g) => gsap.fromTo($$('.bf-tile', g), { y: 60, opacity: 0, scale: 0.96 }, {
      y: 0, opacity: 1, scale: 1, duration: 0.9, ease: 'power3.out', stagger: 0.08,
      scrollTrigger: { trigger: g, start: 'top 85%', toggleActions: 'play none none none' },
    }));
  }
  bindOnEnter(reduce);
  ScrollTrigger.refresh();
  return () => Keys.reset();
}
ScrollTrigger.addEventListener('refresh', () => { Keys.compile(window.innerHeight); detectChapter(); });

let enterBound = false;
function bindOnEnter() {
  if (enterBound) return;
  enterBound = true;
  ScrollTrigger.create({ trigger: '[data-sizes]', start: 'top 80%', once: true, onEnter: () => $('[data-sizes]').classList.add('is-in') });
  ScrollTrigger.create({ trigger: '[data-cores]', start: 'top 78%', once: true, onEnter: runCores });
  ScrollTrigger.create({ trigger: '[data-vf]', start: 'top bottom', end: 'bottom top', onToggle: (st) => { vf.visible = st.isActive; if (st.isActive && !vf.raf) vf.raf = requestAnimationFrame(vfLoop); } });
  ScrollTrigger.create({ trigger: '[data-prices]', start: 'top 85%', once: true, onEnter: () => paintPrices(true) });
}

/* ---------- Каждый тик: прокрутка → модель ---------- */

const progressBar = $('[data-progress]');
let lastY = -1;
let dark = 0;
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
  const torch = current === 'hinge' ? torchLevel(now) : 0;
  const wantDark = current === 'hinge' && demo.torch !== 'off' ? 0.82 : 0;
  dark += (wantDark - dark) * (reducedMode ? 1 : 1 - Math.exp(-dt * 4));
  darkEl.style.opacity = dark.toFixed(3);
  if (Keys.empty || !stage) return;
  const v = Keys.sample(y, reducedMode);
  if (current === 'unfold') v.fold = demo.unfold;
  const irisNow = demo.irisManual ?? (current === 'eye' ? demo.eye : 0);
  v.iris = irisNow;
  v.rub = current === 'switches' ? demo.rub : 0;
  v.rub2 = current === 'switches' ? demo.rub2 : 0;
  v.torch = torch;
  if (current === 'colors' && !reducedMode) v.spin = Math.sin(now / 1600) * 0.45;
  const vis = clamp01(v.vis ?? 1);
  canvas.style.opacity = vis.toFixed(3);
  stage.setActive(vis > 0.02 && !document.hidden);
  stage.setTarget(v);
}
gsap.ticker.add(tick);
if (params.has('debug')) window.__bf = { stage, Keys, ScrollTrigger, sts, demo };

window.addEventListener('pointermove', (e) => {
  if (!stage || reducedMode || e.pointerType === 'touch') return;
  stage.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
}, { passive: true });
window.addEventListener('resize', () => { stage?.resize(); const c = wipeLevel; wipeLevel = -1; setWipe(Math.max(0, c)); });

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

  // лоадер: диафрагма раскрывается
  const loader = $('#loader');
  const hideLoader = () => { loader.classList.add('is-done'); loader.setAttribute('aria-hidden', 'true'); };
  const o = { c: 1 };
  gsap.to(o, {
    c: 0, duration: reducedMode ? 0 : 0.9, ease: 'power2.inOut',
    onUpdate: () => { loaderIris.innerHTML = irisPaths(o.c, 1.05) + '<circle r="27"/>'; },
    onComplete: hideLoader,
  });
  // в фоновой вкладке кадры почти не идут — лоадер не должен ждать анимацию
  setTimeout(hideLoader, 1200);
  updateScreen(true);

  // первый экран: телефон прилетает из глубины, крылья надписи раскрываются
  if (!reducedMode && stage && window.scrollY < 10) {
    const P = makePoses(window.matchMedia('(max-width: 760px)').matches);
    stage.setTarget(P.far);
    stage.snap();
    gsap.ticker.remove(tick);
    const k = { t: 0 };
    const intro = gsap.to(k, {
      t: 1, duration: 2.4, ease: 'power3.out', delay: 0.5,
      onUpdate: () => {
        if (window.scrollY > 40) { intro.kill(); gsap.ticker.add(tick); return; }
        const pose = {};
        for (const key in P.hero) pose[key] = P.far[key] + (P.hero[key] - P.far[key]) * k.t;
        stage.setTarget(pose);
      },
      onComplete: () => gsap.ticker.add(tick),
    });
    gsap.from('[data-mega] span', { opacity: 0, scale: 1.25, filter: 'blur(30px)', duration: 2, ease: 'power3.out', stagger: 0.15, delay: 0.4 });
    const hero = splitHeads.find(({ el }) => el.closest('#hero'));
    if (hero) gsap.from(hero.words, { yPercent: 115, opacity: 0, duration: 1.1, ease: 'power4.out', stagger: 0.08, delay: 0.9 });
    gsap.from('.bf-hero__side > *, .bf-hero__model, .bf-hero > .bf-eyebrow', { opacity: 0, y: 20, duration: 0.9, ease: 'power3.out', stagger: 0.08, delay: 1.3 });
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
