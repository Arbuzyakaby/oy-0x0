// OY 0X Nova: превью ссылки (1200×630) и все главы «Обсерватории» на десктопе и телефоне.
// Проверки: зум доходит до Mono и красит небо в ч/б, перо соединяет звёзды и линии переживают
// перезагрузку, «Затвор» подписывает кадр и Citadel его проверяет, игра не открывается,
// без JS видны все главы.
// Запуск: Playwright MCP → browser_run_code_unsafe { filename: "tests/e2e/shots-nova.js" }
async (page) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  const shots = [];
  const checks = {};
  const BASE = 'http://127.0.0.1:5317/nova/';
  const CHAPTERS = ['nova', 'observatory', 'zoom', 'sensors', 'selfie', 'pen', 'display', 'argon', 'nogames', 'torch', 'citadel', 'power', 'buy'];
  const open = async (w, h, query = '?debug') => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('about:blank');
    await page.goto(`${BASE}${query}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__nova && document.getElementById('loader').classList.contains('is-done'), null, { timeout: 45000 });
    await page.waitForTimeout(2600);
  };
  const shot = async (path) => {
    await page.waitForTimeout(1200);
    await page.screenshot({ path });
    shots.push(path);
  };
  // к главе: f — доля её ScrollTrigger (у «Зума» — доля пина)
  const to = async (id, f = 0.12) => {
    await page.evaluate(([i, k]) => { const s = window.__nova.sts[i]; window.scrollTo(0, s.start + (s.end - s.start) * k); }, [id, f]);
    await page.waitForTimeout(1500);
  };

  await page.goto(BASE);
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });

  // превью ссылки: первый экран без шапки
  await open(1200, 630);
  await page.addStyleTag({ content: '.site-header,.subnav,.nv-hint,.nv-hero__buy .btn--ghost{display:none!important}.nv--hero{padding-top:40px}html{scrollbar-width:none}' });
  await shot('.playwright-mcp/og-nova.png');

  // десктоп: все главы, зум — по ступеням
  await open(1440, 900);
  for (const id of CHAPTERS) {
    if (id === 'zoom') {
      for (const [k, f] of [[0, 0.05], [2, 0.41], [3, 0.7], [4, 0.95]]) {
        await to('zoom', f);
        await shot(`.playwright-mcp/nova-zoom-${k}.png`);
      }
      continue;
    }
    await to(id);
    await shot(`.playwright-mcp/nova-${id}.png`);
  }
  await to('zoom', 0.95);
  checks.mono = await page.evaluate(() => ({ label: document.querySelector('[data-zoom-x]').textContent, filter: document.getElementById('sky').style.filter }));

  // перо: три звезды → две линии, линии переживают перезагрузку
  await to('pen', 0.1);
  const stars = await page.evaluate(() => window.__nova.sky.starsOnScreen().filter((p) => p.x < innerWidth * 0.3).slice(0, 3));
  for (const p of stars) await page.mouse.click(p.x, p.y);
  checks.lines = await page.evaluate(() => window.__nova.sky.count);
  await page.click('.pen-desk [data-shutter]');
  checks.polaroids = await page.locator('.polaroid').count();
  await shot('.playwright-mcp/nova-pen-drawn.png');
  await to('citadel', 0.08);
  await page.click('[data-check="orig"]');
  checks.signOk = await page.locator('.verify__res.is-ok').count();
  await page.click('[data-check="edit"]');
  checks.signBad = await page.locator('.verify__res.is-bad').count();
  await to('nogames', 0.1);
  await page.click('[data-app="game"]');
  checks.blocked = await page.locator('[data-blocked]').isVisible();
  await open(1440, 900);
  checks.linesAfterReload = await page.evaluate(() => window.__nova.sky.count);

  // телефон
  await open(390, 844);
  for (const id of CHAPTERS) {
    await to(id, id === 'zoom' ? 0.41 : 0.12);
    await shot(`.playwright-mcp/nova-m-${id}.png`);
  }
  checks.noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

  // без JS: обычная длинная страница
  const ctx = await page.context().browser().newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  const p2 = await ctx.newPage();
  await p2.goto(BASE);
  checks.noJsVisible = await p2.evaluate((ids) => ids.every((i) => { const r = document.getElementById(i).getBoundingClientRect(); return r.height > 200; }), CHAPTERS);
  await p2.screenshot({ path: '.playwright-mcp/nova-nojs.png', fullPage: false });
  await ctx.close();

  return { errs, checks, shots: shots.length };
}
