/* =========================================================================
   Аксессуары Fyr и OY. Всё собирается из js/data/accessories.js:
   бенто «Новое от Fyr», каталог с фильтрами по устройству и виду (выбор
   живёт в адресе: ?d=h1&k=Чехлы&cur=eur&item=case-h1), карточка-окно,
   полка склада OY Europe и демо чехла Фарадея.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { ACCESSORIES, DEVICES, GROUPS, KINDS, MODELS } from '../data/accessories.js';
import { hexPrice } from '../fyr/dict.js';
import { $, $$, createToast, initRadioGroup, syncRadio } from '../core/ui.js';
import { createSmoothScroll } from '../core/scroll.js';
import { createSplitReveals } from '../core/text.js';

gsap.registerPlugin(ScrollTrigger);
const root = document.documentElement;
root.classList.add('anim');
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ });
const toast = createToast($('#toast'), gsap);
const BY_ID = Object.fromEntries(ACCESSORIES.map((a) => [a.id, a]));

// Подсветка за рендером — в цвет аксессуара
const TINT = {
  'case-butterfly': 'rgba(60, 100, 220, .28)', 'glass-butterfly': 'rgba(120, 170, 255, .2)', 'case-h1': 'rgba(150, 210, 240, .22)',
  'strap-osmium': 'rgba(47, 107, 255, .24)', 'bracelet-osmium': 'rgba(150, 170, 200, .18)', 'puck-osmium': 'rgba(47, 107, 255, .24)',
  'sleeve-kbook': 'rgba(120, 130, 150, .2)', 'power-fyr': 'rgba(47, 107, 255, .18)', 'cable-well': 'rgba(47, 107, 255, .2)',
  'case-0x3e': 'rgba(194, 142, 34, .24)',
  module: 'rgba(60, 210, 190, .2)', 'module-thermal': 'rgba(255, 120, 40, .2)', 'module-inch': 'rgba(120, 160, 255, .18)', 'module-beam': 'rgba(255, 240, 200, .18)', puck: 'rgba(232, 67, 77, .14)', 'puck-80': 'rgba(110, 160, 220, .2)', cap: 'rgba(160, 170, 185, .14)',
  'case-moth2': 'rgba(242, 140, 40, .22)', 'glass-wing2': 'rgba(242, 140, 40, .14)', 'case-moth': 'rgba(246, 212, 74, .22)', 'strap-moth': 'rgba(246, 212, 74, .16)', 'glass-wing': 'rgba(246, 212, 74, .14)',
  'case-nova': 'rgba(120, 100, 220, .2)', 'glass-nova': 'rgba(244, 215, 156, .16)', 'pen-nova': 'rgba(201, 164, 110, .2)', 'tips-nova': 'rgba(201, 164, 110, .16)',
  'case-0x2pro': 'rgba(110, 160, 220, .22)', 'case-0x2e': 'rgba(200, 16, 46, .24)', 'cell-0x2e': 'rgba(200, 16, 46, .18)', 'case-0x2': 'rgba(217, 164, 65, .22)', 'case-0x2q': 'rgba(90, 100, 170, .2)', 'case-0x1q': 'rgba(200, 90, 50, .2)', 'case-0x1pro': 'rgba(200, 210, 225, .14)', 'case-0x1e': 'rgba(80, 220, 160, .2)', 'case-0x1': 'rgba(140, 90, 240, .22)', 'case-pro': 'rgba(40, 170, 120, .16)',
  glass: 'rgba(232, 110, 60, .16)', 'glass-3': 'rgba(110, 160, 220, .18)', power: 'rgba(255, 255, 255, .1)', faraday: 'rgba(110, 140, 90, .2)',
};

const strip = (html) => html.replace(/<sup[\s\S]*?<\/sup>/g, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"');
const img = (a) => `/img/accessories/${a.id}.webp`;

/* ---------- Валюта и цены ---------- */

