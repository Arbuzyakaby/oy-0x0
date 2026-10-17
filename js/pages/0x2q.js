/* =========================================================================
   OY 0X2Q — сюжет прокрутки страницы модели, конфигуратор, демо четырёх
   модулей в видоискателе и навсегда заблокированного загрузчика. Ядро то же, что у 0X0, 0X1 и Pro: ключевые кадры модели
   привязаны к ScrollTrigger секций, на каждом тике прокрутка превращается
   в целевое состояние сцены.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage } from '../core/stage.js';
import { createOY0X2Q, OX2Q_COLORS } from '../models/oy0x2q.js';
import { createKeys } from '../core/keys.js';
import { PRODUCTS, getConfig, getPrice } from '../data/products.js';
import { $, $$, clamp01, store, createToast, syncRadio, initRadioGroup, bindStubs } from '../core/ui.js';
import { createSmoothScroll } from '../core/scroll.js';
import { createSplitReveals } from '../core/text.js';
import { initCarousel } from '../core/carousel.js';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const root = document.documentElement;
root.classList.add('anim');

const PI = Math.PI;
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const params = new URLSearchParams(location.search);

const toast = createToast($('#toast'), gsap);

/* ---------- 3D-сцена ---------- */

const canvas = $('#stage');
let stage = null;
try {
  stage = createStage(canvas, createOY0X2Q, { forceFallback: params.has('fallback') });
} catch (err) {
  console.warn('[OY 0X2Q] WebGL недоступен, 3D отключено.', err);
  canvas.style.display = 'none';
}

/* ---------- Цвет, память, цена ---------- */

const PRODUCT = PRODUCTS['0x2q'];
const COLOR_NAMES = PRODUCT.colors;
const colorGroups = $$('[data-color-switch]');
const memGroup = $('[data-mem-switch]');
const usdEl = $('[data-price-usd]');
const eurEl = $('[data-price-eur]');
const cnyEl = $('[data-price-cny]');
const cfgNameEl = $('[data-cfg-name]');
let currentMem = PRODUCT.configs[0].id;
let currentColor = PRODUCT.defaultColor;
let shownUsd = getPrice(PRODUCT.id, currentMem, currentColor).usd;

function updatePrice(animate = true) {
  const price = getPrice(PRODUCT.id, currentMem, currentColor);
  if (!price) return;
  cfgNameEl.textContent = `${currentMem} ГБ`;
  eurEl.textContent = `€${price.eur.toLocaleString('ru-RU')}`;
  cnyEl.textContent = `¥${price.cny.toLocaleString('ru-RU')}`;
  const fmt = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
  if (!animate || reduceMQ.matches) { usdEl.textContent = fmt(price.usd); shownUsd = price.usd; return; }
  const o = { n: shownUsd };
  shownUsd = price.usd;
  gsap.to(o, { n: price.usd, duration: 0.6, ease: 'power3.out', onUpdate: () => { usdEl.textContent = fmt(o.n); } });
  gsap.fromTo(usdEl, { y: 8, opacity: 0.6 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' });
}

function setColor(name, { save = true, instant = false, animate = true } = {}) {
  if (!COLOR_NAMES[name]) name = PRODUCT.defaultColor;
  currentColor = name;
  root.dataset.color = name;
  colorGroups.forEach((g) => syncRadio(g, name));
  $$('[data-cfg-color]').forEach((el) => { el.textContent = COLOR_NAMES[name]; });
  stage?.setBodyColor(name, instant);
  if (save) store.set('oy-0x2q-color', name);
  updatePrice(animate);
}

function setMemory(v, animate = true) {
  if (!getConfig(PRODUCT.id, v)) return;
  currentMem = v;
  syncRadio(memGroup, v);
  updatePrice(animate);
}

colorGroups.forEach((g) => initRadioGroup(g, (v) => setColor(v)));
initRadioGroup(memGroup, (v) => setMemory(v));
syncRadio(memGroup, currentMem);
setColor(store.get('oy-0x2q-color') || root.dataset.color || PRODUCT.defaultColor, { save: false, instant: true, animate: false });

// Таблица цен из тех же данных
const priceBody = $('[data-price-table]');
if (priceBody) {
  priceBody.innerHTML = PRODUCT.configs
    .map((c) => `<tr><th scope="row">${c.id} ГБ</th><td>$${c.usd.toLocaleString('en-US')}</td><td>€${c.eur.toLocaleString('ru-RU')}</td><td>¥${c.cny.toLocaleString('ru-RU')}</td></tr>`).join('');
}

bindStubs(toast);

const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ });

