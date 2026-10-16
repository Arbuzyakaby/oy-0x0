/* =========================================================================
   eXtream Y1 — страница-игра. Обычная прокрутка, сцены держит GSAP
   ScrollTrigger, поза модели — ключевые кадры по уровням (как на страницах
   OY, js/core/keys.js). Сверху — полоса уровня и XP, в углу — телеметрия,
   управление мышью, клавиатурой (W/S — уровни, Q/E — курки) и геймпадом.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage } from '../core/stage.js';
import { createKeys } from '../core/keys.js';
import { createExtreamY1 } from '../models/extreamy1.js';
import { PRODUCTS, getConfig } from '../data/products.js';
import { $, $$, clamp01, store, syncRadio, initRadioGroup } from '../core/ui.js';
import { createSmoothScroll } from '../core/scroll.js';
import { initMenu, createToast, createAchievements, createHud, createGamepad, getCurrency, setCurrency } from './extream-kit.js';
import { initStress, initHz, initReaction, initWave, initRace, initTree } from './y1-demos.js';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const root = document.documentElement;
const PI = Math.PI;
const PRODUCT = PRODUCTS.y1;
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const params = new URLSearchParams(location.search);

initMenu();
const toast = createToast($('[data-toast]'));
const xpEl = $('[data-xp]');
const ach = createAchievements($('[data-ach]'), { onChange: (xp) => { if (xpEl) xpEl.textContent = `${xp} XP`; } });
const hud = createHud();

/* ---------- 3D ---------- */

const canvas = $('#stage');
let stage = null;
try {
  stage = createStage(canvas, createExtreamY1, { forceFallback: params.has('fallback') });
} catch (err) {
  console.warn('[eXtream] WebGL недоступен, 3D отключено.', err);
  canvas.style.display = 'none';
}

/* ---------- Уровни ---------- */

const LEVELS = ['start', 'power', 'blizzard', 'stress', 'fans', 'screen', 'triggers', 'sound', 'charge', 'erbium', 'exos', 'cameras', 'skins', 'buy'];
const sections = Object.fromEntries(LEVELS.map((id) => [id, document.getElementById(id)]));
const levelNo = (id) => Math.min(13, LEVELS.indexOf(id) + 1);
const lvlN = $('[data-level-n]');
const lvlName = $('[data-level-name]');
const lvlBar = $('[data-level-bar]');
let current = 'start';

function detectLevel() {
  const line = window.innerHeight * 0.45;
  let id = LEVELS[0];
  for (const l of LEVELS) if (sections[l].getBoundingClientRect().top <= line) id = l;
  if (id !== current) {
    current = id;
    lvlN.textContent = String(levelNo(id)).padStart(2, '0');
    lvlName.textContent = sections[id].dataset.level;
    onLevel(id);
  }
  const max = document.documentElement.scrollHeight - window.innerHeight;
  lvlBar.style.setProperty('--p', max > 0 ? (window.scrollY / max).toFixed(4) : '0');
}

function goLevel(dir) {
  const i = LEVELS.indexOf(current);
  let n = i + dir;
  // «Скины» и «Снаряжение» — один уровень, но два экрана
  n = Math.max(0, Math.min(LEVELS.length - 1, n));
  const target = sections[LEVELS[n]];
  if (smooth.lenis) smooth.lenis.scrollTo(target, { duration: 1 });
  else target.scrollIntoView({ behavior: reduceMQ.matches ? 'auto' : 'smooth' });
}

// Экран модели и обороты по уровням
const SCREEN = { start: 'lock', power: 'arena', blizzard: 'arena', fans: 'game', screen: 'game', triggers: 'lock', cameras: 'lock', skins: 'lock' };
function onLevel(id) {
  if (id !== 'start') ach.unlock('start', 'Нажал старт');
  if (id === 'buy') ach.unlock('end', 'Финальный уровень');
  updateScreen();
}
function updateScreen() {
  let mode = SCREEN[current] || 'lock';
  if (current === 'triggers' && rubilnik) mode = 'arena';
  stage?.setScreen(mode, { udc: current === 'screen' ? 1 : 0 });
}