const state = { device: 'all', kind: 'all', cur: 'usd' };
const fmt = (n, cur) => (cur === 'usd' ? `$${n}` : `€${n}`);
function priceHTML(a, cur = state.cur) {
  const n = a[cur];
  const sign = cur === 'usd' ? '$' : '€';
  if (a.brand === 'fyr') {
    return `<span class="acc-price acc-price--hex" tabindex="0" title="${fmt(n, cur)}"><span class="acc-price__hex">${hexPrice(n)} ${sign}</span><span class="acc-price__dec">${fmt(n, cur)}</span></span>`;
  }
  const was = a.was ? `<s class="acc-price__was">${fmt(cur === 'usd' ? a.was : Math.round((a.was * a.eur) / a.usd), cur)}</s>` : '';
  return `<span class="acc-price"><span>${fmt(n, cur)}${was}</span></span>`;
}
const refreshPrices = () => $$('[data-price]').forEach((el) => { el.innerHTML = priceHTML(BY_ID[el.dataset.price]); });

/* ---------- Новое от Fyr: бенто ---------- */

const BENTO = [
  ['case-butterfly', 'xl', 'OY 0X Butterfly', 'Две половинки из кожи мицелия. Кольцо «Диафрагма» крутится, как без чехла.'],
  ['case-h1', '', 'Fyr H1', 'Матовый, как замороженное стекло под ним.'],
  ['bracelet-osmium', '', 'Fyr Osmium X0', 'Титан Grade 5. Гнётся, как ткань.'],
  ['strap-osmium', '', 'Fyr Osmium X0', 'Фторэластомер и синяя строчка.'],
  ['sleeve-kbook', '', 'Fyr KBook 1', 'Войлок готландских овец и тритиевая точка.'],
  ['puck-osmium', '', 'Fyr Osmium X0', 'Без прошивки. Обновлять нечего.'],
  ['power-fyr', 'wide', 'Для всего сразу', 'Три USB-C: ноутбук, телефон и часы одновременно.'],
  ['cable-well', 'wide', 'Fyr KBook 1 и телефоны', '256 ГБ резервной копии за девять минут.'],
];
$('[data-bento]').innerHTML = BENTO.map(([id, size, dev, line]) => {
  const a = BY_ID[id];
  return `<li class="acc-tile${size ? ` acc-tile--${size}` : ''}" style="--tint:${TINT[id]}" data-reveal>
    <button type="button" class="acc-tile__open" data-open="${id}" aria-label="${strip(a.name)} — подробнее"></button>
    <div class="acc-tile__img"><img src="${img(a)}" width="1000" height="1000" alt="" loading="lazy" decoding="async"></div>
    <div class="acc-tile__body">
      <p class="acc-tile__dev">${dev}</p>
      <h3 class="acc-tile__name">${a.name.replace(/ для .*$/, '')}</h3>
      <p class="acc-tile__line">${line}</p>
      <div class="acc-tile__foot"><span data-price="${id}"></span><span class="acc-tile__more">Подробнее</span></div>
    </div>
  </li>`;
}).join('');

/* ---------- Каталог ---------- */

