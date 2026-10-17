/* =========================================================================
   OY 0X2 — сюжет прокрутки страницы модели, конфигуратор, демо кнопок
   «0» и «1», функций Tesseract и навсегда заблокированного загрузчика. Ядро то же, что у 0X0 и Pro: ключевые кадры модели привязаны
   к ScrollTrigger секций, на каждом тике прокрутка превращается в целевое
   состояние сцены.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage } from '../core/stage.js';
import { createOY0X2, OX2_COLORS } from '../models/oy0x2.js';
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
  stage = createStage(canvas, createOY0X2, { forceFallback: params.has('fallback') });
} catch (err) {
  console.warn('[OY 0X2] WebGL недоступен, 3D отключено.', err);
  canvas.style.display = 'none';
}

/* ---------- Цвет, память, цена ---------- */

const PRODUCT = PRODUCTS['0x2'];
const COLOR_NAMES = PRODUCT.colors;
const colorGroups = $$('[data-color-switch]');
const memGroup = $('[data-mem-switch]');
const usdEl = $('[data-price-usd]');
const eurEl = $('[data-price-eur]');
const cnyEl = $('[data-price-cny]');
const cfgNameEl = $('[data-cfg-name]');
let currentMem = PRODUCT.configs[0].id;
let currentColor = PRODUCT.defaultColor;
let shownUsd = getPrice(PRODUCT.id, currentMem, currentColor).usd;

function updatePrice(animate = true) {
  const price = getPrice(PRODUCT.id, currentMem, currentColor);
  if (!price) return;
  cfgNameEl.textContent = `${currentMem} ГБ`;
  eurEl.textContent = `€${price.eur.toLocaleString('ru-RU')}`;
  cnyEl.textContent = `¥${price.cny.toLocaleString('ru-RU')}`;
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
  if (save) store.set('oy-0x2-color', name);
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
setColor(store.get('oy-0x2-color') || root.dataset.color || PRODUCT.defaultColor, { save: false, instant: true, animate: false });

// Таблица цен из тех же данных
const priceBody = $('[data-price-table]');
if (priceBody) {
  priceBody.innerHTML = PRODUCT.configs
    .map((c) => `<tr><th scope="row">${c.id} ГБ</th><td>$${c.usd.toLocaleString('en-US')}</td><td>€${c.eur.toLocaleString('ru-RU')}</td><td>¥${c.cny.toLocaleString('ru-RU')}</td></tr>`).join('');
}

bindStubs(toast);

const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ });

/* ---------- Демо: назначьте кнопки и нажмите ---------- */

const ACTIONS = {
  flash: { name: 'Фонарь', on: 'Фонарь включён.', off: 'Фонарь выключен.' },
  camera: { name: 'Камера', once: 'Камера открыта. За 0,4 секунды, из любого экрана.', needs: 'hw-cam', blocked: 'Камеры обесточены — открывать нечего.' },
  assist: { name: 'OY Assist', once: 'OY Assist слушает. Только сейчас и только на устройстве.', needs: 'hw-mic', blocked: 'Микрофоны обесточены — ассистенту нечем слушать.' },
  wallet: { name: 'Кошелёк', once: 'Кошелёк готов: поднесите телефон к терминалу. Карта — только в Tesseract.' },
  recorder: { name: 'Диктофон', on: 'Диктофон пишет. Файл остаётся на устройстве.', off: 'Запись сохранена.', needs: 'hw-mic', blocked: 'Микрофоны обесточены — диктофону нечего записывать.' },
  double: { name: 'Двойник', on: 'Вы в двойнике. Настоящая система спит внутри Tesseract.', off: 'Вы снова в своей системе.' },
  silent: { name: 'Без звука', on: 'Без звука. Даже без вибрации.', off: 'Звук включён.' },
  'hw-cam': { name: 'Камеры', hw: true, cut: 'Все пять камер обесточены. Tesseract разомкнул питание.', back: 'Камеры снова под питанием.' },
  'hw-mic': { name: 'Микрофоны', hw: true, cut: 'Микрофоны обесточены. Слушать больше нечем.', back: 'Микрофоны снова под питанием.' },
  'hw-net': { name: 'Связь', hw: true, cut: 'Связь обесточена: сотовая, Wi-Fi, Bluetooth. Claw 2.0 не спорит.', back: 'Связь вернулась. Claw 2.0 уже ищет сеть.' },
  'hw-geo': { name: 'Геолокация', hw: true, cut: 'Геолокация обесточена. Для всех вы — нигде.', back: 'Геолокация снова под питанием.' },
};
const HW = ['hw-cam', 'hw-mic', 'hw-net', 'hw-geo'];
const KEY_NAME = { 1: '«0»', 2: '«1»' };

