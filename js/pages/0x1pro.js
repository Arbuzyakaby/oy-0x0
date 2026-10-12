/* =========================================================================
   OY 0X1 Pro — сюжет прокрутки страницы модели, конфигуратор и демо
   Citadel 2 («Сторож», «Последнее слово», «Тревожный палец»). Ядро то же,
   что у остальных моделей: ключевые кадры привязаны к ScrollTrigger секций.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage } from '../core/stage.js';
import { createOY0X1Pro, OXP_COLORS } from '../models/oy0x1pro.js';
import { createKeys } from '../core/keys.js';
import { PRODUCTS, getConfig, getPrice } from '../data/products.js';
import { $, $$, clamp01, store, createToast, syncRadio, initRadioGroup, bindStubs } from '../core/ui.js';
import { createSmoothScroll } from '../core/scroll.js';
import { createSplitReveals } from '../core/text.js';
import { initCarousel } from '../core/carousel.js';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const root = document.documentElement;
root.classList.add('anim');

const PI = Math.PI;
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const params = new URLSearchParams(location.search);

const toast = createToast($('#toast'), gsap);

/* ---------- 3D-сцена ---------- */

const canvas = $('#stage');
let stage = null;
try {
  stage = createStage(canvas, createOY0X1Pro, { forceFallback: params.has('fallback') });
} catch (err) {
  console.warn('[OY 0X1 Pro] WebGL недоступен, 3D отключено.', err);
  canvas.style.display = 'none';
}

/* ---------- Цвет, память, цена ---------- */

const PRODUCT = PRODUCTS['0x1pro'];
const COLOR_NAMES = PRODUCT.colors;
const colorGroups = $$('[data-color-switch]');
const memGroup = $('[data-mem-switch]');
const usdEl = $('[data-price-usd]');
const eurEl = $('[data-price-eur]');
const cfgNameEl = $('[data-cfg-name]');
let currentMem = PRODUCT.configs[0].id;
let currentColor = PRODUCT.defaultColor;
let shownUsd = getPrice(PRODUCT.id, currentMem, currentColor).usd;

function updatePrice(animate = true) {
  const price = getPrice(PRODUCT.id, currentMem, currentColor);
  if (!price) return;
  cfgNameEl.textContent = `${currentMem} ГБ`;
  eurEl.textContent = `€${price.eur.toLocaleString('ru-RU')}`;
  const fmt = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
  if (!animate || reduceMQ.matches) { usdEl.textContent = fmt(price.usd); shownUsd = price.usd; return; }
  const o = { n: shownUsd };
  shownUsd = price.usd;
  gsap.to(o, { n: price.usd, duration: 0.6, ease: 'power3.out', onUpdate: () => { usdEl.textContent = fmt(o.n); } });
  gsap.fromTo(usdEl, { y: 8, opacity: 0.6 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' });
}

function setColor(name, { save = true, instant = false, animate = true } = {}) {
  if (!COLOR_NAMES[name]) name = PRODUCT.defaultColor;
  currentColor = name;
  root.dataset.color = name;
  colorGroups.forEach((g) => syncRadio(g, name));
  $$('[data-cfg-color]').forEach((el) => { el.textContent = COLOR_NAMES[name]; });
  stage?.setBodyColor(name, instant);
  if (save) store.set('oy-0x1pro-color', name);
  updatePrice(animate);
}

function setMemory(v, animate = true) {
  if (!getConfig(PRODUCT.id, v)) return;
  currentMem = v;
  syncRadio(memGroup, v);
  updatePrice(animate);
}

colorGroups.forEach((g) => initRadioGroup(g, (v) => setColor(v)));
initRadioGroup(memGroup, (v) => setMemory(v));
syncRadio(memGroup, currentMem);
setColor(store.get('oy-0x1pro-color') || root.dataset.color || PRODUCT.defaultColor, { save: false, instant: true, animate: false });

const priceBody = $('[data-price-table]');
if (priceBody) {
  priceBody.innerHTML = PRODUCT.configs
    .map((c) => `<tr><th scope="row">${c.id} ГБ</th><td>$${c.usd.toLocaleString('en-US')}</td><td>€${c.eur.toLocaleString('ru-RU')}</td></tr>`).join('');
}

bindStubs(toast);

const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ });

/* ---------- Демо Citadel 2 ---------- */

