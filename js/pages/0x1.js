/* =========================================================================
   OY 0X1 — сюжет прокрутки страницы модели, конфигуратор и демо кнопок
   «0» и «1». Ядро то же, что у 0X0 и Pro: ключевые кадры модели привязаны
   к ScrollTrigger секций, на каждом тике прокрутка превращается в целевое
   состояние сцены.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage } from '../core/stage.js';
import { createOY0X1, OX1_COLORS } from '../models/oy0x1.js';
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
  stage = createStage(canvas, createOY0X1, { forceFallback: params.has('fallback') });
} catch (err) {
  console.warn('[OY 0X1] WebGL недоступен, 3D отключено.', err);
  canvas.style.display = 'none';
}

/* ---------- Цвет, память, цена ---------- */

const PRODUCT = PRODUCTS['0x1'];
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
  if (!price || !usdEl) return;   // снят с продажи: конфигуратора на странице нет
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
  if (save) store.set('oy-0x1-color', name);
  updatePrice(animate);
}

function setMemory(v, animate = true) {
  if (!getConfig(PRODUCT.id, v)) return;
  currentMem = v;
  if (memGroup) syncRadio(memGroup, v);
  updatePrice(animate);
}

colorGroups.forEach((g) => initRadioGroup(g, (v) => setColor(v)));
if (memGroup) {
  initRadioGroup(memGroup, (v) => setMemory(v));
  syncRadio(memGroup, currentMem);
}
setColor(store.get('oy-0x1-color') || root.dataset.color || PRODUCT.defaultColor, { save: false, instant: true, animate: false });

// Таблица цен из тех же данных
const priceBody = $('[data-price-table]');
if (priceBody) {
  priceBody.innerHTML = PRODUCT.configs
    .map((c) => `<tr><th scope="row">${c.id} ГБ</th><td>$${c.usd.toLocaleString('en-US')}</td><td>€${c.eur.toLocaleString('ru-RU')}</td><td>¥${c.cny.toLocaleString('ru-RU')}</td></tr>`).join('');
}

bindStubs(toast);

const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ });

/* ---------- Демо: назначьте кнопки и нажмите ---------- */

const ACTIONS = {
  flash: { name: 'Фонарь', on: 'Фонарь включён.', off: 'Фонарь выключен.' },
  camera: { name: 'Камера', once: 'Камера открыта. За 0,4 секунды, из любого экрана.', needs: 'hw-cam', blocked: 'Камеры обесточены — открывать нечего.' },
  assist: { name: 'OY Assist', once: 'OY Assist слушает. Только сейчас и только на устройстве.', needs: 'hw-mic', blocked: 'Микрофоны обесточены — ассистенту нечем слушать.' },
  ghost: { name: 'Призрачный профиль', on: 'Вы в призрачном профиле. После перезагрузки он исчезнет со всем содержимым.', off: 'Обычный профиль.' },
  recorder: { name: 'Диктофон', on: 'Диктофон пишет. Файл остаётся на устройстве.', off: 'Запись сохранена.', needs: 'hw-mic', blocked: 'Микрофоны обесточены — диктофону нечего записывать.' },
  signal: { name: 'Сигнальный фонарь', on: 'Сигнальный фонарь горит. Видно за 5000 м.', off: 'Сигнальный фонарь погашен.' },
  silent: { name: 'Без звука', on: 'Без звука. Даже без вибрации.', off: 'Звук включён.' },
  'hw-cam': { name: 'Камеры', hw: true, cut: 'Камеры обесточены. Null Chip разомкнул питание.', back: 'Камеры снова под питанием.' },
  'hw-mic': { name: 'Микрофоны', hw: true, cut: 'Микрофоны обесточены. Слушать больше нечем.', back: 'Микрофоны снова под питанием.' },
  'hw-net': { name: 'Связь', hw: true, cut: 'Связь обесточена: сотовая, Wi-Fi, Bluetooth. Claw 2.0 не спорит.', back: 'Связь вернулась. Claw 2.0 уже ищет сеть.' },
  'hw-geo': { name: 'Геолокация', hw: true, cut: 'Геолокация обесточена. Для всех вы — нигде.', back: 'Геолокация снова под питанием.' },
};
const HW = ['hw-cam', 'hw-mic', 'hw-net', 'hw-geo'];
const KEY_NAME = { 1: '«0»', 2: '«1»' };

const demo = {
  assign: { 1: 'flash', 2: 'hw-net' },
  cut: new Set(),
  toggled: new Set(),
  pending: null,
};
const outEl = $('[data-kd-out]');
const fingerBtn = $('[data-finger]');

