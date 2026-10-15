/* =========================================================================
   OY 0X Moth — страница «Сгиб». Окно браузера — разложенный Moth: посередине
   по горизонтали проходит петля. Колесо, свайп, клавиши и шкала угла
   листают главы: верхняя половина текущей главы опрокидывается по петле на
   нижнюю, как лист перекидного табло, и открывает следующую. Назад — снизу
   вверх. 3D-модель складывается в такт. Внутри длинной главы («Купить»)
   прокрутка обычная. Без JS и при сбое модуля — обычная длинная страница.
   ========================================================================= */

import { gsap } from 'gsap';
import { createStage } from '../core/stage.js';
import { createOYMoth, FOLDED_CENTER_Y } from '../models/oymoth.js';
import { PRODUCTS, getConfig } from '../data/products.js';
import { $, $$, clamp01, store, createToast, syncRadio, initRadioGroup, bindStubs } from '../core/ui.js';

const root = document.documentElement;
const PI = Math.PI;
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const mobileMQ = window.matchMedia('(max-width: 760px)');
const params = new URLSearchParams(location.search);
const toast = createToast($('#toast'), gsap);
const PRODUCT = PRODUCTS.moth;

/* ---------- Главы ---------- */

const foldEl = $('[data-fold]');
const chapters = $$('[data-chapter]', foldEl);
const ids = chapters.map((c) => c.id);
const N = chapters.length;
let cur = 0;
let busy = false;
root.classList.add('is-fold');

/* ---------- 3D ---------- */

const canvas = $('#stage');
let stage = null;
try {
  stage = createStage(canvas, createOYMoth, { forceFallback: params.has('fallback') });
} catch (err) {
  console.warn('[OY 0X Moth] WebGL недоступен, 3D отключено.', err);
  canvas.style.display = 'none';
  root.classList.add('no-3d');
}

// Состояние модели, которое меняют демо; поза — по главе
const fx = { fold: 0, pulse: 0, flash: 0, redFlash: 0, wing: 1 };
// fold главы: null — берётся из демо (fx.fold)
const FC = FOLDED_CENTER_Y * 10;      // центр сложенного Moth в единицах сцены
const OFF = { y: 2.6 };
const POSES_DESKTOP = {
  light: { x: 0.5, y: 0, rx: 0.12, ry: -0.55, rz: 0.06, dist: 5.6 },
  // сложенный Moth смотрит «Крылом» вперёд; петля — внизу, как его держат в руке
  wing: { x: 0.5, y: 0, fy: FC, rx: 0.08, ry: -0.35, rz: -0.04, dist: 3.3, float: 0.6 },
  cocoon: { x: 0.48, y: 0, rx: 0.32, ry: -1.15, rz: 0.04, dist: 5.4 },
  argon: OFF,
  claw: OFF,
  msc: OFF,
  cams: { x: 0.52, y: -0.02, fy: FC, rx: -0.05, ry: 0.36, rz: PI, dist: 3.7, float: 0.4 },
  // в «Цветах» Moth стоит разложенным, экраном к вам: видно, как меняются обои
  colors: { x: 0.45, y: 0, rx: 0.06, ry: -0.32, rz: 0.03, dist: 5.3, float: 0.5 },
  buy: OFF,
};
const POSES_MOBILE = {
  light: { x: 0, y: 0.42, rx: 0.08, ry: -0.4, dist: 8.8 },
  wing: { x: 0, y: 0.48, fy: FC, ry: -0.3, dist: 5.4 },
  cocoon: { x: 0, y: 0.44, rx: 0.3, ry: -1.1, dist: 8.2 },
  argon: OFF,
  claw: OFF,
  msc: OFF,
  cams: { x: 0, y: 0.5, fy: FC, ry: 0.25, rz: PI, dist: 5.6 },
  colors: { x: 0, y: 0.42, rx: 0.06, ry: -0.28, dist: 8.6, float: 0.5 },
  buy: OFF,
};
// Сложенность по главам
const FOLD = { light: null, wing: 1, cocoon: null, argon: 0, claw: 0, msc: 0, cams: 1, colors: 0, buy: 0 };
const BASE = { x: 0, y: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: 0, rz: 0, s: 1, dist: 5.4, float: 1 };
const lampPose = { on: false };

function tick() {
  if (!stage) return;
  const id = ids[cur];
  const P = mobileMQ.matches ? POSES_MOBILE : POSES_DESKTOP;
  const v = { ...BASE, ...P[id] };
  const f = FOLD[id] ?? fx.fold;
  v.fold = clamp01(f + fx.pulse * (f > 0.5 ? -0.35 : 0.35));
  // в главе о петле модель держится за центр, как бы её ни сложили
  if (id === 'cocoon' || id === 'light') v.fy = FC * clamp01(f) * 0.9;
  // складываясь, Moth переворачивается петлёй вниз — «Крыло» читается как надо
  if (id === 'light' || id === 'wing') v.rz += PI * smoothstep(v.fold);
  v.flash = fx.flash;
  v.redFlash = fx.redFlash;
  v.wing = fx.wing;
  stage.setTarget(v);
}
gsap.ticker.add(tick);

