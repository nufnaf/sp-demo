import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeSource = await readFile(new URL("./route.ts", import.meta.url), "utf8");
const documentsRouteSource = await readFile(new URL("./documents/route.ts", import.meta.url), "utf8");
const cliSource = await readFile(new URL("../../../../lib/feishu-cli.ts", import.meta.url), "utf8");

test("the Feishu installer is a protected built-in CLI endpoint", () => {
  assert.match(routeSource, /isApiRequestAllowed\(request\)/);
  assert.match(routeSource, /hasJsonContentType\(request\)/);
  assert.match(routeSource, /body\.action === "install"/);
  assert.match(routeSource, /body\.action === "configure"/);
  assert.match(routeSource, /body\.action === "login"/);
});

test("installation follows the official Feishu CLI guide without Pi plugin APIs", () => {
  assert.match(cliSource, /\["install", "--global", "@larksuite\/cli"\]/);
  assert.match(cliSource, /\["-y", "skills", "add", "https:\/\/open\.feishu\.cn", "--skill", "-y"\]/);
  assert.match(cliSource, /\["auth", "qrcode", url, "--output", fileName/);
  assert.match(cliSource, /\["auth", "login", "--recommend", "--scope", "search:docs:read", "--no-wait", "--json"\]/);
  assert.match(cliSource, /\["auth", "login", "--device-code", pending\.deviceCode\]/);
  assert.doesNotMatch(cliSource, /DefaultPackageManager|SettingsManager/);
});

test("cloud documents use the authenticated user identity and official Drive search", () => {
  assert.match(documentsRouteSource, /isApiRequestAllowed\(request\)/);
  assert.match(documentsRouteSource, /getFeishuDocuments\(query\)/);
  assert.match(cliSource, /"drive", "\+search", "--query", normalizedQuery/);
  assert.match(cliSource, /"--opened-since", "90d", "--sort", "open_time"/);
  assert.match(cliSource, /"--as", "user"/);
  assert.match(cliSource, /const user = asRecord\(identities\?\.user\)/);
});
