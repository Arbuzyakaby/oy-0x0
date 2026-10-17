/* =========================================================================
   Fyr KBook 1 — скрытая страница второго устройства Fyr. Три акта:
   снаружи ноутбук на общем холсте, поза и крышка — ключевые кадры по главам
   (js/core/keys.js); в «Открыть» камера влетает в экран, и страница
   становится рабочим столом CamelOS (js/pages/fyr-kbook-desk.js); потом
   снова снаружи — сравнение, характеристики, цена.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage } from '../core/stage.js';
import { createKeys } from '../core/keys.js';
import { createFyrKBook } from '../models/fyrkbook.js';
import { $, $$, clamp01, createToast, syncRadio, initRadioGroup } from '../core/ui.js';
import { createSmoothScroll } from '../core/scroll.js';
import { initDesk } from './fyr-kbook-desk.js';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const root = document.documentElement;
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const params = new URLSearchParams(location.search);
const toast = createToast($('#toast'), gsap);
const ease = (t) => { const c = clamp01(t); return c * c * (3 - 2 * c); };

/* ---------- 3D ---------- */

const canvas = $('#stage');
let stage = null;
try {
  stage = createStage(canvas, createFyrKBook, { forceFallback: params.has('fallback') });
} catch (err) {
  console.warn('[Fyr] WebGL недоступен, 3D отключено.', err);
  canvas.style.display = 'none';
}

/* ---------- Главы ---------- */

const CHAPTERS = ['intercept', 'days', 'back', 'case', 'chip', 'd1', 'shutter', 'open', 'boot', 'setup', 'rtds', 'mirage', 'watch', 'trash', 'compare', 'specs', 'price'];
const sections = Object.fromEntries(CHAPTERS.map((id) => [id, document.getElementById(id)]));
let current = 'intercept';

function detectChapter() {
  const line = window.innerHeight * 0.5;
  let id = CHAPTERS[0];
  for (const c of CHAPTERS) if (sections[c].getBoundingClientRect().top <= line) id = c;
  if (id !== current) { current = id; updateScreen(); }
}

/* ---------- Экран ноутбука ---------- */

const demo = { dark: false, kill: false, filter: true, angle: 0, lid: 0 };
let lastScreen = '';
function updateScreen() {
  if (!stage) return;
  let mode = 'desk';
  if (current === 'intercept' || current === 'days' || current === 'back') mode = 'intercept';
  else if (current === 'case' || current === 'chip') mode = 'boot';
  else if (current === 'shutter') mode = demo.filter && Math.abs(demo.angle) > 35 ? 'filter' : 'desk';
  if (mode === lastScreen) return;
  lastScreen = mode;
  stage.setScreen(mode, { accent: getComputedStyle(root).getPropertyValue('--desk-accent').trim() || '#2F6BFF' });
}

/* ---------- Позы ---------- */