if (stage) {
  document.addEventListener('visibilitychange', () => stage.setActive(!document.hidden));
  window.addEventListener('resize', () => stage.resize());
  window.addEventListener('pointermove', (e) => {
    if (reduceMQ.matches || e.pointerType === 'touch' || ids[cur] === 'colors') return;
    stage.setPointer(((e.clientX / window.innerWidth) * 2 - 1) * 0.4, ((e.clientY / window.innerHeight) * 2 - 1) * 0.4);
  }, { passive: true });
}

const smoothstep = (t) => { const x = clamp01(t); return x * x * (3 - 2 * x); };
const tweenFold = (to, d = 1.2) => gsap.to(fx, { fold: to, duration: reduceMQ.matches ? 0.01 : d, ease: 'power2.inOut', overwrite: 'auto' });

/* ---------- 1. Летит на свет: сложить и раскрыть ---------- */

const foldBtn = $('[data-fold-toggle]');
function setHeroFold(closed) {
  tweenFold(closed ? 1 : 0, 1.3);
  foldBtn.setAttribute('aria-pressed', String(closed));
  foldBtn.textContent = closed ? 'Раскрыть' : 'Сложить';
}
foldBtn.addEventListener('click', () => setHeroFold(foldBtn.getAttribute('aria-pressed') !== 'true'));

/* ---------- 2. «Крыло» ---------- */

const WING_TEXT = {
  clock: 'Moth сложен. «Крыло» показывает часы и последнее сообщение.',
  assist: 'OY Assist отвечает прямо на крышке. Раскрывать не нужно.',
  player: 'Плеер на «Крыле»: трек, перемотка, громкость.',
  camera: 'Видоискатель на «Крыле»: селфи на основную камеру 50 МП.',
};
const CONTINUE_TEXT = {
  clock: 'Раскрыли: на большом экране OY OS 4, «Пыльца» уже в цвет корпуса.',
  assist: 'Раскрыли: карта с такси на большом экране, с того же места.',
  player: 'Раскрыли: тот же трек на большом экране, без паузы.',
  camera: 'Раскрыли: съёмка продолжается на большом экране.',
};
const wingGroup = $('[data-wing-switch]');
const wingStatus = $('[data-wing-status]');
const wingOpenBtn = $('[data-wing-open]');
let wingApp = 'clock';
let wingOpened = false;
function setWingApp(v) {
  wingApp = v;
  syncRadio(wingGroup, v);
  $$('[data-app]').forEach((a) => { a.hidden = a.dataset.app !== v; });
  stage?.setWing(v);
  if (wingOpened) closeWing();
  wingStatus.textContent = WING_TEXT[v];
}
function closeWing() {
  wingOpened = false;
  FOLD.wing = 1;
  wingOpenBtn.textContent = 'Раскрыть и продолжить';
}
initRadioGroup(wingGroup, setWingApp);
wingOpenBtn.addEventListener('click', () => {
  wingOpened = !wingOpened;
  if (wingOpened) {
    stage?.setMainApp(wingApp);
    FOLD.wing = null;
    fx.fold = 1;
    tweenFold(0, 1.2);
    // раскрытый телефон поворачивается экраном к вам
    POSES_DESKTOP.wing = { ...POSES_DESKTOP.wing, fy: 0, dist: 5.6 };
    POSES_MOBILE.wing = { ...POSES_MOBILE.wing, fy: 0, dist: 8.8 };
    wingOpenBtn.textContent = 'Сложить обратно';
    wingStatus.textContent = CONTINUE_TEXT[wingApp];
  } else {
    POSES_DESKTOP.wing = { ...POSES_DESKTOP.wing, fy: FC, dist: 3.3 };
    POSES_MOBILE.wing = { ...POSES_MOBILE.wing, fy: FC, dist: 5.4 };
    tweenFold(1, 1.1).then(() => { if (!wingOpened) FOLD.wing = 1; });
    wingOpenBtn.textContent = 'Раскрыть и продолжить';
    wingStatus.textContent = WING_TEXT[wingApp];
  }
});

/* ---------- 3. «Кокон» ---------- */

