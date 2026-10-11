// Скриншоты ключевых сцен страницы Pro (для проверки глазами).
// Запуск: Playwright MCP → browser_run_code_unsafe { filename: "tests/e2e/shots-pro.js" }
async (page) => {
  await page.context().route('**://fonts.bunny.net/**', (r) => r.abort());
  const W = 1440, H = 900;
  await page.setViewportSize({ width: W, height: H });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('about:blank');
  await page.goto('http://127.0.0.1:5317/pro/?debug', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__oy && !window.__oy.Keys.empty, null, { timeout: 45000 });
  await page.waitForTimeout(1000);
  await page.addStyleTag({ content: 'html{scrollbar-width:none}' });
  const shots = [];
  const at = async (id, f, name) => {
    await page.evaluate(([id, f]) => { const st = window.__oy.ScrollTrigger.getAll().find((s) => s.trigger && s.trigger.id === id); window.scrollTo(0, st.start + f * (st.end - st.start)); }, [id, f]);
    // Ждём, пока тик выставит цель по новой прокрутке (кадры в headless редкие)
    await page.waitForFunction(() => {
      const { Keys, stage } = window.__oy;
      const v = Keys.sample(window.scrollY);
      return Object.keys(v).every((k) => !(k in stage.debug.target) || Math.abs(stage.debug.target[k] - v[k]) < 1e-6);
    }, null, { timeout: 20000 });
    await page.evaluate(() => window.__oy.stage.snap());
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
    const p = `.playwright-mcp/pro-${name}.png`;
    await page.screenshot({ path: p });
    shots.push(p);
  };
  for (const [id, f, name] of [['hero', 0, 'hero'], ['cams', 0.5, 'cams'], ['cams', 0.95, 'camsfront'], ['citadel', 0.8, 'citadel'], ['claw', 0.7, 'claw'], ['switches', 0.95, 'switches'], ['edges', 0.5, 'edges'], ['display', 0.5, 'display'], ['inside', 0.65, 'inside'], ['colors', 0.4, 'colors']]) {
    await at(id, f, name);
  }
  // 2D-секции
  for (const sel of ['#calls', '#water', '#perf', '#battery', '#os2', '#highlights', '#buy', '#specs', '#final']) {
    await page.evaluate((sel) => window.scrollTo(0, document.querySelector(sel).getBoundingClientRect().top + window.scrollY - 70), sel);
    await page.waitForTimeout(2500);
    const p = `.playwright-mcp/pro-2d-${sel.slice(1)}.png`;
    await page.screenshot({ path: p });
    shots.push(p);
  }
  return { errs, shots };
}
