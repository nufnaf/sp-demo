import assert from "node:assert/strict";
import test from "node:test";
import { buildPiCatalogUrl, parsePiPackageCatalog } from "./app-store-catalog.ts";
import { CHINA_APPS, chinaAppStorePackages } from "./china-apps.ts";

test("parses Pi package cards into application-store records", () => {
  const html = `<span class="packages-count">1-50 / 5,477</span>
    <article class="surface-panel" data-package-card="true" data-package-name="@demo/pi-tools" data-package-types="extension skill" data-package-downloads="12034">
      <div class="packages-card-body"><p class="packages-desc">Useful &amp; safe tools</p>
      <div class="packages-meta"><span>demo</span><span>12K/mo</span><span>2d ago</span></div>
      <a href="https://www.npmjs.com/package/@demo/pi-tools">npm</a><a href="https://github.com/demo/pi-tools">repo</a></div>
    </article>`;
  const result = parsePiPackageCatalog(html);
  assert.equal(result.total, 5477);
  assert.deepEqual(result.packages[0], {
    packageName: "@demo/pi-tools",
    source: "npm:@demo/pi-tools",
    name: "Tools",
    description: "Useful & safe tools",
    author: "demo",
    monthlyDownloads: 12034,
    downloadsLabel: "12K/mo",
    updatedLabel: "2d ago",
    types: ["extension", "skill"],
    catalogUrl: "https://pi.dev/packages/@demo/pi-tools",
    npmUrl: "https://www.npmjs.com/package/@demo/pi-tools",
    repositoryUrl: "https://github.com/demo/pi-tools",
  });
});

test("China connectors disclose whether authorization is OAuth, browser-token, or enterprise managed", () => {
  assert.equal(CHINA_APPS.find((app) => app.id === "feishu")?.authorization.kind, "oauth");
  assert.equal(CHINA_APPS.find((app) => app.id === "wecom")?.authorization.kind, "oauth");
  assert.equal(CHINA_APPS.find((app) => app.id === "dingtalk")?.authorization.kind, "oauth");
  assert.equal(CHINA_APPS.find((app) => app.id === "beisen")?.authorization.kind, "oauth");
  assert.equal(CHINA_APPS.find((app) => app.id === "boss-zhipin")?.authorization.kind, "oauth");
  assert.equal(CHINA_APPS.find((app) => app.id === "wps")?.authorization.kind, "oauth");
  assert.equal(CHINA_APPS.find((app) => app.id === "tencent-docs")?.authorization.kind, "browser-token");
  assert.equal(CHINA_APPS.find((app) => app.id === "tencent-meeting")?.authorization.kind, "browser-token");
  for (const id of ["tonghuashun", "wind", "eastmoney", "pkulaw", "huayu-law", "qichacha", "tianyancha"]) {
    assert.equal(CHINA_APPS.find((app) => app.id === id)?.authorization.kind, "enterprise", `${id} must not claim end-user OAuth`);
  }
});

test("guided collaboration CLIs replace manual enterprise key forms", () => {
  for (const id of ["wecom", "dingtalk", "beisen", "boss-zhipin"]) {
    const app = CHINA_APPS.find((candidate) => candidate.id === id);
    assert.equal(app?.authMode, "cli");
    assert.deepEqual(app?.fields, []);
  }
});

test("builds a bounded official catalog query", () => {
  const url = new URL(buildPiCatalogUrl({ name: " memory ", type: "skill", sort: "recent", page: 3 }));
  assert.equal(url.origin, "https://pi.dev");
  assert.equal(url.searchParams.get("name"), "memory");
  assert.equal(url.searchParams.get("type"), "skill");
  assert.equal(url.searchParams.get("sort"), "recent");
  assert.equal(url.searchParams.get("page"), "3");
});

test("China-market catalog contains the requested collaboration, finance, and legal apps", () => {
  const packages = chinaAppStorePackages();
  assert.equal(packages.length, 15);
  assert.deepEqual(new Set(packages.map((item) => item.category)), new Set(["企业协同", "金融数据", "法律服务"]));
  for (const name of ["飞书", "企业微信", "钉钉", "北森 iTalent", "BOSS 直聘", "WPS 365", "腾讯文档", "腾讯会议", "同花顺", "Wind 万得", "东方财富", "北大法宝", "华宇法典", "企查查", "天眼查"]) {
    assert.ok(packages.some((item) => item.name === name), `${name} should be in the catalog`);
  }
  assert.ok(packages.every((item) => item.types.includes("connector")));
  assert.ok(packages.every((item) => item.logoUrl?.startsWith("/") || item.logoUrl?.startsWith("https://")));
  assert.equal(new Set(packages.map((item) => item.logoUrl)).size, 15);
  assert.equal(packages.filter((item) => item.logoUrl?.includes("/512x512bb.jpg")).length, 13);
});