const grid = $('[data-acc-grid]');
grid.innerHTML = ACCESSORIES.map((a) => {
  const tags = [
    a.brand === 'fyr' ? '<span class="acc-tag acc-tag--fyr">Fyr</span>' : '<span class="acc-tag">OY</span>',
    a.tag ? `<span class="acc-tag acc-tag--new">${a.tag}</span>` : '',
    a.stock === 'warehouse' ? '<span class="acc-tag acc-tag--stock">Склад OY Europe</span>' : '',
  ].join('');
  const fits = a.fits.length > 4
    ? `${a.fits.slice(0, 3).map((f) => `<li>${DEVICES[f].short}</li>`).join('')}<li class="is-more">ещё ${a.fits.length - 3}</li>`
    : a.fits.map((f) => `<li>${DEVICES[f].short}</li>`).join('');
  return `<li class="acc-card${a.stock ? ' acc-card--stock' : ''}" data-id="${a.id}" style="--tint:${TINT[a.id] ?? ''}">
    <button type="button" class="acc-card__open" data-open="${a.id}" aria-label="${strip(a.name)} — подробнее"></button>
    <div class="acc-card__img">
      <div class="acc-card__tags">${tags}</div>
      <img src="${img(a)}" width="1000" height="1000" alt="" loading="lazy" decoding="async">
    </div>
    <div class="acc-card__body">
      <p class="acc-card__kind">${a.kind}</p>
      <h3 class="acc-card__name">${a.name}</h3>
      ${a.colors ? `<p class="acc-card__colors">${a.colors.slice(0, 8).map(([c, n]) => `<i style="--c:${c}" title="${n}"></i>`).join('')}<span>${a.colors.length > 1 ? `${a.colors.length} цв.` : a.colors[0][1]}</span></p>` : ''}
      <ul class="acc-card__fits" role="list" aria-label="Совместимость">${fits}</ul>
      <div class="acc-card__foot"><span data-price="${a.id}"></span><span class="acc-card__more">Подробнее →</span></div>
    </div>
  </li>`;
}).join('');
const cards = $$('.acc-card', grid);

// Фильтр устройств: три ряда — Fyr, телефоны OY, снятые; у каждого число аксессуаров
const fitsCount = (d) => ACCESSORIES.filter((a) => a.fits.includes(d)).length;
const deviceBox = $('[data-acc-device]');
deviceBox.innerHTML = `<span class="acc-filter__label">Все</span><div class="acc-filter__row"><button type="button" role="radio" class="acc-chip" data-value="all" aria-checked="true">Все устройства <span class="acc-chip__n">${ACCESSORIES.length}</span></button></div>`
  + Object.entries(GROUPS).map(([g, label]) => `<span class="acc-filter__label">${label}</span><div class="acc-filter__row">${Object.entries(DEVICES).filter(([, d]) => d.group === g)
    .map(([id, d]) => `<button type="button" role="radio" class="acc-chip${g === 'fyr' ? ' acc-chip--fyr' : g === 'old' ? ' acc-chip--old' : ''}" data-value="${id}" aria-checked="false" tabindex="-1">${d.short} <span class="acc-chip__n">${fitsCount(id)}</span></button>`).join('')}</div>`).join('');

const kindBox = $('[data-acc-kind]');
const kinds = KINDS.filter((k) => ACCESSORIES.some((a) => a.kind === k));
kindBox.innerHTML = `<button type="button" role="radio" class="acc-chip" data-value="all" aria-checked="true">Всё</button>`
  + kinds.map((k) => `<button type="button" role="radio" class="acc-chip" data-value="${k}" aria-checked="false" tabindex="-1">${k}</button>`).join('')
  + `<button type="button" role="radio" class="acc-chip acc-chip--stock" data-value="warehouse" aria-checked="false" tabindex="-1">Склад OY Europe</button>`;

const count = $('[data-acc-count]');
const empty = $('[data-acc-empty]');
const plural = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'аксессуар' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'аксессуара' : 'аксессуаров');
const matches = (a) => (state.device === 'all' || a.fits.includes(state.device))
  && (state.kind === 'all' || (state.kind === 'warehouse' ? a.stock === 'warehouse' : a.kind === state.kind));

function applyFilter(animate = false) {
  let n = 0;
  cards.forEach((c) => {
    const on = matches(BY_ID[c.dataset.id]);
    c.hidden = !on;
    if (on) n += 1;
  });
  empty.hidden = n > 0;
  const who = state.device === 'all' ? 'для всех устройств' : `для ${MODELS[state.device]}`;
  count.textContent = `${n} ${plural(n)} ${who}${state.kind === 'warehouse' ? ' со склада OY Europe' : ''}`;
  syncRadio(deviceBox, state.device);
  syncRadio(kindBox, state.kind);
  ScrollTrigger.refresh();
  if (animate && !reduceMQ.matches) gsap.fromTo(cards.filter((c) => !c.hidden), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.03, ease: 'expo.out', overwrite: true });
}

