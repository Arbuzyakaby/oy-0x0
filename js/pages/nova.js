/* =========================================================================
   OY 0X Nova — «Обсерватория». Обычная прокрутка; сцены держит GSAP
   ScrollTrigger, поза модели — ключевые кадры по главам (js/core/keys.js).
   За главами — ночное небо (nova-sky.js): курсор — перо 0Pen, им рисуют
   созвездия; в главе «Зум» прокрутка ведёт небо по шкале пяти камер.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage } from '../core/stage.js';
import { createKeys } from '../core/keys.js';
import { createOYNova, CAMS, ZOOM_STOPS } from '../models/oynova.js';
import { PRODUCTS, getConfig } from '../data/products.js';
import { $, $$, clamp01, store, createToast, syncRadio, initRadioGroup, bindStubs } from '../core/ui.js';
import { createSmoothScroll } from '../core/scroll.js';
import { createSky } from './nova-sky.js';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const root = document.documentElement;
const PI = Math.PI;
const PRODUCT = PRODUCTS.nova;
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const fineMQ = window.matchMedia('(pointer: fine)');
const params = new URLSearchParams(location.search);
const toast = createToast($('#toast'), gsap);
const announce = $('[data-announce]');
bindStubs(toast);

/* ---------- Небо ---------- */

const sky = createSky($('#sky'), { store, reduce: reduceMQ.matches });
window.addEventListener('resize', () => sky.resize());

/* ---------- 3D ---------- */

const canvas = $('#stage');
let stage = null;
try {
  stage = createStage(canvas, createOYNova, { forceFallback: params.has('fallback') });
} catch (err) {
  console.warn('[OY] WebGL недоступен, 3D отключено.', err);
  canvas.style.display = 'none';
}

/* ---------- Главы ---------- */

const CHAPTERS = ['nova', 'observatory', 'zoom', 'sensors', 'selfie', 'pen', 'display', 'argon', 'nogames', 'torch', 'citadel', 'power', 'buy'];
const sections = Object.fromEntries(CHAPTERS.map((id) => [id, document.getElementById(id)]));
let current = 'nova';

function detectChapter() {
  const line = window.innerHeight * 0.5;
  let id = CHAPTERS[0];
  for (const c of CHAPTERS) if (sections[c].getBoundingClientRect().top <= line) id = c;
  if (id !== current) {
    current = id;
    onChapter(id);
  }
}

// Экран модели по главам
const SCREEN = { zoom: 'camera', sensors: 'camera', selfie: 'camera', pen: 'pen' };
let blockedUntil = 0;
function updateScreen() {
  if (!stage) return;
  if (performance.now() < blockedUntil) { stage.setScreen('blocked'); return; }
  const mode = SCREEN[current] || 'lock';
  if (mode === 'camera') stage.setScreen('camera', { zoom: current === 'zoom' ? zoomState.sky : 1, stop: current === 'zoom' ? zoomState.stop : 1 });
  else stage.setScreen(mode);
}
function onChapter(id) {
  updateScreen();
  if (id === 'torch') applyTorch();
}

/* ---------- Позы модели ---------- */