/* ---------- Демо: один кадр — четыре модуля ---------- */

const wait = (ms) => new Promise((r) => setTimeout(r, reduceMQ.matches ? Math.min(ms, 60) : ms));
{
  const vf = $('[data-vf]');
  const hud = $('[data-vf-hud]');
  const temp = $('[data-vf-temp]');
  const out = $('[data-vf-out]');
  const modGroup = $('[data-vf-mod]');
  const toggle = $('[data-vf-toggle]');
  const toggleText = $('[data-vf-toggle-text]');
  const fakeBtn = $('[data-vf-fake]');
  const MODS = {
    classic: { hud: '«Классика» · 1× · 50 МП', say: 'Модуль «Классика» выдвинут. Основная камера смотрит от вас, фронтальная — на вас.' },
    thermal: { hud: '«Тепло» · 640×512 · iron', say: '«Тепло»: человек у дерева, кошка у дома, горячая труба под землёй. Лазер меряет то, что в перекрестье.' },
    inch: { hud: '«Дюйм» · 4× · сенсор 1"', say: '«Дюйм»: флажок на вышке за холмом — резко. Плавающая линза доводит фокус за 0,1 с.' },
    beam: { hud: '«Луч» · 6000 лм · 12 000 м', say: '«Луч»: камер нет, есть свет. Ночью столб видно до вышки на горизонте — и дальше.' },
  };
  let mod = 'classic';
  let state = 'out';
  const say = (t) => {
    out.textContent = t;
    if (!reduceMQ.matches) gsap.fromTo(out, { opacity: 0.3, y: 4 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
  };
  const render = () => {
    vf.dataset.mod = mod;
    vf.dataset.state = state;
    hud.textContent = state === 'out' ? MODS[mod].hud : 'Шторка закрыта';
    temp.textContent = mod === 'thermal' ? '36,6 °C' : '';
    toggleText.textContent = state === 'out' ? 'Убрать модуль' : 'Выдвинуть модуль';
    syncRadio(modGroup, mod);
  };
  initRadioGroup(modGroup, (v) => {
    mod = v;
    if (state !== 'out') state = 'out';
    render();
    say(MODS[mod].say);
  });
  toggle.addEventListener('click', () => {
    state = state === 'out' ? 'in' : 'out';
    render();
    say(state === 'out' ? MODS[mod].say : 'Модуль уехал в корпус, шторка закрылась. Камеры обесточены — в телефоне сейчас нет ни одной.');
  });
  let busy = false;
  fakeBtn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    state = 'fake';
    render();
    vf.querySelector('.vf__shutter b').textContent = 'Чужой модуль';
    vf.querySelector('.vf__shutter i').textContent = 'Citadel 3 не узнал ключ';
    say('Модуль без ключа OY. Citadel 3 не дал мотору ни миллиампера: модуль остался в корпусе, контакты обесточены.');
    await wait(2600);
    vf.querySelector('.vf__shutter b').textContent = 'Модуль в корпусе';
    vf.querySelector('.vf__shutter i').textContent = 'камеры обесточены';
    state = 'out';
    render();
    busy = false;
  });
  render();
}

/* ---------- Демо загрузчика: девять ступеней и обесточивание ---------- */

