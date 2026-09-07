import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new Error('此安装包构建目前仅支持 macOS Apple Silicon。');
const build = join(root, 'build/desktop');
const cache = join(build, 'cache');
const source = join(build, 'source');
const release = join(build, 'release');
const app = join(release, 'Syntropic.app');
const resources = join(app, 'Contents/Resources');
const nodeVersion = '24.20.0';
const nodeArchive = `node-v${nodeVersion}-darwin-arm64.tar.gz`;
const nodeSha256 = '40e5607e5ecb3db9192723776da2d75d966260fc74a7a9e731c1bd67dda96bc8';
const nodeHome = join(cache, `node-v${nodeVersion}-darwin-arm64`);
const node = join(nodeHome, 'bin/node');
const browserHome = join(cache, 'browsers');
const run = (command, args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit', ...options });
  child.once('error', reject);
  child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
});
await mkdir(cache, { recursive: true });
console.log('准备已固定版本的 Node 运行时…');
if (!existsSync(join(cache, nodeArchive))) await run('/usr/bin/curl', ['-fL', '--retry', '2', '-o', join(cache, nodeArchive), `https://nodejs.org/dist/v${nodeVersion}/${nodeArchive}`]);
if (createHash('sha256').update(await readFile(join(cache, nodeArchive))).digest('hex') !== nodeSha256) throw new Error('Node 下载校验失败，请移除缓存压缩包后重试。');
if (!existsSync(node)) await run('/usr/bin/tar', ['-xzf', join(cache, nodeArchive), '-C', cache]);
const env = { ...process.env, PATH: `${join(nodeHome, 'bin')}:${process.env.PATH}`, NEXT_TELEMETRY_DISABLED: '1', PLAYWRIGHT_BROWSERS_PATH: browserHome };
delete env.ELECTRON_RUN_AS_NODE;
console.log('准备随包浏览器…');
await run(node, [join(root, 'node_modules/playwright-core/cli.js'), 'install', 'chromium', '--no-shell'], { env });
await run(node, ['--input-type=module', '-e', `import {chromium} from 'playwright-core'; import{writeFileSync}from'node:fs';writeFileSync(${JSON.stringify(join(cache, 'browser-path.txt'))},chromium.executablePath())`], { env });
const browserExecutable = relative(cache, (await readFile(join(cache, 'browser-path.txt'), 'utf8')).trim());
console.log('在独立暂存目录构建，不修改开发目录的 .next…');
await rm(source, { recursive: true, force: true });
await mkdir(source, { recursive: true });
for (const entry of ['app', 'components', 'hooks', 'lib', 'public', 'bin', 'types', 'instrumentation.ts', 'proxy.ts', 'next.config.ts', 'tsconfig.json', 'tailwind.config.ts', 'postcss.config.mjs', 'package.json', 'package-lock.json']) {
  if (existsSync(join(root, entry))) await cp(join(root, entry), join(source, entry), { recursive: true, verbatimSymlinks: true });
}
// Clone dependency files on APFS. No symlink back into the source checkout.
await run('/bin/cp', ['-cR', join(root, 'node_modules'), join(source, 'node_modules')]);
await rm(join(source, 'node_modules/electron'), { recursive: true, force: true });
for (const name of ['electron', 'install-electron']) await rm(join(source, 'node_modules/.bin', name), { force: true });
await run(node, [join(source, 'node_modules/next/dist/bin/next'), 'build', '--webpack'], { cwd: source, env });
console.log('组装可双击运行的 App…');
await rm(app, { recursive: true, force: true });
await mkdir(release, { recursive: true });
await cp(join(root, 'node_modules/electron/dist/Electron.app'), app, { recursive: true, verbatimSymlinks: true });
await rm(join(resources, 'default_app.asar'), { force: true });
await mkdir(join(resources, 'app'), { recursive: true });
await cp(join(root, 'electron'), join(resources, 'app/electron'), { recursive: true });
await writeFile(join(resources, 'app/package.json'), JSON.stringify({ name: 'syntropic-desktop', productName: 'Syntropic', version: '0.8.11', main: 'electron/main.mjs' }, null, 2));
const runtime = join(resources, 'runtime');
await mkdir(runtime, { recursive: true });
for (const entry of ['.next', 'public', 'bin', 'next.config.ts', 'package.json']) await cp(join(source, entry), join(runtime, entry), { recursive: true, verbatimSymlinks: true });
await rm(join(runtime, '.next/cache'), { recursive: true, force: true });
await run('/bin/cp', ['-cR', join(source, 'node_modules'), join(runtime, 'node_modules')]);
const recruiting = join(runtime, 'apps/recruiting');
await mkdir(recruiting, { recursive: true });
for (const entry of ['local.mjs', 'src', 'public', 'package.json']) await cp(join(root, 'apps/recruiting', entry), join(recruiting, entry), { recursive: true });
await cp(nodeHome, join(resources, 'node'), { recursive: true, verbatimSymlinks: true });
await cp(browserHome, join(resources, 'browsers'), { recursive: true, verbatimSymlinks: true });
await rm(join(resources, 'browsers/.links'), { recursive: true, force: true });
// Correct PTY executable permissions before signing; the app never mutates its bundle.
await run(node, ['--input-type=module', '-e', `import {prepareNativeHost} from ${JSON.stringify(new URL('../electron/native-host.mjs', import.meta.url).href)}; prepareNativeHost(${JSON.stringify(runtime)})`]);
await writeFile(join(resources, 'desktop-runtime.json'), JSON.stringify({ buildId: randomUUID(), nodeVersion, browserExecutable, builtAt: new Date().toISOString() }, null, 2));
await rename(join(app, 'Contents/MacOS/Electron'), join(app, 'Contents/MacOS/Syntropic'));
const plist = join(app, 'Contents/Info.plist');
for (const [key, value] of Object.entries({ CFBundleExecutable: 'Syntropic', CFBundleIdentifier: 'com.syntropic.desktop', CFBundleName: 'Syntropic', CFBundleDisplayName: 'Syntropic', CFBundleShortVersionString: '0.8.11' })) {
  await run('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${value}`, plist]);
}
// Preserve framework symlinks and perform the final ad-hoc signature after all copies.
await run('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', app]);
await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', app]);
await writeFile(join(release, '使用说明.txt'), '双击 Syntropic.app 即可启动工作台和招聘系统。首次启动会准备本地运行文件。\n需要联网及 Pi 中有效的 ChatGPT 授权才能执行 Agent 任务。\n招聘数据保存于 ~/Library/Application Support/Syntropic/recruiting/state.json。\n⌘Q 退出并停止本 App 启动的服务。\n此包为本机签名的 macOS Apple Silicon 内部演示版本，未做 Apple 公证。\n');
console.log(`完成：${app}`);
