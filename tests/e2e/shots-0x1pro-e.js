// Скриншоты ключевых сцен страниц 0X1 Pro и 0X1 Essential, превью ссылок (1200×630) и витрины.
// Запуск: Playwright MCP → browser_run_code_unsafe { filename: "tests/e2e/shots-0x1pro-e.js" }
async (page) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  const shots = [];
  // python -m http.server не просит не кешировать: без этого браузер берёт старые CSS и JS
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  const open = async (slug, w, h) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('about:blank');
    await page.goto(`http://127.0.0.1:5317/${slug}/?debug`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__oy && !window.__oy.Keys.empty, null, { timeout: 45000 });
    await page.waitForTimeout(1000);
    await page.addStyleTag({ content: 'html{scrollbar-width:none}' });
  };
  const at = async (id, f, path) => {
    await page.evaluate(([id, f]) => { const st = window.__oy.ScrollTrigger.getAll().find((s) => s.trigger && s.trigger.id === id); window.scrollTo(0, st.start + f * (st.end - st.start)); }, [id, f]);
    // Ждём, пока тик выставит цель по новой прокрутке (кадры в headless редкие)
    await page.waitForFunction(() => {
      const { Keys, stage } = window.__oy;
      const v = Keys.sample(window.scrollY);
      return Object.keys(v).every((k) => !(k in stage.debug.target) || Math.abs(stage.debug.target[k] - v[k]) < 1e-6);
    }, null, { timeout: 20000 });
    await page.evaluate(() => window.__oy.stage.snap());
    await page.waitForTimeout(1500);
    await page.screenshot({ path });
    shots.push(path);
  };
  const shot2d = async (sel, path, before) => {
    await page.evaluate((sel) => window.scrollTo(0, document.querySelector(sel).getBoundingClientRect().top + window.scrollY - 70), sel);
    if (before) await page.evaluate(before);
    await page.waitForTimeout(before ? 7000 : 2500);
    await page.screenshot({ path });
    shots.push(path);
  };

  // 0X1 Pro
  await open('0x1pro', 1200, 630);
  await at('hero', 0, '.playwright-mcp/og-0x1pro.png');
  await open('0x1pro', 1440, 900);
  for (const [id, f, name] of [['hero', 0, 'hero'], ['cams', 0.4, 'cams'], ['citadel', 0.85, 'citadel'], ['keys', 0.9, 'keys'], ['inside', 0.9, 'inside'], ['colors', 0.4, 'colors']]) {
    await at(id, f, `.playwright-mcp/0x1pro-${name}.png`);
  }
  await shot2d('#vault', '.playwright-mcp/0x1pro-vault.png', () => {
    document.querySelector('#vt-last').click();
    document.querySelector('[data-last-run]').click();
  });

  // 0X1 Essential
  await open('0x1e', 1200, 630);
  await at('hero', 0, '.playwright-mcp/og-0x1e.png');
  await open('0x1e', 1440, 900);
  for (const [id, f, name] of [['hero', 0, 'hero'], ['design', 0.6, 'design'], ['key', 0.75, 'key'], ['cams', 0.45, 'cams'], ['inside', 0.9, 'inside']]) {
    await at(id, f, `.playwright-mcp/0x1e-${name}.png`);
  }
  await shot2d('#kept', '.playwright-mcp/0x1e-kept.png');

  // Витрина и сравнение
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:5317/', { waitUntil: 'load' });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: '.playwright-mcp/home.png' });
  shots.push('.playwright-mcp/home.png');
  return { errs, shots };
}
