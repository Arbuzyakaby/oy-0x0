/* =========================================================================
   OY 0X3 Essential — сюжет прокрутки, реверанс 0X0: тот же порядок сцен
   (имя со спины, ползунки, фонарь, экран, разбор, цвета), но четыре
   kill switch вместо трёх и без шторки. Сделан из base.js страницы 0X0.
   GSAP + ScrollTrigger: закрепление секций, scrub, появления.
   Lenis: плавная прокрутка.
   Позы 3D-модели заданы ключевыми кадрами, привязанными к ScrollTrigger
   секций; на каждом тике позиция прокрутки превращается в целевое
   состояние модели (детерминированно при любом прыжке скролла).
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage } from '../core/stage.js';
import { createOY0X3E } from '../models/oy0x3e.js';
import { createKeys } from '../core/keys.js';
import { PRODUCTS, getConfig } from '../data/products.js';
import { $, $$, clamp01, store, createToast, syncRadio, initRadioGroup, bindStubs } from '../core/ui.js';
import { createSmoothScroll } from '../core/scroll.js';
import { createSplitReveals, wrapWords, scrubWords } from '../core/text.js';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const root = document.documentElement;
root.classList.add('anim');

const PI = Math.PI;

const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const params = new URLSearchParams(location.search);

/* ---------- Toast ---------- */

const toast = createToast($('#toast'), gsap);

/* ---------- 3D-сцена ---------- */

const canvas = $('#stage');
let stage = null;
try {
  stage = createStage(canvas, createOY0X3E, { forceFallback: params.has('fallback') });
} catch (err) {
  console.warn('[OY 0X3 Essential] WebGL недоступен, 3D отключено.', err);
  canvas.style.display = 'none';
}

/* ---------- Радиогруппы (цвет, память, фонарь) ---------- */

// Цвет корпуса
const PRODUCT = PRODUCTS['0x3e'];
const COLOR_NAMES = PRODUCT.colors;
const colorGroups = $$('[data-color-switch]');
function setColor(name, { save = true, instant = false } = {}) {
  if (!COLOR_NAMES[name]) name = PRODUCT.defaultColor;
  root.dataset.color = name;
  colorGroups.forEach((g) => syncRadio(g, name));
  $$('[data-cfg-color]').forEach((el) => { el.textContent = COLOR_NAMES[name]; });
  stage?.setBodyColor(name, instant);
  if (save) store.set('oy-color', name);
}
colorGroups.forEach((g) => initRadioGroup(g, (v) => setColor(v)));
setColor(store.get('oy-color') || root.dataset.color || PRODUCT.defaultColor, { save: false, instant: true });

// Память и цена
const memGroup = $('[data-mem-switch]');
const usdEl = $('[data-price-usd]');
const eurEl = $('[data-price-eur]');
const cfgNameEl = $('[data-cfg-name]');
let currentMem = '8/128';
function setMemory(v, animate = true) {
  const cfg = getConfig(PRODUCT.id, v);
  if (!cfg) return;
  const prev = getConfig(PRODUCT.id, currentMem).usd;
  currentMem = v;
  syncRadio(memGroup, v);
  const { usd, eur } = cfg;
  cfgNameEl.textContent = `${v} ГБ`;
  eurEl.textContent = `€${eur}`;
  if (!animate || reduceMQ.matches) { usdEl.textContent = `$${usd}`; return; }
  const o = { n: prev };
  gsap.to(o, {
    n: usd, duration: 0.6, ease: 'power3.out',
    onUpdate: () => { usdEl.textContent = `$${Math.round(o.n)}`; },
  });
  gsap.fromTo(usdEl, { y: 8, opacity: 0.6 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' });
}
initRadioGroup(memGroup, (v) => setMemory(v));
setMemory('8/128', false);
$('[data-price-table]').innerHTML = PRODUCT.configs
  .map((c) => `<tr><th scope="row">${c.id} ГБ</th><td>$${c.usd}</td><td>€${c.eur}</td></tr>`).join('');

// Сигнальный фонарь
const signalGroup = $('[data-signal-switch]');
const signalSection = $('#signal');
function setSignal(v) {
  syncRadio(signalGroup, v);
  signalSection.dataset.signal = v;
  stage?.setSignalColor(v);
}
initRadioGroup(signalGroup, setSignal);
setSignal('white');

// Заглушки
bindStubs(toast);

/* ---------- Плавная прокрутка ---------- */

const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ });

