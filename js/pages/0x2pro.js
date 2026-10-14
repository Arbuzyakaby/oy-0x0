/* =========================================================================
   OY 0X2 Pro — страница «Под пикселями». Не прокручивается вниз, а уходит
   вглубь: девять слоёв во весь экран. Колесо, свайп, клавиши и шкала
   глубины листают слои; текущий распадается на блоки CPix, они гаснут
   и уезжают влево под соседей, открывая следующий. Внутри длинного слоя
   («Купить» с характеристиками) прокрутка обычная. Любой блок фона можно
   потянуть рукой влево — под ним что-нибудь да найдётся.
   Без JS и при сбое модуля — обычная длинная страница.
   ========================================================================= */

import { gsap } from 'gsap';
import { createStage } from '../core/stage.js';
import { createOY0X2Pro } from '../models/oy0x2pro.js';
import { createCPix, makeClumps } from '../core/cpix.js';
import { parisSVG, xsecSVG, xsecSet } from './0x2pro-scenes.js';
import { PRODUCTS, getConfig } from '../data/products.js';
import { $, $$, clamp01, store, createToast, syncRadio, initRadioGroup, bindStubs } from '../core/ui.js';

const root = document.documentElement;
const PI = Math.PI;
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const mobileMQ = window.matchMedia('(max-width: 760px)');
const params = new URLSearchParams(location.search);
const toast = createToast($('#toast'), gsap);
const cpix = createCPix({ gsap });
const PRODUCT = PRODUCTS['0x2pro'];

/* ---------- Слои ---------- */

const depthEl = $('[data-depth]');
const layers = $$('[data-layer]', depthEl);
const ids = layers.map((l) => l.id);
const N = layers.length;
let cur = 0;
let busy = false;
root.classList.add('is-depth');

/* ---------- 3D ---------- */

const canvas = $('#stage');
let stage = null;
try {
  stage = createStage(canvas, createOY0X2Pro, { forceFallback: params.has('fallback') });
} catch (err) {
  console.warn('[OY 0X2 Pro] WebGL недоступен, 3D отключено.', err);
  canvas.style.display = 'none';
  root.classList.add('no-3d');
}

// Состояние модели, которое меняют демо (позы — отдельно, по слою)
const fx = { cpix1: 0, cpix2: 0, zoom: 0.18, signal: 0, peri: 0 };

const OFF = { y: 2.4 };
const POSES_DESKTOP = {
  pixel: { x: 0.56, y: -0.02, fx: -0.03, fy: 0.5, rx: 0.06, ry: -0.22, rz: 0.02, dist: 3.1 },
  cpix: { x: 0.5, y: 0.02, fx: -0.056, fy: 0.757, fz: 0.04, rx: 0.3, ry: -0.38, rz: 0, dist: 1.5, float: 0.3 },
  puck: { x: 0.46, y: -0.04, fy: 0.55, rx: 0.6, ry: PI - 0.4, rz: 0.04, dist: 3.4 },
  zoom: OFF,
  citadel: { x: 0.56, y: -0.02, rx: 0.5, ry: -0.8, rz: 0.1, dist: 6.6, explode: 1, citadel: 1, vapor: 0.6, coil: 0.5 },
  claw: { x: 0.6, y: 0, rx: 0.16, ry: -1.32, rz: 0.04, dist: 5.6, antenna: 1 },
  europe: OFF,
  colors: { x: 0.44, y: -0.02, rx: 0.12, ry: PI - 0.5, rz: 0.05, dist: 5.0 },
  buy: OFF,
};
const POSES_MOBILE = {
  // на телефоне корпус не должен заходить на текст снизу: либо целиком в верхней половине,
  // либо перевёрнут — тогда крупный план камеры, а сам телефон уходит вверх за край
  pixel: { x: 0, y: 0.5, rx: 0.06, ry: -0.18, dist: 9.6 },
  cpix: { x: 0, y: 0.42, fx: -0.056, fy: 0.757, fz: 0.04, rx: -0.4, ry: 0.4, rz: PI, dist: 1.25, float: 0.3 },
  puck: { x: 0, y: 0.52, fy: 0, rx: 0.5, ry: PI - 0.4, dist: 8.2 },
  zoom: OFF,
  citadel: { x: 0, y: 0.55, rx: 0.5, ry: -0.8, rz: 0.1, dist: 10, explode: 1, citadel: 1, vapor: 0.6, coil: 0.5 },
  claw: OFF,
  europe: OFF,
  colors: { x: 0, y: 0.52, rx: 0.12, ry: PI - 0.5, dist: 8.2 },
  buy: OFF,
};
const BASE = { x: 0, y: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: 0, rz: 0, s: 1, dist: 5.4, float: 1, explode: 0, citadel: 0, vapor: 0, coil: 0, antenna: 0 };

