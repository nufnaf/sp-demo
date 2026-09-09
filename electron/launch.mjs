import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { isNodeVersionSupported, getUnsupportedNodeVersionMessage } = require('../bin/node-version.js');
if (!isNodeVersionSupported(process.versions.node)) {
  console.error(getUnsupportedNodeVersionMessage(process.versions.node));
  process.exit(1);
}
if (process.platform === 'win32') {
  console.error('本阶段桌面启动器支持 macOS / Linux；Windows 请继续使用 npm run dev。');
  process.exit(1);
}
try {
  const env = { ...process.env, SYNTROPIC_NODE: process.execPath };
  delete env.ELECTRON_RUN_AS_NODE;
  const electron = spawn(require('electron'), [resolve(root, 'electron/main.mjs')], {
    cwd: root, env, stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      if (!stopping) { stopping = true; electron.kill('SIGTERM'); }
    });
  }
  electron.on('error', () => {
    console.error('Electron 无法启动。请运行 npm ci --legacy-peer-deps，并检查 Electron 安装。');
    process.exitCode = 1;
  });
  electron.on('exit', (code) => { process.exitCode = stopping ? 0 : (code ?? 1); });
} catch {
  console.error('Electron 尚未安装完整。请运行 npm ci --legacy-peer-deps；若安装脚本被禁用，再运行 node node_modules/electron/install.js。');
  process.exitCode = 1;
}
