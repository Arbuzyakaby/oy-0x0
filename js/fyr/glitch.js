/* =========================================================================
   Fyr — сцена «Перехвата». Срыв картинки, чёрные полосы редактуры, перебор
   hex-символов, перекраска в чёрный, синий и белый. Здесь же — применение
   словаря к странице, наблюдение за текстом, который страница пишет позже,
   и возврат к OY. Без GSAP: на 404 его нет, хватает Web Animations.
   ========================================================================= */

import { PHRASES, norm, pageRules, convertText, rebrand } from './dict.js';

const root = document.documentElement;
const KEY = 'fyr';
const SIG = '0x2556FA10290A6F';
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const SKIP = 'script, style, noscript, svg, canvas, textarea, input, select, [data-fyr-skip], .fyr-ui';
const KEEP = 'svg, button, img, picture, sup, a, input, kbd';

const session = {
  set() { try { window.sessionStorage.setItem(KEY, '1'); } catch { /* только до перезагрузки */ } },
  clear() { try { window.sessionStorage.removeItem(KEY); } catch { /* нечего чистить */ } },
};

/* ---------- Учёт изменений: всё, что поменяли, можно вернуть ---------- */

const changedEls = [];   // { el, html, split }
const changedTexts = []; // [node, исходный текст]
const injected = [];     // наши элементы
let saved = null;        // заголовок документа и theme-color
let observer = null;
let quiet = false;

const isSkipped = (node) => {
  const el = node.nodeType === 1 ? node : node.parentElement;
  return !el || !!el.closest(SKIP) || !!el.closest('[data-fyr-done]');
};

// Обновить «память» разбиения заголовков (js/core/text.js): иначе при
// пересборке строк вернётся текст OY
function syncSplit(el) {
  const host = el.closest('[data-split-text]');
  if (host) host.dataset.splitText = norm(host.textContent);
}

// Текст элемента меняется, а щит, ссылки и сноски внутри остаются
function putText(el, text) {
  const keep = [...el.children].some((c) => c.matches(KEEP));
  if (!keep) { el.textContent = text; return; }
  [...el.children].forEach((c) => { if (!c.matches(KEEP)) c.remove(); });
  const nodes = [...el.childNodes].filter((n) => n.nodeType === 3);
  let first = nodes.find((n) => n.data.trim()) || null;
  nodes.forEach((n) => { if (n !== first) n.data = n.data.trim() ? '' : n.data; });
  const lead = first?.previousSibling ? ' ' : '';
  if (first) first.data = lead + text;
  else el.append(' ' + text);
}

function replaceEl(el, text) {
  changedEls.push({ el, html: el.innerHTML, split: el.closest('[data-split-text]')?.dataset.splitText });
  putText(el, text);
  el.setAttribute('data-fyr-done', '');
  syncSplit(el);
}

/* ---------- План замен: что поменять и где это на экране ---------- */

function collect(scope = document.body) {
  const ops = [];
  const taken = new Set();
  // 404 отдаётся по любому неизвестному адресу — узнаём её по классу
  const path = document.body.classList.contains('page-404') ? '/404.html' : location.pathname;

  if (scope === document.body) {
    for (const [sel, text] of pageRules(path)) {
      const el = document.querySelector(sel);
      if (el && !el.hasAttribute('data-fyr-done')) { ops.push({ el, run: () => replaceEl(el, text), scramble: text }); taken.add(el); }
    }
  }

  // Общие фразы: от листьев к корню, чтобы «Семь телефонов.» в своём span
  // заменилось раньше, чем весь заголовок
  const els = [...scope.querySelectorAll('*')].reverse();
  if (scope.nodeType === 1 && scope !== document.body) els.push(scope);
  const busy = new Set();
  for (const el of els) {
    if (taken.has(el) || isSkipped(el)) continue;
    if ([...busy].some((b) => el.contains(b))) continue;
    const raw = el.textContent;
    if (raw.length > 90) continue;
    const to = PHRASES.get(norm(raw));
    if (to === undefined) continue;
    ops.push({ el, run: () => replaceEl(el, to), scramble: to });
    busy.add(el);
  }

  // Цены, подстрочные фразы и бренд — по текстовым узлам
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.data.trim() || isSkipped(n)) continue;
    if ([...busy].some((b) => b.contains(n))) continue;
    const to = convertText(n.data);
    if (to === n.data) continue;
    const node = n;
    ops.push({ el: node.parentElement, node, run: () => { changedTexts.push([node, node.data]); node.data = to; syncSplit(node.parentElement); } });
  }
  return ops;
}

/* ---------- Внешний вид: логотип, подпись, кнопка возврата ---------- */

