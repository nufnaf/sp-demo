import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
test("published notice uses the recruiting site's primary blue palette", async () => {
  const css = await readFile(join(root, "public/style.css"), "utf8");
  assert.match(css, /\.notice\.success\s*\{[^}]*color:\s*var\(--color-primary\)[^}]*border-color:\s*var\(--color-primary\)[^}]*background:\s*var\(--color-primary-soft\)/);
});