function tick() {
  if (!stage) return;
  const P = mobileMQ.matches ? POSES_MOBILE : POSES_DESKTOP;
  const v = { ...BASE, ...P[ids[cur]], ...fx };
  stage.setTarget(v);
}
gsap.ticker.add(tick);

if (stage) {
  const update = () => stage.setActive(!document.hidden);
  document.addEventListener('visibilitychange', update);
  window.addEventListener('resize', () => stage.resize());
  window.addEventListener('pointermove', (e) => {
    if (reduceMQ.matches || e.pointerType === 'touch') return;
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    stage.setPointer(nx * 0.4, ny * 0.4);
    stage.setPupil(nx, ny);
  }, { passive: true });
}

/* ---------- Фронталка на первом слое и «Веко» ---------- */

const veko = $('[data-veko]');
const vekoText = $('[data-veko-text]');
const frontBtn = $('[data-front-toggle]');
let frontUp = false;
function setFront(up, { quiet = false } = {}) {
  frontUp = up;
  gsap.to(fx, { cpix1: up ? 1 : 0, duration: reduceMQ.matches ? 0.01 : up ? 1.3 : 0.9, ease: 'power2.inOut', overwrite: 'auto' });
  veko.classList.toggle('is-up', up);
  vekoText.textContent = up ? 'Камера поднялась — значит, работает. Иначе не бывает' : 'Камера спрятана и обесточена';
  frontBtn.setAttribute('aria-pressed', String(up));
  frontBtn.textContent = up ? 'Спрятать камеру' : 'Поднять камеру';
  if (!quiet) toast(up ? 'Блок CPix ушёл под соседние пиксели, камера поднялась.' : 'Камера опустилась в колодец, блок вернулся. Экран снова цельный.');
}
frontBtn.addEventListener('click', () => setFront(!frontUp));

/* ---------- 2. Разрез CPix ---------- */

const xsvg = $('[data-xsec-svg]');
xsvg.innerHTML = xsecSVG();
const xRange = $('[data-xsec-range]');
const xCap = $('[data-xsec-cap]');
const stageEls = $$('.stages li');
const X_CAPS = [
  'Пиксели на месте. Камера в колодце, обесточена.',
  'Блок CPix гаснет: его пиксели больше ничего не показывают.',
  'Блок уходит вниз и влево — под соседние пиксели.',
  'Окно свободно: камера поднимается вровень с экраном, под цельное стекло.',
];
let xStep = -1;
function setX(p) {
  const step = xsecSet(xsvg, p);
  if (step !== xStep) {
    xStep = step;
    xCap.textContent = X_CAPS[step];
    stageEls.forEach((li, i) => li.classList.toggle('is-on', i <= step));
  }
  xRange.setAttribute('aria-valuetext', X_CAPS[step]);
  if (ids[cur] === 'cpix') fx.cpix1 = p;
}
xRange.addEventListener('input', () => setX(xRange.value / 100));
setX(0);

/* ---------- 3. Баланс ---------- */

