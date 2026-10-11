/* =========================================================================
   OY — страница сравнения 0X0 и 0X0 Pro. Таблица собирается из
   js/data/products.js; переключатель скрывает одинаковые строки.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { COMPARE } from '../data/products.js';
import { $, $$ } from '../core/ui.js';
import { createSmoothScroll } from '../core/scroll.js';
import { createSplitReveals } from '../core/text.js';

gsap.registerPlugin(ScrollTrigger);
const root = document.documentElement;
root.classList.add('anim');
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ });

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const body = $('[data-compare]');
let html = '';
let section = '';
for (const [sec, label, a, b] of COMPARE) {
  if (sec !== section) {
    section = sec;
    html += `<tr class="cmp__sec" data-sec="${esc(sec)}"><th scope="rowgroup" colspan="3">${esc(sec)}</th></tr>`;
  }
  const same = a === b;
  html += `<tr class="${same ? 'is-same' : 'is-diff'}" data-sec="${esc(sec)}"><th scope="row">${esc(label)}</th><td>${esc(a)}</td><td>${same ? esc(b) : `<mark>${esc(b)}</mark>`}</td></tr>`;
}
body.innerHTML = html;
// Разделы, где нет различий, при фильтре скрываются целиком
$$('.cmp__sec', body).forEach((row) => {
  const rows = $$(`tr[data-sec="${CSS.escape(row.dataset.sec)}"]:not(.cmp__sec)`, body);
  row.classList.toggle('is-empty', rows.every((r) => r.classList.contains('is-same')));
});

const page = $('.cmp-page');
$('[data-diff]').addEventListener('change', (e) => {
  page.classList.toggle('only-diff', e.target.checked);
  ScrollTrigger.refresh();
});

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
