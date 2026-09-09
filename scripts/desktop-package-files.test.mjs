import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, access, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pruneUnsupportedPackages } from './desktop-package-files.mjs';

test('prunes foreign native packages recursively while preserving portable packages and link targets', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'syntropic-package-prune-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const modules = join(root, 'node_modules');
  for (const [name, constraints] of Object.entries({
    portable: {}, '@native/mac': { os: ['darwin'], cpu: ['arm64'] },
    '@native/universal': { os: ['darwin'] }, 'any': { os: ['any'] },
    '@native/windows': { os: ['win32'] },
    'portable/node_modules/linux': { os: ['linux'] },
    'portable/node_modules/intel': { cpu: ['x64'] },
    'portable/node_modules/no-mac': { os: ['!darwin'] },
  })) {
    const path = join(modules, name);
    await mkdir(path, { recursive: true });
    await writeFile(join(path, 'package.json'), JSON.stringify({ name, ...constraints }));
  }
  const outside = join(root, 'external');
  await mkdir(outside);
  await writeFile(join(outside, 'package.json'), '{"os":["win32"]}');
  await symlink(outside, join(modules, 'linked'), 'dir');
  await pruneUnsupportedPackages(modules, 'darwin', 'arm64');
  for (const name of ['@native/windows', 'portable/node_modules/linux', 'portable/node_modules/intel', 'portable/node_modules/no-mac']) {
    await assert.rejects(access(join(modules, name)), { code: 'ENOENT' });
  }
  for (const name of ['portable', '@native/mac', '@native/universal', 'any', 'linked']) await access(join(modules, name));
  await access(outside);
});