/* ---------- Позы модели ---------- */

// x/y — доля половины видимой ширины/высоты; fx/fy/fz — точка модели, которая ставится в (x, y)
const BASE = { x: 0, y: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: 0, rz: 0, dist: 5.2, float: 1, explode: 0, vis: 1, fan: 0.5, heat: 35 };
function makePoses(mobile) {
  const P = {
    start: { x: 0.4, rx: 0.12, ry: PI - 0.55, rz: 0.06, dist: 5.0, fan: 0.55, heat: 34 },
    power: { x: -0.4, rx: 0.08, ry: 0.5, rz: -0.04, dist: 5.2, float: 0.6, fan: 0.7, heat: 38 },
    blizzardA: { x: 0.36, rx: 0.3, ry: PI - 0.7, rz: 0.04, dist: 6.6, float: 0, explode: 0, fan: 0.85, heat: 36 },
    blizzardB: { x: 0.34, fz: -0.035, rx: 0.36, ry: PI - 1.32, rz: 0.02, dist: 8.2, float: 0, explode: 1, fan: 0.85, heat: 36 },
    hidden: { x: 0.4, rx: 0.1, ry: PI - 0.4, dist: 6, float: 0, vis: 0, fan: 0.4 },
    fans: { x: 0.44, fy: 0.24, fz: -0.04, rx: 0.16, ry: PI - 0.32, dist: 3.6, float: 0.3, fan: 0.64, heat: 37 },
    screen: { x: -0.38, rx: 0.06, ry: 0.42, rz: 0.03, dist: 5.0, fan: 0.6, heat: 37 },
    // горизонтальный хват: грань с курками наверху, наклон к зрителю
    triggers: { x: 0.5, rx: 0.62, ry: 0.22, rz: PI / 2, dist: 6.8, float: 0.3, fan: 0.6, heat: 38 },
    cameras: { x: -0.44, fy: 0.5, fz: -0.04, rx: 0.14, ry: PI + 0.24, dist: 3.4, float: 0.3, fan: 0.3, heat: 34 },
    skins: { x: 0.36, rx: 0.1, ry: PI - 0.6, rz: 0.04, dist: 5.0, fan: 0.5, heat: 34 },
  };
  for (const k in P) P[k] = { ...BASE, ...P[k] };
  if (!mobile) return P;
  // телефон: модель в верхней части экрана, текст ниже
  for (const k in P) {
    const p = P[k];
    P[k] = { ...p, x: 0, y: 0.4, dist: p.dist * (p.dist < 3 ? 1.6 : 1.75) };
  }
  return P;
}

const Keys = createKeys();
const sts = {};
let reducedMode = reduceMQ.matches;
const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ });

function buildChoreography({ isMobile, reduce }) {
  reducedMode = reduce;
  stage?.setReduced(reduce);
  if (reduce) smooth.disable(); else smooth.enable();
  Keys.reset();
  const P = makePoses(isMobile);

  for (const id of LEVELS) {
    if (id === 'blizzard' && !reduce) {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: sections.blizzard, start: 'top top', end: '+=180%', pin: true, scrub: true, anticipatePin: 1 },
      });
      tl.set({}, {}, 1);
      sts.blizzard = tl.scrollTrigger;
    } else {
      sts[id] = ScrollTrigger.create({ trigger: sections[id], start: 'top top', end: 'bottom top' });
    }
  }

  const K = (id, f, props) => Keys.add(sts[id], f, props);
  const hold = (id, pose) => { K(id, -0.4, pose); K(id, 0.55, pose); };
  hold('start', P.start);
  K('start', -1, P.start);
  hold('power', P.power);
  K('blizzard', -0.4, P.blizzardA);
  K('blizzard', 0.1, P.blizzardA);
  K('blizzard', 0.85, P.blizzardB);
  K('blizzard', 1, P.blizzardB);
  hold('stress', P.hidden);
  hold('fans', P.fans);
  hold('screen', P.screen);
  hold('triggers', P.triggers);
  for (const id of ['sound', 'charge', 'erbium', 'exos']) hold(id, P.hidden);
  hold('cameras', P.cameras);
  hold('skins', P.skins);
  K('buy', -0.2, P.hidden);
  K('buy', 1, P.hidden);

  // Слои «Вьюги» загораются по мере разлёта
  const layers = $$('[data-layers] li');
  ScrollTrigger.create({
    trigger: sections.blizzard, start: 'top top', end: reduce ? 'bottom top' : '+=180%',
    onUpdate: (st) => {
      layers.forEach((li) => li.classList.toggle('is-on', st.progress >= Number(li.dataset.at)));
      if (st.progress > 0.9) ach.unlock('blizzard', 'Три слоя холода');
    },
  });

  // Зарядка 0 → 100 % по прокрутке
  const chargeEl = $('.charge');
  const setCharge = (p) => {
    chargeCells.forEach((c, i) => c.classList.toggle('on', i < Math.round(p * 20)));
    $('[data-charge-pct]').textContent = String(Math.round(p * 100));
    $('[data-charge-min]').textContent = String(Math.round(p * 22));
  };
  if (reduce) setCharge(1);
  else ScrollTrigger.create({ trigger: chargeEl, start: 'top 85%', end: 'bottom 45%', scrub: true, onUpdate: (st) => setCharge(st.progress) });

  // Счётчик «5,1 млн»
  const cnt = $('[data-count]');
  if (cnt) {
    const to = Number(cnt.dataset.count);
    if (reduce) cnt.textContent = to.toLocaleString('ru-RU', { minimumFractionDigits: 1 });
    else {
      const o = { v: 0 };
      gsap.to(o, {
        v: to, duration: 1.4, ease: 'power3.out',
        scrollTrigger: { trigger: cnt, start: 'top 85%', once: true },
        onUpdate: () => { cnt.textContent = o.v.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); },
      });
    }
  }

  // Появление текста уровней — короткий сдвиг, без размытия
  if (!reduce) {
    $$('.lvl__text, .lvl--wide .x-wrap > *').forEach((el) => {
      gsap.fromTo(el, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' } });
    });
  }

  ScrollTrigger.refresh();
  return () => Keys.reset();
}
ScrollTrigger.addEventListener('refresh', () => { Keys.compile(window.innerHeight); detectLevel(); });

/* ---------- Полоски «статов» ---------- */

$$('.x-bars__track').forEach((t) => {
  const v = Number(t.dataset.v || 0);
  t.innerHTML = Array.from({ length: 10 }, (_, i) => `<i class="${i < v ? (t.hasAttribute('data-bad') ? 'on bad' : 'on') : ''}"></i>`).join('');
});
const chargeCells = (() => {
  const bar = $('[data-charge-bar]');
  bar.innerHTML = '<i></i>'.repeat(20);
  return $$('i', bar);
})();

/* ---------- Вентиляторы: режимы, звук, продувка ---------- */

const FAN_MODES = {
  off: { rpm: 0, db: 0, like: 'тишина — но частота упадёт', heat: 44 },
  quiet: { rpm: 9000, db: 24, like: 'тише тиканья часов', heat: 39 },
  auto: { rpm: 14000, db: 30, like: 'как шёпот в метре', heat: 37 },
  storm: { rpm: 22000, db: 36, like: 'как тихий разговор', heat: 34 },
};
let fanMode = 'auto';
let fanDir = 1;
const fanGroup = $('[data-fan-mode]');
function setFanMode(v) {
  fanMode = v;
  syncRadio(fanGroup, v);
  const m = FAN_MODES[v];
  $('[data-fan-rpm]').textContent = m.rpm.toLocaleString('ru-RU');
  $('[data-fan-db]').innerHTML = m.db ? `${m.db}<small>дБ</small>` : '0<small>дБ</small>';
  $('[data-fan-like]').textContent = m.like;
  if (v === 'storm') ach.unlock('storm', '«Буря»: 22 000 об/мин');
  updateSound();
}
initRadioGroup(fanGroup, setFanMode);

