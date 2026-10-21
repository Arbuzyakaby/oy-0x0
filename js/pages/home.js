/* =========================================================================
   Fyr и телефоны OY — главная: часы и ноутбук Fyr, модельный ряд OY в 3D, выбор, мини-сравнение.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage } from '../core/stage.js';
import { createOY0X2 } from '../models/oy0x2.js';
import { createOY0X2Q } from '../models/oy0x2q.js';
import { createOY0X3E } from '../models/oy0x3e.js';
import { createOY0X2Pro } from '../models/oy0x2pro.js';
import { createOYMoth2 } from '../models/oymoth.js';
import { createOYNova } from '../models/oynova.js';
import { createFyrOsmium } from '../models/fyrosmium.js';
import { createFyrKBook } from '../models/fyrkbook.js';
import { createFyrH1 } from '../models/fyrh1.js';
import { COMPARE, COMPARE_MODELS, ON_SALE } from '../data/products.js';
import { $, $$ } from '../core/ui.js';
import { createSmoothScroll } from '../core/scroll.js';
import { createSplitReveals } from '../core/text.js';

// Старые ссылки на секции страницы 0X0 (/#buy и т. п.) — туда, где они теперь живут
const OLD_IDS = ['hero', 'zero', 'shutter', 'switches', 'compare', 'nogoogle', 'journal', 'os', 'features', 'network', 'security',
  'signal', 'display', 'camera', 'battery', 'perf', 'inside', 'colors', 'story', 'honest', 'box', 'highlights', 'buy', 'specs', 'final'];
const hashId = location.hash.slice(1);
if (hashId && OLD_IDS.includes(hashId) && !['hero', 'os'].includes(hashId)) {
  location.replace(`/0x0/${location.search}${location.hash}`);
}

gsap.registerPlugin(ScrollTrigger);
const root = document.documentElement;
root.classList.add('anim');
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const params = new URLSearchParams(location.search);
const PI = Math.PI;

const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ });

/* ---------- Модельный ряд: шесть телефонов в одном масштабе ---------- */

// У всех одна камера и одна точка опоры — низ корпуса стоит на общей линии,
// поэтому разница в росте настоящая: 0X2 Pro — 166 мм, 0X2Q — 142,4 мм.
const HEIGHT = { '0x3e': 150, '0x2': 161, moth2: 166.7, '0x2q': 142.4, '0x2pro': 166, nova: 164.8 };
const TURN = { '0x3e': -PI + 0.5, '0x2': -PI + 0.32, moth2: -PI + 0.45, '0x2q': -PI + 0.5, '0x2pro': -PI - 0.4, nova: -PI + 0.42 };
const DIST = 4.05;
const pose = (id) => ({ x: 0, y: -0.9, fx: 0, fy: -HEIGHT[id] / 200, fz: 0, rx: 0.04, ry: TURN[id], rz: 0, dist: DIST, float: 0.35, screen: 1 });
const MODELS = { '0x3e': [createOY0X3E, 'radium'], '0x2': [createOY0X2, 'honey'], moth2: [createOYMoth2, 'orange'], '0x2q': [createOY0X2Q, 'tesseract'], '0x2pro': [createOY0X2Pro, 'sky'], nova: [createOYNova, 'supernova'] };
const stages = [];
$$('.lineup__item').forEach((item) => {
  const id = item.dataset.model;
  const canvas = $('.lineup__canvas', item);
  let stage = null;
  try {
    stage = createStage(canvas, MODELS[id][0], { forceFallback: params.has('fallback'), fitCanvas: true });
  } catch (err) {
    console.warn('[OY] WebGL недоступен, 3D отключено.', err);
    canvas.style.visibility = 'hidden';
    return;
  }
  const rest = pose(id);
  // при наведении телефон разворачивается к вам экраном вполоборота;
  // у 0X2Q заодно выезжает модуль, 0X2 Pro поворачивается экраном и поднимает фронталку из-под CPix,
  // Moth складывается и встаёт на линию петлёй вниз, «Крылом» к вам (камера чуть дальше: сложенный он шире колонки), а у Nova выезжает перо
  const near = id === 'nova' ? { ry: -0.35, pen: 0.32 } : id === '0x2pro' ? { ry: -0.3, cpix1: 1 } : id === 'moth2' ? { ry: -0.28, fold: 1, rz: PI, fy: 0, dist: DIST * 1.2 } : { ry: TURN[id] + (TURN[id] > -PI ? -0.9 : 0.9), ext: 1 };
  stage.setTarget(rest);
  stage.setBodyColor(MODELS[id][1], true);
  stage.setReduced(reduceMQ.matches);
  stage.ready.then(() => stage.snap());
  const turn = (on) => stage.setTarget(on ? { ...rest, ...near } : rest);
  item.addEventListener('pointerenter', () => turn(true));
  item.addEventListener('pointerleave', () => { turn(false); stage.setPointer(0, 0); });
  item.addEventListener('focus', () => turn(true));
  item.addEventListener('blur', () => turn(false));
  item.addEventListener('pointermove', (e) => {
    if (reduceMQ.matches || e.pointerType === 'touch') return;
    const r = canvas.getBoundingClientRect();
    stage.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
  });
  stages.push(stage);
});

/* ---------- Fyr: часы и ноутбук над телефонами ---------- */