$$('[data-wobble]').forEach((b) => b.addEventListener('click', () => {
  const phone = $('.balance__phone', b);
  const corner = b.dataset.wobble === 'corner';
  gsap.killTweensOf(phone);
  if (reduceMQ.matches) { toast(corner ? 'Остров в углу: телефон качается на столе.' : 'Шайба по центру: телефон лежит ровно.'); return; }
  if (corner) {
    gsap.fromTo(phone, { rotation: 0 }, { keyframes: [{ rotation: -6, duration: 0.12 }, { rotation: 4.5, duration: 0.2 }, { rotation: -3, duration: 0.2 }, { rotation: 1.6, duration: 0.2 }, { rotation: -0.6, duration: 0.18 }, { rotation: 0, duration: 0.2 }], svgOrigin: '161 53' });
  } else {
    gsap.fromTo(phone, { y: 0 }, { keyframes: [{ y: 1.2, duration: 0.08 }, { y: 0, duration: 0.3, ease: 'power2.out' }] });
  }
}));

/* ---------- 4. Видоискатель 0,5–14× ---------- */

const scene = $('[data-finder-scene]');
scene.innerHTML = parisSVG();
const zRange = $('[data-zoom-range]');
const zX = $('[data-finder-x]');
const zLens = $('[data-finder-lens]');
const peri = $('[data-finder-peri]');
const periLens = $('[data-peri-lens]');
const lensRows = $$('[data-lens]');
const presets = $$('[data-zoom]');
const fmtZ = (z) => `${(z < 10 ? Math.round(z * 10) / 10 : Math.round(z)).toString().replace('.', ',')}×`;
const toZ = (t) => 0.5 * 28 ** t;
const toT = (z) => Math.log(z / 0.5) / Math.log(28);
const LENS = [
  { id: 'uw', max: 1, label: 'Сверхширокая · 50 МП · 122°' },
  { id: 'main', max: 3, label: 'Основная · сенсор 1"' },
  { id: 'tele', max: 6, label: 'Телевик · сенсор 1" · 3×' },
  { id: 'peri', max: 99, label: 'Перископ · 200 МП · плавающая линза' },
];
let lensNow = '';
function setZoom(z, { tween = false } = {}) {
  z = Math.max(0.5, Math.min(14, z));
  const t = toT(z);
  zRange.value = String(Math.round(t * 1000));
  zRange.setAttribute('aria-valuetext', fmtZ(z));
  zX.textContent = fmtZ(z);
  const lens = LENS.find((l) => z < l.max - 1e-6) || LENS[3];
  if (lens.id !== lensNow) {
    lensNow = lens.id;
    zLens.textContent = lens.label;
    lensRows.forEach((r) => r.classList.toggle('is-on', r.dataset.lens === lens.id));
    if (!reduceMQ.matches && tween === false) gsap.fromTo(scene, { filter: 'brightness(1.6) blur(2px)' }, { filter: 'brightness(1) blur(0px)', duration: 0.35 });
  }
  peri.classList.toggle('is-on', z >= 6);
  periLens.setAttribute('transform', `translate(${(z >= 6 ? (z - 6) / 8 : 0) * 40} 0)`);
  presets.forEach((b) => b.classList.toggle('is-on', Math.abs(Number(b.dataset.zoom) - z) < 0.05));
  gsap.to(scene, { scale: z / 0.5, duration: tween && !reduceMQ.matches ? 0.9 : 0.25, ease: 'power3.out', overwrite: 'auto' });
  fx.zoom = t;
  fx.peri = z >= 6 ? 1 : 0;
}
zRange.addEventListener('input', () => setZoom(toZ(zRange.value / 1000)));
presets.forEach((b) => b.addEventListener('click', () => {
  const from = toZ(zRange.value / 1000);
  const o = { z: from };
  gsap.to(o, { z: Number(b.dataset.zoom), duration: reduceMQ.matches ? 0.01 : 1, ease: 'power2.inOut', onUpdate: () => setZoom(o.z, { tween: true }) });
}));
setZoom(1);

/* ---------- 5. Citadel 4: вкладки и демо ---------- */