{
  const steps = $$('.bl__step');
  const parts = $$('.bl__parts li');
  const out = $('[data-boot-out]');
  const btn = $('[data-boot-run]');
  const LINES = [
    'Подпись прошивки не OY. Ступень 1 — пройдена.',
    'PIN владельца подобран. Ступень 2 — пройдена.',
    'Пароль Citadel 3 подобран. Ступень 3 — пройдена.',
    'Отпечаток подделан. Ступень 4 — пройдена.',
    'Ждём 72 часа… Ступень 5 — пройдена.',
    'Повторное подтверждение подделано. Ступень 6 — пройдена.',
    'Корпус вскрыт аккуратно. Ступень 7 — пройдена.',
    'Ключи пользователя уничтожены. Данных больше нет.',
    'Событие записано в «Свидетель».',
  ];
  let busy = false;
  let done = false;
  btn.addEventListener('click', async () => {
    if (busy) return;
    if (done) {
      out.classList.remove('is-bad');
      out.textContent = 'Это навсегда. Мотор больше не поднимет модуль, перезагрузка не поможет — питание разомкнуто в железе.';
      return;
    }
    busy = true;
    btn.disabled = true;
    for (let i = 0; i < steps.length; i++) {
      steps[i].classList.add('is-run');
      out.textContent = LINES[i];
      await wait(i === 4 ? 900 : 520);
      steps[i].classList.remove('is-run');
      steps[i].classList.add('is-pass');
    }
    for (const p of parts) { p.classList.add('is-dead'); await wait(220); }
    out.classList.add('is-bad');
    out.textContent = 'Все девять пройдены. Citadel 3 обесточил модуль, мотор, микрофоны, динамики и датчики. Навсегда.';
    btn.textContent = 'Включить обратно';
    btn.disabled = false;
    busy = false;
    done = true;
  });
}

/* ---------- Ключевые кадры модели ---------- */

const Keys = createKeys();
const MOD_ORDER = ['classic', 'thermal', 'inch', 'beam'];

