/* =========================================================================
   OY 0X4 — пять семьдесят пять. Страница-чертёж на миллиметровке.
   Телефон висит на общем холсте: влетает ребром, как лезвие, в «Профиле»
   встаёт ребром к вам, рядом толщины всех OY в масштабе. «Стопка» — карты,
   листы, монеты или карандаш растут до черты 5,75 мм. «Разрез» — восемь
   слоёв разлетаются и складываются. Честный график дня на 4000 мАч,
   видоискатель 0,5× · 1× · 2× · 4× · макро с кадром на сенсоре 200 Мп,
   двадцать ядер GP20, «Водяной знак» Citadel 6 Slim, «Рубильник», фонарь,
   цвета, калькулятор цены. Прогресс — штангенциркуль внизу экрана.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage } from '../core/stage.js';
import { createKeys } from '../core/keys.js';
import { createOY0X4, X4_COLORS, drawHarbor } from '../models/oy0x4.js';
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
const num = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const pad2 = (n) => String(n).padStart(2, '0');

/* ---------- 3D ---------- */

const canvas = $('#stage');
let stage = null;
try {
  stage = createStage(canvas, createOY0X4, { forceFallback: params.has('fallback') });
} catch (err) {
  console.warn('[OY] WebGL недоступен, 3D отключено.', err);
  canvas.style.display = 'none';
}

/* ---------- Главы и штангенциркуль ---------- */

const CHAPTERS = ['hero', 'profile', 'stack', 'layers', 'battery', 'camera', 'chip', 'citadel', 'switch', 'torch', 'colors', 'buy', 'specs'];
const PINNED = { profile: '+=200%', stack: '+=220%', layers: '+=240%', colors: '+=260%' };
const sections = Object.fromEntries(CHAPTERS.map((id) => [id, document.getElementById(id)]));
const ticks = $$('[data-tick]');
const TICK_OF = { specs: 'buy' };
let current = '';
let reducedMode = false;

function detectChapter() {
  const line = window.innerHeight * 0.5;
  let id = CHAPTERS[0];
  for (const c of CHAPTERS) if (sections[c].getBoundingClientRect().top <= line) id = c;
  if (id === current) return;
  current = id;
  const on = TICK_OF[id] || id;
  const idx = ticks.findIndex((a) => a.dataset.tick === on);
  ticks.forEach((a, i) => { a.classList.toggle('is-on', i === idx); a.classList.toggle('is-past', i < idx); });
  updateScreen();
}

const calSlider = $('[data-cal-slider]');
const calMm = $('[data-cal-mm]');
const calEl = $('[data-cal]');
function paintCaliper(f) {
  calSlider.style.transform = `translateX(${(f * Math.max(0, calEl.clientWidth - 10)).toFixed(1)}px)`;
  // губка проходит телефон по всей высоте: 0 → 151,2 мм
  calMm.textContent = fmt(f * 151.2);
}

/* ---------- Состояние демо ---------- */

const demo = {
  color: 'grifel', colorIdx: 0, torch: 'off', sw: 0, reveal: false, edited: false,
  pct: 22, clock: '23:30', profile: 'обычный день', twirl: 0,
};

/* ---------- Экран телефона ---------- */

let lastScreenKey = '';
function updateScreen(force = false) {
  if (!stage) return;
  let mode = 'lock';
  const extra = { sw: demo.sw, pct: 81 };
  if (current === 'battery') { mode = 'battery'; Object.assign(extra, { pct: demo.pct, clock: demo.clock, profile: demo.profile }); }
  else if (current === 'chip') mode = 'boot';
  else if (current === 'citadel') { mode = 'citadel'; Object.assign(extra, { reveal: demo.reveal, edited: demo.edited }); }
  else if (current === 'switch') mode = 'switch';
  else if (current === 'torch') { mode = 'torch'; extra.torch = demo.torch === 'off' ? 0 : 1; extra.torchColor = demo.torch === 'red' ? 'red' : 'white'; extra.torchMode = TORCH[demo.torch].mode; }
  const key = mode + JSON.stringify(extra);
  if (key === lastScreenKey && !force) return;
  lastScreenKey = key;
  stage.setScreen(mode, extra);
}

