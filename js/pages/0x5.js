/* =========================================================================
   OY 0X5 — «Два сердца». Страница-кардиомонитор.
   За всеми главами бегут две кардиограммы — «Мир» и «Дом» — с настоящей
   развёрткой: новый участок пишется поверх старого, перед пером — стёртая
   полоса. Справа сверху — показания двух сердец, внизу прогресс —
   кардиограмма страницы, где каждая глава — удар. Главы подписаны как
   двенадцать отведений ЭКГ. «Анатомия» — рентген телефона; «Мир и Дом» —
   где что живёт, «Взломать Мир» и «Дефибриллятор»; «Эстафета» — тепло двух
   сердец против одного; «6,1» — куда ушли 0,35 мм; видоискатель над
   амбаром под Парижем; трассировщик лучей FIG Four против FIG Three;
   Tesseract 5; «Рубильник» с «Только Дом» останавливает верхнюю
   кардиограмму; фонарь с режимом «Пульс»; цвета; калькулятор цены.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage } from '../core/stage.js';
import { createKeys } from '../core/keys.js';
import { createOY0X5, X5_COLORS, drawBarn, beatShape, WORLD, HOME, ALARM } from '../models/oy0x5.js';
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
const frac = (x) => x - Math.floor(x);
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ---------- 3D ---------- */

const canvas = $('#stage');
let stage = null;
try {
  stage = createStage(canvas, createOY0X5, { forceFallback: params.has('fallback') });
} catch (err) {
  console.warn('[OY] WebGL недоступен, 3D отключено.', err);
  canvas.style.display = 'none';
}

/* ---------- Состояние демо ---------- */

const demo = {
  color: 'puls', colorIdx: 0, torch: 'off', sw: 0, twirl: 0,
  hack: 0, clamp: 0, restart: 0, hearts: 2, minutes: 20, gpu: 'four', rendering: false,
};

/* ---------- Сердца: фаза, частота, буфер развёртки ---------- */

// Буфер на N столбцов; перо проходит весь экран за span секунд.
// Новые столбцы пишутся с текущими параметрами — старые не меняются, как у настоящего монитора.
function createHeart(bpm, seed) {
  return { bpm, target: bpm, phase: seed, chaos: 0, flat: 0, t: 0, beat: false };
}
function createTrace(n = 480, spanSec = 6) {
  return { n, span: spanSec, buf: new Float32Array(n), head: 0, acc: 0 };
}
const hearts = { world: createHeart(72, 0), home: createHeart(58, 0.37) };
const bigTraces = { world: createTrace(520, 6), home: createTrace(520, 6) };
const scopeTraces = { world: createTrace(260, 3.2), home: createTrace(260, 3.2) };

function sampleHeart(h, t, phase) {
  const base = beatShape(frac(phase));
  const fib = Math.sin(t * 37 + h.phase0) * 0.35 + Math.sin(t * 23.7) * 0.3 + Math.sin(t * 61 + 1) * 0.18;
  return (base * (1 - h.chaos) + fib * h.chaos) * (1 - h.flat);
}
hearts.world.phase0 = 0; hearts.home.phase0 = 2;

// шаг сердца: фаза интегрируется, чтобы смена частоты не рвала линию
function stepHeart(h, dt, t) {
  h.bpm += (h.target - h.bpm) * (1 - Math.exp(-dt * 2));
  const prev = h.phase;
  h.phase += (dt * h.bpm) / 60;
  h.beat = Math.floor(h.phase - 0.3) !== Math.floor(prev - 0.3) && h.flat < 0.5;
  h.prevPhase = prev;
  h.t = t;
}
function pushTrace(tr, h, dt) {
  const cols = (dt / tr.span) * tr.n + tr.acc;
  const whole = Math.floor(cols);
  tr.acc = cols - whole;
  for (let i = 1; i <= whole; i++) {
    const k = i / whole;
    const ph = h.prevPhase + (h.phase - h.prevPhase) * k;
    tr.head = (tr.head + 1) % tr.n;
    tr.buf[tr.head] = sampleHeart(h, h.t - dt * (1 - k), ph);
  }
}
function drawTrace(g, tr, x, y, w, amp, color, { alpha = 1, width = 2, glow = 10, gap = 0.035 } = {}) {
  const n = tr.n;
  const gapCols = Math.round(n * gap);
  g.save();
  g.globalAlpha = alpha;
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineJoin = 'round';
  g.shadowColor = color;
  g.shadowBlur = glow;
  g.beginPath();
  let pen = false;
  for (let i = 0; i < n; i++) {
    // расстояние от пера вперёд: там стёрто
    const ahead = (i - tr.head + n) % n;
    if (ahead > 0 && ahead <= gapCols) { pen = false; continue; }
    const px = x + (i / (n - 1)) * w, py = y - tr.buf[i] * amp;
    if (!pen) { g.moveTo(px, py); pen = true; } else g.lineTo(px, py);
  }
  g.stroke();
  // яркая точка пера
  const hx = x + (tr.head / (n - 1)) * w, hy = y - tr.buf[tr.head] * amp;
  g.shadowBlur = glow * 1.6;
  g.fillStyle = '#FFFFFF';
  g.beginPath(); g.arc(hx, hy, width * 1.3, 0, PI * 2); g.fill();
  g.restore();
}

/* ---------- Фон: монитор во всё окно ---------- */

const mon = $('#monitor');
const monG = mon.getContext('2d');
let monW = 0, monH = 0;
function sizeMonitor() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  monW = Math.round(window.innerWidth * dpr);
  monH = Math.round(window.innerHeight * dpr);
  mon.width = monW; mon.height = monH;
}
sizeMonitor();
function drawMonitor() {
  monG.clearRect(0, 0, monW, monH);
  const k = monH / 900;
  const worldColor = hearts.world.chaos > 0.3 ? ALARM : WORLD;
  drawTrace(monG, bigTraces.world, 0, monH * 0.3, monW, monH * 0.07, worldColor, { width: 2.2 * k + 0.6, glow: 14 });
  drawTrace(monG, bigTraces.home, 0, monH * 0.74, monW, monH * 0.06, HOME, { width: 2.2 * k + 0.6, glow: 14 });
}