// Позы. x/y — доля половины видимой ширины/высоты; fx/fy/fz — точка модели
// (в единицах сцены: 1 = 100 мм), которая ставится в (x, y); dist — камера.
// Верхняя грань телефона — fy 0.712, модуль выезжает над ней по центру.
function makePoses(mobile) {
  const D = {
    hero: { x: 0.42, y: -0.06, fx: 0, fy: 0, fz: 0, rx: 0.1, ry: -0.48, rz: 0.06, s: 1, dist: 5.4, float: 1, screen: 1 },
    designA: { x: -0.3, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.12, ry: -PI + 0.62, rz: 0.04, dist: 5.0, float: 0 },
    designB: { x: -0.3, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.06, ry: -PI - 1.1, rz: -0.03, dist: 4.8 },
    motorA: { x: 0.34, y: -0.05, fx: 0, fy: 0.62, fz: 0, rx: 0.45, ry: -PI + 0.5, rz: 0, dist: 2.6, float: 0 },
    motorB: { x: 0.36, y: 0.06, fx: 0, fy: 0.74, fz: 0, rx: 0.3, ry: -PI + 0.35, rz: 0, dist: 2.1 },
    motorFront: { x: 0.36, y: 0.06, fx: 0, fy: 0.74, fz: 0, rx: 0.25, ry: 0.35, rz: 0, dist: 2.2 },
    modsA: { x: -0.46, y: 0.1, fx: 0, fy: 0.74, fz: 0, rx: 0.28, ry: -PI - 0.5, rz: 0, dist: 2.7, float: 0, screen: 1 },
    modsB: { x: -0.46, y: 0.1, fx: 0, fy: 0.74, fz: 0, rx: 0.24, ry: -PI - 0.3, rz: 0, dist: 2.6 },
    qkey: { x: 0.3, y: -0.05, fx: -0.3, fy: 0.5, fz: 0, rx: 0.12, ry: -1.5 * PI + 0.4, rz: 0, dist: 1.3, float: 0, screen: 1 },
    qkeyEnd: { x: 0.3, y: -0.2, fx: -0.1, fy: 0.68, fz: 0, rx: 0.4, ry: -0.7, rz: 0, dist: 2.3 },
    nc1A: { x: -0.32, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.14, ry: 0.7, rz: -0.04, dist: 4.9, float: 0 },
    nc1B: { x: -0.32, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.3, ry: 1.3, rz: -0.04, dist: 4.7 },
    display: { x: 0.34, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.02, ry: -0.42, rz: 0, dist: 5.0, float: 0, screen: 1 },
    displayEnd: { x: 0.34, y: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: -0.16, rz: 0, dist: 4.8 },
    insideA: { x: 0.3, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.32, ry: -0.62, rz: 0.1, dist: 7.4, float: 0, screen: 1 },
    insideMid: { x: 0.3, y: 0, rx: 0.4, ry: -0.82, rz: 0.08, dist: 6.9 },
    insideB: { x: 0.3, y: 0, rx: 0.3, ry: -PI + 1.0, rz: -0.06, dist: 7.1 },
    colorsA: { x: 0.26, y: 0.04, fx: 0, fy: 0, fz: 0, rx: 0.14, ry: -PI + 0.7, rz: 0.04, dist: 4.6, float: 0, screen: 1 },
    colorsB: { x: 0.26, y: 0.04, fx: 0, fy: 0, fz: 0, rx: 0.1, ry: -PI - 0.6, rz: -0.04, dist: 4.4 },
    finalA: { x: 0, y: -0.75, fx: 0, fy: 0, fz: 0, rx: 0.08, ry: -0.7, rz: 0.04, dist: 8.2, float: 1, screen: 1 },
    finalB: { x: 0, y: -0.5, fx: 0, fy: 0, fz: 0, rx: 0.06, ry: -0.3, rz: 0.03, dist: 8.2, float: 1 },
  };
  if (!mobile) return D;
  // Мобильные: модель сверху, текст снизу
  const M = {
    hero: { x: 0, y: 0.36, ry: -0.4, rx: 0.08, dist: 7.6 },
    designA: { x: 0, y: 0.4, dist: 7.4 },
    designB: { x: 0, y: 0.4, dist: 7.2 },
    motorA: { x: 0, y: 0.45, dist: 3.8 },
    motorB: { x: 0, y: 0.5, dist: 2.9 },
    motorFront: { x: 0, y: 0.5, dist: 3.0 },
    modsA: { x: 0, y: 0.5, dist: 2.9 },
    modsB: { x: 0, y: 0.5, dist: 2.8 },
    qkey: { x: 0, y: 0.52, dist: 2.2 },
    qkeyEnd: { x: 0, y: 0.48, dist: 3.2 },
    nc1A: { x: 0, y: 0.42, dist: 7.4 },
    nc1B: { x: 0, y: 0.42, dist: 7.2 },
    display: { x: 0, y: 0.4, ry: -0.3, dist: 8.0 },
    displayEnd: { x: 0, y: 0.4, ry: -0.14, dist: 7.8 },
    insideA: { x: 0, y: 0.4, dist: 10.6 },
    insideMid: { x: 0, y: 0.4, dist: 9.9 },
    insideB: { x: 0, y: 0.4, dist: 10.1 },
    colorsA: { x: 0, y: 0.34, dist: 7.6 },
    colorsB: { x: 0, y: 0.34, dist: 7.3 },
    finalA: { x: 0, y: -0.7, dist: 9.6 },
    finalB: { x: 0, y: -0.45, dist: 9.6 },
  };
  for (const k in M) D[k] = { ...D[k], ...M[k] };
  return D;
}

/* ---------- Синхронизация HTML с состоянием сцены ---------- */

const modes = $$('.mode');
const qms = $$('.qm');
const ladder = $$('.ladder__step');
const glareEl = $('.glare');
const lastHtml = {};
let shownModule = 'classic';