/* ---------- Позы ---------- */

// x/y — доля половины видимой ширины/высоты; fx/fy/fz — точка модели (единицы сцены: мм × 0,01)
const BASE = { x: 0, y: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: 0, rz: 0, dist: 5.4, float: 1, vis: 1, spin: 0, sw: 0, torch: 0, screen: 1 };
const SW_Y = 0.356;          // «Рубильник» по высоте
function makePoses(mobile) {
  const P = {
    // влетает ребром: сначала видна только тонкая линия
    far: { x: 0.1, rx: 0.02, ry: PI / 2, rz: 0.4, dist: 26, float: 0 },
    hero: { x: 0.36, y: 0.02, rx: 0.08, ry: PI - 0.45, rz: 0.05, dist: 5.6 },
    // ребро с «Рубильником» к вам, потом чуть повернуть — видно, как тонко
    profile0: { x: 0.06, rx: 0.03, ry: PI / 2 - 0.02, rz: 0, dist: 4.6, float: 0.3 },
    profile1: { x: 0.06, rx: 0.18, ry: PI / 2 + 0.5, rz: 0.04, dist: 4.4, float: 0.3 },
    battery: { x: -0.3, rx: 0.05, ry: 0.3, rz: -0.03, dist: 4.9 },
    chip: { x: 0.3, rx: 0.06, ry: -0.3, rz: 0.02, dist: 4.9 },
    citadel: { x: -0.3, rx: 0.05, ry: 0.32, rz: -0.03, dist: 4.7 },
    switch: { x: 0.26, fy: SW_Y - 0.08, rx: 0.06, ry: PI / 2 - 0.42, rz: 0, dist: 3.4, float: 0.3 },
    torch: { x: -0.28, y: 0.02, fy: 0.5, rx: 0.85, ry: 0.42, rz: -0.06, dist: 3.6, float: 0.15 },
    colors: { x: 0.28, rx: 0.1, ry: PI - 0.4, rz: 0.04, dist: 5 },
    hidden: { rx: 0.3, ry: PI - 0.8, dist: 16, float: 0, vis: 0 },
  };
  for (const k in P) P[k] = { ...BASE, ...P[k] };
  if (!mobile) return P;
  // телефон: модель в верхней половине экрана, текст ниже
  for (const k in P) {
    const p = P[k];
    if (k.startsWith('profile')) { P[k] = { ...p, x: 0.42, y: 0.12, dist: p.dist * 2.1 }; continue; }
    P[k] = { ...p, x: 0, y: 0.5, dist: p.dist * (p.dist < 3 ? 2.7 : 1.9) };
  }
  P.hero = { ...P.hero, x: 0.38, y: 0.6, dist: 13 };
  P.far = { ...P.far, y: 0.45 };
  P.mobile = true;
  return P;
}

const Keys = createKeys();
const sts = {};
const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ: window.matchMedia('(prefers-reduced-motion: reduce)') });

/* ---------- Лист на сквозняке ---------- */

// телефон чуть колышется, как лист бумаги: на первом экране и в цветах
function flutter(t, amp) {
  if (amp <= 0.001) return null;
  return {
    ry: Math.sin(t * 0.7) * 0.28 * amp,
    rx: Math.sin(t * 1.1 + 1) * 0.06 * amp,
    rz: Math.sin(t * 0.9 + 0.4) * 0.05 * amp,
  };
}

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

/* ---------- 1. Профиль: толщины OY ---------- */

const gauge = $('[data-gauge]');
const gaugeName = $('[data-gauge-name]');
const profileItems = $$('[data-profiles] li');
const PROFILES = profileItems.map((li) => ({ mm: Number(li.style.getPropertyValue('--mm')), name: li.querySelector('b').textContent.replace(/\s+/g, ' ') }));
const YEAR = ['2027', '2028', '2029', '2029', '2032', '2030', '2031', '2032'];
function setProfile(p) {
  const f = span(p, 0.05, 0.85) * (PROFILES.length - 1);
  const i = Math.min(PROFILES.length - 2, Math.floor(f));
  const k = ease(f - i);
  const mm = PROFILES[i].mm + (PROFILES[i + 1].mm - PROFILES[i].mm) * k;
  const shown = Math.round(f);
  gauge.textContent = fmt(mm, 2);
  gaugeName.textContent = `OY ${PROFILES[shown].name} · ${YEAR[shown]}`;
  profileItems.forEach((li, j) => li.classList.toggle('is-on', j <= shown));
}

