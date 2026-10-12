/* =========================================================================
   OY 0X0 Pro — сюжет прокрутки страницы модели.
   Ядро то же, что у 0X0: ключевые кадры модели привязаны к ScrollTrigger
   секций, на каждом тике прокрутка превращается в целевое состояние.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage } from '../core/stage.js';
import { createPro, PRO_COLORS } from '../models/pro.js';
import { createKeys } from '../core/keys.js';
import { PRODUCTS, getConfig, getPrice, colorAvailable } from '../data/products.js';
import { $, $$, clamp01, store, createToast, syncRadio, initRadioGroup, bindToggles, bindStubs } from '../core/ui.js';
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
  stage = createStage(canvas, createPro, { forceFallback: params.has('fallback') });
} catch (err) {
  console.warn('[OY 0X0 Pro] WebGL недоступен, 3D отключено.', err);
  canvas.style.display = 'none';
}

/* ---------- Цвет, память, цена ---------- */

const PRODUCT = PRODUCTS.pro;
const COLOR_NAMES = PRODUCT.colors;
const colorGroups = $$('[data-color-switch]');
const memGroup = $('[data-mem-switch]');
const usdEl = $('[data-price-usd]');
const eurEl = $('[data-price-eur]');
const cfgNameEl = $('[data-cfg-name]');
const hintEl = $('[data-marble-hint]');
let currentMem = PRODUCT.configs[0].id;
let currentColor = PRODUCT.defaultColor;
let shownUsd = getPrice(PRODUCT.id, currentMem, currentColor).usd;

function showHint(text) {
  if (!hintEl) return;
  hintEl.textContent = text;
  hintEl.hidden = !text;
}

function updatePrice(animate = true) {
  const price = getPrice(PRODUCT.id, currentMem, currentColor);
  if (!price || !usdEl) return;   // снят с продажи: конфигуратора на странице нет
  cfgNameEl.textContent = `${currentMem} ГБ`;
  eurEl.textContent = `€${price.eur.toLocaleString('ru-RU')}`;
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
  showHint('');
  if (!colorAvailable(PRODUCT.id, currentMem, name)) {
    currentMem = PRODUCT.surcharge[name].configs[0];
    if (memGroup) syncRadio(memGroup, currentMem);
    showHint(`«${COLOR_NAMES[name]}» есть только в версиях 16/512 и 20/1024 — выбрали ${currentMem}.`);
  }
  root.dataset.color = name;
  colorGroups.forEach((g) => syncRadio(g, name));
  $$('[data-cfg-color]').forEach((el) => { el.textContent = COLOR_NAMES[name]; });
  stage?.setBodyColor(name, instant);
  if (save) store.set('oy-pro-color', name);
  updatePrice(animate);
}

function setMemory(v, animate = true) {
  if (!getConfig(PRODUCT.id, v)) return;
  currentMem = v;
  syncRadio(memGroup, v);
  showHint('');
  if (!colorAvailable(PRODUCT.id, v, currentColor)) {
    const prev = COLOR_NAMES[currentColor];
    setColor(PRODUCT.defaultColor, { animate });
    showHint(`«${prev}» есть только в версиях 16/512 и 20/1024 — выбрали «${COLOR_NAMES[PRODUCT.defaultColor]}».`);
    return;
  }
  updatePrice(animate);
}

colorGroups.forEach((g) => initRadioGroup(g, (v) => setColor(v)));
if (memGroup) {
  initRadioGroup(memGroup, (v) => setMemory(v));
  syncRadio(memGroup, currentMem);
}
setColor(store.get('oy-pro-color') || root.dataset.color || PRODUCT.defaultColor, { save: false, instant: true, animate: false });

// Таблица цен из тех же данных
const priceBody = $('[data-price-table]');
if (priceBody) {
  const row = (k, u, e) => `<tr><th scope="row">${k}</th><td>${u}</td><td>${e}</td></tr>`;
  const m = PRODUCT.surcharge.marble;
  priceBody.innerHTML = PRODUCT.configs.map((c) => row(`${c.id} ГБ`, `$${c.usd.toLocaleString('en-US')}`, `€${c.eur.toLocaleString('ru-RU')}`)).join('')
    + row(`«Средиземноморский Мрамор» (${m.configs.join(', ')})`, `+$${m.usd}`, `+€${m.eur}`);
}