const angle = $('[data-angle]');
const angleOut = $('[data-angle-out]');
const modeEl = $('[data-cocoon-mode]');
function modeText(a) {
  if (a <= 2) return '<b>Сложен.</b> Видно только «Крыло», щели нет.';
  if (a < 30) return '<b>Почти закрыт.</b> Ниже 30° петля доводит половины сама.';
  if (a <= 150) return '<b>«Палатка».</b> Moth стоит на столе сам: сверху видео или видоискатель, снизу пульт.';
  if (a < 178) return '<b>Почти разложен.</b> Выше 150° петля сама раскрывает до конца.';
  return '<b>Разложен.</b> Обычный телефон с экраном 6,9".';
}
let modeNow = '';
function setAngle(a, { tween = false } = {}) {
  a = Math.max(0, Math.min(180, a));
  angle.value = String(Math.round(a));
  angleOut.textContent = `${Math.round(a)}°`;
  angle.setAttribute('aria-valuetext', `${Math.round(a)}°`);
  const t = modeText(a);
  if (t !== modeNow) { modeNow = t; modeEl.innerHTML = t; }
  if (ids[cur] === 'cocoon') {
    if (tween) tweenFold(1 - a / 180, 0.9);
    else { gsap.killTweensOf(fx, 'fold'); fx.fold = 1 - a / 180; }
  }
}
angle.addEventListener('input', () => setAngle(Number(angle.value)));
$$('[data-angle-set]').forEach((b) => b.addEventListener('click', () => {
  const o = { a: Number(angle.value) };
  gsap.to(o, { a: Number(b.dataset.angleSet), duration: reduceMQ.matches ? 0.01 : 0.9, ease: 'power2.inOut', onUpdate: () => setAngle(o.a) });
}));

/* ---------- 4. Argon 1 ---------- */

const score = $('[data-score]');
const scoreNum = $('[data-count]');
function playScore() {
  score.classList.remove('is-on');
  void score.offsetWidth;
  score.classList.add('is-on');
  const o = { v: 0 };
  gsap.to(o, { v: 1.5, duration: reduceMQ.matches ? 0.01 : 1.4, ease: 'power3.out', onUpdate: () => { scoreNum.textContent = o.v.toFixed(1).replace('.', ','); } });
}

// Блоки кристалла: нажали — внизу рассказ о блоке
{
  const group = $('[data-die-switch]');
  const info = $('.die-info');
  const k = $('[data-die-k]');
  const t = $('[data-die-t]');
  const DIE = {
    core: ['Argon 1 · весь кристалл', 'Пять блоков на одном кристалле. Чем меньше отдельных чипов, тем тоньше половины Moth. Нажмите на любой блок.'],
    cpu: ['8 ядер · процессор', 'Мощные ядра берут игры и камеру, экономные держат фон и «Крыло». В Moth частоты ниже, чем будут в обычном корпусе.'],
    gpu: ['Графика · своя', 'Первая собственная графика OY. Рисует OY OS 4 сразу на двух экранах и не перегревает тонкие половины.'],
    npu: ['NPU · нейроблок', 'Обрабатывает снимки и отвечает за OY Assist на «Крыле». Считает прямо на телефоне.'],
    nc: ['NC3 · модем', 'Модем живёт внутри Argon, а не отдельным чипом рядом. Что он умеет — в следующей главе.'],
    msc: ['MSC · безопасность', 'Ключи накопителя, отпечаток и оплата NFC. Чего он не умеет, мы честно рассказываем через главу.'],
  };
  initRadioGroup(group, (v) => {
    syncRadio(group, v);
    k.textContent = DIE[v][0];
    t.textContent = DIE[v][1];
    info.classList.remove('is-in');
    void info.offsetWidth;
    if (!reduceMQ.matches) info.classList.add('is-in');
  });
}

/* ---------- 5. Связь ---------- */