// x/y — доля половины видимой ширины/высоты; fx/fy/fz — точка модели, которая ставится в (x, y)
const BASE = { x: 0, y: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: 0, rz: 0, dist: 5.2, float: 1, vis: 1, pen: 0, laser: 0, spectral: 0, tk: 0, gk: 0 };
function makePoses(mobile) {
  const P = {
    hero: { x: 0.42, rx: 0.08, ry: PI - 0.55, rz: 0.05, dist: 5.0 },
    observatory: { x: 0.42, fx: 0.12, fy: 0.22, rx: 0.1, ry: PI - 0.3, dist: 4.4, gk: 1 },
    zoom: { x: 0.54, y: -0.1, fx: 0.18, fy: 0.52, fz: -0.05, rx: 0.06, ry: PI - 0.2, dist: 3.4, float: 0.25, gk: 1 },
    sensors: { x: -0.44, fx: 0.1, fy: 0.46, fz: -0.05, rx: 0.12, ry: PI + 0.38, dist: 2.0, float: 0.25, laser: 1, spectral: 1 },
    selfie: { x: 0.42, fy: 0.62, rx: 0.05, ry: -0.25, dist: 2.3, float: 0.4 },
    pen: { x: -0.4, y: 0.05, fy: -0.5, rx: 0.12, ry: -0.5, rz: 0.32, dist: 5.6, pen: 0.62 },
    display: { x: 0.42, rx: 0.04, ry: 0.95, dist: 4.6 },
    hidden: { x: 0.4, rx: 0.1, ry: PI - 0.4, dist: 6, float: 0, vis: 0 },
    nogames: { x: -0.42, rx: 0.04, ry: -0.25, dist: 4.8 },
    torch: { x: 0.4, y: -0.3, fy: 0.4, rx: 0.5, ry: -0.6, dist: 4.6, tk: 1 },
  };
  for (const k in P) P[k] = { ...BASE, ...P[k] };
  if (!mobile) return P;
  // телефон: модель в верхней части экрана, текст ниже
  for (const k in P) {
    const p = P[k];
    P[k] = { ...p, x: 0, y: 0.45, dist: p.dist * (p.dist < 3 ? 1.5 : 1.75) };
  }
  return P;
}

const Keys = createKeys();
const sts = {};
let reducedMode = reduceMQ.matches;
const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ });

/* ---------- Зум: прокрутка ведёт небо по шкале пяти камер ---------- */

// Участки прокрутки пина: стоянка камеры → переход к следующей. 6–14× — плавно
const ZOOM_TRACK = [
  [0, 0.1, 0.6, 0.6, 0], [0.1, 0.18, 0.6, 1, 1], [0.18, 0.28, 1, 1, 1], [0.28, 0.36, 1, 3, 2], [0.36, 0.46, 3, 3, 2],
  [0.46, 0.52, 3, 6, 3], [0.52, 0.78, 6, 14, 3], [0.78, 0.84, 14, 14, 3], [0.84, 0.9, 14, 1, 4], [0.9, 1.01, 1, 1, 4],
];
const STOP_AT = [0.05, 0.23, 0.41, 0.65, 0.95];
const ZOOM_TEXT = [
  ['Сверхширокая', '50 МП · 120° · автофокус · макро от 3 см'],
  ['Основная', '50 МП · сенсор 1,1" · f/1.4–4.0 · OIS'],
  ['Телевик', '50 МП · сенсор 1" · 3× · f/2.0 · OIS'],
  ['Перископ', '200 МП · плавающая линза · 6–14× без потерь'],
  ['Монохромная', '50 МП · без цветного фильтра · честное ч/б'],
];
const zoomState = { x: 0.6, stop: 0, sky: 1, p: 0 };
const zx = $('[data-zoom-x]');
const zcam = $('[data-zoom-cam]');
const zspec = $('[data-zoom-spec]');
const zbtns = $$('[data-zoom-scale] button');
// целые — без дроби, между ступенями — с одной цифрой после запятой
const fmtX = (x) => `${Math.abs(x - Math.round(x)) < 0.05 ? Math.round(x) : x.toFixed(1).replace('.', ',')}×`;
let lastStop = -1;
let lastLabel = '';
function setZoom(p) {
  zoomState.p = p;
  const seg = ZOOM_TRACK.find(([a, b]) => p >= a && p < b) || ZOOM_TRACK[ZOOM_TRACK.length - 1];
  const [a, b, z0, z1, stop] = seg;
  const t = smoothT((p - a) / (b - a));
  // переход между камерами — по логарифму, как в настоящем видоискателе
  const x = Math.exp(Math.log(z0) + (Math.log(z1) - Math.log(z0)) * t);
  zoomState.x = x;
  zoomState.stop = stop;
  zoomState.sky = x / 0.6;
  const label = stop === 4 ? 'Mono' : fmtX(x);
  if (label !== lastLabel) { zx.textContent = label; lastLabel = label; }
  if (stop !== lastStop) {
    lastStop = stop;
    zcam.textContent = ZOOM_TEXT[stop][0];
    zspec.textContent = ZOOM_TEXT[stop][1];
    zbtns.forEach((btn, i) => btn.classList.toggle('is-on', i === stop));
    announce.textContent = `${ZOOM_TEXT[stop][0]}, ${ZOOM_STOPS[stop].label}`;
  }
  sky.state.mono = stop === 4;
  $('#sky').style.filter = stop === 4 ? 'grayscale(1) contrast(1.15)' : '';
  if (current === 'zoom') updateScreen();
}
const smoothT = (t) => { const c = clamp01(t); return c * c * (3 - 2 * c); };
zbtns.forEach((btn, i) => btn.addEventListener('click', () => {
  const st = sts.zoom;
  if (!st) return;
  const y = st.start + STOP_AT[i] * (st.end - st.start);
  if (smooth.lenis) smooth.lenis.scrollTo(y, { duration: 1.2 });
  else window.scrollTo({ top: y, behavior: reducedMode ? 'auto' : 'smooth' });
}));