const wait = (ms) => new Promise((r) => setTimeout(r, reduceMQ.matches ? Math.min(ms, 60) : ms));
const li = (text, cls = '') => {
  const el = document.createElement('li');
  el.textContent = text;
  if (cls) el.className = cls;
  return el;
};

// Вкладки: стрелки переключают, как у настоящего tablist
{
  const tabs = $$('.vd__tab');
  const show = (tab, focus = false) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $(`#${t.getAttribute('aria-controls')}`).hidden = !on;
    });
    if (focus) tab.focus();
    ScrollTrigger.refresh();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(t));
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      show(tabs[(i + d + tabs.length) % tabs.length], true);
    });
  });
}

// «Сторож»: хеш системы при каждом включении
{
  const log = $('[data-guard-log]');
  const plate = $('[data-guard-plate]');
  const tamper = $('[data-guard-tamper]');
  const btn = $('[data-guard-boot]');
  let busy = false;
  btn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    btn.disabled = true;
    plate.hidden = true;
    log.replaceChildren(li('Кнопка питания нажата.'));
    const bad = tamper.checked;
    await wait(500);
    log.append(li('Citadel 2 проснулся первым — раньше основного процессора.', 'is-acc'));
    await wait(650);
    log.append(li('Считаю хеш системы…'));
    await wait(900);
    log.append(li(bad ? 'Хеш системы:  3b7d…0c95' : 'Хеш системы:  9f2c…e41a'));
    await wait(400);
    log.append(li('Подпись OY:   9f2c…e41a'));
    await wait(600);
    log.append(bad ? li('Не совпадает. Запись в журнал Citadel 2.', 'is-bad') : li('Совпадает.', 'is-ok'));
    await wait(300);
    plate.className = `vd__plate ${bad ? 'is-bad' : 'is-ok'}`;
    plate.textContent = bad
      ? 'Система изменена. Не вводите PIN и пароли: Citadel 2 не откроет сейф, пока прошивку не восстановят.'
      : 'Система та же, что вышла из OY. Можно вводить PIN.';
    plate.hidden = false;
    btn.disabled = false;
    busy = false;
  });
}

// «Последнее слово»: батарея садится, Citadel 2 договаривает
{
  const log = $('[data-last-log]');
  const on = $('[data-last-on]');
  const btn = $('[data-last-run]');
  const fill = $('[data-last-fill]');
  const pctEl = $('[data-last-pct]');
  const sos = $('[data-last-sos]');
  const timerEl = $('[data-last-timer]');
  let busy = false;
  let done = false;
  let timer = null;
  const setPct = (p) => { pctEl.textContent = String(Math.round(p)); fill.style.setProperty('--p', String(p / 100)); };
  const reset = () => {
    clearInterval(timer);
    sos.hidden = true;
    setPct(9);
    log.replaceChildren(li('Основной аккумулятор: 9 %.', 'is-dim'));
    btn.lastChild.textContent = 'Разрядить телефон';
    done = false;
  };
  btn.addEventListener('click', async () => {
    if (busy) return;
    if (done) { reset(); return; }
    busy = true;
    btn.disabled = true;
    log.replaceChildren(li('Нет сети. Розетки тоже нет.'));
    const o = { p: 9 };
    await new Promise((r) => {
      if (reduceMQ.matches) { setPct(0); r(); return; }
      gsap.to(o, { p: 0, duration: 2.2, ease: 'none', onUpdate: () => setPct(o.p), onComplete: r });
    });
    log.append(li('Основной аккумулятор: 0 %. Телефон выключился.', 'is-bad'));
    await wait(700);
    if (!on.checked) {
      log.append(li('«Последнее слово» было выключено — ничего не отправлено.', 'is-dim'));
    } else {
      log.append(li('Citadel 2 проснулся на своём аккумуляторе: 600 мАч.', 'is-acc'));
      await wait(800);
      log.append(li('Спутник найден. Одна SMS доверенному контакту:'));
      await wait(500);
      log.append(li('«Телефон сел. Последние координаты: 44.4268, 6.9086»', 'is-ok'));
      await wait(700);
      log.append(li('Сигнальный фонарь: SOS · · · — — — · · ·'));
      sos.hidden = false;
      let left = 12 * 3600;
      const fmt = (s) => [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':');
      timerEl.textContent = fmt(left);
      // часы идут ускоренно: секунда демо — минута на телефоне
      timer = setInterval(() => { left = Math.max(0, left - 6); timerEl.textContent = fmt(left); if (!left) clearInterval(timer); }, 100);
    }
    btn.lastChild.textContent = 'Начать заново';
    done = true;
    btn.disabled = false;
    busy = false;
  });
  reset();
}