// Три функции NC3 слева переключают сцену справа; в шапке сцены — «статус-бар»
const net = {};
{
  const box = $('[data-net]');
  const tag = $('[data-net-tag]');
  const bars = $('[data-net-bars]');
  const gen = $('[data-net-gen]');
  const status = (t, lvl, g) => { tag.textContent = t; bars.dataset.lvl = String(lvl); gen.textContent = g; };

  /* 01 · антенны */
  const ant = $('[data-ant]');
  const antCap = $('[data-ant-cap]');
  const antGroup = $('[data-ant-switch]');
  const ANT = {
    open: 'Разложен: работают антенны по краям',
    folded: 'Сложен: работают антенны у петли и на крышке',
    fist: 'В кулаке: нижние антенны закрыты рукой, связь ушла наверх и в петлю',
  };
  initRadioGroup(antGroup, (v) => {
    syncRadio(antGroup, v);
    ant.dataset.antState = v;
    antCap.textContent = ANT[v];
  });

  /* 02 · сотовая + Wi-Fi */
  const bond = $('[data-bond]');
  const walk = $('[data-bond-walk]');
  const bondCap = $('[data-bond-cap]');
  let away = false;
  function setBond(cell, wifi) {
    const sum = cell + wifi;
    const max = 600;
    [['cell', cell], ['wifi', wifi], ['sum', sum]].forEach(([k, v]) => {
      $(`[data-bond-${k}]`).style.setProperty('--v', String(Math.min(1, v / max)));
      const n = $(`[data-bond-${k}-n]`);
      const o = { v: Number(n.textContent) || 0 };
      gsap.to(o, { v, duration: reduceMQ.matches ? 0.01 : 0.9, ease: 'power2.out', onUpdate: () => { n.textContent = String(Math.round(o.v)); } });
    });
    bond.style.setProperty('--w-cell', String(2 + cell / 70));
    bond.style.setProperty('--w-wifi', String(1 + wifi / 70));
  }
  walk.addEventListener('click', () => {
    away = !away;
    bond.classList.toggle('is-away', away);
    walk.setAttribute('aria-pressed', String(away));
    walk.textContent = away ? 'Вернуться домой' : 'Уйти от роутера';
    if (away) setBond(470, 60); else setBond(210, 380);
    bondCap.textContent = away
      ? 'Во дворе Wi-Fi слабеет, и 5G берёт поток на себя. Видео не останавливается'
      : 'Дома: Wi-Fi и 5G тянут вместе, Мбит/с';
  });

  /* 03 · звонок */
  const ladder = $$('[data-ladder] li');
  const callBtn = $('[data-call-go]');
  const callCap = $('[data-call-cap]');
  const callTime = $('[data-call-time]');
  const GENS = ['5G', '4G', '3G', '2G'];
  const CALL = [
    'Город, 5G. Звонок идёт.',
    'Пригород, 4G. Звонок не прерывался.',
    'Трасса, 3G. Интернет еле дышит, голос чистый.',
    'Дача, 2G. Интернета почти нет, а мама слышит вас.',
  ];
  let g = 0;
  let sec = 0;
  let timer = 0;
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  function paintCall() {
    ladder.forEach((li, i) => { li.classList.toggle('is-on', i === g); li.classList.toggle('is-past', i < g); });
    callCap.textContent = CALL[g];
    callBtn.textContent = g === GENS.length - 1 ? 'Вернуться в город' : 'Уехать дальше';
    if (g === 0) callBtn.textContent = 'Уехать за город';
    status('Звонок · NC3', 4 - g, GENS[g]);
  }
  callBtn.addEventListener('click', () => {
    g = g === GENS.length - 1 ? 0 : g + 1;
    paintCall();
  });
  net.callRun = (on) => {
    clearInterval(timer);
    if (on) timer = setInterval(() => { sec += 1; callTime.textContent = fmt(sec); }, 1000);
  };

  /* переключение сцен */
  const group = $('[data-net-switch]');
  const scenes = { fold: ant, bond, call: $('[data-call]') };
  let scene = 'fold';
  function setScene(v) {
    syncRadio(group, v);
    if (v === scene) return;
    scene = v;
    box.dataset.scene = v;
    Object.entries(scenes).forEach(([k, el]) => {
      el.hidden = k !== v;
      el.classList.toggle('is-in', k === v && !reduceMQ.matches);
    });
    if (v === 'fold') status('NC3 · антенны', 4, '5G');
    if (v === 'bond') status('NC3 · 5G + Wi-Fi', 4, '5G+');
    if (v === 'call') paintCall();
    net.callRun(v === 'call' && ids[cur] === 'claw');
  }
  initRadioGroup(group, setScene);
  net.isCall = () => scene === 'call';
}

/* ---------- 6. MSC: отдельный чип не влезает ---------- */

