import { createRequire } from 'node:module';
import { chmodSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const require = createRequire(import.meta.url);

export function prepareNativeHost(root) {
  if (process.platform !== 'darwin') return;
  // node-pty 1.1.0's npm tarball ships the macOS prebuilt spawn-helper as 0644.
  // Resolve the SAME native module directory used by node-pty and repair only
  // this installed helper's owner-executable bit. Never rebuild for Electron.
  const hostRequire = root ? createRequire(resolve(root, 'package.json')) : require;
  const utils = hostRequire.resolve('node-pty/lib/utils.js');
  const { dir } = hostRequire(utils).loadNativeModule('pty');
  const helper = resolve(dirname(utils), dir, 'spawn-helper');
  const mode = statSync(helper).mode;
  if (!(mode & 0o100)) chmodSync(helper, mode | 0o100);
}