// «Тревожный палец»: сейф открывается пустым
{
  const files = $('[data-finger-files]');
  const hidden = $('[data-finger-hidden]');
  const FULL = [
    ['Паспорт.pdf', '2,1 МБ'],
    ['Коды 2FA', '12'],
    ['Пароли', '148'],
    ['Ключи доступа', '31'],
    ['Ключи SSH', '3'],
  ];
  $$('[data-finger-use]').forEach((b) => b.addEventListener('click', () => {
    const duress = b.dataset.fingerUse === 'duress';
    files.replaceChildren();
    if (duress) {
      files.append(li('Сейф пуст.', 'is-empty'));
      hidden.textContent = 'Чего не видно: Citadel 2 открыл чистый профиль, как PIN под принуждением в OY OS 2. Настоящий сейф остаётся зашифрованным, и снаружи не понять, что он вообще есть. В журнал Citadel 2 — запись с временем.';
      hidden.hidden = false;
    } else {
      FULL.forEach(([n, v], i) => {
        const el = li(n);
        const s = document.createElement('span');
        s.textContent = v;
        el.append(s);
        el.style.animationDelay = `${i * 60}ms`;
        files.append(el);
      });
      hidden.hidden = true;
    }
  }));
}

/* ---------- Ключевые кадры модели ---------- */

const Keys = createKeys();

