/* =========================================================================
   OY — страница OY OS 4. Без 3D: подменю с подсветкой раздела, параллакс
   макетов в герое, галерея «Что нового», OY Assist 4 с лимитом запросов,
   призрачный профиль, PIN под принуждением и терминал. Демо OY ID,
   0X Cloud, «Линзы», Google, главного экрана, «Воспоминаний» и ночного
   обновления — в os4.js.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { $, $$, createToast, syncRadio, initRadioGroup } from '../core/ui.js';
import { createSmoothScroll } from '../core/scroll.js';
import { createSplitReveals, wrapWords, scrubWords } from '../core/text.js';
import { initCarousel } from '../core/carousel.js';

gsap.registerPlugin(ScrollTrigger);
const root = document.documentElement;
root.classList.add('anim');
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ });
const toast = createToast($('#toast'), gsap);
let reducedMode = reduceMQ.matches;
const wait = (ms) => new Promise((r) => setTimeout(r, reducedMode ? Math.min(ms, 60) : ms));

/* ---------- Подменю: подсветка текущего раздела ---------- */

const tabs = $$('.os-tab');
const tabTrack = $('.os-tabs__track');
function setTab(id) {
  tabs.forEach((t) => {
    const on = t.getAttribute('href') === `#${id}`;
    if (on) {
      t.setAttribute('aria-current', 'true');
      const x = t.offsetLeft - (tabTrack.clientWidth - t.offsetWidth) / 2;
      tabTrack.scrollTo({ left: x, behavior: reducedMode ? 'auto' : 'smooth' });
    } else t.removeAttribute('aria-current');
  });
}
tabs.forEach((t) => {
  const sec = $(t.getAttribute('href'));
  if (!sec) return;
  ScrollTrigger.create({ trigger: sec, start: 'top 45%', end: 'bottom 45%', onToggle: (st) => { if (st.isActive) setTab(sec.id); } });
});

/* ---------- «Что нового»: печать запроса на активном слайде ---------- */

initCarousel($('#new'), { gsap, isReduced: () => reducedMode });
$$('[data-typer]').forEach((el) => {
  const text = el.dataset.typer;
  const slide = el.closest('.hl__slide');
  let n = 0;
  setInterval(() => {
    if (reducedMode) { el.textContent = text; return; }
    if (!slide.classList.contains('is-active')) { if (n) { n = 0; el.textContent = ''; } return; }
    if (n < text.length) el.textContent = text.slice(0, ++n);
  }, 42);
});

/* ---------- OY Assist: в OY OS 4.5 — на устройстве или в 0X Cloud (10 запросов в день) ---------- */

const ANSWERS = [
  ['Сократи письмо от начальника до трёх строк', 'Отчёт нужен к пятнице. Цифры — из таблицы за третий квартал. Созвон переносится на четверг, 11:00.'],
  ['Что я обещал Марку на прошлой неделе?', 'В переписке от 4 ноября: вернуть дрель и скинуть фото с дачи. Дрель, судя по фото в 0X Cloud, всё ещё у вас.'],
  ['Найди фото чека из аптеки', 'Нашёл два снимка от 29 октября в 0X Cloud, сумма 1 240 ₽.'],
  ['Переведи с французского меню на фото', '«Magret de canard» — утиная грудка. «Tarte Tatin» — перевёрнутый яблочный пирог. Берите второе.'],
];
const chat = $('[data-chat]');
const island = $('[data-assist-island]');
const duel = $('.duel--cloud');
const cloudBytes = $('[data-cloud-bytes]');
const cloudOut = $('[data-cloud-out]');
const plane = $('[data-plane]');
const qBtns = $$('[data-q]');
const quotaEl = $('[data-quota]');
// Как будто семь запросов сегодня уже ушло: до лимита — три
const QUOTA = 10;
let used = 7;
let cloudTotal = 0;
// OY OS 4.5: по умолчанию ассистент думает на телефоне — без лимита и без сети
let where = 'device';
const sysEl = $('[data-assist-sys]');
const footDevice = $('[data-quota-foot]');
const footCloud = $('[data-quota-cloud]');
const whereGrp = $('[data-assist-where]');
const setWhere = (v) => {
  where = v;
  syncRadio(whereGrp, v);
  duel.classList.toggle('is-local', v === 'device');
  sysEl.textContent = v === 'device' ? 'OY Assist · на устройстве' : 'OY Assist 4 · в 0X Cloud';
  footDevice.hidden = v !== 'device';
  footCloud.hidden = v === 'device';
  cloudOut.textContent = v === 'device' ? 'На устройстве: в облако ничего не уходит.' : plane.checked ? 'Нет сети. OY Assist 4 работает в 0X Cloud.' : 'Ждёт вопроса.';
};

