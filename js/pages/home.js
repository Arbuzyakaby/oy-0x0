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

/* ---------- Модельный ряд: пять телефонов в одном масштабе ---------- */

// У всех одна камера и одна точка опоры — низ корпуса стоит на общей линии,
// поэтому разница в росте настоящая: 0X2 Pro — 166 мм, 0X2Q — 142,4 мм.
const HEIGHT = { '0x2e': 150, '0x0': 146, '0x2': 161, '0x2q': 142.4, '0x2pro': 166 };
const TURN = { '0x2e': -PI + 0.5, '0x0': -PI + 0.5, '0x2': -PI + 0.32, '0x2q': -PI + 0.5, '0x2pro': -PI - 0.4 };
const DIST = 4.05;
const pose = (id) => ({ x: 0, y: -0.9, fx: 0, fy: -HEIGHT[id] / 200, fz: 0, rx: 0.04, ry: TURN[id], rz: 0, dist: DIST, float: 0.35, screen: 1 });
const MODELS = { '0x2e': [createOY0X2E, 'beacon'], '0x0': [createOY0X0, 'red'], '0x2': [createOY0X2, 'honey'], '0x2q': [createOY0X2Q, 'tesseract'], '0x2pro': [createOY0X2Pro, 'sky'] };
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
  // у 0X2Q заодно выезжает модуль, а 0X2 Pro поворачивается экраном и поднимает фронталку из-под CPix
  const near = id === '0x2pro' ? { ry: -0.3, cpix1: 1 } : { ry: TURN[id] + (TURN[id] > -PI ? -0.9 : 0.9), ext: 1 };
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
const lineup = $('.lineup');
const setActive = (v) => stages.forEach((s) => s.setActive(v && !document.hidden));
let lineupVisible = true;
new IntersectionObserver(([e]) => { lineupVisible = e.isIntersecting; setActive(lineupVisible); }, { rootMargin: '10% 0px' }).observe(lineup);
document.addEventListener('visibilitychange', () => setActive(lineupVisible));

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
