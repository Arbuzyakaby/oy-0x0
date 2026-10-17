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
import { createOY0X2E } from '../models/oy0x2e.js';
import { createOY0X3E } from '../models/oy0x3e.js';
import { createOY0X1Pro } from '../models/oy0x1pro.js';
import { createOY0X1Q } from '../models/oy0x1q.js';
import { createOY0X2 } from '../models/oy0x2.js';
import { createOY0X2Q } from '../models/oy0x2q.js';
import { createOY0X2Pro } from '../models/oy0x2pro.js';
import { createOYMoth, createOYMoth2 } from '../models/oymoth.js';
import { createOYNova } from '../models/oynova.js';
import { createExtreamY1 } from '../models/extreamy1.js';
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

const FACTORY = { '0x1e': createOY0X1E, '0x2e': createOY0X2E, '0x3e': createOY0X3E, '0x0': createOY0X0, '0x2': createOY0X2, '0x2q': createOY0X2Q, '0x1': createOY0X1, '0x1q': createOY0X1Q, '0x2pro': createOY0X2Pro, moth: createOYMoth, moth2: createOYMoth2, nova: createOYNova, y1: createExtreamY1, '0x1pro': createOY0X1Pro, pro: createPro };
// Высота корпуса, мм: телефоны стоят на одной линии в одном масштабе, как на витрине
const HEIGHT = { '0x1e': 152, '0x2e': 150, '0x3e': 150, '0x0': 146, '0x2': 161, '0x2q': 142.4, '0x1': 161, '0x1q': 142.4, '0x2pro': 166, moth: 166.7, moth2: 166.7, nova: 164.8, y1: 164.3, '0x1pro': 163.5, pro: 150 };
const TURN = { '0x1e': -PI + 0.5, '0x2e': -PI + 0.5, '0x3e': -PI + 0.5, '0x0': -PI + 0.5, '0x2': -PI + 0.32, '0x2q': -PI + 0.5, '0x1': -PI + 0.32, '0x1q': -PI + 0.5, '0x2pro': -PI - 0.4, moth: -PI + 0.45, moth2: -PI + 0.45, nova: -PI + 0.42, y1: -PI + 0.4, '0x1pro': -PI - 0.45, pro: -PI - 0.5 };
const pose = (id) => ({ x: 0, y: -0.9, fx: 0, fy: -HEIGHT[id] / 200, fz: 0, rx: 0.04, ry: TURN[id], rz: 0, dist: 4.3, float: 0.25, screen: 1 });

/* ---------- Иконки строк, как у Apple: у каждой модели своя ---------- */

// Каждая иконка рисуется из значения ячейки: значок процессора с его именем,
// экран в масштабе диагонали, блок камер с нужным числом объективов, батарея
// с заливкой по ёмкости и т. д. Холст 56 в высоту; ширина растёт под текст,
// чтобы надписи не сжимались. Красным — детали, по которым модели отличаются
const num = (s) => Number(String(s).replace(',', '.').match(/[\d.]+/)?.[0] || 0);
const svg = (inner, { cls = '', w = 56 } = {}) =>
  `<svg class="cx-ico${cls}" viewBox="0 0 ${w} 56" style="--w:${(w / 56).toFixed(3)}" aria-hidden="true">${inner}</svg>`;
const text = (x, y, t, size, cls = '') => `<text class="cx-ico__t${cls}" x="${x}" y="${y}" font-size="${size}">${esc(t)}</text>`;
// ширина надписи на глаз: Onest ≈ 0,6 кегля на знак, моно ≈ 0,62
const textW = (t, size, k = 0.6) => t.length * size * k;
// подпись-число справа внизу, красная
const tag = (w, t) => text(w - 1, 53, t, 11, ' cx-ico__t--tag');

