/* =========================================================================
   OY 0X5 Pro — «Смотрит в оба». Страница — электронная бумага и таблица
   для проверки зрения: главы — строки таблицы Сивцева, слева — сама
   таблица. Между главами — «полная перерисовка» E Ink и призрак прошлого
   заголовка. CPix 3: блок пикселей уезжает под соседей; сканер сетчатки
   с «Тревожным взглядом»; шайба выезжает на 20 мм по прокрутке; подзорная
   труба через залив к маяку Fyr с кольцом зума и тестом на падение; гибкий
   кремний против обычного; три слоя испарительной камеры; фликер-тест
   0,1–180 Гц; записка пером прямо на E Ink спинки 3D-модели; Love Gen 5;
   «Рубильник» с «Тишиной»; пять цветов; калькулятор цены.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage } from '../core/stage.js';
import { createKeys } from '../core/keys.js';
import { createOY0X5Pro, PRO_COLORS, drawBay, retinaTree, drawRetina } from '../models/oy0x5pro.js';
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
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const dprOf = () => Math.min(window.devicePixelRatio || 1, 2);
function fit(cv) {
  const dpr = dprOf();
  const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
  if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; }
  return { w: cv.width, h: cv.height, dpr };
}

/* ---------- 3D ---------- */

const canvas = $('#stage');
let stage = null;
try {
  stage = createStage(canvas, createOY0X5Pro, { forceFallback: params.has('fallback') });
} catch (err) {
  console.warn('[OY] WebGL недоступен, 3D отключено.', err);
  canvas.style.display = 'none';
}

const demo = { color: 'iris', colorIdx: 0, torch: 'off', sw: 0, twirl: 0, ink: 'note', cpix: 0, gen: 3 };

/* ---------- Главы, таблица, перерисовка ---------- */

const CHAPTERS = ['hero', 'cpix', 'retina', 'tube', 'zoom', 'flex', 'vapor', 'hz', 'eink', 'love', 'switch', 'colors', 'buy', 'specs'];
const PINNED = { tube: '+=180%', colors: '+=260%' };
const sections = Object.fromEntries(CHAPTERS.map((id) => [id, document.getElementById(id)]));
const ticks = $$('[data-tick]');
const TICK_OF = { specs: 'buy' };
let current = '';
let reducedMode = false;
let booted = false;

