/* =========================================================================
   OY 0X2 Essential — свой тип страницы. Вместо закреплённых секций —
   горизонтальная лента из десяти кадров: вертикальная прокрутка двигает
   её вбок, а телефон переходит из позы в позу между соседними кадрами.
   Пульт внизу экрана — шторка, «Слух», «Эфир» и Красный режим — двигает
   детали модели и меняет саму страницу. Последний кадр — чек.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage } from '../core/stage.js';
import { createOY0X2E } from '../models/oy0x2e.js';
import { PRODUCTS, getConfig } from '../data/products.js';
import { $, $$, clamp01, createToast, syncRadio, initRadioGroup, bindStubs } from '../core/ui.js';
import { createSmoothScroll } from '../core/scroll.js';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const root = document.documentElement;
root.classList.add('anim');

const PI = Math.PI;
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const mobileMQ = window.matchMedia('(max-width: 760px)');
const params = new URLSearchParams(location.search);
const toast = createToast($('#toast'), gsap);

/* ---------- 3D-сцена ---------- */

const canvas = $('#stage');
let stage = null;
try {
  stage = createStage(canvas, createOY0X2E, { forceFallback: params.has('fallback') });
} catch (err) {
  console.warn('[OY 0X2 Essential] WebGL недоступен, 3D отключено.', err);
  canvas.style.display = 'none';
}

/* ---------- Пульт: состояние телефона и страницы ---------- */

const ctl = { shutter: false, mic: true, air: true, red: false };
const airBadge = $('[data-air-badge]');

function renderCtl() {
  $$('[data-ctl]').forEach((b) => b.setAttribute('aria-checked', String(ctl[b.dataset.ctl])));
  const sAct = $('[data-act="shutter"]');
  sAct.setAttribute('aria-pressed', String(ctl.shutter));
  $('[data-act-label]', sAct).textContent = ctl.shutter ? 'Открыть шторку' : 'Закрыть шторку';
  const rAct = $('[data-act="red"]');
  rAct.setAttribute('aria-pressed', String(ctl.red));
  $('[data-act-label]', rAct).innerHTML = ctl.red ? 'Выключить' : 'Включить на&nbsp;этой странице';
  root.classList.toggle('is-red', ctl.red);
  airBadge.hidden = ctl.air;
  stage?.setSignalColor(ctl.red ? 'red' : 'white');
}

const CTL_TOAST = {
  shutter: ['Шторка открыта. Камера снова под питанием.', 'Шторка закрыта. Tesseract снял питание с камеры.'],
  mic: ['«Слух» выключен: цепь микрофонов разорвана.', '«Слух» включён.'],
  air: ['«Эфир» выключен: связь, Wi-Fi, Bluetooth, NFC и геолокация обесточены.', '«Эфир» включён.'],
};
function flip(name) {
  ctl[name] = !ctl[name];
  renderCtl();
  const t = CTL_TOAST[name];
  if (t) toast(name === 'shutter' ? t[+ctl.shutter] : t[+ctl[name]]);
}
$$('[data-ctl]').forEach((b) => b.addEventListener('click', () => flip(b.dataset.ctl)));
$$('[data-act]').forEach((b) => b.addEventListener('click', () => flip(b.dataset.act)));
renderCtl();

/* ---------- 04: видоискатель 1× / 2× ---------- */

{
  const group = $('[data-zoom-switch]');
  const view = $('.finder__view');
  const mp = $('[data-finder-mp]');
  const set = (v) => { syncRadio(group, v); view.dataset.zoom = v; mp.textContent = v === '2' ? '12 МП, кроп 2×' : '50 МП'; };
  initRadioGroup(group, set);
  set('1');
}

/* ---------- 10: чек ---------- */

