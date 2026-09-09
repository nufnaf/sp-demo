import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { prepareNativeHost } from './native-host.mjs';
const require = createRequire(import.meta.url);

test('the host Node can launch a real PTY without Electron rebuilding', { skip: process.platform === 'win32' }, async () => {
  prepareNativeHost();
  const terminal = require('node-pty').spawn('/bin/sh', ['-c', 'printf DESKTOP_PTY_OK'], { env: process.env });
  let output = '';
  terminal.onData((data) => { output += data; });
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { terminal.kill(); reject(new Error('PTY timed out')); }, 5000);
    terminal.onExit((event) => { clearTimeout(timer); resolve(event); });
  });
  assert.equal(result.exitCode, 0);
  assert.equal(output, 'DESKTOP_PTY_OK');
});