$('[data-fan-purge]').addEventListener('click', (e) => {
  fanDir = -1;
  e.currentTarget.disabled = true;
  toast('«Продувка»: 10 секунд в обратную сторону. Здесь — три.');
  setTimeout(() => { fanDir = 1; e.currentTarget.disabled = false; }, 3000);
});

// Звук вентиляторов: шум через полосовой фильтр; по умолчанию выключен
let audio = null;
const soundBtn = $('[data-fan-sound]');
function updateSound() {
  if (!audio) return;
  const on = soundBtn.getAttribute('aria-pressed') === 'true' && current === 'fans';
  const rpm = FAN_MODES[fanMode].rpm;
  const t = audio.ctx.currentTime;
  audio.gain.gain.setTargetAtTime(on ? (rpm / 22000) * 0.18 : 0, t, 0.25);
  audio.filter.frequency.setTargetAtTime(300 + rpm * 0.09, t, 0.3);
}
soundBtn.addEventListener('click', () => {
  const on = soundBtn.getAttribute('aria-pressed') !== 'true';
  soundBtn.setAttribute('aria-pressed', String(on));
  soundBtn.textContent = `Звук: ${on ? 'вкл' : 'выкл'}`;
  if (on && !audio) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass'; filter.Q.value = 0.8;
      const gain = ctx.createGain(); gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start();
      audio = { ctx, filter, gain };
    } catch { toast('Звук недоступен в этом браузере.'); }
  }
  audio?.ctx.resume?.();
  updateSound();
});

/* ---------- Курки и «Рубильник» ---------- */

const trig = [0, 0];          // 0..1 для модели
const pads = $$('[data-trig]');
const holdTimers = [0, 0];
let padTrig = [0, 0];   // аналоговые LT/RT геймпада
// Клавиатура/палец и геймпад — отдельно; курок нажат настолько, насколько сильнее из двух
const trigNow = (i) => Math.max(trig[i], padTrig[i]);
const bothFull = () => trigNow(0) >= 0.95 && trigNow(1) >= 0.95;
function refreshPad(i) {
  const v = trigNow(i);
  const d = v >= 0.95 ? '2' : v > 0.1 ? '1' : '0';
  if (pads[i].dataset.v !== d) pads[i].dataset.v = d;
  if (bothFull()) ach.unlock('trig', 'Двойной курок');
}
function setTrig(i, v) {
  trig[i] = v;
  refreshPad(i);
}
function pressTrig(i) {
  if (trig[i] > 0) return;
  setTrig(i, 0.5);
  navigator.vibrate?.(14);
  clearTimeout(holdTimers[i]);
  holdTimers[i] = setTimeout(() => { setTrig(i, 1); navigator.vibrate?.(28); }, 220);
}
function releaseTrig(i) {
  clearTimeout(holdTimers[i]);
  setTrig(i, 0);
}
pads.forEach((p, i) => {
  p.addEventListener('pointerdown', (e) => { p.setPointerCapture(e.pointerId); pressTrig(i); });
  p.addEventListener('pointerup', () => releaseTrig(i));
  p.addEventListener('pointercancel', () => releaseTrig(i));
  p.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); pressTrig(i); } });
  p.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') releaseTrig(i); });
});

let rubilnik = false;
const rubBtn = $('[data-rubilnik]');
const feed = $('[data-feed]');
const feedList = $('[data-feed-list]');
const toggles = [];
function setRubilnik(on) {
  rubilnik = on;
  rubBtn.setAttribute('aria-checked', String(on));
  feed.classList.toggle('is-quiet', on);
  if (on) ach.unlock('quiet', 'Мир затих');
  updateScreen();
  // Оба курка до упора и «Рубильник» туда-обратно дважды
  const now = performance.now();
  if (bothFull()) {
    toggles.push(now);
    while (toggles.length && now - toggles[0] > 4000) toggles.shift();
    if (toggles.length >= 4) { toggles.length = 0; blackout(); }
  } else toggles.length = 0;
}
rubBtn.addEventListener('click', () => setRubilnik(!rubilnik));