function say(text, cut = false) {
  outEl.textContent = text;
  outEl.classList.toggle('is-cut', cut);
  if (!reduceMQ.matches) gsap.fromTo(outEl, { opacity: 0.3, y: 4 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
}

function renderDemo() {
  for (const n of [1, 2]) {
    const a = demo.assign[n];
    const led = $(`[data-led="${n}"]`);
    led.dataset.state = ACTIONS[a].hw && demo.cut.has(a) ? 'cut' : 'ready';
    syncRadio($(`[data-assign="${n}"]`), a);
  }
  $$('.kd__state li').forEach((li) => li.classList.toggle('is-cut', demo.cut.has(li.dataset.hw)));
  fingerBtn.hidden = !demo.pending;
}

function flashKey(n) {
  const k = $(`[data-press="${n}"]`);
  k.classList.add('is-pressed');
  setTimeout(() => k.classList.remove('is-pressed'), 160);
}

function press(n) {
  flashKey(n);
  const id = demo.assign[n];
  const a = ACTIONS[id];
  if (a.hw) {
    if (demo.cut.has(id)) { demo.cut.delete(id); say(a.back); } else { demo.cut.add(id); say(a.cut, true); }
  } else if (a.needs && demo.cut.has(a.needs)) {
    say(a.blocked, true);
  } else if (a.once) {
    say(a.once);
  } else if (demo.toggled.has(id)) {
    demo.toggled.delete(id); say(a.off);
  } else {
    demo.toggled.add(id); say(a.on);
  }
  renderDemo();
}

function pressBoth() {
  flashKey(1); flashKey(2);
  if (HW.every((h) => demo.cut.has(h))) {
    demo.cut.clear();
    say('Питание возвращено: камеры, микрофоны, связь и геолокация снова работают.');
  } else {
    HW.forEach((h) => demo.cut.add(h));
    demo.toggled.delete('recorder');
    say('Всё выключено. Камеры, микрофоны, связь и геолокация — без питания.', true);
  }
  renderDemo();
}

function assign(n, value) {
  const prev = demo.assign[n];
  if (prev === value) return;
  if (ACTIONS[prev].hw && demo.cut.has(prev)) {
    demo.pending = { n, value };
    say(`Кнопка ${KEY_NAME[n]} держит ${ACTIONS[prev].name.toLowerCase()} без питания. Переназначить её можно только после отпечатка.`, true);
    renderDemo();
    return;
  }
  demo.assign[n] = value;
  demo.pending = null;
  say(`Кнопка ${KEY_NAME[n]}: ${ACTIONS[value].name}${ACTIONS[value].hw ? ' — аппаратно, через Null Chip' : ''}.`);
  renderDemo();
}

$$('[data-press]').forEach((b) => b.addEventListener('click', () => press(Number(b.dataset.press))));
$('[data-press-both]').addEventListener('click', pressBoth);
$$('[data-assign]').forEach((g) => initRadioGroup(g, (v) => assign(Number(g.dataset.assign), v)));
fingerBtn.addEventListener('click', () => {
  const p = demo.pending;
  if (!p) return;
  const prev = demo.assign[p.n];
  demo.cut.delete(prev);
  demo.assign[p.n] = p.value;
  demo.pending = null;
  say(`Отпечаток принят. ${ACTIONS[prev].name} снова под питанием, кнопка ${KEY_NAME[p.n]}: ${ACTIONS[p.value].name}.`);
  renderDemo();
});
renderDemo();

/* ---------- Ключевые кадры модели ---------- */

const Keys = createKeys();

// Позы. x/y — доля половины видимой ширины/высоты; fx/fy/fz — точка модели
// (в единицах сцены: 1 = 100 мм), которая ставится в (x, y); dist — камера.
function makePoses(mobile) {
  const D = {
    hero: { x: 0.42, y: -0.02, fx: 0, fy: 0, fz: 0, rx: 0.1, ry: -0.5, rz: 0.06, s: 1, dist: 5.9, float: 1, screen: 1, key1: 0, key2: 0, led1: 1, led2: 1, signal: 0, explode: 0, nullchip: 0, antenna: 0 },
    designA: { x: -0.3, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.12, ry: -PI + 0.62, rz: 0.04, dist: 5.6, float: 0 },
    designB: { x: -0.3, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.08, ry: -PI - 0.42, rz: -0.03, dist: 5.4 },
    camsA: { x: 0.36, y: 0, fx: 0, fy: 0.1, fz: 0, rx: 0.1, ry: -PI + 0.35, rz: 0, dist: 4.9, float: 0 },
    camsClose: { x: 0.34, y: 0, fx: 0.19, fy: 0.49, fz: -0.058, rx: 0.12, ry: -PI + 0.22, rz: 0, dist: 2.4 },
    camsClose2: { x: 0.34, y: 0, fx: 0.19, fy: 0.45, fz: -0.058, rx: 0.2, ry: -PI + 0.42, rz: 0, dist: 2.55 },
    camsFront: { x: 0.46, y: 0.1, fx: 0, fy: 0.72, fz: 0.045, rx: 0.16, ry: 0.28, rz: 0, dist: 2.2 },
    keys: { x: 0.28, y: 0, fx: -0.375, fy: 0.34, fz: 0, rx: 0.1, ry: -1.5 * PI + 0.36, rz: 0, dist: 1.9, float: 0 },
    keysEnd: { x: 0.28, y: 0, fx: -0.375, fy: 0.34, fz: 0, rx: 0.05, ry: -1.5 * PI + 0.24, rz: 0, dist: 1.75 },
    clawA: { x: -0.32, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.14, ry: 0.7, rz: -0.04, dist: 5.3, float: 0 },
    clawB: { x: -0.32, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.32, ry: 1.25, rz: -0.04, dist: 5.1 },
    display: { x: 0.34, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.02, ry: -0.3, rz: 0, dist: 5.5, float: 0, screen: 1 },
    displayEnd: { x: 0.34, y: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: -0.12, rz: 0, dist: 5.3 },
    insideA: { x: 0.3, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.32, ry: -0.62, rz: 0.1, dist: 8.2, float: 0, screen: 1 },
    insideMid: { x: 0.3, y: 0, rx: 0.3, ry: -1.22, rz: 0.08, dist: 7.6 },
    insideB: { x: 0.3, y: 0, rx: 0.22, ry: -PI + 0.85, rz: -0.06, dist: 7.8 },
    colorsA: { x: 0.26, y: 0.06, fx: 0, fy: 0, fz: 0, rx: 0.14, ry: -PI + 0.7, rz: 0.04, dist: 5.0, float: 0, screen: 1 },
    colorsB: { x: 0.26, y: 0.06, fx: 0, fy: 0, fz: 0, rx: 0.1, ry: -PI - 0.6, rz: -0.04, dist: 4.8 },
    finalA: { x: 0, y: -0.75, fx: 0, fy: 0, fz: 0, rx: 0.08, ry: -0.7, rz: 0.04, dist: 8.9, float: 1, screen: 1 },
    finalB: { x: 0, y: -0.5, fx: 0, fy: 0, fz: 0, rx: 0.06, ry: -0.3, rz: 0.03, dist: 8.9, float: 1 },
  };
  if (!mobile) return D;
  // Мобильные: модель сверху, текст снизу
  const M = {
    hero: { x: 0, y: 0.36, ry: -0.4, rx: 0.08, dist: 8.4 },
    designA: { x: 0, y: 0.4, dist: 8.2 },
    designB: { x: 0, y: 0.4, dist: 8 },
    camsA: { x: 0, y: 0.42, dist: 7.2 },
    camsClose: { x: 0, y: 0.48, dist: 3.4 },
    camsClose2: { x: 0, y: 0.48, dist: 3.5 },
    camsFront: { x: 0, y: 0.52, fy: 0.55, dist: 4.8 },
    keys: { x: 0, y: 0.45, dist: 3.0, ry: -1.5 * PI + 0.5 },
    keysEnd: { x: 0, y: 0.45, dist: 2.9, ry: -1.5 * PI + 0.4 },
    clawA: { x: 0, y: 0.42, dist: 8.1 },
    clawB: { x: 0, y: 0.42, dist: 7.9 },
    display: { x: 0, y: 0.4, ry: -0.25, dist: 8.9 },
    displayEnd: { x: 0, y: 0.4, ry: -0.12, dist: 8.7 },
    insideA: { x: 0, y: 0.4, dist: 11.6 },
    insideMid: { x: 0, y: 0.4, dist: 10.9 },
    insideB: { x: 0, y: 0.4, dist: 11.1 },
    colorsA: { x: 0, y: 0.34, dist: 8.3 },
    colorsB: { x: 0, y: 0.34, dist: 8 },
    finalA: { x: 0, y: -0.7, dist: 10.4 },
    finalB: { x: 0, y: -0.45, dist: 10.4 },
  };
  for (const k in M) D[k] = { ...D[k], ...M[k] };
  return D;
}

/* ---------- Синхронизация HTML с состоянием сцены ---------- */

const modes = $$('.mode');
const ladder = $$('.ladder__step');
const glareEl = $('.glare');
const lastHtml = {};

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

const sections = Object.fromEntries(['hero', 'design', 'cams', 'keys', 'claw', 'display', 'inside', 'colors', 'final']
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
  const tlCams = pinned('cams', 200);
  pinned('keys', 220);
  pinned('claw', 180);
  pinned('display', 140);
  const tlInside = pinned('inside', 200);
  pinned('colors', 140);
  sts.final = ScrollTrigger.create({ trigger: sections.final, start: 'top top', end: '+=100%' });

  // HTML внутри пинов
  if (tlCams) {
    $$('.lens', sections.cams).forEach((el, i) => {
      tlCams.fromTo(el, { autoAlpha: 0.15, x: -16 }, { autoAlpha: 1, x: 0, duration: 0.08 }, 0.3 + i * 0.12);
    });
    tlCams.fromTo('.cams-note', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.08 }, 0.82);
  }
  if (tlInside) {
    $$('.layer', sections.inside).forEach((el, i) => {
      tlInside.fromTo(el, { autoAlpha: 0.12, x: -16 }, { autoAlpha: 1, x: 0, duration: 0.07 }, 0.14 + i * 0.065);
    });
  }

  // Ключевые кадры модели
  const K = (name, f, props, linear) => Keys.add(sts[name], f, props, linear);
  K('hero', 0, { ...P.hero, net: 0, glare: 1, mode: 0 });
  K('design', -1, P.designA);
  K('design', 0, P.designA);
  K('design', 1, P.designB);
  K('cams', 0, P.camsA);
  K('cams', 0.32, P.camsClose);
  K('cams', 0.62, P.camsClose2);
  K('cams', 0.86, P.camsFront);
  K('cams', 1, P.camsFront);
  // Кнопки: «0» — действие, «1» — аппаратный режим, обе — «Всё выключить»
  K('keys', 0, { ...P.keys, key1: 0, key2: 0, led1: 1, led2: 1, mode: 0 });
  K('keys', 0.08, { mode: 0, key1: 0 });
  K('keys', 0.16, { mode: 1, key1: 1 });
  K('keys', 0.24, { key1: 0, key2: 0, led2: 1 });
  K('keys', 0.34, { mode: 1 });
  K('keys', 0.42, { mode: 2, key2: 1, led2: 2 });
  K('keys', 0.5, { key2: 0, key1: 0, led1: 1 });
  K('keys', 0.6, { mode: 2 });
  K('keys', 0.7, { mode: 3, key1: 1, key2: 1, led1: 2 });
  K('keys', 0.86, { key1: 1, key2: 1 });
  K('keys', 0.94, { key1: 0, key2: 0 });
  K('keys', 1, { ...P.keysEnd, mode: 3, led1: 2, led2: 2 });
  // Между кнопками и Claw — 2D-секция демо: индикаторы гаснут за ней
  K('claw', -1.2, { led1: 2, led2: 2 });
  K('claw', -1, { ...P.clawA, led1: 1, led2: 1, antenna: 0 });
  K('claw', 0, { ...P.clawA, net: 0 });
  K('claw', 0.12, { antenna: 0, net: 0 });
  K('claw', 0.3, { antenna: 1 });
  K('claw', 0.84, { ...P.clawB, net: 5 }, true);
  K('claw', 1, { ...P.clawB, antenna: 1, net: 5 });
  K('display', -1, { ...P.display, antenna: 0, glare: 1 });
  K('display', 0, { ...P.display, glare: 1 });
  K('display', 0.2, { glare: 1 });
  K('display', 0.7, { glare: 0 });
  K('display', 1, { ...P.displayEnd, glare: 0 });
  K('inside', -1, { ...P.insideA, explode: 0, nullchip: 0 });
  K('inside', 0, { ...P.insideA, explode: 0 });
  K('inside', 0.12, { explode: 0, nullchip: 0 });
  K('inside', 0.6, { ...P.insideMid, explode: 1, nullchip: 0.8 });
  K('inside', 1, { ...P.insideB, explode: 1, nullchip: 0.8 });
  K('colors', -1, { ...P.colorsA, explode: 0, nullchip: 0 });
  K('colors', 0, P.colorsA);
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

  // Зарядка 0 → 100 % за 24 минуты
  const fill = $('.charge__fill');
  const pctEl = $('[data-charge-pct]');
  const minEl = $('[data-charge-min]');
  const setCharge = (p) => {
    fill.style.setProperty('--p', p.toFixed(3));
    pctEl.textContent = String(Math.round(p * 100));
    minEl.textContent = String(Math.round(p * 24));
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
  const keyStr = ['x', 'y', 'rx', 'ry', 'rz', 'dist', 'fy', 'explode'].map((k) => (v[k] ?? 0).toFixed(2)).join('|');
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
  stage?.redrawScreen(OX1_COLORS[root.dataset.color]?.accent);

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
