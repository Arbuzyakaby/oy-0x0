/* =========================================================================
   OY OS 4 — демо новых функций на странице /os/: вход в OY ID, место
   в 0X Cloud и подписка Pro, стекло «Линзы», встроенные сервисы Google,
   стили главного экрана, «Воспоминания» и обновление ночью.
   Чистый JS, ничего никуда не отправляется: ни облака, ни OY ID у сайта нет.
   ========================================================================= */

import { gsap } from 'gsap';
import { $, $$, createToast, initRadioGroup, syncRadio } from '../core/ui.js';

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const wait = (ms) => new Promise((r) => setTimeout(r, reduce.matches ? Math.min(ms, 60) : ms));
const toast = createToast($('#toast'), gsap);
const gb = (n) => n.toFixed(1).replace('.', ',');

/* ---------- OY ID: войти легко, отказаться — по кругу ---------- */

{
  const screen = $('[data-id-screen]');
  const avatar = $('.g-avatar', screen);
  const title = $('[data-id-title]');
  const text = $('[data-id-text]');
  const log = $('[data-id-log]');
  const inBtn = $('[data-id-in]');
  const skipBtn = $('[data-id-skip]');
  const STEPS = [
    'OY ID: anna@oyid.oy ✓',
    'Контакты → 0X Cloud · 1 204 ✓',
    'Фото → 0X Cloud · 8 412 ✓',
    'Пароли → 0X Cloud · 96 ✓',
    'История OY Assist → 0X Cloud ✓',
    'Сервисы Google → вход выполнен ✓',
    'Условия (148 страниц) → приняты ✓',
  ];
  let state = 'out';
  let skips = 0;
  let busy = false;

  function paint(t, p) { title.textContent = t; text.textContent = p; }
  function reset() {
    state = 'out';
    avatar.textContent = '?';
    screen.classList.remove('is-in');
    log.textContent = '';
    paint('Войдите в OY ID', skips ? `Чтобы пользоваться 0X Cloud, OY Assist и OY Store. Напоминание № ${skips + 1}.` : 'Чтобы пользоваться 0X Cloud, OY Assist и OY Store.');
    inBtn.lastChild.textContent = 'Войти с OY ID';
    skipBtn.textContent = 'Не сейчас';
    skipBtn.hidden = false;
  }

  inBtn.addEventListener('click', async () => {
    if (busy) return;
    if (state === 'in') {
      toast('Чтобы выйти, введите пароль OY ID. Данные в 0X Cloud останутся.');
      reset();
      return;
    }
    busy = true;
    state = 'in';
    skipBtn.hidden = true;
    avatar.textContent = 'А';
    screen.classList.add('is-in');
    paint('Анна, добро пожаловать', 'Переносим всё ваше в 0X Cloud…');
    log.textContent = '';
    for (const t of STEPS) {
      const li = document.createElement('li');
      li.textContent = t;
      log.append(li);
      await wait(420);
    }
    paint('Готово', 'Всё ваше — теперь везде.');
    inBtn.lastChild.textContent = 'Выйти из OY ID';
    busy = false;
  });

  skipBtn.addEventListener('click', () => {
    if (state === 'out') {
      state = 'warn';
      paint('Без OY ID недоступны', '0X Cloud, OY Assist, OY Store, «Найти OY», обновления приложений и резервная копия.');
      skipBtn.textContent = 'Всё равно пропустить';
    } else if (state === 'warn') {
      state = 'later';
      skips += 1;
      paint('Хорошо', 'Напомним завтра. И послезавтра.');
      skipBtn.textContent = 'Не сейчас';
    } else reset();
  });
}

/* ---------- 0X Cloud: 30 ГБ заканчиваются быстрее, чем кажется ---------- */