function blackout() {
  const el = $('[data-blackout]');
  el.hidden = false;
  setTimeout(() => {
    el.hidden = true;
    toast('Erbium: показалось.', 2600);
  }, 650);
}

const NOTES = [
  ['М', 'Мама', '«Ты поел?»', true],
  ['Ч', 'Чат «Рейд»', '14 новых сообщений'],
  ['О', 'Обновление', 'Скачивается 2,1 ГБ'],
  ['К', 'Курьер', 'Будет через 10 минут'],
  ['С', 'Соцсеть', 'Вас отметили на фото'],
  ['П', 'Подписка', 'Продлится завтра'],
  ['Н', 'Новости', 'Срочно: ничего не случилось'],
];
let noteI = 0;
setInterval(() => {
  if (current !== 'triggers' || document.hidden) return;
  const [ico, who, what, vip] = NOTES[noteI++ % NOTES.length];
  if (rubilnik && !vip) return;
  const li = document.createElement('li');
  if (vip) li.className = 'is-vip';
  li.innerHTML = `<i>${ico}</i><span><b></b> · <small></small></span><small>сейчас</small>`;
  li.querySelector('b').textContent = who;
  li.querySelector('span small').textContent = what;
  feedList.prepend(li);
  while (feedList.children.length > 6) feedList.lastChild.remove();
}, 900);

/* ---------- Питание ---------- */

const directBtn = $('[data-direct]');
directBtn.addEventListener('click', () => {
  const on = directBtn.getAttribute('aria-checked') !== 'true';
  directBtn.setAttribute('aria-checked', String(on));
  $('[data-flow-direct]').style.display = on ? '' : 'none';
  $('[data-flow-battery]').style.display = on ? 'none' : '';
  $('[data-battery-temp]').textContent = on ? '31 °C' : '41 °C';
  $('[data-battery-node]').classList.toggle('is-warm', !on);
});

/* ---------- Звук и отдача ---------- */

initWave($('[data-wave]'), $('[data-steps]'));
$('[data-haptic]').addEventListener('click', () => {
  if (navigator.vibrate?.([40, 30, 40, 30, 80])) toast('Отдача: левый мотор, правый мотор, оба.');
  else toast('Отдачу почувствует телефон — у этого устройства нет вибромотора.');
});

/* ---------- Демо ---------- */

let stressTemp = null;
const stress = initStress($('[data-thermo]'), {
  toast,
  onAchieve: (id, title) => ach.unlock(id, title),
  onTemp: (back) => { stressTemp = back; },
});
initHz($('[data-hz]'), $('[data-hz-rate]'));
initReaction($('[data-react]'), { onResult: (ms) => { if (ms < 250) ach.unlock('reflex', `Реакция: ${ms} мс`); } });
let racePing = 9;
initRace($('[data-race]'), { pingEl: $('[data-race-ping]'), lostEl: $('[data-race-lost]'), toggle: $('[data-dual]'), onPing: (p) => { racePing = p; } });
initTree($('[data-tree]'), { onAll: () => ach.unlock('tree', 'Все навыки eXOS 4') });

/* ---------- Цвет, память, валюта ---------- */

const colorGroups = $$('[data-color-switch]');
function setColor(name, { save = true, instant = false } = {}) {
  if (!PRODUCT.colors[name]) name = PRODUCT.defaultColor;
  root.dataset.color = name;
  colorGroups.forEach((g) => syncRadio(g, name));
  $('[data-cfg-color]').textContent = PRODUCT.colors[name];
  stage?.setBodyColor(name, instant);
  if (save) store.set('xtr-color', name);
}
colorGroups.forEach((g) => initRadioGroup(g, (v) => setColor(v)));
setColor(store.get('xtr-color') || PRODUCT.defaultColor, { save: false, instant: true });