const PRODUCT = PRODUCTS['0x2e'];
{
  const group = $('[data-mem-switch]');
  const usd = $('[data-price-usd]');
  const total = $('[data-price-total]');
  const eur = $('[data-price-eur]');
  const cny = $('[data-price-cny]');
  const name = $('[data-cfg-name]');
  let shown = PRODUCT.configs[0].usd;
  const set = (v, animate = true) => {
    const cfg = getConfig(PRODUCT.id, v);
    if (!cfg) return;
    syncRadio(group, v);
    name.textContent = `${v} ГБ`;
    eur.textContent = `€${cfg.eur}`;
    cny.textContent = `¥${cfg.cny}`;
    usd.textContent = `$${cfg.usd}`;
    if (!animate || reduceMQ.matches) { total.textContent = `$${cfg.usd}`; shown = cfg.usd; return; }
    const o = { n: shown };
    shown = cfg.usd;
    gsap.to(o, { n: cfg.usd, duration: 0.6, ease: 'power3.out', onUpdate: () => { total.textContent = `$${Math.round(o.n)}`; } });
  };
  initRadioGroup(group, (v) => set(v));
  set(PRODUCT.configs[0].id, false);

  $('[data-price-table]').innerHTML = PRODUCT.configs
    .map((c) => `<tr><td>${c.id} ГБ</td><td>$${c.usd}</td><td>€${c.eur}</td><td>¥${c.cny}</td></tr>`).join('');
}

bindStubs(toast);

/* ---------- Позы телефона по кадрам ---------- */

// x/y — доля половины экрана; fx/fy/fz — точка модели, которая ставится в (x, y)
const CAM = { fx: 0.21, fy: 0.515, fz: -0.05 };
const POSES_DESKTOP = {
  hero: { x: 0.44, y: -0.02, rx: 0.12, ry: -PI + 0.55, rz: 0.06, dist: 5.6 },
  shutter: { x: 0.48, y: 0, fx: 0.11, fy: CAM.fy, fz: CAM.fz, rx: 0.16, ry: -PI + 0.3, rz: 0, dist: 2.9 },
  switches: { x: 0.52, y: 0, fx: -0.355, fy: 0.3, rx: 0.1, ry: -1.5 * PI + 0.12, rz: 0, dist: 2.7 },
  camera: { x: 0.46, y: 0, ...CAM, rx: 0.08, ry: -PI + 0.14, rz: 0, dist: 2.9 },
  tesseract: { x: 0.42, y: 0, rx: 0.55, ry: -0.75, rz: 0.1, dist: 6.2, explode: 1, tesseract: 1 },
  red: { x: 0.4, y: 0, rx: 0.05, ry: -0.28, rz: 0, dist: 5.0 },
  display: { x: 0.4, y: 0, rx: -0.04, ry: 0.22, rz: 0, dist: 4.6 },
  repair: { x: 0.45, y: -0.05, fy: -0.75, rx: -1.2, ry: PI - 0.3, rz: 0, dist: 2.2 },
  kept: { x: 0.56, y: 0, rx: 0.12, ry: -PI + 0.9, rz: 0.04, dist: 6.4 },
  buy: { x: 0.44, y: 0, rx: 0.1, ry: -PI + 0.5, rz: 0.04, dist: 6.0 },
};
const POSES_MOBILE = {
  hero: { x: 0, y: 0.42, rx: 0.12, ry: -PI + 0.5, rz: 0.06, dist: 7.6 },
  shutter: { x: 0, y: 0.45, fx: 0.11, fy: CAM.fy, fz: CAM.fz, rx: 0.16, ry: -PI + 0.3, dist: 3.0 },
  switches: { x: 0, y: 0.45, fx: -0.355, fy: 0.3, rx: 0.1, ry: -1.5 * PI + 0.12, dist: 2.8 },
  camera: { x: 0, y: 0.5, ...CAM, rx: 0.08, ry: -PI + 0.14, dist: 2.7 },
  tesseract: { x: 0, y: 0.44, rx: 0.55, ry: -0.75, rz: 0.1, dist: 8.6, explode: 1, tesseract: 1 },
  red: { x: 0, y: 0.48, rx: 0.05, ry: -0.28, dist: 7.4 },
  display: { x: 0, y: 0.48, rx: -0.04, ry: 0.22, dist: 7.0 },
  repair: { x: 0, y: 0.48, fy: -0.75, rx: -1.2, ry: PI - 0.3, dist: 3.2 },
  kept: { x: 0, y: 1.7, rx: 0.12, ry: -PI + 0.9, dist: 8 },
  buy: { x: 0, y: 1.7, rx: 0.1, ry: -PI + 0.5, dist: 8 },
};
const BASE = { x: 0, y: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: 0, rz: 0, s: 1, dist: 5.4, float: 1, explode: 0, tesseract: 0, screen: 1 };

const frames = $$('[data-frame]');
frames.forEach((f, i) => { f.dataset.no = String(i + 1).padStart(2, '0'); });
const ids = frames.map((f) => f.dataset.frame);