const fmtBytes = (b) => (b < 1024 ? `${Math.round(b)} Б` : b < 1048576 ? `${(b / 1024).toFixed(0)} КБ` : `${(b / 1048576).toFixed(1).replace('.', ',')} МБ`);
function bubble(cls, text) {
  const p = document.createElement('p');
  p.className = cls;
  p.textContent = text;
  chat.append(p);
  // Держим в чате не больше пяти сообщений
  while (chat.children.length > 6) chat.children[1].remove();
  return p;
}
plane.addEventListener('change', () => {
  duel.classList.toggle('is-offline', plane.checked);
  if (where === 'device') return;
  cloudOut.textContent = plane.checked ? 'Нет сети. OY Assist 4 работает в 0X Cloud.' : 'Ждёт вопроса.';
});
initRadioGroup(whereGrp, setWhere);
setWhere('device');
qBtns.forEach((b) => b.addEventListener('click', async () => {
  const [q, a] = ANSWERS[+b.dataset.q];
  qBtns.forEach((x) => { x.disabled = true; x.setAttribute('aria-pressed', String(x === b)); });
  bubble('chat__q', q);
  const done = () => qBtns.forEach((x) => { x.disabled = false; });

  // OY OS 4.5: на устройстве — ни сети, ни лимита, ни байтов в облако
  if (where === 'device') {
    const think = bubble('chat__a is-thinking', 'Думаю на Cesium… то есть на телефоне');
    island.classList.add('is-thinking');
    await wait(reducedMode ? 0 : 900);
    island.classList.remove('is-thinking');
    think.classList.remove('is-thinking');
    think.textContent = a.replace(/ в 0X Cloud/g, ' в галерее');
    cloudOut.textContent = plane.checked ? 'Авиарежим, а ответ есть: запрос не покинул телефон.' : 'Запрос не покинул телефон. Отправлено в облако: 0 Б.';
    return done();
  }

  // Без сети облачному ассистенту думать негде
  if (plane.checked) {
    bubble('chat__a chat__a--err', 'Нет подключения к 0X Cloud. OY Assist 4 работает в облаке — так он в сто раз мощнее. Подключитесь к интернету.');
    cloudOut.textContent = 'Нет сети. Запрос не отправлен.';
    return done();
  }
  if (used >= QUOTA) {
    bubble('chat__a chat__a--err', 'Лимит на сегодня исчерпан: 10 из 10. Обновится в 00:00 — или подключите 0X Cloud Pro: 100 запросов в день за $9,99 в месяц.');
    cloudOut.textContent = 'Запрос не отправлен: лимит.';
    toast('Хотите больше? 0X Cloud Pro — 100 запросов в день.');
    return done();
  }
  used += 1;
  quotaEl.textContent = String(QUOTA - used);
  const think = bubble('chat__a is-thinking', 'Думаю в 0X Cloud…');
  island.classList.add('is-thinking');

  // Запрос, голос и контекст уходят в 0X Cloud
  {
    duel.classList.add('is-sending');
    cloudOut.textContent = 'Отправляю запрос, голос и контекст из 0X Cloud, чтобы ответ был точнее…';
    const add = 180000 + Math.random() * 260000;
    const o = { v: cloudTotal };
    cloudTotal += add;
    gsap.to(o, { v: cloudTotal, duration: reducedMode ? 0 : 1.4, ease: 'power2.out', onUpdate: () => { cloudBytes.textContent = fmtBytes(o.v); } });
  }

  await wait(1100);
  island.classList.remove('is-thinking');
  think.classList.remove('is-thinking');
  think.textContent = '';
  for (let i = 0; i <= a.length; i += 2) {
    think.textContent = a.slice(0, i);
    await wait(16);
  }
  think.textContent = a;
  duel.classList.remove('is-sending');
  cloudOut.textContent = used >= QUOTA
    ? 'Ответ получен. Это был последний бесплатный запрос на сегодня.'
    : 'Ответ получен и сохранён в историю OY Assist в 0X Cloud.';
  done();
}));