{
  const tabs = $$('[role="tab"]', $('[data-tabs]'));
  const select = (t, focus) => {
    tabs.forEach((x) => {
      const on = x === t;
      x.setAttribute('aria-selected', String(on));
      x.tabIndex = on ? 0 : -1;
      $(`#${x.getAttribute('aria-controls')}`).hidden = !on;
    });
    if (focus) t.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      select(tabs[(i + d + tabs.length) % tabs.length], true);
    });
  });
}
{
  const box = $('[data-curtain]');
  const sw = $('[data-curtain-switch]');
  const meta = $('[data-curtain-meta]');
  const set = (on) => {
    sw.setAttribute('aria-checked', String(on));
    box.classList.toggle('is-on', on);
    meta.textContent = on ? 'Фон: заменён · Лица на фоне: 1 убрано · GPS и модель: удалены' : 'Без «Занавеса» приложение получает всё: комнату, гостя за спиной и метаданные';
  };
  sw.addEventListener('click', () => set(sw.getAttribute('aria-checked') !== 'true'));
  set(true);
}
{
  const box = $('[data-catcher]');
  const log = $('[data-catcher-log]');
  const btn = $('[data-catcher-btn]');
  let timers = [];
  const line = (text, cls) => { const li = document.createElement('li'); li.textContent = text; if (cls) li.className = cls; log.append(li); };
  btn.addEventListener('click', () => {
    timers.forEach(clearTimeout); timers = [];
    const fake = !box.classList.contains('is-fake');
    box.classList.toggle('is-fake', fake);
    btn.textContent = fake ? 'Убрать вышку' : 'Подставить вышку';
    log.innerHTML = '';
    if (!fake) { line('Сеть: оператор · 5G · подпись вышки проверена', 'is-ok'); return; }
    const steps = [
      ['Рядом новая «вышка»: сигнал в 4 раза сильнее', ''],
      ['Требует перейти на 2G и не показывает подпись оператора', 'is-bad'],
      ['Citadel 4: подключение запрещено, место отмечено на карте', 'is-bad'],
      ['Остаёмся у оператора: 5G, подпись проверена', 'is-ok'],
    ];
    steps.forEach(([t, c], i) => timers.push(setTimeout(() => line(t, c), reduceMQ.matches ? 0 : 450 * (i + 1))));
  });
}
{
  const lid = $('[data-lid]');
  const log = $('[data-lid-log]');
  let busyLid = false;
  const now = () => new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const line = (text, bad) => {
    const li = document.createElement('li');
    if (bad) li.className = 'is-bad';
    li.innerHTML = `<time>${now()}</time> `;
    li.append(text);
    if (log.firstElementChild?.textContent.includes('пуст')) log.innerHTML = '';
    log.prepend(li);
    while (log.children.length > 5) log.lastElementChild.remove();
  };
  $$('[data-lid-ask]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.lidAsk === 'bg') { line('Фоновый процесс · запрещено: приложение не на экране, камера не поднималась', true); return; }
    if (busyLid) return;
    busyLid = true;
    lid.classList.add('is-up');
    line('Видеозвонок · блок CPix отъехал, камера поднята');
    setTimeout(() => {
      lid.classList.remove('is-up');
      line('Видеозвонок завершён · камера опущена и обесточена, окно закрыто');
      busyLid = false;
    }, reduceMQ.matches ? 1200 : 3600);
  }));
}

/* ---------- 6. Claw 3: «Эхо» ---------- */

{
  const arc = $('[data-echo-arc]');
  const dot = $('[data-echo-dot]');
  const status = $('[data-echo-status]');
  const btn = $('[data-echo-send]');
  btn.addEventListener('click', () => {
    const len = arc.getTotalLength();
    const o = { t: 0 };
    status.textContent = 'Отправка…';
    btn.disabled = true;
    gsap.set(dot, { opacity: 1 });
    gsap.to(o, {
      t: 1, duration: reduceMQ.matches ? 0.01 : 2.4, ease: 'none',
      onUpdate: () => { const p = arc.getPointAtLength(o.t * len); dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); },
      onComplete: () => {
        gsap.to(dot, { opacity: 0, duration: 0.4, delay: 0.3 });
        status.textContent = 'Доставлено за 2,4 с · 8 км · без вышек и спутника';
        btn.disabled = false;
      },
    });
  });
}

/* ---------- 7. Европа и валюта ---------- */