{
  const slice = $('[data-slice]');
  const mm = $('[data-slice-mm]');
  const cap = $('[data-slice-cap]');
  const btn = $('[data-slice-try]');
  btn.addEventListener('click', () => {
    const on = !slice.classList.contains('is-try');
    slice.classList.toggle('is-try', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = on ? 'Вернуть как было' : 'Вставить отдельный чип';
    cap.textContent = on
      ? 'С отдельным чипом и его аккумулятором половина вырастает до 8,9 мм, а сложенный Moth — до 18,8 мм. И стоит на $90 дороже.'
      : 'Половина Moth в разрезе. Свободного места нет.';
    const o = { v: on ? 6.8 : 8.9 };
    gsap.to(o, { v: on ? 8.9 : 6.8, duration: reduceMQ.matches ? 0.01 : 0.7, ease: 'power2.out', onUpdate: () => { mm.textContent = o.v.toFixed(1).replace('.', ','); } });
  });
}

/* ---------- 7. Камеры: видоискатель на «Крыле» и лента снимков ---------- */

let camLens = '1';
{
  const group = $('[data-cam-switch]');
  const roll = $('[data-roll]');
  initRadioGroup(group, (v) => {
    camLens = v;
    syncRadio(group, v);
    stage?.setWing(v === '1' ? 'camera' : 'camera-wide');
  });
  let n = 0;
  $('[data-shot]').addEventListener('click', () => {
    gsap.timeline()
      .to(fx, { flash: 1, duration: 0.08 })
      .to(fx, { flash: 0, duration: 0.5, ease: 'power2.out' });
    n += 1;
    $('.roll__empty', roll)?.remove();
    const wide = camLens !== '1';
    const li = document.createElement('li');
    li.className = `shot is-new${wide ? ' shot--wide' : ''}`;
    li.style.setProperty('--r', `${[-4, 3, -2, 5][n % 4]}deg`);
    li.innerHTML = `<div class="shot__pic">${wide ? '<i></i><i></i><i></i>' : '<i></i>'}</div>
      <p class="shot__cap"><span>${wide ? '0,6× · 12 МП' : '1× · 50 МП'}</span><span>№${n}</span></p>`;
    li.setAttribute('aria-label', `Снимок ${n}: ${wide ? 'сверхширокая, вся компания' : 'основная камера, селфи'}; без геометки`);
    roll.prepend(li);
    while (roll.children.length > 3) roll.lastElementChild.remove();
    toast(wide ? 'Вся компания в кадре. Без геометки и без данных о модели телефона.' : 'Селфи на основную, 50 МП. Без геометки и без данных о модели телефона.');
  });
}

/* ---------- 8. Цвета и лампа ---------- */

const COLOR_DESC = {
  yellow: ['Жёлтый.', 'Цвет лампы, на которую летит мотылёк. Мы выбрали его первым.'],
  red: ['Красный.', 'Как сигнальный фонарь OY, которого у Moth нет. Зато вспышка умеет светить красным.'],
  pink: ['Розовый.', 'Тёплый, как абажур в комнате, где горит ночник.'],
  apple: ['Яблочный.', 'Зелёный, как кислое яблоко. Очень свежий.'],
  blue: ['Синий.', 'Яркий синий, как неоновая вывеска, вокруг которой кружат мотыльки.'],
  cloud: ['Облачный.', 'Белый, как облако под луной. Рамка в тон, почти серебро.'],
};
const COLOR_KEY = 'oy-moth-color';
const colorName = $('[data-color-name]');
const colorDesc = $('[data-color-desc]');
let color = PRODUCT.colors[store.get(COLOR_KEY)] ? store.get(COLOR_KEY) : PRODUCT.defaultColor;
function setColor(name, { instant = false } = {}) {
  if (!PRODUCT.colors[name]) return;
  color = name;
  root.dataset.color = name;
  store.set(COLOR_KEY, name);
  $$('[data-color-switch]').forEach((g) => syncRadio(g, name));
  colorName.textContent = COLOR_DESC[name][0];
  colorDesc.textContent = COLOR_DESC[name][1];
  $('[data-cfg-color]').textContent = PRODUCT.colors[name];
  $$('[data-garland] li').forEach((li) => li.classList.toggle('is-on', li.dataset.value === name));
  stage?.setBodyColor(name, instant);
}
$$('[data-color-switch]').forEach((g) => initRadioGroup(g, (v) => setColor(v)));

const lamp = $('[data-lamp]');
function placeLamp(px, py) {
  lamp.style.transform = `translate(${px}px, ${py}px)`;
  // Moth стоит на месте: в этой главе меняются только корпус и обои
  lampPose.on = true;
}
function resetLamp() {
  const w = window.innerWidth, h = window.innerHeight;
  if (mobileMQ.matches) placeLamp(w * 0.62, h * 0.16); else placeLamp(w * 0.78, h * 0.26);
}
// гирлянда: лампочка загорается, качается, и лампа летит к ней
$$('[data-garland] li').forEach((li) => li.addEventListener('click', () => {
  setColor(li.dataset.value);
  const r = $('i', li).getBoundingClientRect();
  placeLamp(r.left + r.width / 2, r.bottom + 70);
  li.classList.remove('is-swing');
  void li.offsetWidth;
  if (!reduceMQ.matches) li.classList.add('is-swing');
}));

/* ---------- 9. Купить и валюта ---------- */

// выбор валюты общий для страниц, где есть евро; старый ключ 0X2 Pro тоже понимаем
const CUR_KEY = 'oy-currency';
let currency = (store.get(CUR_KEY) || store.get('oy-0x2pro-currency')) === 'eur' ? 'eur' : 'usd';
const money = (usd, eur) => (currency === 'eur' ? `€${eur}` : `$${usd}`);
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
  totalEl.innerHTML = [...text].map((ch) => `<span class="dg" aria-hidden="true"><span>${ch}</span></span>`).join('');
  if (!animate || !old || reduceMQ.matches) return;
  // цифры, которые поменялись, перекидываются, как на табло
  $$('.dg > span', totalEl).forEach((s, i) => {
    if (old[i] === text[i]) return;
    gsap.fromTo(s, { rotationX: -90, opacity: 0, transformOrigin: '50% 0' }, { rotationX: 0, opacity: 1, duration: 0.5, delay: i * 0.04, ease: 'power3.out' });
  });
}
function applyCurrency() {
  $$('[data-currency]').forEach((g) => syncRadio(g, currency));
  $$('[data-price]').forEach((el) => { el.textContent = money(el.dataset.usd, el.dataset.eur); });
  const c0 = PRODUCT.configs[0];
  $$('[data-price-from]').forEach((el) => { el.textContent = money(c0.usd, c0.eur); });
  renderTotal(true);
}
$$('[data-currency]').forEach((g) => initRadioGroup(g, (v) => {
  currency = v;
  store.set(CUR_KEY, v);
  applyCurrency();
}));
{
  const group = $('[data-mem-switch]');
  const name = $('[data-cfg-name]');
  initRadioGroup(group, (v) => {
    cfgId = v;
    syncRadio(group, v);
    name.textContent = `OY 0X Moth · ${v} ГБ`;
    renderTotal(true);
  });
  $('[data-price-table]').innerHTML = PRODUCT.configs
    .map((c) => `<tr><td>${c.id} ГБ</td><td>$${c.usd}</td><td>€${c.eur}</td></tr>`).join('');
}
bindStubs(toast);