/* ---------- OY OS 4.5: «Линзу» можно выключить ---------- */

const lensOff = $('[data-lens-off]');
lensOff?.addEventListener('change', () => {
  document.documentElement.classList.toggle('lens-off', lensOff.checked);
  toast(lensOff.checked ? '«Линза» выключена. Стекло стало просто стеклом. То есть непрозрачным.' : '«Линза» снова включена.');
});

/* ---------- OY OS 4.5: 83 дата-центра 0X Cloud на карте США ---------- */

const dcmap = $('[data-dcmap]');
if (dcmap) {
  // грубый контур континентальных США: строки сетки 20×10, у каждой — от и до по x
  const ROWS = [[2, 17], [1, 18], [1, 19], [1, 19], [1, 18], [2, 18], [3, 17], [4, 16], [6, 12], [12, 15]];
  const dots = [];
  ROWS.forEach(([a, b], y) => { for (let x = a; x <= b; x++) dots.push([x, y]); });
  dcmap.innerHTML = dots.map(([x, y]) => `<i style="left:${(x + 0.5) * 5}%;top:${(y + 0.5) * 10}%"></i>`).join('') + '<b data-dc-n>0</b>';
  const cells = Array.from(dcmap.querySelectorAll('i'));
  // 83 из 168 точек: детерминированный порядок, чтобы карта была одинаковой
  const order = cells.map((_, i) => [Math.sin(i * 12.9898) * 43758.5453 % 1, i]).sort((p, q) => p[0] - q[0]).slice(0, 83).map((p) => p[1]);
  const nEl = dcmap.querySelector('[data-dc-n]');
  let lit = false;
  const light = () => {
    if (lit) return;
    lit = true;
    order.forEach((idx, k) => setTimeout(() => { cells[idx].classList.add('is-dc'); nEl.textContent = String(k + 1); }, reducedMode ? 0 : k * 28));
  };
  new IntersectionObserver(([e], io) => { if (e.isIntersecting) { light(); io.disconnect(); } }, { threshold: 0.4 }).observe(dcmap);
}

/* ---------- Призрачный профиль ---------- */

const ghostScr = $('[data-ghost-screen]');
const ghostBtn = $('[data-ghost-reboot]');
ghostBtn.addEventListener('click', async () => {
  ghostBtn.disabled = true;
  if (ghostScr.classList.contains('is-empty')) {
    ghostScr.classList.remove('is-empty');
    ghostBtn.lastChild.textContent = 'Перезагрузить';
    ghostBtn.disabled = false;
    return;
  }
  ghostScr.classList.add('is-booting');
  await wait(1600);
  ghostScr.classList.add('is-empty');
  ghostScr.classList.remove('is-booting');
  ghostBtn.lastChild.textContent = 'Наполнить снова';
  ghostBtn.disabled = false;
});

/* ---------- PIN под принуждением ---------- */

