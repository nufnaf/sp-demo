import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const component = await readFile(new URL("./TerminalApp.tsx", import.meta.url), "utf8");
const desktop = await readFile(new URL("./AgentDesktop.tsx", import.meta.url), "utf8");
const sessionRoute = await readFile(new URL("../app/api/terminal/sessions/[terminalId]/route.ts", import.meta.url), "utf8");
const eventRoute = await readFile(new URL("../app/api/terminal/sessions/[terminalId]/events/route.ts", import.meta.url), "utf8");

test("Agent OS exposes a workspace-scoped terminal system app", () => {
  assert.match(desktop, /id: "system:terminal", name: "终端"/);
  assert.match(desktop, /<TerminalApp key=\{activeCwd\} cwd=\{activeCwd\}/);
  assert.match(desktop, /setTerminalOpen\(false\)/);
  assert.doesNotMatch(desktop, /setTerminalOpen\(false\)[\s\S]{0,120}(?:kill|DELETE)/);
});

test("terminal app batches PTY input and adapts its dimensions", () => {
  assert.match(component, /new Terminal\(/);
  assert.match(component, /new FitAddon\(/);
  assert.match(component, /inputBufferRef\.current \+= data/);
  assert.match(component, /setTimeout\(flushInput, 16\)/);
  assert.match(component, /new ResizeObserver\(applySize\)/);
  assert.match(component, /type: "resize"/);
  assert.match(component, /new EventSource/);
});

test("terminal mutations and output streams enforce the shared security boundary", () => {
  assert.match(sessionRoute, /assertTerminalRequestAllowed\(request\)/);
  assert.match(sessionRoute, /hasJsonContentType\(request\)/);
  assert.match(sessionRoute, /resolveTerminalCwd\(body\.cwd\)/);
  assert.match(eventRoute, /assertTerminalRequestAllowed\(request\)/);
  assert.match(eventRoute, /resolveTerminalCwd/);
});