/* ---------- Хореография ---------- */

function buildChoreography({ isMobile, reduce }) {
  reducedMode = reduce;
  stage?.setReduced(reduce);
  sky.setReduced(reduce);
  if (reduce) smooth.disable(); else smooth.enable();
  Keys.reset();
  const P = makePoses(isMobile);

  for (const id of CHAPTERS) {
    if (id === 'zoom') {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: sections.zoom, start: 'top top', end: reduce ? 'bottom top' : '+=360%', pin: !reduce, scrub: reduce ? false : true, anticipatePin: 1,
          onUpdate: (st) => setZoom(st.progress),
        },
      });
      tl.set({}, {}, 1);
      sts.zoom = tl.scrollTrigger;
    } else {
      sts[id] = ScrollTrigger.create({ trigger: sections[id], start: 'top top', end: 'bottom top' });
    }
  }
  if (reduce) {
    // без анимаций: шкала камер — кнопками, по одной ступени
    zbtns.forEach((btn, i) => { btn.onclick = () => setZoom(STOP_AT[i]); });
  }

  const K = (id, f, props) => Keys.add(sts[id], f, props);
  const hold = (id, pose) => { K(id, -0.4, pose); K(id, 0.55, pose); };
  K('nova', -1, P.hero);
  hold('nova', P.hero);
  hold('observatory', P.observatory);
  K('zoom', -0.4, P.zoom);
  K('zoom', 1, P.zoom);
  hold('sensors', P.sensors);
  hold('selfie', P.selfie);
  hold('pen', P.pen);
  hold('display', P.display);
  hold('argon', P.hidden);
  hold('nogames', P.nogames);
  hold('torch', P.torch);
  for (const id of ['citadel', 'power']) hold(id, P.hidden);
  K('buy', -0.2, P.hidden);
  K('buy', 1, P.hidden);

  // Небо: в главе «Зум» — режим зума, у «Фонаря» — темнее
  ScrollTrigger.create({
    trigger: sections.zoom, start: 'top 60%', end: () => `+=${(sts.zoom.end - sts.zoom.start) + window.innerHeight * 0.8}`,
    onToggle: (st) => gsap.to(sky.state, { zoomOn: st.isActive ? 1 : 0, duration: reduce ? 0 : 0.8, ease: 'power2.out', overwrite: 'auto',
      onComplete: () => { if (!st.isActive) { sky.state.mono = false; $('#sky').style.filter = ''; } } }),
  });
  ScrollTrigger.create({
    trigger: sections.torch, start: 'top 55%', end: 'bottom 45%',
    onToggle: (st) => gsap.to(sky.state, { dim: st.isActive ? 0.55 : 0, duration: reduce ? 0 : 0.6, overwrite: 'auto' }),
  });

  // Зарядка 0 → 100 % по прокрутке
  const fill = $('[data-charge-fill]');
  const setCharge = (p) => {
    fill.style.setProperty('--p', p.toFixed(3));
    $('[data-charge-pct]').textContent = String(Math.round(p * 100));
    $('[data-charge-min]').textContent = String(Math.round(p * 34));
  };
  if (reduce) setCharge(1);
  else ScrollTrigger.create({ trigger: $('[data-charge]'), start: 'top 85%', end: 'bottom 40%', scrub: true, onUpdate: (st) => setCharge(st.progress) });

  // Появление текста глав — короткий сдвиг
  if (!reduce) {
    $$('.nv__text > *').forEach((el) => {
      gsap.fromTo(el, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none none' } });
    });
  }

  setZoom(0);
  ScrollTrigger.refresh();
  return () => Keys.reset();
}
ScrollTrigger.addEventListener('refresh', () => { Keys.compile(window.innerHeight); detectChapter(); });