function syncHtml(v) {
  const changed = (k, val) => {
    const r = Math.round(val * 1000) / 1000;
    if (lastHtml[k] === r) return false;
    lastHtml[k] = r;
    return true;
  };
  if (v.mode !== undefined && changed('mode', v.mode)) {
    const cur = Math.round(v.mode);
    modes.forEach((el, i) => {
      el.style.setProperty('--on', String(clamp01(v.mode - i)));
      el.classList.toggle('is-current', i + 1 === cur);
    });
  }
  // Модуль на сцене: переключается, пока он спрятан (qm — 0…3)
  if (v.qm !== undefined && changed('qm', v.qm)) {
    const cur = Math.round(v.qm);
    qms.forEach((el, i) => {
      el.style.setProperty('--on', String(clamp01(1 - Math.abs(v.qm - i))));
      el.classList.toggle('is-current', i === cur);
    });
    const kind = MOD_ORDER[Math.max(0, Math.min(3, cur))];
    if (kind !== shownModule) { shownModule = kind; stage?.setModule(kind); }
  }
  if (v.net !== undefined && changed('net', v.net)) {
    const cur = Math.round(v.net);
    ladder.forEach((el, i) => {
      el.style.setProperty('--on', String(clamp01(v.net - i + 1)));
      el.classList.toggle('is-current', i === cur);
    });
  }
  if (v.glare !== undefined && changed('glare', v.glare)) glareEl?.style.setProperty('--g', String(clamp01(v.glare)));
}

/* ---------- Текст и карусель ---------- */

const splits = createSplitReveals($$('[data-split]'), { gsap });
initCarousel($('#highlights'), { gsap, isReduced: () => reducedMode });

/* ---------- Главная хореография ---------- */

const sections = Object.fromEntries(['hero', 'design', 'motor', 'modules', 'qkey', 'nc1', 'display', 'inside', 'colors', 'final']
  .map((id) => [id, $(`#${id}`)]));

let reducedMode = reduceMQ.matches;

