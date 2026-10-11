# Этап 1 — общее ядро и переезд 0X0 на /0x0/ — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Разложить код страницы 0X0 на общее ядро (`js/core/*`), описание модели (`js/models/oy0x0.js`), данные (`js/data/products.js`) и код страницы (`js/pages/base.js`), разделить CSS на `core.css` и `0x0.css`, перенести страницу на `/0x0/` — без единого изменения поведения.

**Architecture:** Чистый перенос кода с минимальными изменениями интерфейсов. Корректность доказывается регрессией: старая версия (git worktree на коммите `015f7ae`, порт 5318) и новая (порт 5317) открываются в Playwright, и сравниваются ключевые кадры модели по всей длине страницы, положения подвижных частей и геометрия секций. Чистые модули (`keys.js`, `products.js`) покрыты юнит-тестами на `node:test`.

**Tech Stack:** HTML/CSS/ES-модули без сборщика; Three.js 0.180.0, GSAP 3.13.0 + ScrollTrigger, Lenis 1.3.26 (importmap, cdn.jsdelivr.net); Node 24 (`node --test`); Playwright MCP; Python `http.server`.

**Spec:** `docs/superpowers/specs/2026-10-11-oy0x0-pro-design.md` (разделы 8, 9, 10). Этот план — этап 1 из 7; этапы 2–7 получают свои планы после завершения этого.

## Global Constraints

- Коммиты **без** строк `Co-Authored-By`, без упоминаний Claude/«Generated with» (правило владельца репозитория).
- Без сборщика; внешние запросы только к `cdn.jsdelivr.net` и `fonts.bunny.net`; CSP-мета в каждой HTML-странице.
- Версии библиотек не менять: three@0.180.0, gsap@3.13.0, lenis@1.3.26.
- Пути к ресурсам из HTML и JS — абсолютные от корня (`/css/...`, `/js/...`, `/models/...`).
- Поведение страницы 0X0 не меняется: регрессия «старая ↔ новая» должна проходить после каждой задачи.
- `window.__oy` при `?debug` сохраняет форму `{ stage, Keys, ScrollTrigger, lenis: () => Lenis|null }`; `stage.debug.parts` сохраняет поля `shutter, switches, layers`.
- Тексты, комментарии и сообщения коммитов — на русском, в стиле существующего кода.
- Не трогать `blender/`, `models/`, `docs/screenshots/`, `og.jpg`, `404.html`, `CNAME`, `.nojekyll`.

## Карта файлов

| Файл | Ответственность | Задача |
|---|---|---|
| `package.json` | `"type": "module"`, скрипт `npm test` → `node --test tests/unit/` | 1 |
| `tests/e2e/regress-0x0.js` | Playwright-скрипт регрессии старая ↔ новая | 1 |
| `tests/unit/keys.test.js`, `tests/unit/products.test.js` | Юнит-тесты чистых модулей | 2, 3 |
| `js/core/keys.js` | Движок ключевых кадров `createKeys()` | 2 |
| `js/pages/base.js` | Код страницы 0X0 (бывший `js/main.js`) | 2–6, 8 |
| `js/data/products.js` | Цены и цвета моделей (пока только 0X0) | 3 |
| `js/core/ui.js` | `$`, `$$`, `clamp01`, `store`, тост, радиогруппы, тумблеры, заглушки | 4 |
| `js/core/scroll.js` | Lenis + якоря | 4 |
| `js/core/text.js` | Разбиение на строки, появления заголовков, абзац «по словам» | 5 |
| `js/core/carousel.js` | Карусель «Коротко о главном» | 5 |
| `js/core/stage.js` | 3D-сцена без знаний о модели | 6 |
| `js/models/oy0x0.js` | Модель 0X0: материалы, механика, экран, луч, резервная модель | 6 |
| `css/core.css`, `css/0x0.css` | Общие стили / стили страницы 0X0 | 7 |
| `0x0/index.html` | Страница 0X0 (бывший `index.html`) | 8 |
| `index.html` | Временная переадресация на `/0x0/` (до этапа «Витрина») | 8 |

Удаляются: `js/main.js` (→ `js/pages/base.js`), `js/scene.js` (→ `stage.js` + `models/oy0x0.js`), `css/styles.css` (→ `core.css` + `0x0.css`).

---

### Task 1: Стенд регрессии и тестовая обвязка

**Files:**
- Create: `package.json`
- Create: `tests/e2e/regress-0x0.js`
- Modify: `.gitignore` (добавить `.baseline/`)
- Local only (gitignored): `.claude/launch.json` — конфигурация `oy0x0-baseline`

**Interfaces:**
- Produces: `tests/e2e/regress-0x0.js` — функция `async (page) => ({ ok, issues, stats })`, запускается через Playwright MCP `browser_run_code_unsafe` с `filename: "tests/e2e/regress-0x0.js"`. Сравнивает `http://127.0.0.1:5318/?debug` (старая) с `http://127.0.0.1:5317/0x0/?debug`, а если там 404 — с `http://127.0.0.1:5317/?debug`.
- Produces: `npm test` (= `node --test tests/unit/`).

- [ ] **Step 1: Создать baseline-копию старой версии**

```bash
cd "/c/Dev/AI Sites/OY 0X0/Claude/Opus/High"
git worktree add --detach .baseline 015f7ae
printf '\n# Копия старой версии для регрессии\n.baseline/\n' >> .gitignore
ls .baseline/index.html .baseline/js/main.js
```
Expected: оба файла существуют.

- [ ] **Step 2: Добавить серверы в `.claude/launch.json`**