/* ---------- 2. Стопка ---------- */

const MEASURES = {
  card: { t: 0.76, what: (n) => (n === 1 ? 'карта' : 'карт'), note: 'Банковская карта — 0,76 мм. Сложите семь с половиной — это 0X4.', d: 1 },
  paper: { t: 0.1, what: () => 'листов', note: 'Офисный лист — 0,1 мм. Пятьдесят семь с половиной листов: тонкая тетрадь.', d: 1 },
  coin: { t: 2.33, what: () => 'монеты', note: 'Монета в 1 € — 2,33 мм. Две с половиной монеты — и всё, телефон кончился.', d: 1 },
  pencil: { t: 7, what: () => 'карандаша', note: 'Обычный карандаш — 7 мм. 0X4 тоньше на 1,25 мм: не каждый карандаш пролезет туда, куда пролезет 0X4.', d: 2 },
};
const measureGrp = $('[data-measure]');
const pile = $('[data-pile]');
const stackN = $('[data-stack-n]');
const stackWhat = $('[data-stack-what]');
const stackNote = $('[data-stack-note]');
const stackMm = $('[data-stack-mm]');
let measure = 'card';
let pileItems = [];
let stackP = 0;
function buildPile() {
  const m = MEASURES[measure];
  // карандаш — один, остальные — сколько поместится до черты и ещё одна
  const n = measure === 'pencil' ? 1 : Math.ceil(5.75 / m.t);
  pile.dataset.kind = measure;
  pile.innerHTML = '<i></i>'.repeat(n);
  pileItems = [...pile.children];
  stackNote.textContent = m.note;
  setStack(stackP);
}
function setStack(p) {
  stackP = p;
  const m = MEASURES[measure];
  const target = measure === 'pencil' ? 7 : 5.75;
  const mm = target * ease(span(p, 0.06, 0.8));
  const count = mm / m.t;
  pileItems.forEach((el, i) => {
    const part = clamp01(count - i);
    el.style.visibility = part > 0.001 ? 'visible' : 'hidden';
    el.classList.toggle('is-part', part > 0 && part < 1);
    el.style.setProperty('--part', `${(part * 100).toFixed(1)}%`);
  });
  stackMm.textContent = fmt(mm, 2);
  stackN.textContent = fmt(count, measure === 'paper' ? 1 : m.d);
  stackWhat.textContent = m.what(Math.round(count));
}
initRadioGroup(measureGrp, (v) => { syncRadio(measureGrp, v); measure = v; buildPile(); });
buildPile();

/* ---------- 3. Разрез ---------- */

const sectionEl = $('[data-section]');
const sectionItems = $$('li', sectionEl);
const sectionSum = $('[data-section-sum]');
const LAYERS = sectionItems.map((li) => Number(li.style.getPropertyValue('--t')));
function setLayers(p) {
  // разлёт до 0,4, держим, складываем к 0,95
  const open = ease(span(p, 0.05, 0.4)) * (1 - ease(span(p, 0.78, 0.96)));
  const mobile = window.innerWidth <= 760;
  sectionEl.style.setProperty('--gap', `${(open * (mobile ? 10 : 18)).toFixed(1)}px`);
  sectionEl.style.setProperty('--lab', String(Math.max(open, span(p, 0.9, 1))));
  // сумма растёт слой за слоем
  const f = span(p, 0.12, 0.72) * LAYERS.length;
  let sum = 0;
  LAYERS.forEach((t, i) => { sum += t * clamp01(f - i); });
  sectionSum.textContent = fmt(sum, 2);
  sectionItems.forEach((li, i) => { li.style.opacity = f > i || p > 0.9 ? '1' : '.3'; });
}

/* ---------- 4. День на 4000 мАч ---------- */