function makePoses(mobile) {
  const D = {
    hero: { x: 0.42, y: -0.02, fx: 0, fy: 0, fz: 0, rx: 0.1, ry: -PI + 0.55, rz: 0.06, s: 1, dist: 6.0, float: 1, screen: 1, key1: 0, key2: 0, lock1: 0, lock2: 0, led1: 1, led2: 1, signal: 0, sos: 0, explode: 0, citadel: 0, vapor: 0, coil: 0, antenna: 0 },
    designA: { x: -0.3, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.12, ry: -PI + 0.62, rz: 0.04, dist: 5.7, float: 0 },
    designB: { x: -0.3, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.06, ry: -1.5 * PI + 0.12, rz: -0.02, dist: 5.4 },
    camsA: { x: 0.36, y: 0, fx: 0, fy: 0.1, fz: 0, rx: 0.1, ry: -PI + 0.35, rz: 0, dist: 5.0, float: 0 },
    camsClose: { x: 0.34, y: 0, fx: 0.105, fy: 0.52, fz: -0.06, rx: 0.1, ry: -PI + 0.2, rz: 0, dist: 2.5 },
    camsClose2: { x: 0.34, y: 0, fx: 0.105, fy: 0.5, fz: -0.06, rx: 0.22, ry: -PI + 0.45, rz: 0, dist: 2.7 },
    camsFront: { x: 0.46, y: 0.1, fx: 0, fy: 0.75, fz: 0.04, rx: 0.16, ry: 0.28, rz: 0, dist: 2.2 },
    citA: { x: -0.3, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.3, ry: -0.75, rz: 0.08, dist: 8.4, float: 0, screen: 1 },
    citB: { x: -0.3, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.26, ry: -1.05, rz: 0.06, dist: 7.6 },
    keys: { x: 0.28, y: 0, fx: -0.385, fy: 0.37, fz: 0, rx: 0.1, ry: -1.5 * PI + 0.36, rz: 0, dist: 1.9, float: 0 },
    keysEnd: { x: 0.28, y: 0, fx: -0.385, fy: 0.37, fz: 0, rx: 0.05, ry: -1.5 * PI + 0.24, rz: 0, dist: 1.75 },
    clawA: { x: -0.32, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.14, ry: 0.7, rz: -0.04, dist: 5.4, float: 0 },
    clawB: { x: -0.32, y: 0, fx: 0, fy: 0.1, fz: 0, rx: 0.5, ry: 1.2, rz: -0.04, dist: 5.2 },
    display: { x: 0.34, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.02, ry: -0.3, rz: 0, dist: 5.6, float: 0, screen: 1 },
    displayEnd: { x: 0.34, y: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: -0.12, rz: 0, dist: 5.4 },
    insideA: { x: 0.3, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.32, ry: -0.62, rz: 0.1, dist: 8.6, float: 0, screen: 1 },
    insideMid: { x: 0.3, y: 0, rx: 0.3, ry: -1.22, rz: 0.08, dist: 8.0 },
    insideB: { x: 0.3, y: 0, rx: 0.22, ry: -PI + 0.85, rz: -0.06, dist: 8.2 },
    colorsA: { x: 0.26, y: 0.06, fx: 0, fy: 0, fz: 0, rx: 0.14, ry: -PI + 0.7, rz: 0.04, dist: 5.1, float: 0, screen: 1 },
    colorsB: { x: 0.26, y: 0.06, fx: 0, fy: 0, fz: 0, rx: 0.1, ry: -PI - 0.6, rz: -0.04, dist: 4.9 },
    finalA: { x: 0, y: -0.75, fx: 0, fy: 0, fz: 0, rx: 0.08, ry: -PI + 0.7, rz: 0.04, dist: 9.0, float: 1, screen: 1 },
    finalB: { x: 0, y: -0.5, fx: 0, fy: 0, fz: 0, rx: 0.06, ry: -PI + 0.3, rz: 0.03, dist: 9.0, float: 1 },
  };
  if (!mobile) return D;
  const M = {
    hero: { x: 0, y: 0.36, ry: -PI + 0.45, rx: 0.08, dist: 8.6 },
    designA: { x: 0, y: 0.4, dist: 8.3 },
    designB: { x: 0, y: 0.4, dist: 8.1 },
    camsA: { x: 0, y: 0.42, dist: 7.3 },
    camsClose: { x: 0, y: 0.48, dist: 3.6 },
    camsClose2: { x: 0, y: 0.48, dist: 3.7 },
    camsFront: { x: 0, y: 0.52, fy: 0.58, dist: 4.8 },
    citA: { x: 0, y: 0.44, dist: 11.4 },
    citB: { x: 0, y: 0.44, dist: 10.8 },
    keys: { x: 0, y: 0.45, dist: 3.0, ry: -1.5 * PI + 0.5 },
    keysEnd: { x: 0, y: 0.45, dist: 2.9, ry: -1.5 * PI + 0.4 },
    clawA: { x: 0, y: 0.42, dist: 8.2 },
    clawB: { x: 0, y: 0.42, dist: 8.0 },
    display: { x: 0, y: 0.4, ry: -0.25, dist: 9.0 },
    displayEnd: { x: 0, y: 0.4, ry: -0.12, dist: 8.8 },
    insideA: { x: 0, y: 0.4, dist: 12.0 },
    insideMid: { x: 0, y: 0.4, dist: 11.3 },
    insideB: { x: 0, y: 0.4, dist: 11.5 },
    colorsA: { x: 0, y: 0.34, dist: 8.4 },
    colorsB: { x: 0, y: 0.34, dist: 8.1 },
    finalA: { x: 0, y: -0.7, dist: 10.6 },
    finalB: { x: 0, y: -0.45, dist: 10.6 },
  };
  for (const k in M) D[k] = { ...D[k], ...M[k] };
  return D;
}

/* ---------- Синхронизация HTML с состоянием сцены ---------- */

const modes = $$('.mode');
const ladder = $$('.ladder__step');
const glareEl = $('.glare');
const lastHtml = {};

function syncHtml(v) {
  const changed = (k, val) => {
    const r = Math.round(val * 1000) / 1000;
    if (lastHtml[k] === r) return false;
    lastHtml[k] = r;
    return true;
  };
  if (v.mode !== undefined && changed('mode', v.mode)) {
    const cur = Math.round(v.mode);
    modes.forEach((el, i) => {
      el.style.setProperty('--on', String(clamp01(v.mode - i)));
      el.classList.toggle('is-current', i + 1 === cur);
    });
  }
  if (v.net !== undefined && changed('net', v.net)) {
    const cur = Math.round(v.net);
    ladder.forEach((el, i) => {
      el.style.setProperty('--on', String(clamp01(v.net - i + 1)));
      el.classList.toggle('is-current', i === cur);
    });
  }
  if (v.glare !== undefined && changed('glare', v.glare)) glareEl?.style.setProperty('--g', String(clamp01(v.glare)));
}

/* ---------- Текст и карусель ---------- */

const splits = createSplitReveals($$('[data-split]'), { gsap });
initCarousel($('#highlights'), { gsap, isReduced: () => reducedMode });

/* ---------- Главная хореография ---------- */

