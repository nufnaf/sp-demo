import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const env = { ...process.env };
env.SYNTROPIC_CUA_PREVIEW_EDITOR = process.argv.includes('--calendar-editor') ? '1' : '0';
env.SYNTROPIC_CUA_OCCLUSION_TEST = process.argv.includes('--occlusion-test') ? '1' : '0';
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(require('electron'), [fileURLToPath(new URL('../electron/computer-use/preview.mjs', import.meta.url))], {
  env, stdio: 'inherit',
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', () => { console.error('预览应用未能启动，请检查 Electron 安装。'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 0; });