const pin = $('[data-pin]');
const pinDots = $$('.pin__dots i', pin);
const pinTitle = $('[data-pin-title]');
const pinRes = $('[data-pin-res]');
let code = '';
function pinPaint() { pinDots.forEach((d, i) => d.classList.toggle('on', i < code.length)); }
function pinReset() {
  code = '';
  pin.classList.remove('is-real', 'is-decoy', 'is-wrong');
  pinTitle.textContent = 'Введите PIN';
  pinRes.textContent = '';
  pinPaint();
}
function pinCheck() {
  if (code === '2027') {
    pin.classList.add('is-real');
    pinTitle.textContent = 'Ваш телефон';
    pinRes.textContent = 'Фото 2 418 · Банк · Почта · Сейф. Всё на месте.';
  } else if (code === '1984') {
    pin.classList.add('is-decoy');
    pinTitle.textContent = 'Добро пожаловать';
    pinRes.textContent = 'Чистый профиль: калькулятор, погода, три фото заката. Настоящий профиль не виден даже в настройках.';
  } else {
    pin.classList.add('is-wrong');
    pinRes.textContent = 'Неверный PIN. Подсказка ниже.';
    setTimeout(() => { code = ''; pinPaint(); pin.classList.remove('is-wrong'); }, 450);
  }
}
pin.addEventListener('click', (e) => {
  const b = e.target.closest('[data-d]');
  if (!b) return;
  const d = b.dataset.d;
  if (d === 'reset') return pinReset();
  if (pin.classList.contains('is-real') || pin.classList.contains('is-decoy')) pinReset();
  if (d === 'back') code = code.slice(0, -1);
  else if (code.length < 4) code += d;
  pinPaint();
  if (code.length === 4) pinCheck();
});

/* ---------- Пасхалка: терминал ---------- */

const term = $('[data-term]');
const termOut = $('[data-term-out]');
const termIn = $('[data-term-in]');
let lastFocus = null;
const CMDS = {
  help: 'Команды: whoami, ls, cat /telemetry, uname, uptime, google, ads, sudo, cloud, pro, assist, clear, exit',
  whoami: 'anna@oyid.oy — вы вошли в OY ID. Приятно познакомиться.',
  ls: 'assist/  citadel/  cloud/  ghost/  gms/  oyid/  xpush/',
  'ls -a': '.  ..  assist/  citadel/  cloud/  ghost/  gms/  oyid/  xpush/\n.nothing_to_hide.bak',
  'cat /telemetry': ['cat: /telemetry: Отказано в доступе. Файл есть, просто он не ваш.', 'e'],
  uname: 'OY OS 4.0 «Линза» · aosp · aarch64 · reproducible build (системная часть)',
  'uname -a': 'OY OS 4.0 «Линза» · aosp · aarch64 · gms · oyid · 0x-cloud · sha256:9f3ac1e0…',
  uptime: 'Без разблокировки 2 ч. Резервная копия в 0X Cloud — через 4 ч.',
  google: 'com.google.android.gms: встроен в систему. Отключить — можно. Удалить — нельзя.',
  'rm -rf /system/gms': ['rm: /system/gms: Отказано. Сервисы Google — часть OY OS 4.', 'e'],
  ads: ['ads: команда не найдена. Пока.', 'e'],
  sudo: 'Вы и так владелец телефона. Права root — в настройках разработчика, после входа в OY ID.',
  cloud: '0X Cloud: занято 27,4 из 30 ГБ. Наберите pro — станет 240.',
  pro: '0X Cloud Pro: 240 ГБ и 100 запросов к OY Assist в день. $9,99 в месяц, оплата по OY ID.',
  'rm -rf /': 'Ого. Нет. Для этого есть «Сброс» в настройках — с подтверждением по OY ID.',
  siri: ['siri: команда не найдена. Хотя выглядим мы теперь похоже.', 'e'],
  assist: 'OY Assist 4: подключаюсь к 0X Cloud… Осталось запросов на сегодня: 3.',
};
function termPrint(text, cls = '') {
  const p = document.createElement('div');
  if (cls) p.className = cls;
  p.textContent = text;
  termOut.append(p);
  termOut.scrollTop = termOut.scrollHeight;
}
function termOpen() {
  if (!term.hidden) return;
  lastFocus = document.activeElement;
  term.hidden = false;
  smooth.lenis?.stop();
  if (!termOut.childElementCount) {
    termPrint('OY OS 4.0 — терминал. Вы вошли как anna@oyid.oy.', 'd');
    termPrint('Наберите help.', 'd');
  }
  termIn.focus();
}
function termClose() {
  term.hidden = true;
  smooth.lenis?.start();
  lastFocus?.focus?.();
}
$('[data-term-form]').addEventListener('submit', (e) => {
  e.preventDefault();
  const cmd = termIn.value.trim();
  termIn.value = '';
  if (!cmd) return;
  termPrint(`$ ${cmd}`, 'c');
  const key = cmd.toLowerCase().replace(/\s+/g, ' ');
  if (key === 'clear') { termOut.textContent = ''; return; }
  if (key === 'exit') { termClose(); return; }
  const r = CMDS[key];
  if (Array.isArray(r)) termPrint(r[0], r[1]);
  else if (r) termPrint(r);
  else termPrint(`${cmd.split(' ')[0]}: команда не найдена. Наберите help.`, 'e');
});
$('[data-term-open]').addEventListener('click', termOpen);
$('[data-term-close]').addEventListener('click', termClose);
term.addEventListener('click', (e) => { if (e.target === term) termClose(); });
document.addEventListener('keydown', (e) => {
  if (!term.hidden) {
    if (e.key === 'Escape') termClose();
    else if (e.key === 'Tab') { e.preventDefault(); termIn.focus(); }
    return;
  }
  const t = e.target;
  if (e.code !== 'Backquote' || e.ctrlKey || e.metaKey || e.altKey) return;
  if (t.closest?.('input, textarea, [contenteditable="true"]')) return;
  e.preventDefault();
  termOpen();
});