Заменить содержимое `.claude/launch.json`:
```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "oy0x0",
      "runtimeExecutable": "python",
      "runtimeArgs": ["-m", "http.server", "5317", "--bind", "127.0.0.1"],
      "port": 5317
    },
    {
      "name": "oy0x0-baseline",
      "runtimeExecutable": "python",
      "runtimeArgs": ["-m", "http.server", "5318", "--bind", "127.0.0.1", "--directory", ".baseline"],
      "port": 5318
    }
  ]
}
```
Запустить оба (Claude_Browser `preview_start` с `name: "oy0x0"` и `name: "oy0x0-baseline"`, либо `python -m http.server ...` в фоне). Проверить:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5317/
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5318/js/main.js
```
Expected: `200` и `200`.

- [ ] **Step 3: Создать `package.json`**

```json
{
  "name": "oy0x0-site",
  "private": true,
  "type": "module",
  "description": "Промо-сайт OY 0X0. Сборщик не нужен; package.json только для тестов.",
  "scripts": {
    "test": "node --test tests/unit/"
  }
}
```

- [ ] **Step 4: Написать скрипт регрессии `tests/e2e/regress-0x0.js`**

```js
// Регрессия страницы 0X0: старая версия (порт 5318, git worktree .baseline)
// против новой (порт 5317). Сравнивает ключевые кадры модели по всей длине
// страницы, положения подвижных частей после затухания и геометрию секций.
// Запуск: Playwright MCP → browser_run_code_unsafe { filename: "tests/e2e/regress-0x0.js" }
async (page) => {
  const OLD = 'http://127.0.0.1:5318/?debug';
  const NEW_MOVED = 'http://127.0.0.1:5317/0x0/?debug';
  const NEW_ROOT = 'http://127.0.0.1:5317/?debug';
  const SIZES = [[1440, 900], [375, 812]];
  const SAMPLES = 160;
  const MECH_POINTS = [['hero', 0], ['shutter', 0.95], ['switches', 0.95], ['inside', 0.7], ['colors', 0.5]];

  const probe = await page.goto(NEW_MOVED);
  const NEW = probe && probe.status() < 400 ? NEW_MOVED : NEW_ROOT;

  async function capture(url, w, h, fallback) {
    await page.setViewportSize({ width: w, height: h });
    const errors = [];
    const onErr = (e) => errors.push(String(e));
    const onCon = (m) => { if (m.type() === 'error') errors.push(m.text()); };
    page.on('pageerror', onErr);
    page.on('console', onCon);
    await page.goto(url + (fallback ? '&fallback' : ''));
    await page.waitForFunction(() => window.__oy && window.__oy.Keys && !window.__oy.Keys.empty, null, { timeout: 20000 });
    await page.waitForTimeout(800);
    const data = await page.evaluate(async ({ N, points }) => {
      const { Keys, ScrollTrigger, stage } = window.__oy;
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const max = ScrollTrigger.maxScroll(window);
      const keys = [];
      for (let i = 0; i <= N; i++) {
        const y = Math.round((max * i) / N);
        const v = Keys.sample(y, false);
        keys.push(Object.fromEntries(Object.keys(v).sort().map((k) => [k, Math.round(v[k] * 1e4) / 1e4])));
      }
      window.scrollTo(0, 0);
      await wait(300);
      const rects = {};
      document.querySelectorAll('main > section, .site-header, .site-footer, [data-split], .h2, .lead').forEach((el, i) => {
        const r = el.getBoundingClientRect();
        rects[`${el.id || el.className || el.tagName}#${i}`] = [Math.round(r.left), Math.round(r.top + window.scrollY), Math.round(r.width), Math.round(r.height)];
      });
      const mech = {};
      for (const [id, f] of points) {
        const st = ScrollTrigger.getAll().find((s) => s.trigger && s.trigger.id === id);
        if (!st) { mech[`${id}@${f}`] = 'нет триггера'; continue; }
        window.scrollTo(0, Math.round(st.start + f * (st.end - st.start)));
        await wait(2600);
        const p = stage.debug.parts;
        mech[`${id}@${f}`] = {
          shutter: p.shutter ? Math.round(p.shutter.position.x * 1e5) / 1e5 : null,
          switches: p.switches.map((s) => (s ? Math.round(s.position.y * 1e5) / 1e5 : null)),
          layers: p.layers.map((l) => Math.round(l.o.position.z * 1e5) / 1e5),
        };
      }
      return { max: Math.round(max), keys, rects, mech, triggers: ScrollTrigger.getAll().length };
    }, { N: SAMPLES, points: MECH_POINTS });
    page.off('pageerror', onErr);
    page.off('console', onCon);
    return { ...data, errors };
  }

  const issues = [];
  const near = (a, b, eps) => Math.abs(a - b) <= eps;
  const runs = [...SIZES.map(([w, h]) => [w, h, false]), [1440, 900, true]];
  for (const [w, h, fb] of runs) {
    const tag = `${w}x${h}${fb ? ' fallback' : ''}`;
    const a = await capture(OLD, w, h, fb);
    const b = await capture(NEW, w, h, fb);
    if (b.errors.length) issues.push(`${tag}: ошибки в консоли новой версии: ${b.errors.slice(0, 3).join(' | ')}`);
    if (a.max !== b.max) issues.push(`${tag}: длина страницы ${a.max} → ${b.max}`);
    if (a.triggers !== b.triggers) issues.push(`${tag}: ScrollTrigger ${a.triggers} → ${b.triggers}`);
    a.keys.forEach((ka, i) => {
      const kb = b.keys[i] || {};
      for (const k of new Set([...Object.keys(ka), ...Object.keys(kb)])) {
        if (!(k in kb) || !(k in ka) || !near(ka[k], kb[k], 1e-3)) {
          issues.push(`${tag}: кадр ${i}, ${k}: ${ka[k]} → ${kb[k]}`);
        }
      }
    });
    for (const k of Object.keys(a.rects)) {
      const ra = a.rects[k], rb = b.rects[k];
      if (!rb) { issues.push(`${tag}: нет элемента ${k}`); continue; }
      if (ra.some((v, j) => !near(v, rb[j], 1))) issues.push(`${tag}: геометрия ${k}: ${ra} → ${rb}`);
    }
    for (const k of Object.keys(a.mech)) {
      if (JSON.stringify(a.mech[k]) !== JSON.stringify(b.mech[k])) {
        const ma = a.mech[k], mb = b.mech[k];
        const flat = (m) => (typeof m === 'string' ? [m] : [m.shutter, ...m.switches, ...m.layers]);
        const fa = flat(ma), fbb = flat(mb);
        if (fa.length !== fbb.length || fa.some((v, j) => typeof v !== 'number' || !near(v, fbb[j], 1e-4))) {
          issues.push(`${tag}: механика ${k}: ${JSON.stringify(ma)} → ${JSON.stringify(mb)}`);
        }
      }
    }
  }
  return { ok: issues.length === 0, newUrl: NEW, issues: issues.slice(0, 40), total: issues.length };
}
```

- [ ] **Step 5: Проверить, что стенд работает (старая против той же старой)**

Пока новая версия в корне совпадает со старой, регрессия обязана пройти.
Run: Playwright MCP `browser_run_code_unsafe` с `filename: "tests/e2e/regress-0x0.js"`.
Expected: `{"ok": true, "newUrl": "http://127.0.0.1:5317/?debug", "issues": [], "total": 0}`.
Если `ok: false` из-за шума (например, расхождение 1 px в геометрии из-за загрузки шрифта) — увеличить ожидание после `goto` до 1500 мс и повторить; стенд должен давать `ok: true` стабильно 2 раза подряд.

- [ ] **Step 6: Проверить `npm test` на пустом наборе**

```bash
mkdir -p tests/unit && npm test
```
Expected: `# tests 0`, код выхода 0.

- [ ] **Step 7: Commit**

```bash
git add package.json tests/e2e/regress-0x0.js .gitignore
git commit -m "Тесты: стенд регрессии страницы 0X0 и node:test"
```

---

### Task 2: Движок ключевых кадров `js/core/keys.js`; `main.js` → `js/pages/base.js`

**Files:**
- Create: `js/core/keys.js`
- Create: `tests/unit/keys.test.js`
- Move: `js/main.js` → `js/pages/base.js` (`git mv`)
- Modify: `index.html` (путь скрипта), `js/pages/base.js`

**Interfaces:**
- Produces: `createKeys()` → `{ reset(), add(st, f, props, linear = false), compile(vh), sample(y, step = false) → Record<string, number>, get empty → boolean }`. `st` — объект с числовыми `start`, `end` (ScrollTrigger или заглушка); `f ≥ 0` — доля пина, `f < 0` — экраны (`vh`) до `start`.
- Produces: страница грузит `js/pages/base.js` (импорты внутри — относительно `js/pages/`).

- [ ] **Step 1: Написать падающий тест `tests/unit/keys.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKeys } from '../../js/core/keys.js';

const st = (start, end) => ({ start, end });

test('до первого ключа и после последнего — крайние значения', () => {
  const K = createKeys();
  const a = st(1000, 2000);
  K.add(a, 0, { x: 0 });
  K.add(a, 1, { x: 10 });
  K.compile(800);
  assert.equal(K.sample(0).x, 0);
  assert.equal(K.sample(5000).x, 10);
});

test('между ключами — smoothstep, с флагом linear — линейно', () => {
  const K = createKeys();
  const a = st(1000, 2000);
  K.add(a, 0, { x: 0, y: 0 });
  K.add(a, 1, { x: 10 });
  K.add(a, 1, { y: 10 }, true);
  K.compile(800);
  const v = K.sample(1250);
  assert.equal(v.x, 10 * (0.25 * 0.25 * (3 - 2 * 0.25)));
  assert.equal(v.y, 2.5);
});

test('отрицательная доля — экраны до начала секции', () => {
  const K = createKeys();
  const a = st(1000, 2000);
  K.add(a, -1, { z: 5 });
  K.add(a, 0, { z: 7 });
  K.compile(800);
  assert.equal(K.sample(200).z, 5);
  assert.equal(K.sample(1000).z, 7);
});

test('step-режим берёт ближайший ключ', () => {
  const K = createKeys();
  const a = st(1000, 2000);
  K.add(a, 0, { x: 0 });
  K.add(a, 1, { x: 10 });
  K.compile(800);
  assert.equal(K.sample(1400, true).x, 0);
  assert.equal(K.sample(1600, true).x, 10);
});

test('ключи без ScrollTrigger пропускаются; reset очищает', () => {
  const K = createKeys();
  K.add(null, 0, { x: 1 });
  K.compile(800);
  assert.equal(K.empty, true);
  K.add(st(0, 100), 0, { x: 1 });
  K.compile(800);
  assert.equal(K.empty, false);
  K.reset();
  assert.equal(K.empty, true);
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test`
Expected: FAIL — `Cannot find module .../js/core/keys.js`.

- [ ] **Step 3: Создать `js/core/keys.js`**

```js
/* =========================================================================
   OY — ключевые кадры модели
   Ключи привязаны к ScrollTrigger секций: f ≥ 0 — доля пина, f < 0 — экраны
   до начала секции. sample(y) превращает позицию прокрутки в целевое
   состояние детерминированно — при любом прыжке скролла.
   ========================================================================= */

export function createKeys() {
  let defs = [];
  let tracks = {};
  const smooth = (t) => t * t * (3 - 2 * t);
  return {
    reset() { defs = []; tracks = {}; },
    add(st, f, props, linear = false) { defs.push({ st, f, props, linear }); },
    compile(vh) {
      tracks = {};
      for (const d of defs) {
        const s = d.st;
        if (!s) continue;
        const pos = d.f >= 0 ? s.start + d.f * (s.end - s.start) : s.start + d.f * vh;
        for (const k in d.props) (tracks[k] ||= []).push({ pos, v: d.props[k], linear: d.linear });
      }
      for (const k in tracks) tracks[k].sort((a, b) => a.pos - b.pos);
    },
    sample(y, step = false) {
      const out = {};
      for (const k in tracks) {
        const arr = tracks[k];
        const first = arr[0], lastK = arr[arr.length - 1];
        if (y <= first.pos) { out[k] = first.v; continue; }
        if (y >= lastK.pos) { out[k] = lastK.v; continue; }
        let i = 0;
        while (i < arr.length - 2 && arr[i + 1].pos <= y) i++;
        const a = arr[i], b = arr[i + 1];
        const span = b.pos - a.pos;
        const t = span > 0 ? (y - a.pos) / span : 1;
        out[k] = step ? (t < 0.5 ? a.v : b.v) : a.v + (b.v - a.v) * (b.linear ? t : smooth(t));
      }
      return out;
    },
    get empty() { return Object.keys(tracks).length === 0; },
  };
}
```
Это тело IIFE `const Keys = (() => { ... })()` из `js/main.js`; единственное изменение — `compile(vh)` получает высоту экрана параметром вместо `window.innerHeight`.