const DAYS = {
  normal: { name: 'обычный день', pts: [[7, 100], [8, 96], [9.5, 88], [12, 74], [13, 70], [15, 58], [17.5, 46], [19, 40], [21, 31], [23.5, 22]], note: '3 часа экрана, час навигации, 40 фото. В 23:30 остаётся 22 %.' },
  heavy: { name: 'тяжёлый день', pts: [[7, 100], [8, 92], [9, 80], [10.5, 66], [12, 55], [13, 48], [14.5, 36], [16, 26], [17.5, 17], [18.5, 10], [18.75, 45], [21, 33], [23.5, 18]], note: '5G, навигация, 4K и игры. К 18:30 — 10 %. Пятнадцать минут на 45 Вт — и +35 %.' },
  leaf: { name: 'режим «Лист»', pts: [[7, 100], [10, 93], [13, 85], [16, 77], [19, 70], [21, 64], [23.5, 58]], note: '«Лист»: 60 Гц, только экономные ядра, тёмная тема. Хватает на полтора дня.' },
};
const dayGrp = $('[data-day]');
const daySvg = $('[data-day-svg]');
const dayLine = $('[data-day-line]');
const dayArea = $('[data-day-area]');
const dayCursor = $('[data-day-cursor]');
const dayDot = $('[data-day-dot]');
const dayTime = $('[data-day-time]');
const dayPct = $('[data-day-pct]');
const dayNote = $('[data-day-note]');
const DX = (h) => 40 + ((h - 7) / 17) * 540;
const DY = (pct) => 20 + (1 - pct / 100) * 200;
let day = 'normal';
(function drawGrid() {
  const g = $('[data-day-grid]');
  let s = '';
  for (const pct of [0, 25, 50, 75, 100]) s += `<line x1="40" x2="580" y1="${DY(pct)}" y2="${DY(pct)}"/><text x="4" y="${DY(pct) + 4}">${pct}</text>`;
  for (const h of [7, 10, 13, 16, 19, 22, 24]) s += `<text x="${DX(h) - 14}" y="248">${pad2(h % 24)}:00</text>`;
  g.innerHTML = s;
})();
function pctAt(h) {
  const pts = DAYS[day].pts;
  if (h <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (h <= pts[i][0]) { const [h0, p0] = pts[i - 1], [h1, p1] = pts[i]; return p0 + (p1 - p0) * ((h - h0) / (h1 - h0)); }
  }
  return pts[pts.length - 1][1];
}
function paintDay() {
  const pts = DAYS[day].pts;
  const d = pts.map(([h, p], i) => `${i ? 'L' : 'M'}${DX(h).toFixed(1)} ${DY(p).toFixed(1)}`).join(' ');
  dayLine.setAttribute('d', d);
  dayArea.setAttribute('d', `${d} L${DX(pts.at(-1)[0]).toFixed(1)} ${DY(0)} L${DX(7)} ${DY(0)} Z`);
  if (!reducedMode) {
    const len = dayLine.getTotalLength();
    gsap.fromTo(dayLine, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.out' });
  }
  dayNote.textContent = DAYS[day].note;
  setDayCursor(pts.at(-1)[0]);
}
function setDayCursor(h) {
  const hh = Math.max(7, Math.min(23.5, h));
  const pct = pctAt(hh);
  const x = DX(hh), y = DY(pct);
  dayCursor.setAttribute('x1', x); dayCursor.setAttribute('x2', x);
  dayDot.setAttribute('cx', x); dayDot.setAttribute('cy', y);
  const clock = `${pad2(Math.floor(hh))}:${pad2(Math.round((hh % 1) * 60) % 60)}`;
  dayTime.textContent = clock;
  dayPct.textContent = `${Math.round(pct)} %`;
  demo.pct = pct; demo.clock = clock; demo.profile = DAYS[day].name;
  updateScreen();
}
daySvg.addEventListener('pointermove', (e) => {
  const r = daySvg.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * 600;
  setDayCursor(7 + ((x - 40) / 540) * 17);
});
initRadioGroup(dayGrp, (v) => { syncRadio(dayGrp, v); day = v; paintDay(); });
paintDay();

/* ---------- 5. Видоискатель ---------- */

const ZOOM_INFO = {
  '0.5': { z: 0.5, label: '0,5× · сверхширокая 50 Мп · 120°', note: '0,5×: сверхширокая на 50 Мп с автофокусом — весь залив и оба берега.' },
  1: { z: 1, label: '1× · 200 Мп · 24 мм', note: '1×: весь сенсор, 16 пикселей сливаются в один большой — светло даже в сумерках.' },
  2: { z: 2, label: '2× · 50 Мп из центра · 48 мм', note: '2×: центральная четверть сенсора, 50 настоящих мегапикселей. Для портретов.' },
  4: { z: 4, label: '4× · 12,5 Мп · 96 мм · оптическое качество', note: '4×: центр сенсора на 12,5 Мп — каждый пиксель настоящий. Видно чайку на перилах маяка.' },
  macro: { z: 0, label: 'Макро · 2,5 см · сверхширокая', note: 'Макро: сверхширокая фокусируется с 2,5 см. Иней на хвоинке у причала.' },
};
const zoomGrp = $('[data-zoom]');
const viewCanvas = $('[data-view]');
const viewLabel = $('[data-view-label]');
const sensor = $('[data-sensor]');
const crop = $('[data-crop]');
const camNote = $('[data-cam-note]');
const view = { zoom: 1, macro: 0, raf: 0, visible: false, key: '1' };
function setZoom(k) {
  const info = ZOOM_INFO[k];
  view.key = k;
  syncRadio(zoomGrp, k);
  viewLabel.textContent = info.label;
  camNote.textContent = info.note;
  sensor.dataset.z = k;
  if (info.z >= 1) { crop.style.width = `${100 / info.z}%`; crop.style.height = `${100 / info.z}%`; }
  const to = { zoom: info.z || view.zoom, macro: info.z ? 0 : 1 };
  if (reducedMode) Object.assign(view, to); else gsap.to(view, { ...to, duration: 0.9, ease: 'power3.inOut', overwrite: true });
  if (!view.raf) view.raf = requestAnimationFrame(viewLoop);
}
function drawView(now) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(viewCanvas.clientWidth * dpr), h = Math.round(viewCanvas.clientHeight * dpr);
  if (!w || !h) return;
  if (viewCanvas.width !== w || viewCanvas.height !== h) { viewCanvas.width = w; viewCanvas.height = h; }
  const g = viewCanvas.getContext('2d');
  const t = now / 1000;
  drawHarbor(g, w, h, { t, zoom: view.zoom, accent: X4_COLORS[demo.color].ui });
  if (view.macro > 0.001) {
    g.save();
    g.globalAlpha = view.macro;
    drawHarbor(g, w, h, { t, zoom: 0 });
    g.restore();
  }
}
function viewLoop(now) {
  view.raf = 0;
  if (!view.visible || document.hidden) return;
  drawView(now);
  if (!reducedMode) view.raf = requestAnimationFrame(viewLoop);
}
initRadioGroup(zoomGrp, (v) => setZoom(v));
setZoom('1');