/* ---------- Шкала угла ---------- */

const gaugeList = $('[data-gauge-list]');
gaugeList.innerHTML = chapters.map((c, i) => `<li><a href="#${c.id}" data-go="${i}"><span>${String(i + 1).padStart(2, '0')} · ${c.dataset.chapter}</span><b class="sr-only">Глава ${i + 1}: ${c.dataset.chapter}</b></a></li>`).join('');
const gaugeLinks = $$('a', gaugeList);
const gaugeNo = $('[data-gauge-no]');
const gaugeDeg = $('[data-gauge-deg]');
const announce = $('[data-announce]');
const degOf = (i) => Math.round(180 * (1 - i / (N - 1)));

function paint() {
  chapters.forEach((c, i) => {
    const on = i === cur;
    c.classList.toggle('is-current', on);
    c.classList.remove('is-under');
    c.inert = !on;
    if (on) c.removeAttribute('aria-hidden'); else c.setAttribute('aria-hidden', 'true');
  });
  gaugeLinks.forEach((a, i) => {
    if (i === cur) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
    a.classList.toggle('is-past', i < cur);
  });
  gaugeNo.textContent = String(cur + 1);
  gaugeDeg.textContent = `${degOf(cur)}°`;
  root.classList.toggle('is-deep', cur > 0);
  root.classList.toggle('on-buy', ids[cur] === 'buy');
}

/* ---------- Сгиб: лист перекидного табло ---------- */

// Статичный снимок главы для грани листа: без id, без фокуса, с той же прокруткой
function snapshot(ch) {
  const c = ch.cloneNode(true);
  c.removeAttribute('id');
  $$('[id]', c).forEach((el) => el.removeAttribute('id'));
  c.classList.add('is-clone');
  c.classList.remove('is-current', 'is-under');
  c.setAttribute('aria-hidden', 'true');
  c.inert = true;
  return c;
}

// Копия начинает CSS-анимации с нуля (свечение лампы, стрелка, гирлянда), и на
// листе они прыгали. Выставляем копиям то же время, что у оригинала
function syncAnimations(src, clone) {
  const own = src.getAnimations({ subtree: true });
  if (!own.length) return;
  const srcEls = [src, ...src.querySelectorAll('*')];
  const cloneEls = [clone, ...clone.querySelectorAll('*')];
  const cloneAnims = clone.getAnimations({ subtree: true });
  own.forEach((a) => {
    const t = cloneEls[srcEls.indexOf(a.effect?.target)];
    if (!t) return;
    const pseudo = a.effect.pseudoElement || null;
    cloneAnims.forEach((b) => {
      if (b.effect?.target === t && (b.effect.pseudoElement || null) === pseudo && b.animationName === a.animationName) b.currentTime = a.currentTime;
    });
  });
}