const EU = [['FR', 'Франция'], ['DE', 'Германия'], ['IT', 'Италия'], ['ES', 'Испания'], ['PT', 'Португалия'], ['NL', 'Нидерланды'], ['BE', 'Бельгия'], ['LU', 'Люксембург'], ['IE', 'Ирландия'], ['AT', 'Австрия'], ['DK', 'Дания'], ['SE', 'Швеция'], ['FI', 'Финляндия'], ['PL', 'Польша'], ['CZ', 'Чехия'], ['SK', 'Словакия'], ['SI', 'Словения'], ['HR', 'Хорватия'], ['HU', 'Венгрия'], ['RO', 'Румыния'], ['BG', 'Болгария'], ['GR', 'Греция'], ['CY', 'Кипр'], ['MT', 'Мальта'], ['EE', 'Эстония'], ['LV', 'Латвия'], ['LT', 'Литва']];
const euList = $('[data-eu]');
euList.innerHTML = EU.map(([c, n], i) => `<li class="${i === 0 ? 'is-home is-on' : ''}"><b>${c}</b>${n}</li>`).join('');
const euItems = $$('li', euList);
function lightEurope() {
  euItems.forEach((li, i) => { if (i) li.classList.remove('is-on'); });
  euItems.slice(1).forEach((li, i) => setTimeout(() => li.classList.add('is-on'), reduceMQ.matches ? 0 : 300 + i * 55));
}

const CUR_KEY = 'oy-0x2pro-currency';
let currency = store.get(CUR_KEY) === 'eur' ? 'eur' : 'usd';
const money = (usd, eur) => (currency === 'eur' ? `€${eur}` : `$${usd}`);
function applyCurrency() {
  $$('[data-currency]').forEach((g) => syncRadio(g, currency));
  $$('[data-price]').forEach((el) => { el.textContent = money(el.dataset.usd, el.dataset.eur); });
  const c0 = PRODUCT.configs[0];
  $$('[data-price-from]').forEach((el) => { el.textContent = money(c0.usd, c0.eur); });
  renderTotal(false);
}
$$('[data-currency]').forEach((g) => initRadioGroup(g, (v) => {
  currency = v;
  store.set(CUR_KEY, v);
  applyCurrency();
}));

/* ---------- 8. Цвета ---------- */

const COLOR_DESC = {
  sky: ['Парижское Небо.', 'Тёмно-синий, уходящий в серо-голубой, — как небо над цинковыми крышами в ноябре.'],
  peach: ['Персик.', 'Тёплый, почти съедобный. Кольцо шайбы — в тон, рамка — розовый титан.'],
  provence: ['Прованс.', 'Светло-фиолетовый, как лаванда под Валансолем в июле.'],
  maple: ['Канадский Клён.', 'В честь основателей OY — бывших спасателей из Канады. Тёмно-красный, как лист в октябре.'],
};
const COLOR_KEY = 'oy-0x2pro-color';
const wall = $('[data-swatchwall]');
const colorName = $('[data-color-name]');
const colorDesc = $('[data-color-desc]');
let color = PRODUCT.colors[store.get(COLOR_KEY)] ? store.get(COLOR_KEY) : PRODUCT.defaultColor;
function setColor(name, { instant = false } = {}) {
  if (!PRODUCT.colors[name]) return;
  const changed = name !== color;
  // волна CPix: старый цвет уходит блоками под соседей, под ним уже новый
  if (changed && !instant && !reduceMQ.matches && ids[cur] === 'colors') cpix.leave(wall, { host: layers[cur], freeze: true, seed: 7 });
  color = name;
  root.dataset.color = name;
  store.set(COLOR_KEY, name);
  $$('[data-color-switch]').forEach((g) => syncRadio(g, name));
  colorName.textContent = COLOR_DESC[name][0];
  colorDesc.textContent = COLOR_DESC[name][1];
  $('[data-cfg-color]').textContent = PRODUCT.colors[name];
  stage?.setBodyColor(name, instant);
}
$$('[data-color-switch]').forEach((g) => initRadioGroup(g, (v) => setColor(v)));

/* ---------- 9. Купить ---------- */