function poseAt(pos, mobile) {
  const P = mobile ? POSES_MOBILE : POSES_DESKTOP;
  const n = ids.length - 1;
  const f = Math.max(0, Math.min(n, pos));
  const i = Math.min(n - 1, Math.floor(f));
  let t = f - i;
  // держим позу у центра кадра, переходим на стыке
  t = clamp01((t - 0.25) / 0.5);
  t = t * t * (3 - 2 * t);
  const a = { ...BASE, ...P[ids[i]] };
  const b = { ...BASE, ...P[ids[i + 1]] };
  const out = {};
  for (const k in BASE) out[k] = a[k] + (b[k] - a[k]) * t;
  out.float = 1 - Math.sin(t * PI) * 0.6;
  return out;
}

/* ---------- 07: частота экрана от скорости прокрутки ---------- */

const hzEl = $('[data-hz]');
const hzCap = $('[data-hz-cap]');
let hz = 1;
let lastY = window.scrollY;
function stepHz(dt) {
  const v = Math.abs(window.scrollY - lastY) / Math.max(dt, 1 / 240);
  lastY = window.scrollY;
  const want = v < 4 ? 1 : v < 120 ? 60 : v < 600 ? 120 : 144;
  hz += (want - hz) * (want > hz ? 0.5 : 0.06);
  const shown = hz < 1.5 ? 1 : Math.round(hz);
  if (hzEl.textContent !== String(shown)) hzEl.textContent = shown;
  const cap = shown === 1 ? 'Страница стоит — экран отдыхает' : shown >= 140 ? 'Листаете быстро — 144 Гц' : 'Листаете — частота растёт';
  if (hzCap.textContent !== cap) hzCap.textContent = cap;
}

/* ---------- Лента и её прокрутка ---------- */

const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ });
// закрепление ленты удлиняет страницу на девять экранов — Lenis должен узнать новую высоту
ScrollTrigger.addEventListener('refresh', () => smooth.lenis?.resize());
const reel = $('#reel');
const track = $('[data-track]');
const bar = $('[data-progress]');
const frameNo = $('[data-frame-no]');
const consoleEl = $('.console');
const specsEl = $('#specs');
let reelPos = 0;          // 0…9 — номер кадра с дробной частью
let staticMode = false;

function build({ reduce, isMobile }) {
  staticMode = !!reduce;
  reel.classList.toggle('is-static', staticMode);
  if (reduce) smooth.disable(); else smooth.enable();
  if (staticMode) {
    // кадры стопкой: поза — по кадру в центре экрана
    frames.forEach((f, i) => ScrollTrigger.create({
      trigger: f, start: 'top 55%', end: 'bottom 55%',
      onToggle: (s) => { if (s.isActive) reelPos = i; },
    }));
    return () => {};
  }

  const dist = () => track.scrollWidth - window.innerWidth;
  const tween = gsap.to(track, {
    x: () => -dist(), ease: 'none',
    scrollTrigger: {
      trigger: reel, start: 'top top', end: () => `+=${dist() * (isMobile ? 1 : 1.15)}`,
      pin: true, scrub: true, invalidateOnRefresh: true, anticipatePin: 1,
      onUpdate: (s) => { reelPos = s.progress * (frames.length - 1); },
    },
  });

  // пульт прячется, когда лента закончилась
  const away = ScrollTrigger.create({
    trigger: '#specs', start: 'top 70%', end: 'max',
    onToggle: (s) => consoleEl.classList.toggle('is-away', s.isActive),
  });

  // появление текста в кадре, когда он въезжает
  const reveals = frames.slice(1).map((f) => gsap.from($$('.frame__text > *', f), {
    y: 30, opacity: 0, stagger: 0.05, ease: 'power3.out', duration: 0.8,
    scrollTrigger: { trigger: f, containerAnimation: tween, start: 'left 70%', toggleActions: 'play none none reverse' },
  }));

  return () => { tween.scrollTrigger?.kill(); tween.kill(); away.kill(); reveals.forEach((r) => { r.scrollTrigger?.kill(); r.kill(); }); gsap.set(track, { x: 0 }); };
}

/* ---------- Каждый тик ---------- */

