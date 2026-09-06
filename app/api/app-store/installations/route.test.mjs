import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("./route.ts", import.meta.url), "utf8");
const service = await readFile(new URL("../../../../lib/app-installations.ts", import.meta.url), "utf8");

test("connector installation mutations are same-origin JSON only", () => {
  assert.match(route, /isApiRequestAllowed\(request\)/);
  assert.match(route, /hasJsonContentType\(request\)/);
  assert.match(route, /isChinaConnectorAppId/);
});

test("connector installation state is private and atomically replaced", () => {
  assert.match(service, /mode: 0o600/);
  assert.match(service, /rename\(temporary, INSTALLATIONS_PATH\)/);
  assert.doesNotMatch(service, /credentials|secret|token/i);
});