bindToggles();
bindStubs(toast);

const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ });

/* ---------- Ключевые кадры модели ---------- */

const Keys = createKeys();

// Позы. x/y — доля половины видимой ширины/высоты; fx/fy/fz — точка модели
// (в единицах сцены: 1 = 100 мм), которая ставится в (x, y); dist — камера.
function makePoses(mobile) {
  const D = {
    hero: { x: 0.42, y: -0.02, fx: 0, fy: 0, fz: 0, rx: 0.1, ry: -0.5, rz: 0.06, s: 1, dist: 5.6, float: 1, screen: 1, sw1: 1, sw2: 1, sw3: 1, sw4: 1, signal: 0, explode: 0, citadel: 0, antenna: 0 },
    camsA: { x: 0.36, y: 0, fx: 0, fy: 0.1, fz: 0, rx: 0.1, ry: -PI + 0.35, rz: 0, dist: 4.6, float: 0 },
    camsClose: { x: 0.34, y: 0, fx: 0.13, fy: 0.5, fz: -0.055, rx: 0.12, ry: -PI + 0.2, rz: 0, dist: 2.2 },
    camsClose2: { x: 0.34, y: 0, fx: 0.13, fy: 0.5, fz: -0.055, rx: 0.2, ry: -PI + 0.42, rz: 0, dist: 2.35 },
    camsFront: { x: 0.46, y: 0.1, fx: 0, fy: 0.62, fz: 0.047, rx: 0.16, ry: 0.28, rz: 0, dist: 2.1 },
    citA: { x: 0.3, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.3, ry: -1.0, rz: 0.08, dist: 6.6, float: 0 },
    citB: { x: 0.42, y: 0, fx: 0, fy: 0.08, fz: -0.41, rx: 0.3, ry: -1.3, rz: 0.06, dist: 5.2 },
    citC: { x: 0.42, y: 0, fx: 0, fy: 0.08, fz: -0.41, rx: 0.26, ry: -1.42, rz: 0.04, dist: 4.9 },
    clawA: { x: -0.32, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.14, ry: 0.7, rz: -0.04, dist: 5.0, float: 0 },
    clawB: { x: -0.32, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.1, ry: 1.2, rz: -0.04, dist: 4.8 },
    switches: { x: 0.28, y: 0, fx: -0.36, fy: 0.28, fz: 0, rx: 0.1, ry: -1.5 * PI + 0.36, rz: 0, dist: 2.1, float: 0 },
    switchesEnd: { x: 0.28, y: 0, fx: -0.36, fy: 0.28, fz: 0, rx: 0.06, ry: -1.5 * PI + 0.26, rz: 0, dist: 1.95 },
    edgesA: { x: -0.3, y: 0, fx: 0.355, fy: 0.45, fz: 0, rx: 0.2, ry: -PI / 2 + 0.32, rz: 0, dist: 2.0, float: 0 },
    edgesB: { x: -0.3, y: 0, fx: 0.355, fy: 0.3, fz: 0, rx: 0.12, ry: -PI / 2 + 0.2, rz: 0, dist: 1.8 },
    display: { x: 0.34, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.02, ry: -0.3, rz: 0, dist: 5.2, float: 0, screen: 1 },
    displayEnd: { x: 0.34, y: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: -0.12, rz: 0, dist: 5.0 },
    insideA: { x: 0.3, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.32, ry: -0.62, rz: 0.1, dist: 7.8, float: 0, screen: 1 },
    insideMid: { x: 0.3, y: 0, rx: 0.3, ry: -1.22, rz: 0.08, dist: 7.2 },
    insideB: { x: 0.3, y: 0, rx: 0.22, ry: -PI + 0.85, rz: -0.06, dist: 7.4 },
    colorsA: { x: 0.26, y: 0.06, fx: 0, fy: 0, fz: 0, rx: 0.14, ry: -PI + 0.7, rz: 0.04, dist: 4.7, float: 0, screen: 1 },
    colorsB: { x: 0.26, y: 0.06, fx: 0, fy: 0, fz: 0, rx: 0.1, ry: -PI - 0.6, rz: -0.04, dist: 4.5 },
    finalA: { x: 0, y: -0.75, fx: 0, fy: 0, fz: 0, rx: 0.08, ry: -0.7, rz: 0.04, dist: 8.4, float: 1, screen: 1 },
    finalB: { x: 0, y: -0.5, fx: 0, fy: 0, fz: 0, rx: 0.06, ry: -0.3, rz: 0.03, dist: 8.4, float: 1 },
  };
  if (!mobile) return D;
  // Мобильные: модель сверху, текст снизу
  const M = {
    hero: { x: 0, y: 0.36, ry: -0.4, rx: 0.08, dist: 7.9 },
    camsA: { x: 0, y: 0.42, dist: 6.8 },
    camsClose: { x: 0, y: 0.48, dist: 3.1 },
    camsClose2: { x: 0, y: 0.48, dist: 3.2 },
    camsFront: { x: 0, y: 0.52, fy: 0.45, dist: 4.6 },
    citA: { x: 0, y: 0.4, dist: 10.5 },
    citB: { x: 0, y: 0.42, dist: 7.2 },
    citC: { x: 0, y: 0.42, dist: 7 },
    clawA: { x: 0, y: 0.42, dist: 7.6 },
    clawB: { x: 0, y: 0.42, dist: 7.4 },
    switches: { x: 0, y: 0.45, dist: 3.3, ry: -1.5 * PI + 0.5 },
    switchesEnd: { x: 0, y: 0.45, dist: 3.2, ry: -1.5 * PI + 0.4 },
    edgesA: { x: 0, y: 0.45, dist: 3.2 },
    edgesB: { x: 0, y: 0.45, dist: 3 },
    display: { x: 0, y: 0.4, ry: -0.25, dist: 8.4 },
    displayEnd: { x: 0, y: 0.4, ry: -0.12, dist: 8.2 },
    insideA: { x: 0, y: 0.4, dist: 11 },
    insideMid: { x: 0, y: 0.4, dist: 10.3 },
    insideB: { x: 0, y: 0.4, dist: 10.5 },
    colorsA: { x: 0, y: 0.34, dist: 7.8 },
    colorsB: { x: 0, y: 0.34, dist: 7.5 },
    finalA: { x: 0, y: -0.7, dist: 9.8 },
    finalB: { x: 0, y: -0.45, dist: 9.8 },
  };
  for (const k in M) D[k] = { ...D[k], ...M[k] };
  return D;
}

