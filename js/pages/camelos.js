/* =========================================================================
   CamelOS 2.0 — страница /os/. Без 3D: подменю с подсветкой раздела,
   гонка «первая минута после включения», первая настройка без аккаунта,
   «Караван» между устройствами, «Погонщик», «Привал», «Сторож», сверка
   хеша и терминал. Ничего никуда не отправляется: сайту нечем.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { $, $$, createToast, syncRadio, initRadioGroup } from '../core/ui.js';
import { createSmoothScroll } from '../core/scroll.js';
import { createSplitReveals } from '../core/text.js';

gsap.registerPlugin(ScrollTrigger);
const root = document.documentElement;
root.classList.add('anim');
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ });
const toast = createToast($('#toast'), gsap);
let reducedMode = reduceMQ.matches;
const wait = (ms) => new Promise((r) => setTimeout(r, reducedMode ? Math.min(ms, 60) : ms));
const fmt = (n) => n.toLocaleString('ru-RU');

/* ---------- Часы на экранах устройств ---------- */

function tick() {
  const d = new Date();
  const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  $$('[data-clock]').forEach((n) => { n.textContent = t; });
}
tick();
setInterval(tick, 15000);

/* ---------- Подменю: подсветка раздела, шапка уезжает после героя ---------- */

const tabs = $$('.cm-tab');
const tabTrack = $('.cm-tabs__track');
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
ScrollTrigger.create({ start: () => window.innerHeight * 0.6, end: 'max', onToggle: (st) => root.classList.toggle('cm-stuck', st.isActive) });

/* ---------- Вырезано: первая минута после включения ---------- */

{
  const go = $('[data-race-go]');
  const oldN = $('[data-race-old]');
  const newN = $('[data-race-new]');
  const log = $('[data-race-log-old]');
  const time = $('[data-race-time]');
  const HOSTS = [
    'oyid.oy/auth', 'cloud.0x.oy/sync/photos', 'cloud.0x.oy/sync/contacts', 'android.googleapis.com', 'play.googleapis.com',
    'telemetry.oy/v4/boot', 'assist.0x.oy/warmup', 'xpush.oy/register', 'ads.oy/consent', 'gms.oy/checkin',
    'metrics.oy/lens/fps', 'store.oy/recommend', 'cloud.0x.oy/backup', 'maps.oy/tiles', 'oyid.oy/family',
    'crash.oy/report', 'pro.0x.oy/offer', 'time.oy/ntp', 'firebaseinstallations.googleapis.com', 'memories.0x.oy/faces',
  ];
  const TOTAL = 1870;
  let running = false;

  go.addEventListener('click', async () => {
    if (running) return;
    running = true;
    go.disabled = true;
    log.textContent = '';
    oldN.textContent = '0';
    newN.textContent = '0';
    const dur = reducedMode ? 0.4 : 6;
    const st = { t: 0 };
    let shown = 0;
    await new Promise((done) => {
      gsap.to(st, {
        t: 1, duration: dur, ease: 'none',
        onUpdate() {
          // соединения идут волнами: при старте, при входе в OY ID, при синхронизации
          const k = st.t;
          const n = Math.round(TOTAL * (k < 0.2 ? k * 2.4 : 0.48 + (k - 0.2) * 0.65));
          oldN.textContent = fmt(Math.min(n, TOTAL));
          const s = Math.round(k * 60);
          time.textContent = `00:${String(s).padStart(2, '0')} / 01:00`;
          const lines = Math.floor(k * 46);
          while (shown < lines) {
            const li = document.createElement('li');
            const a = document.createElement('span');
            const b = document.createElement('span');
            a.textContent = `00:${String(Math.round((shown / 46) * 60)).padStart(2, '0')}`;
            b.textContent = HOSTS[(shown * 7) % HOSTS.length];
            li.append(a, b);
            log.append(li);
            if (log.childElementCount > 14) log.firstElementChild.remove();
            shown++;
          }
        },
        onComplete: done,
      });
    });
    oldN.textContent = fmt(TOTAL);
    time.textContent = '01:00 / 01:00';
    go.textContent = 'Ещё раз';
    go.disabled = false;
    running = false;
  });
}

/* ---------- Первое включение: четыре шага и ни одного аккаунта ---------- */

