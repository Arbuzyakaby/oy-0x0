// Скриншоты ключевых сцен страниц 0X2 и 0X2Q, превью ссылок (1200×630) и витрины.
// Запуск: Playwright MCP → browser_run_code_unsafe { filename: "tests/e2e/shots-0x2.js" }
async (page) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  const shots = [];
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
  const flat = async (sel, path, before) => {
    await page.evaluate((sel) => window.scrollTo(0, document.querySelector(sel).getBoundingClientRect().top + window.scrollY - 70), sel);
    await page.waitForTimeout(2200);
    if (before) { await page.evaluate(before); await page.waitForTimeout(4500); }
    await page.screenshot({ path });
    shots.push(path);
  };

  // 0X2
  await open('0x2', 1200, 630);
  await at('hero', 0, '.playwright-mcp/og-0x2.png');
  await open('0x2', 1440, 900);
  for (const [id, f, name] of [['hero', 0, 'hero'], ['cams', 0.4, 'cams'], ['tesseract', 0.8, 'tesseract'], ['inside', 0.9, 'inside'], ['colors', 0.3, 'colors']]) {
    await at(id, f, `.playwright-mcp/0x2-${name}.png`);
  }
  await flat('#memory', '.playwright-mcp/0x2-memory.png');
  await flat('#boot', '.playwright-mcp/0x2-boot.png', () => document.querySelector('[data-boot-run]').click());

  // 0X2Q
  await open('0x2q', 1200, 630);
  await at('hero', 0, '.playwright-mcp/og-0x2q.png');
  await open('0x2q', 1440, 900);
  for (const [id, f, name] of [['hero', 0, 'hero'], ['design', 0.9, 'closed'], ['motor', 0.55, 'motor'], ['modules', 0.37, 'thermal'], ['modules', 0.95, 'beam'], ['inside', 0.9, 'inside']]) {
    await at(id, f, `.playwright-mcp/0x2q-${name}.png`);
  }
  await flat('#try', '.playwright-mcp/0x2q-try.png', () => document.querySelector('[data-vf-mod] [data-value="thermal"]').click());
  await flat('#citadel3', '.playwright-mcp/0x2q-citadel3.png');

  // Витрина и OY OS 3
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:5317/', { waitUntil: 'load' });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: '.playwright-mcp/home.png' });
  shots.push('.playwright-mcp/home.png');
  await page.goto('http://127.0.0.1:5317/os/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await flat('#os3', '.playwright-mcp/os-os3.png');
  return { errs, shots };
}