function flip(fromEl, toEl, dir) {
  const flap = document.createElement('div');
  flap.className = 'flap';
  flap.setAttribute('aria-hidden', 'true');
  const leaf = document.createElement('div');
  leaf.className = `flap__leaf flap__leaf--${dir > 0 ? 'top' : 'bottom'}`;
  const front = document.createElement('div');
  front.className = 'flap__face';
  const back = document.createElement('div');
  back.className = 'flap__face flap__face--back';
  // вперёд: лицо — верх старой главы, оборот — низ новой; назад — наоборот
  const fClone = snapshot(fromEl);
  const bClone = snapshot(toEl);
  fClone.classList.add(dir > 0 ? 'is-upper' : 'is-lower');
  bClone.classList.add(dir > 0 ? 'is-lower' : 'is-upper');
  front.append(fClone, Object.assign(document.createElement('i'), { className: 'flap__shade' }));
  back.append(bClone, Object.assign(document.createElement('i'), { className: 'flap__shade' }));
  leaf.append(front, back);
  const shadow = document.createElement('i');
  shadow.className = `flap__cast flap__cast--${dir > 0 ? 'top' : 'bottom'}`;
  flap.append(shadow, leaf);
  document.body.append(flap);
  fClone.scrollTop = fromEl.scrollTop;
  bClone.scrollTop = 0;
  syncAnimations(fromEl, fClone);
  syncAnimations(toEl, bClone);

  // под листом — новая глава целиком; от старой остаётся неподвижная половина
  toEl.classList.add('is-under');
  fromEl.style.clipPath = dir > 0 ? 'inset(50% 0 0 0)' : 'inset(0 0 50% 0)';

  const shadeF = $('.flap__shade', front);
  const shadeB = $('.flap__shade', back);
  const o = { a: 0 };
  const sign = dir > 0 ? -1 : 1;
  return new Promise((resolve) => {
    gsap.to(o, {
      // лист разгоняется и мягко ложится: с power2.in он бил в край на полной скорости
      a: 180, duration: mobileMQ.matches ? 0.8 : 0.95, ease: 'power2.inOut',
      onUpdate: () => {
        leaf.style.transform = `rotateX(${sign * o.a}deg)`;
        const t = o.a / 180;
        shadeF.style.opacity = String(Math.min(1, t * 1.6) * 0.75);
        shadeB.style.opacity = String((1 - t) * 0.8);
        shadow.style.opacity = String((1 - t) * 0.7);
      },
      onComplete: () => {
        fromEl.style.clipPath = '';
        flap.remove();
        resolve();
      },
    });
  });
}

/* ---------- Вход и выход из глав ---------- */

let heroOpened = false;
function onEnter(id) {
  if (id === 'light' && !heroOpened) {
    heroOpened = true;
    // первый экран: Moth прилетает сложенным и раскрывается
    if (!reduceMQ.matches) { fx.fold = 1; setTimeout(() => { if (ids[cur] === 'light') setHeroFold(false); }, 500); }
  }
  if (id === 'argon') playScore();
  if (id === 'claw') net.callRun(net.isCall());
  if (id === 'cams') stage?.setWing(camLens === '1' ? 'camera' : 'camera-wide');
  if (id === 'colors' && !lampPose.on) resetLamp();
}
function onLeave(id) {
  if (id === 'cams') stage?.setWing(wingApp);
  // большой экран после «Крыла» возвращается на главный экран системы
  if (id === 'wing') stage?.setMainApp('clock');
  if (id === 'wing' && wingOpened) {
    wingOpened = false;
    POSES_DESKTOP.wing = { ...POSES_DESKTOP.wing, fy: FC, dist: 3.3 };
    POSES_MOBILE.wing = { ...POSES_MOBILE.wing, fy: FC, dist: 5.4 };
    closeWing();
    wingStatus.textContent = WING_TEXT[wingApp];
  }
  if (id === 'colors') lampPose.on = false;
  if (id === 'claw') net.callRun(false);
}

async function go(to, { instant = false } = {}) {
  if (to < 0 || to >= N || to === cur || busy) return false;
  const from = cur;
  busy = true;
  onLeave(ids[from]);
  const fromFold = stage ? stage.debug.cur.fold : 0;
  cur = to;
  // у «Летит на свет» и «Кокона» сгиб свой — задаём его сразу, а не после листа,
  // иначе Moth сперва едет к старому значению fx.fold и потом разворачивается
  let toFold = FOLD[ids[to]] ?? fx.fold;
  if (ids[to] === 'light') {
    toFold = foldBtn.getAttribute('aria-pressed') === 'true' ? 1 : 0;
    tweenFold(toFold, 1.1);
  }
  if (ids[to] === 'cocoon') {
    toFold = 1 - Number(angle.value) / 180;
    setAngle(Number(angle.value), { tween: true });
  }
  history.replaceState(null, '', to === 0 ? location.pathname + location.search : `#${ids[to]}`);
  announce.textContent = `Глава ${to + 1} из ${N}: ${chapters[to].dataset.chapter}`;
  chapters[to].scrollTop = 0;
  if (instant || reduceMQ.matches) {
    paint();
    if (!instant) gsap.fromTo(chapters[to], { opacity: 0 }, { opacity: 1, duration: 0.3, clearProps: 'opacity' });
  } else {
    // Moth «кивает» сгибом в такт листу, только если сам сгиб между главами не
    // меняется. Поверх смены сгиба пульс тянул в обратную сторону, и модель дёргалась
    const settled = Math.abs(toFold - fromFold) < 0.15;
    if (settled) gsap.fromTo(fx, { pulse: 0 }, { keyframes: [{ pulse: 1, duration: 0.45, ease: 'sine.inOut' }, { pulse: 0, duration: 0.6, ease: 'sine.inOut' }] });
    else fx.pulse = 0;
    await flip(chapters[from], chapters[to], to > from ? 1 : -1);
    paint();
  }
  busy = false;
  onEnter(ids[to]);
  return true;
}
const step = (d) => go(cur + d);