{
  const START = { photo: 12.4, backup: 6.1, chat: 1.8, assist: 1.3 };
  const CAPS = { free: 30, pro: 240 };
  const box = $('.cloud__box');
  const usedEl = $('[data-cloud-used]');
  const capEl = $('[data-cloud-cap]');
  const segs = $$('[data-seg]');
  const full = $('[data-cloud-full]');
  const planGroup = $('[data-cloud-plan]');
  let data = { ...START };
  let plan = 'free';

  const total = () => Object.values(data).reduce((a, b) => a + b, 0);
  function paint() {
    const cap = CAPS[plan];
    const t = total();
    usedEl.textContent = gb(t);
    capEl.textContent = String(cap);
    segs.forEach((s) => { s.style.setProperty('--w', `${(data[s.dataset.seg] / cap) * 100}%`); });
    for (const k in data) $(`[data-cloud-n="${k}"]`).textContent = `${gb(data[k])} ГБ`;
    const isFull = t >= cap - 0.05;
    full.hidden = !isFull;
    box.classList.toggle('is-full', isFull);
  }
  function setPlan(v) {
    if (v === plan) return;
    plan = v;
    syncRadio(planGroup, v);
    paint();
    if (v === 'pro') toast('Добро пожаловать в Pro. $9,99 спишутся 1-го числа. Отменить: OY ID → Подписки → Управление → Отменить → Всё равно отменить.');
  }

  initRadioGroup(planGroup, setPlan);
  $$('[data-cloud-add]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.cloudAdd;
    const free = CAPS[plan] - total();
    if (free <= 0.05) { toast('Не поместилось: 0X Cloud заполнено.'); return; }
    data[k] += Math.min(+b.dataset.gb, free);
    paint();
  }));
  $('[data-cloud-reset]').addEventListener('click', () => { data = { ...START }; paint(); });
  $('[data-cloud-upgrade]').addEventListener('click', () => setPlan('pro'));
  paint();
}

/* ---------- «Линза»: стекло, которое преломляет то, что под ним ---------- */

{
  const stage = $('[data-lens-stage]');
  const scene = $('[data-lens-scene]');
  const lens = $('[data-lens]');
  const inner = $('[data-lens-inner]');
  const tint = $('[data-lens-tint]');
  const val = $('[data-lens-val]');
  const ZOOM = 1.32;
  // Внутри линзы — копия сцены, увеличенная вокруг центра стекла
  const copy = scene.cloneNode(true);
  copy.removeAttribute('data-lens-scene');
  inner.append(copy);

  let x = 0, y = 0, touched = false, raf = 0;
  function place(px, py) {
    const r = lens.offsetWidth / 2;
    x = Math.max(-r * 0.4, Math.min(stage.clientWidth - r * 1.6, px - r));
    y = Math.max(-r * 0.4, Math.min(stage.clientHeight - r * 1.6, py - r));
    lens.style.transform = `translate(${x}px, ${y}px)`;
    copy.style.width = `${stage.clientWidth}px`;
    copy.style.height = `${stage.clientHeight}px`;
    copy.style.transformOrigin = `${x + r}px ${y + r}px`;
    copy.style.transform = `translate(${-x}px, ${-y}px) scale(${ZOOM})`;
  }
  const local = (e) => { const b = stage.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  stage.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' && !lens.hasPointerCapture?.(e.pointerId)) return;
    touched = true;
    place(...local(e));
  });
  lens.addEventListener('pointerdown', (e) => { touched = true; lens.setPointerCapture(e.pointerId); });

  // Пока никто не трогает — линза сама плавает по экрану
  let seen = false;
  new IntersectionObserver(([en]) => { seen = en.isIntersecting; if (seen && !raf) loop(); }, { threshold: 0.2 }).observe(stage);
  function loop(t = 0) {
    raf = 0;
    if (!seen) return;
    if (!touched) {
      const w = stage.clientWidth, h = stage.clientHeight;
      const k = reduce.matches ? 0 : t / 1000;
      place(w * (0.5 + 0.3 * Math.sin(k * 0.5)), h * (0.5 + 0.22 * Math.sin(k * 0.8 + 1)));
    }
    if (!reduce.matches && !touched) raf = requestAnimationFrame(loop);
  }

  function setTint() {
    const v = +tint.value;
    stage.style.setProperty('--tint', String(v / 100));
    val.textContent = v < 34 ? 'Чистое' : v < 67 ? 'Тонированное' : 'Матовое';
  }
  tint.addEventListener('input', setTint);
  setTint();
  window.addEventListener('resize', () => place(x + lens.offsetWidth / 2, y + lens.offsetWidth / 2));
  place(stage.clientWidth / 2, stage.clientHeight / 2);
}