function buildChoreography({ isMobile, reduce }) {
  reducedMode = reduce;
  stage?.setReduced(reduce);
  if (reduce) smooth.disable(); else smooth.enable();
  root.classList.toggle('reduced', reduce);

  Keys.reset();
  const P = makePoses(isMobile);
  const m = isMobile ? 0.75 : 1;

  const sts = {};
  const pinned = (name, len) => {
    const sec = sections[name];
    if (reduce) {
      sts[name] = ScrollTrigger.create({ trigger: sec, start: 'top top', end: 'bottom top' });
      return null;
    }
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: sec, start: 'top top', end: `+=${Math.round(len * m)}%`, pin: true, scrub: true, anticipatePin: 1 },
    });
    tl.set({}, {}, 1);
    sts[name] = tl.scrollTrigger;
    return tl;
  };

  sts.hero = ScrollTrigger.create({ trigger: sections.hero, start: 'top top', end: 'bottom top' });
  pinned('design', 150);
  const tlMotor = pinned('motor', 200);
  pinned('modules', 260);
  pinned('qkey', 200);
  pinned('nc1', 180);
  pinned('display', 140);
  const tlInside = pinned('inside', 200);
  pinned('colors', 140);
  sts.final = ScrollTrigger.create({ trigger: sections.final, start: 'top top', end: '+=100%' });

  // HTML внутри пинов
  if (tlMotor) {
    $$('.lens', sections.motor).forEach((el, i) => {
      tlMotor.fromTo(el, { autoAlpha: 0.15, x: -16 }, { autoAlpha: 1, x: 0, duration: 0.07 }, 0.12 + i * 0.12);
    });
    tlMotor.fromTo('.qmod-note', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.08 }, 0.7);
  }
  if (tlInside) {
    $$('.layer', sections.inside).forEach((el, i) => {
      tlInside.fromTo(el, { autoAlpha: 0.12, x: -16 }, { autoAlpha: 1, x: 0, duration: 0.06 }, 0.12 + i * 0.06);
    });
  }

  // Ключевые кадры модели. ext — мотор: 0 — модуль в корпусе, 1 — выдвинут
  const K = (name, f, props, linear) => Keys.add(sts[name], f, props, linear);
  const rest = { mod: 0, modFlip: 0, modFar: 0, auth: 0, camLed: 0, laser: 0, key: 0, signal: 0, qm: 0 };
  K('hero', 0, { ...P.hero, ...rest, ext: 1, net: 0, glare: 1, mode: 0, explode: 0, citadel: 0, coil: 0, antenna: 0 });
  K('design', -1, { ...P.designA, ext: 1 });
  K('design', 0, { ...P.designA, ext: 1 });
  K('design', 0.45, { ext: 0 });
  K('design', 1, { ...P.designB, ext: 0 });
  K('motor', -1, { ...P.motorA, ext: 0 });
  K('motor', 0, { ...P.motorA, ext: 0 });
  K('motor', 0.12, { ext: 0 });
  K('motor', 0.42, { ...P.motorB, ext: 1, camLed: 0 });
  K('motor', 0.62, { ext: 1 });
  K('motor', 0.72, { mod: 0 });
  K('motor', 0.84, { ...P.motorFront, mod: 1, camLed: 1 });
  K('motor', 1, { ...P.motorFront, mod: 0, camLed: 1 });
  // Модули: прячется, меняется, выезжает — четыре раза
  K('modules', -1, { ...P.modsA, ext: 1, camLed: 0, mod: 0, qm: 0, laser: 0, signal: 0 });
  K('modules', 0, { ...P.modsA, ext: 1, qm: 0 });
  const seq = [[0.14, 0.24, 0.34, 1], [0.38, 0.48, 0.58, 2], [0.62, 0.72, 0.82, 3]];
  for (const [down, swap, up, next] of seq) {
    K('modules', down, { ext: 1, qm: next - 1 });
    K('modules', swap - 0.02, { ext: 0, qm: next - 1 });
    K('modules', swap, { ext: 0, qm: next });
    K('modules', up, { ext: 1, qm: next, laser: next === 1 ? 1 : 0 });
  }
  K('modules', 0.9, { signal: 0 });
  K('modules', 0.96, { signal: 1 });
  K('modules', 1, { ...P.modsB, ext: 1, qm: 3, signal: 1 });
  // Кнопка Q: модуль снова «Классика»
  K('qkey', -1, { ...P.qkey, ext: 0, qm: 0, signal: 0, laser: 0, key: 0, mode: 0 });
  K('qkey', 0, { ...P.qkey, ext: 0, qm: 0, key: 0, mode: 0 });
  K('qkey', 0.1, { key: 0, mode: 0, ext: 0 });
  K('qkey', 0.16, { key: 1, mode: 1 });
  K('qkey', 0.22, { key: 0 });
  K('qkey', 0.32, { ext: 1, mode: 1 });
  K('qkey', 0.42, { key: 1, mode: 2 });
  K('qkey', 0.58, { key: 1 });
  K('qkey', 0.62, { key: 0, mode: 2 });
  K('qkey', 0.72, { key: 0, signal: 0, mode: 2 });
  K('qkey', 0.75, { key: 1, mode: 3 });
  K('qkey', 0.78, { key: 0 });
  K('qkey', 0.81, { key: 1 });
  K('qkey', 0.84, { key: 0, signal: 0 });
  K('qkey', 0.9, { signal: 1 });
  K('qkey', 1, { ...P.qkeyEnd, signal: 1, mode: 3, key: 0, ext: 1 });
  K('nc1', -1, { ...P.nc1A, signal: 0, antenna: 0, ext: 0 });
  K('nc1', 0, { ...P.nc1A, net: 0, ext: 0 });
  K('nc1', 0.12, { antenna: 0, net: 0 });
  K('nc1', 0.3, { antenna: 1 });
  K('nc1', 0.84, { ...P.nc1B, net: 5 }, true);
  K('nc1', 1, { ...P.nc1B, antenna: 1, net: 5 });
  K('display', -1, { ...P.display, antenna: 0, glare: 1 });
  K('display', 0, { ...P.display, glare: 1 });
  K('display', 0.2, { glare: 1 });
  K('display', 0.7, { glare: 0 });
  K('display', 1, { ...P.displayEnd, glare: 0 });
  K('inside', -1, { ...P.insideA, explode: 0, citadel: 0, coil: 0 });
  K('inside', 0, { ...P.insideA, explode: 0 });
  K('inside', 0.12, { explode: 0, citadel: 0, coil: 0 });
  K('inside', 0.6, { ...P.insideMid, explode: 1, citadel: 0.8, coil: 1 });
  K('inside', 1, { ...P.insideB, explode: 1, citadel: 0.8, coil: 1 });
  K('colors', -1, { ...P.colorsA, explode: 0, citadel: 0, coil: 0, ext: 1 });
  K('colors', 0, { ...P.colorsA, ext: 1 });
  K('colors', 1, P.colorsB);
  K('final', -1, P.finalA);
  K('final', 0, P.finalB);
  K('final', 1, { y: P.finalB.y + 2 }, true);

  // Появления
  splits.buildAll(reduce);
  $$('[data-reveal]').forEach((el) => {
    const sibs = Array.from(el.parentElement.children).filter((c) => c.hasAttribute('data-reveal'));
    const delay = Math.min(sibs.indexOf(el), 6) * (reduce ? 0.04 : 0.07);
    const from = reduce ? { opacity: 0 } : { opacity: 0, y: 32, filter: 'blur(6px)' };
    const to = reduce
      ? { opacity: 1, duration: 0.5, delay }
      : { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1, delay, ease: 'expo.out' };
    gsap.fromTo(el, from, { ...to, scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none none' } });
  });

  // Беспроводная зарядка 0 → 100 % за 42 минуты
  const fill = $('.charge__fill');
  const pctEl = $('[data-charge-pct]');
  const minEl = $('[data-charge-min]');
  const setCharge = (p) => {
    fill.style.setProperty('--p', p.toFixed(3));
    pctEl.textContent = String(Math.round(p * 100));
    minEl.textContent = String(Math.round(p * 42));
  };
  if (reduce) setCharge(1);
  else {
    const o = { p: 0 };
    gsap.to(o, {
      p: 1, ease: 'none', onUpdate: () => setCharge(o.p),
      scrollTrigger: { trigger: '.charge', start: 'top 80%', end: 'bottom 55%', scrub: true },
    });
  }

  if (!reduce) {
    gsap.to('.bgfx__glow--a', { yPercent: 70, xPercent: -20, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: true } });
    gsap.to('.bgfx__glow--b', { yPercent: -60, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: true } });
    gsap.fromTo('.tb', { yPercent: 14 }, { yPercent: -10, ease: 'none', scrollTrigger: { trigger: '.pperf', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.fromTo('.hero__inner', { y: 0 }, { y: -80, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: sections.hero, start: 'top top', end: 'bottom top', scrub: true } });
  }

  ['.highlights'].forEach((sel) => ScrollTrigger.create({ trigger: sel, start: 'top bottom', end: 'bottom top', toggleClass: 'in-view' }));

  ScrollTrigger.refresh();

  return () => {
    Keys.reset();
    splits.unsplitAll();
  };
}

ScrollTrigger.addEventListener('refresh', () => Keys.compile(window.innerHeight));

/* ---------- Вращение модели перетаскиванием (секция цветов) ---------- */

const spin = { v: 0, on: false };
{
  const sec = sections.colors;
  let drag = null;
  new IntersectionObserver(([e]) => {
    spin.on = e.isIntersecting;
    if (!spin.on) spin.v = 0;
  }, { threshold: 0.6 }).observe(sec);
  sec.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button, a')) return;
    drag = { x: e.clientX, v: spin.v, id: e.pointerId };
    sec.setPointerCapture(e.pointerId);
    sec.classList.add('is-dragging');
  });
  sec.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    spin.v = drag.v + ((e.clientX - drag.x) / window.innerWidth) * PI * 2.2;
    if (Math.abs(e.clientX - drag.x) > 6) sec.classList.add('was-dragged');
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    sec.classList.remove('is-dragging');
  };
  sec.addEventListener('pointerup', end);
  sec.addEventListener('pointercancel', end);
}