const sections = Object.fromEntries(['hero', 'design', 'cams', 'citadel', 'keys', 'claw', 'display', 'inside', 'colors', 'final']
  .map((id) => [id, $(`#${id}`)]));

let reducedMode = reduceMQ.matches;

function buildChoreography({ isMobile, reduce }) {
  reducedMode = reduce;
  stage?.setReduced(reduce);
  if (reduce) smooth.disable(); else smooth.enable();
  root.classList.toggle('reduced', reduce);

  Keys.reset();
  const P = makePoses(isMobile);
  const m = isMobile ? 0.75 : 1;

  const sts = {};
  const pinned = (name, len) => {
    const sec = sections[name];
    if (reduce) {
      sts[name] = ScrollTrigger.create({ trigger: sec, start: 'top top', end: 'bottom top' });
      return null;
    }
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: sec, start: 'top top', end: `+=${Math.round(len * m)}%`, pin: true, scrub: true, anticipatePin: 1 },
    });
    tl.set({}, {}, 1);
    sts[name] = tl.scrollTrigger;
    return tl;
  };

  sts.hero = ScrollTrigger.create({ trigger: sections.hero, start: 'top top', end: 'bottom top' });
  pinned('design', 150);
  const tlCams = pinned('cams', 200);
  const tlCit = pinned('citadel', 180);
  pinned('keys', 220);
  pinned('claw', 180);
  pinned('display', 140);
  const tlInside = pinned('inside', 220);
  pinned('colors', 140);
  sts.final = ScrollTrigger.create({ trigger: sections.final, start: 'top top', end: '+=100%' });

  if (tlCams) {
    $$('.lens', sections.cams).forEach((el, i) => {
      tlCams.fromTo(el, { autoAlpha: 0.15, x: -16 }, { autoAlpha: 1, x: 0, duration: 0.07 }, 0.26 + i * 0.1);
    });
    tlCams.fromTo('.cams-note', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.08 }, 0.82);
  }
  if (tlCit) {
    $$('.cit', sections.citadel).forEach((el, i) => {
      tlCit.fromTo(el, { autoAlpha: 0.15, x: 16 }, { autoAlpha: 1, x: 0, duration: 0.08 }, 0.2 + i * 0.14);
    });
  }
  if (tlInside) {
    $$('.layer', sections.inside).forEach((el, i) => {
      tlInside.fromTo(el, { autoAlpha: 0.12, x: -16 }, { autoAlpha: 1, x: 0, duration: 0.06 }, 0.12 + i * 0.06);
    });
  }

  const K = (name, f, props, linear) => Keys.add(sts[name], f, props, linear);
  K('hero', 0, { ...P.hero, net: 0, glare: 1, mode: 0 });
  K('design', -1, P.designA);
  K('design', 0, P.designA);
  K('design', 1, P.designB);
  K('cams', 0, P.camsA);
  K('cams', 0.3, P.camsClose);
  K('cams', 0.62, P.camsClose2);
  K('cams', 0.86, P.camsFront);
  K('cams', 1, P.camsFront);
  // Citadel 2: телефон раскрывается, чип загорается
  K('citadel', -1, { ...P.citA, explode: 0, citadel: 0 });
  K('citadel', 0, { ...P.citA, explode: 0, citadel: 0 });
  K('citadel', 0.35, { explode: 0.85, citadel: 0.2 });
  K('citadel', 0.55, { citadel: 1 });
  K('citadel', 1, { ...P.citB, explode: 0.85, citadel: 1 });
  // Кнопки: «0» — действие, «1» — фиксация, обе — «Всё выключить» (между ними две 2D-секции)
  K('keys', -1, { ...P.keys, explode: 0, citadel: 0, key1: 0, key2: 0, lock1: 0, lock2: 0, led1: 1, led2: 1, mode: 0 });
  K('keys', 0.08, { mode: 0, key1: 0 });
  K('keys', 0.16, { mode: 1, key1: 1 });
  K('keys', 0.24, { key1: 0, key2: 0, lock2: 0, led2: 1 });
  K('keys', 0.34, { mode: 1 });
  K('keys', 0.42, { mode: 2, lock2: 1, led2: 2 });
  K('keys', 0.6, { mode: 2, lock1: 0, led1: 1 });
  K('keys', 0.72, { mode: 3, lock1: 1, led1: 2 });
  K('keys', 1, { ...P.keysEnd, mode: 3, lock1: 1, lock2: 1, led1: 2, led2: 2 });
  K('claw', 0, { ...P.clawA, net: 0, lock1: 1, lock2: 1, led1: 2, led2: 2, antenna: 0 });
  K('claw', 0.12, { lock1: 0, lock2: 0, led1: 1, led2: 1, antenna: 0, net: 0 });
  K('claw', 0.3, { antenna: 1 });
  K('claw', 0.84, { ...P.clawB, net: 5 }, true);
  K('claw', 1, { ...P.clawB, antenna: 1, net: 5 });
  K('display', -1, { ...P.display, antenna: 0, glare: 1 });
  K('display', 0, { ...P.display, glare: 1 });
  K('display', 0.2, { glare: 1 });
  K('display', 0.7, { glare: 0 });
  K('display', 1, { ...P.displayEnd, glare: 0 });
  // По слоям: испарительная камера, Citadel 2 и катушка по очереди
  K('inside', -1, { ...P.insideA, explode: 0, citadel: 0, vapor: 0, coil: 0 });
  K('inside', 0, { ...P.insideA, explode: 0 });
  K('inside', 0.12, { explode: 0, citadel: 0, vapor: 0, coil: 0 });
  K('inside', 0.5, { ...P.insideMid, explode: 1, vapor: 1 });
  K('inside', 0.66, { citadel: 0.9 });
  K('inside', 0.82, { coil: 1 });
  K('inside', 1, { ...P.insideB, explode: 1, vapor: 1, citadel: 0.9, coil: 1 });
  K('colors', -1, { ...P.colorsA, explode: 0, citadel: 0, vapor: 0, coil: 0 });
  K('colors', 0, P.colorsA);
  K('colors', 1, P.colorsB);
  K('final', -1, P.finalA);
  K('final', 0, P.finalB);
  K('final', 1, { y: P.finalB.y + 2 }, true);

  splits.buildAll(reduce);
  $$('[data-reveal]').forEach((el) => {
    const sibs = Array.from(el.parentElement.children).filter((c) => c.hasAttribute('data-reveal'));
    const delay = Math.min(sibs.indexOf(el), 6) * (reduce ? 0.04 : 0.07);
    const from = reduce ? { opacity: 0 } : { opacity: 0, y: 32, filter: 'blur(6px)' };
    const to = reduce
      ? { opacity: 1, duration: 0.5, delay }
      : { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1, delay, ease: 'expo.out' };
    gsap.fromTo(el, from, { ...to, scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none none' } });
  });

  // Зарядка 0 → 100 % за 25 минут
  const fill = $('.charge__fill');
  const pctEl = $('[data-charge-pct]');
  const minEl = $('[data-charge-min]');
  const setCharge = (p) => {
    fill.style.setProperty('--p', p.toFixed(3));
    pctEl.textContent = String(Math.round(p * 100));
    minEl.textContent = String(Math.round(p * 25));
  };
  if (reduce) setCharge(1);
  else {
    const o = { p: 0 };
    gsap.to(o, {
      p: 1, ease: 'none', onUpdate: () => setCharge(o.p),
      scrollTrigger: { trigger: '.charge', start: 'top 80%', end: 'bottom 55%', scrub: true },
    });
  }

  if (!reduce) {
    gsap.to('.bgfx__glow--a', { yPercent: 70, xPercent: -20, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: true } });
    gsap.to('.bgfx__glow--b', { yPercent: -60, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: true } });
    gsap.fromTo('.tb', { yPercent: 14 }, { yPercent: -10, ease: 'none', scrollTrigger: { trigger: '.pperf', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.fromTo('.hero__inner', { y: 0 }, { y: -80, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: sections.hero, start: 'top top', end: 'bottom top', scrub: true } });
  }

  ['.highlights', '.calls'].forEach((sel) => ScrollTrigger.create({ trigger: sel, start: 'top bottom', end: 'bottom top', toggleClass: 'in-view' }));

  ScrollTrigger.refresh();

  return () => {
    Keys.reset();
    splits.unsplitAll();
  };
}

ScrollTrigger.addEventListener('refresh', () => Keys.compile(window.innerHeight));

/* ---------- Вращение модели перетаскиванием (секция цветов) ---------- */

const spin = { v: 0, on: false };
{
  const sec = sections.colors;
  let drag = null;
  new IntersectionObserver(([e]) => {
    spin.on = e.isIntersecting;
    if (!spin.on) spin.v = 0;
  }, { threshold: 0.6 }).observe(sec);
  sec.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button, a')) return;
    drag = { x: e.clientX, v: spin.v, id: e.pointerId };
    sec.setPointerCapture(e.pointerId);
    sec.classList.add('is-dragging');
  });
  sec.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    spin.v = drag.v + ((e.clientX - drag.x) / window.innerWidth) * PI * 2.2;
    if (Math.abs(e.clientX - drag.x) > 6) sec.classList.add('was-dragged');
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    sec.classList.remove('is-dragging');
  };
  sec.addEventListener('pointerup', end);
  sec.addEventListener('pointercancel', end);
}