// Строчное «fyr»; над «y» — луч маяка (fyr по-шведски — «маяк»)
export const LOGO = `<svg class="fyr-logo" viewBox="0 0 46 30" aria-hidden="true" data-fyr-skip>
  <path class="fyr-logo__beam" d="M23 6L42 0.5V11.5Z"/>
  <path class="fyr-logo__ink" d="M8 24V10a4 4 0 0 1 4-4h3M4 13h9M19 12v6a4 4 0 0 0 8 0M27 12v12a4 4 0 0 1-7.4 2.2M34 24v-8a4 4 0 0 1 4-4h3"/>
  <circle class="fyr-logo__lamp" cx="23" cy="6" r="1.8"/>
</svg>`;

function inject(parent, html, where = 'append') {
  if (!parent) return null;
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  const el = t.content.firstElementChild;
  el.classList.add('fyr-ui');
  if (where === 'prepend') parent.prepend(el); else parent.append(el);
  injected.push(el);
  return el;
}

function dress() {
  document.querySelectorAll('.brand, .footer__brand, .x-logo').forEach((b) => inject(b, LOGO, 'prepend'));
  const foot = ['.footer__inner', '.x-footer__grid', 'body > footer'].map((q) => document.querySelector(q)).find(Boolean);
  inject(foot, `<a class="fyr-sig mono" href="/fyr/chronicle/" aria-label="Хроника: как OY стала Fyr">${SIG}<span aria-hidden="true"> →</span></a>`);
  const back = inject(document.body, '<button type="button" class="fyr-return">Вернуть OY</button>');
  back.addEventListener('click', () => revert());

  const meta = document.querySelector('meta[name="theme-color"]');
  saved = { title: document.title, theme: meta?.content };
  document.title = convertTitle(document.title);
  if (meta) meta.content = '#05070A';
}

function convertTitle(t) {
  for (const [from, to] of PHRASES) if (from.length > 12 && t.includes(from)) t = t.replace(from, to);
  return rebrand(convertText(t));
}

/* ---------- Наблюдение: страница дописывает текст позже ---------- */

