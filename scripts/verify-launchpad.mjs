// Requires the local dev server. Uses a separate, disposable agent-browser session.
// Application inventories are intercepted in this browser only; nothing is installed.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
import { chinaAppStorePackages } from "../lib/china-apps.ts";

const cli = new URL("../node_modules/.bin/agent-browser", import.meta.url).pathname;
const session = "launchpad-verification";
const run = (...args) => execFileSync(cli, ["--session", session, ...args], { encoding: "utf8", timeout: 60000 }).trim();
const base = process.env.LAUNCHPAD_URL || "http://127.0.0.1:30141";
const output = process.env.LAUNCHPAD_SCREENSHOTS || "/tmp/syntropic-launchpad-verification";
await mkdir(output, { recursive: true });
run("open", base);
const browser = await chromium.connectOverCDP(run("get", "cdp-url"));
const page = browser.contexts()[0].pages().find(page => page.url().startsWith(base));
assert.ok(page, "The local application must be open");
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const panel = page.getByRole("dialog", { name: "启动台", exact: true });
const rows = panel.locator(".agent-os-launchpad-app");
const search = panel.getByRole("textbox", { name: "搜索应用", exact: true });
const open = async () => {
  await page.locator(".dock-launchpad").click();
  await panel.waitFor();
  await page.waitForFunction(() => document.querySelector('.launchpad-panel')?.getAttribute("aria-busy") === "false");
};
try {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open();
  assert.ok(await rows.count() >= 11, "Live built-in applications load");
  assert.equal(await search.evaluate(el => el === document.activeElement), true);
  const feishuAsset = await panel.locator('.is-feishu img').getAttribute("src");
  const systemStyles = await page.evaluate(() => [...document.querySelectorAll('.agent-os-launchpad-icon.is-system')].map(icon => {
    const id = [...icon.classList].find(c => c.startsWith('is-') && c !== 'is-system').slice(3);
    const dock = document.querySelector(`.agent-os-dock > .dock-${id}`);
    return { id, same: !!dock && getComputedStyle(icon).backgroundColor === getComputedStyle(dock).backgroundColor };
  }));
  assert.ok(systemStyles.filter(item => item.id !== "store").every(item => item.same), "System icon colors match the Dock");
  await search.fill("应用市场");
  assert.equal(await rows.count(), 1);
  await search.press("ArrowDown");
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), "打开 应用市场");
  await page.keyboard.press("Escape");
  await panel.waitFor({ state: "detached" });
  assert.equal(await page.locator(".dock-launchpad").evaluate(el => el === document.activeElement), true);
  await open();
  assert.equal(await search.inputValue(), "", "Reopening starts with a fresh search");
  await search.fill("应用市场");
  await search.press("Enter");
  await page.getByRole("article", { name: "应用市场", exact: true }).waitFor();
  await page.locator(".agent-store-icon.is-feishu img").first().waitFor();
  assert.equal(await page.locator(".agent-store-icon.is-feishu img").first().getAttribute("src"), feishuAsset);
  await page.getByRole("article", { name: "应用市场", exact: true }).getByRole("button", { name: "关闭", exact: true }).click();
  console.log("PASS live inventory, system icon colors, market brand asset, search, keyboard launch, Escape and focus restoration");

  const catalog = chinaAppStorePackages();
  const pluginNames = ["@aduverger/pi-ship", "pi-mono-figma", "@dreki-gg/pi-slack", "@feniix/pi-notion", "pi-mono-linear", "pi-google-workspace"];
  await page.route("**/api/plugins?*", route => route.fulfill({ json: { packages: pluginNames.map(packageName => ({ packageName, source: `npm:${packageName}`, scope: "global", status: "enabled" })) } }));
  await page.route("**/api/plugins", route => route.fulfill({ json: { packages: pluginNames.map(packageName => ({ packageName, source: `npm:${packageName}`, scope: "global", status: "enabled" })) } }));
  await page.route("**/api/app-store/installations", route => route.fulfill({ json: { builtins: ["feishu"], installed: catalog.map(app => app.connectionId).filter(id => id !== "feishu") } }));
  await open();
  for (const close of await page.locator(".jd-dismiss").all()) await close.click();
  const total = await rows.count();
  assert.equal(total, 10 + catalog.length + pluginNames.length);
  await search.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), "打开 产物库");
  await page.keyboard.press("ArrowDown");
  assert.notEqual(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), "打开 产物库");
  await panel.getByRole("button", { name: "法律服务", exact: true }).click();
  assert.equal(await rows.count(), catalog.filter(item => item.category === "法律服务").length);
  await search.fill("没有这个应用");
  await panel.getByText("没有匹配的应用", { exact: true }).waitFor();
  assert.equal(await rows.count(), 0);
  await panel.getByRole("button", { name: "清除搜索" }).click();
  await panel.getByRole("button", { name: "全部", exact: true }).click();
  await search.fill("FiGmA");
  assert.equal(await rows.count(), 1);
  await panel.getByRole("button", { name: "清除搜索" }).click();
  // Click within panel whitespace must not dismiss; outside it must dismiss.
  await panel.locator("h1").click();
  assert.equal(await panel.isVisible(), true);
  await page.mouse.click(20, 210);
  await panel.waitFor({ state: "detached" });
  await open();
  for (const [width, height] of [[1440, 900], [1280, 633], [768, 1024], [390, 844], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.waitForFunction(() => [...document.querySelectorAll('.agent-os-launchpad-app')].length > 0);
    const bounds = await panel.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
    assert.ok(bounds.y >= 44 && bounds.y + bounds.height <= height);
    const metrics = await page.evaluate(() => {
      const grid = document.querySelector('.agent-os-launchpad-grid');
      const composer = document.querySelector('.agent-os-ai-surface');
      return { gridHeight: grid.clientHeight, overflow: grid.scrollWidth > grid.clientWidth + 1,
        panelBottom: document.querySelector('.launchpad-panel').getBoundingClientRect().bottom,
        composerTop: composer.getBoundingClientRect().top };
    });
    assert.ok(metrics.gridHeight >= 50, `Scrollable grid remains usable at ${width}×${height}`);
    assert.equal(metrics.overflow, false);
    assert.ok(metrics.panelBottom <= metrics.composerTop + 1, `Composer does not overlap at ${width}×${height}`);
    await rows.last().focus();
    await page.keyboard.press("Home");
    await page.screenshot({ animations: "disabled", path: `${output}/fixture-${width}x${height}.png` });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await panel.evaluate(el => getComputedStyle(el).animationName), "none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  assert.deepEqual(errors, []);
  console.log(`PASS ${total}-app fixture: categories, empty state, clear, case-insensitive search, 2D navigation, outside click, five viewports and reduced motion`);
  console.log(`Screenshots: ${output}`);
} finally {
  await browser.close();
  run("close");
}