/* ---------- Движение: появления, параллакс, счётчики ---------- */

const splits = createSplitReveals($$('[data-split]'), { gsap });
const scrubItems = $$('[data-scrub-words]').map((n) => ({ el: n, spans: wrapWords(n) }));

gsap.matchMedia().add({ reduce: '(prefers-reduced-motion: reduce)', motion: '(prefers-reduced-motion: no-preference)' }, ({ conditions: { reduce } }) => {
  reducedMode = reduce;
  if (reduce) smooth.disable(); else smooth.enable();
  root.classList.toggle('reduced', reduce);
  splits.buildAll(reduce);
  scrubWords(scrubItems, { reduce, ScrollTrigger });

  $$('[data-reveal]').forEach((n) => {
    gsap.fromTo(n, { opacity: 0, y: reduce ? 0 : 24 }, { opacity: 1, y: 0, duration: reduce ? 0.4 : 0.9, ease: 'expo.out', scrollTrigger: { trigger: n, start: 'top 94%' } });
  });

  // Телефоны в герое выезжают снизу, потом расходятся с разной скоростью
  if (!reduce) {
    gsap.from('.os-lineup .ophone', { y: 120, opacity: 0, duration: 1.4, ease: 'expo.out', stagger: 0.12, delay: 0.15 });
    gsap.from('.os-chip', { scale: 0.6, opacity: 0, duration: 0.9, ease: 'back.out(1.6)', stagger: 0.15, delay: 0.8 });
    $$('[data-par]').forEach((n) => {
      gsap.to(n, { y: +n.dataset.par, ease: 'none', scrollTrigger: { trigger: '.os-hero', start: 'top top', end: 'bottom top', scrub: true } });
    });
    gsap.from('.timeline__bar', { scaleX: 0, duration: 1.4, ease: 'expo.out', stagger: 0.2, scrollTrigger: { trigger: '.timeline', start: 'top 85%' } });
  }

  $$('[data-count]').forEach((n) => {
    const to = +n.dataset.count;
    const o = { v: 0 };
    const paint = () => { n.textContent = Math.round(o.v).toLocaleString('ru-RU'); };
    if (reduce || to === 0) { o.v = to; paint(); return; }
    gsap.to(o, { v: to, duration: 2, ease: 'power2.out', onUpdate: paint, scrollTrigger: { trigger: n, start: 'top 90%' } });
  });

  return () => splits.unsplitAll();
});