- [ ] **Step 4: Тесты проходят**

Run: `npm test`
Expected: `# pass 5`, `# fail 0`.

- [ ] **Step 5: Перенести `main.js` и подключить движок**

```bash
mkdir -p js/pages && git mv js/main.js js/pages/base.js
```
В `index.html` заменить `<script type="module" src="js/main.js"></script>` на `<script type="module" src="js/pages/base.js"></script>`.

В `js/pages/base.js`:
1. `import { createStage, BODY_COLORS } from './scene.js';` → `import { createStage, BODY_COLORS } from '../scene.js';`
2. Добавить после импортов: `import { createKeys } from '../core/keys.js';`
3. Удалить весь блок `const Keys = (() => { ... })();` (от строки `const Keys = (() => {` до закрывающей `})();` включительно) и на его месте написать:
```js
const Keys = createKeys();
```
4. В обработчике `ScrollTrigger.addEventListener('refresh', () => { Keys.compile(); ...` заменить `Keys.compile();` на `Keys.compile(window.innerHeight);`.

- [ ] **Step 6: Регрессия**

Run: Playwright MCP `browser_run_code_unsafe` с `filename: "tests/e2e/regress-0x0.js"`.
Expected: `ok: true`, `total: 0`.

- [ ] **Step 7: Commit**

```bash
git add js/core/keys.js tests/unit/keys.test.js js/pages/base.js index.html
git commit -m "Ядро: движок ключевых кадров в js/core/keys.js, код страницы — js/pages/base.js"
```

---

### Task 3: Данные моделей `js/data/products.js`

**Files:**
- Create: `js/data/products.js`
- Create: `tests/unit/products.test.js`
- Modify: `js/pages/base.js` (блоки «Цвет корпуса» и «Память и цена»)

**Interfaces:**
- Produces: `PRODUCTS` — `{ '0x0': { id: '0x0', name: 'OY 0X0', colors: { red: 'Сигнальный Красный', ice: 'Арктический ледник' }, defaultColor: 'red', configs: [{ id, usd, eur }] } }`.
- Produces: `getConfig(productId, configId)` → `{ id, usd, eur } | null`.

- [ ] **Step 1: Написать падающий тест `tests/unit/products.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTS, getConfig } from '../../js/data/products.js';

test('цены 0X0 точно по ТЗ', () => {
  assert.deepEqual(
    PRODUCTS['0x0'].configs.map((c) => [c.id, c.usd, c.eur]),
    [['8/128', 449, 539], ['12/128', 489, 579], ['12/256', 519, 609], ['14/512', 639, 729]],
  );
});

test('цвета 0X0', () => {
  assert.deepEqual(PRODUCTS['0x0'].colors, { red: 'Сигнальный Красный', ice: 'Арктический ледник' });
  assert.equal(PRODUCTS['0x0'].defaultColor, 'red');
});

test('getConfig находит конфигурацию и возвращает null для неизвестной', () => {
  assert.deepEqual(getConfig('0x0', '12/256'), { id: '12/256', usd: 519, eur: 609 });
  assert.equal(getConfig('0x0', '16/1024'), null);
  assert.equal(getConfig('nope', '8/128'), null);
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm test`
Expected: FAIL — `Cannot find module .../js/data/products.js`.

- [ ] **Step 3: Создать `js/data/products.js`**

```js
/* =========================================================================
   OY — данные моделей: единственный источник цен, конфигураций и цветов.
   Конфигураторы, сравнение и витрина берут цифры только отсюда.
   ========================================================================= */

export const PRODUCTS = {
  '0x0': {
    id: '0x0',
    name: 'OY 0X0',
    colors: { red: 'Сигнальный Красный', ice: 'Арктический ледник' },
    defaultColor: 'red',
    configs: [
      { id: '8/128', usd: 449, eur: 539 },
      { id: '12/128', usd: 489, eur: 579 },
      { id: '12/256', usd: 519, eur: 609 },
      { id: '14/512', usd: 639, eur: 729 },
    ],
  },
};

export function getConfig(productId, configId) {
  return PRODUCTS[productId]?.configs.find((c) => c.id === configId) ?? null;
}
```

- [ ] **Step 4: Тесты проходят**

Run: `npm test`
Expected: `# pass 8`, `# fail 0`.

- [ ] **Step 5: Подключить данные в `js/pages/base.js`**

1. Добавить импорт: `import { PRODUCTS, getConfig } from '../data/products.js';`
2. Заменить `const COLOR_NAMES = { red: 'Сигнальный Красный', ice: 'Арктический ледник' };` на:
```js
const PRODUCT = PRODUCTS['0x0'];
const COLOR_NAMES = PRODUCT.colors;
```
3. В `setColor` заменить `if (!COLOR_NAMES[name]) name = 'red';` на `if (!COLOR_NAMES[name]) name = PRODUCT.defaultColor;`
4. Удалить объект `const PRICES = { ... };` целиком.
5. В `setMemory` заменить тело:
```js
function setMemory(v, animate = true) {
  const cfg = getConfig(PRODUCT.id, v);
  if (!cfg) return;
  const prev = getConfig(PRODUCT.id, currentMem).usd;
  currentMem = v;
  syncRadio(memGroup, v);
  const { usd, eur } = cfg;
  cfgNameEl.textContent = `${v} ГБ`;
  eurEl.textContent = `€${eur}`;
  if (!animate || reduceMQ.matches) { usdEl.textContent = `$${usd}`; return; }
  const o = { n: prev };
  gsap.to(o, {
    n: usd, duration: 0.6, ease: 'power3.out',
    onUpdate: () => { usdEl.textContent = `$${Math.round(o.n)}`; },
  });
  gsap.fromTo(usdEl, { y: 8, opacity: 0.6 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' });
}
```

- [ ] **Step 6: Проверить конфигуратор в браузере**

Playwright MCP, `browser_run_code_unsafe` с кодом:
```js
async (page) => {
  await page.goto('http://127.0.0.1:5317/?debug');
  await page.waitForTimeout(2500);
  const out = [];
  for (const id of ['8/128', '12/128', '12/256', '14/512']) {
    await page.evaluate((id) => document.querySelector(`[data-mem-switch] [data-value="${id}"]`).click(), id);
    await page.waitForTimeout(900);
    out.push(await page.evaluate(() => [document.querySelector('[data-price-usd]').textContent, document.querySelector('[data-price-eur]').textContent]));
  }
  return out;
}
```
Expected: `[["$449","€539"],["$489","€579"],["$519","€609"],["$639","€729"]]`.

- [ ] **Step 7: Регрессия**

Run: `browser_run_code_unsafe` с `filename: "tests/e2e/regress-0x0.js"`. Expected: `ok: true`.

- [ ] **Step 8: Commit**

```bash
git add js/data/products.js tests/unit/products.test.js js/pages/base.js
git commit -m "Данные: цены и цвета 0X0 в js/data/products.js"
```

---

### Task 4: Интерфейсные помощники `js/core/ui.js` и прокрутка `js/core/scroll.js`

**Files:**
- Create: `js/core/ui.js`
- Create: `js/core/scroll.js`
- Modify: `js/pages/base.js`

**Interfaces:**
- Produces (`ui.js`): `$(sel, el = document)`, `$$(sel, el = document) → Element[]`, `clamp01(v)`, `store.get(k) → string|null`, `store.set(k, v)`, `createToast(el, gsap) → (msg) => void`, `syncRadio(group, value)`, `initRadioGroup(group, onChange)`, `bindToggles(root = document)`, `bindStubs(toast, root = document)`.
- Produces (`scroll.js`): `createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ })` → `{ enable(), disable(), get lenis() → Lenis|null }`; при создании регистрирует `gsap.ticker` для Lenis, `lagSmoothing(0)` и обработчик якорей `a[href^="#"]`.

- [ ] **Step 1: Создать `js/core/ui.js`**

```js
/* =========================================================================
   OY — интерфейсные помощники: выборки, хранилище, тост, радиогруппы
   ========================================================================= */

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* ---------- Хранилище (может быть недоступно) ---------- */

export const store = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch { /* приватный режим */ } },
};

/* ---------- Toast ---------- */

export function createToast(el, gsap) {
  let timer = 0;
  return function toast(msg) {
    el.textContent = msg;
    el.hidden = false;
    gsap.fromTo(el, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power3.out' });
    clearTimeout(timer);
    timer = setTimeout(() => {
      gsap.to(el, { autoAlpha: 0, y: 16, duration: 0.3, onComplete: () => { el.hidden = true; } });
    }, 3600);
  };
}

/* ---------- Радиогруппы ---------- */

export function syncRadio(group, value) {
  $$('[role="radio"]', group).forEach((b) => {
    const on = b.dataset.value === value;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  });
}

export function initRadioGroup(group, onChange) {
  const radios = () => $$('[role="radio"]', group);
  group.addEventListener('click', (e) => {
    const b = e.target.closest('[role="radio"]');
    if (b && group.contains(b)) onChange(b.dataset.value);
  });
  group.addEventListener('keydown', (e) => {
    const list = radios();
    const i = list.indexOf(document.activeElement);
    if (i < 0) return;
    let n = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % list.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + list.length) % list.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = list.length - 1;
    if (n < 0) return;
    e.preventDefault();
    onChange(list[n].dataset.value);
    list[n].focus();
  });
}

/* ---------- Тумблеры и заглушки ---------- */

export function bindToggles(root = document) {
  $$('[data-toggle]', root).forEach((t) => t.addEventListener('click', () => {
    t.setAttribute('aria-checked', String(t.getAttribute('aria-checked') !== 'true'));
  }));
}

export function bindStubs(toast, root = document) {
  $$('[data-stub]', root).forEach((el) => el.addEventListener('click', (e) => {
    e.preventDefault();
    toast(el.dataset.stub);
  }));
}
```

