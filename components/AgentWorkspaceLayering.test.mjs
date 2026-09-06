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

test("the open workspace manager floats above every desktop interaction layer", () => {
  const workspaceLayer = zIndexFor(".agent-os-menu-bar:has(.agent-os-workspace-menu)");

  assert.ok(workspaceLayer > zIndexFor(".agent-os-ai-surface"));
  assert.ok(workspaceLayer > zIndexFor(".agent-os-dock"));
  assert.ok(workspaceLayer > zIndexFor(".agent-os-launchpad"));
  assert.ok(workspaceLayer < zIndexFor(".agent-os-toast"));
});

test("the workspace disclosure icon rotates inside a stable SVG box", () => {
  assert.match(desktopSource, /<Icon name="chevron-down" size=\{12\}\/></);
  assert.doesNotMatch(desktopSource, />⌄<\/small>/);
  assert.match(cssSource, /\.agent-os-workspace-chevron\s*\{[^}]*width:\s*12px;[^}]*height:\s*12px;[^}]*place-items:\s*center;[^}]*transform-origin:\s*50% 50%/);
  assert.match(cssSource, /\.agent-os-workspace-chevron\.open\s*\{[^}]*transform:\s*rotate\(180deg\)/);
});