function watch() {
  observer?.disconnect();
  observer = new MutationObserver((list) => {
    if (quiet) return;
    const scopes = new Set();
    for (const m of list) {
      if (m.type === 'characterData') scopes.add(m.target);
      else m.addedNodes.forEach((n) => scopes.add(n));
    }
    quiet = true;
    for (const s of scopes) {
      if (!s.isConnected || isSkipped(s)) continue;
      if (s.nodeType === 3) {
        const to = convertText(s.data);
        if (to !== s.data) { changedTexts.push([s, s.data]); s.data = to; }
      } else if (s.nodeType === 1) collect(s).forEach((op) => op.run());
    }
    observer.takeRecords();
    quiet = false;
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
}

/* ---------- Сцена ---------- */

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const HEX = '0123456789ABCDEF';
const rnd = (n) => Array.from({ length: n }, () => HEX[(Math.random() * 16) | 0]).join('');

function overlay() {
  const o = document.createElement('div');
  o.className = 'fyr-ui fyr-glitch';
  o.setAttribute('aria-hidden', 'true');
  o.innerHTML = '<div class="fyr-glitch__scan"></div>';
  document.body.append(o);
  return o;
}

function slices(o, count, ms) {
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'fyr-glitch__slice' + (Math.random() < 0.35 ? ' is-black' : '');
    const h = 4 + Math.random() * 46;
    s.style.top = `${Math.random() * 100}vh`;
    s.style.height = `${h}px`;
    o.append(s);
    const dx = (Math.random() - 0.5) * 120;
    s.animate([
      { transform: `translateX(${dx}px)`, opacity: 1 },
      { transform: `translateX(${-dx * 0.6}px)`, opacity: 1, offset: 0.5 },
      { transform: 'translateX(0)', opacity: 0 },
    ], { duration: ms * (0.4 + Math.random() * 0.6), delay: Math.random() * ms * 0.4, easing: 'steps(4)', fill: 'forwards' });
  }
}

const inView = (r) => r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && r.width > 0;

function lineRects(el, node) {
  const range = document.createRange();
  if (node) range.selectNodeContents(node); else range.selectNodeContents(el);
  return [...range.getClientRects()].filter((r) => r.width > 2 && inView(r)).slice(0, 4);
}

function bar(o, r, delay) {
  const b = document.createElement('div');
  b.className = 'fyr-bar';
  Object.assign(b.style, { left: `${r.left - 4}px`, top: `${r.top - 1}px`, width: `${r.width + 8}px`, height: `${r.height + 2}px` });
  o.append(b);
  b.animate([
    { transform: 'scaleX(0)', transformOrigin: 'left' },
    { transform: 'scaleX(1)', transformOrigin: 'left', offset: 0.3 },
    { transform: 'scaleX(1)', transformOrigin: 'right', offset: 0.7 },
    { transform: 'scaleX(0)', transformOrigin: 'right' },
  ], { duration: 760, delay, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'both' });
}

async function scramble(target, final, isNode) {
  const len = Math.max(4, Math.min(final.length, 40));
  for (let i = 0; i < 7; i++) {
    const s = rnd(len);
    if (isNode) target.data = s; else target.textContent = s;
    await wait(42);
  }
}

let running = false;

export async function hijack() {
  if (running || root.dataset.brand === 'fyr') return;
  running = true;
  const reduce = reduceMQ.matches;
  const ops = collect();
  const o = overlay();

  if (reduce) {
    o.classList.add('is-fade');
    await wait(320);
    ops.forEach((op) => op.run());
    finish();
    o.classList.add('is-out');
    await wait(400);
    o.remove();
    running = false;
    return;
  }

  // 1. Срыв
  root.classList.add('fyr-glitching');
  slices(o, 14, 420);
  await wait(400);

  // 2. Редактура: видимое — под полосой и с перебором, остальное сразу
  const seen = [];
  for (const op of ops) {
    const r = op.el?.getBoundingClientRect();
    if (r && inView(r)) seen.push(op); else op.run();
  }
  seen.sort((a, b) => a.el.getBoundingClientRect().top - b.el.getBoundingClientRect().top);
  const decoys = [...document.querySelectorAll('main p, main h2, main h3, main li, footer p')]
    .filter((el) => !isSkipped(el) && inView(el.getBoundingClientRect())).slice(0, 12);
  decoys.forEach((el, i) => lineRects(el).forEach((r) => bar(o, r, 60 + i * 55)));
  const jobs = seen.map((op, i) => (async () => {
    const delay = 80 + i * 70;
    lineRects(op.el, op.node).forEach((r) => bar(o, r, delay));
    await wait(delay + 230);
    quiet = true;
    if (op.node) await scramble(op.node, op.node.data, true);
    else if (op.el.childElementCount === 0) await scramble(op.el, op.scramble || '', false);
    op.run();
    quiet = false;
  })());
  slices(o, 6, 900);
  await Promise.all([...jobs, wait(1200)]);

  // 3. Перекраска
  root.classList.remove('fyr-glitching');
  root.classList.add('fyr-swap');
  finish();
  slices(o, 8, 500);
  await wait(900);
  root.classList.remove('fyr-swap');
  o.classList.add('is-out');
  await wait(300);
  o.remove();
  running = false;
}

function finish() {
  root.dataset.brand = 'fyr';
  session.set();
  dress();
  watch();
}

// Вкладка уже перехвачена: другая страница открывается сразу в Fyr
export function restore() {
  root.dataset.brand = 'fyr';
  collect().forEach((op) => op.run());
  dress();
  watch();
  root.classList.remove('fyr-pending');
  if (!reduceMQ.matches) {
    const o = overlay();
    slices(o, 8, 220);
    setTimeout(() => o.remove(), 320);
  }
}

export async function revert() {
  if (running) return;
  running = true;
  const reduce = reduceMQ.matches;
  const o = overlay();
  if (reduce) o.classList.add('is-fade');
  else { root.classList.add('fyr-glitching'); slices(o, 12, 500); }
  await wait(reduce ? 320 : 380);

  observer?.disconnect();
  observer = null;
  for (let i = changedTexts.length - 1; i >= 0; i--) {
    const [node, text] = changedTexts[i];
    node.data = text;
  }
  for (let i = changedEls.length - 1; i >= 0; i--) {
    const { el, html, split } = changedEls[i];
    el.innerHTML = html;
    el.removeAttribute('data-fyr-done');
    const host = el.closest('[data-split-text]');
    if (host && split !== undefined) host.dataset.splitText = split;
  }
  changedTexts.length = 0;
  changedEls.length = 0;
  injected.splice(0).forEach((el) => el.remove());
  if (saved) {
    document.title = saved.title;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && saved.theme) meta.content = saved.theme;
  }
  delete root.dataset.brand;
  session.clear();

  root.classList.remove('fyr-glitching');
  o.classList.add('is-out');
  await wait(300);
  o.remove();
  running = false;
}

// Страницы Fyr: Fyr теперь легальна и режим на всю вкладку не включает.
// Ссылки [data-fyr-return] (если остались) просто снимают режим пасхалки
export function mountPage() {
  document.querySelectorAll('[data-fyr-return]').forEach((a) => a.addEventListener('click', () => session.clear()));
}
