import { cp, mkdir, readFile, readdir, rename, rm, symlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const versionName = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function linkResources(root, bundled) {
  for (const entry of ['server.js', 'node_modules', 'public', 'apps', 'electron']) {
    // Refresh on launch so moving the same App to another folder remains safe.
    // Non-recursive removal refuses to erase a real directory here.
    await rm(join(root, entry), { force: true });
    await symlink(join(bundled, entry), join(root, entry));
  }
  await mkdir(join(root, '.next/cache'), { recursive: true });
  for (const entry of await readdir(join(bundled, '.next'))) {
    if (entry === 'cache') continue;
    await rm(join(root, '.next', entry), { force: true });
    await symlink(join(bundled, '.next', entry), join(root, '.next', entry));
  }
}

export async function preparePackagedRuntime(resources, userData, buildId) {
  if (!versionName.test(buildId)) throw new Error('Invalid desktop build ID');
  const versions = join(userData, 'runtimes');
  const root = join(versions, buildId);
  const bundled = join(resources, 'runtime');
  if (existsSync(join(root, 'package.json'))) {
    await linkResources(root, bundled);
    return root;
  }
  const pending = `${root}.pending`;
  await mkdir(versions, { recursive: true });
  await rm(pending, { recursive: true, force: true });
  await mkdir(pending);
  // Keep only a tiny ownership/package manifest locally. All executable code
  // and build assets are immutable bundle links; only .next/cache is writable.
  // Desktop Next config disables ISR disk writes into .next/server.
  await cp(join(bundled, 'package.json'), join(pending, 'package.json'));
  await linkResources(pending, bundled);
  await rename(pending, root);
  return root;
}

// Called only after both new services are healthy. Never traverse a symlink or
// delete personal data, unrelated folders, or the active version.
export async function removeOldPackagedRuntimes(userData, buildId) {
  if (!versionName.test(buildId)) throw new Error('Invalid desktop build ID');
  const versions = join(userData, 'runtimes');
  for (const entry of await readdir(versions, { withFileTypes: true })) {
    if (!entry.isDirectory() || !versionName.test(entry.name) || entry.name === buildId) continue;
    const old = join(versions, entry.name);
    let pkg;
    try { pkg = JSON.parse(await readFile(join(old, 'package.json'), 'utf8')); }
    catch { continue; }
    if (pkg.name === '@agegr/pi-web' && existsSync(join(old, '.next'))) {
      await rm(old, { recursive: true, force: true });
    }
  }
}