const refreshEl = $('[data-refresh]');
const ghostEl = $('[data-ghost]');
let lastFlash = 0;
// Перерисовка, как у E Ink: полоса обновления бежит по бумаге. Прошлый заголовок остаётся призраком
function eRefresh(prevId) {
  if (reducedMode || !booted) return;
  const now = performance.now();
  if (now - lastFlash < 700) return;
  lastFlash = now;
  // мягкая перерисовка: полоса обновления пробегает по бумаге сверху вниз
  gsap.fromTo(refreshEl, { yPercent: -100, opacity: 1 }, { yPercent: 100, duration: 0.55, ease: 'power1.inOut', onComplete: () => gsap.set(refreshEl, { opacity: 0 }) });
  const h = sections[prevId]?.querySelector('h1, h2');
  if (h) {
    ghostEl.textContent = h.textContent.replace(/\s+/g, ' ').trim();
    gsap.fromTo(ghostEl, { opacity: 0.08, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(3px)', duration: 1.6, ease: 'power2.in', delay: 0.1 });
  }
}

const INK_OF = { hero: 'clock', tube: 'clock', vapor: 'ticket', love: 'love', switch: 'switch', colors: 'clock' };
function detectChapter() {
  const line = window.innerHeight * 0.5;
  let id = CHAPTERS[0];
  for (const c of CHAPTERS) if (sections[c].getBoundingClientRect().top <= line) id = c;
  if (id === current) return;
  const prev = current;
  current = id;
  if (prev) eRefresh(prev);
  const on = TICK_OF[id] || id;
  const idx = ticks.findIndex((a) => a.dataset.tick === on);
  ticks.forEach((a, i) => { a.classList.toggle('is-on', i === idx); a.classList.toggle('is-past', i < idx); });
  updateScreen();
  updateInk();
}

/* ---------- Экран и спинка телефона ---------- */

let lastScreenKey = '';
function updateScreen(force = false) {
  if (!stage) return;
  let mode = 'lock';
  const extra = { sw: demo.sw };
  if (current === 'hero' || current === 'cpix') { mode = 'cpix'; extra.open = current === 'hero' ? 1 : demo.cpix; extra.ms = demo.gen === 3 ? 40 : 120; }
  else if (current === 'retina') { mode = 'retina'; Object.assign(extra, { tree: ret.tree, scan: ret.scan, ok: ret.ok, squint: ret.who === 'squint' ? 0.6 : 0 }); }
  else if (current === 'tube' || current === 'colors') { mode = 'tube'; extra.zoom = current === 'tube' ? 1 + tubeP * 9 : 5; extra.ext = current === 'tube' ? tubeP : 1; }
  else if (current === 'eink') mode = 'pen';
  else if (current === 'switch') { mode = demo.torch !== 'off' ? 'torch' : demo.sw === -1 ? 'silence' : 'lock'; extra.torch = demo.torch === 'off' ? 0 : 1; extra.torchColor = demo.torch === 'red' || demo.torch === 'sos' ? 'red' : 'white'; extra.torchMode = TORCH[demo.torch].mode; }
  const key = mode + JSON.stringify({ ...extra, tree: 0 });
  if (key === lastScreenKey && !force) return;
  lastScreenKey = key;
  stage.setScreen(mode, extra);
}
function updateInk() {
  if (!stage) return;
  if (current === 'eink') {
    if (demo.ink === 'note') stage.setInk('note', { strokes: pad.strokes.map((s) => ({ ...s, pts: s.pts.slice() })), n: pad.version }, false);
    else stage.setInk(demo.ink, { recText: '0Pen 2 · спуск за 20 м' });
    return;
  }
  const mode = INK_OF[current] || 'clock';
  stage.setInk(mode, mode === 'switch' ? { sw: demo.sw } : mode === 'love' ? { loveText: 'секреты под замком' } : {});
}

/* ---------- Позы ---------- */

// x/y — доля половины видимой ширины/высоты; fx/fy/fz — точка модели (единицы сцены: мм × 0,01)
const BASE = { x: 0, y: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: 0, rz: 0, s: 1, dist: 5.4, float: 1, vis: 1, spin: 0, sw: 0, torch: 0, screen: 1, ext: 0, pen: 0 };
const SW_Y = 0.4;
function makePoses(mobile) {
  const P = {
    far: { x: 0.2, y: 0.1, rx: 0.3, ry: PI - 0.1, rz: -0.2, dist: 30, float: 0 },
    hero: { x: 0.5, y: 0.02, rx: 0.1, ry: PI - 0.55, rz: 0.04, dist: 5.6, ext: 1 },
    cpix: { x: -0.42, y: 0.02, fy: 0.2, rx: 0.08, ry: 0.3, rz: -0.02, dist: 6.2, float: 0.5 },
    retina: { x: 0.46, fy: 0.2, rx: 0.06, ry: -0.3, dist: 6.2, float: 0.5 },
    tube0: { x: 0.42, fy: 0.25, rx: 0.14, ry: PI - 0.75, rz: 0.04, dist: 4.4, float: 0.3, ext: 0 },
    tube1: { x: 0.42, fy: 0.25, rx: 0.12, ry: PI / 2 + 0.22, rz: 0.04, dist: 4.4, float: 0.3, ext: 1 },
    vapor: { x: -0.36, rx: 0.06, ry: PI + 0.42, dist: 5.6, ext: 0 },
    eink: { x: -0.4, fy: -0.15, rx: 0.04, ry: PI + 0.26, rz: -0.02, dist: 5.3, float: 0.4, pen: 1 },
    switch: { x: 0.46, rx: 0.06, ry: PI - 0.45, dist: 6 },
    colors: { x: 0.3, rx: 0.1, ry: PI - 0.5, rz: 0.04, dist: 5.2, ext: 1 },
    hidden: { rx: 0.3, ry: PI - 0.8, dist: 16, float: 0, vis: 0 },
  };
  for (const k in P) P[k] = { ...BASE, ...P[k] };
  if (!mobile) return P;
  for (const k in P) {
    const p = P[k];
    P[k] = { ...p, x: 0, y: 0.5, dist: p.dist * (p.dist < 4.2 ? 2.4 : 1.9) };
  }
  P.hero = { ...P.hero, x: 0, y: 0.5, dist: 7.6 };
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

/* ---------- Ш Б. Телефон смотрит на вас ---------- */

const eyeNote = $('[data-eye-note]');
let eyeSeen = false;

/* ---------- М Н К. CPix 3 ---------- */

const cpixEl = $('[data-cpix]');
const cpixBlock = $('[data-cpix-block]');
const cpixMsg = $('[data-cpix-msg]');
const cpixGo = $('[data-cpix-go]');
const slowIn = $('[data-slow]');
const genGrp = $('[data-gen]');
// блок — 6 × 2 клеток; каждая уезжает влево под соседа, справа налево
const cells = [];
for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) {
  const i = document.createElement('i');
  i.style.zIndex = String(10 - c);
  cpixBlock.append(i);
  cells.push({ el: i, c, r });
}
let cpixBusy = false;
function cpixRun(open) {
  if (cpixBusy) return;
  cpixBusy = true;
  const ms = demo.gen === 3 ? 40 : 120;
  const k = slowIn.checked && !reducedMode ? 20 : 1;
  const T = (ms * k) / 1000;
  const order = [...cells].sort((a, b) => (open ? b.c - a.c : a.c - b.c) || a.r - b.r);
  const tl = gsap.timeline({ onComplete: () => { cpixBusy = false; } });
  order.forEach((cell, i) => {
    const at = (i / order.length) * T * 0.55;
    const to = open ? { xPercent: -(cell.c + 1) * 100 - 20, filter: 'brightness(.25)' } : { xPercent: 0, filter: 'brightness(1)' };
    tl.to(cell.el, { ...to, duration: T * 0.45, ease: open ? 'power2.in' : 'power2.out' }, at);
  });
  cpixEl.style.setProperty('--mod-t', `${T * 0.5}s`);
  tl.call(() => {
    cpixEl.classList.toggle('is-open', open);
    demo.cpix = open ? 1 : 0;
    updateScreen();
  }, null, open ? T * 0.7 : 0);
  cpixMsg.innerHTML = open
    ? `Окно открыто за ${ms}&nbsp;мс${k > 1 ? ' (показано в&nbsp;20&nbsp;раз медленнее)' : ''}. ${demo.gen === 3 ? 'Блок сдвинули магниты, камеры подняли пьезоэлементы — ни&nbsp;звука.' : 'Микромотор CPix&nbsp;2 тихо прожужжал.'} Love Gen&nbsp;5 записал в&nbsp;журнал: «камеры подняты, ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}».`
    : 'Пиксели на&nbsp;месте. Камеры обесточены и&nbsp;смотрят в&nbsp;изнанку экрана.';
  cpixGo.textContent = open ? 'Спрятать камеры' : 'Поднять камеры';
}
cpixGo.addEventListener('click', () => cpixRun(!demo.cpix));
initRadioGroup(genGrp, (v) => { syncRadio(genGrp, v); demo.gen = Number(v); updateScreen(); });

/* ---------- Ы М Б Ш. Сетчатка ---------- */

const retCv = $('[data-retina]');
const whoGrp = $('[data-who]');
const verdict = $('[data-verdict]');
const scanBtn = $('[data-scan]');
const SEEDS = { you: 2034, squint: 2034, other: 777, photo: 2034 };
const ret = { who: 'you', tree: retinaTree(2034), scan: -1, ok: false, pupil: 1 };
function drawRet() {
  const { w, h } = fit(retCv);
  if (!w) return;
  const g = retCv.getContext('2d');
  g.clearRect(0, 0, w, h);
  drawRetina(g, w / 2, h / 2, w / 2, { tree: ret.tree, scan: ret.scan, squint: ret.who === 'squint' ? 0.55 : 0, ink: ret.who === 'photo' ? '#7A4A40' : '#9E2A22' });
  // зрачок-вспышка: живой глаз сужается
  if (ret.scan >= 0) {
    g.fillStyle = `rgba(255,255,255,${0.12 * (1 - ret.scan)})`;
    g.fillRect(0, 0, w, h);
  }
}
const VERDICT = {
  you: ['Это вы. 0,4 с, совпадение 99,9999 %. Телефон открыт.', 'is-ok'],
  squint: ['Это вы — но прищурившись. Открыт «Двойник»: пустой телефон без ваших данных. Тот, кто вас заставил, ничего не заметит.', 'is-ok'],
  other: ['Рисунок сосудов чужой. Телефон заперт. Третья попытка — и попросит пароль.', 'is-bad'],
  photo: ['Зрачок не сузился от вспышки: это фотография. Телефон заперт, попытка записана в журнал Love Gen 5.', 'is-bad'],
};
initRadioGroup(whoGrp, (v) => {
  syncRadio(whoGrp, v);
  ret.who = v; ret.ok = false; ret.scan = -1;
  ret.tree = retinaTree(SEEDS[v]);
  verdict.textContent = 'Сканер ждёт взгляда.';
  verdict.className = 'o-verdict mono';
  drawRet();
  updateScreen();
});
scanBtn.addEventListener('click', () => {
  scanBtn.disabled = true;
  ret.ok = false;
  verdict.textContent = 'ИК 940 нм… читаем сосуды…';
  verdict.className = 'o-verdict mono';
  const o = { s: 0 };
  gsap.to(o, {
    s: 1, duration: reducedMode ? 0.01 : 1.4, ease: 'none',
    onUpdate: () => { ret.scan = o.s; drawRet(); updateScreen(); },
    onComplete: () => {
      ret.scan = -1;
      ret.ok = ret.who === 'you' || ret.who === 'squint';
      const [t, cls] = VERDICT[ret.who];
      verdict.textContent = t;
      verdict.className = `o-verdict mono ${cls}`;
      scanBtn.disabled = false;
      drawRet();
      updateScreen(true);
      if (ret.who === 'squint') toast('«Тревожный взгляд»: открыт «Двойник». Настоящие данные под замком Love Gen 5.');
    },
  });
});

/* ---------- Б Ы Н К М. 20 мм ---------- */

const mmOut = $('[data-mm]');
const ruler = $('[data-ruler]');
let tubeP = 0;
function setTube(p) {
  tubeP = ease(span(p, 0.12, 0.78));
  mmOut.textContent = fmt(20 * tubeP);
  ruler.style.setProperty('--e', tubeP.toFixed(3));
  if (current === 'tube') updateScreen();
}

/* ---------- И Н Ш М К. Подзорная труба ---------- */

const viewCv = $('[data-view]');
const viewLabel = $('[data-view-label]');
const zoomNote = $('[data-zoom-note]');
const dial = $('[data-dial]');
const dialKnob = $('[data-dial-knob]');
const dialVal = $('[data-dial-val]');
const nightGrp = $('[data-night]');
const dropBtn = $('[data-drop]');
const dropNote = $('[data-drop-note]');
const view = { zoom: 1, show: 1, night: 0, tumble: 0, dark: 0, visible: false, raf: 0 };
const ZMIN = 0.5, ZMAX = 20, ARC = 300;
const z2a = (z) => (Math.log(z / ZMIN) / Math.log(ZMAX / ZMIN)) * ARC - ARC / 2;
const a2z = (a) => ZMIN * Math.pow(ZMAX / ZMIN, (Math.max(-ARC / 2, Math.min(ARC / 2, a)) + ARC / 2) / ARC);
(function dialTicks() {
  let s = '';
  for (const z of [0.5, 1, 3, 5, 10, 20]) {
    const a = (z2a(z) - 90) * PI / 180;
    s += `<line x1="${100 + Math.cos(a) * 80}" y1="${100 + Math.sin(a) * 80}" x2="${100 + Math.cos(a) * 92}" y2="${100 + Math.sin(a) * 92}"/>`;
  }
  $('[data-dial-ticks]').innerHTML = s;
})();
const fmtZ = (z) => (z < 1 ? fmt(z, 1) : z < 10 ? fmt(z, 1).replace(',0', '') : String(Math.round(z)));
function setZoom(z, animate = false) {
  z = Math.max(ZMIN, Math.min(ZMAX, z));
  view.zoom = z;
  const a = (z2a(z) - 90) * PI / 180;
  dialKnob.setAttribute('cx', (100 + Math.cos(a) * 86).toFixed(1));
  dialKnob.setAttribute('cy', (100 + Math.sin(a) * 86).toFixed(1));
  dialVal.textContent = fmtZ(z);
  dial.setAttribute('aria-valuenow', z.toFixed(1));
  dial.setAttribute('aria-valuetext', `${fmtZ(z)}×`);
  let label, note;
  if (z < 0.95) { label = `${fmtZ(z)}× · сверхширокая 50 Мп · 120°`; note = 'Сверхширокая: весь залив и сосны на том берегу.'; }
  else if (z < 3) { label = `${fmtZ(z)}× · основная 200 Мп · ${Math.round(23 * z)} мм`; note = 'Основная камера: сенсор 1″ изогнут, как сетчатка, — края резкие без лишних линз.'; }
  else { label = `${fmtZ(z)}× · «Тубус» · ${Math.round(23 * z)} мм`; note = z > 18 ? 'На 20× читается табличка смотрителя: «FYR · 0x5 PRO». А в окне — кот.' : '«Тубус»: шайба выдвинута на 20 мм, линзы едут внутри колен — зум оптический на любом шаге.'; }
  viewLabel.textContent = label;
  zoomNote.textContent = note;
  if (!view.raf) view.raf = requestAnimationFrame(viewLoop);
}
let dragging = false;
function dialAngle(e) {
  const r = dial.getBoundingClientRect();
  const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
  let a = Math.atan2(y, x) * 180 / PI + 90;
  if (a > 180) a -= 360;
  return a;
}
dial.addEventListener('pointerdown', (e) => { dragging = true; dial.setPointerCapture(e.pointerId); setZoom(a2z(dialAngle(e))); });
dial.addEventListener('pointermove', (e) => { if (dragging) setZoom(a2z(dialAngle(e))); });
dial.addEventListener('pointerup', () => { dragging = false; });
dial.addEventListener('keydown', (e) => {
  const k = { ArrowRight: 1.12, ArrowUp: 1.12, ArrowLeft: 1 / 1.12, ArrowDown: 1 / 1.12 }[e.key];
  if (e.key === 'Home') { setZoom(ZMIN); e.preventDefault(); }
  else if (e.key === 'End') { setZoom(ZMAX); e.preventDefault(); }
  else if (k) { setZoom(view.zoom * k); e.preventDefault(); }
});
initRadioGroup(nightGrp, (v) => { syncRadio(nightGrp, v); view.night = Number(v); if (!view.raf) view.raf = requestAnimationFrame(viewLoop); });
function drawView(now) {
  const { w, h } = fit(viewCv);
  if (!w) return;
  const g = viewCv.getContext('2d');
  g.save();
  if (view.tumble > 0) {
    g.translate(w / 2, h / 2);
    g.rotate(view.tumble * 2.6);
    g.scale(1 + view.tumble * 0.3, 1 + view.tumble * 0.3);
    g.translate(-w / 2, -h / 2);
  }
  drawBay(g, w, h, { t: now / 1000, zoom: view.zoom, accent: PRO_COLORS[demo.color].ui, night: view.night });
  g.restore();
  if (view.dark > 0) { g.fillStyle = `rgba(8,9,10,${view.dark})`; g.fillRect(0, 0, w, h); }
}
function viewLoop(now) {
  view.raf = 0;
  if (!view.visible || document.hidden) return;
  drawView(now);
  if (!reducedMode) view.raf = requestAnimationFrame(viewLoop);
}
// Тест на падение, замедленный в 10 раз: свободное падение — Love Gen 5 — шайба дома — удар
dropBtn.addEventListener('click', () => {
  dropBtn.disabled = true;
  const k = reducedMode ? 0.01 : 10;
  const steps = [
    [0, '0 мс · телефон выскользнул. Шайба выдвинута на 20 мм.'],
    [0.004, '4 мс · акселерометр: свободное падение.'],
    [0.012, '12 мс · Love Gen 5 дал команду: «Домой».'],
    [0.08, '80 мс · шайба в корпусе. Объективы закрыты ободком.'],
    [0.32, '320 мс · удар об пол с 50 см. Гибкая плата спружинила.'],
  ];
  const tl = gsap.timeline({ onComplete: () => {
    dropBtn.disabled = false;
    dropNote.textContent = 'Цел. Шайба выдвинется снова, когда вы поднимете телефон. Показано в 10 раз медленнее.';
  } });
  for (const [t, text] of steps) tl.call(() => { dropNote.textContent = text; }, null, t * k);
  tl.to(view, { tumble: 1, duration: 0.08 * k, ease: 'power1.in' }, 0);
  tl.to(view, { dark: 0.92, duration: 0.07 * k, ease: 'power2.in' }, 0.01 * k);
  tl.to(view, { tumble: 1.6, duration: 0.24 * k, ease: 'power1.in' }, 0.08 * k);
  tl.to(view, { tumble: 0, dark: 0, duration: 0.5 * k, ease: 'power2.out' }, 0.32 * k + 0.6);
  if (!view.raf) view.raf = requestAnimationFrame(viewLoop);
});

/* ---------- Н Ш Ы И К Б. Гибкий кремний ---------- */

const bendSvg = $('[data-bend]');
const boardP = $('[data-board]');
const chipP = $('[data-chip]');
const grip = $('[data-grip]');
const bendIn = $('[data-bend-in]');
const rOut = $('[data-r-out]');
const bendNote = $('[data-bend-note]');
const silGrp = $('[data-silicon]');
const cracks = $('[data-cracks]');
let silicon = 'flex';
const B = { x0: 80, x1: 560, y: 200 };
function qpt(t, h) {
  const cy = B.y - 2 * h;
  const x = (1 - t) * (1 - t) * B.x0 + 2 * (1 - t) * t * 320 + t * t * B.x1;
  const y = (1 - t) * (1 - t) * B.y + 2 * (1 - t) * t * cy + t * t * B.y;
  return [x, y];
}
function paintBend() {
  const v = Number(bendIn.value);
  const h = (v / 100) * 120;
  boardP.setAttribute('d', `M${B.x0} ${B.y} Q320 ${B.y - 2 * h} ${B.x1} ${B.y}`);
  const broken = silicon === 'rigid' && v > 12;
  let d = '';
  if (broken) {
    // жёсткий кристалл не гнётся: стоит прямой хордой и лопается
    const [ax, ay] = qpt(0.3, h), [bx, by] = qpt(0.7, h);
    d = `M${ax} ${ay - 8} L${bx} ${by - 8}`;
    cracks.setAttribute('transform', `translate(0 ${ay - 22})`);
  } else {
    for (let i = 0; i <= 24; i++) { const [x, y] = qpt(0.3 + (i / 24) * 0.4, h); d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${(y - 8).toFixed(1)}`; }
  }
  chipP.setAttribute('d', d);
  bendSvg.classList.toggle('is-broken', broken);
  const [gx, gy] = qpt(0.5, h);
  grip.setAttribute('cx', gx); grip.setAttribute('cy', gy - 8);
  // радиус дуги: 18 мм на пределе
  const R = v < 1 ? Infinity : 18 * (100 / v);
  rOut.textContent = R === Infinity ? '∞' : `${Math.round(R)} мм`;
  if (v < 1) bendNote.textContent = 'Тяните точку на кристалле вверх.';
  else if (broken) bendNote.textContent = `Обычный кристалл 780 мкм треснул уже на радиусе ${Math.round(18 * (100 / 13))} мм. Вместе с ним — пайка под ним.`;
  else if (silicon === 'rigid') bendNote.textContent = 'Обычный кремний пока держит. Ещё чуть-чуть…';
  else bendNote.textContent = v > 95 ? 'Радиус 18 мм — так GP30 Pro и стоит в телефоне: обнимает колодец шайбы. Цел.' : `GP30 Pro, 25 мкм: изогнут до ${Math.round(R)} мм — и цел.`;
  bendIn.setAttribute('aria-valuetext', rOut.textContent);
}
bendIn.addEventListener('input', paintBend);
initRadioGroup(silGrp, (v) => { syncRadio(silGrp, v); silicon = v; paintBend(); });
let bendDrag = false;
function bendFromPointer(e) {
  const r = bendSvg.getBoundingClientRect();
  const y = ((e.clientY - r.top) / r.height) * 300;
  bendIn.value = String(Math.round(Math.max(0, Math.min(100, ((B.y - 8 - y) / 120) * 100))));
  paintBend();
}
grip.addEventListener('pointerdown', (e) => { bendDrag = true; bendSvg.setPointerCapture(e.pointerId); });
bendSvg.addEventListener('pointermove', (e) => { if (bendDrag) bendFromPointer(e); });
bendSvg.addEventListener('pointerup', () => { bendDrag = false; });
paintBend();

/* ---------- Ш И Н Б К М. Три слоя ---------- */

const vDots = $('[data-vc-dots]');
const vMin = $('[data-vmin]');
const vMinOut = $('[data-vmin-out]');
const vPro = $('[data-v-pro]');
const vOld = $('[data-v-old]');
const curvePro = (m) => 100 - 3 * (1 - Math.exp(-m / 8)) / (1 - Math.exp(-30 / 8));
const curveOld = (m) => 100 - 16 * (1 - Math.exp(-m / 6)) / (1 - Math.exp(-5));
function paintVapor() {
  const m = Number(vMin.value);
  vMinOut.textContent = m;
  vPro.textContent = `${Math.round(curvePro(m))} %`;
  vOld.textContent = `${Math.round(curveOld(m))} %`;
}
vMin.addEventListener('input', paintVapor);
paintVapor();
// пар: точки идут от кристалла через перемычки к краям верхнего слоя
const PATHS = [
  [[300, 205], [300, 171], [260, 171], [260, 111], [180, 111], [180, 51], [40, 51]],
  [[300, 205], [300, 171], [340, 171], [340, 111], [420, 111], [420, 51], [560, 51]],
];
const vapor = Array.from({ length: 14 }, (_, i) => ({ p: PATHS[i % 2], t: i / 14 }));
vDots.innerHTML = vapor.map(() => '<circle r="4"/>').join('');
const vCircles = $$('circle', vDots);
function pathPt(pts, t) {
  const segs = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
  let d = t * segs.reduce((a, b) => a + b, 0);
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i]) { const k = d / segs[i]; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k]; }
    d -= segs[i];
  }
  return pts[pts.length - 1];
}
let vapVisible = false;
function stepVapor(dt) {
  vapor.forEach((v, i) => {
    v.t = (v.t + dt * 0.22) % 1;
    const [x, y] = pathPt(v.p, v.t);
    vCircles[i].setAttribute('cx', x.toFixed(1));
    vCircles[i].setAttribute('cy', y.toFixed(1));
    vCircles[i].setAttribute('opacity', (1 - v.t * 0.7).toFixed(2));
  });
}
stepVapor(0);

/* ---------- К Н Ш М Ы Б И. 0,1–180 Гц ---------- */

const hzCv = $('[data-hz-cv]');
const hzGrp = $('[data-hz]');
const hzNote = $('[data-hz-note]');
const hzReal = $('[data-hz-real]');
const HZ_NOTE = {
  0.1: '0,1 Гц: часы на погасшем экране. Кадр в десять секунд — шарик стоит, а батарея почти не тратится.',
  1: '1 Гц: Always-On с уведомлениями.',
  10: '10 Гц: текст, который вы читаете не листая.',
  24: '24 Гц: кино, кадр в кадр.',
  60: '60 Гц: обычное видео и интерфейс.',
  120: '120 Гц: прокрутка.',
  180: '180 Гц: игра и прокрутка. Если ваш монитор медленнее, браузер нарисует столько, сколько может.',
};
const hz = { f: 180, last: 0, x: 0, visible: false, raf: 0, frames: [], real: 0 };
initRadioGroup(hzGrp, (v) => { syncRadio(hzGrp, v); hz.f = Number(v); hzNote.textContent = HZ_NOTE[v]; hz.last = 0; });
hzNote.textContent = HZ_NOTE[180];
function hzLoop(now) {
  hz.raf = 0;
  if (!hz.visible || document.hidden) return;
  hz.frames.push(now);
  if (hz.frames.length > 60) {
    hz.frames.shift();
    const real = Math.round(1000 / ((hz.frames[hz.frames.length - 1] - hz.frames[0]) / (hz.frames.length - 1)));
    if (Math.abs(real - hz.real) > 2) { hz.real = real; hzReal.textContent = `≈${real} Гц`; }
  }
  const period = 1000 / hz.f;
  if (!hz.last || now - hz.last >= period - 1) {
    hz.last = now;
    const { w, h, dpr } = fit(hzCv);
    if (w) {
      const g = hzCv.getContext('2d');
      g.fillStyle = 'rgba(0,0,0,1)';
      g.fillRect(0, 0, w, h);
      const t = now / 1000;
      const x = (0.5 + 0.42 * Math.sin(t * 2.2)) * w;
      g.fillStyle = PRO_COLORS[demo.color].ui;
      g.beginPath(); g.arc(x, h * 0.5, h * 0.12, 0, PI * 2); g.fill();
      g.fillStyle = 'rgba(238,234,224,.75)';
      g.font = `600 ${14 * dpr}px "JetBrains Mono", monospace`;
      g.textAlign = 'left';
      const d = new Date();
      g.fillText(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`, 16 * dpr, 26 * dpr);
      g.textAlign = 'right';
      g.fillText(`${String(hz.f).replace('.', ',')} Гц`, w - 16 * dpr, 26 * dpr);
    }
  }
  hz.raf = requestAnimationFrame(hzLoop);
}

/* ---------- Б К Ш М И Ы Н. E Ink и 0Pen 2 ---------- */

const inkGrp = $('[data-ink]');
const inkWrap = $('.o-ink');
const inkNote = $('[data-ink-note]');
const padCv = $('[data-pad]');
const penGrp = $('[data-pen-color]');
const pad = { strokes: [], color: 'black', drawing: null, version: 0, timer: 0 };
const INK_NOTE = {
  note: '0Pen 2: 8192 уровня нажатия, задержка 2 мс. Записка остаётся на спинке и без питания.',
  clock: 'Часы обновляются раз в минуту — только та часть бумаги, где поменялась цифра.',
  ticket: 'Посадочный на спинке: экран можно не будить, сканер читает бумагу.',
  book: 'Режим «Чтение»: книга со спинки, до трёх недель без зарядки.',
  rec: '«● REC»: пока «Тубус» снимает, на спинке видно, что идёт съёмка. Тот, кого снимают, знает об этом.',
};
function paintPad() {
  const { w, h } = fit(padCv);
  if (!w) return;
  const g = padCv.getContext('2d');
  g.clearRect(0, 0, w, h);
  const C = { black: '#17181A', red: '#A3352A', blue: '#2F5D88' };
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const s of pad.strokes) {
    g.strokeStyle = s.color === 'black' ? PRO_COLORS[demo.color].inkFg : C[s.color];
    g.lineWidth = s.width * w;
    g.beginPath();
    s.pts.forEach(([x, y], i) => (i ? g.lineTo(x * w, y * h) : g.moveTo(x * w, y * h)));
    g.stroke();
  }
  if (!pad.strokes.length) {
    g.fillStyle = 'rgba(22,23,26,.35)';
    g.font = `500 ${w * 0.06}px Georgia, serif`;
    g.textAlign = 'center';
    g.fillText('Пишите здесь —', w / 2, h * 0.46);
    g.fillText('появится на спинке', w / 2, h * 0.54);
  }
}
function pushInk() {
  clearTimeout(pad.timer);
  pad.timer = setTimeout(() => { pad.version++; updateInk(); }, 40);
}
function padPt(e) {
  const r = padCv.getBoundingClientRect();
  return [clamp01((e.clientX - r.left) / r.width), clamp01((e.clientY - r.top) / r.height)];
}
padCv.addEventListener('pointerdown', (e) => {
  padCv.setPointerCapture(e.pointerId);
  const pressure = e.pressure && e.pressure !== 0.5 ? e.pressure : 0.6;
  pad.drawing = { color: pad.color, width: 0.008 + pressure * 0.012, pts: [padPt(e)] };
  pad.strokes.push(pad.drawing);
  paintPad();
});
padCv.addEventListener('pointermove', (e) => {
  if (!pad.drawing) return;
  pad.drawing.pts.push(padPt(e));
  paintPad();
  pushInk();
});
const endStroke = () => { if (pad.drawing) { pad.drawing = null; pushInk(); } };
padCv.addEventListener('pointerup', endStroke);
padCv.addEventListener('pointercancel', endStroke);
$('[data-pad-clear]').addEventListener('click', () => {
  pad.strokes = [];
  paintPad();
  pad.version++;
  // стереть — полная перерисовка бумаги
  if (stage && current === 'eink') stage.setInk('clock', {}, true);
  setTimeout(() => updateInk(), 260);
});
initRadioGroup(penGrp, (v) => { syncRadio(penGrp, v); pad.color = v; });
initRadioGroup(inkGrp, (v) => {
  syncRadio(inkGrp, v);
  demo.ink = v;
  inkWrap.classList.toggle('is-note', v === 'note');
  inkNote.textContent = INK_NOTE[v];
  if (v === 'note') requestAnimationFrame(paintPad);
  updateInk();
});
inkWrap.classList.add('is-note');