/* ---------- Ключевые кадры модели ---------- */

const Keys = createKeys();

// Позы. x/y — доля половины видимой ширины/высоты; fx/fy/fz — точка модели,
// которая ставится в (x, y); dist — расстояние камеры.
function makePoses(mobile) {
  const D = {
    hero: { x: 0.42, y: -0.02, fx: 0, fy: 0, fz: 0, rx: 0.1, ry: -0.5, rz: 0.06, s: 1, dist: 5.4, float: 1, screen: 1, sw1: 1, sw2: 1, sw3: 1, sw4: 1, signal: 0, dark: 0 },
    zeroA: { x: 0.38, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.06, ry: -0.35, rz: 0, dist: 5, float: 0 },
    zeroBack: { x: 0.34, y: 0, fx: 0, fy: 0.12, fz: 0, rx: 0.1, ry: -PI, rz: 0, dist: 4.4 },
    // Вертикальная пара камер, как у 0X0: центр (0.21, 0.43) в координатах модели
    zeroClose: { x: 0.4, y: 0, fx: 0.21, fy: 0.43, fz: -0.055, rx: 0.14, ry: -PI + 0.22, rz: 0, dist: 2.3 },
    switches: { x: 0.28, y: 0, fx: -0.355, fy: 0.28, fz: 0, rx: 0.1, ry: -1.5 * PI + 0.36, rz: 0, dist: 2.2 },
    switchesEnd: { x: 0.28, y: 0, fx: -0.355, fy: 0.28, fz: 0, rx: 0.06, ry: -1.5 * PI + 0.26, rz: 0, dist: 2.05 },
    signal: { x: -0.45, y: -0.06, fx: 0, fy: 0.75, fz: 0, rx: 0.36, ry: -0.5, rz: -PI / 2, dist: 2.7, float: 0, sw1: 1, sw2: 1, sw3: 1, sw4: 1 },
    signalEnd: { x: -0.42, y: -0.04, fx: 0, fy: 0.75, fz: 0, rx: 0.3, ry: -0.4, rz: -PI / 2, dist: 2.5 },
    display: { x: 0.34, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.02, ry: -0.3, rz: 0, dist: 4.9 },
    displayEnd: { x: 0.34, y: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: -0.16, rz: 0, dist: 4.7 },
    insideA: { x: 0.3, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.32, ry: -0.62, rz: 0.1, dist: 7.2, float: 0, screen: 1, signal: 0, sw1: 1, sw2: 1, sw3: 1, sw4: 1 },
    insideMid: { x: 0.3, y: 0, rx: 0.3, ry: -1.22, rz: 0.08, dist: 6.6 },
    insideB: { x: 0.3, y: 0, rx: 0.22, ry: -PI + 0.85, rz: -0.06, dist: 6.8 },
    colorsA: { x: 0.26, y: 0.06, fx: 0, fy: 0, fz: 0, rx: 0.14, ry: -1.0, rz: 0.04, dist: 4.5, float: 0, screen: 1, signal: 0 },
    colorsB: { x: 0.26, y: 0.06, fx: 0, fy: 0, fz: 0, rx: 0.1, ry: -1.0 + PI * 1.35, rz: -0.04, dist: 4.3 },
    finalA: { x: 0, y: -0.75, fx: 0, fy: 0, fz: 0, rx: 0.08, ry: -0.7, rz: 0.04, dist: 8, float: 1, screen: 1, signal: 0 },
    finalB: { x: 0, y: -0.5, fx: 0, fy: 0, fz: 0, rx: 0.06, ry: -0.3, rz: 0.03, dist: 8, float: 1 },
  };
  if (!mobile) return D;
  // Мобильные: модель сверху, текст снизу, облёты проще
  const M = {
    hero: { x: 0, y: 0.36, ry: -0.4, rx: 0.08, dist: 7.6 },
    zeroA: { x: 0, y: 0.4, ry: -0.3, dist: 7.2 },
    zeroBack: { x: 0, y: 0.42, fy: 0.1, ry: -PI, dist: 6.6 },
    zeroClose: { x: 0, y: 0.45, ry: -PI + 0.15, rx: 0.12, dist: 2.7 },
    // четыре ползунка и длинный список: модель выше и дальше, чем у 0X0
    switches: { x: 0, y: 0.66, dist: 4.6, ry: -1.5 * PI + 0.5 },
    switchesEnd: { x: 0, y: 0.66, dist: 4.5, ry: -1.5 * PI + 0.4 },
    signal: { x: -0.3, y: 0.5, dist: 4.2 },
    signalEnd: { x: -0.28, y: 0.5, dist: 4.0 },
    display: { x: 0, y: 0.4, ry: -0.25, dist: 8.2 },
    displayEnd: { x: 0, y: 0.4, ry: -0.14, dist: 8 },
    insideA: { x: 0, y: 0.4, dist: 10.5 },
    insideMid: { x: 0, y: 0.4, dist: 9.8 },
    insideB: { x: 0, y: 0.4, dist: 10 },
    colorsA: { x: 0, y: 0.34, dist: 7.6 },
    colorsB: { x: 0, y: 0.34, dist: 7.3 },
    finalA: { x: 0, y: -0.7, dist: 9.4 },
    finalB: { x: 0, y: -0.45, dist: 9.4 },
  };
  for (const k in M) D[k] = { ...D[k], ...M[k] };
  return D;
}

