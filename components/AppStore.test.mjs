import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const desktopSource = await readFile(new URL("./AgentDesktop.tsx", import.meta.url), "utf8");
const storeSource = await readFile(new URL("./AppStore.tsx", import.meta.url), "utf8");
const routeSource = await readFile(new URL("../app/api/app-store/route.ts", import.meta.url), "utf8");

test("the Dock opens a native App Store window", () => {
  assert.match(desktopSource, /id: "system:store", name: "应用市场"/);
  assert.match(desktopSource, /item\.id === "system:store"/);
  assert.match(desktopSource, /<DesktopWindow title="应用市场" kind="store"/);
  assert.match(desktopSource, /<AppStore onOpenApp=\{openLaunchpadApp\}/);

});

test("the store exposes only the curated China catalog and installs connectors", () => {
  assert.match(routeSource, /chinaAppStorePackages/);
  assert.doesNotMatch(routeSource, /buildPiCatalogUrl|parsePiPackageCatalog|pi\.dev/);
  assert.match(storeSource, /fetch\(`\/api\/app-store\?\$\{params\}`/);
  assert.match(storeSource, /fetch\("\/api\/app-store\/installations"/);
  assert.doesNotMatch(storeSource, /\/api\/plugins|installedFallback|Pi Community/);
  assert.match(storeSource, /window\.dispatchEvent\(new CustomEvent\("agent-os:apps-changed"\)\)/);
  assert.match(desktopSource, /window\.addEventListener\("agent-os:apps-changed", loadApps\)/);
});

test("the shared Feishu icon contains vector artwork rather than an embedded bitmap", async () => {
  const icon = await readFile(new URL("../public/icons/feishu-logo.svg", import.meta.url), "utf8");
  assert.match(icon, /<path /);
  assert.doesNotMatch(icon, /<image|data:image\/(?:png|jpeg)/);
});