/* ---------- Н К И Б М Ш Ы К. Love Gen 5 ---------- */

const heart = $('[data-heart]');
const heartNote = $('[data-heart-note]');
(function mesh() {
  let s = '';
  for (let i = 0; i < 14; i++) { const x = 14 + i * 13; s += `<line x1="${x}" y1="0" x2="${x - 30}" y2="180"/>`; }
  for (let i = 0; i < 14; i++) { const x = 14 + i * 13; s += `<line x1="${x - 30}" y1="0" x2="${x}" y2="180"/>`; }
  $('[data-mesh]').innerHTML = s;
  $('[data-mesh]').setAttribute('clip-path', 'url(#o-heart-clip)');
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = '<clipPath id="o-heart-clip"><path d="M100 168C40 120 8 90 8 52 8 26 28 8 54 8c20 0 36 12 46 28C110 20 126 8 146 8c26 0 46 18 46 44 0 38-32 68-92 116z"/></clipPath>';
  heart.querySelector('svg').prepend(defs);
})();
let heartBusy = false;
heart.addEventListener('click', () => {
  if (heartBusy) return;
  heartBusy = true;
  heart.classList.add('is-cut');
  heartNote.textContent = 'Сетка порвалась. Love Gen 5 стёр ключи за 3 мс — своим питанием, без аккумулятора телефона. Вскрыватель получил чип без единого секрета.';
  if (!reducedMode) gsap.fromTo(heart, { x: -4 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, .3)' });
  setTimeout(() => {
    heart.classList.remove('is-cut');
    heartNote.textContent = 'Это была демонстрация: ваш телефон цел. Любовь слепа. Love Gen 5 — нет.';
    heartBusy = false;
  }, 3200);
});

/* ---------- Ш Ы Н К М И Б. «Рубильник» и фонарь ---------- */

const swGrp = $('[data-sw]');
const swNote = $('[data-sw-note]');
const SW_NOTE = {
  1: '«Эфир»: модем, Wi-Fi, Bluetooth, UWB и GNSS обесточены. Камеры работают.',
  0: 'Середина: всё включено. Сигнальный фонарь на верхней грани — до 6000 м.',
  '-1': '«Тишина»: камеры, сканер, микрофоны и связь обесточены рукой. Шайба уехала в корпус, на спинке — «Тишина».',
};
initRadioGroup(swGrp, (v) => {
  syncRadio(swGrp, v);
  demo.sw = Number(v);
  swNote.textContent = SW_NOTE[v];
  updateScreen();
  updateInk();
});
const TORCH = {
  off: { mode: 'выключен' },
  white: { mode: 'белый · около 3500 м' },
  red: { mode: 'красный · до 6000 м' },
  sos: { mode: 'SOS · ··· ——— ···' },
};
const torchGrp = $('[data-torch]');
const darkEl = $('[data-dark]');
initRadioGroup(torchGrp, (v) => {
  syncRadio(torchGrp, v);
  demo.torch = v;
  stage?.setTorchColor(v === 'red' || v === 'sos' ? 'red' : 'white');
  updateScreen();
});
const SOS = [1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0];
function torchLevel(now) {
  if (demo.torch === 'off') return 0;
  if (demo.torch === 'sos') return SOS[Math.floor(now / 220) % SOS.length];
  return 1;
}

/* ---------- Ы Б Н М К Ш И Н. Цвета ---------- */

const COLOR_ORDER = ['iris', 'ink', 'paper', 'retina', 'amber'];
const COLOR_NOTES = {
  iris: '«Радужка». Глубокий сине-зелёный, титан с бирюзовым отливом. Бумага E Ink под ним — цвета морской воды.',
  ink: '«Чернила». Чёрное стекло и тёмный титан. E Ink здесь наоборот: светлые буквы на тёмной бумаге.',
  paper: '«Бумага». Слоновая кость и шампанский титан — как страница, на которой всё это напечатано.',
  retina: '«Сетчатка». Коралловый, как глазное дно на снимке сканера. Титан с розовым золотом.',
  amber: '«Янтарь». Жжёный оранжевый и бронзовый титан — цвет лампы в маяке Fyr.',
};
const colorGrps = [$('[data-colors]'), $('[data-colors-buy]')];
const colorNote = $('[data-color-note]');
const buyColor = $('[data-buy-color]');
function applyColor(v, { instant = false, twirl = true } = {}) {
  if (!PRO_COLORS[v]) return;
  const changed = v !== demo.color;
  demo.color = v;
  colorGrps.forEach((g) => syncRadio(g, v));
  root.dataset.color = v;
  root.style.setProperty('--ink-paper', PRO_COLORS[v].paper);
  store.set('oy-x5p-color', v);
  colorNote.textContent = COLOR_NOTES[v];
  buyColor.textContent = PRO_COLORS[v].label;
  stage?.setBodyColor(v, instant);
  paintPad();
  if (changed && twirl && !instant && !reducedMode) gsap.fromTo(demo, { twirl: 0 }, { twirl: 1, duration: 1.1, ease: 'power3.inOut', onComplete: () => { demo.twirl = 0; } });
}
colorGrps.forEach((g) => initRadioGroup(g, (v) => applyColor(v)));
function setColors(p) {
  const idx = Math.min(COLOR_ORDER.length - 1, Math.floor(span(p, 0.05, 0.95) * COLOR_ORDER.length));
  if (idx !== demo.colorIdx) { demo.colorIdx = idx; applyColor(COLOR_ORDER[idx]); }
}
root.style.setProperty('--ink-paper', PRO_COLORS.iris.paper);
const saved = root.dataset.color;
if (saved && saved !== 'iris') { applyColor(saved, { instant: true }); demo.colorIdx = COLOR_ORDER.indexOf(saved); }

/* ---------- ○ X ○. Купить ---------- */

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
$('[data-buy]').addEventListener('click', () => toast('Купить здесь нельзя: это концепт. Зато зрение у вас — единица.'));

/* ---------- Хореография ---------- */

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
  // Ключи главы — не раньше −0,4 экрана до её начала и не позже середины главы (у закреплённых — 0,8 пина).
  // Без телефона он уплывает вверх вместе с текстом и приходит снизу уже развёрнутым.
  keyLog.length = 0;
  const K = (id, f, props) => { keyLog.push({ id, f }); Keys.add(sts[id], f, props); };
  const leave = (pose) => ({ ...pose, y: pose.y + 1.3, vis: 0, float: 0 });
  const enter = (pose) => ({ ...pose, y: pose.y - 1.3, vis: 0, float: 0 });
  const show = (id, pose, prev, end = 0.35) => {
    if (prev) K(id, -0.55, leave(prev));
    K(id, -0.4, enter(pose));
    K(id, -0.1, pose);
    K(id, end, pose);
  };
  K('hero', -1, P.hero);
  K('hero', 0, P.hero);
  if (P.mobile) {
    for (const id of ['cpix', 'retina', 'vapor', 'eink', 'switch']) {
      K(id, -0.4, enter(P[id]));
      K(id, -0.1, P[id]);
      K(id, 0.06, P[id]);
      K(id, 0.24, leave(P[id]));
    }
  } else {
    show('cpix', P.cpix, P.hero);
    show('retina', P.retina, P.cpix);
    K('tube', -0.55, leave(P.retina));
    show('vapor', P.vapor);
    K('hz', -0.55, leave(P.vapor));
    show('eink', P.eink);
    K('love', -0.55, leave(P.eink));
    show('switch', P.switch);
    K('colors', -0.55, leave(P.switch));
  }
  K('tube', -0.4, enter(P.tube0));
  K('tube', 0.1, P.tube0);
  K('tube', 0.78, P.tube1);
  K('zoom', -0.3, leave(P.tube1));
  K('colors', -0.4, enter(P.colors));
  K('colors', -0.1, P.colors);
  K('colors', 0.7, P.colors);
  K('buy', -0.4, leave(P.colors));
  K('buy', 0.3, leave(P.colors));
}