// x/y — доля половины видимой ширины/высоты; fx/fy/fz — точка модели, которая ставится в (x, y)
// lid — доля раскрытия крышки (1 = 118°), keys — подсветка клавиатуры
const BASE = { x: 0, y: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: 0, rz: 0, dist: 9, float: 1, vis: 1, spin: 0, lid: 0, keys: 0 };
// центр экрана при крышке 108°: в единицах сцены (модель ×10, мм → 0,01)
const SCREEN_C = { fx: 0, fy: 1.105, fz: -1.379 };
function makePoses(mobile) {
  const P = {
    hero: { x: 0.36, y: -0.06, rx: 0.62, ry: -0.5, rz: 0.04, dist: 8.6, lid: 0 },
    hidden: { x: 0.4, rx: 0.5, ry: -0.9, dist: 12, float: 0, vis: 0 },
    caseA: { x: 0.42, rx: 0.7, ry: -0.35, dist: 8.2, lid: 0, float: 0.4 },
    caseB: { x: 0.44, y: -0.12, rx: 0.36, ry: -0.75, dist: 11, lid: 0.86, keys: 0.6, float: 0.3 },
    caseC: { x: 0.44, y: -0.1, rx: 0.12, ry: -1.45, dist: 10.4, lid: 0.86, keys: 0.6, float: 0.2 },
    d1: { x: 0.44, y: -0.12, rx: 0.3, ry: 1.0, dist: 10, lid: 0.82, keys: 0.4, float: 0.2 },
    shutter: { x: -0.44, y: -0.12, rx: 0.22, ry: 0, dist: 10.4, lid: 0.86, keys: 0.3, float: 0 },
    openA: { x: 0, y: -0.1, rx: 0.32, ry: 0, dist: 10.4, lid: 0.86, keys: 0.8, float: 0 },
    openB: { x: 0, y: 0, ...SCREEN_C, rx: 0.315, ry: 0, dist: 2.75, lid: 0.915, keys: 0.8, float: 0 },
    specs: { x: 0.56, rx: 0.62, ry: -0.6, rz: 0.05, dist: 10.5, lid: 0 },
  };
  for (const k in P) P[k] = { ...BASE, ...P[k] };
  if (!mobile) return P;
  // телефон: ноутбук в верхней части экрана, текст ниже
  for (const k in P) {
    const p = P[k];
    if (k === 'openB') { P[k] = { ...p, dist: 5.6 }; continue; }
    P[k] = { ...p, x: 0, fx: 0, y: 0.52, dist: p.dist * 2.3 };
  }
  return P;
}

const Keys = createKeys();
const sts = {};
let reducedMode = reduceMQ.matches;
const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ });

/* ---------- 1. «Восемь дней» ---------- */

const dayItems = $$('.days__item');
const ledger = $$('[data-ledger] > div');
const balanceOut = $('[data-balance]');
const NET = 0x1D905C0 - 0xDBBA0;
function setDays(p) {
  dayItems.forEach((el, i) => {
    const o = ease((p - 0.05 - i * 0.09) / 0.1);
    el.style.setProperty('--o', o.toFixed(3));
    el.classList.toggle('is-on', o > 0.5);
  });
  ledger.forEach((el, i) => el.style.setProperty('--o', ease((p - 0.6 - i * 0.08) / 0.1).toFixed(3)));
  const g = ease((p - 0.76) / 0.18);
  balanceOut.textContent = `+0x${Math.round(g * NET).toString(16).toUpperCase()}`;
}

/* ---------- 3. Корпус: угол крышки ---------- */

const lidOut = $('[data-lid-readout]');

/* ---------- Хореография ---------- */

function buildChoreography({ isMobile, reduce }) {
  reducedMode = reduce;
  stage?.setReduced(reduce);
  if (reduce) smooth.disable(); else smooth.enable();
  Keys.reset();
  const P = makePoses(isMobile);
  const openText = $('.kb-open__text');

  for (const id of CHAPTERS) {
    if (id === 'days' || id === 'case' || id === 'open') {
      const len = id === 'case' ? '+=200%' : id === 'open' ? '+=180%' : '+=200%';
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: sections[id],
          start: 'top top', end: reduce ? 'bottom top' : len, pin: !reduce, scrub: reduce ? false : true, anticipatePin: 1,
          onUpdate: (st) => {
            if (id === 'days') setDays(st.progress);
            if (id === 'open') openText.style.setProperty('--o', (1 - ease((st.progress - 0.15) / 0.3)).toFixed(3));
          },
        },
      });
      tl.set({}, {}, 1);
      sts[id] = tl.scrollTrigger;
    } else {
      sts[id] = ScrollTrigger.create({ trigger: sections[id], start: 'top top', end: 'bottom top' });
    }
  }
  if (reduce) setDays(1);

  const K = (id, f, props) => Keys.add(sts[id], f, props);
  const hold = (id, pose) => { K(id, -0.4, pose); K(id, 0.55, pose); };
  K('intercept', -1, P.hero);
  hold('intercept', P.hero);
  hold('days', P.hidden);
  hold('back', P.hidden);
  K('case', -0.2, P.caseA);
  K('case', 0.0, P.caseA);
  K('case', 0.5, P.caseB);
  K('case', 0.85, P.caseC);
  K('case', 1, P.caseC);
  hold('chip', P.hidden);
  hold('d1', P.d1);
  hold('shutter', P.shutter);
  K('open', -0.3, P.openA);
  K('open', 0.1, P.openA);
  K('open', 0.8, P.openB);
  K('open', 0.9, P.openB);
  K('open', 1, { ...P.openB, vis: 0 });
  for (const id of ['boot', 'setup', 'rtds', 'mirage', 'watch', 'trash', 'compare']) hold(id, { ...P.openB, vis: 0 });
  K('specs', -0.5, { ...P.specs, vis: 0 });
  K('specs', -0.2, P.specs);
  K('specs', 0.55, P.specs);
  K('price', -0.2, P.hidden);
  K('price', 1, P.hidden);

  // Цитата с /fyr/ зачёркивается
  const quote = $('.kb-quote__old');
  if (reduce) quote.style.setProperty('--cross', '1');
  else gsap.fromTo(quote, { '--cross': 0 }, { '--cross': 1, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: quote, start: 'top 70%', toggleActions: 'play none none reverse' } });

  // Появление текста глав — короткий сдвиг (окна рабочего стола не трогаем: их двигают руками)
  if (!reduce) {
    $$('.fy__text > *, .win-note > *').forEach((el) => {
      gsap.fromTo(el, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none none' } });
    });
  }

  ScrollTrigger.refresh();
  return () => Keys.reset();
}
ScrollTrigger.addEventListener('refresh', () => { Keys.compile(window.innerHeight); detectChapter(); });