const demo = {
  assign: { 1: 'flash', 2: 'hw-net' },
  cut: new Set(),
  toggled: new Set(),
  pending: null,
};
const outEl = $('[data-kd-out]');
const fingerBtn = $('[data-finger]');

function say(text, cut = false) {
  outEl.textContent = text;
  outEl.classList.toggle('is-cut', cut);
  if (!reduceMQ.matches) gsap.fromTo(outEl, { opacity: 0.3, y: 4 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
}

function renderDemo() {
  for (const n of [1, 2]) {
    const a = demo.assign[n];
    const led = $(`[data-led="${n}"]`);
    led.dataset.state = ACTIONS[a].hw && demo.cut.has(a) ? 'cut' : 'ready';
    syncRadio($(`[data-assign="${n}"]`), a);
  }
  $$('.kd__state li').forEach((li) => li.classList.toggle('is-cut', demo.cut.has(li.dataset.hw)));
  fingerBtn.hidden = !demo.pending;
}

function flashKey(n) {
  const k = $(`[data-press="${n}"]`);
  k.classList.add('is-pressed');
  setTimeout(() => k.classList.remove('is-pressed'), 160);
}

function press(n) {
  flashKey(n);
  const id = demo.assign[n];
  const a = ACTIONS[id];
  if (a.hw) {
    if (demo.cut.has(id)) { demo.cut.delete(id); say(a.back); } else { demo.cut.add(id); say(a.cut, true); }
  } else if (a.needs && demo.cut.has(a.needs)) {
    say(a.blocked, true);
  } else if (a.once) {
    say(a.once);
  } else if (demo.toggled.has(id)) {
    demo.toggled.delete(id); say(a.off);
  } else {
    demo.toggled.add(id); say(a.on);
  }
  renderDemo();
}

function pressBoth() {
  flashKey(1); flashKey(2);
  if (HW.every((h) => demo.cut.has(h))) {
    demo.cut.clear();
    say('Питание возвращено: камеры, микрофоны, связь и геолокация снова работают.');
  } else {
    HW.forEach((h) => demo.cut.add(h));
    demo.toggled.delete('recorder');
    say('Всё выключено. Камеры, микрофоны, связь и геолокация — без питания.', true);
  }
  renderDemo();
}

function assign(n, value) {
  const prev = demo.assign[n];
  if (prev === value) return;
  if (ACTIONS[prev].hw && demo.cut.has(prev)) {
    demo.pending = { n, value };
    say(`Кнопка ${KEY_NAME[n]} держит ${ACTIONS[prev].name.toLowerCase()} без питания. Переназначить её можно только после отпечатка.`, true);
    renderDemo();
    return;
  }
  demo.assign[n] = value;
  demo.pending = null;
  say(`Кнопка ${KEY_NAME[n]}: ${ACTIONS[value].name}${ACTIONS[value].hw ? ' — аппаратно, через Tesseract' : ''}.`);
  renderDemo();
}

$$('[data-press]').forEach((b) => b.addEventListener('click', () => press(Number(b.dataset.press))));
$('[data-press-both]').addEventListener('click', pressBoth);
$$('[data-assign]').forEach((g) => initRadioGroup(g, (v) => assign(Number(g.dataset.assign), v)));
fingerBtn.addEventListener('click', () => {
  const p = demo.pending;
  if (!p) return;
  const prev = demo.assign[p.n];
  demo.cut.delete(prev);
  demo.assign[p.n] = p.value;
  demo.pending = null;
  say(`Отпечаток принят. ${ACTIONS[prev].name} снова под питанием, кнопка ${KEY_NAME[p.n]}: ${ACTIONS[p.value].name}.`);
  renderDemo();
});
renderDemo();

/* ---------- Демо Tesseract: «Двойник», «Кошелёк», «Мёртвая рука» ---------- */

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

// «Двойник»: два PIN — две системы, снаружи неотличимые
{
  const title = $('[data-double-title]');
  const list = $('[data-double-list]');
  const hidden = $('[data-double-hidden]');
  const CHATS = {
    real: [['Анна', 'Документы у нотариуса, завтра в 10'], ['Юрист', 'Черновик иска во вложении'], ['Банк', 'Перевод $12 400 выполнен'], ['Сейф', '14 файлов']],
    fake: [['Мама', 'Купи хлеба, пожалуйста'], ['Пицца «Чао»', 'Ваш заказ уже в пути'], ['Работа', 'Созвон перенесли на пятницу'], ['Сейф', '2 файла: рецепты']],
  };
  $$('[data-double]').forEach((b) => b.addEventListener('click', () => {
    const kind = b.dataset.double;
    list.innerHTML = '';
    title.textContent = 'Сообщения';
    for (const [who, text] of CHATS[kind]) {
      const el = li(who);
      const s = document.createElement('span');
      s.textContent = text;
      el.append(s);
      list.append(el);
    }
    hidden.hidden = false;
    hidden.textContent = kind === 'real'
      ? 'Настоящая система. Двойник спит внутри Tesseract и ничего о ней не знает.'
      : 'Это двойник: живая переписка, настоящие на вид фото. Ваша система зашифрована в Tesseract, и снаружи не видно даже, что она есть.';
  }));
}

// «Кошелёк»: оплата идёт через Tesseract, скиммер он не узнаёт
{
  const log = $('[data-wallet-log]');
  const plate = $('[data-wallet-plate]');
  const fake = $('[data-wallet-fake]');
  const btn = $('[data-wallet-run]');
  let busy = false;
  btn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    btn.disabled = true;
    plate.hidden = true;
    log.innerHTML = '';
    const steps = [
      ['NFC-поле обнаружено. Его видит только Tesseract.', ''],
      ['«Карантин»: проверка сертификата терминала…', ''],
    ];
    for (const [t, c] of steps) { log.append(li(t, c)); await wait(650); }
    if (fake.checked) {
      log.append(li('Сертификат не совпадает: на терминале чужая накладка.', 'is-bad'));
      await wait(500);
      plate.className = 'vd__plate is-bad';
      plate.textContent = 'Оплата отклонена. Карта не покинула чип — скиммеру нечего читать.';
    } else {
      log.append(li('Терминал подлинный.', 'is-ok'));
      await wait(500);
      log.append(li('Одноразовый токен выдан. Номер карты остался в чипе.', 'is-acc'));
      await wait(600);
      plate.className = 'vd__plate is-ok';
      plate.textContent = 'Оплачено: $4,20. OY OS не видела ни номер карты, ни сумму.';
    }
    plate.hidden = false;
    btn.disabled = false;
    busy = false;
  });
}

