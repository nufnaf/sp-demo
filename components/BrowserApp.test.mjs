import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const component = await readFile(new URL("./BrowserApp.tsx", import.meta.url), "utf8");
const desktop = await readFile(new URL("./AgentDesktop.tsx", import.meta.url), "utf8");
const desktopCss = await readFile(new URL("./AgentDesktop.css", import.meta.url), "utf8");
const rpcManager = await readFile(new URL("../lib/rpc-manager.ts", import.meta.url), "utf8");
const pagesRoute = await readFile(new URL("../app/api/browser/pages/route.ts", import.meta.url), "utf8");
const commandRoute = await readFile(new URL("../app/api/browser/pages/[pageId]/command/route.ts", import.meta.url), "utf8");

test("desktop exposes a built-in browser window that follows Agent open events", () => {
  assert.match(desktop, /id: "system:browser"/);
  assert.match(desktop, /new EventSource\("\/api\/browser\/events"\)/);
  assert.match(desktop, /message\.type !== "browser\.opened"/);
  assert.match(desktop, /<BrowserApp key=\{activeCwd\}/);
});

test("browser app provides navigation, adaptive screenshots, and shared human-AI control", () => {
  assert.match(component, /type: "navigate", action: "back"/);
  assert.match(component, /\/screenshot`, \{ cache: "no-store"/);
  assert.doesNotMatch(component, /共同操作|AI 已连接/);
  assert.match(component, /type: "resize", width, height/);
  assert.match(component, /BROWSER_CONTENT_SCALE = 0\.8/);
  assert.match(component, /contentRect\.width \/ BROWSER_CONTENT_SCALE/);
  assert.match(component, /new ResizeObserver/);
  assert.match(component, /type: "input", action: "coordinate_click"/);
  assert.match(component, /type: "input", action: "insert_text"/);
  assert.match(component, /onCompositionEnd=\{handleCompositionEnd\}/);
  assert.match(component, /event\.key\.length === 1/);
  assert.match(component, /insertText\(event\.key\)/);
  assert.doesNotMatch(component, /onInput=\{handleTextInput\}/);
  assert.match(desktopCss, /object-fit: contain/);
  assert.match(component, /inputTailRef\.current/);
  assert.match(component, /agent-browser-pointer-feedback/);
  assert.match(component, /activePage\?\.focus\?\.caret/);
  assert.match(component, /agent-browser-page-caret/);
  assert.match(desktopCss, /@keyframes agent-browser-caret-blink/);
  assert.match(component, /name="compass"/);
  assert.doesNotMatch(component, /agent-browser-start[\s\S]*?<form/);
  assert.match(desktopCss, /\.agent-browser-address input \{[^}]*border-radius: 0;[^}]*box-shadow: none;/);
  assert.doesNotMatch(component, /activePage\.controller !==/);
});

test("normal Pi sessions load browser tools and read-only mode excludes browser_act", () => {
  assert.match(rpcManager, /createBrowserExtension\(\)/);
  assert.match(rpcManager, /BROWSER_MUTATING_TOOL_NAMES/);
  assert.match(rpcManager, /!readOnly \|\| !mutatingExtensionToolNames\.has\(name\)/);
});

test("browser mutations require same-origin JSON and workspace authorization", () => {
  assert.match(pagesRoute, /isApiRequestAllowed\(request\)/);
  assert.match(pagesRoute, /hasJsonContentType\(request\)/);
  assert.match(pagesRoute, /isExistingFilePathAllowed\(body\.cwd/);
  assert.match(commandRoute, /isApiRequestAllowed\(request\)/);
  assert.match(commandRoute, /hasJsonContentType\(request\)/);
});