/* ---------- Адрес ---------- */

function readURL() {
  const q = new URLSearchParams(location.search);
  if (DEVICES[q.get('d')]) state.device = q.get('d');
  if (q.get('k') === 'warehouse' || kinds.includes(q.get('k'))) state.kind = q.get('k');
  if (q.get('cur') === 'eur') state.cur = 'eur';
  return q.get('item');
}
function writeURL(item = openId) {
  const q = new URLSearchParams();
  if (state.device !== 'all') q.set('d', state.device);
  if (state.kind !== 'all') q.set('k', state.kind);
  if (state.cur !== 'usd') q.set('cur', state.cur);
  if (item) q.set('item', item);
  const s = q.toString();
  history.replaceState(null, '', `${location.pathname}${s ? `?${s}` : ''}${location.hash}`);
}

initRadioGroup(deviceBox, (v) => { state.device = v; applyFilter(true); writeURL(); });
initRadioGroup(kindBox, (v) => { state.kind = v; applyFilter(true); writeURL(); });
const curBox = $('[data-acc-cur]');
initRadioGroup(curBox, (v) => { state.cur = v; syncRadio(curBox, v); refreshPrices(); if (openId) fillDialog(BY_ID[openId]); writeURL(); });
$('[data-acc-reset]').addEventListener('click', () => { state.device = 'all'; state.kind = 'all'; applyFilter(true); writeURL(); });

function scrollToShop() {
  const shop = $('#shop');
  if (smooth.lenis) smooth.lenis.scrollTo(shop, { duration: 1.2 });
  else shop.scrollIntoView({ behavior: reduceMQ.matches ? 'auto' : 'smooth' });
}
$('[data-show-stock]').addEventListener('click', () => {
  state.device = 'all';
  state.kind = 'warehouse';
  applyFilter(true);
  writeURL();
  scrollToShop();
});

/* ---------- Полка склада ---------- */

$('[data-shelf]').innerHTML = ACCESSORIES.filter((a) => a.stock === 'warehouse').slice(0, 9).map((a) => `
  <div class="acc-box" style="--tint:${TINT[a.id]}" data-reveal>
    <img src="${img(a)}" width="1000" height="1000" alt="" loading="lazy" decoding="async">
    <span class="acc-box__tape">OY Europe · ликвидация</span>
    <span class="acc-box__was"><s>$${a.was}</s><b>$${a.usd}</b></span>
  </div>`).join('');

/* ---------- Окно-карточка ---------- */

const dlg = $('[data-acc-dialog]');
const d = {
  img: $('[data-dlg-img]'), kind: $('[data-dlg-kind]'), title: $('[data-dlg-title]'), text: $('[data-dlg-text]'),
  colors: $('[data-dlg-colors]'), specs: $('[data-dlg-specs]'), fits: $('[data-dlg-fits]'), price: $('[data-dlg-price]'), buy: $('[data-dlg-buy]'),
};
let openId = null;
let lastFocus = null;

function fillDialog(a) {
  d.img.src = img(a);
  d.img.alt = strip(a.name);
  d.img.parentElement.style.setProperty('--tint', TINT[a.id] ?? '');
  d.kind.innerHTML = `<span>${a.brand === 'fyr' ? 'Fyr' : 'OY'}</span><span>${a.kind}</span>${a.stock ? '<span>Склад OY Europe</span>' : ''}${a.tag ? `<span>${a.tag}</span>` : ''}`;
  d.title.innerHTML = a.name;
  // ссылки на сноски из окна ведут на страницу: окно закрывается
  d.text.innerHTML = a.text.replace(/ id="fnr-\d+"/g, '');
  d.colors.hidden = !a.colors;
  d.colors.innerHTML = a.colors ? a.colors.map(([c, n]) => `<i style="--c:${c}" title="${n}"></i>`).join('') + `<span>${a.colors.map(([, n]) => n).join(', ')}</span>` : '';
  d.specs.innerHTML = (a.specs || []).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  d.fits.innerHTML = a.fits.map((f) => `<li>${MODELS[f]}</li>`).join('');
  d.price.innerHTML = priceHTML(a);
}

