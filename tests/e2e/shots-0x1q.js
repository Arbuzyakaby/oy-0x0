// Скриншоты ключевых сцен страницы 0X1Q, превью ссылки (1200×630) и витрины.
// Запуск: Playwright MCP → browser_run_code_unsafe { filename: "tests/e2e/shots-0x1q.js" }
async (page) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  const shots = [];
  const open = async (w, h) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('about:blank');
    await page.goto('http://127.0.0.1:5317/0x1q/?debug', { waitUntil: 'domcontentloaded' });
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

  // Превью ссылки
  await open(1200, 630);
  await at('hero', 0, '.playwright-mcp/og-0x1q.png');

  await open(1440, 900);
  for (const [id, f, name] of [['hero', 0, 'hero'], ['module', 0.3, 'module'], ['module', 0.8, 'lift'], ['flip', 0.95, 'flip'], ['qkey', 0.95, 'qkey'], ['inside', 0.6, 'inside']]) {
    await at(id, f, `.playwright-mcp/0x1q-${name}.png`);
  }
  for (const sel of ['#try', '#nullchip']) {
    await page.evaluate((sel) => window.scrollTo(0, document.querySelector(sel).getBoundingClientRect().top + window.scrollY - 70), sel);
    await page.waitForTimeout(2500);
    const p = `.playwright-mcp/0x1q-2d-${sel.slice(1)}.png`;
    await page.screenshot({ path: p });
    shots.push(p);
  }

  // Витрина: модельный ряд
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:5317/', { waitUntil: 'load' });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: '.playwright-mcp/home.png' });
  shots.push('.playwright-mcp/home.png');
  return { errs, shots };
}