/* ---------- Показания ---------- */

const hud = {
  world: $('[data-hud-world]'), home: $('[data-hud-home]'),
  bpm: { world: $('[data-hud-bpm="world"]'), home: $('[data-hud-bpm="home"]') },
  ghz: { world: $('[data-hud-ghz="world"]'), home: $('[data-hud-ghz="home"]') },
  temp: { world: $('[data-hud-temp="world"]'), home: $('[data-hud-temp="home"]') },
  heart: { world: $('[data-hud-world] i'), home: $('[data-hud-home] i') },
};
let hudKey = '';
function paintHud() {
  const w = hearts.world, h = hearts.home;
  const off = demo.sw === -1;
  const alarm = demo.hack > 0.3 && !off;
  let wg = '3,9 ГГц', wt = 36, hg = '2,1 ГГц', ht = 31;
  if (current === 'camera') { wg = '4,4 ГГц'; wt = 39; }
  if (current === 'graphics' && demo.rendering) { wg = demo.gpu === 'four' ? '4,9 ГГц' : '4,8 ГГц'; wt = 43; }
  if (current === 'relay') {
    const m = demo.minutes / 20;
    wt = Math.round(36 + m * (demo.hearts === 2 ? 7 : 13));
    wg = fmt(4.9 * (demo.hearts === 2 ? 1 - m * 0.06 : 1 - m * 0.19)) + ' ГГц';
    if (demo.hearts === 2) { ht = Math.round(31 + m * 8); hg = fmt(2.1 + m * 1.6) + ' ГГц'; }
  }
  if (alarm) { wg = '?? ГГц'; wt = 51; }
  if (demo.sw === 1) wg = 'без радио';
  if (off) { wg = 'обесточен'; wt = 24; }
  const key = [Math.round(w.bpm), Math.round(h.bpm), wg, wt, hg, ht, alarm, off].join('|');
  if (key === hudKey) return;
  hudKey = key;
  hud.bpm.world.textContent = off ? '—' : alarm ? '???' : Math.round(w.bpm);
  hud.bpm.home.textContent = Math.round(h.bpm);
  hud.ghz.world.textContent = wg; hud.temp.world.textContent = `${wt} °C`;
  hud.ghz.home.textContent = hg; hud.temp.home.textContent = `${ht} °C`;
  hud.world.classList.toggle('is-alarm', alarm);
  hud.world.classList.toggle('is-off', off);
}
function heartBeat(id) {
  const el = hud.heart[id];
  el.classList.add('is-beat');
  setTimeout(() => el.classList.remove('is-beat'), 110);
}

/* ---------- Главы и кардиограмма страницы ---------- */

const CHAPTERS = ['hero', 'anatomy', 'homes', 'relay', 'thin', 'camera', 'graphics', 'tesseract', 'switch', 'torch', 'colors', 'buy', 'specs'];
const PINNED = { anatomy: '+=240%', thin: '+=170%', colors: '+=260%' };
const sections = Object.fromEntries(CHAPTERS.map((id) => [id, document.getElementById(id)]));
const ticks = $$('[data-tick]');
const TICK_OF = { specs: 'buy' };
let current = '';
let reducedMode = false;

// путь: ровная линия, на каждую главу — удар P-QRS-T
(function buildStrip() {
  const n = ticks.length;
  let d = 'M0 30';
  for (let i = 0; i < n; i++) {
    const cx = ((i + 0.5) / n) * 1000;
    d += ` L${(cx - 22).toFixed(1)} 30 Q${(cx - 17).toFixed(1)} 25 ${(cx - 12).toFixed(1)} 30 L${(cx - 5).toFixed(1)} 30 L${(cx - 3).toFixed(1)} 34 L${cx.toFixed(1)} 4 L${(cx + 3).toFixed(1)} 40 L${(cx + 6).toFixed(1)} 30 L${(cx + 12).toFixed(1)} 30 Q${(cx + 19).toFixed(1)} 22 ${(cx + 26).toFixed(1)} 30`;
  }
  d += ' L1000 30';
  $$('[data-strip-path]').forEach((p) => p.setAttribute('d', d));
})();
const stripClip = $('[data-strip-clip]');
const stripHead = $('[data-strip-head]');
function paintStrip(f) {
  const x = (f * 1000).toFixed(1);
  stripClip.setAttribute('width', x);
  stripHead.setAttribute('x1', x); stripHead.setAttribute('x2', x);
}

// гигантская кардиограмма первого экрана: три удара во всю ширину
(function buildMega() {
  let d = '';
  for (let i = 0; i <= 600; i++) {
    const x = i * 2, ph = (i / 600) * 3 + 0.1;
    const y = 150 - beatShape(frac(ph)) * 130;
    d += `${i ? 'L' : 'M'}${x} ${y.toFixed(1)}`;
  }
  $('[data-mega-path]').setAttribute('d', d);
})();

function detectChapter() {
  const line = window.innerHeight * 0.5;
  let id = CHAPTERS[0];
  for (const c of CHAPTERS) if (sections[c].getBoundingClientRect().top <= line) id = c;
  if (id === current) return;
  current = id;
  const on = TICK_OF[id] || id;
  const idx = ticks.findIndex((a) => a.dataset.tick === on);
  ticks.forEach((a, i) => { a.classList.toggle('is-on', i === idx); a.classList.toggle('is-past', i < idx); });
  // пульс «Мира» по главе: камера и графика нагружают сильнее
  hearts.world.target = { camera: 88, graphics: 104, relay: 96 }[id] || 72;
  hearts.home.target = { camera: 66, homes: 62 }[id] || 58;
  // показания уходят на ту сторону монитора, где нет текста главы
  root.dataset.hud = { hero: 'right', anatomy: 'none', homes: 'left', relay: 'right', thin: 'right', camera: 'none', graphics: 'none', tesseract: 'left', switch: 'right', torch: 'left', colors: 'right' }[id] || 'none';
  updateScreen();
}

/* ---------- Экран телефона ---------- */