let currency = getCurrency();
let mem = PRODUCT.configs[0].id;
const memGroup = $('[data-mem-switch]');
const curGroup = $('[data-currency]');
const SIGN = { usd: (c) => `$${c.usd}`, eur: (c) => `€${c.eur}`, cny: (c) => `¥${c.cny}` };
const WHERE = { usd: 'в США', eur: 'в Евросоюзе', cny: 'в Китае' };
const money = (c) => SIGN[currency](c);
function renderPrice() {
  const c = getConfig('y1', mem);
  const [ram, rom] = mem.split('/');
  $('[data-cfg-mem]').textContent = `${ram} ГБ · ${Number(rom) >= 1024 ? `${Number(rom) / 1024} ТБ` : `${rom} ГБ`}`;
  $('[data-price]').textContent = money(c);
  $('[data-price-alt]').textContent = Object.keys(SIGN).filter((k) => k !== currency).map((k) => `${SIGN[k](c)} ${WHERE[k]}`).join(' · ');
  $('[data-cn-note]').hidden = currency !== 'cny';
  $('[data-price-from]').textContent = `${money(PRODUCT.configs[0])}`;
  syncRadio(memGroup, mem);
  syncRadio(curGroup, currency);
}
initRadioGroup(memGroup, (v) => { mem = v; renderPrice(); });
initRadioGroup(curGroup, (v) => { currency = v; setCurrency(v); renderPrice(); });
renderPrice();
$('[data-buy]').addEventListener('click', () => {
  ach.unlock('buy', 'Снаряжение собрано');
  toast('Это концепт: Y1 не продаётся. Но достижение засчитано.');
});

/* ---------- Вращение модели перетаскиванием (скины) ---------- */

const spin = { v: 0, on: false };
{
  const sec = sections.skins;
  let drag = null;
  new IntersectionObserver(([e]) => { spin.on = e.isIntersecting; if (!spin.on) spin.v = 0; }, { threshold: 0.5 }).observe(sec);
  sec.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button, a')) return;
    drag = { x: e.clientX, v: spin.v, id: e.pointerId };
    sec.setPointerCapture(e.pointerId);
  });
  sec.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    spin.v = drag.v + ((e.clientX - drag.x) / window.innerWidth) * PI * 2.2;
  });
  const end = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
  sec.addEventListener('pointerup', end);
  sec.addEventListener('pointercancel', end);
}

/* ---------- Клавиатура и геймпад ---------- */

const KEY_TRIG = { KeyQ: 0, KeyE: 1 };
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest?.('input, textarea, select')) return;
  if (e.code in KEY_TRIG && !e.repeat) { pressTrig(KEY_TRIG[e.code]); return; }
  if (e.code === 'KeyS' && !e.repeat) { e.preventDefault(); goLevel(1); }
  if (e.code === 'KeyW' && !e.repeat) { e.preventDefault(); goLevel(-1); }
  if (e.code === 'Space' && current === 'stress' && !e.target.closest?.('button, a')) { e.preventDefault(); stress?.toggleRun(); }
});
document.addEventListener('keyup', (e) => { if (e.code in KEY_TRIG) releaseTrig(KEY_TRIG[e.code]); });

const padHint = $('[data-pad-hint]');
createGamepad({
  onConnect: (gp) => {
    padHint.textContent = 'геймпад: на месте';
    padHint.parentElement.classList.add('has-pad');
    ach.unlock('pad', 'Геймпад на месте');
    toast(`Геймпад: ${gp.id.split('(')[0].trim() || 'подключён'}. Крестовина — уровни, LT/RT — курки.`);
  },
  onButton: (i) => {
    if (i === 13) goLevel(1);
    if (i === 12) goLevel(-1);
    if (i === 0 && current === 'stress') stress?.toggleRun();
    if (i === 0 && current === 'triggers') setRubilnik(!rubilnik);
  },
  onTriggers: (lt, rt) => {
    // аналоговые курки геймпада идут в модель как есть
    padTrig = [lt > 0.92 ? 1 : lt, rt > 0.92 ? 1 : rt];
    refreshPad(0);
    refreshPad(1);
  },
});

/* ---------- Каждый тик: прокрутка → состояние ---------- */