function badge(top, bottom, { accent = false } = {}) {
  const bot = bottom ? bottom.toUpperCase() : '';
  const inner = Math.max(textW(top, 13), textW(bot, 6.5, 0.7));
  const bw = Math.max(44, Math.ceil(inner + 16));
  const w = bw + 8;
  return svg(`<rect class="cx-ico__chip" x="4" y="6" width="${bw}" height="44" rx="10"/>
    ${text(w / 2, bot ? 30 : 32.5, top, 13, ' cx-ico__t--big')}${bot ? text(w / 2, 41, bot, 6.5, ' cx-ico__t--small') : ''}`, { cls: accent ? ' is-accent' : '', w });
}
const WORDS = { одна: 1, две: 2, три: 3, четыре: 4, пять: 5 };
const LENS = { 1: [[28, 28]], 2: [[28, 19], [28, 37]], 3: [[19, 19], [19, 37], [37, 28]], 4: [[19, 19], [37, 19], [19, 37], [37, 37]], 5: [[18, 15], [18, 28], [18, 41], [37, 17], [37, 32]] };

const ROW_ICON = {
  'Чип безопасности': (v) => {
    const name = v.split(/[:—]/)[0].trim();
    const m = name.match(/^(.*?)\s+([\d.]+)$/);
    if (name === 'MSC') return badge('MSC', 'в Argon 1');
    if (name.endsWith(' Plus')) return badge(name.replace(/\s+[\d.]+ Plus$/, ''), name.match(/[\d.]+ Plus$/)[0], { accent: true });
    return m ? badge(m[1], m[2]) : badge(name, '');
  },
  'Аппаратное отключение': (v) => {
    // «Рубильник» eXtream: ползунок в положении «вкл»
    if (v.startsWith('«Рубильник»')) return svg('<rect class="cx-ico__line" x="21" y="6" width="14" height="44" rx="3"/><rect class="cx-ico__fill is-accent" x="24" y="10" width="8" height="15" rx="2"/>');
    const n = num(v.match(/^\d+ kill/)?.[0] || 0);
    if (v.startsWith('Нет')) return svg('<rect class="cx-ico__line is-dash" x="10" y="19" width="36" height="18" rx="9"/>');
    if (n) {
      const w = Math.max(56, n * 13 + 10);
      return svg(Array.from({ length: n }, (_, i) => {
        const x = w / 2 - (n * 13) / 2 + i * 13 + 2;
        return `<rect class="cx-ico__line" x="${x}" y="11" width="9" height="34" rx="4.5"/><circle class="cx-ico__dot" cx="${x + 4.5}" cy="${i % 2 ? 37 : 19}" r="3"/>`;
      }).join(''), { w });
    }
    if (/Кнопк/.test(v)) return svg(`<rect class="cx-ico__line" x="6" y="13" width="20" height="30" rx="6"/><rect class="cx-ico__line" x="30" y="13" width="20" height="30" rx="6"/>${text(16, 32.5, '0', 13, ' cx-ico__t--big')}${text(40, 32.5, v.includes('«1»') ? '1' : '·', 13, ' cx-ico__t--big cx-ico__t--red')}`);
    return svg('<rect class="cx-ico__line" x="17" y="7" width="22" height="42" rx="6"/><path class="cx-ico__line" d="M22 15h12M22 41h12"/>');
  },
  Claw: (v) => {
    if (v === '—') return null;
    const n = num(v.match(/(\d+) антенн/)?.[1] || 0);
    return svg(`<path class="cx-ico__line" d="M28 23v24M21 47h14"/><circle class="cx-ico__dot" cx="28" cy="19" r="3.4"/>
      <path class="cx-ico__line" d="M19.5 11a12 12 0 0 0 0 16M36.5 11a12 12 0 0 1 0 16M13 5a21 21 0 0 0 0 28M43 5a21 21 0 0 1 0 28"/>
      ${n ? tag(68, String(n)) : ''}`, { w: 68 });
  },
  'Wi-Fi': (v) => svg(`<path class="cx-ico__line" d="M8 22a28 28 0 0 1 40 0M15 29a18 18 0 0 1 26 0M22 36a9 9 0 0 1 12 0"/><circle class="cx-ico__dot" cx="28" cy="43" r="3"/>${tag(70, v.replace('Wi-Fi ', ''))}`, { w: 70 }),
  'Диагональ': (v) => {
    const d = num(v);
    const h = Math.round(36 + (d - 5.9) * 12);
    const w = Math.round(h * 0.56);
    const x = 28 - w / 2, y = 28 - h / 2;
    const label = String(d).replace('.', ',');
    // у складного — линия сгиба поперёк, диагональ стоит в верхней половине
    if (/складной/.test(v)) {
      return svg(`<rect class="cx-ico__line" x="${x}" y="${y}" width="${w}" height="${h}" rx="5"/><path class="cx-ico__crease" d="M${x - 3} 28h${w + 6}"/>${text(28, y + h / 4 + 4, label, 10.5)}`);
    }
    return svg(`<rect class="cx-ico__line" x="${x}" y="${y}" width="${w}" height="${h}" rx="5"/>${text(28, 32, label, 11)}`);
  },
  'Внешний экран': (v) => (v === '—' ? null : svg('<rect class="cx-ico__line" x="12" y="9" width="32" height="38" rx="7"/><rect class="cx-ico__fill is-accent" x="16.5" y="13.5" width="23" height="29" rx="4"/><circle class="cx-ico__hole" cx="22" cy="19" r="3"/><circle class="cx-ico__hole" cx="30" cy="19" r="3"/>')),
  'Всего': (v) => {
    const rear = WORDS[v.match(/(одна|две|три|четыре|пять) сзади/)?.[1]] || 1;
    const r = rear > 4 ? 5.2 : rear > 2 ? 6.4 : 7.4;
    const lenses = LENS[rear].map(([cx, cy], i) => `<circle class="cx-ico__line" cx="${cx}" cy="${cy}" r="${r}"/>${i === 0 ? `<circle class="cx-ico__dot" cx="${cx}" cy="${cy}" r="2.4"/>` : ''}`).join('');
    return svg(`<rect class="cx-ico__line" x="6" y="6" width="44" height="44" rx="12"/>${lenses}`);
  },
  'Процессор': (v) => {
    if (v.startsWith('Argon 1 Nova')) return badge('Argon 1 Nova', 'OY · под камеру', { accent: true });
    if (v.startsWith('Argon')) return badge('Argon 1', 'OY · свой', { accent: true });
    if (v.includes('Extreme')) return badge('8 Elite Extreme', 'Snapdragon · Gen 6', { accent: true });
    if (v.startsWith('Snapdragon')) return badge(v.replace('Snapdragon ', ''), 'Snapdragon');
    return badge(v.replace('Dimensity ', ''), 'Dimensity');
  },
  'Аккумулятор': (v) => {
    const k = Math.min(1, num(v) / 9000);
    return svg(`<rect class="cx-ico__line" x="5" y="15" width="50" height="26" rx="7"/><path class="cx-ico__line" d="M60 23v10"/><rect class="cx-ico__fill is-accent" x="9.5" y="19.5" width="${(41 * k).toFixed(1)}" height="17" rx="3.5"/>${/две ячейки/.test(v) ? '<path class="cx-ico__gap" d="M30 16v24"/>' : ''}`, { w: 64 });
  },
  'Зарядка': (v) => svg(`<path class="cx-ico__line" d="M32 4L14 30h12l-3 22 20-29H31z"/>${tag(72, `${num(v)} Вт`)}`, { w: 72 }),
  'Вентиляторы': (v) => (v === '—' ? null : svg(`${[17, 39].map((cx) => `<circle class="cx-ico__line" cx="${cx}" cy="28" r="10"/><circle class="cx-ico__dot" cx="${cx}" cy="28" r="2.6"/>`).join('')}${tag(64, '2')}`, { w: 64 })),
  // OY 0Pen: перо наискосок, кнопка-затвор красным
  'Стилус': (v) => (v === '—' ? null : svg('<path class="cx-ico__line" d="M14 46l4-11 22-22a4.2 4.2 0 0 1 6 6L24 41z"/><path class="cx-ico__line" d="M18 35l6 6"/><rect class="cx-ico__fill is-accent" x="30" y="22" width="7" height="3.4" rx="1.4" transform="rotate(-45 33.5 23.7)"/>')),
  'Курки': (v) => (v === '—' ? null : svg('<rect class="cx-ico__line" x="6" y="18" width="44" height="22" rx="4"/><rect class="cx-ico__fill is-accent" x="9" y="12" width="12" height="5" rx="1.5"/><rect class="cx-ico__fill is-accent" x="35" y="12" width="12" height="5" rx="1.5"/>')),
  'Защита': (v) => svg(`<path class="cx-ico__line" d="M28 3s18 17 18 29a18 18 0 0 1-36 0C10 20 28 3 28 3z"/>${text(28, 38, v, v.length > 4 ? 9.5 : 11, ' cx-ico__t--big')}`),
  'Толщина · вес': (v) => {
    const mm = num(v);
    const w = mm * 2.6;
    const folded = /сложен/.test(v);
    return svg(folded
      ? `<rect class="cx-ico__line" x="${28 - w - 1.5}" y="6" width="${w}" height="44" rx="${Math.min(w / 2, 6)}"/><rect class="cx-ico__line" x="29.5" y="6" width="${w}" height="44" rx="${Math.min(w / 2, 6)}"/><path class="cx-ico__crease" d="M28 4v48"/>`
      : `<rect class="cx-ico__line" x="${28 - w / 2}" y="6" width="${w}" height="44" rx="${Math.min(w / 2, 6)}"/>`);
  },
  'Обновления · гарантия': (v) => svg(`<path class="cx-ico__line" d="M9 28a19 19 0 0 1 33-12.8M47 28a19 19 0 0 1-33 12.8M43 6v9.5h-9.5M13 50v-9.5h9.5"/>${text(28, 33, String(num(v)), 15, ' cx-ico__t--big cx-ico__t--red')}`),
};

