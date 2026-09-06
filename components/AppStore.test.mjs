import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const desktopSource = await readFile(new URL("./AgentDesktop.tsx", import.meta.url), "utf8");
const storeSource = await readFile(new URL("./AppStore.tsx", import.meta.url), "utf8");
const storeCss = await readFile(new URL("./AgentDesktop.css", import.meta.url), "utf8");
const routeSource = await readFile(new URL("../app/api/app-store/route.ts", import.meta.url), "utf8");

test("the Dock opens a native App Store window", () => {
  assert.match(desktopSource, /id: "system:store", name: "应用商店"/);
  assert.match(desktopSource, /item\.id === "system:store"/);
  assert.match(desktopSource, /<DesktopWindow title="应用商店" kind="store"/);
  assert.match(desktopSource, /<AppStore onOpenApp=\{openLaunchpadApp\}/);
  assert.match(storeCss, /\.agent-store\{[^}]*grid-template-columns:168px/);
  assert.match(storeCss, /\.agent-store-hero\{/);
  assert.match(storeSource, /function AppStoreBrandIcon/);
  assert.doesNotMatch(storeSource, /function StoreGlyph|storeIconKind/);
  assert.match(storeSource, /<img src=\{item\.logoUrl/);
  assert.match(storeCss, /\.agent-store-icon img\{/);
  assert.match(storeCss, /\.agent-store-icon\.is-huayu-law\{background:#184d69\}/);
  assert.match(storeCss, /\.agent-store-icon\.is-huayu-law img\{width:86%;height:auto/);
  assert.match(storeCss, /\.agent-store-icon\{[^}]*rgba\(255,255,255,\.88\)[^}]*backdrop-filter:blur\(18px\)/);
  assert.match(storeCss, /\.agent-store-brand-icon\{[^}]*rgba\(255,255,255,\.88\)[^}]*backdrop-filter:blur\(18px\)/);
  assert.match(storeCss, /\.agent-store-dock-icon\{[^}]*background:transparent[^}]*box-shadow:none/);
  assert.match(storeSource, /M7\.5 25\.5 16 6\.5l8\.5 19M10\.8 18\.2h10\.4/);
  assert.doesNotMatch(storeSource, /ICON_BACKGROUNDS|iconStyle/);
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

test("the storefront presents curated China apps and keeps its content scrollable", () => {
  assert.doesNotMatch(storeSource, /label: "扩展"|label: "技能"/);
  assert.doesNotMatch(storeSource, /TYPE_LABELS/);
  assert.match(storeSource, /className="agent-store-sidebar-search"[\s\S]*?placeholder="搜索应用"/);
  assert.doesNotMatch(storeSource, /className="agent-store-toolbar"/);
  assert.match(storeSource, /aria-label="同步应用目录"/);
  assert.match(storeSource, /Agent OS 应用/);
  assert.doesNotMatch(storeSource, /热门排行|最近上架|社区目录/);
  assert.match(storeCss, /\.agent-store-main\{[^}]*min-height:0[^}]*overflow:hidden/);
  assert.match(storeCss, /\.agent-store-scroll\{[^}]*min-height:0[^}]*overflow-y:auto[^}]*touch-action:pan-y/);
});
