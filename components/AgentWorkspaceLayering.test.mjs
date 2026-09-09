import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cssSource = await readFile(new URL("./AgentDesktop.css", import.meta.url), "utf8");
const desktopSource = await readFile(new URL("./AgentDesktop.tsx", import.meta.url), "utf8");

function zIndexFor(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rule = cssSource.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  assert.ok(rule, `Missing CSS rule for ${selector}`);
  const zIndex = rule[1].match(/z-index:\s*(\d+)/);
  assert.ok(zIndex, `Missing z-index for ${selector}`);
  return Number(zIndex[1]);
}

test("the AI entry stays above business windows, workspace menus and notifications", () => {
  const aiLayer = zIndexFor(".agent-os-ai-surface");
  for (const selector of [
    ".agent-os-window-layer", ".agent-os-menu-bar:has(.agent-os-workspace-menu)",
    ".agent-os-launchpad",
    ".agent-os-notification-center", ".agent-os-insight-notification", ".agent-os-jd-notification",
  ]) assert.ok(aiLayer > zIndexFor(selector), `AI entry must stay above ${selector}`);
});

test("Dock magnification, labels and menus remain above the AI entry", () => {
  const aiLayer = zIndexFor(".agent-os-ai-surface");
  const dockLayer = zIndexFor(".agent-os-dock");
  assert.ok(dockLayer > aiLayer, "Magnified icons and labels must not be clipped by the composer");
  assert.ok(zIndexFor(".agent-os-dock-context-menu") > dockLayer, "The context menu must stay above Dock icons");
});

test("workspace management stays above apps while leaving the AI entry accessible", () => {
  const workspaceLayer = zIndexFor(".agent-os-menu-bar:has(.agent-os-workspace-menu)");
  assert.ok(zIndexFor(".agent-os-dock") > workspaceLayer);
  assert.ok(workspaceLayer > zIndexFor(".agent-os-launchpad"));
  assert.ok(workspaceLayer < zIndexFor(".agent-os-ai-surface"));
  assert.doesNotMatch(desktopSource, /className="agent-os-launchpad"[^>]*aria-modal="true"/);
});

test("the workspace disclosure icon rotates inside a stable SVG box", () => {
  assert.match(desktopSource, /<Icon name="chevron-down" size=\{12\}\/></);
  assert.doesNotMatch(desktopSource, />⌄<\/small>/);
  assert.match(cssSource, /\.agent-os-workspace-chevron\s*\{[^}]*width:\s*12px;[^}]*height:\s*12px;[^}]*place-items:\s*center;[^}]*transform-origin:\s*50% 50%/);
  assert.match(cssSource, /\.agent-os-workspace-chevron\.open\s*\{[^}]*transform:\s*rotate\(180deg\)/);
});
