/* =========================================================================
   OY — сравнение моделей в духе apple.com/iphone/compare: три колонки,
   в каждой выпадающий список, живая 3D-модель, цвета, цена и кнопки, ниже —
   разделы с крупной цифрой и характеристиками. Всё собирается из
   js/data/products.js; выбор колонок запоминается в адресе (?models=…).
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { PRODUCTS, COMPARE, COMPARE_MODELS, SHORT_NAMES } from '../data/products.js';
import { createStage } from '../core/stage.js';
import { createOY0X0 } from '../models/oy0x0.js';
import { createOY0X1 } from '../models/oy0x1.js';
import { createOY0X1E } from '../models/oy0x1e.js';
import { createOY0X1Pro } from '../models/oy0x1pro.js';
import { createOY0X1Q } from '../models/oy0x1q.js';
import { createPro } from '../models/pro.js';
import { $, $$, initRadioGroup, syncRadio } from '../core/ui.js';
import { createSmoothScroll } from '../core/scroll.js';
import { createSplitReveals } from '../core/text.js';

gsap.registerPlugin(ScrollTrigger);
const root = document.documentElement;
root.classList.add('anim');
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ });
const params = new URLSearchParams(location.search);
const PI = Math.PI;

const N = COMPARE_MODELS.length;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/* ---------- 3D: модель в колонке ---------- */

// TODO(этап 2): 0X2 и 0X2Q пока показаны моделями 0X1 и 0X1Q — заменить на oy0x2.js и oy0x2q.js
const FACTORY = { '0x1e': createOY0X1E, '0x0': createOY0X0, '0x2': createOY0X1, '0x2q': createOY0X1Q, '0x1': createOY0X1, '0x1q': createOY0X1Q, '0x1pro': createOY0X1Pro, pro: createPro };
// Высота корпуса, мм: телефоны стоят на одной линии в одном масштабе, как на витрине
const HEIGHT = { '0x1e': 152, '0x0': 146, '0x2': 161, '0x2q': 142.4, '0x1': 161, '0x1q': 142.4, '0x1pro': 163.5, pro: 150 };
const TURN = { '0x1e': -PI + 0.5, '0x0': -PI + 0.5, '0x2': -PI + 0.32, '0x2q': -PI + 0.5, '0x1': -PI + 0.32, '0x1q': -PI + 0.5, '0x1pro': -PI - 0.45, pro: -PI - 0.5 };
const pose = (id) => ({ x: 0, y: -0.9, fx: 0, fy: -HEIGHT[id] / 200, fz: 0, rx: 0.04, ry: TURN[id], rz: 0, dist: 4.3, float: 0.25, screen: 1 });

/* ---------- Крупная цифра раздела ---------- */