let cfgId = PRODUCT.configs[0].id;
const totalEl = $('[data-total]');
let shownTotal = '';
function renderTotal(animate = true) {
  const c = getConfig(PRODUCT.id, cfgId);
  const text = money(c.usd, c.eur);
  totalEl.setAttribute('aria-label', `Цена: ${text}`);
  if (text === shownTotal) return;
  const old = shownTotal;
  shownTotal = text;
  totalEl.innerHTML = [...text].map((ch, i) => `<span class="dg" aria-hidden="true"><span>${ch}</span></span>`).join('');
  if (!animate || !old || reduceMQ.matches) return;
  // цифры, которые поменялись, въезжают блоками справа
  $$('.dg > span', totalEl).forEach((s, i) => {
    if (old[i] === text[i]) return;
    gsap.fromTo(s, { xPercent: 110, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 0.45, delay: i * 0.04, ease: 'power3.out' });
  });
}
{
  const group = $('[data-mem-switch]');
  const name = $('[data-cfg-name]');
  initRadioGroup(group, (v) => {
    cfgId = v;
    syncRadio(group, v);
    name.textContent = `OY 0X2 Pro · ${v} ГБ`;
    renderTotal(true);
  });
  $('[data-price-table]').innerHTML = PRODUCT.configs
    .map((c) => `<tr><td>${c.id} ГБ</td><td>$${c.usd}</td><td>€${c.eur}</td></tr>`).join('');
}
bindStubs(toast);

/* ---------- Шкала глубины ---------- */

const gaugeList = $('[data-gauge-list]');
gaugeList.innerHTML = layers.map((l, i) => `<li><a href="#${l.id}" data-go="${i}"><span>${String(i + 1).padStart(2, '0')} · ${l.dataset.layer}</span><b class="sr-only">Слой ${i + 1}: ${l.dataset.layer}</b></a></li>`).join('');
const gaugeLinks = $$('a', gaugeList);
const gaugeNo = $('[data-gauge-no]');
const announce = $('[data-announce]');

function paint() {
  layers.forEach((l, i) => {
    const on = i === cur;
    l.classList.toggle('is-current', on);
    l.classList.remove('is-under');
    l.inert = !on;
    if (on) l.removeAttribute('aria-hidden'); else l.setAttribute('aria-hidden', 'true');
  });
  gaugeLinks.forEach((a, i) => {
    if (i === cur) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
    a.classList.toggle('is-past', i < cur);
  });
  gaugeNo.textContent = String(cur + 1);
  root.classList.toggle('is-deep', cur > 0);
  root.classList.toggle('on-buy', ids[cur] === 'buy');
}

/* ---------- Вход и выход из слоёв ---------- */

let heroOpened = false;
function onEnter(id) {
  if (id === 'pixel' && !heroOpened && !reduceMQ.matches) { heroOpened = true; setTimeout(() => { if (ids[cur] === 'pixel' && !frontUp) setFront(true, { quiet: true }); }, 900); }
  if (id === 'cpix') { gsap.to(fx, { cpix1: xRange.value / 100, duration: 0.6, overwrite: 'auto' }); }
  if (id === 'puck') gsap.to(fx, { signal: 0.55, duration: 0.8, delay: 0.4, overwrite: 'auto' });
  if (id === 'europe') lightEurope();
}
function onLeave(id, nextId) {
  if (id === 'puck') gsap.to(fx, { signal: 0, duration: 0.4, overwrite: 'auto' });
  if ((id === 'pixel' || id === 'cpix') && nextId !== 'pixel' && nextId !== 'cpix') {
    gsap.to(fx, { cpix1: 0, duration: 0.6, overwrite: 'auto' });
    if (frontUp) setFront(false, { quiet: true });
  }
  if (id === 'cpix' && nextId === 'pixel') gsap.to(fx, { cpix1: frontUp ? 1 : 0, duration: 0.6, overwrite: 'auto' });
}

