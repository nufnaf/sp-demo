import assert from "node:assert/strict";
import test from "node:test";
import { buildPiCatalogUrl, parsePiPackageCatalog } from "./app-store-catalog.ts";

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

test("builds a bounded official catalog query", () => {
  const url = new URL(buildPiCatalogUrl({ name: " memory ", type: "skill", sort: "recent", page: 3 }));
  assert.equal(url.origin, "https://pi.dev");
  assert.equal(url.searchParams.get("name"), "memory");
  assert.equal(url.searchParams.get("type"), "skill");
  assert.equal(url.searchParams.get("sort"), "recent");
  assert.equal(url.searchParams.get("page"), "3");
});
