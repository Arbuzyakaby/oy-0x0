/* =========================================================================
   OY OS 3 — демо новых функций на странице /os/: агент OY Assist 3,
   «Граница» и mesh-сообщения. Чистый JS, ничего никуда не отправляется.
   ========================================================================= */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const wait = (ms) => new Promise((r) => setTimeout(r, reduce.matches ? Math.min(ms, 60) : ms));
const li = (text, cls = '') => {
  const el = document.createElement('li');
  el.textContent = text;
  if (cls) el.className = cls;
  return el;
};

/* ---------- Агент: каждый шаг на экране ---------- */

{
  const log = $('[data-agent-log]');
  const TASKS = {
    sub: [
      ['Открываю «Кино+» → Профиль → Подписка', ''],
      ['Нашёл: «Премиум», $14,99 в месяц, продление 3 ноября', ''],
      ['Нажимаю «Отменить» → «Всё равно отменить»', ''],
      ['Отказался от «скидки 50 % на месяц»', 'is-acc'],
      ['Готово. Подписка закончится 3 ноября. Письмо-подтверждение — во «Входящих»', 'is-ok'],
    ],
    receipt: [
      ['Ищу в «Почте» и «Фото»: чек, июль', ''],
      ['Нашёл 3 чека. Нужен из «Аптеки на Лесной», $42,10', ''],
      ['Открываю письмо → «Переслать» → бухгалтер Ирина', ''],
      ['Убрал из пересылки историю переписки', 'is-acc'],
      ['Отправлено. Ничего не ушло на сервер ассистента — его нет', 'is-ok'],
    ],
  };
  let busy = false;
  $$('[data-agent]').forEach((b) => b.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    $$('[data-agent]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    log.innerHTML = '';
    for (const [t, c] of TASKS[b.dataset.agent]) {
      log.append(li(t, c));
      await wait(700);
    }
    busy = false;
  }));
}

/* ---------- «Граница»: отмеченные чаты уходят в чип ---------- */

{
  const btn = $('[data-border]');
  const text = $('[data-border-text]');
  const title = $('[data-border-title]');
  const items = $$('[data-border-list] [data-secret]');
  let on = false;
  btn?.addEventListener('click', () => {
    on = !on;
    items.forEach((el) => el.classList.toggle('is-gone', on));
    title.textContent = on ? 'Чаты · «Граница» включена' : 'Чаты';
    text.textContent = on ? 'Вернуть по отпечатку' : 'Включить «Границу»';
  });
}

/* ---------- Mesh: сообщение прыгает по телефонам ---------- */

{
  const svg = $('[data-mesh]');
  const btn = $('[data-mesh-run]');
  const res = $('[data-mesh-res]');
  let busy = false;
  btn?.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    res.textContent = '';
    svg.classList.remove('is-run');
    void svg.getBoundingClientRect();
    svg.classList.add('is-run');
    const nodes = $$('circle', svg);
    nodes.forEach((n) => n.classList.remove('is-lit'));
    for (const n of nodes) { n.classList.add('is-lit'); await wait(420); }
    res.textContent = 'Доставлено через 3 телефона · 2,1 с';
    busy = false;
  });
}