- [ ] **Step 2: Создать `js/core/scroll.js`**

```js
/* =========================================================================
   OY — плавная прокрутка (Lenis) и якоря
   ========================================================================= */

export function createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ }) {
  let lenis = null;
  gsap.ticker.add((time) => { lenis?.raf(time * 1000); });
  gsap.ticker.lagSmoothing(0);

  // Якоря
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.hasAttribute('data-stub')) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { duration: 1.4 });
    else target.scrollIntoView({ behavior: reduceMQ.matches ? 'auto' : 'smooth' });
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    history.replaceState(null, '', id);
  });

  return {
    enable() {
      if (lenis) return;
      lenis = new Lenis({ autoRaf: false, lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
    },
    disable() {
      if (!lenis) return;
      lenis.destroy();
      lenis = null;
    },
    get lenis() { return lenis; },
  };
}
```

- [ ] **Step 3: Подключить в `js/pages/base.js`**

1. Добавить импорты:
```js
import { $, $$, clamp01, store, createToast, syncRadio, initRadioGroup, bindToggles, bindStubs } from '../core/ui.js';
import { createSmoothScroll } from '../core/scroll.js';
```
2. Удалить локальные определения: `const $ = ...`, `const $$ = ...`, `const clamp01 = ...`, весь блок «Хранилище» (`const store = {...};`), блок «Toast» (`const toastEl`, `let toastTimer`, `function toast`), функции `syncRadio` и `initRadioGroup`.
3. На месте блока «Toast» написать: `const toast = createToast($('#toast'), gsap);`
4. Заменить блок «Тумблеры (Tor, разрешения)» (`$$('[data-toggle]').forEach(...)`) на `bindToggles();`
5. Заменить блок «Заглушки» (`$$('[data-stub]').forEach(...)`) на `bindStubs(toast);`
6. Заменить весь блок «Плавная прокрутка» и «Якоря» (от `let lenis = null;` до конца обработчика `document.addEventListener('click', ...)` для якорей) на:
```js
const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ });
```
7. В `buildChoreography`: `if (reduce) disableLenis(); else enableLenis();` → `if (reduce) smooth.disable(); else smooth.enable();`
8. Отладка: `lenis: () => lenis` → `lenis: () => smooth.lenis`.

- [ ] **Step 4: Убедиться, что ничего не осталось от старых имён**

```bash
grep -n "toastEl\|toastTimer\|enableLenis\|disableLenis\|let lenis\|function syncRadio\|function initRadioGroup" js/pages/base.js
```
Expected: пустой вывод.

- [ ] **Step 5: Проверка интерактива**

Playwright MCP, `browser_run_code_unsafe`:
```js
async (page) => {
  await page.goto('http://127.0.0.1:5317/?debug');
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector('[data-stub]').click());
  await page.waitForTimeout(500);
  const toastText = await page.evaluate(() => document.getElementById('toast').textContent);
  const t = await page.evaluate(() => { const el = document.querySelector('[data-toggle]'); const a = el.getAttribute('aria-checked'); el.click(); return [a, el.getAttribute('aria-checked')]; });
  await page.evaluate(() => document.querySelector('a[href="#buy"]').click());
  await page.waitForTimeout(2000);
  const y = await page.evaluate(() => Math.round(document.getElementById('buy').getBoundingClientRect().top));
  return { toastText, t, buyTop: y, lenis: await page.evaluate(() => !!window.__oy.lenis()) };
}
```
Expected: `toastText` непустой; `t` — `["false","true"]` или `["true","false"]`; `buyTop` в пределах `[-5, 80]`; `lenis: true`.

- [ ] **Step 6: Регрессия**

Run: `browser_run_code_unsafe` с `filename: "tests/e2e/regress-0x0.js"`. Expected: `ok: true`.

- [ ] **Step 7: Commit**

```bash
git add js/core/ui.js js/core/scroll.js js/pages/base.js
git commit -m "Ядро: интерфейсные помощники и плавная прокрутка"
```

---

### Task 5: Тексты `js/core/text.js` и карусель `js/core/carousel.js`

**Files:**
- Create: `js/core/text.js`
- Create: `js/core/carousel.js`
- Modify: `js/pages/base.js`

**Interfaces:**
- Consumes: `$`, `$$`, `clamp01` из `js/core/ui.js`.
- Produces (`text.js`): `splitLines(el) → HTMLElement[]`, `unsplit(el)`, `createSplitReveals(els, { gsap }) → { buildAll(reduce), rebuildPending(reduce), unsplitAll() }`, `wrapWords(el) → HTMLSpanElement[]`, `scrubWords(items, { reduce, ScrollTrigger })` где `items: { el, spans }[]`.
- Produces (`carousel.js`): `initCarousel(sec, { gsap, isReduced: () => boolean, duration = 5 }) → { go(i), setPlaying(v) } | null`.

- [ ] **Step 1: Создать `js/core/text.js`**

```js
/* =========================================================================
   OY — текст: разбиение заголовков на строки, появления, абзац «по словам»
   ========================================================================= */

import { clamp01 } from './ui.js';

export function splitLines(el) {
  const text = el.dataset.splitText ?? (el.dataset.splitText = el.textContent.replace(/[ \t\r\n]+/g, ' ').trim());
  el.textContent = '';
  const words = text.split(' ');
  const spans = words.map((w, i) => {
    const s = document.createElement('span');
    s.textContent = w;
    el.append(s);
    if (i < words.length - 1) el.append(' ');
    return s;
  });
  const lines = [];
  let top = null;
  for (const s of spans) {
    const t = s.offsetTop;
    if (top === null || Math.abs(t - top) > 3) { lines.push([]); top = t; }
    lines[lines.length - 1].push(s.textContent);
  }
  el.textContent = '';
  return lines.map((ws) => {
    const line = document.createElement('span');
    line.className = 'line';
    const inner = document.createElement('span');
    inner.className = 'line__inner';
    inner.textContent = ws.join(' ');
    line.append(inner);
    el.append(line);
    return inner;
  });
}

export function unsplit(el) {
  if (el.dataset.splitText !== undefined) el.textContent = el.dataset.splitText;
}

export function createSplitReveals(els, { gsap }) {
  const state = new Map();
  function build(el, reduce) {
    const st = state.get(el) || {};
    st.tween?.scrollTrigger?.kill();
    st.tween?.kill();
    if (st.done) { unsplit(el); return; }
    if (reduce) {
      unsplit(el);
      st.tween = gsap.fromTo(el, { opacity: 0 }, {
        opacity: 1, duration: 0.6, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
        onComplete: () => { st.done = true; },
      });
    } else {
      const lines = splitLines(el);
      st.tween = gsap.fromTo(lines,
        { yPercent: 110, opacity: 0, filter: 'blur(8px)' },
        {
          yPercent: 0, opacity: 1, filter: 'blur(0px)',
          duration: 1.15, ease: 'expo.out', stagger: 0.09,
          scrollTrigger: { trigger: el, start: 'top 90%', once: true },
          onComplete: () => { st.done = true; unsplit(el); },
        });
    }
    state.set(el, st);
  }
  return {
    buildAll(reduce) { els.forEach((el) => build(el, reduce)); },
    rebuildPending(reduce) {
      els.forEach((el) => {
        const st = state.get(el);
        if (st && !st.done) build(el, reduce);
      });
    },
    unsplitAll() { els.forEach(unsplit); },
  };
}

/* ---------- Абзац, который «загорается» по словам ---------- */

export function wrapWords(el) {
  const words = el.textContent.replace(/[ \t\r\n]+/g, ' ').trim().split(' ');
  el.textContent = '';
  return words.map((w, i) => {
    const s = document.createElement('span');
    s.className = 'w';
    s.textContent = w;
    el.append(s);
    if (i < words.length - 1) el.append(' ');
    return s;
  });
}

export function scrubWords(items, { reduce, ScrollTrigger }) {
  items.forEach(({ el, spans }) => {
    const n = spans.length;
    const paint = (p) => spans.forEach((s, i) => s.style.setProperty('--o', String(0.16 + 0.84 * clamp01(p * (n + 4) - i))));
    if (reduce) { paint(1); return; }
    paint(0);
    ScrollTrigger.create({ trigger: el, start: 'top 82%', end: 'bottom 52%', onUpdate: (st) => paint(st.progress), onRefresh: (st) => paint(st.progress) });
  });
}
```

- [ ] **Step 2: Создать `js/core/carousel.js`**