{
  const screen = $('[data-setup-screen]');
  const panes = $$('[data-pane]', screen);
  const steps = $$('[data-setup-steps] li');
  const next = $('[data-setup-next]');
  const back = $('[data-setup-back]');
  const uiName = $('[data-ui-name]');
  const sum = $('[data-setup-sum]');
  const NAMES = { '#2F6BFF': 'Луч', '#C9A15B': 'Бархан', '#3FB58A': 'Оазис', '#E0574F': 'Фонарь', '#B9C2D6': 'Луна' };
  let step = 0;

  $$('[data-choice]', screen).forEach((g) => {
    initRadioGroup(g, (v) => {
      syncRadio(g, v);
      if (g.dataset.choice === 'ui') { screen.style.setProperty('--ui', v); uiName.textContent = NAMES[v]; }
      if (g.dataset.choice === 'font') screen.dataset.font = v;
    });
  });
  $$('.cm-opts [role="switch"]', screen).forEach((b) => {
    b.addEventListener('click', () => b.setAttribute('aria-checked', String(b.getAttribute('aria-checked') !== 'true')));
  });

  function show(i) {
    step = i;
    panes.forEach((p, n) => { p.hidden = n !== i; });
    steps.forEach((s, n) => { s.classList.toggle('is-on', n === i); s.classList.toggle('is-done', n < i); });
    back.disabled = i === 0;
    next.textContent = i === 4 ? 'Сначала' : i === 3 ? 'Готово' : 'Дальше';
    if (i === 4) {
      const on = $$('.cm-opts li', screen).filter((li) => $('[role="switch"]', li).getAttribute('aria-checked') === 'true').map((li) => $('span', li).textContent);
      const net = on.includes('Сеть сразу');
      const rest = on.filter((x) => x !== 'Сеть сразу');
      sum.textContent = `${rest.length ? `Включено: ${rest.join(', ')}.` : 'Всё выключено. Тоже можно.'} Сеть: ${net ? 'включена' : 'когда попросите'}. Ни почты, ни пароля от облака, ни одной галочки «я согласен».`;
    }
    gsap.fromTo(panes[i], { opacity: 0, x: reducedMode ? 0 : 18 }, { opacity: 1, x: 0, duration: 0.45, ease: 'expo.out' });
  }
  next.addEventListener('click', () => show(step === 4 ? 0 : step + 1));
  back.addEventListener('click', () => { if (step > 0) show(step - 1); });
}

/* ---------- Караван: телефон, ноутбук и часы напрямую ---------- */

{
  const box = $('[data-caravan]');
  const pkt = $('[data-pkt]');
  const out = $('[data-node-out]');
  const inn = $('[data-node-in]');
  const watch = $('[data-node-watch]');
  const log = $('[data-caravan-log]');
  const phone = $('[data-node="phone"]', box);
  const laptop = $('[data-node="laptop"]', box);
  const awayBtn = $('[data-send="away"]');
  let away = false;
  let busy = false;

  async function fly(reverse = false) {
    if (reducedMode) return;
    await gsap.fromTo(pkt, { left: reverse ? '100%' : '0%', opacity: 1, y: 0 }, {
      left: reverse ? '0%' : '100%', duration: 0.9, ease: 'power2.inOut',
      keyframes: { y: [0, reverse ? 14 : -14, 0] },
    });
    gsap.to(pkt, { opacity: 0, duration: 0.2 });
  }
  function hit(node) {
    node.classList.add('is-hit');
    setTimeout(() => node.classList.remove('is-hit'), 900);
  }

  const ACTS = {
    async text() {
      out.textContent = 'скопировано: Klarabergsviadukten 63';
      await fly();
      inn.textContent = 'вставлено: Klarabergsviadukten 63';
      hit(laptop);
      return 'Буфер обмена: телефон → ноутбук за 0,2 с. Серверов по пути: 0.';
    },
    async file() {
      out.textContent = 'IMG_0412.heic · 14 МБ';
      await fly();
      inn.textContent = 'Загрузки/IMG_0412.heic';
      hit(laptop);
      return 'Фото 14 МБ по Wi-Fi Direct за 0,6 с. Без сжатия и без копии где-то ещё.';
    },
    async call() {
      out.textContent = 'входящий: Мама';
      await fly();
      inn.textContent = 'разговор · 00:04 · микрофон KBook';
      watch.textContent = 'Мама · на ноутбуке';
      hit(laptop);
      return 'Звонок пришёл на телефон, разговариваете с ноутбука. Голос идёт напрямую, зашифрованный.';
    },
  };

  $$('[data-send]', box.parentElement).forEach((b) => {
    b.addEventListener('click', async () => {
      if (busy) return;
      if (b.dataset.send === 'away') {
        away = !away;
        b.setAttribute('aria-pressed', String(away));
        b.textContent = away ? 'Вернуться к ноутбуку' : 'Уйти от ноутбука';
        laptop.classList.toggle('is-locked', away);
        inn.textContent = away ? 'заперт: часы дальше 3 м' : 'открыт: часы рядом';
        watch.textContent = away ? 'ушли · 4 м' : 'на руке';
        log.textContent = away ? 'Osmium X0 отошёл дальше трёх метров, KBook заперся сам. Пароль не понадобится, когда вернётесь.' : 'Часы снова рядом. Ноутбук открылся.';
        return;
      }
      if (away) { log.textContent = 'Ноутбук заперт: вы далеко. Сначала вернитесь.'; hit(laptop); return; }
      busy = true;
      hit(phone);
      log.textContent = await ACTS[b.dataset.send]();
      busy = false;
    });
  });
  awayBtn.setAttribute('aria-pressed', 'false');
}

