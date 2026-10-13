/* =========================================================================
   OY — страница аксессуаров. Каталог собирается из js/data/accessories.js,
   фильтр по модели прячет карточки, которые к ней не подходят.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { ACCESSORIES, MODELS } from '../data/accessories.js';
import { $, $$, createToast, initRadioGroup, syncRadio, bindStubs } from '../core/ui.js';
import { createSmoothScroll } from '../core/scroll.js';
import { createSplitReveals } from '../core/text.js';

gsap.registerPlugin(ScrollTrigger);
const root = document.documentElement;
root.classList.add('anim');
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ });
const toast = createToast($('#toast'), gsap);

// Подсветка за рендером — в цвет аксессуара
const TINT = {
  module: 'rgba(60, 210, 190, .2)', 'module-thermal': 'rgba(255, 120, 40, .2)', 'module-inch': 'rgba(120, 160, 255, .18)', 'module-beam': 'rgba(255, 240, 200, .18)', puck: 'rgba(232, 67, 77, .14)', cap: 'rgba(160, 170, 185, .14)',
  'case-0x2e': 'rgba(200, 16, 46, .24)', 'cell-0x2e': 'rgba(200, 16, 46, .18)', 'case-0x2': 'rgba(217, 164, 65, .2)', 'case-0x2q': 'rgba(90, 100, 170, .2)', 'case-0x1q': 'rgba(200, 90, 50, .2)', 'case-0x1pro': 'rgba(200, 210, 225, .14)', 'case-0x1e': 'rgba(80, 220, 160, .2)', 'case-0x1': 'rgba(140, 90, 240, .22)', 'case-pro': 'rgba(40, 170, 120, .16)',
  glass: 'rgba(232, 110, 60, .16)', power: 'rgba(255, 255, 255, .1)', faraday: 'rgba(110, 140, 90, .2)',
};

const grid = $('[data-acc-grid]');
grid.innerHTML = ACCESSORIES.map((a) => `
  <li class="acc-card" data-fits="${a.fits.join(' ')}" style="--tint:${TINT[a.id] ?? ''}" data-reveal>
    <div class="acc-card__img">
      ${a.tag ? `<span class="acc-card__tag">${a.tag}</span>` : ''}
      <img src="/img/accessories/${a.id}.webp" width="800" height="800" alt="" loading="lazy" decoding="async">
    </div>
    <div class="acc-card__body">
      <p class="acc-card__kind">${a.kind}</p>
      <h3 class="acc-card__name">${a.name}</h3>
      <p class="acc-card__text">${a.text}</p>
      ${a.colors ? `<p class="acc-card__colors">${a.colors.map(([c, n]) => `<i style="--c:${c}" title="${n}"></i>`).join('')}<span>${a.colors.map(([, n]) => n).join(', ')}</span></p>` : ''}
      <ul class="acc-card__fits" role="list" aria-label="Совместимость">${a.fits.map((f) => `<li>${MODELS[f]}</li>`).join('')}</ul>
      <div class="acc-card__foot">
        <span class="acc-card__price mono">$${a.usd}</span>
        <button type="button" class="btn btn--ghost btn--sm" data-stub="Концепт: аксессуары OY не продаются. Но выглядят неплохо, правда?">Купить</button>
      </div>
    </div>
  </li>`).join('');
bindStubs(toast);

/* ---------- Фильтр по модели ---------- */

const cards = $$('.acc-card', grid);
const count = $('[data-acc-count]');
const plural = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'аксессуар' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'аксессуара' : 'аксессуаров');
function applyFilter(model) {
  let n = 0;
  cards.forEach((c) => {
    const on = model === 'all' || c.dataset.fits.split(' ').includes(model);
    c.hidden = !on;
    if (on) n += 1;
  });
  count.textContent = model === 'all' ? `${n} ${plural(n)} для всех OY` : `${n} ${plural(n)} для ${MODELS[model]}`;
  ScrollTrigger.refresh();
}
const filter = $('[data-acc-filter]');
initRadioGroup(filter, (v) => {
  syncRadio(filter, v);
  applyFilter(v);
  if (!reduceMQ.matches) gsap.fromTo(cards.filter((c) => !c.hidden), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.04, ease: 'expo.out' });
});
applyFilter('all');

/* ---------- Появления ---------- */

const splits = createSplitReveals($$('[data-split]'), { gsap });
gsap.matchMedia().add({ reduce: '(prefers-reduced-motion: reduce)', motion: '(prefers-reduced-motion: no-preference)' }, ({ conditions: { reduce } }) => {
  if (reduce) smooth.disable(); else smooth.enable();
  root.classList.toggle('reduced', reduce);
  splits.buildAll(reduce);
  $$('[data-reveal]').forEach((el) => {
    gsap.fromTo(el, { opacity: 0, y: reduce ? 0 : 24 }, { opacity: 1, y: 0, duration: reduce ? 0.4 : 0.9, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 94%' } });
  });
  return () => splits.unsplitAll();
});