/* ---------- 6. Ядра GP20 ---------- */

const coresEl = $('[data-cores]');
coresEl.innerHTML = '<i class="is-big"></i>'.repeat(4) + '<i class="is-mid"></i>'.repeat(8) + '<i class="is-low"></i>'.repeat(8);
const cores = $$('i', coresEl);
let coresTl = null;
function lightCores() {
  if (coresTl || reducedMode) { cores.forEach((c) => c.classList.add('is-on')); return; }
  // ядра просыпаются по одному, потом нагрузка гуляет между ними
  coresTl = gsap.timeline();
  cores.forEach((c, i) => coresTl.call(() => c.classList.add('is-on'), null, i * 0.06));
  coresTl.call(() => {
    gsap.to({}, { duration: 0.5, repeat: -1, onRepeat: () => {
      if (current !== 'chip') return;
      cores.forEach((c, i) => c.classList.toggle('is-on', i < 4 ? Math.random() > 0.3 : Math.random() > 0.45));
    } });
  }, null, cores.length * 0.06 + 0.4);
}

/* ---------- 7. «Водяной знак» ---------- */

const markNote = $('[data-mark-note]');
$$('[data-mark-act]').forEach((b) => b.addEventListener('click', () => {
  const act = b.dataset.markAct;
  if (act === 'reveal') demo.reveal = !demo.reveal; else demo.edited = !demo.edited;
  b.setAttribute('aria-pressed', String(act === 'reveal' ? demo.reveal : demo.edited));
  if (demo.edited) markNote.textContent = demo.reveal ? 'Подрисовали лодку — узор знака порвался там, где меняли кадр. Подпись не сходится.' : 'Кадр изменён. Проявите знак — увидите, где.';
  else markNote.textContent = demo.reveal ? 'Узор знака целый: кадр снят этой камерой и не тронут.' : 'Каждый кадр Citadel подписывает прямо в камере. Нажмите «Проявить».';
  updateScreen();
}));