/* ---------- Сервисы Google: отказаться можно, удалить — нет ---------- */

{
  const sw = $('[data-gms]');
  const status = $('[data-gms-status]');
  const res = $('[data-gms-res]');
  const rm = $('[data-gms-remove]');
  const box = $('.gms');
  let tries = 0;
  function paint() {
    box.classList.toggle('is-off', !sw.checked);
    status.textContent = sw.checked
      ? 'Используются. Карты, почта, банки и игры работают с первого включения.'
      : 'Не используются. Сервисы Google остаются в системе: 1,4 ГБ и 9 системных процессов — на случай, если передумаете.';
  }
  sw.addEventListener('change', () => { res.textContent = ''; paint(); });
  rm.addEventListener('click', () => {
    tries += 1;
    res.textContent = tries < 3
      ? 'Нельзя: сервисы Google — часть OY OS 4. Их можно не использовать.'
      : 'Всё ещё нельзя. Но нам нравится ваше упорство.';
    box.classList.remove('is-shake');
    void box.offsetWidth;
    box.classList.add('is-shake');
  });
  paint();
}

/* ---------- Главный экран: четыре стиля стеклянных иконок ---------- */

{
  const group = $('[data-home-style]');
  const screen = $('[data-home-screen]');
  initRadioGroup(group, (v) => { syncRadio(group, v); screen.dataset.style = v; });
}

/* ---------- «Воспоминания»: фильм из фото, разобранных в облаке ---------- */

{
  const btn = $('[data-mem-run]');
  const box = $('[data-mem-box]');
  const title = $('[data-mem-title]');
  const meta = $('[data-mem-meta]');
  const tags = $('[data-mem-tags]');
  const res = $('[data-mem-res]');
  const TAGS = ['«Мама»', '«Лена»', 'Эйфелева башня', 'Кафе на Риволи', 'Закат, 18:42', 'День рождения Лены'];
  let busy = false;
  btn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    box.classList.remove('is-done');
    box.classList.add('is-run');
    tags.textContent = '';
    res.textContent = '';
    title.textContent = 'Разбираю фото в 0X Cloud…';
    meta.textContent = '48 фото · лица, места, поводы';
    for (const t of TAGS) {
      await wait(380);
      const li = document.createElement('li');
      li.textContent = t;
      tags.append(li);
    }
    await wait(300);
    box.classList.remove('is-run');
    box.classList.add('is-done');
    title.textContent = 'Париж с Леной';
    meta.textContent = 'Декабрь 2030 · 48 фото · фильм 2:14';
    res.textContent = 'Распознано в 0X Cloud за 3,2 с';
    btn.lastChild.textContent = 'Собрать ещё одно';
    busy = false;
  });
}

/* ---------- Обновление ночью: из 0X Cloud, с OY ID и новыми условиями ---------- */

{
  const btn = $('[data-upd-run]');
  const bar = $('[data-upd-bar]');
  const log = $('[data-upd-log]');
  const res = $('[data-upd-res]');
  const STEPS = [
    [12, 'Вход в OY ID: anna@oyid.oy ✓'],
    [30, 'Резервная копия → 0X Cloud ✓'],
    [64, 'Скачано 6,8 ГБ из 0X Cloud ✓'],
    [78, 'Новые условия (148 страниц): OY Assist принял за вас ✓'],
    [92, 'Сервисы Google → встроены в систему ✓'],
    [100, 'Установлено. Доброе утро ✓'],
  ];
  let busy = false;
  btn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    log.textContent = '';
    res.textContent = '02:00 · телефон на зарядке';
    bar.style.width = '0%';
    for (const [pct, t] of STEPS) {
      await wait(650);
      bar.style.width = `${pct}%`;
      const li = document.createElement('li');
      li.textContent = t;
      log.append(li);
    }
    res.textContent = '07:00 · OY OS 4 уже здесь';
    btn.textContent = 'Обновить ещё раз';
    busy = false;
  });
}