let lastY = -1;
let ping = 9;
function tick() {
  if (window.scrollY !== lastY) { lastY = window.scrollY; detectLevel(); }
  if (Keys.empty) return;
  const v = Keys.sample(window.scrollY, reducedMode);
  if (current === 'fans') v.fan = FAN_MODES[fanMode].rpm / 22000;
  v.fanDir = fanDir;
  v.spin = spin.on ? spin.v : 0;
  v.trigL = trigNow(0);
  v.trigR = trigNow(1);
  v.alarm = bothFull() ? 1 : 0;
  v.sw = rubilnik ? 1 : 0;
  const vis = clamp01(v.vis ?? 1);
  if (stage) {
    canvas.style.opacity = vis.toFixed(3);
    stage.setActive(vis > 0.02 && !document.hidden);
    stage.setTarget(v);
  }
  // телеметрия: обороты и температура — по сцене, пинг — от Claw G
  ping += ((current === 'erbium' ? racePing : 9 + Math.sin(performance.now() / 700)) - ping) * 0.1;
  const heat = current === 'stress' && stressTemp !== null ? stressTemp : current === 'fans' ? FAN_MODES[fanMode].heat : v.heat;
  hud.set({ temp: heat, rpm: (v.fan ?? 0) * 22000 * (current === 'stress' || vis < 0.05 ? 0.6 : 1), ping });
}
gsap.ticker.add(tick);
if (params.has('debug')) window.__xtr = { stage, Keys, ScrollTrigger, sts };

window.addEventListener('pointermove', (e) => {
  if (!stage || reducedMode || e.pointerType === 'touch') return;
  stage.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
}, { passive: true });
window.addEventListener('resize', () => stage?.resize());
document.addEventListener('visibilitychange', () => { if (document.hidden) audio?.ctx.suspend?.(); else audio?.ctx.resume?.(); });

/* ---------- Запуск: «компиляция шейдеров» ---------- */

const TIPS = [
  'Совет: «Рубильник» глушит всё, кроме тех, кого вы оставили в белом списке.',
  'Совет: Q и E — курки. Подержите, чтобы нажать до упора.',
  'Совет: макросов в eXOS 4 нет. Это чтобы вас не забанили.',
  'Совет: «Буря» — 36 дБ. Тише разговора.',
  'Совет: подключите геймпад — крестовина листает уровни.',
];
async function boot() {
  const pctEl = $('[data-boot-pct]');
  const bar = $('.x-boot__bar');
  const tipEl = $('[data-boot-tip]');
  let pct = 0;
  let tip = 0;
  const iv = setInterval(() => {
    pct = Math.min(96, pct + 3 + Math.random() * 9);
    pctEl.textContent = String(Math.round(pct));
    bar.style.setProperty('--p', (pct / 100).toFixed(2));
    if (Math.round(pct) % 4 === 0) tipEl.textContent = TIPS[++tip % TIPS.length];
  }, 120);
  const timeout = (ms) => new Promise((r) => setTimeout(r, ms));
  const fonts = document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve();
  await Promise.race([Promise.all([fonts, stage ? stage.ready : null, timeout(700)]), timeout(14000)]);
  stage?.redrawScreen();
  clearInterval(iv);
  pctEl.textContent = '100';
  bar.style.setProperty('--p', '1');

  const mm = gsap.matchMedia();
  mm.add({
    isMobile: '(max-width: 760px)', isDesktop: '(min-width: 761px)',
    reduce: '(prefers-reduced-motion: reduce)', motion: '(prefers-reduced-motion: no-preference)',
  }, (ctx) => buildChoreography(ctx.conditions));

  const el = $('#boot');
  el.classList.add('is-done');
  el.setAttribute('aria-hidden', 'true');
  updateScreen();
  window.addEventListener('load', () => ScrollTrigger.refresh());

  let hashTarget = null;
  try { hashTarget = location.hash.length > 1 ? document.querySelector(location.hash) : null; } catch { /* неверный якорь */ }
  if (hashTarget) {
    const go = () => {
      if (smooth.lenis) { smooth.lenis.resize(); smooth.lenis.scrollTo(hashTarget, { immediate: true, force: true }); }
      else hashTarget.scrollIntoView();
    };
    requestAnimationFrame(go);
  }
}
boot();