/* ---------- Каждый тик: прокрутка → состояние ---------- */

let lastPoseKey = '';
let fading = false;
function tick() {
  if (Keys.empty) return;
  const v = Keys.sample(window.scrollY, reducedMode);
  v.spin = spin.on ? spin.v : 0;
  syncHtml(v);
  if (!stage) return;
  if (!reducedMode) { stage.setTarget(v); return; }
  // Reduced motion: позы меняются ступенчато, через короткое затухание
  const keyStr = ['x', 'y', 'rx', 'ry', 'rz', 'dist', 'fy', 'explode', 'mod', 'modFlip', 'ext', 'qm'].map((k) => (v[k] ?? 0).toFixed(2)).join('|');
  if (keyStr === lastPoseKey || fading) { if (!fading) stage.setTarget(v); return; }
  if (!lastPoseKey) { lastPoseKey = keyStr; stage.setTarget(v); return; }
  lastPoseKey = keyStr;
  fading = true;
  gsap.to(canvas, {
    opacity: 0, duration: 0.15, onComplete: () => {
      stage.setTarget(Keys.sample(window.scrollY, true));
      gsap.to(canvas, { opacity: 1, duration: 0.3, onComplete: () => { fading = false; } });
    },
  });
}
gsap.ticker.add(tick);
if (params.has('debug')) window.__oy = { stage, Keys, ScrollTrigger, lenis: () => smooth.lenis };

