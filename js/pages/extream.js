/* =========================================================================
   eXtream — хаб суббренда. Экран «Нажми любую кнопку» раз за сессию,
   3D-модель Y1 на первом экране медленно поворачивается и уходит
   при прокрутке, цена — в общей валюте сайта.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage } from '../core/stage.js';
import { createExtreamY1 } from '../models/extreamy1.js';
import { PRODUCTS } from '../data/products.js';
import { $, clamp01, store } from '../core/ui.js';
import { createSmoothScroll } from '../core/scroll.js';
import { initMenu, createAchievements, createGamepad, getCurrency } from './extream-kit.js';

gsap.registerPlugin(ScrollTrigger);
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const params = new URLSearchParams(location.search);
const PI = Math.PI;

initMenu();
const ach = createAchievements($('[data-ach]'));
const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ });
if (!reduceMQ.matches) smooth.enable();

// Цена «от» — в той валюте, что выбрана на остальном сайте
const c0 = PRODUCTS.y1.configs[0];
const cur = getCurrency();
$('[data-hub-price]').textContent = cur === 'eur' ? `от €${c0.eur}` : cur === 'cny' ? `от ¥${c0.cny}` : `от $${c0.usd}`;
const color = store.get('xtr-color');
if (PRODUCTS.y1.colors[color]) document.documentElement.dataset.color = color;

/* ---------- «Нажми любую кнопку» ---------- */

const start = $('[data-start]');
let started = false;
try { started = sessionStorage.getItem('xtr-started') === '1'; } catch { /* приватный режим */ }
function dismiss() {
  if (start.hidden || start.classList.contains('is-out')) return;
  start.classList.add('is-out');
  try { sessionStorage.setItem('xtr-started', '1'); } catch { /* приватный режим */ }
  ach.unlock('start', 'Нажал старт');
  setTimeout(() => { start.hidden = true; }, 280);
  removeEventListener('keydown', dismiss);
  removeEventListener('pointerdown', dismiss);
  removeEventListener('wheel', dismiss);
}
if (!started && !params.has('nostart')) {
  start.hidden = false;
  $('[data-start-btn]').focus({ preventScroll: true });
  addEventListener('keydown', dismiss);
  addEventListener('pointerdown', dismiss);
  addEventListener('wheel', dismiss, { passive: true });
}
createGamepad({ onButton: dismiss, onConnect: () => ach.unlock('pad', 'Геймпад на месте') });

/* ---------- 3D: Y1 на первом экране ---------- */

const canvas = $('#stage');
let stage = null;
try {
  stage = createStage(canvas, createExtreamY1, { forceFallback: params.has('fallback') });
} catch (err) {
  console.warn('[eXtream] WebGL недоступен, 3D отключено.', err);
  canvas.style.display = 'none';
}

if (stage) {
  const mobile = window.matchMedia('(max-width: 760px)');
  stage.setBodyColor(document.documentElement.dataset.color, true);
  let spin = 0;
  let vis = 1;
  ScrollTrigger.create({
    trigger: '#hero', start: 'top top', end: 'bottom top',
    onUpdate: (st) => { vis = 1 - clamp01((st.progress - 0.35) / 0.5); },
  });
  gsap.ticker.add((t, dt) => {
    if (!reduceMQ.matches) spin += (dt / 1000) * 0.18;
    const m = mobile.matches;
    canvas.style.opacity = vis.toFixed(3);
    stage.setActive(vis > 0.02 && !document.hidden);
    stage.setTarget({
      x: m ? 0 : 0.5, y: m ? 0.5 : -0.02, rx: 0.12, ry: PI - 0.55, rz: 0.05,
      dist: m ? 10 : 5.4, spin: Math.sin(spin) * 0.5, fan: 0.6, pulse: 1, screen: 1,
    });
  });
  stage.ready.then(() => { stage.redrawScreen(); stage.setScreen('lock'); });
  addEventListener('resize', () => stage.resize());
  addEventListener('pointermove', (e) => {
    if (reduceMQ.matches || e.pointerType === 'touch') return;
    stage.setPointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  }, { passive: true });
}

/* ---------- Появления ---------- */

if (!reduceMQ.matches) {
  document.querySelectorAll('.hub-manifest__lines span').forEach((el, i) => {
    gsap.fromTo(el, { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.4, delay: i * 0.08, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%' } });
  });
}