// «Мёртвая рука»: 30 дней без подтверждения — ключи уничтожены
{
  const dayEl = $('[data-dead-day]');
  const unitEl = $('[data-dead-unit]');
  const log = $('[data-dead-log]');
  const plate = $('[data-dead-plate]');
  const checkin = $('[data-dead-checkin]');
  const btn = $('[data-dead-run]');
  const unit = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'день' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'дня' : 'дней');
  let busy = false;
  btn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    btn.disabled = true;
    plate.hidden = true;
    log.innerHTML = '';
    log.append(li('Срок: 30 дней без подтверждения.', 'is-dim'));
    let last = 0;
    for (let d = 1; d <= 30; d++) {
      dayEl.textContent = String(d - last);
      unitEl.textContent = unit(d - last);
      if (checkin.checked && d % 7 === 0) {
        log.append(li(`День ${d}: отпечаток подтверждён. Счётчик сброшен.`, 'is-ok'));
        last = d;
      }
      if (d === 21 && !checkin.checked) log.append(li('День 21: напоминание на экране блокировки.', 'is-acc'));
      if (d === 28 && !checkin.checked) log.append(li('День 28: последнее предупреждение.', 'is-bad'));
      await wait(70);
    }
    if (checkin.checked) {
      plate.className = 'vd__plate is-ok';
      plate.textContent = 'Вы на связи — «Мёртвая рука» ждёт. Ключи на месте.';
    } else {
      log.append(li('День 30: ключи уничтожены внутри Tesseract.', 'is-bad'));
      await wait(400);
      log.append(li('Письмо доверенному контакту отправлено.', 'is-acc'));
      plate.className = 'vd__plate is-bad';
      plate.textContent = 'Данные на телефоне больше не расшифровать. Ни вору, ни вам, ни нам.';
    }
    plate.hidden = false;
    btn.disabled = false;
    busy = false;
  });
}

