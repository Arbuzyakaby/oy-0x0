/* =========================================================================
   OY 0X1 Essential — сюжет прокрутки страницы модели, конфигуратор и демо
   кнопки «0» (нажатие — действие, удержание 2 с — «Всё выключить»). Ядро то
   же, что у остальных моделей: ключевые кадры привязаны к ScrollTrigger секций.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage } from '../core/stage.js';
import { createOY0X1E, OXE_COLORS } from '../models/oy0x1e.js';
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
  stage = createStage(canvas, createOY0X1E, { forceFallback: params.has('fallback') });
} catch (err) {
  console.warn('[OY 0X1 Essential] WebGL недоступен, 3D отключено.', err);
  canvas.style.display = 'none';
}

/* ---------- Цвет, память, цена ---------- */

const PRODUCT = PRODUCTS['0x1e'];
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
  if (save) store.set('oy-0x1e-color', name);
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
setColor(store.get('oy-0x1e-color') || root.dataset.color || PRODUCT.defaultColor, { save: false, instant: true, animate: false });

const priceBody = $('[data-price-table]');
if (priceBody) {
  priceBody.innerHTML = PRODUCT.configs
    .map((c) => `<tr><th scope="row">${c.id} ГБ</th><td>$${c.usd.toLocaleString('en-US')}</td><td>€${c.eur.toLocaleString('ru-RU')}</td><td>¥${c.cny.toLocaleString('ru-RU')}</td></tr>`).join('');
}

bindStubs(toast);

const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ });

/* ---------- Демо: кнопка «0» ---------- */

{
  const ACTIONS = {
    flash: { name: 'Фонарь', on: 'Фонарь включён.', off: 'Фонарь выключен.' },
    camera: { name: 'Камера', once: 'Камера открыта. За 0,4 секунды, из любого экрана.', needs: 'cam', blocked: 'Камеры обесточены — открывать нечего.' },
    assist: { name: 'OY Assist', once: 'OY Assist слушает. Только сейчас и только на устройстве.', needs: 'mic', blocked: 'Микрофоны обесточены — ассистенту нечем слушать.' },
    silent: { name: 'Без звука', on: 'Без звука. Даже без вибрации.', off: 'Звук включён.' },
  };
  const HOLD = 2000;
  const key = $('[data-press]');
  const led = $('[data-led="1"]');
  const ring = $('[data-hold-ring]');
  const outEl = $('[data-kd-out]');
  const group = $('[data-assign]');
  const state = { action: 'flash', off: false, toggled: new Set() };
  let hold = null;

  const say = (text, cut = false) => {
    outEl.textContent = text;
    outEl.classList.toggle('is-cut', cut);
    if (!reduceMQ.matches) gsap.fromTo(outEl, { opacity: 0.3, y: 4 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
  };
  const render = () => {
    led.dataset.state = state.off ? 'cut' : 'ready';
    $$('.kd__state li').forEach((el) => el.classList.toggle('is-cut', state.off));
    syncRadio(group, state.action);
  };
  const short = () => {
    const a = ACTIONS[state.action];
    if (a.needs && state.off) say(a.blocked, true);
    else if (a.once) say(a.once);
    else if (state.toggled.has(state.action)) { state.toggled.delete(state.action); say(a.off); }
    else { state.toggled.add(state.action); say(a.on); }
  };
  const long = () => {
    state.off = !state.off;
    say(state.off
      ? 'Всё выключено. Null Chip обесточил камеры, микрофоны, связь и геолокацию.'
      : 'Питание возвращено: камеры, микрофоны, связь и геолокация снова работают.', state.off);
    render();
  };
  const start = () => {
    if (hold) return;
    key.classList.add('is-pressed');
    const t0 = performance.now();
    hold = { done: false, raf: 0 };
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / HOLD);
      ring.style.setProperty('--p', p.toFixed(3));
      if (p >= 1) { hold.done = true; long(); return; }
      hold.raf = requestAnimationFrame(step);
    };
    hold.raf = requestAnimationFrame(step);
  };
  const end = () => {
    if (!hold) return;
    cancelAnimationFrame(hold.raf);
    if (!hold.done) short();
    hold = null;
    key.classList.remove('is-pressed');
    ring.style.setProperty('--p', '0');
  };
  key.addEventListener('pointerdown', (e) => { if (e.button === 0) { key.setPointerCapture(e.pointerId); start(); } });
  key.addEventListener('pointerup', end);
  key.addEventListener('pointercancel', end);
  key.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start(); } });
  key.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); end(); } });
  key.addEventListener('contextmenu', (e) => e.preventDefault());
  initRadioGroup(group, (v) => {
    state.action = v;
    say(`Короткое нажатие: ${ACTIONS[v].name}.`);
    render();
  });
  render();
}

