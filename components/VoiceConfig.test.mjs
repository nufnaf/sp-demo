import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./VoiceConfig.tsx", import.meta.url), "utf8");
const routeSource = await readFile(new URL("../app/api/voice/settings/route.ts", import.meta.url), "utf8");

test("voice settings never load an access key back into the form", () => {
  assert.match(source, /accessKey: ""/);
  assert.match(source, /accessKeyConfigured/);
  assert.doesNotMatch(routeSource, /accessKey:\s*effective\?\.accessKey/);
});

test("voice settings can save, verify, and remove local credentials", () => {
  assert.match(source, /method: "PUT"/);
  assert.match(source, /fetch\("\/api\/voice\/session", \{ method: "POST" \}\)/);
  assert.match(source, /method: "DELETE"/);
  assert.match(routeSource, /isApiRequestAllowed\(request\)/);
  assert.match(routeSource, /hasJsonContentType\(request\)/);
});
