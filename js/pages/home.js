/* =========================================================================
   OY — витрина семейства: три телефона в 3D, выбор, мини-сравнение.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage } from '../core/stage.js';
import { createOY0X0 } from '../models/oy0x0.js';
import { createOY0X1 } from '../models/oy0x1.js';
import { createPro } from '../models/pro.js';
import { COMPARE } from '../data/products.js';
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

/* ---------- Три телефона ---------- */

const POSES = {
  '0x0': { rest: { x: 0, y: 0.04, fx: 0, fy: 0, fz: 0, rx: 0.14, ry: -PI + 0.55, rz: 0.05, dist: 3.6, float: 1, screen: 1 }, near: { dist: 3.15, ry: -PI + 0.3 } },
  '0x1': { rest: { x: 0, y: 0.04, fx: 0, fy: 0, fz: 0, rx: 0.14, ry: -PI + 0.35, rz: 0, dist: 3.95, float: 1, screen: 1 }, near: { dist: 3.45, ry: -PI + 0.15 } },
  pro: { rest: { x: 0, y: 0.04, fx: 0, fy: 0, fz: 0, rx: 0.14, ry: -PI - 0.55, rz: -0.05, dist: 3.7, float: 1, screen: 1 }, near: { dist: 3.25, ry: -PI - 0.3 } },
};
const MODELS = { '0x0': [createOY0X0, 'red'], '0x1': [createOY0X1, 'violet'], pro: [createPro, 'emerald'] };
const stages = [];
$$('.duo__item').forEach((item) => {
  const id = item.dataset.model;
  const canvas = $('.duo__canvas', item);
  let stage = null;
  try {
    stage = createStage(canvas, MODELS[id][0], { forceFallback: params.has('fallback'), fitCanvas: true });
  } catch (err) {
    console.warn('[OY] WebGL недоступен, 3D отключено.', err);
    canvas.style.visibility = 'hidden';
    return;
  }
  const pose = POSES[id];
  stage.setTarget(pose.rest);
  stage.setBodyColor(MODELS[id][1], true);
  stage.setReduced(reduceMQ.matches);
  stage.ready.then(() => stage.snap());
  const near = (on) => stage.setTarget(on ? { ...pose.rest, ...pose.near } : pose.rest);
  item.addEventListener('pointerenter', () => near(true));
  item.addEventListener('pointerleave', () => { near(false); stage.setPointer(0, 0); });
  item.addEventListener('focus', () => near(true));
  item.addEventListener('blur', () => near(false));
  item.addEventListener('pointermove', (e) => {
    if (reduceMQ.matches || e.pointerType === 'touch') return;
    const r = canvas.getBoundingClientRect();
    stage.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
  });
  stages.push(stage);
});

// Рендер только пока первый экран виден
const duo = $('.duo');
const setActive = (v) => stages.forEach((s) => s.setActive(v && !document.hidden));
let duoVisible = true;
new IntersectionObserver(([e]) => { duoVisible = e.isIntersecting; setActive(duoVisible); }, { rootMargin: '10% 0px' }).observe(duo);
document.addEventListener('visibilitychange', () => setActive(duoVisible));

/* ---------- Мини-сравнение ---------- */

const mini = $('[data-mini]');
if (mini) {
  const labels = { price: 'Цена', citadel: 'Безопасность', keys: 'Отключение', cams: 'Камеры', battery: 'Аккумулятор', protect: 'Защита' };
  mini.innerHTML = COMPARE.filter((r) => labels[r[5]])
    .map((r) => `<tr><th scope="row">${labels[r[5]]}</th><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`).join('');
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
    gsap.from('.duo__item', { y: 60, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.12, delay: 0.2 });
    gsap.to('.bgfx__glow--a', { yPercent: 70, xPercent: -20, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: true } });
  }
  return () => splits.unsplitAll();
});
window.addEventListener('load', () => ScrollTrigger.refresh());