/* ---------- Синхронизация HTML с состоянием сцены ---------- */

const ksItems = [1, 2, 3, 4].map((n) => $(`.ks-item[data-ks="${n}"]`));
const ksIcons = [1, 2, 3, 4].map((n) => $$(`[data-ks-icon="${n}"]`));
const shade = $('#bgfx-shade');
const displaySec = $('#display');
const nitsDay = $('.nits__state--day');
const nitsNight = $('.nits__state--night');
const signalNum = $('.signal-num');
const lastHtml = {};

function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function syncHtml(v) {
  const changed = (k, val) => {
    const r = Math.round(val * 1000) / 1000;
    if (lastHtml[k] === r) return false;
    lastHtml[k] = r;
    return true;
  };
  for (let i = 0; i < 4; i++) {
    const val = v[`sw${i + 1}`];
    if (val !== undefined && changed(`sw${i}`, val)) {
      const off = String(1 - clamp01(val));
      ksItems[i]?.style.setProperty('--off', off);
      ksIcons[i].forEach((el) => el.style.setProperty('--off', off));
    }
  }
  if (v.light !== undefined && changed('light', v.light)) {
    const l = clamp01(v.light);
    shade.style.opacity = String(l);
    displaySec.style.setProperty('--disp-ink', mixHex('#F2F2F0', '#0B0B0C', l));
    displaySec.style.setProperty('--disp-muted', mixHex('#A3A3A8', '#4A4A50', l));
  }
  if (v.nits !== undefined && changed('nits', v.nits)) {
    const n = clamp01(v.nits);
    nitsDay.style.opacity = String(clamp01(1 - n * 2));
    nitsNight.style.opacity = String(clamp01(n * 2 - 1));
    nitsDay.style.visibility = n > 0.5 ? 'hidden' : 'visible';
    nitsNight.style.visibility = n < 0.5 ? 'hidden' : 'visible';
  }
  if (v.signal !== undefined && changed('signalText', v.signal)) {
    signalNum.style.opacity = String(0.25 + clamp01(v.signal) * 0.75);
  }
}

/* ---------- Разбиение текста на строки ---------- */

const splits = createSplitReveals($$('[data-split]'), { gsap });

/* ---------- Абзац, который «загорается» по словам ---------- */

const scrubItems = $$('[data-scrub-words]').map((el) => ({ el, spans: wrapWords(el) }));

/* ---------- Главная хореография ---------- */

const sections = {
  hero: $('#hero'), zero: $('#zero'), switches: $('#switches'),
  signal: $('#signal'), display: $('#display'),
  inside: $('#inside'), colors: $('#colors'), final: $('#final'),
};

let reducedMode = reduceMQ.matches;