let lastNo = '';
let debugPose = null;     // ?debug: __oy.pose({...}) подменяет позу для подбора ракурсов
function tick(time, deltaMs) {
  const dt = (deltaMs || 16) / 1000;
  stepHz(dt);
  const no = String(Math.round(reelPos) + 1).padStart(2, '0');
  if (no !== lastNo) { lastNo = no; frameNo.textContent = no; }
  bar.style.transform = `scaleX(${reelPos / (frames.length - 1)})`;
  if (!stage) return;
  const v = poseAt(staticMode ? Math.round(reelPos) : reelPos, mobileMQ.matches);
  // вне ленты (характеристики) телефон уходит вверх
  const past = clamp01(1 - specsEl.getBoundingClientRect().top / window.innerHeight);
  v.y += past * 2;
  v.shutter = ctl.shutter ? 1 : 0;
  v.sw1 = ctl.mic ? 1 : 0;
  v.sw2 = ctl.air ? 1 : 0;
  v.red = ctl.red ? 1 : 0;
  v.signal = ctl.red && ids[Math.round(reelPos)] === 'red' ? 0.7 : 0;
  if (debugPose) Object.assign(v, debugPose);
  stage.setTarget(v);
}
gsap.ticker.add(tick);
if (params.has('debug')) window.__oy = { stage, ScrollTrigger, ctl, lenis: () => smooth.lenis, pos: () => reelPos, pose: (p) => { debugPose = p; } };

/* ---------- Рендер только когда видно ---------- */

if (stage) {
  let onScreen = true;
  const update = () => stage.setActive(onScreen && !document.hidden);
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; update(); }, { rootMargin: '0px 0px 20% 0px' }).observe(reel);
  document.addEventListener('visibilitychange', update);
  window.addEventListener('pointermove', (e) => {
    if (reduceMQ.matches || e.pointerType === 'touch') return;
    stage.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });
  window.addEventListener('resize', () => stage.resize());
}

/* ---------- Запуск ---------- */

async function boot() {
  const timeout = (ms) => new Promise((r) => setTimeout(r, ms));
  const fonts = document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve();
  await Promise.race([Promise.all([fonts, stage ? stage.ready : null, timeout(500)]), timeout(14000)]);
  stage?.redrawScreen();
  // первая поза — сразу, без въезда от позы по умолчанию
  tick(0, 16);
  stage?.snap();

  const mm = gsap.matchMedia();
  mm.add({
    isMobile: '(max-width: 760px)',
    isDesktop: '(min-width: 761px)',
    reduce: '(prefers-reduced-motion: reduce)',
  }, (c) => build(c.conditions));
  ScrollTrigger.refresh();

  const loader = $('#loader');
  loader.classList.add('is-done');
  loader.setAttribute('aria-hidden', 'true');
  if (!reduceMQ.matches) {
    gsap.from('.site-header', { yPercent: -100, opacity: 0, duration: 1, ease: 'expo.out', delay: 0.2 });
    // fromTo, а не from: класс is-away мог успеть спрятать пульт, и from запомнил бы opacity 0
    gsap.fromTo('.console', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'expo.out', delay: 0.5, clearProps: 'transform,opacity' });
    gsap.from('.frame--hero .frame__text > *', { y: 40, opacity: 0, stagger: 0.07, duration: 1, ease: 'expo.out', delay: 0.15 });
  }
  window.addEventListener('load', () => ScrollTrigger.refresh());

  // Якорь на кадр внутри ленты: прокручиваем до нужной доли ленты
  const goFrame = (id) => {
    const i = ids.indexOf(id);
    const st = ScrollTrigger.getAll().find((s) => s.pin === reel);
    if (i < 0 || !st) return false;
    const y = st.start + (st.end - st.start) * (i / (ids.length - 1));
    if (smooth.lenis) smooth.lenis.scrollTo(y, { duration: 1.4 }); else window.scrollTo({ top: y, behavior: 'smooth' });
    return true;
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    if (ids.includes(id) && goFrame(id)) { e.preventDefault(); e.stopImmediatePropagation(); history.replaceState(null, '', `#${id}`); }
  }, true);
  const hash = location.hash.slice(1);
  if (hash && ids.includes(hash)) requestAnimationFrame(() => {
    const st = ScrollTrigger.getAll().find((s) => s.pin === reel);
    if (st) window.scrollTo(0, st.start + (st.end - st.start) * (ids.indexOf(hash) / (ids.length - 1)));
  });
}
boot();