async function go(to, { instant = false } = {}) {
  if (to < 0 || to >= N || to === cur || busy) return false;
  const from = cur;
  busy = true;
  onLeave(ids[from], ids[to]);
  cur = to;
  history.replaceState(null, '', to === 0 ? location.pathname + location.search : `#${ids[to]}`);
  announce.textContent = `Слой ${to + 1} из ${N}: ${layers[to].dataset.layer}`;
  layers[to].scrollTop = 0;
  if (instant || reduceMQ.matches) {
    paint();
    if (!instant) gsap.fromTo(layers[to], { opacity: 0 }, { opacity: 1, duration: 0.3, clearProps: 'opacity' });
  } else if (to > from) {
    const done = cpix.leave(layers[from]);
    paint();
    await done;
  } else {
    layers[to].classList.add('is-under');
    await cpix.enter(layers[to]);
    paint();
  }
  busy = false;
  onEnter(ids[to]);
  return true;
}
const step = (d) => go(cur + d);

/* ---------- Ввод: колесо, свайп, клавиши, ссылки ---------- */

function canScroll(dir) {
  const L = layers[cur];
  return dir > 0 ? L.scrollTop + L.clientHeight < L.scrollHeight - 2 : L.scrollTop > 2;
}

let acc = 0;
let lastWheel = 0;
let lockUntil = 0;
window.addEventListener('wheel', (e) => {
  if (e.ctrlKey) return;
  const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
  const dir = Math.sign(dy);
  if (!dir || canScroll(dir)) { acc = 0; return; }
  const now = performance.now();
  if (now - lastWheel > 220) acc = 0;
  lastWheel = now;
  if (busy || now < lockUntil) { lockUntil = Math.max(lockUntil, now + 160); acc = 0; return; }
  acc += dy;
  if (Math.abs(acc) > 46) {
    acc = 0;
    lockUntil = now + 1150;
    step(dir);
  }
}, { passive: true });

let touch = null;
window.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  touch = { x: t.clientX, y: t.clientY, up: canScroll(-1), down: canScroll(1) };
}, { passive: true });
window.addEventListener('touchend', (e) => {
  if (!touch || dragging) { touch = null; return; }
  const t = e.changedTouches[0];
  const dx = t.clientX - touch.x, dy = touch.y - t.clientY;
  const dir = Math.sign(dy);
  if (Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx) * 1.3) {
    // на длинном слое листаем дальше, только если уже упёрлись в край
    if ((dir > 0 && !touch.down && !canScroll(1)) || (dir < 0 && !touch.up && !canScroll(-1))) step(dir);
  }
  touch = null;
}, { passive: true });

window.addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const tag = e.target.closest?.('input, textarea, select, [role="tab"], [role="radio"], [role="switch"]');
  const next = ['PageDown', 'ArrowDown'].includes(e.key) || (e.key === ' ' && !e.target.closest?.('button, a'));
  const prev = ['PageUp', 'ArrowUp'].includes(e.key);
  if (tag && (e.key.startsWith('Arrow'))) return;
  if (next || prev) {
    const dir = next ? 1 : -1;
    if (canScroll(dir)) return;
    e.preventDefault();
    step(dir);
  } else if (e.key === 'Home' && !tag) { e.preventDefault(); go(0); }
  else if (e.key === 'End' && !tag) { e.preventDefault(); go(N - 1); }
});

// Ссылки на слои и на сноски в другом слое
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.hasAttribute('data-stub')) return;
  const id = a.getAttribute('href').slice(1);
  if (!id) return;
  const target = document.getElementById(id);
  if (!target) return;
  const i = layers.findIndex((l) => l === target || l.contains(target));
  if (i < 0) return;
  e.preventDefault();
  if (a.hasAttribute('data-to-top')) { layers[i].scrollTo({ top: 0, behavior: reduceMQ.matches ? 'auto' : 'smooth' }); return; }
  const reveal = () => { if (target !== layers[i]) target.scrollIntoView({ block: 'center', behavior: reduceMQ.matches ? 'auto' : 'smooth' }); };
  if (i === cur) reveal(); else go(i).then(reveal);
});

/* ---------- Блок под пальцем: тянуть фон влево ---------- */