/* ---------- Синхронизация HTML с состоянием сцены ---------- */

const ksItems = [1, 2, 3, 4].map((n) => $(`.ks-item[data-ks="${n}"]`));
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
  for (let i = 0; i < 4; i++) {
    const val = v[`sw${i + 1}`];
    if (val !== undefined && changed(`sw${i}`, val)) ksItems[i]?.style.setProperty('--off', String(1 - clamp01(val)));
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

const sections = Object.fromEntries(['hero', 'cams', 'citadel', 'claw', 'switches', 'edges', 'display', 'inside', 'colors', 'final']
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
  const tls = {};
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
    tls[name] = tl;
    return tl;
  };

  sts.hero = ScrollTrigger.create({ trigger: sections.hero, start: 'top top', end: 'bottom top' });
  const tlCams = pinned('cams', 220);
  const tlCit = pinned('citadel', 200);
  pinned('claw', 170);
  pinned('switches', 220);
  pinned('edges', 140);
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
  if (tlCit) {
    $$('.cit', sections.citadel).forEach((el, i) => {
      tlCit.fromTo(el, { autoAlpha: 0.15, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.08 }, 0.35 + i * 0.13);
    });
  }
  if (tlInside) {
    $$('.layer', sections.inside).forEach((el, i) => {
      tlInside.fromTo(el, { autoAlpha: 0.12, x: -16 }, { autoAlpha: 1, x: 0, duration: 0.07 }, 0.14 + i * 0.065);
    });
  }

  // Ключевые кадры модели
  const K = (name, f, props, linear) => Keys.add(sts[name], f, props, linear);
  K('hero', 0, { ...P.hero, net: 0, glare: 1 });
  K('cams', 0, P.camsA);
  K('cams', 0.32, P.camsClose);
  K('cams', 0.62, P.camsClose2);
  K('cams', 0.86, P.camsFront);
  K('cams', 1, P.camsFront);
  K('citadel', -1, { ...P.citA, explode: 0, citadel: 0 });
  K('citadel', 0, P.citA);
  K('citadel', 0.2, { explode: 0, citadel: 0 });
  K('citadel', 0.55, { ...P.citB, explode: 0.72, citadel: 1 });
  K('citadel', 1, { ...P.citC, explode: 0.72, citadel: 1 });
  // Между Citadel и Claw — 2D-секция шифратора: модель собирается за ней
  K('claw', -1.2, { explode: 0.72, citadel: 1 });
  K('claw', -1, { ...P.clawA, explode: 0, citadel: 0, antenna: 0 });
  K('claw', 0, { ...P.clawA, net: 0 });
  K('claw', 0.12, { antenna: 0, net: 0 });
  K('claw', 0.3, { antenna: 1 });
  K('claw', 0.82, { ...P.clawB, net: 4 }, true);
  K('claw', 1, { ...P.clawB, antenna: 1, net: 4 });
  K('switches', 0, { ...P.switches, antenna: 0, sw1: 1, sw2: 1, sw3: 1, sw4: 1 });
  K('switches', 0.1, { sw1: 1 });
  K('switches', 0.24, { sw1: 0 });
  K('switches', 0.3, { sw2: 1 });
  K('switches', 0.44, { sw2: 0 });
  K('switches', 0.5, { sw3: 1 });
  K('switches', 0.64, { sw3: 0 });
  K('switches', 0.7, { sw4: 1 });
  K('switches', 0.84, { sw4: 0 });
  K('switches', 1, { ...P.switchesEnd, sw1: 0, sw2: 0, sw3: 0, sw4: 0 });
  K('edges', 0, { ...P.edgesA, sw1: 0, sw2: 0, sw3: 0, sw4: 0 });
  K('edges', 1, P.edgesB);
  // Сброс ползунков за 2D-секцией IP69K
  K('display', -1.3, { sw1: 0, sw2: 0, sw3: 0, sw4: 0 });
  K('display', -1.1, { sw1: 1, sw2: 1, sw3: 1, sw4: 1 });
  K('display', -1, { ...P.display, glare: 1 });
  K('display', 0, { ...P.display, glare: 1 });
  K('display', 0.2, { glare: 1 });
  K('display', 0.7, { glare: 0 });
  K('display', 1, { ...P.displayEnd, glare: 0 });
  K('inside', -1, { ...P.insideA, explode: 0, citadel: 0 });
  K('inside', 0, { ...P.insideA, explode: 0 });
  K('inside', 0.12, { explode: 0, citadel: 0 });
  K('inside', 0.6, { ...P.insideMid, explode: 1, citadel: 0.7 });
  K('inside', 1, { ...P.insideB, explode: 1, citadel: 0.7 });
  K('colors', -1, { ...P.colorsA, explode: 0, citadel: 0 });
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

  // Зарядка 0 → 100 % за 23 минуты
  const fill = $('.charge__fill');
  const pctEl = $('[data-charge-pct]');
  const minEl = $('[data-charge-min]');
  const setCharge = (p) => {
    fill.style.setProperty('--p', p.toFixed(3));
    pctEl.textContent = String(Math.round(p * 100));
    minEl.textContent = String(Math.round(p * 23));
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

  ['.calls', '.water', '.highlights'].forEach((sel) => ScrollTrigger.create({ trigger: sel, start: 'top bottom', end: 'bottom top', toggleClass: 'in-view' }));

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
  stage?.redrawScreen(PRO_COLORS[root.dataset.color]?.accent);

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
