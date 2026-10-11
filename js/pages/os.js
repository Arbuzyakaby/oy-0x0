/* =========================================================================
   OY — страница OY OS 2. Без 3D: подменю с подсветкой раздела, параллакс
   макетов в герое, галерея «Что нового», демо OY Assist, карта запросов,
   призрачный профиль, PIN под принуждением, проверка хеша и терминал.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { $, $$, createToast, initRadioGroup, syncRadio } from '../core/ui.js';
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

/* ---------- OY Assist: облако против устройства ---------- */

const ANSWERS = [
  ['Сократи письмо от начальника до трёх строк', 'Отчёт нужен к пятнице. Цифры — из таблицы за третий квартал. Созвон переносится на четверг, 11:00.'],
  ['Что я обещал Марку на прошлой неделе?', 'В переписке от 4 ноября: вернуть дрель и скинуть фото с дачи. Дрель, судя по фото, всё ещё у вас.'],
  ['Найди фото чека из аптеки', 'Нашёл два снимка от 29 октября, сумма 1 240 ₽. Фото не покидали галерею.'],
  ['Переведи с французского меню на фото', '«Magret de canard» — утиная грудка. «Tarte Tatin» — перевёрнутый яблочный пирог. Берите второе.'],
];
const chat = $('[data-chat]');
const island = $('[data-assist-island]');
const duel = $('.duel--cloud');
const cloudBytes = $('[data-cloud-bytes]');
const cloudOut = $('[data-cloud-out]');
const plane = $('[data-plane]');
const qBtns = $$('[data-q]');
let cloudTotal = 0;

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
  cloudOut.textContent = plane.checked ? 'Нет сети. «Попробуйте позже».' : 'Ждёт вопроса.';
});
qBtns.forEach((b) => b.addEventListener('click', async () => {
  const [q, a] = ANSWERS[+b.dataset.q];
  qBtns.forEach((x) => { x.disabled = true; x.setAttribute('aria-pressed', String(x === b)); });
  bubble('chat__q', q);
  const think = bubble('chat__a is-thinking', 'Думаю на нейроядре…');
  island.classList.add('is-thinking');

  // Облачный ассистент: голос и контекст уходят на сервер
  if (!plane.checked) {
    duel.classList.add('is-sending');
    cloudOut.textContent = 'Отправляю запрос, голос и «контекст для персонализации»…';
    const add = 180000 + Math.random() * 260000;
    const o = { v: cloudTotal };
    cloudTotal += add;
    gsap.to(o, { v: cloudTotal, duration: reducedMode ? 0 : 1.4, ease: 'power2.out', onUpdate: () => { cloudBytes.textContent = fmtBytes(o.v); } });
  } else {
    cloudOut.textContent = 'Нет сети. «Попробуйте позже».';
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
  if (!plane.checked) cloudOut.textContent = 'Ответ получен. Копия запроса сохранена «для улучшения качества».';
  qBtns.forEach((x) => { x.disabled = false; });
}));

/* ---------- Карта запросов ---------- */

const C = { x: 320, y: 200 };
const APPS = {
  weather: [['api.meteo.oy', 120, 70, 0]],
  taxi: [['api.taxi.city', 110, 90, 0], ['tiles.oypos.eu', 520, 80, 0], ['app-measurement.com', 540, 300, 1], ['sdk.adjust.io', 120, 320, 1]],
  farm: [['cdn.farm.games', 110, 70, 0], ['ads.doubleclick.net', 540, 70, 1], ['graph.facebook.com', 560, 220, 1], ['app-measurement.com', 470, 340, 1], ['ads.unity3d.com', 160, 340, 1], ['sdk.appsflyer.com', 80, 210, 1]],
  chat: [['xpush.oy.eu', 140, 80, 0], ['relay.msg.net', 510, 110, 0]],
};
const blocked = new Set();
const svg = $('[data-req-svg]');
const reqStatus = $('[data-req-status]');
const blockBtn = $('[data-req-block]');
const appsGroup = $('[data-req-apps]');
let curApp = 'weather';
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent = svg) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  parent.append(n);
  return n;
};