/* ---------- 8. «Рубильник» ---------- */

const swGrp = $('[data-sw]');
const SW_TOAST = { 1: '«Эфир»: Citadel 6 Slim обесточила модем, Wi-Fi, Bluetooth и GPS.', 0: 'Середина: всё включено.', '-1': '«Тишина»: ещё и камеры с микрофонами. Звонить нельзя, писать заметки — можно.' };
initRadioGroup(swGrp, (v) => {
  syncRadio(swGrp, v);
  demo.sw = Number(v);
  toast(SW_TOAST[v]);
  updateScreen();
});

/* ---------- 9. Фонарь ---------- */

const TORCH = {
  off: { mode: 'выключен', note: 'Фонарь выключен. Нажмите «Красный».' },
  white: { mode: 'белый · около 2500 м', note: 'Белый: видно примерно за 2,5 км. Светит вверх из окна на 1,6 мм.' },
  red: { mode: 'красный · до 4000 м', note: 'Красный: виден за 4 км и бережёт ночное зрение. У 0X0 было 5 км — у него и толщина 9 мм.' },
  sos: { mode: 'SOS · ··· ——— ···', note: 'SOS азбукой Морзе. Citadel включит его сама, если сработает «Мёртвая рука».' },
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

/* ---------- 10. Цвета ---------- */

const COLOR_ORDER = ['grifel', 'list', 'folga', 'nast'];
const COLOR_NOTES = {
  grifel: '«Грифель». Тёмный графит, как сердцевина карандаша, и сатиновый титан.',
  list: '«Лист». Бумажно-белый — как лист, на котором его начертили. Натуральный титан.',
  folga: '«Фольга». Бледное золото: тоньше фольги не бывает, но мы старались.',
  nast: '«Наст». Тонкая ледяная корка на мартовском снегу и серебристый титан.',
};
// снят с продажи: выбора цвета в покупке больше нет
const colorGrps = [$('[data-colors]'), $('[data-colors-buy]')].filter(Boolean);
const colorNote = $('[data-color-note]');
const buyColor = $('[data-buy-color]');
function applyColor(v, { instant = false, twirl = true } = {}) {
  if (!X4_COLORS[v]) return;
  const changed = v !== demo.color;
  demo.color = v;
  colorGrps.forEach((g) => syncRadio(g, v));
  root.dataset.color = v;
  store.set('oy-x4-color', v);
  colorNote.textContent = COLOR_NOTES[v];
  if (buyColor) buyColor.textContent = X4_COLORS[v].label;
  stage?.setBodyColor(v, instant);
  // новый цвет — телефон переворачивается, как страница
  if (changed && twirl && !instant && !reducedMode) gsap.fromTo(demo, { twirl: 0 }, { twirl: 1, duration: 1.1, ease: 'power3.inOut', onComplete: () => { demo.twirl = 0; } });
}
colorGrps.forEach((g) => initRadioGroup(g, (v) => applyColor(v)));
function setColors(p) {
  const idx = Math.min(COLOR_ORDER.length - 1, Math.floor(span(p, 0.05, 0.95) * COLOR_ORDER.length));
  if (idx !== demo.colorIdx) { demo.colorIdx = idx; applyColor(COLOR_ORDER[idx]); }
}
const saved = root.dataset.color;
if (saved && saved !== 'grifel') { applyColor(saved, { instant: true }); demo.colorIdx = COLOR_ORDER.indexOf(saved); }

/* ---------- 11. Купить ---------- */

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
// 0X4 снят с продажи весной 2033-го: калькулятора нет, на его месте — карточка 0X5
if (curGrp && memGrp) {
  initRadioGroup(curGrp, (v) => { syncRadio(curGrp, v); cur = v; paintTotal(); });
  initRadioGroup(memGrp, (v) => { syncRadio(memGrp, v); paintTotal(); });
  paintTotal(false);
}

/* ---------- Хореография ---------- */

function addKeys(P) {
  const K = (id, f, props) => Keys.add(sts[id], f, props);
  const hold = (id, pose) => { K(id, -0.4, pose); K(id, 0.3, pose); };
  K('hero', -1, P.hero);
  K('hero', 0, P.hero);
  K('profile', -0.5, P.profile0);
  K('profile', 0.15, P.profile0);
  K('profile', 0.85, P.profile1);
  K('profile', 1, P.profile1);
  // в стопке и разрезе телефона нет: чертежи говорят сами
  hold('stack', P.hidden);
  K('stack', 1, P.hidden);
  hold('layers', P.hidden);
  K('layers', 1, P.hidden);
  const away = (id, pose, at) => K(id, at, { ...pose, y: 0.9, ry: pose.ry + 0.5, vis: 0 });
  if (P.mobile) {
    // на телефоне текст глав на подложке уезжает под модель — она уходит раньше
    for (const id of ['battery', 'chip', 'citadel', 'switch', 'torch']) { K(id, -0.4, P[id]); K(id, 0.06, P[id]); away(id, P[id], 0.24); }
  } else {
    K('battery', -0.4, P.battery);
    K('battery', 0.4, { ...P.battery, ry: P.battery.ry - 0.1 });
    away('battery', P.battery, 0.75);
    for (const id of ['chip', 'citadel', 'switch', 'torch']) { K(id, -0.4, P[id]); K(id, 0.5, P[id]); }
    away('citadel', P.citadel, 0.7);
  }
  hold('camera', P.hidden);
  K('colors', -0.3, P.colors);
  K('colors', 1, P.colors);
  hold('buy', P.hidden);
  K('specs', 1, P.hidden);
}

function buildChoreography({ isMobile, reduce }) {
  reducedMode = reduce;
  stage?.setReduced(reduce);
  if (reduce) smooth.disable(); else smooth.enable();
  const SETTERS = { profile: setProfile, stack: setStack, layers: setLayers, colors: setColors };

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
  if (reduce) { setProfile(1); setStack(1); setLayers(1); }

  // гигантское 5,75 расходится: «5» влево, «75» вправо, запятая падает
  ScrollTrigger.create({
    trigger: sections.hero, start: 'top top', end: 'bottom top',
    onUpdate: (st) => {
      if (reduce) return;
      const [a, b, c] = $$('.x-mega__num > span');
      const p = st.progress;
      a.style.transform = `translateX(${-p * 30}vw)`;
      b.style.transform = `translateY(${p * 40}vh) rotate(${p * 40}deg)`;
      c.style.transform = `translateX(${p * 30}vw)`;
      $('.x-mega__dim').style.transform = `scaleX(${1 + p * 0.6})`;
      $('.x-mega__dim').style.opacity = String(1 - p * 1.4);
    },
  });

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
    // штампы чертежа впечатываются: появляются слева направо по ячейкам
    $$('.x-stamp').forEach((s) => {
      if (s.closest('#hero')) return;
      gsap.fromTo(s.children, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out', stagger: 0.08, scrollTrigger: { trigger: s, start: 'top 90%', toggleActions: 'play none none none' } });
    });
    $$('[data-reveal], .x-lead, .x-feats li, .x-specs div, .x-buy__panel, .x-power li, .x-day').forEach((el) => {
      gsap.fromTo(el, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.85, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none none' } });
    });
  }
  bindOnEnter();
  ScrollTrigger.refresh();
  return () => Keys.reset();
}
ScrollTrigger.addEventListener('refresh', () => { Keys.compile(window.innerHeight); detectChapter(); });

let enterBound = false;
function bindOnEnter() {
  if (enterBound) return;
  enterBound = true;
  ScrollTrigger.create({ trigger: '.x-bench', start: 'top 85%', once: true, onEnter: () => $('.x-bench').classList.add('is-in') });
  ScrollTrigger.create({ trigger: '[data-cores]', start: 'top 85%', once: true, onEnter: lightCores });
  ScrollTrigger.create({ trigger: '[data-view]', start: 'top bottom', end: 'bottom top', onToggle: (st) => { view.visible = st.isActive; if (st.isActive && !view.raf) view.raf = requestAnimationFrame(viewLoop); } });
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
  // глава пересчитывается и при прокрутке, и раз в полсекунды: после прыжка к якорю пины успевают перестроиться
  if (y !== lastY || now - lastDetect > 500) {
    lastY = y;
    lastDetect = now;
    detectChapter();
    const max = document.documentElement.scrollHeight - window.innerHeight;
    paintCaliper(max > 0 ? clamp01(y / max) : 0);
  }
  const torch = current === 'torch' ? torchLevel(now) : 0;
  const wantDark = current === 'torch' && demo.torch !== 'off' ? 0.85 : 0;
  dark += (wantDark - dark) * (reducedMode ? 1 : 1 - Math.exp(-dt * 4));
  darkEl.style.opacity = dark.toFixed(3);
  root.classList.toggle('x-dark', dark > 0.4);
  if (Keys.empty || !stage) return;
  const v = Keys.sample(y, reducedMode);

  const heroAmp = 1 - clamp01(y / (window.innerHeight * 0.7));
  const amp = reducedMode ? 0 : current === 'hero' ? heroAmp : current === 'colors' ? 0.6 : 0;
  const f = flutter(now / 1000, amp);
  if (f) { v.ry += f.ry; v.rx += f.rx; v.rz += f.rz; }
  if (demo.twirl) v.spin = ease(demo.twirl) * 2 * PI;
  v.sw = current === 'switch' ? demo.sw : 0;
  v.torch = torch;
  const vis = clamp01(v.vis ?? 1);
  canvas.style.opacity = vis.toFixed(3);
  stage.setActive(vis > 0.02 && !document.hidden);
  stage.setTarget(v);
}
gsap.ticker.add(tick);
if (params.has('debug')) window.__x4 = { stage, Keys, ScrollTrigger, sts, demo };

window.addEventListener('pointermove', (e) => {
  if (!stage || reducedMode || e.pointerType === 'touch') return;
  stage.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
}, { passive: true });
window.addEventListener('resize', () => { stage?.resize(); lastY = -1; });

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

  const loader = $('#loader');
  const hideLoader = () => { loader.classList.add('is-done'); loader.setAttribute('aria-hidden', 'true'); };
  setTimeout(hideLoader, reducedMode ? 0 : 500);
  setTimeout(hideLoader, 1400);
  updateScreen(true);

  // первый экран: телефон влетает ребром, как лезвие, и разворачивается спинкой
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
        // первые 40 % пути — строго ребром, потом поворот спинкой
        const turn = ease(span(k.t, 0.4, 1));
        const pose = {};
        for (const key in P.hero) pose[key] = P.far[key] + (P.hero[key] - P.far[key]) * k.t;
        pose.ry = P.far.ry + (P.hero.ry - P.far.ry) * turn;
        pose.rz = P.far.rz * (1 - k.t);
        stage.setTarget(pose);
      },
      onComplete: () => gsap.ticker.add(tick),
    });
    gsap.from('.x-mega__num > span', { opacity: 0, y: 90, duration: 1.3, ease: 'power4.out', stagger: 0.12, delay: 0.3 });
    gsap.from('.x-mega__dim', { scaleX: 0, duration: 1.2, ease: 'power3.inOut', delay: 0.6 });
    const hero = splitHeads.find(({ el }) => el.closest('#hero'));
    if (hero) gsap.from(hero.words, { yPercent: 115, opacity: 0, duration: 1.1, ease: 'power4.out', stagger: 0.08, delay: 0.9 });
    gsap.from('.x-hero > *:not(.x-hero__title)', { opacity: 0, y: 20, duration: 0.9, ease: 'power3.out', stagger: 0.08, delay: 1.3 });
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