/* ---------- 0. Печать сигнала ---------- */

const typeEl = $('[data-type]');
const typeText = typeEl.textContent;
function typeIn() {
  if (reducedMode) return;
  typeEl.textContent = '';
  let i = 0;
  const step = () => {
    typeEl.textContent = typeText.slice(0, ++i);
    if (i < typeText.length) setTimeout(step, 18 + Math.random() * 30);
  };
  step();
}

/* ---------- Цены в hex: касание открывает десятичную ---------- */

$$('.fy-hex').forEach((b) => {
  const hex = b.textContent.trim();
  b.setAttribute('aria-label', `${hex} — это ${b.dataset.hex}`);
  const tip = document.createElement('span');
  tip.className = 'fy-hex__tip';
  tip.setAttribute('aria-hidden', 'true');
  tip.innerHTML = '<span class="fy-hex__tip-head"></span><span class="fy-hex__tip-val"></span><span class="fy-hex__tip-note">base 16 → base 10</span>';
  tip.children[0].textContent = `${hex.split(' ')[0]} → DEC`;
  tip.children[1].textContent = b.dataset.hex;
  b.append(tip);
  b.addEventListener('click', () => {
    const open = !b.classList.contains('is-open');
    $$('.fy-hex').forEach((o) => o.classList.remove('is-open'));
    b.classList.toggle('is-open', open);
  });
});
$('[data-calm]').addEventListener('click', () => toast('Мы тоже не торопились. KBook вышел в один день с Moth 2.'));
$$('.fy-hero__buy a[href="#price"]').forEach((a) => a.addEventListener('click', () => setTimeout(() => toast('Не торопитесь. Сначала откройте крышку.'), 300)));
$('[data-jabs-toggle]').addEventListener('click', () => toast('Выключить нельзя. Код открыт — уберите сами.'));

/* ---------- 4. Кристалл: ядра и «Темно» ---------- */

const NS = 'http://www.w3.org/2000/svg';
const rect = (g, x, y, w, h) => {
  const r = document.createElementNS(NS, 'rect');
  Object.entries({ x, y, width: w, height: h, rx: 3 }).forEach(([k, v]) => r.setAttribute(k, String(v)));
  g.append(r);
};
const cpu = $('[data-chip-cpu]');
for (let i = 0; i < 8; i++) rect(cpu, 78 + (i % 2) * 56, 84 + Math.floor(i / 2) * 44, 48, 36);
for (let i = 0; i < 4; i++) rect(cpu, 78 + i * 27, 264, 21, 22);
const gpu = $('[data-chip-gpu]');
for (let i = 0; i < 16; i++) rect(gpu, 214 + (i % 4) * 29, 84 + Math.floor(i / 4) * 47, 23, 39);