```js
/* =========================================================================
   OY — карусель «Коротко о главном»: автопрокрутка с прогрессом на активной
   точке, пауза, свайп, клики по точкам.
   ========================================================================= */

import { $, $$ } from './ui.js';

export function initCarousel(sec, { gsap, isReduced, duration = 5 }) {
  if (!sec) return null;
  const track = $('.hl__track', sec);
  const slides = $$('.hl__slide', sec);
  const dots = $$('.hl__dot', sec);
  const playBtn = $('.hl__play', sec);
  let idx = 0, p = 0, playing = true, inView = false, programmatic = 0;

  const offset = (i) => slides[i].offsetLeft - slides[0].offsetLeft;
  function setActive(i) {
    idx = i;
    slides.forEach((s, k) => s.classList.toggle('is-active', k === i));
    dots.forEach((d, k) => {
      if (k === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      d.style.setProperty('--p', '0');
    });
  }
  function go(i) {
    setActive(i);
    p = 0;
    programmatic = performance.now();
    track.scrollTo({ left: offset(i), behavior: isReduced() ? 'auto' : 'smooth' });
  }
  function setPlaying(v) {
    playing = v;
    playBtn.dataset.playing = String(v);
    playBtn.setAttribute('aria-label', v ? 'Пауза' : 'Воспроизвести');
  }

  dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
  playBtn.addEventListener('click', () => {
    if (!playing && idx === slides.length - 1 && p >= 1) go(0);
    setPlaying(!playing);
  });

  // Свайп или прокрутка пользователем
  let t = 0;
  track.addEventListener('scroll', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const x = track.scrollLeft;
      let best = 0;
      slides.forEach((s, i) => { if (Math.abs(offset(i) - x) < Math.abs(offset(best) - x)) best = i; });
      if (best !== idx) { setActive(best); p = 0; }
    }, 90);
    if (performance.now() - programmatic > 900) setPlaying(false);
  }, { passive: true });

  new IntersectionObserver(([e]) => { inView = e.isIntersecting; }, { threshold: 0.35 }).observe(track);

  gsap.ticker.add((time, dt) => {
    if (!playing || !inView || isReduced() || document.hidden) return;
    p = Math.min(1, p + dt / 1000 / duration);
    dots[idx]?.style.setProperty('--p', p.toFixed(4));
    if (p >= 1) go((idx + 1) % slides.length);
  });

  setActive(0);
  return { go, setPlaying };
}
```

- [ ] **Step 3: Подключить в `js/pages/base.js`**

1. Импорты:
```js
import { createSplitReveals, wrapWords, scrubWords } from '../core/text.js';
import { initCarousel } from '../core/carousel.js';
```
2. Удалить функции `splitLines`, `unsplit`, `buildSplitReveal`, константы `splitState`; строку `const splitEls = $$('[data-split]');` заменить на:
```js
const splits = createSplitReveals($$('[data-split]'), { gsap });
```
3. Блок `const scrubWords = $$('[data-scrub-words]').map((el) => { ... });` заменить на:
```js
const scrubItems = $$('[data-scrub-words]').map((el) => ({ el, spans: wrapWords(el) }));
```
4. Блок карусели `const hl = (() => { ... })();` заменить на:
```js
initCarousel($('#highlights'), { gsap, isReduced: () => reducedMode });
```
5. В `buildChoreography`:
   - `splitEls.forEach((el) => buildSplitReveal(el, reduce));` → `splits.buildAll(reduce);`
   - весь блок `scrubWords.forEach(({ el, spans }) => { ... });` → `scrubWords(scrubItems, { reduce, ScrollTrigger });`
   - в возвращаемой функции очистки `splitEls.forEach(unsplit);` → `splits.unsplitAll();`
6. В обработчике `resize` блок `splitEls.forEach((el) => { const st = splitState.get(el); if (st && !st.done) buildSplitReveal(el, reducedMode); });` → `splits.rebuildPending(reducedMode);`

- [ ] **Step 4: Не осталось старых имён**

```bash
grep -n "splitEls\|splitState\|buildSplitReveal\|function splitLines\|const hl = " js/pages/base.js
```
Expected: пустой вывод.

- [ ] **Step 5: Проверка карусели и абзаца**

Playwright MCP, `browser_run_code_unsafe`:
```js
async (page) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:5317/?debug');
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.scrollTo(0, document.querySelector('#highlights .hl').getBoundingClientRect().top + scrollY - 100));
  await page.waitForTimeout(6500);
  const active = await page.evaluate(() => [...document.querySelectorAll('.hl__dot')].findIndex((d) => d.getAttribute('aria-current') === 'true'));
  await page.evaluate(() => window.scrollTo(0, document.querySelector('.manifest').getBoundingClientRect().bottom + scrollY));
  await page.waitForTimeout(800);
  const lastWord = await page.evaluate(() => getComputedStyle(document.querySelector('.manifest .w:last-child')).opacity);
  return { active, lastWord };
}
```
Expected: `active` ≥ 1 (карусель перелистнулась сама); `lastWord` = `"1"`.

- [ ] **Step 6: Регрессия**

Run: `browser_run_code_unsafe` с `filename: "tests/e2e/regress-0x0.js"`. Expected: `ok: true`.

- [ ] **Step 7: Commit**

```bash
git add js/core/text.js js/core/carousel.js js/pages/base.js
git commit -m "Ядро: появления текста, абзац по словам и карусель"
```

---

### Task 6: 3D-сцена `js/core/stage.js` и модель `js/models/oy0x0.js`

**Files:**
- Create: `js/core/stage.js`
- Create: `js/models/oy0x0.js`
- Delete: `js/scene.js`
- Modify: `js/pages/base.js`, `index.html` (modulepreload)

**Interfaces:**
- Produces (`stage.js`): `MODEL_SCALE = 10`; `POSE_DEFAULTS = { x: 0, y: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: 0, rz: 0, s: 1, dist: 5.4, float: 1, spin: 0 }`; `createStage(canvas, createModel, { forceFallback = false } = {})` → `{ ready: Promise<{ fallback: boolean }>, renderer, debug: { cur, target, parts }, setTarget(values), snap(), setPointer(x, y), setActive(v), setReduced(v), resize(), ...model.api }`.
- Contract «описание модели» (возвращает `createModel(ctx)`, `ctx = { phone: THREE.Group, scale: number, isRunning: () => boolean }`):
  `{ url: string, state: Record<string, number>, parts: object, setup(root): void, buildFallback(): THREE.Object3D, update(cur, dt, { reduced }): void, snap(): void, api: object }`. `setup(root)` вызывается **до** того, как сцена добавит `root` в `modelRoot` (модель меряет детали в собственных координатах).
- Produces (`models/oy0x0.js`): `BODY_COLORS` (как раньше), `createOY0X0(ctx)` — описание модели; `api = { setBodyColor(name, instant = false), setSignalColor(name, instant = false), redrawScreen(accent?) }`; `url = '/models/oy0x0.glb'`; `state = { shutter: 0, sw1: 1, sw2: 1, sw3: 1, signal: 0, screen: 1, explode: 0 }`.

- [ ] **Step 1: Создать `js/models/oy0x0.js` — перенос модельного кода**

Новый файл начинается с шапки и импорта:
```js
/* =========================================================================
   OY 0X0 — описание 3D-модели: материалы, механика (шторка, ползунки,
   фонарь, экран, разлёт по слоям), текстура экрана, луч фонаря и
   процедурная резервная модель. Сцена (js/core/stage.js) о модели не знает.
   ========================================================================= */

import * as THREE from 'three';
```
Затем **дословно** перенести из `js/scene.js` (в том же порядке) объявления: `BODY_COLORS` (с `export`), `SIGNAL_COLORS`, `SHUTTER_TRAVEL`, `SWITCH_TRAVEL`, `SIGNAL_Y`, `LAYER_OFFSET`, `LAYER_BY_NAME`, функции `roundRect`, `drawScreen`, константу `MM`, функции `rrShape`, `slab`, `boxG`, `cylZ`, `buildFallbackModel`, `labelTexture`, `drawChip`, `buildInternals`, `makeBeam` и в конце файла `function clamp01(v) { ... }`. Не переносить: импорты GLTFLoader/RoomEnvironment, `MODEL_SCALE`, `DEFAULT_STATE`, `createStage`.