/* ---------- 1. Камеры: подсветка на модели ---------- */

let camHover = null;
$$('[data-cam]').forEach((b) => {
  const on = () => { camHover = b.dataset.cam; };
  const off = () => { if (camHover === b.dataset.cam) camHover = null; };
  b.addEventListener('pointerenter', on);
  b.addEventListener('focus', on);
  b.addEventListener('pointerleave', off);
  b.addEventListener('blur', off);
  b.addEventListener('click', on);
});
const camBtns = Object.fromEntries($$('[data-cam]').map((b) => [b.dataset.cam, b]));
let lastCam = null;
function activeCam(now) {
  if (current === 'zoom') return ZOOM_STOPS[zoomState.stop].cam;
  return camHover || CAMS[Math.floor(now / 1500) % CAMS.length];
}

/* ---------- 3. Лазер и спектр ---------- */

{
  const box = $('[data-laser]');
  const beam = $('.laser__beam', box);
  const read = $('[data-laser-read]');
  let timer = 0;
  $$('.laser__obj', box).forEach((obj) => obj.addEventListener('click', () => {
    $$('.laser__obj', box).forEach((o) => o.classList.remove('is-hit'));
    const br = box.getBoundingClientRect();
    const or = obj.getBoundingClientRect();
    const dx = or.left + or.width / 2 - (br.left + br.width / 2);
    const dy = br.bottom - (or.top + or.height / 2);
    beam.style.height = `${Math.hypot(dx, dy)}px`;
    beam.style.transform = `rotate(${Math.atan2(dx, dy)}rad)`;
    gsap.fromTo(beam, { opacity: 0, scaleY: 0 }, { opacity: 1, scaleY: 1, duration: reducedMode ? 0 : 0.25, ease: 'power2.out' });
    read.textContent = 'Меряем…';
    clearTimeout(timer);
    timer = setTimeout(() => {
      obj.classList.add('is-hit');
      read.innerHTML = `${obj.querySelector('span').textContent}: ${obj.dataset.dist}`;
      gsap.to(beam, { opacity: 0, duration: 0.6, delay: 0.5 });
    }, reducedMode ? 0 : 280);
  }));

  const LIGHT = {
    candle: ['linear-gradient(90deg,#120400 0%,#5a1200 30%,#c84a00 60%,#ffb347 85%,#ffe2a8 100%)', 'rgba(255,128,30,.55)'],
    lamp: ['linear-gradient(90deg,#1b0d00 0%,#7a3a00 30%,#e08a20 60%,#ffd27a 85%,#fff1cc 100%)', 'rgba(255,180,80,.4)'],
    neon: ['linear-gradient(90deg,#000 0%,#000 18%,#3050ff 20%,#000 24%,#000 52%,#ff2a8a 55%,#000 60%,#000 78%,#ff5a2a 81%,#000 86%)', 'rgba(255,50,170,.45)'],
    moon: ['linear-gradient(90deg,#0a1440 0%,#2a4cc8 35%,#9ab4ff 65%,#dfe6ff 100%)', 'rgba(90,130,255,.42)'],
  };
  const grp = $('[data-light-src]');
  const setLight = (v) => {
    syncRadio(grp, v);
    $('[data-spectrum]').style.setProperty('--spec', LIGHT[v][0]);
    $('[data-pic-raw]').style.setProperty('--tint', LIGHT[v][1]);
  };
  initRadioGroup(grp, setLight);
  setLight('candle');
}