/* ---------- Ключевые кадры модели ---------- */

const Keys = createKeys();

function makePoses(mobile) {
  // Модель ниже 0X1 Pro (152 мм), поэтому камера чуть ближе
  const D = {
    hero: { x: 0.42, y: -0.02, fx: 0, fy: 0, fz: 0, rx: 0.1, ry: -PI + 0.55, rz: 0.06, s: 1, dist: 5.6, float: 1, screen: 1, key1: 0, led1: 1, signal: 0, explode: 0, nullchip: 0 },
    designA: { x: -0.3, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.12, ry: -PI + 0.62, rz: 0.04, dist: 5.3, float: 0 },
    designB: { x: -0.3, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.08, ry: -PI - 0.42, rz: -0.03, dist: 5.1 },
    key: { x: 0.28, y: 0, fx: -0.36, fy: 0.3, fz: 0, rx: 0.1, ry: -1.5 * PI + 0.36, rz: 0, dist: 1.8, float: 0 },
    keyEnd: { x: 0.28, y: 0, fx: -0.36, fy: 0.3, fz: 0, rx: 0.05, ry: -1.5 * PI + 0.24, rz: 0, dist: 1.65 },
    camsA: { x: 0.36, y: 0, fx: 0, fy: 0.1, fz: 0, rx: 0.1, ry: -PI + 0.35, rz: 0, dist: 4.7, float: 0 },
    camsClose: { x: 0.34, y: 0, fx: 0.205, fy: 0.465, fz: -0.05, rx: 0.12, ry: -PI + 0.22, rz: 0, dist: 2.3 },
    camsClose2: { x: 0.34, y: 0, fx: 0.205, fy: 0.44, fz: -0.05, rx: 0.2, ry: -PI + 0.45, rz: 0, dist: 2.45 },
    camsFront: { x: 0.46, y: 0.1, fx: 0, fy: 0.69, fz: 0.043, rx: 0.16, ry: 0.28, rz: 0, dist: 2.1 },
    display: { x: 0.34, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.02, ry: -0.3, rz: 0, dist: 5.2, float: 0, screen: 1 },
    displayEnd: { x: 0.34, y: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: -0.12, rz: 0, dist: 5.0 },
    insideA: { x: 0.3, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.32, ry: -0.62, rz: 0.1, dist: 7.8, float: 0, screen: 1 },
    insideMid: { x: 0.3, y: 0, rx: 0.3, ry: -1.22, rz: 0.08, dist: 7.2 },
    insideB: { x: 0.3, y: 0, rx: 0.22, ry: -PI + 0.85, rz: -0.06, dist: 7.4 },
    colorsA: { x: 0.26, y: 0.06, fx: 0, fy: 0, fz: 0, rx: 0.14, ry: -PI + 0.7, rz: 0.04, dist: 4.8, float: 0, screen: 1 },
    colorsB: { x: 0.26, y: 0.06, fx: 0, fy: 0, fz: 0, rx: 0.1, ry: -PI - 0.6, rz: -0.04, dist: 4.6 },
    finalA: { x: 0, y: -0.75, fx: 0, fy: 0, fz: 0, rx: 0.08, ry: -PI + 0.7, rz: 0.04, dist: 8.5, float: 1, screen: 1 },
    finalB: { x: 0, y: -0.5, fx: 0, fy: 0, fz: 0, rx: 0.06, ry: -PI + 0.3, rz: 0.03, dist: 8.5, float: 1 },
  };
  if (!mobile) return D;
  const M = {
    hero: { x: 0, y: 0.36, ry: -PI + 0.45, rx: 0.08, dist: 8.0 },
    designA: { x: 0, y: 0.4, dist: 7.8 },
    designB: { x: 0, y: 0.4, dist: 7.6 },
    key: { x: 0, y: 0.45, dist: 2.9, ry: -1.5 * PI + 0.5 },
    keyEnd: { x: 0, y: 0.45, dist: 2.8, ry: -1.5 * PI + 0.4 },
    camsA: { x: 0, y: 0.42, dist: 6.9 },
    camsClose: { x: 0, y: 0.48, dist: 3.3 },
    camsClose2: { x: 0, y: 0.48, dist: 3.4 },
    camsFront: { x: 0, y: 0.52, fy: 0.52, dist: 4.6 },
    display: { x: 0, y: 0.4, ry: -0.25, dist: 8.5 },
    displayEnd: { x: 0, y: 0.4, ry: -0.12, dist: 8.3 },
    insideA: { x: 0, y: 0.4, dist: 11.0 },
    insideMid: { x: 0, y: 0.4, dist: 10.4 },
    insideB: { x: 0, y: 0.4, dist: 10.6 },
    colorsA: { x: 0, y: 0.34, dist: 7.9 },
    colorsB: { x: 0, y: 0.34, dist: 7.6 },
    finalA: { x: 0, y: -0.7, dist: 10.0 },
    finalB: { x: 0, y: -0.45, dist: 10.0 },
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

const sections = Object.fromEntries(['hero', 'design', 'key', 'cams', 'display', 'inside', 'colors', 'final']
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
  pinned('key', 200);
  const tlCams = pinned('cams', 180);
  pinned('display', 130);
  const tlInside = pinned('inside', 200);
  pinned('colors', 140);
  sts.final = ScrollTrigger.create({ trigger: sections.final, start: 'top top', end: '+=100%' });

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

  const K = (name, f, props, linear) => Keys.add(sts[name], f, props, linear);
  K('hero', 0, { ...P.hero, glare: 1, mode: 0 });
  K('design', -1, P.designA);
  K('design', 0, P.designA);
  K('design', 1, P.designB);
  // Кнопка «0»: нажатие — действие, удержание — «Всё выключить», ещё раз — вернуть
  K('key', 0, { ...P.key, key1: 0, led1: 1, mode: 0 });
  K('key', 0.1, { mode: 0, key1: 0 });
  K('key', 0.18, { mode: 1, key1: 1 });
  K('key', 0.26, { key1: 0, led1: 1 });
  K('key', 0.4, { mode: 1, key1: 0 });
  K('key', 0.48, { mode: 2, key1: 1 });
  K('key', 0.62, { key1: 1, led1: 1 });
  K('key', 0.68, { key1: 0, led1: 2 });
  K('key', 0.78, { mode: 2, key1: 0 });
  K('key', 0.86, { mode: 3, key1: 1, led1: 2 });
  K('key', 0.94, { key1: 0, led1: 1 });
  K('key', 1, { ...P.keyEnd, mode: 3, key1: 0, led1: 1 });
  K('cams', -1, P.camsA);
  K('cams', 0, P.camsA);
  K('cams', 0.32, P.camsClose);
  K('cams', 0.62, P.camsClose2);
  K('cams', 0.86, P.camsFront);
  K('cams', 1, P.camsFront);
  K('display', -1, P.display);
  K('display', 0, P.display);
  K('display', 1, P.displayEnd);
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

  // Зарядка 0 → 100 % за 45 минут
  const fill = $('.charge__fill');
  const pctEl = $('[data-charge-pct]');
  const minEl = $('[data-charge-min]');
  const setCharge = (p) => {
    fill.style.setProperty('--p', p.toFixed(3));
    pctEl.textContent = String(Math.round(p * 100));
    minEl.textContent = String(Math.round(p * 45));
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
  stage?.redrawScreen(OXE_COLORS[root.dataset.color]?.accent);

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