/* ---------- Погонщик: ответ печатается, когда ячейка на экране ---------- */

$$('[data-typer]').forEach((el) => {
  const text = el.dataset.typer;
  let n = 0;
  let on = false;
  ScrollTrigger.create({ trigger: el, start: 'top 90%', end: 'bottom top', onToggle: (st) => { on = st.isActive; } });
  setInterval(() => {
    if (reducedMode) { el.textContent = text; return; }
    if (!on) return;
    if (n < text.length) el.textContent = text.slice(0, ++n);
  }, 38);
});

/* ---------- Привал: замолкают все устройства сразу ---------- */

{
  const btn = $('[data-halt]');
  const lbl = $('[data-halt-lbl]');
  btn.addEventListener('click', () => {
    const on = btn.getAttribute('aria-checked') !== 'true';
    btn.setAttribute('aria-checked', String(on));
    lbl.textContent = on ? 'Привал до 07:00 · три устройства' : 'Привал выключен';
    root.classList.toggle('cm-halted', on);
    if (on) toast('Телефон, часы и ноутбук замолчали. Будильник на 07:00 остался.');
  });
}

/* ---------- Сторож: двери в сеть ---------- */

{
  const list = $('[data-guard]');
  const counter = $('[data-guard-blocked]');
  let blocked = 0;
  let visible = false;
  ScrollTrigger.create({ trigger: list, start: 'top bottom', end: 'bottom top', onToggle: (st) => { visible = st.isActive; } });
  const paint = (li, sw) => li.classList.toggle('is-shut', sw.getAttribute('aria-checked') !== 'true');
  $$('li', list).forEach((li) => {
    const sw = $('[role="switch"]', li);
    paint(li, sw);
    sw.addEventListener('click', () => {
      const on = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', String(on));
      paint(li, sw);
      if (on && sw.hasAttribute('data-guard-oyid')) {
        toast('Пустили. oyid.oy сразу ответил: «Войдите в OY ID». Закрыли обратно.');
        setTimeout(() => { sw.setAttribute('aria-checked', 'false'); paint(li, sw); }, reducedMode ? 0 : 1400);
      }
    });
  });
  setInterval(() => {
    if (!visible || document.hidden) return;
    const shut = $$('li.is-shut', list).length;
    if (!shut) return;
    blocked += shut + (Math.random() < 0.4 ? 1 : 0);
    counter.textContent = fmt(blocked);
  }, 650);
}

/* ---------- Открытый код: сверка хеша ---------- */

{
  const a = $('[data-hash-a]');
  const b = $('[data-hash-b]');
  const res = $('[data-hash-res]');
  const go = $('[data-hash-go]');
  const HASH = '7c3e91a0d4b25f88e6017ac9b3d54e2f90a6c8178bd3e45f0c29a7716e8d4b03';
  let busy = false;

  async function type(el, from) {
    for (let i = 0; i <= HASH.length; i += reducedMode ? HASH.length : 2) {
      el.textContent = `sha256:${HASH.slice(0, i)}${'·'.repeat(HASH.length - i)}`;
      await wait(from);
    }
  }
  go.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    go.disabled = true;
    res.textContent = 'Считаем хеш системного раздела…';
    await type(a, 18);
    res.textContent = 'Собираем из исходников (в жизни это час, здесь пара секунд)…';
    await type(b, 26);
    // подсвечиваем совпадение по символам
    for (const el of [a, b]) {
      el.textContent = 'sha256:';
      const i = document.createElement('i');
      i.textContent = HASH;
      el.append(i);
    }
    res.textContent = 'Совпадает: 64 из 64. Это та самая сборка, без вставок.';
    go.textContent = 'Сверить ещё раз';
    go.disabled = false;
    busy = false;
  });
}