function buildChoreography({ isMobile, reduce }) {
  reducedMode = reduce;
  stage?.setReduced(reduce);
  if (reduce) smooth.disable(); else smooth.enable();
  root.classList.toggle('reduced', reduce);

  Keys.reset();
  const P = makePoses(isMobile);
  const m = isMobile ? 0.75 : 1;

  // Секции: закреплённые (scrub) или обычные (reduced motion)
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
    tl.set({}, {}, 1); // длительность таймлайна = 1 (доля пина)
    sts[name] = tl.scrollTrigger;
    tls[name] = tl;
    return tl;
  };

  sts.hero = ScrollTrigger.create({ trigger: sections.hero, start: 'top top', end: 'bottom top' });
  const tlZero = pinned('zero', 170);
  pinned('switches', 260);
  const tlSignal = pinned('signal', 150);
  pinned('display', 170);
  const tlInside = pinned('inside', 200);
  pinned('colors', 130);
  // Диапазон ровно в один экран: модель уезжает вверх синхронно с контентом
  sts.final = ScrollTrigger.create({ trigger: sections.final, start: 'top top', end: '+=100%' });

  // HTML-таймлайны внутри пинов
  if (tlZero) {
    $$('.zero-item', sections.zero).forEach((el, i) => {
      tlZero.fromTo(el, { autoAlpha: 0, y: 40, filter: 'blur(6px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.1 }, 0.28 + i * 0.14);
    });
    tlZero.fromTo('.zero-note', { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.1 }, 0.72);
  }
  if (tlInside) {
    $$('.layer', sections.inside).forEach((el, i) => {
      tlInside.fromTo(el, { autoAlpha: 0.12, x: -16 }, { autoAlpha: 1, x: 0, duration: 0.08 }, 0.14 + i * 0.075);
    });
  }
  if (tlSignal) {
    tlSignal.fromTo('#signal .lead, #signal .note', { autoAlpha: 0.3 }, { autoAlpha: 1, duration: 0.2 }, 0.3);
  }

  // Ключевые кадры модели
  const K = (name, f, props, linear) => Keys.add(sts[name], f, props, linear);
  K('hero', 0, { ...P.hero, light: 0, nits: 0 });
  K('zero', 0, P.zeroA);
  K('zero', 0.45, P.zeroBack);
  K('zero', 0.85, P.zeroClose);
  K('zero', 1, P.zeroClose);
  K('switches', 0, { ...P.switches, sw1: 1, sw2: 1, sw3: 1, sw4: 1 });
  K('switches', 0.1, { sw1: 1 });
  K('switches', 0.22, { sw1: 0 });
  K('switches', 0.3, { sw2: 1 });
  K('switches', 0.42, { sw2: 0 });
  K('switches', 0.5, { sw3: 1 });
  K('switches', 0.62, { sw3: 0 });
  K('switches', 0.7, { sw4: 1 });
  K('switches', 0.82, { sw4: 0 });
  K('switches', 1, { ...P.switchesEnd, sw1: 0, sw2: 0, sw3: 0, sw4: 0 });
  // Сброс механики, пока модель скрыта за 2D-секциями
  K('signal', -2.2, { sw1: 0, sw2: 0, sw3: 0, sw4: 0 });
  K('signal', -2, { sw1: 1, sw2: 1, sw3: 1, sw4: 1 });
  K('signal', -1, { ...P.signal, signal: 0 });
  K('signal', 0.1, { signal: 0 });
  K('signal', 0.42, { signal: 1 });
  K('signal', 1, { ...P.signalEnd, signal: 1 });
  K('display', -0.6, { light: 0, screen: 1 });
  K('display', 0, { ...P.display, signal: 0, light: 1, nits: 0 });
  K('display', 0.35, { light: 1, nits: 0, screen: 1 });
  K('display', 0.65, { light: 0, nits: 1, screen: 0.04, dark: 1 });
  K('display', 1, { ...P.displayEnd, screen: 0.04, dark: 1 });
  K('inside', -1, { ...P.insideA, explode: 0, light: 0, nits: 1, dark: 0 });
  K('inside', 0, { ...P.insideA, explode: 0 });
  K('inside', 0.12, { explode: 0, cesium: 0 });
  K('inside', 0.6, { ...P.insideMid, explode: 1, cesium: 1 });
  K('inside', 1, { ...P.insideB, explode: 1 });
  K('colors', -1, { ...P.colorsA, light: 0, nits: 1, explode: 0, cesium: 0 });
  K('colors', 0, P.colorsA);
  K('colors', 1, P.colorsB);
  K('final', -1, P.finalA);
  K('final', 0, P.finalB);
  K('final', 1, { y: P.finalB.y + 2 }, true);

  // Появления
  splits.buildAll(reduce);

  const reveals = $$('[data-reveal]');
  reveals.forEach((el) => {
    // Лёгкий stagger внутри одного родителя
    const sibs = Array.from(el.parentElement.children).filter((c) => c.hasAttribute('data-reveal'));
    const delay = Math.min(sibs.indexOf(el), 6) * (reduce ? 0.04 : 0.07);
    const from = reduce ? { opacity: 0 } : { opacity: 0, y: 32, filter: 'blur(6px)' };
    const to = reduce
      ? { opacity: 1, duration: 0.5, delay }
      : { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1, delay, ease: 'expo.out' };
    gsap.fromTo(el, from, { ...to, scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none none' } });
  });

  // Слова загораются по мере прокрутки
  scrubWords(scrubItems, { reduce, ScrollTrigger });

  // Зарядка 0 → 100 %
  const fill = $('.charge__fill');
  const pctEl = $('[data-charge-pct]');
  const minEl = $('[data-charge-min]');
  const setCharge = (p) => {
    fill.style.setProperty('--p', p.toFixed(3));
    pctEl.textContent = String(Math.round(p * 100));
    minEl.textContent = String(Math.round(p * 38));
  };
  if (reduce) setCharge(1);
  else {
    const o = { p: 0 };
    gsap.to(o, {
      p: 1, ease: 'none', onUpdate: () => setCharge(o.p),
      scrollTrigger: { trigger: '.charge', start: 'top 80%', end: 'bottom 55%', scrub: true },
    });
  }

  // Параллакс фона и крупных цифр
  if (!reduce) {
    gsap.to('.bgfx__glow--a', { yPercent: 70, xPercent: -20, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: true } });
    gsap.to('.bgfx__glow--b', { yPercent: -60, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: true } });
    $$('.cam-hero .giant').forEach((el, i) => {
      gsap.fromTo(el, { xPercent: i ? 6 : -6 }, { xPercent: i ? -4 : 4, ease: 'none', scrollTrigger: { trigger: '.cam-hero', start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    gsap.fromTo('.hero__inner', { y: 0 }, { y: -80, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: sections.hero, start: 'top top', end: 'bottom top', scrub: true } });
  }

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
  stage?.redrawScreen();

  const mm = gsap.matchMedia();
  mm.add({
    isMobile: '(max-width: 760px)',
    isDesktop: '(min-width: 761px)',
    reduce: '(prefers-reduced-motion: reduce)',
    motion: '(prefers-reduced-motion: no-preference)',
  }, (ctx) => buildChoreography(ctx.conditions));

  // Вступление
  const loader = $('#loader');
  loader.classList.add('is-done');
  loader.setAttribute('aria-hidden', 'true');
  if (!reduceMQ.matches) {
    gsap.from('.site-header', { yPercent: -100, opacity: 0, duration: 1, ease: 'expo.out', delay: 0.2 });
  }
  window.addEventListener('load', () => ScrollTrigger.refresh());

  // Ссылка с якорем (#buy и т. п.): браузер прыгает к нему до того, как
  // расставлены пины, поэтому прокручиваем ещё раз, когда разметка готова
  let hashTarget = null;
  try { hashTarget = location.hash.length > 1 ? document.querySelector(location.hash) : null; } catch { /* неверный якорь */ }
  if (hashTarget) {
    const go = () => {
      // Lenis помнит высоту страницы до пинов — пересчитать, иначе цель обрежется
      if (smooth.lenis) { smooth.lenis.resize(); smooth.lenis.scrollTo(hashTarget, { immediate: true, force: true }); }
      else hashTarget.scrollIntoView();
    };
    requestAnimationFrame(go);
    if (document.readyState !== 'complete') window.addEventListener('load', () => requestAnimationFrame(go), { once: true });
  }
}
boot();
