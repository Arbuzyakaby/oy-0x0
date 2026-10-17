/* =========================================================================
   OY — витрина семейства: модельный ряд в 3D, выбор, мини-сравнение.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage } from '../core/stage.js';
import { createOY0X0 } from '../models/oy0x0.js';
import { createOY0X2 } from '../models/oy0x2.js';
import { createOY0X2Q } from '../models/oy0x2q.js';
import { createOY0X2E } from '../models/oy0x2e.js';
import { createOY0X2Pro } from '../models/oy0x2pro.js';
import { createOY0X1E } from '../models/oy0x1e.js';
import { createOY0X1 } from '../models/oy0x1.js';
import { createOY0X1Q } from '../models/oy0x1q.js';
import { createOY0X1Pro } from '../models/oy0x1pro.js';
import { createOYMoth, createOYMoth2 } from '../models/oymoth.js';
import { createOYNova } from '../models/oynova.js';
import { COMPARE, COMPARE_MODELS, LINEUP } from '../data/products.js';
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

/* ---------- Модельный ряд: одиннадцать телефонов в одном масштабе, второй ряд — вернувшаяся 0X1 ---------- */

// У всех одна камера и одна точка опоры — низ корпуса стоит на общей линии,
// поэтому разница в росте настоящая: 0X2 Pro — 166 мм, 0X2Q — 142,4 мм.
const HEIGHT = { '0x1e': 152, '0x1': 161, '0x1q': 142.4, '0x1pro': 163.5, '0x2e': 150, '0x0': 146, '0x2': 161, moth: 166.7, moth2: 166.7, '0x2q': 142.4, '0x2pro': 166, nova: 164.8 };
const TURN = { '0x1e': -PI + 0.5, '0x1': -PI + 0.32, '0x1q': -PI + 0.5, '0x1pro': -PI - 0.45, '0x2e': -PI + 0.5, '0x0': -PI + 0.5, '0x2': -PI + 0.32, moth: -PI + 0.45, moth2: -PI + 0.45, '0x2q': -PI + 0.5, '0x2pro': -PI - 0.4, nova: -PI + 0.42 };
const DIST = 4.05;
const pose = (id) => ({ x: 0, y: -0.9, fx: 0, fy: -HEIGHT[id] / 200, fz: 0, rx: 0.04, ry: TURN[id], rz: 0, dist: DIST, float: 0.35, screen: 1 });
const MODELS = { '0x1e': [createOY0X1E, 'mint'], '0x1': [createOY0X1, 'violet'], '0x1q': [createOY0X1Q, 'wave'], '0x1pro': [createOY0X1Pro, 'obsidian'], '0x2e': [createOY0X2E, 'beacon'], '0x0': [createOY0X0, 'red'], '0x2': [createOY0X2, 'honey'], moth: [createOYMoth, 'yellow'], moth2: [createOYMoth2, 'orange'], '0x2q': [createOY0X2Q, 'tesseract'], '0x2pro': [createOY0X2Pro, 'sky'], nova: [createOYNova, 'supernova'] };
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
  // Moth складывается и встаёт на линию петлёй вниз, «Крылом» к вам, а у Nova выезжает перо
  const near = id === 'nova' ? { ry: -0.35, pen: 0.32 } : id === '0x2pro' ? { ry: -0.3, cpix1: 1 } : id === 'moth' || id === 'moth2' ? { ry: -0.35, fold: 1, rz: PI, fy: 0 } : { ry: TURN[id] + (TURN[id] > -PI ? -0.9 : 0.9), ext: 1 };
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

// Рендер только пока первый экран виден
const rows = $$('.lineup');
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
  const cols = LINEUP.map((id) => 2 + COMPARE_MODELS.indexOf(id));
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
