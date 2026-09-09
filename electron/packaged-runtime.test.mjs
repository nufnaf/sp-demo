import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, lstat, realpath, symlink, access, rm, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { preparePackagedRuntime, removeOldPackagedRuntimes } from './packaged-runtime.mjs';

const current = '11111111-1111-4111-8111-111111111111';
const previous = '22222222-2222-4222-8222-222222222222';
const linked = '33333333-3333-4333-8333-333333333333';
const unrelated = '44444444-4444-4444-8444-444444444444';

test('Node uses linked code with a separate writable cache; upgrades preserve data and immutable resources', async (t) => {
  const base = await mkdtemp(join(tmpdir(), 'syntropic-runtime-test-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const resources = join(base, 'Resources');
  const user = join(base, 'user');
  const bundled = join(resources, 'runtime');
  for (const name of ['.next/server', '.next/static', 'node_modules', 'public', 'apps']) await mkdir(join(bundled, name), { recursive: true });
  await writeFile(join(bundled, 'package.json'), JSON.stringify({ name: '@agegr/pi-web' }));
  await writeFile(join(bundled, 'server.js'), `const fs = require('node:fs'); const path = require('node:path'); process.chdir(__dirname); fs.writeFileSync(path.join(__dirname, '.next/cache/probe'), 'cached'); console.log(JSON.stringify({ cwd: process.cwd(), dir: __dirname }));`);
  await writeFile(join(bundled, '.next/BUILD_ID'), 'build');
  const root = await preparePackagedRuntime(resources, user, current);
  for (const name of ['server.js', 'node_modules', 'public', 'apps', '.next/server', '.next/static', '.next/BUILD_ID']) {
    assert.ok((await lstat(join(root, name))).isSymbolicLink());
    assert.equal(await realpath(join(root, name)), await realpath(join(bundled, name)));
  }
  const launched = JSON.parse(execFileSync(process.execPath, ['--preserve-symlinks-main', join(root, 'server.js')], { encoding: 'utf8' }));
  assert.equal(await realpath(launched.cwd), await realpath(root));
  assert.equal(launched.dir, root);
  assert.equal(await readFile(join(root, '.next/cache/probe'), 'utf8'), 'cached');
  await assert.rejects(access(join(bundled, '.next/cache')), { code: 'ENOENT' });
  assert.equal(await preparePackagedRuntime(resources, user, current), root);
  assert.equal(await readFile(join(root, '.next/cache/probe'), 'utf8'), 'cached');
  const old = await preparePackagedRuntime(resources, user, previous);
  await symlink(bundled, join(user, 'runtimes', linked), 'dir');
  const other = join(user, 'runtimes', unrelated);
  await mkdir(join(other, '.next'), { recursive: true });
  await writeFile(join(other, 'package.json'), '{"name":"personal-project"}');
  await mkdir(join(user, 'recruiting'));
  await writeFile(join(user, 'recruiting/state.json'), 'keep');
  await removeOldPackagedRuntimes(user, current);
  await assert.rejects(access(old), { code: 'ENOENT' });
  for (const path of [root, other, bundled, join(user, 'runtimes', linked), join(user, 'recruiting/state.json')]) await access(path);
  const relocated = join(base, 'Moved App', 'Resources');
  await mkdir(join(base, 'Moved App'));
  await rename(resources, relocated);
  assert.equal(await preparePackagedRuntime(relocated, user, current), root);
  for (const name of ['server.js', 'node_modules', 'public', 'apps', '.next/server', '.next/static', '.next/BUILD_ID']) {
    assert.equal(await realpath(join(root, name)), await realpath(join(relocated, 'runtime', name)));
  }
  assert.equal(await readFile(join(root, '.next/cache/probe'), 'utf8'), 'cached');
  execFileSync(process.execPath, ['--preserve-symlinks-main', join(root, 'server.js')]);
  await assert.rejects(preparePackagedRuntime(relocated, user, '../outside'), /Invalid/);
});
