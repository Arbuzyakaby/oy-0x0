/* =========================================================================
   Fyr KBook 1 — акт II: страница становится рабочим столом CamelOS.
   Обои (те же дюны, что на экране 3D-ноутбука), строка CamelOS с часами,
   окна, которые двигают за заголовок, и демо: терминал загрузки, первая
   настройка, RTDS, «Мираж», «Часы рядом», «Корзина», уведомления.
   ========================================================================= */

import { drawDesk } from '../models/fyrkbook.js';
import { $, $$ } from '../core/ui.js';

const pad2 = (n) => String(n).padStart(2, '0');
const HEX = (n) => `0x${n.toString(16).toUpperCase()}`;

export function initDesk({ toast, reduceMQ, onAccent }) {
  const desk = $('[data-desk]');
  if (!desk) return;
  const root = document.documentElement;
  const reduced = () => reduceMQ.matches;

  /* ---------- Видимость рабочего стола ---------- */
  let deskOn = false;
  new IntersectionObserver((es) => { deskOn = es.some((e) => e.isIntersecting); if (deskOn) drawWall(); }, { threshold: 0 }).observe(desk);

  /* ---------- Обои ---------- */
  const wall = $('[data-desk-wall]');
  let accent = '#2F6BFF';
  function sizeWall() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    wall.width = Math.round(window.innerWidth * dpr);
    wall.height = Math.round(window.innerHeight * dpr);
  }
  function drawWall(now = performance.now()) { drawDesk(wall, { now, accent }); }
  sizeWall();
  drawWall();
  window.addEventListener('resize', () => { sizeWall(); drawWall(); });
  let lastWall = 0;
  (function loop(now) {
    requestAnimationFrame(loop);
    if (!deskOn || reduced() || document.hidden || now - lastWall < 66) return;
    lastWall = now;
    drawWall(now);
  })(0);

  /* ---------- Часы в строке и в RTDS ---------- */
  const clock = $('[data-desk-clock]');
  const rtdsClocks = $$('[data-rtds-clock]');
  setInterval(() => {
    const d = new Date();
    clock.textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    const t = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
    rtdsClocks.forEach((c) => { c.textContent = t; });
  }, 1000);

  /* ---------- Окна: перетаскивание за заголовок ---------- */
  const desktop = window.matchMedia('(min-width: 761px)');
  $$('[data-win]').forEach((win) => {
    const bar = win.querySelector('[data-win-drag]');
    let drag = null;
    const pos = { x: 0, y: 0 };
    bar.addEventListener('pointerdown', (e) => {
      if (!desktop.matches || e.button !== 0) return;
      bar.setPointerCapture(e.pointerId);
      drag = { x: e.clientX - pos.x, y: e.clientY - pos.y };
      win.classList.add('is-drag');
    });
    bar.addEventListener('pointermove', (e) => {
      if (!drag) return;
      pos.x = Math.max(-400, Math.min(400, e.clientX - drag.x));
      pos.y = Math.max(-200, Math.min(200, e.clientY - drag.y));
      win.style.setProperty('--dx', `${pos.x}px`);
      win.style.setProperty('--dy', `${pos.y}px`);
    });
    const end = () => { drag = null; win.classList.remove('is-drag'); };
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
    // двойной щелчок — окно на место
    bar.addEventListener('dblclick', () => { pos.x = pos.y = 0; win.style.removeProperty('--dx'); win.style.removeProperty('--dy'); });
  });

  /* ---------- 8. Терминал печатается строка за строкой ---------- */
  const term = $('[data-term]');
  const lines = $$('span', term).filter((s) => s.parentElement === term);
  if (!reduced()) {
    lines.forEach((l) => l.style.setProperty('--o', '0'));
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      io.disconnect();
      lines.forEach((l, i) => setTimeout(() => l.style.setProperty('--o', '1'), 180 + i * 260));
    }, { threshold: 0.4 });
    io.observe(term);
  }

  /* ---------- 9. Первая настройка ---------- */
  const form = $('[data-setup]');
  const steps = $$('[data-step]', form);
  const stepOut = $('[data-setup-step]');
  const prev = $('[data-setup-prev]');
  const next = $('[data-setup-next]');
  const done = $('[data-setup-done]');
  const sum = $('[data-setup-sum]');
  const host = $('[data-desk-host]');
  let step = 0;
  const FONTS = { sans: 'var(--sans)', mono: 'var(--mono)', system: 'system-ui, -apple-system, "Segoe UI", sans-serif' };
  function renderStep() {
    const finished = step >= steps.length;
    steps.forEach((f, i) => { f.hidden = i !== step; });
    done.hidden = !finished;
    prev.disabled = step === 0;
    next.textContent = finished ? 'Сначала' : step === steps.length - 1 ? 'Готово' : 'Дальше';
    stepOut.textContent = finished ? 'готово' : `${HEX(step + 1)} / ${HEX(steps.length)}`;
    if (finished) {
      sum.innerHTML = '';
      steps.forEach((f) => {
        const legend = f.querySelector('legend').textContent;
        const vals = $$('input:checked, input[type="text"]', f).map((i) => i.dataset.label || i.value).filter(Boolean);
        const dt = document.createElement('dt');
        dt.textContent = legend;
        const dd = document.createElement('dd');
        dd.textContent = vals.join(', ') || 'ничего';
        sum.append(dt, dd);
      });
    }
  }
  next.addEventListener('click', () => {
    step = step >= steps.length ? 0 : step + 1;
    renderStep();
  });
  prev.addEventListener('click', () => { step = Math.max(0, step - 1); renderStep(); });
  form.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'ac') {
      accent = t.value;
      root.style.setProperty('--desk-accent', accent);
      drawWall();
      onAccent?.();
    } else if (t.name === 'fo') {
      root.style.setProperty('--desk-font', FONTS[t.value] || FONTS.sans);
    } else if (t.name === 'snd' && t.value !== 'Тишина') {
      toast(t.value === 'Верблюд' ? 'Звук включения: верблюд. Негромко.' : 'Звук включения: маяк. Один короткий сигнал.');
    }
  });
  form.addEventListener('input', (e) => {
    if (e.target.name === 'host') host.textContent = e.target.value.trim() || 'kbook';
  });
  form.querySelector('input[name="acc"][disabled]')?.closest('label').addEventListener('click', () => toast('OY ID здесь недоступен. Наконец-то это не наша проблема.'));
  renderStep();

  /* ---------- 10. RTDS: граница между системами ---------- */
  const rtds = $('[data-rtds]');
  const div = $('[data-rtds-div]');
  const outL = $('[data-rtds-left]');
  const outR = $('[data-rtds-right]');
  const loadL = $$('[data-rtds-load-l] i');
  const loadR = $$('[data-rtds-load-r] i');
  let split = 50;
  function setSplit(v) {
    split = Math.max(25, Math.min(75, v));
    rtds.style.setProperty('--split', `${split}%`);
    div.setAttribute('aria-valuenow', String(Math.round(split)));
    const cpuL = Math.max(2, Math.min(10, Math.round((12 * split) / 100)));
    const gpuL = Math.max(2, Math.min(14, Math.round((16 * split) / 100)));
    outL.textContent = `CPU ${cpuL} · GPU ${gpuL}`;
    outR.textContent = `CPU ${12 - cpuL} · GPU ${16 - gpuL}`;
    div.setAttribute('aria-valuetext', `CamelOS ${cpuL} ядер, вторая система ${12 - cpuL}`);
  }
  let rd = null;
  div.addEventListener('pointerdown', (e) => { div.setPointerCapture(e.pointerId); rd = rtds.getBoundingClientRect(); });
  div.addEventListener('pointermove', (e) => { if (rd) setSplit(((e.clientX - rd.left) / rd.width) * 100); });
  const endRd = () => { rd = null; };
  div.addEventListener('pointerup', endRd);
  div.addEventListener('pointercancel', endRd);
  div.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowLeft' ? -5 : e.key === 'ArrowRight' ? 5 : 0;
    if (d) { e.preventDefault(); setSplit(split + d); }
  });
  setSplit(50);
  // нагрузка на обеих половинах «живёт» одновременно
  setInterval(() => {
    if (!deskOn) return;
    const jig = (arr) => arr.forEach((i) => i.style.setProperty('--h', `${15 + Math.random() * 80}%`));
    jig(loadL);
    jig(loadR);
  }, reduced() ? 4000 : 900);

  /* ---------- 11. «Мираж» ---------- */
  const app = $('[data-mirage-app]');
  const bar = $('[data-mirage-bar]');
  const pct = $('[data-mirage-pct]');
  const dock = $('[data-mirage-dock]');
  const run = $('[data-mirage-run]');
  run.addEventListener('click', () => {
    if (app.classList.contains('is-running')) return;
    app.classList.remove('is-landed');
    app.classList.add('is-running');
    bar.style.setProperty('--w', '0%');
    pct.textContent = '0 %';
    run.disabled = true;
    const t0 = performance.now();
    const dur = reduced() ? 0 : 1600;
    (function step() {
      const k = dur ? Math.min(1, (performance.now() - t0) / dur) : 1;
      pct.textContent = `${Math.round(k * 90)} %`;
      if (k < 1) requestAnimationFrame(step);
    })();
    requestAnimationFrame(() => bar.style.setProperty('--w', '90%'));
    setTimeout(() => {
      app.classList.remove('is-running');
      app.classList.add('is-landed');
      if (!dock.querySelector('.is-new')) {
        const s = document.createElement('span');
        s.className = 'mono is-new';
        s.textContent = 'setup.exe';
        dock.append(s);
      }
      run.disabled = false;
      run.textContent = 'Запустить ещё раз';
      toast('x86 работает почти как нативное. Почти — это 90 %.');
    }, dur + 200);
  });

  /* ---------- 12. «Часы рядом» ---------- */
  const watch = $('[data-watch]');
  const wIn = $('[data-watch-input]');
  const wOut = $('[data-watch-out]');
  function renderWatch() {
    const v = Number(wIn.value);
    wOut.textContent = `${String(v).replace('.', ',')} м`;
    watch.classList.toggle('is-locked', v > 3);
  }
  wIn.addEventListener('input', renderWatch);
  renderWatch();

  /* ---------- 13. «Корзина» ---------- */
  const list = $('[data-trash-list]');
  const empty = $('[data-trash-empty]');
  const clear = $('[data-trash-clear]');
  const restore = $('[data-trash-restore]');
  const original = list.innerHTML;
  const scramble = (el, done) => {
    const text = el.textContent;
    let n = 0;
    const iv = setInterval(() => {
      n += 1;
      el.textContent = text.split('').map((c, i) => (i < n * 2 || c === ' ' ? ' ' : '0123456789ABCDEF'[Math.floor(Math.random() * 16)])).join('');
      if (n * 2 >= text.length) { clearInterval(iv); done(); }
    }, 40);
  };
  clear.addEventListener('click', () => {
    const items = $$('li', list);
    clear.disabled = true;
    const finish = () => {
      list.hidden = true;
      empty.hidden = false;
      clear.hidden = true;
      restore.hidden = false;
      clear.disabled = false;
    };
    if (reduced()) { finish(); return; }
    let left = items.length;
    items.forEach((li, i) => setTimeout(() => scramble(li, () => { li.style.opacity = '0'; if (--left === 0) setTimeout(finish, 200); }), i * 120));
  });
  restore.addEventListener('click', () => {
    list.innerHTML = original;
    list.hidden = false;
    empty.hidden = true;
    clear.hidden = false;
    restore.hidden = true;
    toast('Вернули. Не понимаем зачем, но выбор ваш.');
  });

  /* ---------- Уведомления CamelOS ---------- */
  const notes = $('[data-desk-notes]');
  const NOTES = [
    ['CamelOS', 'Найдено подписок OY: 0'],
    ['Ассистент', 'Не установлен. Вопросов: ∞'],
    ['D1', 'Хеш системы сошёлся. Мы проверили'],
    ['Батарея', 'Осталось 23 ч 58 мин. Розетка не нужна'],
    ['Oasis', 'Обновление ядра: changelog открыт целиком'],
    ['Облако', '0 ГБ из 0 ГБ. Хранить у нас нечего'],
    ['OY ID', 'Команда не найдена'],
    ['Рубильник', 'Радио можно выключить пальцем. Физически'],
  ];
  let ni = 0;
  setInterval(() => {
    if (!deskOn || document.hidden) return;
    const [t, b] = NOTES[ni++ % NOTES.length];
    const el = document.createElement('div');
    el.className = 'desk-note';
    el.innerHTML = '<b></b><span></span>';
    el.children[0].textContent = t;
    el.children[1].textContent = b;
    notes.append(el);
    while (notes.children.length > 2) notes.firstElementChild.remove();
    setTimeout(() => { el.classList.add('is-out'); setTimeout(() => el.remove(), 320); }, 4800);
  }, 6500);
}
