import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const widgetSource = await readFile(new URL("./DraggableDesktopWidget.tsx", import.meta.url), "utf8");
const desktopSource = await readFile(new URL("./AgentDesktop.tsx", import.meta.url), "utf8");
const cssSource = await readFile(new URL("./AgentDesktop.css", import.meta.url), "utf8");

test("remaining desktop widgets drag directly from their headers and persist position", () => {
  assert.match(widgetSource, /setPointerCapture\(event\.pointerId\)/);
  assert.match(widgetSource, /releasePointerCapture\(event\.pointerId\)/);
  assert.match(widgetSource, /\.closest\("\.agent-os-card > header"\)/);
  assert.match(widgetSource, /translate3d\(\$\{position\.x\}px, \$\{position\.y\}px, 0\)/);
  assert.match(widgetSource, /pi-web:desktop-widget-position:/);
  assert.match(widgetSource, /Math\.max\(8, Math\.min\(drag\.maxX/);
  assert.equal((desktopSource.match(/<DraggableDesktopWidget/g) ?? []).length, 2);
});

test("business goal and calendar widgets are removed", () => {
  assert.doesNotMatch(desktopSource, /业务目标|agent-os-calendar-card/);
  assert.doesNotMatch(cssSource, /agent-os-calendar-card|agent-os-left-widgets|agent-os-right-widgets/);
  assert.match(cssSource, /\.agent-os-desktop-widget\.is-dragging/);
  assert.match(cssSource, /touch-action: none/);
});