function openDialog(id) {
  const a = BY_ID[id];
  if (!a) return;
  lastFocus = document.activeElement;
  openId = id;
  fillDialog(a);
  if (!dlg.open) dlg.showModal();
  smooth.lenis?.stop();
  writeURL(id);
}
function closeDialog() {
  if (dlg.open) dlg.close();
}
dlg.addEventListener('close', () => {
  openId = null;
  smooth.lenis?.start();
  writeURL(null);
  lastFocus?.focus?.({ preventScroll: true });
});
dlg.addEventListener('click', (e) => {
  if (e.target === dlg) closeDialog();
  if (e.target.closest('a[href^="#fn-"]')) closeDialog();
});
$('[data-dlg-close]').addEventListener('click', closeDialog);
d.buy.addEventListener('click', () => {
  const a = BY_ID[openId];
  toast(a?.stock ? 'Концепт: склад OY Europe тоже выдуманный. Но коробки на нём красивые.' : a?.brand === 'fyr'
    ? 'Концепт: Fyr ничего не продаёт. «Не торопитесь» — помните?'
    : 'Концепт: аксессуары OY не продаются. Но выглядят неплохо, правда?');
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-open]');
  if (b && !b.closest('[data-acc-dialog]')) openDialog(b.dataset.open);
});

/* ---------- Чехол Фарадея: свернуть верх ---------- */

const quiet = $('.acc-quiet');
const roll = $('[data-signal-roll]');
const read = $('[data-signal-read]');
roll.addEventListener('click', () => {
  const on = roll.getAttribute('aria-pressed') !== 'true';
  roll.setAttribute('aria-pressed', String(on));
  roll.textContent = on ? 'Развернуть' : 'Свернуть верх';
  quiet.classList.toggle('is-rolled', on);
  read.textContent = on ? '−141 дБм · нет сети, нет Wi-Fi, нет GNSS' : '−61 дБм · сеть есть';
});

/* ---------- Старт ---------- */

const item = readURL();
syncRadio(curBox, state.cur);
refreshPrices();
applyFilter();
if (item && BY_ID[item]) openDialog(item);

/* ---------- Появления ---------- */

const splits = createSplitReveals($$('[data-split]'), { gsap });
gsap.matchMedia().add({ reduce: '(prefers-reduced-motion: reduce)', motion: '(prefers-reduced-motion: no-preference)' }, ({ conditions: { reduce } }) => {
  if (reduce) smooth.disable(); else smooth.enable();
  if (dlg.open) smooth.lenis?.stop();
  root.classList.toggle('reduced', reduce);
  splits.buildAll(reduce);
  $$('[data-reveal]').forEach((el) => {
    gsap.fromTo(el, { opacity: 0, y: reduce ? 0 : 24 }, { opacity: 1, y: 0, duration: reduce ? 0.4 : 0.9, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 94%' } });
  });
  if (!reduce) {
    // раскладка вместе с точками чуть приближается и уходит вверх, пока её прокручивают
    gsap.fromTo('.acc-hero__stage', { scale: 1.04, y: 0 }, { scale: 1, y: -40, ease: 'none', scrollTrigger: { trigger: '[data-hero]', start: 'top 80%', end: 'bottom top', scrub: true } });
    gsap.from('.acc-spot', { opacity: 0, scale: 0.4, duration: 0.6, stagger: 0.12, ease: 'back.out(2)', delay: 0.6 });
  }
  return () => splits.unsplitAll();
});