/* ---------- Пасхалка: терминал ---------- */

const term = $('[data-term]');
const termOut = $('[data-term-out]');
const termIn = $('[data-term-in]');
let lastFocus = null;
const CMDS = {
  help: 'Команды: whoami, ls, uname, uptime, cat /telemetry, oyid, cloud, pro, google, assist, caravan, beacon, sudo, clear, exit',
  whoami: 'вы. Больше CamelOS о вас ничего не знает и не спрашивает.',
  ls: 'Документы/  Загрузки/  Колодец/  Фото/  Караван/',
  'ls -a': '.  ..  Документы/  Загрузки/  Колодец/  Фото/  Караван/\n.oy_os_4.5.rollback  (удалится через 30 дней)',
  uname: 'CamelOS 2.0 · oasis 2 · aarch64 · воспроизводимая сборка',
  'uname -a': 'CamelOS 2.0 · oasis 2 · aarch64 · sha256:7c3e91a0d4b2… · открыт весь код',
  uptime: 'Без перезагрузки 11 дней. Без связи с серверами: всё время.',
  'cat /telemetry': ['cat: /telemetry: нет такого файла. И не было.', 'e'],
  oyid: ['oyid: команда не найдена. Удалена в CamelOS 2.0.', 'e'],
  cloud: ['cloud: команда не найдена. Облако осталось у XNA. Наберите caravan.', 'e'],
  pro: ['pro: подписок в системе нет. Ни одной.', 'e'],
  google: 'Сервисов Google в системе нет. Хотите приложение: песочница, контакты в ней пусты.',
  assist: 'OY Assist теперь «Погонщик». На устройстве, без лимита, в авиарежиме.',
  caravan: 'Караван: рядом 0X2 Pro (Wi-Fi Direct) и Osmium X0 (Bluetooth LE). Серверов: 0.',
  beacon: 'Маяк: часы в 2 м, телефон в 40 см. Облако для этого не понадобилось.',
  sudo: 'Вы и так владелец. Root — в настройках, после PIN. Без аккаунта.',
  'rm -rf /': 'Нет. Для этого есть «Сброс» в настройках. С вашим PIN, а не с нашим разрешением.',
  siri: ['siri: команда не найдена. И стекла мы тоже не делали.', 'e'],
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
    termPrint('CamelOS 2.0 · терминал. Входить не нужно.', 'd');
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

/* ---------- Движение: появления и параллакс устройств в герое ---------- */

const splits = createSplitReveals($$('[data-split]'), { gsap });

gsap.matchMedia().add({ reduce: '(prefers-reduced-motion: reduce)', motion: '(prefers-reduced-motion: no-preference)' }, ({ conditions: { reduce } }) => {
  reducedMode = reduce;
  if (reduce) smooth.disable(); else smooth.enable();
  root.classList.toggle('reduced', reduce);
  splits.buildAll(reduce);

  $$('[data-reveal]').forEach((n) => {
    gsap.fromTo(n, { opacity: 0, y: reduce ? 0 : 24 }, { opacity: 1, y: 0, duration: reduce ? 0.4 : 0.9, ease: 'expo.out', scrollTrigger: { trigger: n, start: 'top 94%' } });
  });

  if (!reduce) {
    // устройства поднимаются из-за барханов по очереди: ноутбук, телефон, часы
    gsap.from('.cm-trio > *', { y: 140, opacity: 0, duration: 1.5, ease: 'expo.out', stagger: 0.14, delay: 0.15 });
    $$('[data-par]').forEach((n) => {
      gsap.to(n, { y: +n.dataset.par, ease: 'none', scrollTrigger: { trigger: '.cm-hero', start: 'top top', end: 'bottom top', scrub: true } });
    });
  }

  return () => splits.unsplitAll();
});
