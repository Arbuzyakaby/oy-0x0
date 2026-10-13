// Скриншоты страницы 0X2 Essential: превью ссылки (1200×630), кадры ленты, пульт, Красный режим, телефон.
// Запуск: Playwright MCP → browser_run_code_unsafe { filename: "tests/e2e/shots-0x2e.js" }
async (page) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  const shots = [];
  const open = async (w, h) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('about:blank');
    await page.goto('http://127.0.0.1:5317/0x2e/?debug', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__oy && document.getElementById('loader').classList.contains('is-done'), null, { timeout: 45000 });
    await page.waitForTimeout(1200);
    await page.addStyleTag({ content: 'html{scrollbar-width:none}' });
  };
  // Кадр ленты i (0…9): прокрутка до его доли закреплённой ленты
  const at = async (i, path, before) => {
    await page.evaluate((i) => {
      const st = window.__oy.ScrollTrigger.getAll().find((s) => s.pin);
      window.__oy.lenis().scrollTo(st.start + (st.end - st.start) * (i / 9), { immediate: true, force: true });
    }, i);
    await page.waitForFunction((i) => Math.abs(window.__oy.pos() - i) < 0.01, i, { timeout: 20000 });
    if (before) await page.evaluate(before);
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__oy.stage.snap());
    await page.waitForTimeout(1600);
    await page.screenshot({ path });
    shots.push(path);
  };

  await open(1200, 630);
  await at(0, '.playwright-mcp/og-0x2e.png');

  await open(1440, 900);
  for (const [i, name] of [[0, 'hero'], [1, 'shutter'], [2, 'switches'], [3, 'camera'], [4, 'tesseract'], [7, 'repair'], [9, 'buy']]) {
    await at(i, `.playwright-mcp/0x2e-${name}.png`);
  }
  await at(5, '.playwright-mcp/0x2e-red.png', () => document.querySelector('[data-ctl="red"]').click());
  await page.evaluate(() => document.querySelector('[data-ctl="red"]').click());

  await open(375, 812);
  await at(0, '.playwright-mcp/0x2e-mobile.png');

  return { shots, errs };
}