/* ---------- Ввод: колесо, свайп, клавиши, ссылки ---------- */

const SCROLL_SLACK = 24;
function canScroll(dir) {
  const C = chapters[cur];
  // переполнение в пару десятков пикселей — не повод тратить свайп на прокрутку
  return dir > 0 ? C.scrollTop + C.clientHeight < C.scrollHeight - SCROLL_SLACK : C.scrollTop > SCROLL_SLACK;
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
  touch = { x: t.clientX, y: t.clientY, up: canScroll(-1), down: canScroll(1), lamp: !!e.target.closest?.('[data-lamp]') };
}, { passive: true });
window.addEventListener('touchend', (e) => {
  if (!touch || touch.lamp) { touch = null; return; }
  const t = e.changedTouches[0];
  const dx = t.clientX - touch.x, dy = touch.y - t.clientY;
  const dir = Math.sign(dy);
  if (Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx) * 1.3 && !e.target.closest?.('input[type="range"]')) {
    if ((dir > 0 && !touch.down && !canScroll(1)) || (dir < 0 && !touch.up && !canScroll(-1))) step(dir);
  }
  touch = null;
}, { passive: true });

window.addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const tag = e.target.closest?.('input, textarea, select, [role="radio"], [role="switch"]');
  const next = ['PageDown', 'ArrowDown'].includes(e.key) || (e.key === ' ' && !e.target.closest?.('button, a'));
  const prev = ['PageUp', 'ArrowUp'].includes(e.key);
  if (tag && e.key.startsWith('Arrow')) return;
  if (next || prev) {
    const dir = next ? 1 : -1;
    if (canScroll(dir)) return;
    e.preventDefault();
    step(dir);
  } else if (e.key === 'Home' && !tag) { e.preventDefault(); go(0); }
  else if (e.key === 'End' && !tag) { e.preventDefault(); go(N - 1); }
});

// Ссылки на главы и на сноски в другой главе
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.hasAttribute('data-stub')) return;
  const id = a.getAttribute('href').slice(1);
  if (!id) return;
  const target = document.getElementById(id);
  if (!target) return;
  const i = chapters.findIndex((c) => c === target || c.contains(target));
  if (i < 0) return;
  e.preventDefault();
  if (a.hasAttribute('data-to-top')) { chapters[i].scrollTo({ top: 0, behavior: reduceMQ.matches ? 'auto' : 'smooth' }); return; }
  const reveal = () => { if (target !== chapters[i]) target.scrollIntoView({ block: 'center', behavior: reduceMQ.matches ? 'auto' : 'smooth' }); };
  if (i === cur) reveal(); else go(i).then(reveal);
});

/* ---------- Запуск ---------- */

function startChapter() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (!h) return 0;
  const m = h.match(/^fold-(\d+)$/);
  if (m) return Math.max(0, Math.min(N - 1, Number(m[1]) - 1));
  const el = document.getElementById(h);
  const i = el ? chapters.findIndex((c) => c === el || c.contains(el)) : -1;
  return i < 0 ? 0 : i;
}

async function boot() {
  setColor(color, { instant: true });
  applyCurrency();
  renderTotal(false);
  setAngle(180);
  cur = startChapter();
  if (cur !== 0) heroOpened = true;
  paint();
  const target = location.hash.slice(1) && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target && !chapters.includes(target)) requestAnimationFrame(() => target.scrollIntoView({ block: 'center' }));

  const timeout = (ms) => new Promise((r) => setTimeout(r, ms));
  const fonts = document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve();
  await Promise.race([Promise.all([fonts, stage ? stage.ready : null, timeout(400)]), timeout(12000)]);
  stage?.redrawScreen();
  if (ids[cur] === 'light' && !reduceMQ.matches) fx.fold = 1;
  tick();
  stage?.snap();

  const loader = $('#loader');
  loader.classList.add('is-done');
  loader.setAttribute('aria-hidden', 'true');

  if (cur === 0 && !reduceMQ.matches) {
    gsap.from('.ch--light .ch__text > *', { y: 30, opacity: 0, stagger: 0.07, duration: 1, ease: 'expo.out', delay: 0.4 });
    gsap.from('.ch--light .site-header', { yPercent: -100, opacity: 0, duration: 1, ease: 'expo.out', delay: 0.7 });
  }
  onEnter(ids[cur]);
  if (params.has('debug')) window.__oy = { stage, fx, go, cur: () => cur, gsap };
}
boot();