После `makeBeam` добавить фабрику описания модели:
```js
/* ---------- Описание модели для сцены ---------- */

export function createOY0X0({ phone, scale, isRunning }) {
  const { beam, glow, beamMat } = makeBeam();
  beam.position.set(0, SIGNAL_Y * scale + 0.004, 0);
  glow.position.set(0, SIGNAL_Y * scale + 0.01, 0);
  phone.add(beam, glow);

  // Текстуры экрана
  const scrCanvas = { day: document.createElement('canvas'), night: document.createElement('canvas') };
  for (const c of Object.values(scrCanvas)) { c.width = 600; c.height = 1290; }
  const scrTex = {};
  for (const k of ['day', 'night']) {
    const t = new THREE.CanvasTexture(scrCanvas[k]);
    t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = false;
    t.anisotropy = 4;
    scrTex[k] = t;
  }
  const screenMat = new THREE.MeshStandardMaterial({
    name: 'Screen', color: 0x000000, roughness: 0.22, metalness: 0,
    emissive: 0xffffff, emissiveMap: scrTex.day, emissiveIntensity: 1,
  });
  let screenMode = 'day';
  let accentHex = BODY_COLORS.red.accent;
  function redrawScreen(accent = accentHex) {
    accentHex = accent;
    drawScreen(scrCanvas.day, 'day', accentHex);
    drawScreen(scrCanvas.night, 'night', accentHex);
    scrTex.day.needsUpdate = true;
    scrTex.night.needsUpdate = true;
  }
  redrawScreen();

  const parts = {
    shutter: null, shutterBase: 0,
    switches: [], switchBase: [], indicatorMats: [],
    body: [], frame: [], shutterMats: [],
    signalMat: null,
    layers: [], internals: [],
  };

  const colorTarget = { body: new THREE.Color(), frame: new THREE.Color(), shutter: new THREE.Color(), bodyMetal: 0.7, bodyRough: 0.4, frameMetal: 0.95, frameRough: 0.2 };
  const signalTarget = new THREE.Color(0xffffff);
  const signalCur = new THREE.Color(0xffffff);
  const indicatorOn = new THREE.Color(0xFF2D2D);
  const indicatorOff = new THREE.Color(0x3A3A3E);

  // <<< сюда дословно: функция setupLayers(root) из js/scene.js >>>

  function setup(root) {
    setupLayers(root);
    // <<< сюда дословно: тело функции setupModel(root) из js/scene.js,
    //     начиная со строки `const byName = {};` и до `applyColorsInstant();` включительно
    //     (строки `setupLayers(root);` и `modelRoot.add(root);` НЕ переносить) >>>
  }

  // <<< сюда дословно: функции setBodyTargets, вызов setBodyTargets('red'),
  //     stepColors, applyColorsInstant из js/scene.js >>>

  function update(cur, dt, { reduced }) {
    stepColors(reduced ? 1 : 1 - Math.exp(-dt * 6));
    // <<< сюда дословно: из функции update(dt) в js/scene.js блоки
    //     «Разлёт по слоям», «Механика», «Фонарь», «Экран» — от строки
    //     `// Разлёт по слоям` до конца функции >>>
  }

  return {
    url: '/models/oy0x0.glb',
    state: { shutter: 0, sw1: 1, sw2: 1, sw3: 1, signal: 0, screen: 1, explode: 0 },
    parts,
    setup,
    buildFallback: buildFallbackModel,
    update,
    snap: applyColorsInstant,
    api: {
      setBodyColor(name, instant = false) {
        setBodyTargets(name);
        redrawScreen((BODY_COLORS[name] || BODY_COLORS.red).accent);
        if (instant || !isRunning()) applyColorsInstant();
      },
      setSignalColor(name, instant = false) {
        signalTarget.setHex(SIGNAL_COLORS[name] || SIGNAL_COLORS.white);
        if (instant || !isRunning()) signalCur.copy(signalTarget);
      },
      redrawScreen,
    },
  };
}
```
Метки `<<< ... >>>` — инструкции переноса: заменить каждую указанным фрагментом из `js/scene.js` без изменений и удалить сами метки. После переноса в файле не должно остаться строк с `<<<`:
```bash
grep -n "<<<\|modelRoot\|MODEL_SCALE" js/models/oy0x0.js
```
Expected: пустой вывод.

- [ ] **Step 2: Создать `js/core/stage.js`**

```js
/* =========================================================================
   OY — 3D-сцена (ядро)
   Одна модель на fixed-canvas. Описание модели приходит фабрикой
   createModel(ctx) из js/models/*. Внешний код задаёт целевое состояние
   (поза + состояние модели), сцена плавно догоняет его каждый кадр.
   ========================================================================= */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const MODEL_SCALE = 10; // модель в метрах -> 1.46 единицы по высоте

export const POSE_DEFAULTS = {
  x: 0, y: 0, fx: 0, fy: 0, fz: 0,
  rx: 0, ry: 0, rz: 0, s: 1, dist: 5.4,
  float: 1, spin: 0,
};

export function createStage(canvas, createModel, { forceFallback = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 100);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  scene.environment = pmrem.fromScene(roomEnv, 0.04).texture;
  roomEnv.dispose?.();
  pmrem.dispose();
  scene.environmentIntensity = 0.95;

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 4, 5);
  const rim = new THREE.DirectionalLight(0xffffff, 1.8);
  rim.position.set(-5, 2.5, -4);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-2, -3, 3);
  scene.add(key, rim, fill);

  const phone = new THREE.Group();
  const modelRoot = new THREE.Group();
  modelRoot.scale.setScalar(MODEL_SCALE);
  phone.add(modelRoot);
  scene.add(phone);

  let raf = 0;
  const model = createModel({ phone, scale: MODEL_SCALE, isRunning: () => raf !== 0 });

  // Состояние: target задаёт скролл, cur догоняет его
  const target = { ...POSE_DEFAULTS, ...model.state };
  const cur = { ...target };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let reduced = false;

  /* ---- Применение состояния ---- */
  const focus = new THREE.Vector3();
  const clock = new THREE.Clock();
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  function update(dt) {
    const k = reduced ? 1 : 1 - Math.exp(-dt * 5.5);
    for (const key in target) cur[key] += (target[key] - cur[key]) * k;
    const pk = 1 - Math.exp(-dt * 3);
    pointer.x += (pointer.tx - pointer.x) * pk;
    pointer.y += (pointer.ty - pointer.y) * pk;

    const t = clock.elapsedTime;
    const fl = reduced ? 0 : Math.max(0, Math.min(1, cur.float));
    const idleY = Math.sin(t * 0.5) * 0.1 * fl;
    const idleX = Math.sin(t * 0.37) * 0.035 * fl;
    const bob = Math.sin(t * 0.8) * 0.018 * fl;

    phone.rotation.set(
      cur.rx + idleX + pointer.y * 0.1 * fl,
      cur.ry + cur.spin + idleY + pointer.x * 0.22 * fl,
      cur.rz,
    );
    phone.scale.setScalar(cur.s);

    camera.position.set(0, 0, cur.dist);
    camera.lookAt(0, 0, 0);
    const halfH = tanHalf * cur.dist;
    const halfW = halfH * camera.aspect;
    focus.set(cur.fx, cur.fy, cur.fz).applyEuler(phone.rotation).multiplyScalar(cur.s);
    phone.position.set(cur.x * halfW - focus.x, cur.y * halfH - focus.y + bob, -focus.z);

    model.update(cur, dt, { reduced });
  }

  /* ---- Цикл рендера ---- */
  let last = 0;
  let wantActive = true;
  let modelReady = false;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(dt);
    renderer.render(scene, camera);
  }

  function start() {
    if (raf || !modelReady) return;
    snap();
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  function snap() {
    Object.assign(cur, target);
    model.snap();
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (modelReady && !raf) { update(0); renderer.render(scene, camera); }
  }
  resize();

  /* ---- Загрузка модели ---- */
  const ready = (async () => {
    let fallback = forceFallback;
    let root = null;
    if (!fallback) {
      try {
        const loader = new GLTFLoader();
        const gltf = await Promise.race([
          loader.loadAsync(model.url),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
        ]);
        root = gltf.scene;
      } catch (err) {
        console.info('[OY] GLB недоступен, используется процедурная модель:', err?.message || err);
        fallback = true;
      }
    }
    if (fallback) root = model.buildFallback();
    model.setup(root);
    modelRoot.add(root);
    modelReady = true;
    snap();
    update(0);
    renderer.render(scene, camera);
    if (wantActive) start();
    return { fallback };
  })();

  return {
    ready,
    renderer,
    debug: { cur, target, parts: model.parts },
    setTarget(values) {
      for (const k in values) if (k in target && Number.isFinite(values[k])) target[k] = values[k];
    },
    snap,
    setPointer(x, y) { pointer.tx = x; pointer.ty = y; },
    setActive(v) {
      wantActive = v;
      if (v) start(); else stop();
    },
    setReduced(v) { reduced = v; },
    resize,
    ...model.api,
  };
}
```
Отличия от `js/scene.js`, которые сделаны сознательно: модельные части вынесены в `model.*`; `stepColors` выполняется внутри `model.update` после позы (на позу не влияет); текст `console.info` — «[OY]».

Важно: в исходном `setupModel` порядок был `setupLayers(root)` → `modelRoot.add(root)` → настройка материалов. В новом — `model.setup(root)` (слои + материалы) → `modelRoot.add(root)`. Настройка материалов не зависит от того, добавлен ли `root` в сцену, а `setupLayers` по-прежнему меряет детали до добавления — результат совпадает.

- [ ] **Step 3: Подключить в `js/pages/base.js` и `index.html`, удалить `js/scene.js`**

В `js/pages/base.js`:
```js
// было: import { createStage, BODY_COLORS } from '../scene.js';
import { createStage } from '../core/stage.js';
import { createOY0X0, BODY_COLORS } from '../models/oy0x0.js';
```
и `stage = createStage(canvas, { forceFallback: params.has('fallback') });` → `stage = createStage(canvas, createOY0X0, { forceFallback: params.has('fallback') });`

В `index.html`: `<link rel="modulepreload" href="js/scene.js">` → `<link rel="modulepreload" href="js/core/stage.js">`.

```bash
git rm js/scene.js
grep -rn "scene.js" index.html js/
```
Expected: пустой вывод.

- [ ] **Step 4: Регрессия (включает прогон с `?fallback`)**

Run: `browser_run_code_unsafe` с `filename: "tests/e2e/regress-0x0.js"`.
Expected: `ok: true`. Особое внимание: строки «механика …» — шторка, ползунки и слои должны совпасть до 1e-4.

- [ ] **Step 5: Визуальная сверка**

Playwright MCP: открыть `http://127.0.0.1:5317/?debug` 1440×900, для секций `hero`, `zero@0.9`, `signal@0.6`, `display@0.8`, `inside@0.66` прокрутить, `await page.evaluate(() => __oy.stage.snap())`, сделать скриншот в `.playwright-mcp/`; то же для `http://127.0.0.1:5318/?debug`. Сравнить пары глазами: модель, цвет, луч фонаря, экран, разлёт совпадают. Переключить цвет на «Арктический ледник» (клик по `.color-opt[data-value="ice"]`) на обеих — модель перекрашивается.