const trackers = (app) => APPS[app].filter((h) => h[3]);
const isBlocked = (app) => blocked.has(app);
const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  const w = m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
  return `${n} ${w}`;
};
const nHosts = (n) => plural(n, 'адрес', 'адреса', 'адресов');
const nTrackers = (n) => plural(n, 'трекер', 'трекера', 'трекеров');
function updateMeta() {
  for (const app in APPS) {
    const m = $(`[data-req-meta="${app}"]`);
    const t = trackers(app).length;
    const hosts = APPS[app].length;
    m.classList.toggle('has-bad', t > 0 && !isBlocked(app));
    m.classList.toggle('is-clean', t === 0 || isBlocked(app));
    m.textContent = t === 0 ? `${nHosts(hosts)} · трекеров нет`
      : isBlocked(app) ? `${nTrackers(t)} перекрыто` : `${nHosts(hosts)} · ${nTrackers(t)}`;
  }
}
function drawMap() {
  svg.textContent = '';
  const grid = el('g', { class: 'rq-grid' });
  for (let x = 20; x < 640; x += 30) for (let y = 20; y < 400; y += 30) el('circle', { cx: x, cy: y, r: 1.2 }, grid);
  const hosts = APPS[curApp];
  for (const [, x, y, bad] of hosts) {
    const cls = `rq-line${bad ? ' bad' : ''}${bad && isBlocked(curApp) ? ' blocked' : ''}`;
    el('path', { class: cls, d: `M${C.x} ${C.y} Q ${(C.x + x) / 2} ${(C.y + y) / 2 - 40} ${x} ${y}` });
  }
  for (const [name, x, y, bad] of hosts) {
    const g = el('g', { class: `rq-node${bad ? ' bad' : ''}${bad && isBlocked(curApp) ? ' blocked' : ''}` });
    el('circle', { cx: x, cy: y, r: 9 }, g);
    el('path', { class: 'rq-x', d: `M${x - 5} ${y - 5}l10 10M${x + 5} ${y - 5}l-10 10` }, g);
    const t = el('text', { x, y: y + (y > C.y ? 28 : -18), 'text-anchor': 'middle' }, g);
    t.textContent = name;
  }
  const ph = el('g', { class: 'rq-phone' });
  el('rect', { x: C.x - 22, y: C.y - 38, width: 44, height: 76, rx: 10 }, ph);
  const lbl = el('text', { x: C.x, y: C.y + 4, 'text-anchor': 'middle' }, ph);
  lbl.textContent = 'OY';

  const t = trackers(curApp).length;
  if (t === 0) reqStatus.textContent = 'Трекеров нет. Перекрывать нечего.';
  else if (isBlocked(curApp)) reqStatus.textContent = `Перекрыто: ${t}. Приложение работает как раньше.`;
  else reqStatus.textContent = `Трекеров: ${t} из ${nHosts(APPS[curApp].length)}.`;
  blockBtn.disabled = t === 0;
  blockBtn.textContent = isBlocked(curApp) ? 'Вернуть как было' : 'Перекрыть трекеры';
  updateMeta();
}
function pickApp(v) { curApp = v; syncRadio(appsGroup, v); drawMap(); }
initRadioGroup(appsGroup, pickApp);
blockBtn.addEventListener('click', () => {
  if (isBlocked(curApp)) blocked.delete(curApp); else blocked.add(curApp);
  drawMap();
  if (isBlocked(curApp) && curApp === 'farm') toast('«Ферма» больше не рассказывает пяти компаниям, когда вы поливаете морковь.');
});
pickApp('weather');

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

/* ---------- Воспроизводимая сборка: сравнение хеша ---------- */

const HASH = 'sha256:9f3ac1e07b52d4e8a6f01c93b7d2e5f48a0c6b1d97e3f2a5c8b4d06e1f7a93c2';
const hashPub = $('[data-hash-pub]');
const hashMine = $('[data-hash-mine]');
const hashRes = $('[data-hash-res]');
const hashBtn = $('[data-hash-run]');
hashPub.textContent = HASH;
hashBtn.addEventListener('click', async () => {
  hashBtn.disabled = true;
  hashRes.textContent = '';
  const hex = '0123456789abcdef';
  const prefix = 'sha256:';
  for (let i = prefix.length; i <= HASH.length; i += 2) {
    let tail = '';
    for (let k = i; k < HASH.length; k++) tail += hex[(Math.random() * 16) | 0];
    hashMine.textContent = '';
    const ok = document.createElement('span');
    ok.className = 'm';
    ok.textContent = HASH.slice(0, i);
    hashMine.append(ok, tail);
    await wait(28);
  }
  hashRes.textContent = '✓ Совпадает до байта';
  hashBtn.disabled = false;
  hashBtn.textContent = 'Собрать ещё раз';
});

/* ---------- Пасхалка: терминал ---------- */

const term = $('[data-term]');
const termOut = $('[data-term-out]');
const termIn = $('[data-term-in]');
let lastFocus = null;
const CMDS = {
  help: 'Команды: whoami, ls, cat /telemetry, uname, uptime, google, ads, sudo, cloud, clear, exit',
  whoami: 'Мы не знаем. Это и есть фича.',
  ls: 'assist/  citadel/  ghost/  sandbox/  xpush/\n(папки telemetry/ нет. Искали.)',
  'ls -a': '.  ..  assist/  citadel/  ghost/  sandbox/  xpush/\n.nothing_to_hide',
  'cat /telemetry': ['cat: /telemetry: Нет такого файла или каталога', 'e'],
  uname: 'OY OS 2.0 · aosp · aarch64 · reproducible build',
  'uname -a': 'OY OS 2.0 · aosp · aarch64 · reproducible build · sha256:9f3ac1e0…',
  uptime: 'Без разблокировки 2 ч. Через 16 ч перезагрузимся сами — для надёжности.',
  google: ['google: команда не найдена', 'e'],
  ads: ['ads: команда не найдена. И не будет.', 'e'],
  sudo: 'Вы и так владелец телефона. Права root — в настройках разработчика, без звонка в поддержку.',
  cloud: 'Облако — это чужой компьютер. У вас есть свой.',
  'rm -rf /': 'Ого. Нет. Для этого есть «Сброс» в настройках — с подтверждением.',
  siri: ['siri: команда не найдена. Попробуйте assist.', 'e'],
  assist: 'OY Assist: работаю локально. Сеть: 0 Б. Чем помочь?',
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
    termPrint('OY OS 2.0 — терминал. Вы ничего не отправляете, мы ничего не получаем.', 'd');
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