const FACTS = [
  'Да, под этим пикселем <b>тоже есть пиксель</b>.',
  'Здесь пусто. Совсем как <b>трекеров</b> в OY OS.',
  'Мы проверили: под пикселями <b>нет рекламы</b>.',
  'Блоков CPix в телефоне — <b>два</b>. Здесь — больше.',
  'Пока камера спрятана, она смотрит <b>в изнанку экрана</b>.',
  'CPix знает только два слова: <b>«открыт»</b> и <b>«закрыт»</b>.',
  'Этот блок проехал дальше, чем настоящий: тот — <b>5,8 мм</b>.',
  'Под пикселями тихо. Даже <b>микрофон</b> не слышит.',
];
const NO_DRAG = 'a, button, input, label, select, textarea, [role], h1, h2, h3, p, li, dt, dd, table, figure, svg, .finder, .order, .claw__card, .tabs';
let dragging = null;
depthEl.addEventListener('pointerdown', (e) => {
  if (busy || dragging || e.button !== 0 || e.target.closest(NO_DRAG)) return;
  const L = layers[cur];
  if (!L.contains(e.target)) return;
  const start = { x: e.clientX, y: e.clientY, id: e.pointerId };
  let handle = null;
  let under = null;
  const move = (ev) => {
    if (ev.pointerId !== start.id) return;
    const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
    if (!handle) {
      if (dx > -10 || Math.abs(dx) < Math.abs(dy)) { if (Math.abs(dy) > 14) cleanup(); return; }
      const clumps = makeClumps(window.innerWidth, window.innerHeight);
      const k = clumps.find((c) => c.cells.some((q) => start.x >= q.x && start.x < q.x + q.w && start.y >= q.y && start.y < q.y + q.h));
      if (!k) return;
      dragging = true;
      under = document.createElement('div');
      under.className = 'under';
      under.setAttribute('aria-hidden', 'true');
      Object.assign(under.style, { left: `${k.minX}px`, top: `${k.minY}px`, width: `${k.maxX - k.minX}px`, height: `${k.maxY - k.minY}px` });
      under.innerHTML = `<p>${FACTS[clumps.indexOf(k) % FACTS.length]}</p>`;
      document.body.append(under);
      handle = cpix.grab(L, k);
    }
    handle.move(dx);
  };
  const cleanup = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
  };
  const up = async () => {
    cleanup();
    if (!handle) return;
    await new Promise((r) => setTimeout(r, 650));
    await handle.release();
    under?.remove();
    dragging = null;
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
});

/* ---------- Запуск ---------- */

function startLayer() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (!h) return 0;
  const m = h.match(/^layer-(\d+)$/);
  if (m) return Math.max(0, Math.min(N - 1, Number(m[1]) - 1));
  const el = document.getElementById(h);
  const i = el ? layers.findIndex((l) => l === el || l.contains(el)) : -1;
  return i < 0 ? 0 : i;
}

async function boot() {
  setColor(color, { instant: true });
  applyCurrency();
  renderTotal(false);
  cur = startLayer();
  paint();
  const target = location.hash.slice(1) && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target && !layers.includes(target)) requestAnimationFrame(() => target.scrollIntoView({ block: 'center' }));

  const timeout = (ms) => new Promise((r) => setTimeout(r, ms));
  const fonts = document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve();
  await Promise.race([Promise.all([fonts, stage ? stage.ready : null, timeout(400)]), timeout(12000)]);
  stage?.redrawScreen();
  tick();
  stage?.snap();

  const loader = $('#loader');
  loader.classList.add('is-done');
  loader.setAttribute('aria-hidden', 'true');

  if (cur === 0 && !reduceMQ.matches) {
    // сверхкрупный план субпикселей отъезжает до экрана телефона
    const px = $('[data-subpx]');
    gsap.fromTo(px, { opacity: 1, '--px': '64px' }, { '--px': '3px', opacity: 0, duration: 1.8, ease: 'power3.inOut' });
    gsap.from('.layer--pixel .layer__text > *', { y: 30, opacity: 0, stagger: 0.07, duration: 1, ease: 'expo.out', delay: 0.6 });
    gsap.from('.layer--pixel .site-header', { yPercent: -100, opacity: 0, duration: 1, ease: 'expo.out', delay: 0.9 });
  }
  onEnter(ids[cur]);
  if (params.has('debug')) window.__oy = { stage, fx, go, cur: () => cur, cpix, gsap };
}
boot();