/* ---------- 4. Квадратная фронталка ---------- */

{
  const grp = $('[data-crop]');
  const box = $('[data-crop-box]');
  const cap = $('[data-crop-cap]');
  const CROP = {
    v: ['56.25%', '100%', '1:1 → 9:16 · в кадре один человек'],
    h: ['100%', '56.25%', '1:1 → 16:9 · в кадре вся компания'],
    s: ['100%', '100%', '1:1 · всё, что увидел сенсор 75 МП'],
  };
  initRadioGroup(grp, (v) => {
    syncRadio(grp, v);
    box.style.setProperty('--cw', CROP[v][0]);
    box.style.setProperty('--ch', CROP[v][1]);
    cap.textContent = CROP[v][2];
  });
}

/* ---------- 5. Перо: созвездия, «Затвор» ---------- */

const countEl = $('[data-lines-count]');
sky.onChange((n) => { countEl.textContent = `Линий: ${n}`; });
const INTERACTIVE = 'a, button, input, select, textarea, label, summary, [role="radio"], [role="radiogroup"], table, canvas, .order__card, .zoom-panel, .sensor, .cit, .pw, .pen-desk';
{
  let down = null;
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    sky.pointer(e.clientX, e.clientY, true);
  }, { passive: true });
  document.addEventListener('pointerleave', () => sky.pointer(0, 0, false));
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || e.button !== 0 || e.target.closest(INTERACTIVE)) { down = null; return; }
    down = { x: e.clientX, y: e.clientY };
  });
  document.addEventListener('pointerup', (e) => {
    if (!down || e.pointerType === 'touch') return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6;
    down = null;
    if (moved || window.getSelection()?.toString()) return;
    sky.tap(e.clientX, e.clientY, 18);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') sky.endChain();
  });
}

// Перо на телефоне: слой поверх страницы ловит касания, прокрутка на это время выключена
{
  const layer = $('[data-pen-layer]');
  const toggle = $('[data-pen-toggle]');
  const dockShot = $('.pen-dock__shot');
  const setPen = (on) => {
    toggle.setAttribute('aria-pressed', String(on));
    layer.hidden = !on;
    dockShot.hidden = !on;
    if (on) toast('Перо: касайтесь звёзд по очереди. Пустое место завершает созвездие.');
    else sky.endChain();
  };
  toggle.addEventListener('click', () => setPen(toggle.getAttribute('aria-pressed') !== 'true'));
  layer.addEventListener('pointerdown', (e) => {
    sky.pointer(e.clientX, e.clientY, true);
    const r = sky.tap(e.clientX, e.clientY, 30);
    if (r === 'star') navigator.vibrate?.(8);
  });
}

const shots = $('[data-shots]');
let lastShot = null;
function shutter() {
  const snap = sky.snapshot();
  const sig = sky.signature();
  lastShot = { snap, sig };
  const fig = document.createElement('figure');
  fig.className = 'polaroid';
  fig.style.setProperty('--r', `${(Math.random() * 6 - 3).toFixed(1)}deg`);
  const c = document.createElement('canvas');
  c.width = 240; c.height = 160;
  c.getContext('2d').drawImage(snap, 0, 0, 240, 160);
  const cap = document.createElement('figcaption');
  cap.textContent = `${sky.count ? `Созвездие · ${sky.count} лин.` : 'Ночное небо'} · подписано Citadel 4 Plus · ${sig}`;
  fig.append(c, cap);
  shots.prepend(fig);
  while (shots.children.length > 3) shots.lastChild.remove();
  drawVerify();
  stage?.setScreen('camera', { zoom: 1, stop: 1 });
  setTimeout(updateScreen, 900);
  announce.textContent = 'Снимок сделан и подписан Citadel 4 Plus.';
  if (!$('#pen').contains(document.activeElement)) toast('Щёлк. Кадр подписан Citadel 4 Plus — проверить можно в главе Citadel.');
}
$$('[data-shutter]').forEach((b) => b.addEventListener('click', shutter));
$('[data-sky-clear]').addEventListener('click', () => { sky.clear(); toast('Небо чистое.'); });
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest?.('input, textarea, select, button, a, [role="radio"]')) return;
  if (current !== 'pen') return;
  e.preventDefault();
  shutter();
});