const ICONS = {
  shield: '<path d="M12 3l7.5 3v5.5c0 4.4-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5.1-7.5-9.5V6z"/><path d="M9 12l2 2 4-4.5"/>',
  network: '<path d="M3.5 9.5a12 12 0 0 1 17 0M6.5 12.5a7.8 7.8 0 0 1 11 0M9.5 15.5a3.6 3.6 0 0 1 5 0"/><circle cx="12" cy="18.5" r="1.2"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
};
const val = (id, label) => {
  const row = COMPARE.find((r) => r[1] === label);
  return row ? row[2 + COMPARE_MODELS.indexOf(id)] : '';
};
// Для каждого раздела: крупное значение и подпись — или иконка
const HERO = {
  'Безопасность': (id) => ({ icon: 'shield', cap: val(id, 'Чип безопасности').split(/[:—]/)[0].trim() }),
  'Связь': (id) => ({ icon: 'network', cap: val(id, 'Claw') === '—' ? 'Без Claw' : val(id, 'Claw').split(':')[0].trim() }),
  'Экран': (id) => {
    const v = val(id, 'Диагональ');
    return { big: (v.match(/^[\d,]+/) || [''])[0] + '″', cap: v.replace(/^[\d,]+"\s*/, '') };
  },
  'Камеры': (id) => {
    const v = val(id, 'Всего');
    const n = Number((v.match(/^\d+/) || [0])[0]);
    const word = n === 1 ? 'камера' : n < 5 ? 'камеры' : 'камер';
    return { big: String(n), cap: `${word}: ${v.split(':').slice(1).join(':').trim()}` };
  },
  'Производительность': (id) => {
    const v = val(id, 'Процессор');
    if (v.startsWith('Snapdragon')) return { big: v.replace('Snapdragon ', ''), cap: 'Qualcomm Snapdragon' };
    return { big: (v.match(/\d{4}\w*/) || [v])[0], cap: 'MediaTek Dimensity' };
  },
  'Питание': (id) => {
    const v = val(id, 'Аккумулятор');
    return { big: (v.match(/^\d+/) || [''])[0], cap: 'мАч · ' + val(id, 'Зарядка').split(',')[0] };
  },
  'Корпус': (id) => {
    const v = val(id, 'Толщина · вес');
    return { big: v.split('·')[0].trim(), cap: val(id, 'Защита') };
  },
  'Общее': (id) => ({ icon: 'spark', cap: val(id, 'Обновления · гарантия') }),
};
const SECTIONS = [...new Set(COMPARE.map((r) => r[0]))].filter((s) => s !== 'Цена');
// Эти строки уже показаны крупной цифрой раздела — второй раз не повторяем
const IN_HERO = new Set(['Диагональ', 'Всего', 'Процессор']);

/* ---------- Колонки ---------- */

const START = (params.get('models') || '').split(',').filter((id) => PRODUCTS[id]);
const picks = [0, 1, 2].map((i) => START[i] || ['0x2', '0x2q', '0x1pro'][i]);
const colorOf = {};
const cols = $$('.cx-col');
const stages = [];

const optionsHtml = COMPARE_MODELS.map((id) => `<option value="${id}">${esc(SHORT_NAMES[id])}${PRODUCTS[id].discontinued ? ' — снят с продажи' : ''}</option>`).join('');

function mountStage(i) {
  const col = cols[i];
  const id = picks[i];
  stages[i]?.dispose();
  const old = $('.cx-canvas', col);
  const canvas = document.createElement('canvas');
  canvas.className = 'cx-canvas';
  old.replaceWith(canvas);
  let stage = null;
  try {
    stage = createStage(canvas, FACTORY[id], { forceFallback: params.has('fallback'), fitCanvas: true });
  } catch (err) {
    console.warn('[OY] WebGL недоступен, 3D отключено.', err);
    canvas.style.visibility = 'hidden';
    stages[i] = null;
    return;
  }
  stage.setTarget(pose(id));
  stage.setBodyColor(colorOf[id] || PRODUCTS[id].defaultColor, true);
  stage.setReduced(reduceMQ.matches);
  stage.setActive(colsVisible && !document.hidden);
  stage.ready.then(() => stage.snap());
  stages[i] = stage;
}

function renderCol(i) {
  const col = cols[i];
  const id = picks[i];
  const p = PRODUCTS[id];
  const color = colorOf[id] || p.defaultColor;
  $('[data-pick]', col).value = id;
  $('[data-stage-link]', col).href = p.href;
  const sw = $('[data-swatches]', col);
  sw.innerHTML = Object.entries(p.swatches).map(([c, hex]) =>
    `<button type="button" role="radio" class="cx-swatch" data-value="${c}" aria-checked="${c === color}" style="--c:${hex}"><span class="sr-only">${esc(p.colors[c])}</span></button>`).join('');
  $('[data-cname]', col).textContent = p.colors[color];
  const tag = $('[data-tag]', col);
  tag.textContent = p.tag || '';
  tag.classList.toggle('is-off', !!p.discontinued);
  const c0 = p.configs[0];
  $('[data-price]', col).textContent = p.discontinued ? `Был от $${c0.usd}` : `От $${c0.usd.toLocaleString('en-US')}`;
  const next = p.successor && PRODUCTS[p.successor];
  $('[data-eur]', col).textContent = next ? `Преемник — ${SHORT_NAMES[next.id]}` : `€${c0.eur} · Европа — скоро`;
  const buy = $('[data-buy]', col);
  buy.textContent = next ? `Смотреть ${SHORT_NAMES[next.id]}` : 'Купить';
  buy.href = next ? next.href : `${p.href}#buy`;
  const more = $('[data-more]', col);
  more.href = p.href;
  more.setAttribute('aria-label', `Подробнее об ${p.name}`);
}

/* ---------- Таблица: разделы и строки ---------- */

const body = $('[data-body]');
const names = $('[data-sticky-names]');

function renderBody() {
  const idx = picks.map((id) => 2 + COMPARE_MODELS.indexOf(id));
  let html = '';
  for (const sec of SECTIONS) {
    const rows = COMPARE.filter((r) => r[0] === sec && !IN_HERO.has(r[1]));
    const heroes = picks.map((id) => HERO[sec]?.(id));
    let rowsHtml = '';
    let diffs = 0;
    for (const r of rows) {
      const vs = idx.map((k) => r[k]);
      const same = vs.every((v) => v === vs[0]);
      if (!same) diffs++;
      rowsHtml += `<div class="cx-row${same ? ' is-same' : ''}">${vs.map((v) => `<div class="cx-cell"><span class="cx-cell__k">${esc(r[1])}</span><span class="cx-cell__v${v === '—' ? ' is-none' : ''}">${esc(v)}</span></div>`).join('')}</div>`;
    }
    html += `<section class="cx-sec${diffs ? '' : ' is-same'}" aria-label="${esc(sec)}">
      <h2 class="cx-sec__title">${esc(sec)}</h2>
      ${heroes[0] ? `<div class="cx-row cx-row--hero">${heroes.map((h) => `<div class="cx-cell cx-hero">${h.big ? `<span class="cx-hero__big">${esc(h.big)}</span>` : `<svg class="cx-hero__icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[h.icon]}</svg>`}<span class="cx-hero__cap">${esc(h.cap)}</span></div>`).join('')}</div>` : ''}
      ${rowsHtml}
    </section>`;
  }
  body.innerHTML = html;
  names.innerHTML = picks.map((id) => `<span>${esc(SHORT_NAMES[id])}</span>`).join('');
  history.replaceState(null, '', `?models=${picks.join(',')}${location.hash}`);
  ScrollTrigger.refresh();
}

cols.forEach((col, i) => {
  const sel = $('[data-pick]', col);
  sel.innerHTML = optionsHtml;
  // Цвет: один обработчик на колонку, модель берётся текущая
  const sw = $('[data-swatches]', col);
  initRadioGroup(sw, (c) => {
    const id = picks[i];
    colorOf[id] = c;
    syncRadio(sw, c);
    $('[data-cname]', col).textContent = PRODUCTS[id].colors[c];
    stages[i]?.setBodyColor(c);
  });
  sel.addEventListener('change', () => {
    const next = sel.value;
    const j = picks.indexOf(next);
    // Модель уже стоит в другой колонке — меняем их местами, как у Apple
    if (j !== -1 && j !== i) {
      picks[j] = picks[i];
      renderCol(j);
      mountStage(j);
    }
    picks[i] = next;
    renderCol(i);
    mountStage(i);
    renderBody();
  });
  renderCol(i);
});

// Рендер 3D только пока колонки видны
let colsVisible = true;
const colsEl = $('[data-cols]');
const setActive = () => stages.forEach((s) => s?.setActive(colsVisible && !document.hidden));
new IntersectionObserver(([e]) => { colsVisible = e.isIntersecting; setActive(); }, { rootMargin: '10% 0px' }).observe(colsEl);
document.addEventListener('visibilitychange', setActive);
cols.forEach((_, i) => mountStage(i));
renderBody();

// Короткие названия прилипают сверху, когда колонки ушли за экран
const sticky = $('[data-sticky]');
new IntersectionObserver(([e]) => sticky.classList.toggle('is-on', !e.isIntersecting && e.boundingClientRect.top < 0)).observe($('.cx-buy'));

/* ---------- Только различия ---------- */

const page = $('.cx-page');
$('[data-diff]').addEventListener('change', (e) => {
  page.classList.toggle('only-diff', e.target.checked);
  ScrollTrigger.refresh();
});

/* ---------- Появления ---------- */

const splits = createSplitReveals($$('[data-split]'), { gsap });
gsap.matchMedia().add({ reduce: '(prefers-reduced-motion: reduce)', motion: '(prefers-reduced-motion: no-preference)' }, ({ conditions: { reduce } }) => {
  if (reduce) smooth.disable(); else smooth.enable();
  root.classList.toggle('reduced', reduce);
  stages.forEach((s) => s?.setReduced(reduce));
  splits.buildAll(reduce);
  $$('[data-reveal]').forEach((el) => {
    gsap.fromTo(el, { opacity: 0, y: reduce ? 0 : 24 }, { opacity: 1, y: 0, duration: reduce ? 0.4 : 0.9, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 94%' } });
  });
  if (!reduce) gsap.from('.cx-col', { y: 40, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08, delay: 0.15 });
  return () => splits.unsplitAll();
});
window.addEventListener('load', () => ScrollTrigger.refresh());