- [ ] **Step 6: Commit**

```bash
git add js/core/stage.js js/models/oy0x0.js js/pages/base.js index.html
git commit -m "Ядро: 3D-сцена без знаний о модели; модель 0X0 — в js/models/oy0x0.js"
```

---

### Task 7: Разделение CSS на `css/core.css` и `css/0x0.css`

**Files:**
- Create: `css/core.css`, `css/0x0.css`
- Delete: `css/styles.css`
- Modify: `index.html`

**Interfaces:**
- Produces: `css/core.css` — токены, база, типографика, кнопки, лоадер, фон и сцена, шапка, переключатель цвета, общие правила секций и пинов, градиентный текст, механика карусели (`.hl`, `.hl__*`), подвал, тост, появления, общий адаптив. `css/0x0.css` — всё остальное (секции страницы 0X0, визуалы слайдов карусели, их адаптив и reduced motion). Порядок подключения: `core.css`, затем `0x0.css`.

- [ ] **Step 1: Нарезать файл скриптом**

Сохранить в scratchpad и выполнить `python split_css.py` из корня репозитория:
```python
import io

src = io.open('css/styles.css', encoding='utf-8').read()

def cut(a, b=None):
    i = src.index(a)
    j = src.index(b, i) if b else len(src)
    return src[i:j]

M_HERO = '/* ---------- 1. Hero ---------- */'
M_GRAD = '/* ---------- Градиентный текст ---------- */'
M_VIS = '/* Визуалы слайдов */'
M_FOOT = '/* ---------- Футер ---------- */'
_a = src.index('   Адаптив\n')
M_ADAPT = src[src.rindex('/*', 0, _a):_a]   # шапка блока «Адаптив» как есть в файле

head = src[:src.index(M_HERO)]            # токены … общие правила секций
page_sections = cut(M_HERO, M_GRAD)       # 1. Hero … 20. Финал
grad_and_hl = cut(M_GRAD, M_VIS)          # градиент + механика карусели
hl_visuals = cut(M_VIS, M_FOOT)           # визуалы слайдов (+ их reduced motion)
tail = cut(M_FOOT, M_ADAPT)               # подвал, тост, появления

CORE_ADAPT = '''/* =========================================================================
   Адаптив (общие элементы)
   ========================================================================= */

@media (max-width: 1100px) {
  .site-nav { display: none; }
}

@media (max-width: 860px) {
  .footer__inner { grid-template-columns: 1fr; justify-items: start; }
  .footer__small { justify-self: start; }
  .footer__concept { text-align: left; }
}

@media (max-width: 760px) {
  :root { --header-h: 58px; }
  body { font-size: 16px; }
  .btn { --h: 48px; padding: 0 20px; }
  .header-actions .btn--sm { padding: 0 14px; }

  .pin-wrap { align-items: flex-end; padding-bottom: 28px; }
  .stage-text, .stage-text--right { max-width: none; margin-left: 0; width: 100%; }
  .stage-text--bottom { padding-bottom: 0; }
  .pinned .stage-text::before {
    content: ''; position: absolute; inset: -40px calc(-1 * var(--gutter)) -28px;
    background: linear-gradient(to top, rgba(10, 10, 11, .92) 55%, rgba(10, 10, 11, 0));
    z-index: -1; pointer-events: none;
  }
  .pinned .lead { font-size: 16px; }
  .pinned .h2 { font-size: clamp(34px, 10vw, 52px); }

  .hl__slide { width: 86vw; height: 480px; border-radius: 22px; }
  .hl__track { gap: 12px; }
  .hl__dots { height: 48px; padding: 0 14px; }
  .hl__play { width: 48px; height: 48px; }
}

@media (max-width: 400px) {
  .header-actions .color-switch--mini { display: none; }
}

/* Уменьшенное движение */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .2s !important; }
  .loader__o, .loader__x { stroke-dashoffset: 0; }
}
'''

PAGE_ADAPT = '''/* =========================================================================
   Адаптив (страница 0X0)
   ========================================================================= */

@media (max-width: 1100px) {
  .bento { grid-template-columns: repeat(2, 1fr); }
  .box-grid { grid-template-columns: repeat(3, 1fr); }
  .perf-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 860px) {
  .counters, .net-grid, .cam-grid { grid-template-columns: 1fr; }
  .os-grid { grid-template-columns: 1fr; }
  .os-card--sandbox { grid-row: auto; }
  .compare__grid { grid-template-columns: 1fr; }
  .compare__plus { justify-self: center; }
  .strike-wrap, .battery__grid, .configurator, .square, .fourteen, .honest__grid { grid-template-columns: 1fr; }
  .journal__grid { grid-template-columns: 1fr; gap: 36px; justify-items: center; }
  .journal__text { justify-self: stretch; }
  .price-card { position: static; }
  .mem-switch { grid-template-columns: repeat(2, 1fr); }
  .square { margin-top: 80px; }
  .square__vis { gap: 24px; }
}

/* Мобильные: модель сверху, текст снизу */
@media (max-width: 760px) {
  .hero { align-items: flex-end; }
  .hero__inner { padding-bottom: 64px; padding-top: 52vh; }
  .hero__title { font-size: clamp(64px, 20vw, 120px); }
  .hero__slogan { font-size: 24px; }
  .scroll-hint { display: none; }

  .colors .stage-text { max-width: none; margin-left: 0; width: 100%; }
  .display .stage-text::before { display: none; }
  .zero .mega { font-size: clamp(72px, 24vw, 120px); }
  .zero-item { font-size: 24px; }
  .zero-list { margin-top: 14px; gap: 2px; }
  .zero-note { margin-top: 14px; }
  .ks-list { margin-top: 16px; gap: 6px; }
  .ks-item { padding: 10px 12px; gap: 10px; }
  .ks-item__body span { font-size: 13px; }
  .ks-icons { margin-top: 12px; }
  .ks-icon { width: 38px; height: 38px; }
  .switches .note { display: none; }
  .inside .stage-text { max-width: none; }
  .inside .h2 { max-width: none; }
  .layers { margin-top: 14px; gap: 0; grid-template-columns: 1fr 1fr; column-gap: 14px; }
  .layer { grid-template-columns: 1fr; gap: 0; padding: 7px 0; }
  .layer:nth-last-child(2) { border-bottom: 1px solid var(--line); }
  .layer__n { display: none; }
  .layer__body b { font-size: 14px; }
  .layer__body span { font-size: 12px; line-height: 1.3; }
  .nits__value { font-size: clamp(56px, 17vw, 90px); }
  .chips { margin-top: 16px; }
  .display .pin-wrap { align-items: flex-end; }

  .bento { grid-template-columns: 1fr; }
  .bento__card--chip, .bento__card--face, .bento__card--wide { grid-column: auto; grid-row: auto; }
  .box-grid { grid-template-columns: repeat(2, 1fr); }
  .box-item { min-height: 190px; padding: 18px; font-size: 15px; }
  .box-ill { width: 84px; height: 84px; }
  .perf-grid { grid-template-columns: 1fr 1fr; }
  .fourteen__main { font-size: 120px; }
  .dns { height: 200px; grid-template-columns: 1fr; }
  .dns__side { display: none; }
  .specs th { width: 38%; }
  .specs th, .specs td { font-size: 14px; padding: 12px 0; }
  .specs th { padding-right: 12px; }
  .final__pro { padding-top: 46vh; }
  .final__title { font-size: clamp(34px, 10.5vw, 56px); }
  .square__phone { width: 84px; }
  .counters { margin-top: 48px; }
  .features__head .h2 { font-size: clamp(34px, 10vw, 52px); }
  .anim:not(.reduced) .features__hint { display: none; }
  .feat { padding: 18px; }
  .feat__vis { height: 196px; }
  .counter { padding: 22px; }
}

@media (max-width: 400px) {
  .box-grid { grid-template-columns: 1fr; }
  .perf-grid { grid-template-columns: 1fr; }
  .mem-opt .mono { font-size: 17px; }
}

/* Уменьшенное движение */
@media (prefers-reduced-motion: reduce) {
  .pkt { display: none; }
  .push-vis__n { opacity: 1; animation: none !important; position: relative; margin-bottom: 8px; }
  .push-vis { height: auto; }
  .clip-vis__toast { animation: none !important; opacity: 1; }
  .features__hint span { animation: none !important; }
  .map-vis__route { stroke-dashoffset: 0; }
  .scroll-hint { display: none; }
}
'''

core = head.replace('   OY 0X0 — стили', '   OY — общие стили (ядро)') + grad_and_hl + tail + CORE_ADAPT
page = ('/* =========================================================================\n'
        '   OY 0X0 — стили страницы модели\n'
        '   ========================================================================= */\n\n'
        + page_sections + '/* ---------- Коротко о главном: визуалы слайдов ---------- */\n\n'
        + hl_visuals.replace(M_VIS + '\n', '') + PAGE_ADAPT)
io.open('css/core.css', 'w', encoding='utf-8', newline='\n').write(core)
io.open('css/0x0.css', 'w', encoding='utf-8', newline='\n').write(page)
print(len(core.splitlines()), len(page.splitlines()))
```
Expected: печатает две цифры, сумма ≈ 1372 ± 30.