/* ---------- 8. Без игр ---------- */

{
  const blocked = $('[data-blocked]');
  $$('[data-app]').forEach((app) => app.addEventListener('click', () => {
    const name = app.querySelector('span').textContent;
    if (app.dataset.app !== 'game') { toast(`«${name}» открывается. С ним всё в порядке.`); return; }
    blocked.hidden = false;
    app.classList.remove('is-denied');
    void app.offsetWidth;
    app.classList.add('is-denied');
    navigator.vibrate?.([30, 40, 30]);
    blockedUntil = performance.now() + 4000;
    updateScreen();
    setTimeout(updateScreen, 4100);
  }));
}

/* ---------- 9. Фонарь ---------- */

let torch = 'white';
const torchGrp = $('[data-torch]');
function applyTorch() {
  syncRadio(torchGrp, torch);
  stage?.setSignalColor(torch === 'red' ? 'red' : 'white');
}
initRadioGroup(torchGrp, (v) => { torch = v; applyTorch(); });
applyTorch();

/* ---------- 10. Citadel 4 Plus ---------- */

const origC = $('[data-shot-orig]');
const editC = $('[data-shot-edit]');
function drawVerify() {
  const snap = lastShot?.snap || sky.snapshot();
  for (const c of [origC, editC]) {
    const g = c.getContext('2d');
    g.drawImage(snap, 0, 0, c.width, c.height);
  }
  // «подправленный»: дорисована лишняя яркая звезда и надпись
  const g = editC.getContext('2d');
  const gr = g.createRadialGradient(176, 46, 0, 176, 46, 26);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.2, 'rgba(255,200,120,.8)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(150, 20, 52, 52);
  g.fillStyle = 'rgba(255,90,60,.9)';
  g.font = '600 11px "JetBrains Mono", monospace';
  g.fillText('+ комета', 150, 150);
  $('[data-verify-res]').className = 'verify__res mono';
}
drawVerify();
$$('[data-check]').forEach((b) => b.addEventListener('click', () => {
  const res = $('[data-verify-res]');
  const sig = lastShot?.sig || sky.signature();
  if (b.dataset.check === 'orig') {
    res.className = 'verify__res mono is-ok';
    res.textContent = `✓ Подпись совпадает: снято камерой 0X Nova, кадр не изменён · ${sig}`;
  } else {
    res.className = 'verify__res mono is-bad';
    res.textContent = '✗ Подпись не совпадает: после съёмки кадр изменили';
  }
}));
{
  const box = $('[data-clean]');
  const send = $('[data-clean-send]');
  const reset = $('[data-clean-reset]');
  const res = $('[data-clean-res]');
  $$('.clean__meta li', box).forEach((li, i) => li.style.setProperty('--r', `${(i % 2 ? -1 : 1) * (8 + i * 5)}deg`));
  send.addEventListener('click', () => {
    box.classList.add('is-sent');
    send.hidden = true;
    reset.hidden = false;
    res.textContent = 'Ушёл только кадр. Геометка, модель и серийный номер остались у вас.';
  });
  reset.addEventListener('click', () => {
    box.classList.remove('is-sent');
    send.hidden = false;
    reset.hidden = true;
    res.textContent = '';
  });
}

/* ---------- 7. Argon ---------- */