let lastScreenKey = '';
function updateScreen(force = false) {
  if (!stage) return;
  let mode = 'lock';
  const extra = { sw: demo.sw, pct: 84 };
  if (current === 'homes') { mode = 'attack'; Object.assign(extra, { hack: demo.hack, clamp: demo.clamp, restart: demo.restart }); }
  else if (current === 'relay') { mode = 'heat'; Object.assign(extra, { two: demo.hearts === 2, min: demo.minutes }); }
  else if (current === 'thin' || current === 'tesseract') mode = 'vitals';
  else if (current === 'switch') mode = 'switch';
  else if (current === 'torch') { mode = 'torch'; extra.torch = demo.torch === 'off' ? 0 : 1; extra.torchColor = demo.torch === 'red' ? 'red' : 'white'; extra.torchMode = TORCH[demo.torch].mode; }
  const key = mode + JSON.stringify(extra);
  if (key === lastScreenKey && !force) return;
  lastScreenKey = key;
  stage.setScreen(mode, extra);
}

/* ---------- Позы ---------- */

// x/y — доля половины видимой ширины/высоты; fx/fy/fz — точка модели (единицы сцены: мм × 0,01)
const BASE = { x: 0, y: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: 0, rz: 0, s: 1, dist: 5.4, float: 1, vis: 1, spin: 0, sw: 0, torch: 0, screen: 1 };
const SW_Y = 0.354;          // «Рубильник» по высоте
function makePoses(mobile) {
  const P = {
    far: { x: 0.2, y: 0.1, rx: 0.3, ry: PI - 0.1, rz: -0.2, dist: 30, float: 0 },
    hero: { x: 0.34, y: 0.02, rx: 0.08, ry: PI - 0.42, rz: 0.05, dist: 5.6 },
    homes: { x: -0.4, rx: 0.04, ry: 0.34, rz: -0.03, dist: 5.6 },
    relay: { x: 0.34, rx: 0.05, ry: -0.32, rz: 0.03, dist: 5.2 },
    // ребро к вам, потом чуть повернуть: видно, где 6,1
    thin0: { x: 0.34, rx: 0.03, ry: PI / 2 - 0.02, dist: 4.4, float: 0.3 },
    thin1: { x: 0.34, rx: 0.16, ry: PI / 2 + 0.55, rz: 0.04, dist: 4.2, float: 0.3 },
    tesseract: { x: -0.32, rx: 0.05, ry: 0.32, rz: -0.03, dist: 5 },
    switch: { x: 0.26, fy: SW_Y - 0.08, rx: 0.06, ry: PI / 2 - 0.42, dist: 3.4, float: 0.3 },
    torch: { x: -0.28, y: 0.02, fy: 0.5, rx: 0.85, ry: 0.42, rz: -0.06, dist: 3.6, float: 0.15 },
    colors: { x: 0.28, rx: 0.1, ry: PI - 0.4, rz: 0.04, dist: 5 },
    hidden: { rx: 0.3, ry: PI - 0.8, dist: 16, float: 0, vis: 0 },
  };
  for (const k in P) P[k] = { ...BASE, ...P[k] };
  if (!mobile) return P;
  for (const k in P) {
    const p = P[k];
    if (k.startsWith('thin')) { P[k] = { ...p, x: 0.42, y: 0.1, dist: p.dist * 2.1 }; continue; }
    P[k] = { ...p, x: 0, y: 0.5, dist: p.dist * (p.dist < 3.8 ? 2.7 : 1.9) };
  }
  P.hero = { ...P.hero, x: 0.4, y: 0.52, dist: 9.5 };
  P.homes = { ...P.hidden };
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

/* ---------- II. Анатомия ---------- */

const anatItems = $$('[data-anat-list] li');
const xray = $('[data-xray]');
const xrayCap = $('[data-xray-cap]');
const STEP_PARTS = ['world', 'modem', 'aorta', 'home', 'tess', 'cell', 'peri'];
const xrParts = Object.fromEntries($$('[data-part]', xray).map((g) => [g.dataset.part, g]));
let anatIdx = -2;
function setAnatomy(p) {
  const idx = Math.min(STEP_PARTS.length - 1, Math.floor(span(p, 0.04, 0.92) * STEP_PARTS.length));
  if (idx === anatIdx) return;
  anatIdx = idx;
  anatItems.forEach((li, i) => { li.classList.toggle('is-on', i <= idx); li.classList.toggle('is-now', i === idx); });
  STEP_PARTS.forEach((k, i) => { xrParts[k].classList.toggle('is-on', i <= idx); xrParts[k].classList.toggle('is-now', i === idx); });
  xrParts.cams.classList.toggle('is-on', idx >= STEP_PARTS.indexOf('peri'));
  xrayCap.textContent = `OY 0X5 · ${anatItems[idx].querySelector('b').textContent}`;
}
const xrPulse = $('.xr-pulse', xray);

/* ---------- III. Мир и Дом ---------- */

const WHERE = {
  msg: '<span class="is-world">FM3 → «Мир»</span>: приходит шифр, прочитать его «Мир» не может → «Аорта» → <span class="is-home">«Дом»</span> расшифровывает и сам рисует окно поверх экрана. «Мир» видит на этом месте пустоту.',
  photo: 'Сенсор → сразу <span class="is-home">«Дом»</span>. <span class="is-world">«Мир»</span> получит кадр, только если вы им поделитесь — тогда копия уйдёт по «Аорте».',
  browser: 'Целиком в <span class="is-world">«Мире»</span>. Взломанная страница остаётся в «Мире» вместе со взломщиком.',
  game: '<span class="is-world">«Мир»</span> и FIG Four. В «Эстафете» <span class="is-home">«Дом»</span> берёт фоновые задачи, а свой личный раздел на это время запирает.',
  ai: '«Погонщик» живёт в <span class="is-home">«Доме»</span>: читает вашу почту, заметки и фото. Сети у «Дома» нет — рассказать некому.',
  pay: '«Кошелёк» — в Tesseract 5 у <span class="is-home">«Дома»</span>. NFC-антенна подключена к нему напрямую; <span class="is-world">«Мир»</span> узнаёт только «оплачено».',
};
const whereGrp = $('[data-where]');
const wherePath = $('[data-where-path]');
initRadioGroup(whereGrp, (v) => { syncRadio(whereGrp, v); wherePath.innerHTML = WHERE[v]; });
wherePath.innerHTML = WHERE.msg;

const scopeCv = { world: $('[data-scope-cv="world"]'), home: $('[data-scope-cv="home"]') };
const scopeSt = { world: $('[data-scope-st="world"]'), home: $('[data-scope-st="home"]') };
const aortaEl = $('[data-aorta]');
const aortaK = $('[data-aorta-k]');
const hackBtn = $('[data-hack]');
const defibBtn = $('[data-defib]');
const hackNote = $('[data-hack-note]');
const flashEl = $('[data-flash]');
let scopeVisible = false;
function drawScopes() {
  for (const id of ['world', 'home']) {
    const cv = scopeCv[id];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
    if (!w || !h) continue;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const g = cv.getContext('2d');
    g.clearRect(0, 0, w, h);
    const color = id === 'world' && hearts.world.chaos > 0.3 ? ALARM : id === 'world' ? WORLD : HOME;
    drawTrace(g, scopeTraces[id], 0, h * 0.6, w, h * 0.5, color, { width: 2 * dpr, glow: 8, gap: 0.05 });
  }
}
function paintAorta() {
  const closed = demo.clamp > 0.5 || demo.sw === -1;
  aortaEl.classList.toggle('is-closed', closed);
  aortaK.textContent = closed ? 'аорта · пережата «Клапаном»' : 'аорта · только шифр';
  const alarm = demo.hack > 0.3;
  scopeSt.world.textContent = demo.restart > 0.5 ? 'перезапуск…' : alarm ? 'фибрилляция' : 'ритм ровный';
  scopeSt.world.classList.toggle('is-alarm', alarm);
}
let hackTimer = 0;
hackBtn.addEventListener('click', () => {
  hackBtn.disabled = true;
  hackNote.textContent = '«Мир» атакован через страницу в браузере. Ритм сорвался.';
  gsap.to(demo, { hack: 1, duration: reducedMode ? 0 : 0.8, ease: 'power2.in', onUpdate: () => { paintAorta(); updateScreen(); } });
  clearTimeout(hackTimer);
  hackTimer = setTimeout(() => {
    demo.clamp = 1;
    paintAorta();
    updateScreen();
    hackNote.textContent = '«Клапан» пережал «Аорту» за 0,2 мс. «Дом» ровный: фото, ключи и сообщения ничего не заметили.';
    defibBtn.disabled = false;
    defibBtn.classList.add('is-ready');
  }, reducedMode ? 300 : 1600);
});
defibBtn.addEventListener('click', () => {
  defibBtn.disabled = true;
  defibBtn.classList.remove('is-ready');
  if (!reducedMode) gsap.fromTo(flashEl, { opacity: 0.85 }, { opacity: 0, duration: 0.6, ease: 'power2.out' });
  demo.hack = 0;
  demo.restart = 1;
  hearts.world.chaos = 0;
  hackNote.textContent = 'Разряд. «Дом» перезапускает «Мир» с чистой прошивки и сверяет хеш…';
  paintAorta();
  updateScreen();
  setTimeout(() => {
    demo.restart = 0;
    demo.clamp = 0;
    paintAorta();
    updateScreen();
    hackNote.textContent = 'Хеш сошёлся. «Мир» снова в ритме. Потеряны только вкладки браузера.';
    toast('«Мир» перезапущен. «Дом» не останавливался ни на удар.');
    hackBtn.disabled = false;
  }, reducedMode ? 300 : 1500);
});

/* ---------- aVR. Эстафета ---------- */

const heartsGrp = $('[data-hearts]');
const minIn = $('[data-min]');
const minOut = $('[data-min-out]');
const perfOne = $('[data-perf-one]');
const perfTwo = $('[data-perf-two]');
const perfCur = $('[data-perf-cursor]');
const perfOneV = $('[data-perf-one-v]');
const perfTwoV = $('[data-perf-two-v]');
const PX = (m) => 50 + (m / 20) * 530;
const PY = (v) => 20 + ((100 - v) / 30) * 170;
const curveOne = (m) => 100 - 19 * (1 - Math.exp(-m / 5)) / (1 - Math.exp(-4));
const curveTwo = (m) => 100 - 6 * (1 - Math.exp(-m / 7)) / (1 - Math.exp(-20 / 7));
(function drawPerf() {
  let s = '';
  for (const v of [100, 90, 80, 70]) s += `<line x1="50" x2="580" y1="${PY(v)}" y2="${PY(v)}"/><text x="8" y="${PY(v) + 4}">${v} %</text>`;
  for (const m of [0, 5, 10, 15, 20]) s += `<text x="${PX(m) - 10}" y="212">${m} мин</text>`;
  $('[data-perf-grid]').innerHTML = s;
  const path = (f) => Array.from({ length: 41 }, (_, i) => { const m = i / 2; return `${i ? 'L' : 'M'}${PX(m).toFixed(1)} ${PY(f(m)).toFixed(1)}`; }).join(' ');
  perfOne.setAttribute('d', path(curveOne));
  perfTwo.setAttribute('d', path(curveTwo));
})();
function paintRelay() {
  const m = demo.minutes;
  minOut.textContent = m;
  perfCur.setAttribute('x1', PX(m)); perfCur.setAttribute('x2', PX(m));
  perfOneV.textContent = `${Math.round(curveOne(m))} %`;
  perfTwoV.textContent = `${Math.round(curveTwo(m))} %`;
  perfTwo.style.opacity = demo.hearts === 2 ? '1' : '.3';
  perfOne.style.opacity = demo.hearts === 1 ? '1' : '.55';
  updateScreen();
}
initRadioGroup(heartsGrp, (v) => { syncRadio(heartsGrp, v); demo.hearts = Number(v); paintRelay(); });
minIn.addEventListener('input', () => { demo.minutes = Number(minIn.value); paintRelay(); });
paintRelay();

/* ---------- aVL. 6,1 мм ---------- */

const thinMm = $('[data-thin-mm]');
const thinBars = $$('[data-thin] li');
function setThin(p) {
  const k = ease(span(p, 0.08, 0.8));
  thinMm.textContent = fmt(5.75 + 0.35 * k, 2);
  const parts = [0.2, 0.1, 0.05];
  let acc = 0;
  thinBars.forEach((li, i) => { acc += parts[i]; li.classList.toggle('is-on', 0.35 * k >= acc - parts[i] / 2); });
}

/* ---------- aVF. Видоискатель ---------- */

const ZOOM_INFO = {
  '0.5': { z: 0.5, label: '0,5× · сверхширокая 50 Мп · 120°', note: '0,5×: сверхширокая на 50 Мп — всё поле, тополя и дорога к амбару.' },
  1: { z: 1, label: '1× · 200 Мп · 24 мм', note: '1×: весь сенсор 200 Мп, 16 пикселей сливаются в один большой.' },
  2: { z: 2, label: '2× · 50 Мп из центра · 48 мм', note: '2×: центральная четверть сенсора, 50 настоящих мегапикселей.' },
  5: { z: 5, label: '5× · перископ 50 Мп · 120 мм', note: '5×: «плоский перископ». Над воротами видно ○X○ — так OY подписывала амбар ещё в 2024-м.' },
  10: { z: 10, label: '10× · 12,5 Мп из центра перископа · 240 мм', note: '10×: центр сенсора перископа. На коньке крыши — кот, который сторожит OY Vitals.' },
  macro: { z: 0, label: 'Макро · 2 см · сверхширокая', note: 'Макро с 2 см: роса на колосе, а в капле — перевёрнутый амбар.' },
};
const zoomGrp = $('[data-zoom]');
const viewCanvas = $('[data-view]');
const viewLabel = $('[data-view-label]');
const camNote = $('[data-cam-note]');
const view = { zoom: 1, macro: 0, raf: 0, visible: false };
function setZoom(k) {
  const info = ZOOM_INFO[k];
  syncRadio(zoomGrp, k);
  viewLabel.textContent = info.label;
  camNote.textContent = info.note;
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
  drawBarn(g, w, h, { t, zoom: view.zoom, accent: X5_COLORS[demo.color].ui });
  if (view.macro > 0.001) {
    g.save();
    g.globalAlpha = view.macro;
    drawBarn(g, w, h, { t, zoom: 0 });
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

/* ---------- V1. Трассировщик лучей ---------- */

// Три шара на шахматном полу: красный, зеркальный и фосфорный; тени и одно отражение.
// FIG Four считает в 2,1 раза больше строк за кадр, чем FIG Three.
const rtCanvas = $('[data-rt]');
const RT_W = 320, RT_H = 180;
rtCanvas.width = RT_W; rtCanvas.height = RT_H;
const rtG = rtCanvas.getContext('2d');
const rtImg = rtG.createImageData(RT_W, RT_H);
const rtPct = $('[data-rt-pct]');
const rtTime = $('[data-rt-time]');
const rtGpu = $('[data-rt-gpu]');
const gpuGrp = $('[data-gpu]');
const rt = { row: 0, acc: 0, t0: 0, running: false, visible: false, raf: 0 };
if (params.has('debug')) window.__rt = { rt, traceRow, rtImg, rtG, RT_H };
const V3 = (x, y, z) => [x, y, z];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm3 = (a) => mul3(a, 1 / Math.hypot(a[0], a[1], a[2]));
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const SPHERES = [
  { c: V3(-1.25, 0.6, 0.4), r: 0.6, col: [0.75, 0.1, 0.14], refl: 0.15, accent: true },
  { c: V3(0.25, 0.8, 0.1), r: 0.8, col: [0.9, 0.92, 0.95], refl: 0.85 },
  { c: V3(1.55, 0.42, -0.5), r: 0.42, col: hexRgb('#6CFF9E'), refl: 0.1, glow: 0.4 },
];
const LIGHT = norm3(V3(-0.6, 0.9, -0.5));
const EYE = V3(0, 1.1, -3.6);
function hitScene(o, d) {
  let best = Infinity, hit = null;
  for (const s of SPHERES) {
    const oc = sub3(o, s.c);
    const b = dot3(oc, d), c = dot3(oc, oc) - s.r * s.r;
    const disc = b * b - c;
    if (disc < 0) continue;
    const t = -b - Math.sqrt(disc);
    if (t > 1e-3 && t < best) { best = t; hit = s; }
  }
  if (d[1] < -1e-4) {
    const t = -o[1] / d[1];
    if (t > 1e-3 && t < best) { best = t; hit = 'floor'; }
  }
  return hit ? { t: best, obj: hit } : null;
}
function shade(o, d, depth) {
  const h = hitScene(o, d);
  if (!h) {
    const k = clamp01(d[1] * 1.6 + 0.3);
    return [0.02 + 0.05 * k, 0.06 + 0.12 * k, 0.07 + 0.1 * k];
  }
  const p = add3(o, mul3(d, h.t));
  let n, col, refl;
  if (h.obj === 'floor') {
    n = [0, 1, 0];
    const chk = (Math.floor(p[0] * 1.2) + Math.floor(p[2] * 1.2)) & 1;
    col = chk ? [0.05, 0.13, 0.1] : [0.02, 0.04, 0.05];
    refl = 0.25;
  } else {
    n = norm3(sub3(p, h.obj.c));
    col = h.obj.accent ? hexRgb(X5_COLORS[demo.color].ui) : h.obj.col;
    refl = h.obj.refl;
  }
  const shadow = hitScene(add3(p, mul3(n, 1e-3)), LIGHT) ? 0.25 : 1;
  const diff = Math.max(0, dot3(n, LIGHT)) * shadow;
  const r = sub3(d, mul3(n, 2 * dot3(d, n)));
  const spec = Math.pow(Math.max(0, dot3(r, LIGHT)), 40) * shadow;
  let c = [col[0] * (0.12 + 0.9 * diff) + spec, col[1] * (0.12 + 0.9 * diff) + spec, col[2] * (0.12 + 0.9 * diff) + spec];
  if (h.obj !== 'floor' && h.obj.glow) c = add3(c, mul3(col, h.obj.glow));
  if (depth < 2 && refl > 0) {
    const rc = shade(add3(p, mul3(n, 1e-3)), norm3(r), depth + 1);
    c = add3(mul3(c, 1 - refl), mul3(rc, refl));
  }
  return c;
}
function traceRow(y) {
  const fov = 0.62;
  for (let x = 0; x < RT_W; x++) {
    const u = ((x + 0.5) / RT_W * 2 - 1) * fov * (RT_W / RT_H);
    const v = (1 - (y + 0.5) / RT_H * 2) * fov;
    const d = norm3(V3(u, v - 0.18, 1));
    const c = shade(EYE, d, 0);
    const i = (y * RT_W + x) * 4;
    rtImg.data[i] = Math.min(255, Math.pow(c[0], 0.85) * 255);
    rtImg.data[i + 1] = Math.min(255, Math.pow(c[1], 0.85) * 255);
    rtImg.data[i + 2] = Math.min(255, Math.pow(c[2], 0.85) * 255);
    rtImg.data[i + 3] = 255;
  }
}
function rtStart() {
  rt.row = 0; rt.acc = 0; rt.t0 = performance.now(); rt.running = true;
  rtImg.data.fill(0);
  for (let i = 3; i < rtImg.data.length; i += 4) rtImg.data[i] = 255;
  demo.rendering = true;
  if (!rt.raf) rt.raf = requestAnimationFrame(rtLoop);
}
function rtLoop(now) {
  rt.raf = 0;
  if (!rt.running || !rt.visible || document.hidden) return;
  // FIG Four: полторы строки за кадр (кадр за 2 с), FIG Three — в 2,1 раза медленнее
  rt.acc += demo.gpu === 'four' ? 1.5 : 1.5 / 2.1;
  const rows = Math.floor(rt.acc);
  rt.acc -= rows;
  for (let i = 0; i < rows && rt.row < RT_H; i++) traceRow(rt.row++);
  rtG.putImageData(rtImg, 0, 0);
  if (rt.row < RT_H) {
    rtG.fillStyle = 'rgba(108,255,158,.9)';
    rtG.fillRect(0, rt.row, RT_W, 1);
  }
  rtPct.textContent = `${Math.round((rt.row / RT_H) * 100)} %`;
  rtTime.textContent = `${fmt((now - rt.t0) / 1000)} с`;
  if (rt.row >= RT_H) { rt.running = false; demo.rendering = false; rtTime.textContent += ' · готово'; return; }
  rt.raf = requestAnimationFrame(rtLoop);
}
initRadioGroup(gpuGrp, (v) => { syncRadio(gpuGrp, v); demo.gpu = v; rtGpu.textContent = v === 'four' ? 'FIG Four' : 'FIG Three'; rtStart(); });
$('[data-rt-again]').addEventListener('click', rtStart);
function rtReducedFrame() {
  for (let y = 0; y < RT_H; y++) traceRow(y);
  rtG.putImageData(rtImg, 0, 0);
  rtPct.textContent = '100 %';
  rtTime.textContent = 'кадр готов';
}

/* ---------- V3. «Рубильник» ---------- */

const swGrp = $('[data-sw]');
const swNote = $('[data-sw-note]');
const SW_TOAST = {
  1: '«Эфир»: Tesseract 5 обесточил модем, Wi-Fi, Bluetooth и GPS. Оба сердца бьются.',
  0: 'Середина: оба сердца, всё включено.',
  '-1': '«Только Дом»: «Мир» остановлен вместе с модемом. Камера, заметки и фонарь работают.',
};
const SW_NOTE = {
  1: 'Обе кардиограммы на месте: «Эфир» отключает радио, а не сердце.',
  0: 'Посмотрите на верхнюю кардиограмму страницы и переключите вниз.',
  '-1': 'Верхняя кардиограмма — прямая. «Мир» обесточен рукой, а не программой.',
};
initRadioGroup(swGrp, (v) => {
  syncRadio(swGrp, v);
  demo.sw = Number(v);
  toast(SW_TOAST[v]);
  swNote.textContent = SW_NOTE[v];
  paintAorta();
  updateScreen();
});

/* ---------- V4. Фонарь ---------- */

const TORCH = {
  off: { mode: 'выключен', note: 'Фонарь выключен. Нажмите «Пульс».' },
  white: { mode: 'белый · около 2800 м', note: 'Белый: видно примерно за 2,8 км.' },
  red: { mode: 'красный · до 4500 м', note: 'Красный: виден за 4,5 км и бережёт ночное зрение.' },
  sos: { mode: 'SOS · ··· ——— ···', note: 'SOS азбукой Морзе. Tesseract 5 включит его сам, если сработает «Мёртвая рука».' },
  pulse: { mode: '«Пульс» · двойные вспышки', note: '«Пульс»: две вспышки раз в секунду, как удар сердца. С фарами не спутать.' },
};
const torchGrp = $('[data-torch]');
const torchNote = $('[data-torch-note]');
const darkEl = $('[data-dark]');
initRadioGroup(torchGrp, (v) => {
  syncRadio(torchGrp, v);
  demo.torch = v;
  torchNote.textContent = TORCH[v].note;
  stage?.setTorchColor(v === 'red' || v === 'sos' || v === 'pulse' ? 'red' : 'white');
  updateScreen();
});
const SOS = [1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0];
function torchLevel(now) {
  if (demo.torch === 'off') return 0;
  if (demo.torch === 'sos') return SOS[Math.floor(now / 220) % SOS.length];
  if (demo.torch === 'pulse') { const f = (now % 1000) / 1000; return f < 0.09 || (f > 0.2 && f < 0.29) ? 1 : 0; }
  return 1;
}

/* ---------- V5. Цвета ---------- */

const COLOR_ORDER = ['puls', 'night', 'phosphor', 'coat'];
const COLOR_NOTES = {
  puls: '«Пульс». Сигнальный красный — главный цвет OY со времён 0X0. Тёмный титан.',
  night: '«Ночная смена». Глубокий синий, как коридор больницы в три часа ночи. Титан с синевой.',
  phosphor: '«Фосфор». Бледно-зелёный, как свечение старого монитора. Если долго смотреть — успокаивает.',
  coat: '«Халат». Белый, отглаженный, со светлым титаном.',
};
const colorGrps = [$('[data-colors]'), $('[data-colors-buy]')];
const colorNote = $('[data-color-note]');
const buyColor = $('[data-buy-color]');
function applyColor(v, { instant = false, twirl = true } = {}) {
  if (!X5_COLORS[v]) return;
  const changed = v !== demo.color;
  demo.color = v;
  colorGrps.forEach((g) => syncRadio(g, v));
  root.dataset.color = v;
  store.set('oy-x5-color', v);
  colorNote.textContent = COLOR_NOTES[v];
  buyColor.textContent = X5_COLORS[v].label;
  stage?.setBodyColor(v, instant);
  if (changed && twirl && !instant && !reducedMode) gsap.fromTo(demo, { twirl: 0 }, { twirl: 1, duration: 1.1, ease: 'power3.inOut', onComplete: () => { demo.twirl = 0; } });
}
colorGrps.forEach((g) => initRadioGroup(g, (v) => applyColor(v)));
function setColors(p) {
  const idx = Math.min(COLOR_ORDER.length - 1, Math.floor(span(p, 0.05, 0.95) * COLOR_ORDER.length));
  if (idx !== demo.colorIdx) { demo.colorIdx = idx; applyColor(COLOR_ORDER[idx]); }
}
const saved = root.dataset.color;
if (saved && saved !== 'puls') { applyColor(saved, { instant: true }); demo.colorIdx = COLOR_ORDER.indexOf(saved); }

/* ---------- V6. Купить ---------- */

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
$('[data-buy]').addEventListener('click', () => toast('Купить здесь нельзя: это концепт. Но пульс настоящий — ваш.'));

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
  // Правило: ключи главы идут не раньше −0,4 экрана до её начала и не позже середины главы
  // (у закреплённых — 0,7 пина). Иначе ключи соседних глав меняются местами и телефон дёргается.
  // Без телефона он не крутится, а уплывает вверх вместе с текстом и приходит снизу.
  keyLog.length = 0;
  const K = (id, f, props) => { keyLog.push({ id, f }); Keys.add(sts[id], f, props); };
  const leave = (pose) => ({ ...pose, y: pose.y + 1.3, vis: 0, float: 0 });
  const enter = (pose) => ({ ...pose, y: pose.y - 1.3, vis: 0, float: 0 });
  const gone = (id, pose) => { K(id, -0.4, leave(pose)); K(id, 0.3, leave(pose)); };
  // Каждая глава с телефоном: предыдущая поза уплывает вверх (−0,55), новая приходит снизу (−0,4)
  // уже развёрнутой как надо и стоит до end. Разворот происходит, пока телефона не видно, —
  // он никогда не пролетает через весь экран, крутясь поверх текста.
  const show = (id, pose, prev, end = 0.35) => {
    if (prev) K(id, -0.55, leave(prev));
    K(id, -0.4, enter(pose));
    K(id, -0.1, pose);
    K(id, end, pose);
  };
  K('hero', -1, P.hero);
  K('hero', 0, P.hero);
  gone('anatomy', P.hero);
  if (P.mobile) {
    // на телефоне текст глав на подложке уезжает под модель — она уходит раньше
    gone('homes', P.hero);
    for (const id of ['relay', 'tesseract', 'switch', 'torch']) {
      K(id, -0.4, enter(P[id]));
      K(id, -0.1, P[id]);
      K(id, 0.06, P[id]);
      K(id, 0.24, leave(P[id]));
    }
  } else {
    show('homes', P.homes);
    show('relay', P.relay, P.homes);
    K('thin', -0.55, leave(P.relay));
    show('tesseract', P.tesseract);
    show('switch', P.switch, P.tesseract);
    show('torch', P.torch, P.switch);
    K('colors', -0.55, leave(P.torch));
  }
  K('thin', -0.4, enter(P.thin0));
  K('thin', 0.1, P.thin0);
  K('thin', 0.6, P.thin1);
  gone('camera', P.thin1);
  K('graphics', 0.3, leave(P.thin1));
  K('colors', -0.4, enter(P.colors));
  K('colors', -0.1, P.colors);
  K('colors', 0.7, P.colors);
  gone('buy', P.colors);
}

function buildChoreography({ isMobile, reduce }) {
  reducedMode = reduce;
  stage?.setReduced(reduce);
  if (reduce) smooth.disable(); else smooth.enable();
  const SETTERS = { anatomy: setAnatomy, thin: setThin, colors: setColors };

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
  if (reduce) { setAnatomy(1); setThin(1); rtReducedFrame(); } else { setAnatomy(0); setThin(0); }

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
    // подписи отведений «печатаются» слева направо, как лента самописца
    $$('.v-ch').forEach((s) => {
      gsap.fromTo(s, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.7, ease: 'power2.out', scrollTrigger: { trigger: s, start: 'top 90%', toggleActions: 'play none none none' } });
    });
    $$('[data-reveal], .v-lead, .v-feats li, .v-specs div, .v-buy__panel, .v-scope, .v-perf, .v-where').forEach((el) => {
      if (el.closest('#hero')) return;
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
  ScrollTrigger.create({ trigger: '.v-bench', start: 'top 85%', once: true, onEnter: () => $('.v-bench').classList.add('is-in') });
  ScrollTrigger.create({ trigger: '[data-view]', start: 'top bottom', end: 'bottom top', onToggle: (st) => { view.visible = st.isActive; if (st.isActive && !view.raf) view.raf = requestAnimationFrame(viewLoop); } });
  ScrollTrigger.create({ trigger: '[data-scope]', start: 'top bottom', end: 'bottom top', onToggle: (st) => { scopeVisible = st.isActive; } });
  let rtStarted = false;
  ScrollTrigger.create({
    trigger: '[data-rt]', start: 'top 80%', end: 'bottom top',
    onToggle: (st) => {
      rt.visible = st.isActive;
      if (!st.isActive || reducedMode) return;
      if (!rtStarted) { rtStarted = true; rtStart(); } else if (rt.running && !rt.raf) rt.raf = requestAnimationFrame(rtLoop);
    },
  });
}

/* ---------- Каждый тик: сердца, монитор, прокрутка → модель ---------- */

let lastY = -1;
let lastDetect = 0;
let dark = 0;
let lastT = performance.now();
let monAcc = 0;
function tick() {
  const now = performance.now();
  // сердца идут по настоящему времени даже на медленном устройстве; поза модели — с ограничением шага
  const dtH = Math.min((now - lastT) / 1000, 0.5);
  const dt = Math.min(dtH, 0.05);
  lastT = now;
  const t = now / 1000;
  const y = window.scrollY;
  if (y !== lastY || now - lastDetect > 500) {
    lastY = y;
    lastDetect = now;
    detectChapter();
    const max = document.documentElement.scrollHeight - window.innerHeight;
    paintStrip(max > 0 ? clamp01(y / max) : 0);
  }

  // сердца: взлом — фибрилляция, перезапуск и «Только Дом» — прямая
  const w = hearts.world;
  w.chaos += ((demo.hack > 0.3 ? demo.hack : 0) - w.chaos) * (1 - Math.exp(-dtH * 6));
  const wantFlat = demo.sw === -1 || demo.restart > 0.5 ? 1 : 0;
  w.flat += (wantFlat - w.flat) * (1 - Math.exp(-dtH * 8));
  if (demo.hack > 0.3) w.target = 150;
  stepHeart(w, dtH, t);
  stepHeart(hearts.home, dtH, t);
  if (!reducedMode) {
    for (const id of ['world', 'home']) {
      pushTrace(bigTraces[id], hearts[id], dtH);
      pushTrace(scopeTraces[id], hearts[id], dtH);
      if (hearts[id].beat) heartBeat(id);
    }
    // монитор — 30 кадров в секунду: фон не должен мешать телефону
    monAcc += dtH;
    if (monAcc > 1 / 30) { monAcc = 0; drawMonitor(); if (scopeVisible) drawScopes(); }
  }
  paintHud();

  // пульс по «Аорте» на рентгене
  if (current === 'anatomy' && !reducedMode) xrPulse.setAttribute('cy', (266 + frac(t * 0.6) * 234).toFixed(1));

  const torch = current === 'torch' ? torchLevel(now) : 0;
  const wantDark = current === 'torch' && demo.torch !== 'off' ? 0.8 : 0;
  dark += (wantDark - dark) * (reducedMode ? 1 : 1 - Math.exp(-dt * 4));
  darkEl.style.opacity = dark.toFixed(3);
  root.classList.toggle('v-dark', dark > 0.4);
  if (Keys.empty || !stage) return;
  const v = Keys.sample(y, reducedMode);

  // на первом экране телефон вздрагивает на каждый удар «Мира»
  if (current === 'hero' && !reducedMode) {
    const b = Math.max(0, beatShape(frac(w.phase)));
    v.s = (v.s ?? 1) * (1 + 0.022 * b * (1 - clamp01(y / (window.innerHeight * 0.6))));
  }
  if (demo.twirl) v.spin = ease(demo.twirl) * 2 * PI;
  v.sw = current === 'switch' ? demo.sw : 0;
  v.torch = torch;
  const vis = clamp01(v.vis ?? 1);
  canvas.style.opacity = vis.toFixed(3);
  stage.setActive(vis > 0.02 && !document.hidden);
  stage.setTarget(v);
}
gsap.ticker.add(tick);
if (params.has('debug')) window.__x5 = { stage, Keys, ScrollTrigger, sts, demo, hearts, checkKeys };

window.addEventListener('pointermove', (e) => {
  if (!stage || reducedMode || e.pointerType === 'touch') return;
  stage.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
}, { passive: true });
window.addEventListener('resize', () => { stage?.resize(); sizeMonitor(); lastY = -1; });

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

  // при уменьшенном движении монитор рисуется один раз, статичной лентой
  if (reducedMode) {
    for (let i = 0; i < 400; i++) {
      for (const id of ['world', 'home']) { stepHeart(hearts[id], 0.015, i * 0.015); pushTrace(bigTraces[id], hearts[id], 0.015); pushTrace(scopeTraces[id], hearts[id], 0.015); }
    }
    drawMonitor();
    drawScopes();
  }

  const loader = $('#loader');
  const hideLoader = () => { loader.classList.add('is-done'); loader.setAttribute('aria-hidden', 'true'); };
  setTimeout(hideLoader, reducedMode ? 0 : 700);
  setTimeout(hideLoader, 1600);
  updateScreen(true);

  // первый экран: телефон издалека, с первым ударом встаёт на место
  if (!reducedMode && stage && window.scrollY < 10) {
    const P = makePoses(window.matchMedia('(max-width: 760px)').matches);
    stage.setTarget(P.far);
    stage.snap();
    gsap.ticker.remove(tick);
    gsap.ticker.add(tick);
    const k = { t: 0 };
    let introDone = false;
    const sample = Keys.sample.bind(Keys);
    // пока идёт заставка, поза — смесь «издалека» и героя
    Keys.sample = (yy, r) => {
      if (!introDone && window.scrollY > 40) { introDone = true; intro?.kill(); Keys.sample = sample; }
      if (introDone) return sample(yy, r);
      const pose = {};
      for (const key in P.hero) pose[key] = P.far[key] + (P.hero[key] - P.far[key]) * k.t;
      return pose;
    };
    let intro = null;
    intro = gsap.to(k, {
      t: 1, duration: 2.2, ease: 'expo.out', delay: 0.7,
      onUpdate: () => { if (window.scrollY > 40) { intro.kill(); introDone = true; Keys.sample = sample; } },
      onComplete: () => { introDone = true; Keys.sample = sample; },
    });
    gsap.from('.v-mega__ecg path', { strokeDasharray: 4000, strokeDashoffset: 4000, duration: 2.2, ease: 'power2.inOut', delay: 0.5 });
    const hero = splitHeads.find(({ el }) => el.closest('#hero'));
    if (hero) gsap.from(hero.words, { yPercent: 115, opacity: 0, duration: 1.1, ease: 'power4.out', stagger: 0.1, delay: 1 });
    gsap.from('.v-hero > *:not(.v-hero__title)', { opacity: 0, y: 20, duration: 0.9, ease: 'power3.out', stagger: 0.08, delay: 1.3 });
    gsap.from('.v-hud__row', { opacity: 0, x: 30, duration: 0.8, ease: 'power3.out', stagger: 0.12, delay: 1.1 });
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