/* ---------- Каждый тик: прокрутка → состояние ---------- */

let lastPoseKey = '';
let fading = false;
function tick() {
  if (Keys.empty) return;
  const v = Keys.sample(window.scrollY, reducedMode);
  v.spin = spin.on ? spin.v : 0;
  syncHtml(v);
  if (!stage) return;
  if (!reducedMode) { stage.setTarget(v); return; }
  const keyStr = ['x', 'y', 'rx', 'ry', 'rz', 'dist', 'fy', 'explode'].map((k) => (v[k] ?? 0).toFixed(2)).join('|');
  if (keyStr === lastPoseKey || fading) { if (!fading) stage.setTarget(v); return; }
  if (!lastPoseKey) { lastPoseKey = keyStr; stage.setTarget(v); return; }
  lastPoseKey = keyStr;
  fading = true;
  gsap.to(canvas, {
    opacity: 0, duration: 0.15, onComplete: () => {
      stage.setTarget(Keys.sample(window.scrollY, true));
      gsap.to(canvas, { opacity: 1, duration: 0.3, onComplete: () => { fading = false; } });
    },
  });
}
gsap.ticker.add(tick);
if (params.has('debug')) window.__oy = { stage, Keys, ScrollTrigger, lenis: () => smooth.lenis };

/* ---------- Рендер только когда 3D-секции видны ---------- */