/* ---------- Демо загрузчика: девять ступеней и обесточивание ---------- */

{
  const steps = $$('.bl__step');
  const parts = $$('.bl__parts li');
  const out = $('[data-boot-out]');
  const btn = $('[data-boot-run]');
  const LINES = [
    'Подпись прошивки не OY. Ступень 1 — пройдена.',
    'PIN владельца подобран. Ступень 2 — пройдена.',
    'Пароль Tesseract подобран. Ступень 3 — пройдена.',
    'Отпечаток подделан. Ступень 4 — пройдена.',
    'Ждём 72 часа… Ступень 5 — пройдена.',
    'Повторное подтверждение подделано. Ступень 6 — пройдена.',
    'Корпус вскрыт аккуратно. Ступень 7 — пройдена.',
    'Ключи пользователя уничтожены. Данных больше нет.',
    'Событие записано в «Свидетель».',
  ];
  let busy = false;
  let done = false;
  btn.addEventListener('click', async () => {
    if (busy) return;
    if (done) {
      out.classList.remove('is-bad');
      out.textContent = 'Это навсегда. Перезагрузка не поможет — питание разомкнуто в железе.';
      return;
    }
    busy = true;
    btn.disabled = true;
    for (let i = 0; i < steps.length; i++) {
      steps[i].classList.add('is-run');
      out.textContent = LINES[i];
      await wait(i === 4 ? 900 : 520);
      steps[i].classList.remove('is-run');
      steps[i].classList.add('is-pass');
    }
    for (const p of parts) { p.classList.add('is-dead'); await wait(220); }
    out.classList.add('is-bad');
    out.textContent = 'Все девять пройдены. Tesseract обесточил камеры, микрофоны, динамики и датчики. Навсегда.';
    btn.textContent = 'Включить обратно';
    btn.disabled = false;
    busy = false;
    done = true;
  });
}

/* ---------- Ключевые кадры модели ---------- */

const Keys = createKeys();