// Строка «значение» → заголовок до двоеточия или тире и подробности
function valueHtml(v) {
  if (v === '—') return '<span class="cx-none" aria-label="нет">—</span>';
  const m = v.match(/^(.{2,40}?)(?::\s|\s—\s(?=\D))(.+)$/); // «8/128 — 8/256» — это диапазон, не делим
  return m ? `<b>${esc(m[1])}</b><span>${esc(m[2])}</span>` : `<b>${esc(v)}</b>`;
}

const SECTIONS = [...new Set(COMPARE.map((r) => r[0]))].filter((s) => s !== 'Цена');

/* ---------- Колонки ---------- */

const START = (params.get('models') || '').split(',').filter((id) => PRODUCTS[id]);
const picks = [0, 1, 2].map((i) => START[i] || ['0x2', '0x2pro', 'nova'][i]);
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
  $('[data-eur]', col).textContent = next ? `Преемник — ${SHORT_NAMES[next.id]}` : (`€${c0.eur} · ${p.eu ? 'в Европе — уже в продаже' : 'Европа — скоро'}${c0.cny ? ` · ¥${c0.cny.toLocaleString('ru-RU')} — Китай` : ''}`);
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
    const rows = COMPARE.filter((r) => r[0] === sec);
    let rowsHtml = '';
    let diffs = 0;
    for (const r of rows) {
      const vs = idx.map((k) => r[k]);
      const same = vs.every((v) => v === vs[0]);
      if (!same) diffs++;
      const icon = ROW_ICON[r[1]];
      // иконка — строка открывает новую группу, как у Apple
      rowsHtml += `<div class="cx-row${icon ? ' cx-row--icon' : ''}${same ? ' is-same' : ''}">${vs.map((v) => {
        const ico = icon ? (icon(v) || svg('<circle class="cx-ico__line is-dash" cx="28" cy="28" r="16"/>', { cls: ' is-none' })) : '';
        return `<div class="cx-cell">${ico}<span class="cx-cell__k">${esc(r[1])}</span><span class="cx-cell__v">${valueHtml(v)}</span></div>`;
      }).join('')}</div>`;
    }
    html += `<section class="cx-sec${diffs ? '' : ' is-same'}" aria-label="${esc(sec)}">
      <h2 class="cx-sec__title">${esc(sec)}</h2>
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