function buildChoreography({ isMobile, reduce }) {
  reducedMode = reduce;
  stage?.setReduced(reduce);
  if (reduce) smooth.disable(); else smooth.enable();
  const SETTERS = { tube: setTube, colors: setColors };
  for (const id of CHAPTERS) {
    if (PINNED[id]) {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: sections[id], start: 'top top', end: reduce ? 'bottom top' : PINNED[id], pin: !reduce, scrub: reduce ? false : true, anticipatePin: 1,
          onUpdate: (st) => SETTERS[id](st.progress),
        },
      });
      tl.set({}, {}, 1);
      sts[id] = tl.scrollTrigger;
    } else {
      sts[id] = ScrollTrigger.create({ trigger: sections[id], start: 'top top', end: 'bottom top' });
    }
  }
  setTube(reduce ? 1 : 0);
  Keys.reset();
  addKeys(makePoses(isMobile));
  if (!reduce) {
    for (const { el, words } of splitHeads) {
      if (el.closest('#hero')) continue;
      gsap.fromTo(words, { yPercent: 110, opacity: 0 }, {
        yPercent: 0, opacity: 1, duration: 0.9, ease: 'power4.out', stagger: 0.05,
        scrollTrigger: { trigger: el, start: 'top 86%', toggleActions: 'play none none reverse' },
      });
    }
    // строки таблицы «проявляются» буква за буквой, как на бумаге при перерисовке
    $$('.o-row b').forEach((b) => {
      if (b.closest('#hero')) return;
      gsap.fromTo(b, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.6, ease: 'steps(6)', scrollTrigger: { trigger: b, start: 'top 90%', toggleActions: 'play none none none' } });
    });
    $$('[data-reveal], .o-lead, .o-specs div, .o-buy__panel, .o-cpix, .o-retina, .o-scope, .o-bend, .o-hz, .o-ink, .o-love').forEach((el) => {
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
  const vis = (sel, cb) => ScrollTrigger.create({ trigger: sel, start: 'top bottom', end: 'bottom top', onToggle: (st) => cb(st.isActive) });
  vis('[data-view]', (on) => { view.visible = on; if (on && !view.raf) view.raf = requestAnimationFrame(viewLoop); });
  vis('[data-hz-cv]', (on) => { hz.visible = on; if (on && !hz.raf) hz.raf = requestAnimationFrame(hzLoop); });
  vis('[data-vc]', (on) => { vapVisible = on; });
  vis('[data-retina]', (on) => { if (on) drawRet(); });
  vis('[data-pad]', (on) => { if (on) paintPad(); });
}

/* ---------- Каждый тик: прокрутка → модель ---------- */

let lastY = -1;
let lastDetect = 0;
let dark = 0;
let lastT = performance.now();
const pointer = { x: 0, y: 0 };
function tick() {
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  const y = window.scrollY;
  if (y !== lastY || now - lastDetect > 500) { lastY = y; lastDetect = now; detectChapter(); }
  if (vapVisible && !reducedMode) stepVapor(dt);

  const torch = current === 'switch' ? torchLevel(now) : 0;
  const wantDark = current === 'switch' && demo.torch !== 'off' ? 0.82 : 0;
  dark += (wantDark - dark) * (reducedMode ? 1 : 1 - Math.exp(-dt * 4));
  darkEl.style.opacity = dark.toFixed(3);
  root.classList.toggle('o-dark', dark > 0.4);
  if (Keys.empty || !stage) return;
  const v = Keys.sample(y, reducedMode);
  // на первом экране телефон поворачивается к курсору сильнее обычного — «следит»
  if (current === 'hero' && !reducedMode) {
    v.ry = (v.ry ?? 0) + pointer.x * 0.35;
    v.rx = (v.rx ?? 0) + pointer.y * 0.2;
  }
  if (demo.twirl) v.spin = ease(demo.twirl) * 2 * PI;
  v.sw = current === 'switch' ? demo.sw : 0;
  if (current === 'switch' && demo.sw === -1) v.ext = 0;
  v.torch = torch;
  const visK = clamp01(v.vis ?? 1);
  canvas.style.opacity = visK.toFixed(3);
  stage.setActive(visK > 0.02 && !document.hidden);
  stage.setTarget(v);
}
gsap.ticker.add(tick);
if (params.has('debug')) window.__x5p = { stage, Keys, ScrollTrigger, sts, demo, checkKeys };

window.addEventListener('pointermove', (e) => {
  if (!stage || reducedMode || e.pointerType === 'touch') return;
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  stage.setPointer(pointer.x, pointer.y);
  if (!eyeSeen && current === 'hero' && Math.abs(pointer.x) > 0.3) { eyeSeen = true; eyeNote.textContent = 'Видит. Камеры подняты, Love Gen 5 записал это в журнал «Века 2».'; }
}, { passive: true });
window.addEventListener('resize', () => { stage?.resize(); lastY = -1; drawRet(); paintPad(); });

/* ---------- Запуск ---------- */

async function boot() {
  const timeout = (ms) => new Promise((r) => setTimeout(r, ms));
  const fonts = document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve();
  await Promise.race([Promise.all([fonts, stage ? stage.ready : null, timeout(300)]), timeout(12000)]);
  stage?.redrawScreen();
  setZoom(1);
  drawRet();
  paintPad();

  const mm = gsap.matchMedia();
  mm.add({
    isMobile: '(max-width: 760px)', isDesktop: '(min-width: 761px)',
    reduce: '(prefers-reduced-motion: reduce)', motion: '(prefers-reduced-motion: no-preference)',
  }, (ctx) => buildChoreography(ctx.conditions));

  const loader = $('#loader');
  const hideLoader = () => { loader.classList.add('is-done'); loader.setAttribute('aria-hidden', 'true'); };
  setTimeout(hideLoader, reducedMode ? 0 : 700);
  setTimeout(hideLoader, 1600);
  updateScreen(true);
  updateInk();
  setTimeout(() => { booted = true; }, 1200);

  // первый экран: телефон издалека, разворачивается лицом к вам
  if (!reducedMode && stage && window.scrollY < 10) {
    const P = makePoses(window.matchMedia('(max-width: 760px)').matches);
    stage.setTarget(P.far);
    stage.snap();
    const k = { t: 0 };
    let introDone = false;
    const sample = Keys.sample.bind(Keys);
    let intro = null;
    Keys.sample = (yy, r) => {
      if (!introDone && window.scrollY > 40) { introDone = true; intro?.kill(); Keys.sample = sample; }
      if (introDone) return sample(yy, r);
      const pose = {};
      for (const key in P.hero) pose[key] = P.far[key] + (P.hero[key] - P.far[key]) * k.t;
      return pose;
    };
    intro = gsap.to(k, {
      t: 1, duration: 2.2, ease: 'expo.out', delay: 0.7,
      onUpdate: () => { if (window.scrollY > 40) { intro.kill(); introDone = true; Keys.sample = sample; } },
      onComplete: () => { introDone = true; Keys.sample = sample; },
    });
    const hero = splitHeads.find(({ el }) => el.closest('#hero'));
    if (hero) gsap.from(hero.words, { yPercent: 115, opacity: 0, duration: 1.1, ease: 'power4.out', stagger: 0.1, delay: 1 });
    gsap.from('.o-hero > *:not(.o-hero__title)', { opacity: 0, y: 20, duration: 0.9, ease: 'power3.out', stagger: 0.08, delay: 1.3 });
    gsap.from('.o-hero__chart span', { opacity: 0, duration: 0.01, stagger: 0.25, delay: 0.4, ease: 'steps(1)' });
    gsap.from('.o-chart li', { opacity: 0, x: -10, duration: 0.5, stagger: 0.04, delay: 1.2 });
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