- [ ] **Step 2: Проверить, что ни одно правило не потерялось**

```bash
python - <<'EOF'
import re, io
def sels(t): return sorted(set(s.strip() for s in re.findall(r'([^{}]+)\{', re.sub(r'/\*.*?\*/', '', t, flags=re.S)) if '@' not in s))
old = sels(io.open('css/styles.css', encoding='utf-8').read())
new = sels(io.open('css/core.css', encoding='utf-8').read() + io.open('css/0x0.css', encoding='utf-8').read())
print('потеряны:', [s for s in old if s not in new])
print('новые:', [s for s in new if s not in old])
EOF
```
Expected: `потеряны: ['.stage-text, .stage-text--right, .colors .stage-text']` и `новые: ['.stage-text, .stage-text--right']` — это результат разделения одного сгруппированного селектора (`.colors .stage-text` уже есть в стилях страницы). Любые другие строки — ошибка нарезки.

- [ ] **Step 3: Подключить и удалить старый файл**

В `index.html` заменить `<link rel="stylesheet" href="css/styles.css">` на:
```html
  <link rel="stylesheet" href="css/core.css">
  <link rel="stylesheet" href="css/0x0.css">
```
```bash
git rm css/styles.css
```

- [ ] **Step 4: Регрессия**

Run: `browser_run_code_unsafe` с `filename: "tests/e2e/regress-0x0.js"`.
Expected: `ok: true` — в том числе ни одного расхождения «геометрия …» на 1440 и 375 px. Если есть расхождение — найти правило из общего адаптива, которое теперь перебивается более поздним правилом страницы с той же специфичностью, и перенести его в `PAGE_ADAPT` (после правил секций).

- [ ] **Step 5: Commit**

```bash
git add css/core.css css/0x0.css index.html
git commit -m "Стили: общие правила — css/core.css, страница 0X0 — css/0x0.css"
```

---

### Task 8: Переезд страницы на `/0x0/` и переадресация с корня

**Files:**
- Move: `index.html` → `0x0/index.html`
- Create: `index.html` (временная переадресация)
- Modify: `0x0/index.html`, `js/core/stage.js` — не меняется (URL модели уже абсолютный), `README.md`

**Interfaces:**
- Produces: `https://oy0x.online/0x0/` — страница 0X0; `https://oy0x.online/` — переадресация на `/0x0/` с сохранением `?query` и `#hash` (заменится витриной на этапе 4).

- [ ] **Step 1: Перенести страницу и сделать пути абсолютными**

```bash
mkdir -p 0x0 && git mv index.html 0x0/index.html
```
В `0x0/index.html`:
- `<link rel="canonical" href="https://oy0x.online/">` → `<link rel="canonical" href="https://oy0x.online/0x0/">`
- `<meta property="og:url" content="https://oy0x.online/">` → `<meta property="og:url" content="https://oy0x.online/0x0/">`
- `href="css/core.css"` → `href="/css/core.css"`, `href="css/0x0.css"` → `href="/css/0x0.css"`
- `href="js/core/stage.js"` → `href="/js/core/stage.js"`
- `src="js/pages/base.js"` → `src="/js/pages/base.js"`

```bash
grep -n 'href="css\|href="js\|src="js\|models/' 0x0/index.html
```
Expected: пустой вывод (относительных путей не осталось).

- [ ] **Step 2: Создать временный корневой `index.html`**

```html
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OY 0X0 — Ноль слежки. Ноль компромиссов.</title>
  <meta name="description" content="OY 0X0 — смартфон без Google, без трекеров и без облака. Концепт.">
  <meta name="referrer" content="no-referrer">
  <meta name="theme-color" content="#0A0A0B">
  <link rel="canonical" href="https://oy0x.online/0x0/">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="OY 0X0">
  <meta property="og:locale" content="ru_RU">
  <meta property="og:url" content="https://oy0x.online/">
  <meta property="og:title" content="OY 0X0 — Ноль слежки. Ноль компромиссов.">
  <meta property="og:description" content="Концепт смартфона без Google, без трекеров и без облака: физические kill switch, шторка камер, сигнальный фонарь.">
  <meta property="og:image" content="https://oy0x.online/og.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta http-equiv="refresh" content="0; url=/0x0/">
  <script>location.replace('/0x0/' + location.search + location.hash);</script>
  <style>html,body{margin:0;background:#0A0A0B;color:#F2F2F0;font:16px system-ui,sans-serif}a{color:inherit}p{padding:24px}</style>
</head>
<body>
  <p><a href="/0x0/">Перейти на страницу OY 0X0</a></p>
</body>
</html>
```

- [ ] **Step 3: Проверить переадресацию и страницу**

Playwright MCP, `browser_run_code_unsafe`:
```js
async (page) => {
  await page.goto('http://127.0.0.1:5317/#buy');
  await page.waitForURL('**/0x0/#buy', { timeout: 5000 });
  await page.waitForTimeout(2500);
  const atBuy = await page.evaluate(() => Math.abs(document.getElementById('buy').getBoundingClientRect().top) < 120);
  const glb = await page.evaluate(() => performance.getEntriesByType('resource').some((r) => r.name.endsWith('/models/oy0x0.glb') && r.responseStatus !== 404));
  return { url: page.url(), atBuy, glb };
}
```
Expected: `url` = `http://127.0.0.1:5317/0x0/#buy`, `atBuy: true`, `glb: true`.

- [ ] **Step 4: Финальная регрессия и юнит-тесты**

```bash
npm test
```
Expected: `# pass 8`, `# fail 0`.
Run: `browser_run_code_unsafe` с `filename: "tests/e2e/regress-0x0.js"`.
Expected: `ok: true`, `newUrl: "http://127.0.0.1:5317/0x0/?debug"`.

Дополнительно 375×812 и `emulateMedia({ reducedMotion: 'reduce' })` на `/0x0/`: консоль без ошибок, `document.documentElement.scrollWidth <= 375`. Сетевые запросы (`browser_network_requests`) — только `127.0.0.1`, `cdn.jsdelivr.net`, `fonts.bunny.net`.

- [ ] **Step 5: Обновить README**

В `README.md`:
- В разделе «Запуск» после `npx serve .` добавить строку: «Страница модели — `http://localhost:3000/0x0/`; корень пока переадресует туда.»
- Блок «Как это устроено» заменить на:
````markdown
```
index.html            переадресация на /0x0/ (станет витриной семейства)
0x0/index.html        страница OY 0X0: разметка секций, import map
css/core.css          общие стили: токены, типографика, шапка, подвал, карусель
css/0x0.css           стили страницы 0X0
js/core/              ядро: 3D-сцена, ключевые кадры, прокрутка, тексты, карусель, UI
js/models/oy0x0.js    3D-модель 0X0: материалы, механика, экран, резервная модель
js/data/products.js   цены и цвета моделей — единственный источник
js/pages/base.js      хореография и интерактивы страницы 0X0
models/oy0x0.glb      модель телефона (~16 тыс. треугольников, 410 КБ)
blender/              скрипты сборки и превью модели
tests/                юнит-тесты (npm test) и регрессия страницы 0X0
```
````
- В блоке про `?fallback`/`?debug` заменить пример адреса на `/0x0/?debug`.
- В абзаце «Если GLB не загрузился» заменить `js/scene.js` на `js/models/oy0x0.js`.

- [ ] **Step 6: Commit и деплой**

```bash
git add 0x0/index.html index.html README.md
git commit -m "Страница 0X0 переехала на /0x0/, корень переадресует туда"
git log -8 --format=%B | grep -ci "co-authored\|claude"
git push
```
Expected: grep печатает `0`. Затем дождаться сборки Pages:
```bash
h=$(git rev-parse --short HEAD); for i in $(seq 1 24); do s=$(gh api repos/Arbuzyakaby/oy-0x0/pages/builds/latest --jq '.status + " " + .commit[0:7]'); echo "$s"; case "$s" in "built $h") break;; errored*) break;; esac; sleep 10; done
curl -s -o /dev/null -w "%{http_code}\n" https://oy0x.online/0x0/
curl -s -o /dev/null -w "%{http_code} %{size_download}\n" https://oy0x.online/models/oy0x0.glb
curl -s https://oy0x.online/ | grep -c "location.replace('/0x0/'"
```
Expected: `built <hash>`, `200`, `200 420140`, `1`.

- [ ] **Step 7: Убрать baseline-копию**

```bash
git worktree remove .baseline
```
(Для следующих этапов baseline создаётся заново от нужного коммита, если понадобится.)
