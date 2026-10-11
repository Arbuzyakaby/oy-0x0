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
    // Один повтор: изредка страница не успевает загрузиться (CDN, GLB)
    for (let attempt = 0; ; attempt++) {
      await page.goto(url + (fallback ? '&fallback' : ''));
      try {
        await page.waitForFunction(() => window.__oy && window.__oy.Keys && !window.__oy.Keys.empty, null, { timeout: 30000 });
        break;
      } catch (e) {
        if (attempt >= 1) throw new Error(`${url}: страница не загрузилась — ${e.message}`);
      }
    }
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