// Часы смотрят циферблатом вполоборота, ноутбук открыт и показывает рабочий стол CamelOS;
// при наведении часы разворачиваются к вам, а крышка KBook раскрывается шире
const FYR = {
  h1: {
    create: createFyrH1, screen: 'lock',
    rest: { x: 0, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.14, ry: Math.PI - 0.55, rz: 0.06, dist: 5.6, float: 0.6, vis: 1, spin: 0, screen: 1 },
    near: { rx: 0.06, ry: Math.PI + 0.3, rz: 0.02, dist: 5.1 },
  },
  osmium: {
    create: createFyrOsmium, screen: 'face',
    rest: { x: 0, y: 0.02, fx: 0, fy: 0, fz: 0, rx: 0.6, ry: -0.5, rz: 0.1, dist: 2.45, float: 0.6, vis: 1, crown: 0, spin: 0, screen: 1 },
    near: { rx: 0.12, ry: -0.12, rz: 0.02, dist: 2.15 },
  },
  kbook: {
    create: createFyrKBook, screen: 'desk',
    rest: { x: 0, y: -0.04, fx: 0, fy: 0, fz: 0, rx: 0.36, ry: -0.5, rz: 0.02, dist: 10.2, float: 0.4, vis: 1, spin: 0, lid: 0.78, keys: 0.5, screen: 1 },
    near: { rx: 0.3, ry: -0.18, lid: 0.9, keys: 0.9, dist: 9.4 },
  },
};
$$('[data-fyr-model]').forEach((item) => {
  const cfg = FYR[item.dataset.fyrModel];
  const canvas = $('.fyr-card__canvas', item);
  let stage = null;
  try {
    stage = createStage(canvas, cfg.create, { forceFallback: params.has('fallback'), fitCanvas: true });
  } catch (err) {
    console.warn('[Fyr] WebGL недоступен, 3D отключено.', err);
    canvas.style.visibility = 'hidden';
    return;
  }
  stage.setTarget(cfg.rest);
  stage.setBodyColor('polarnatt', true);
  stage.setReduced(reduceMQ.matches);
  stage.ready.then(() => { stage.setScreen(cfg.screen, { accent: '#2F6BFF' }); stage.redrawScreen?.(); stage.snap(); });
  const turn = (on) => stage.setTarget(on ? { ...cfg.rest, ...cfg.near } : cfg.rest);
  item.addEventListener('pointerenter', () => turn(true));
  item.addEventListener('pointerleave', () => { turn(false); stage.setPointer(0, 0); });
  item.addEventListener('focus', () => turn(true));
  item.addEventListener('blur', () => turn(false));
  item.addEventListener('pointermove', (e) => {
    if (reduceMQ.matches || e.pointerType === 'touch') return;
    const r = canvas.getBoundingClientRect();
    stage.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
  });
  stages.push(stage);
});

// Рендер только пока первый экран виден
const rows = $$('.lineup, .fyr-duo');
const setActive = (v) => stages.forEach((s) => s.setActive(v && !document.hidden));
const rowsVisible = new Set(rows);
const lineupVisible = () => rowsVisible.size > 0;
const rowObserver = new IntersectionObserver((entries) => {
  entries.forEach((e) => (e.isIntersecting ? rowsVisible.add(e.target) : rowsVisible.delete(e.target)));
  setActive(lineupVisible());
}, { rootMargin: '10% 0px' });
rows.forEach((r) => rowObserver.observe(r));
document.addEventListener('visibilitychange', () => setActive(lineupVisible()));

/* ---------- Мини-сравнение ---------- */

const mini = $('[data-mini]');
if (mini) {
  const labels = { price: 'Цена', citadel: 'Безопасность', keys: 'Отключение', cams: 'Камеры', battery: 'Аккумулятор', protect: 'Защита' };
  const N = COMPARE_MODELS.length;
  const cols = ON_SALE.map((id) => 2 + COMPARE_MODELS.indexOf(id));
  mini.innerHTML = COMPARE.filter((r) => labels[r[2 + N]])
    .map((r) => `<tr><th scope="row">${labels[r[2 + N]]}</th>${cols.map((c) => `<td>${r[c]}</td>`).join('')}</tr>`).join('');
}

/* ---------- Появления ---------- */

const splits = createSplitReveals($$('[data-split]'), { gsap });
const mm = gsap.matchMedia();
mm.add({ reduce: '(prefers-reduced-motion: reduce)', motion: '(prefers-reduced-motion: no-preference)' }, ({ conditions: { reduce } }) => {
  if (reduce) smooth.disable(); else smooth.enable();
  root.classList.toggle('reduced', reduce);
  stages.forEach((s) => s.setReduced(reduce));
  splits.buildAll(reduce);
  $$('[data-reveal]').forEach((el) => {
    const sibs = Array.from(el.parentElement.children).filter((c) => c.hasAttribute('data-reveal'));
    const delay = Math.min(sibs.indexOf(el), 6) * (reduce ? 0.04 : 0.07);
    gsap.fromTo(el, reduce ? { opacity: 0 } : { opacity: 0, y: 32, filter: 'blur(6px)' }, {
      opacity: 1, y: 0, filter: 'blur(0px)', duration: reduce ? 0.5 : 1, delay, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none none' },
    });
  });
  if (!reduce) {
    gsap.from('.lineup__item', { y: 40, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.09, delay: 0.2 });
    gsap.to('.bgfx__glow--a', { yPercent: 70, xPercent: -20, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: true } });
  }
  return () => splits.unsplitAll();
});
window.addEventListener('load', () => ScrollTrigger.refresh());