{
  const grp = $('[data-argon-switch]');
  const die = $('[data-die]');
  const cap = $('[data-argon-cap]');
  initRadioGroup(grp, (v) => {
    syncRadio(grp, v);
    die.dataset.die = v;
    cap.innerHTML = v === 'nova' ? 'Nova: графика меньше вдвое, ISP и&nbsp;NPU больше' : 'Moth: полная графика, обычные ISP и&nbsp;NPU';
  });
}

/* ---------- 12. Память и валюта ---------- */

const CUR_KEY = 'oy-currency';
let currency = ['eur'].includes(store.get(CUR_KEY)) ? store.get(CUR_KEY) : 'usd';
let mem = PRODUCT.configs[0].id;
const memGroup = $('[data-mem-switch]');
const money = (usd, eur) => (currency === 'eur' ? `€${eur}` : `$${usd}`);
function renderPrice() {
  const c = getConfig('nova', mem);
  $('[data-total]').textContent = money(c.usd, c.eur);
  $('[data-cfg-name]').textContent = `OY 0X Nova · ${mem} ГБ`;
  syncRadio(memGroup, mem);
  $$('[data-currency]').forEach((g) => syncRadio(g, currency));
  $$('[data-price]').forEach((el) => { el.textContent = money(Number(el.dataset.usd), Number(el.dataset.eur)); });
}
initRadioGroup(memGroup, (v) => { mem = v; renderPrice(); });
$$('[data-currency]').forEach((g) => initRadioGroup(g, (v) => { currency = v; store.set(CUR_KEY, v); renderPrice(); }));
$('[data-price-table]').innerHTML = PRODUCT.configs
  .map((c) => `<tr><td>${c.id.replace('/', ' / ')} ГБ</td><td>$${c.usd}</td><td>€${c.eur}</td></tr>`).join('');
renderPrice();

/* ---------- Каждый тик: прокрутка → небо и модель ---------- */

let lastY = -1;
function tick(time) {
  const y = window.scrollY;
  if (y !== lastY) { lastY = y; detectChapter(); }
  sky.state.scroll = y;
  sky.state.heroNova = clamp01(1 - y / (window.innerHeight * 0.9));
  sky.state.zoom = current === 'zoom' || sky.state.zoomOn > 0.01 ? zoomState.sky : 1;
  sky.render(performance.now());

  if (Keys.empty || !stage) return;
  const v = Keys.sample(y, reducedMode);
  const now = performance.now();
  const cam = activeCam(now);
  if (cam !== lastCam) {
    lastCam = cam;
    Object.entries(camBtns).forEach(([k, b]) => b.classList.toggle('is-on', current === 'observatory' && k === cam));
  }
  for (const k of CAMS) v[`g_${k}`] = (v.gk ?? 0) * (k === cam ? 1 : 0.1);
  const tk = v.tk ?? 0;
  v.signal = torch === 'white' || torch === 'red' ? tk : 0;
  v.sos = torch === 'sos' ? tk : 0;
  v.flash = current === 'sensors' ? 0.15 : 0;
  const vis = clamp01(v.vis ?? 1);
  canvas.style.opacity = vis.toFixed(3);
  stage.setActive(vis > 0.02 && !document.hidden);
  stage.setTarget(v);
}
gsap.ticker.add(tick);
if (params.has('debug')) window.__nova = { stage, sky, Keys, ScrollTrigger, sts, zoomState };

window.addEventListener('pointermove', (e) => {
  if (!stage || reducedMode || e.pointerType === 'touch') return;
  stage.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
}, { passive: true });
window.addEventListener('resize', () => stage?.resize());

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
  loader.classList.add('is-done');
  loader.setAttribute('aria-hidden', 'true');
  updateScreen();
  // Вспышка новой звезды на первом экране
  if (!reducedMode) gsap.fromTo(sky.state, { flash: 1 }, { flash: 0, duration: 2.2, ease: 'power3.out' });
  if (!fineMQ.matches) $$('[data-hint-desk]').forEach((el) => el.setAttribute('aria-hidden', 'true'));
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
