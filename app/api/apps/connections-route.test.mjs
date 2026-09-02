import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const connectionRoute = await readFile(new URL("./[appId]/connection/route.ts", import.meta.url), "utf8");
const dataRoute = await readFile(new URL("./[appId]/data/route.ts", import.meta.url), "utf8");
const callbackRoute = await readFile(new URL("./[appId]/oauth/callback/route.ts", import.meta.url), "utf8");
const connections = await readFile(new URL("../../../lib/app-connections.ts", import.meta.url), "utf8");
const rpcManager = await readFile(new URL("../../../lib/rpc-manager.ts", import.meta.url), "utf8");

test("app connection mutations enforce local same-origin JSON requests", () => {
  assert.match(connectionRoute, /isApiRequestAllowed\(request\)/);
  assert.match(connectionRoute, /hasJsonContentType\(request\)/);
  assert.match(connectionRoute, /export async function DELETE/);
});

test("credentials use plugin-native stores and are never returned by status", () => {
  assert.match(connections, /auth\.json/);
  assert.match(connections, /notion-mcp-auth\.json/);
  assert.match(connections, /google-workspace/);
  assert.match(connections, /mode: 0o600/);
  assert.doesNotMatch(dataRoute, /token|secret/i);
});

test("OAuth callbacks validate state and emit a non-cached local completion page", () => {
  assert.match(connections, /params\.get\("state"\) !== entry\.state/);
  assert.match(callbackRoute, /Cache-Control/);
  assert.match(callbackRoute, /escapeHtml/);
});

test("all six app adapters return real provider data", () => {
  for (const provider of ["api.github.com", "api.figma.com", "api.linear.app", "slack.com/api", "mcp.notion.com", "googleapis.com/drive"]) {
    assert.match(connections, new RegExp(provider.replaceAll(".", "\\.")));
  }
});

test("persisted Slack and GitHub credentials are hydrated before Pi loads plugins", () => {
  assert.match(connections, /export async function hydrateAppConnectionEnvironment/);
  assert.match(rpcManager, /await hydrateAppConnectionEnvironment\(\)/);
});