const darkGrp = $('[data-dark]');
initRadioGroup(darkGrp, (v) => {
  demo.dark = v === 'dark';
  syncRadio(darkGrp, v);
  root.classList.toggle('is-dark', demo.dark);
});

/* ---------- 5. «Рубильник» ---------- */

const killBtn = $('[data-kill-switch]');
const killItems = $$('[data-kill-item]');
const radioOut = $('[data-desk-radio]');
killBtn.addEventListener('click', () => {
  demo.kill = !demo.kill;
  killBtn.setAttribute('aria-checked', String(demo.kill));
  killItems.forEach((li, i) => {
    setTimeout(() => {
      li.classList.toggle('is-off', demo.kill);
      li.querySelector('b').textContent = demo.kill ? 'обесточено' : 'вкл';
    }, reducedMode ? 0 : i * 90);
  });
  radioOut.textContent = demo.kill ? 'радио выкл' : 'радио вкл';
});

/* ---------- 6. «Шторка» ---------- */

const angleIn = $('[data-angle-input]');
const angleOut = $('[data-angle-out]');
const angleState = $('[data-angle-state]');
const filterBtn = $('[data-filter]');
function renderAngle() {
  angleOut.textContent = `${demo.angle}°`;
  const hidden = demo.filter && Math.abs(demo.angle) > 35;
  angleState.textContent = hidden ? 'Видно: только вам. Сбоку — чёрный экран' : demo.filter ? 'Видно: вам. Сбоку ещё видно' : 'Шторка выключена: видно всем';
  updateScreen();
}
angleIn.addEventListener('input', () => { demo.angle = Number(angleIn.value); renderAngle(); });
filterBtn.addEventListener('click', () => {
  demo.filter = !demo.filter;
  filterBtn.setAttribute('aria-pressed', String(demo.filter));
  filterBtn.textContent = demo.filter ? '0x3 · Шторка вкл' : '0x3 · Шторка выкл';
  renderAngle();
});

/* ---------- 15. Цвет ---------- */

const NOTES = {
  polarnatt: 'Тёмный магний-литий, стальная фаска, синий тритий.',
  stral: 'Светлый магний-литий, белая фаска, белый тритий.',
};
const colorGrp = $('[data-color-switch]');
initRadioGroup(colorGrp, (v) => {
  syncRadio(colorGrp, v);
  root.dataset.color = v;
  $('[data-color-note]').textContent = NOTES[v];
  stage?.setBodyColor(v);
});

/* ---------- Акт II ---------- */

initDesk({ toast, reduceMQ, onAccent: () => { lastScreen = ''; updateScreen(); } });

/* ---------- Каждый тик: прокрутка → модель ---------- */

let lastY = -1;
let lastLid = -1;
function tick() {
  const y = window.scrollY;
  if (y !== lastY) { lastY = y; detectChapter(); }
  if (Keys.empty || !stage) return;
  const v = Keys.sample(y, reducedMode);
  const killOn = demo.kill && (current === 'd1' || current === 'shutter');
  v.sw = killOn ? 1 : 0;
  v.shut = killOn ? 1 : 0;
  v.dark = current === 'specs' || current === 'intercept' ? 0.35 : 0;
  v.screen = 1;
  if (current === 'shutter') v.ry = (v.ry || 0) + (demo.angle * Math.PI) / 180;
  const deg = Math.round(clamp01(v.lid) * 118);
  if (current === 'case' && deg !== lastLid) { lastLid = deg; lidOut.textContent = `${deg}°`; }
  const vis = clamp01(v.vis ?? 1);
  canvas.style.opacity = vis.toFixed(3);
  stage.setActive(vis > 0.02 && !document.hidden);
  stage.setTarget(v);
}
gsap.ticker.add(tick);
if (params.has('debug')) window.__kbook = { stage, Keys, ScrollTrigger, sts, demo };

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
  typeIn();
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
