import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeSource = await readFile(new URL("./[appId]/cli/route.ts", import.meta.url), "utf8");
const cliSource = await readFile(new URL("../../../lib/collaboration-cli.ts", import.meta.url), "utf8");

test("collaboration CLI OAuth mutations are protected and app-scoped", () => {
  assert.match(routeSource, /isApiRequestAllowed\(request\)/);
  assert.match(routeSource, /hasJsonContentType\(request\)/);
  assert.match(routeSource, /isCollaborationCliId/);
  assert.match(routeSource, /body\.action === "install"/);
  assert.match(routeSource, /body\.action === "login"/);
  assert.match(routeSource, /body\.action === "verify"/);
});

test("WeCom and DingTalk use their official CLI authorization commands", () => {
  assert.match(cliSource, /packageName: "@wecom\/cli"/);
  assert.match(cliSource, /loginArgs: \["auth", "init", "--noninteractive", "--no-browser"\]/);
  assert.match(cliSource, /packageName: "dingtalk-workspace-cli"/);
  assert.match(cliSource, /loginArgs: \["auth", "login", "--device"\]/);
  assert.match(cliSource, /packageName: "beisen-cli"/);
  assert.match(cliSource, /loginArgs: \["auth", "login"\]/);
  assert.match(cliSource, /packageName: "@joohw\/boss-cli"/);
  assert.match(cliSource, /loginArgs: \["login"\]/);
  assert.doesNotMatch(cliSource, /corpId|agentId|clientSecret|appKey/i);
});