/* ---------- Рендер только когда 3D-секции видны ---------- */

if (stage) {
  const visible = new Set();
  const update = () => stage.setActive(visible.size > 0 && !document.hidden);
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
    update();
  }, { rootMargin: '10% 0px 10% 0px' });
  $$('[data-3d]').forEach((s) => io.observe(s));
  document.addEventListener('visibilitychange', update);

  window.addEventListener('pointermove', (e) => {
    if (reducedMode || e.pointerType === 'touch') return;
    stage.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });

  let rw = window.innerWidth;
  window.addEventListener('resize', () => {
    stage.resize();
    if (Math.abs(window.innerWidth - rw) > 2) {
      rw = window.innerWidth;
      splits.rebuildPending(reducedMode);
    }
  });
}

/* ---------- Запуск ---------- */

async function boot() {
  const timeout = (ms) => new Promise((r) => setTimeout(r, ms));
  const fonts = document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve();
  await Promise.race([Promise.all([fonts, stage ? stage.ready : null, timeout(500)]), timeout(14000)]);
  stage?.redrawScreen(OX2Q_COLORS[root.dataset.color]?.accent);

  const mm = gsap.matchMedia();
  mm.add({
    isMobile: '(max-width: 760px)',
    isDesktop: '(min-width: 761px)',
    reduce: '(prefers-reduced-motion: reduce)',
    motion: '(prefers-reduced-motion: no-preference)',
  }, (ctx) => buildChoreography(ctx.conditions));

  const loader = $('#loader');
  loader.classList.add('is-done');
  loader.setAttribute('aria-hidden', 'true');
  if (!reduceMQ.matches) {
    gsap.from('.site-header', { yPercent: -100, opacity: 0, duration: 1, ease: 'expo.out', delay: 0.2 });
  }
  window.addEventListener('load', () => ScrollTrigger.refresh());

  // Ссылка с якорем: прокрутить, когда пины расставлены
  let hashTarget = null;
  try { hashTarget = location.hash.length > 1 ? document.querySelector(location.hash) : null; } catch { /* неверный якорь */ }
  if (hashTarget) {
    const go = () => {
      if (smooth.lenis) { smooth.lenis.resize(); smooth.lenis.scrollTo(hashTarget, { immediate: true, force: true }); }
      else hashTarget.scrollIntoView();
    };
    requestAnimationFrame(go);
    if (document.readyState !== 'complete') window.addEventListener('load', () => requestAnimationFrame(go), { once: true });
  }
}
boot();