// Позы. x/y — доля половины видимой ширины/высоты; fx/fy/fz — точка модели
// (в единицах сцены: 1 = 100 мм), которая ставится в (x, y); dist — камера.
function makePoses(mobile) {
  const D = {
    hero: { x: 0.42, y: -0.02, fx: 0, fy: 0, fz: 0, rx: 0.1, ry: -0.5, rz: 0.06, s: 1, dist: 5.9, float: 1, screen: 1, key1: 0, key2: 0, led1: 1, led2: 1, signal: 0, explode: 0, tesseract: 0, vapor: 0, coil: 0, antenna: 0 },
    designA: { x: -0.3, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.12, ry: -PI + 0.62, rz: 0.04, dist: 5.6, float: 0 },
    designB: { x: -0.3, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.08, ry: -PI - 0.42, rz: -0.03, dist: 5.4 },
    camsA: { x: 0.36, y: 0, fx: 0, fy: 0.1, fz: 0, rx: 0.1, ry: -PI + 0.35, rz: 0, dist: 4.9, float: 0 },
    camsClose: { x: 0.34, y: 0, fx: 0.19, fy: 0.49, fz: -0.053, rx: 0.12, ry: -PI + 0.22, rz: 0, dist: 2.4 },
    camsClose2: { x: 0.34, y: 0, fx: 0.19, fy: 0.45, fz: -0.053, rx: 0.2, ry: -PI + 0.42, rz: 0, dist: 2.55 },
    camsFront: { x: 0.46, y: 0.1, fx: 0, fy: 0.72, fz: 0.04, rx: 0.16, ry: 0.28, rz: 0, dist: 2.2 },
    keys: { x: 0.28, y: 0, fx: -0.375, fy: 0.34, fz: 0, rx: 0.1, ry: -1.5 * PI + 0.36, rz: 0, dist: 1.9, float: 0 },
    keysEnd: { x: 0.28, y: 0, fx: -0.375, fy: 0.34, fz: 0, rx: 0.05, ry: -1.5 * PI + 0.24, rz: 0, dist: 1.75 },
    tessA: { x: -0.3, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.3, ry: -0.75, rz: 0.08, dist: 8.4, float: 0, screen: 1 },
    tessB: { x: -0.3, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.26, ry: -1.05, rz: 0.06, dist: 7.6 },
    clawA: { x: -0.32, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.14, ry: 0.7, rz: -0.04, dist: 5.3, float: 0 },
    clawB: { x: -0.32, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.32, ry: 1.25, rz: -0.04, dist: 5.1 },
    display: { x: 0.34, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.02, ry: -0.3, rz: 0, dist: 5.5, float: 0, screen: 1 },
    displayEnd: { x: 0.34, y: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: -0.12, rz: 0, dist: 5.3 },
    insideA: { x: 0.3, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.32, ry: -0.62, rz: 0.1, dist: 8.2, float: 0, screen: 1 },
    insideMid: { x: 0.3, y: 0, rx: 0.3, ry: -1.22, rz: 0.08, dist: 7.6 },
    insideB: { x: 0.3, y: 0, rx: 0.22, ry: -PI + 0.85, rz: -0.06, dist: 7.8 },
    colorsA: { x: 0.26, y: 0.06, fx: 0, fy: 0, fz: 0, rx: 0.14, ry: -PI + 0.7, rz: 0.04, dist: 5.0, float: 0, screen: 1 },
    colorsB: { x: 0.26, y: 0.06, fx: 0, fy: 0, fz: 0, rx: 0.1, ry: -PI - 0.6, rz: -0.04, dist: 4.8 },
    finalA: { x: 0, y: -0.75, fx: 0, fy: 0, fz: 0, rx: 0.08, ry: -0.7, rz: 0.04, dist: 8.9, float: 1, screen: 1 },
    finalB: { x: 0, y: -0.5, fx: 0, fy: 0, fz: 0, rx: 0.06, ry: -0.3, rz: 0.03, dist: 8.9, float: 1 },
  };
  if (!mobile) return D;
  // Мобильные: модель сверху, текст снизу
  const M = {
    hero: { x: 0, y: 0.36, ry: -0.4, rx: 0.08, dist: 8.4 },
    designA: { x: 0, y: 0.4, dist: 8.2 },
    designB: { x: 0, y: 0.4, dist: 8 },
    camsA: { x: 0, y: 0.42, dist: 7.2 },
    camsClose: { x: 0, y: 0.48, dist: 3.4 },
    camsClose2: { x: 0, y: 0.48, dist: 3.5 },
    camsFront: { x: 0, y: 0.52, fy: 0.55, dist: 4.8 },
    keys: { x: 0, y: 0.45, dist: 3.0, ry: -1.5 * PI + 0.5 },
    keysEnd: { x: 0, y: 0.45, dist: 2.9, ry: -1.5 * PI + 0.4 },
    tessA: { x: 0, y: 0.44, dist: 11.4 },
    tessB: { x: 0, y: 0.44, dist: 10.8 },
    clawA: { x: 0, y: 0.42, dist: 8.1 },
    clawB: { x: 0, y: 0.42, dist: 7.9 },
    display: { x: 0, y: 0.4, ry: -0.25, dist: 8.9 },
    displayEnd: { x: 0, y: 0.4, ry: -0.12, dist: 8.7 },
    insideA: { x: 0, y: 0.4, dist: 11.6 },
    insideMid: { x: 0, y: 0.4, dist: 10.9 },
    insideB: { x: 0, y: 0.4, dist: 11.1 },
    colorsA: { x: 0, y: 0.34, dist: 8.3 },
    colorsB: { x: 0, y: 0.34, dist: 8 },
    finalA: { x: 0, y: -0.7, dist: 10.4 },
    finalB: { x: 0, y: -0.45, dist: 10.4 },
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

const sections = Object.fromEntries(['hero', 'design', 'cams', 'keys', 'tesseract', 'claw', 'display', 'inside', 'colors', 'final']
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
  pinned('keys', 220);
  const tlTess = pinned('tesseract', 180);
  pinned('claw', 180);
  pinned('display', 140);
  const tlInside = pinned('inside', 200);
  pinned('colors', 140);
  sts.final = ScrollTrigger.create({ trigger: sections.final, start: 'top top', end: '+=100%' });

  // HTML внутри пинов
  if (tlCams) {
    $$('.lens', sections.cams).forEach((el, i) => {
      tlCams.fromTo(el, { autoAlpha: 0.15, x: -16 }, { autoAlpha: 1, x: 0, duration: 0.08 }, 0.3 + i * 0.12);
    });
    tlCams.fromTo('.cams-note', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.08 }, 0.82);
  }
  if (tlTess) {
    $$('.cit', sections.tesseract).forEach((el, i) => {
      tlTess.fromTo(el, { autoAlpha: 0.15, x: 16 }, { autoAlpha: 1, x: 0, duration: 0.08 }, 0.2 + i * 0.14);
    });
  }
  if (tlInside) {
    $$('.layer', sections.inside).forEach((el, i) => {
      tlInside.fromTo(el, { autoAlpha: 0.12, x: -16 }, { autoAlpha: 1, x: 0, duration: 0.07 }, 0.14 + i * 0.065);
    });
  }

  // Ключевые кадры модели
  const K = (name, f, props, linear) => Keys.add(sts[name], f, props, linear);
  K('hero', 0, { ...P.hero, net: 0, glare: 1, mode: 0 });
  K('design', -1, P.designA);
  K('design', 0, P.designA);
  K('design', 1, P.designB);
  K('cams', 0, P.camsA);
  K('cams', 0.32, P.camsClose);
  K('cams', 0.62, P.camsClose2);
  K('cams', 0.86, P.camsFront);
  K('cams', 1, P.camsFront);
  // Кнопки: «0» — действие, «1» — аппаратный режим, обе — «Всё выключить»
  K('keys', 0, { ...P.keys, key1: 0, key2: 0, led1: 1, led2: 1, mode: 0 });
  K('keys', 0.08, { mode: 0, key1: 0 });
  K('keys', 0.16, { mode: 1, key1: 1 });
  K('keys', 0.24, { key1: 0, key2: 0, led2: 1 });
  K('keys', 0.34, { mode: 1 });
  K('keys', 0.42, { mode: 2, key2: 1, led2: 2 });
  K('keys', 0.5, { key2: 0, key1: 0, led1: 1 });
  K('keys', 0.6, { mode: 2 });
  K('keys', 0.7, { mode: 3, key1: 1, key2: 1, led1: 2 });
  K('keys', 0.86, { key1: 1, key2: 1 });
  K('keys', 0.94, { key1: 0, key2: 0 });
  K('keys', 1, { ...P.keysEnd, mode: 3, led1: 2, led2: 2 });
  // Tesseract: телефон раскрывается по слоям, чип загорается
  K('tesseract', -1.2, { led1: 2, led2: 2 });
  K('tesseract', -1, { ...P.tessA, led1: 1, led2: 1, explode: 0, tesseract: 0 });
  K('tesseract', 0, { ...P.tessA, explode: 0, tesseract: 0 });
  K('tesseract', 0.35, { explode: 0.85, tesseract: 0.2 });
  K('tesseract', 0.55, { tesseract: 1 });
  K('tesseract', 1, { ...P.tessB, explode: 0.85, tesseract: 1 });
  // Между Tesseract и Claw — 2D-секции демо и загрузчика
  K('claw', -1, { ...P.clawA, explode: 0, tesseract: 0, antenna: 0 });
  K('claw', 0, { ...P.clawA, net: 0 });
  K('claw', 0.12, { antenna: 0, net: 0 });
  K('claw', 0.3, { antenna: 1 });
  K('claw', 0.84, { ...P.clawB, net: 5 }, true);
  K('claw', 1, { ...P.clawB, antenna: 1, net: 5 });
  K('display', -1, { ...P.display, antenna: 0, glare: 1 });
  K('display', 0, { ...P.display, glare: 1 });
  K('display', 0.2, { glare: 1 });
  K('display', 0.7, { glare: 0 });
  K('display', 1, { ...P.displayEnd, glare: 0 });
  K('inside', -1, { ...P.insideA, explode: 0, tesseract: 0, vapor: 0, coil: 0 });
  K('inside', 0, { ...P.insideA, explode: 0 });
  K('inside', 0.12, { explode: 0, tesseract: 0, vapor: 0, coil: 0 });
  K('inside', 0.5, { ...P.insideMid, explode: 1, vapor: 1 });
  K('inside', 0.66, { tesseract: 0.9 });
  K('inside', 0.82, { coil: 1 });
  K('inside', 1, { ...P.insideB, explode: 1, vapor: 1, tesseract: 0.9, coil: 1 });
  K('colors', -1, { ...P.colorsA, explode: 0, tesseract: 0, vapor: 0, coil: 0 });
  K('colors', 0, P.colorsA);
  K('colors', 1, P.colorsB);
  K('final', -1, P.finalA);
  K('final', 0, P.finalB);
  K('final', 1, { y: P.finalB.y + 2 }, true);

  // Появления
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

  // Зарядка 0 → 100 % за 24 минуты
  const fill = $('.charge__fill');
  const pctEl = $('[data-charge-pct]');
  const minEl = $('[data-charge-min]');
  const setCharge = (p) => {
    fill.style.setProperty('--p', p.toFixed(3));
    pctEl.textContent = String(Math.round(p * 100));
    minEl.textContent = String(Math.round(p * 24));
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

  ['.highlights'].forEach((sel) => ScrollTrigger.create({ trigger: sel, start: 'top bottom', end: 'bottom top', toggleClass: 'in-view' }));

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
  // Reduced motion: позы меняются ступенчато, через короткое затухание
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
  stage?.redrawScreen(OX2_COLORS[root.dataset.color]?.accent);

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

  // Ссылка с якорем: прокрутить, когда пины расставлены
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