if (stage) {
  const visible = new Set();
  const update = () => stage.setActive(visible.size > 0 && !document.hidden);
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
    update();
  }, { rootMargin: '10% 0px 10% 0px' });
  $$('[data-3d]').forEach((s) => io.observe(s));
  document.addEventListener('visibilitychange', update);

  window.addEventListener('pointermove', (e) => {
    if (reducedMode || e.pointerType === 'touch') return;
    stage.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });

  let rw = window.innerWidth;
  window.addEventListener('resize', () => {
    stage.resize();
    if (Math.abs(window.innerWidth - rw) > 2) {
      rw = window.innerWidth;
      splits.rebuildPending(reducedMode);
    }
  });
}

/* ---------- Запуск ---------- */

async function boot() {
  const timeout = (ms) => new Promise((r) => setTimeout(r, ms));
  const fonts = document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve();
  await Promise.race([Promise.all([fonts, stage ? stage.ready : null, timeout(500)]), timeout(14000)]);
  stage?.redrawScreen(OXP_COLORS[root.dataset.color]?.accent);

  const mm = gsap.matchMedia();
  mm.add({
    isMobile: '(max-width: 760px)',
    isDesktop: '(min-width: 761px)',
    reduce: '(prefers-reduced-motion: reduce)',
    motion: '(prefers-reduced-motion: no-preference)',
  }, (ctx) => buildChoreography(ctx.conditions));

  const loader = $('#loader');
  loader.classList.add('is-done');
  loader.setAttribute('aria-hidden', 'true');
  if (!reduceMQ.matches) {
    gsap.from('.site-header', { yPercent: -100, opacity: 0, duration: 1, ease: 'expo.out', delay: 0.2 });
  }
  window.addEventListener('load', () => ScrollTrigger.refresh());

  let hashTarget = null;
  try { hashTarget = location.hash.length > 1 ? document.querySelector(location.hash) : null; } catch { /* неверный якорь */ }
  if (hashTarget) {
    const go = () => {
      if (smooth.lenis) { smooth.lenis.resize(); smooth.lenis.scrollTo(hashTarget, { immediate: true, force: true }); }
      else hashTarget.scrollIntoView();
    };
    requestAnimationFrame(go);
    if (document.readyState !== 'complete') window.addEventListener('load', () => requestAnimationFrame(go), { once: true });
  }
}
boot();
