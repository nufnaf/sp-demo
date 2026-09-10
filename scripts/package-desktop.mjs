import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { chmod, cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pruneUnsupportedPackages } from './desktop-package-files.mjs';
import { readDemoModelConfig } from '../electron/demo-model.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new Error('此安装包构建目前仅支持 macOS Apple Silicon。');
const demoAuth = process.env.SYNTROPIC_DEMO_AUTH || 'deepseek';
if (!['deepseek', 'openrouter', 'chatgpt'].includes(demoAuth)) throw new Error('SYNTROPIC_DEMO_AUTH 必须为 deepseek、openrouter 或 chatgpt。');
const recruitingUrl = new URL(process.env.SYNTROPIC_RECRUITING_URL?.trim() || 'http://127.0.0.1:30143/');
if (!['http:', 'https:'].includes(recruitingUrl.protocol) || recruitingUrl.username || recruitingUrl.password) throw new Error('招聘网站地址必须是不含凭据的 HTTP/HTTPS 地址。');
const demoConfig = demoAuth === 'chatgpt' ? undefined
  : await readDemoModelConfig(process.env[`SYNTROPIC_${demoAuth.toUpperCase()}_CONFIG`] || join(root, `.env.${demoAuth}-demo.json`), demoAuth);
const feishuConfig = await readFile(join(root, '.env.feishu-demo.json'));
const configCheck = JSON.parse(feishuConfig.toString('utf8'));
if (!configCheck.appId || !configCheck.appSecret || !configCheck.folderToken || !configCheck.documentIds?.length || !configCheck.calendarId || configCheck.calendarId === "primary") throw new Error('请先完成 docs/feishu-demo-setup.md 中的专用飞书配置；未配置的包不能作为完整演示交付。');
const build = join(root, 'build/desktop');
const cache = join(build, 'cache');
const source = join(build, 'source');
const release = process.env.SYNTROPIC_DESKTOP_RELEASE_DIR ? resolve(process.env.SYNTROPIC_DESKTOP_RELEASE_DIR) : join(build, 'release');
const app = join(release, 'Syntropic.app');
const resources = join(app, 'Contents/Resources');
const nodeVersion = '24.20.0';
const nodeArchive = `node-v${nodeVersion}-darwin-arm64.tar.gz`;
const nodeSha256 = '40e5607e5ecb3db9192723776da2d75d966260fc74a7a9e731c1bd67dda96bc8';
const nodeHome = join(cache, `node-v${nodeVersion}-darwin-arm64`);
const node = join(nodeHome, 'bin/node');
const browserHome = join(cache, 'browsers-headless');
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
const env = { ...process.env, PATH: `${join(nodeHome, 'bin')}:${process.env.PATH}`, NEXT_TELEMETRY_DISABLED: '1', PLAYWRIGHT_BROWSERS_PATH: browserHome, SYNTROPIC_DESKTOP_BUILD: '1' };
delete env.ELECTRON_RUN_AS_NODE;
console.log('准备随包浏览器…');
await run(node, [join(root, 'node_modules/playwright-core/cli.js'), 'install', 'chromium', '--only-shell'], { env });
// Use the locked Playwright registry's platform/revision paths, not a scan of
// accumulated download caches. Ship only this build's browser and FFmpeg.
await run(node, ['--input-type=commonjs', '-e', `const {registry}=require('playwright-core/lib/coreBundle').registry;const {writeFileSync}=require('node:fs');const browser=registry.findExecutable('chromium-headless-shell');writeFileSync(${JSON.stringify(join(cache, 'browser-paths.json'))},JSON.stringify({executable:browser.executablePath(),directories:[browser.directory,registry.findExecutable('ffmpeg').directory]}))`], { env });
const browserPaths = JSON.parse(await readFile(join(cache, 'browser-paths.json'), 'utf8'));
const browserExecutable = join('browsers', relative(browserHome, browserPaths.executable));
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
await writeFile(join(resources, 'feishu-demo.json'), feishuConfig, { mode: 0o600 });
if (demoConfig) await writeFile(join(resources, `${demoAuth}-demo.json`), JSON.stringify(demoConfig), { mode: 0o600 });
await cp(join(root, 'electron'), join(resources, 'app/electron'), { recursive: true });
await writeFile(join(resources, 'app/package.json'), JSON.stringify({ name: 'syntropic-desktop', productName: 'Syntropic', version: '0.8.11', main: 'electron/main.mjs' }, null, 2));
const runtime = join(resources, 'runtime');
await cp(join(source, '.next/standalone'), runtime, { recursive: true, verbatimSymlinks: true });
for (const entry of ['public', '.next/static']) await cp(join(source, entry), join(runtime, entry), { recursive: true, verbatimSymlinks: true });
await rm(join(runtime, '.next/cache'), { recursive: true, force: true });
// Source maps and other platforms' native executables are not used by this
// macOS arm64 package. Keep runtime JS, assets, licenses and dynamic Pi loaders.
async function removeBuildMetadata(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await removeBuildMetadata(path);
    else if (entry.isFile() && (/\.(?:[cm]?js|css|ts)\.map$/.test(entry.name) || entry.name.endsWith('.nft.json'))) await rm(path);
  }
}
// .nft.json files are build-time copy manifests, not runtime configuration.
await removeBuildMetadata(runtime);
await pruneUnsupportedPackages(join(runtime, 'node_modules'), process.platform, process.arch);
for (const [directory, keep] of [
  ['node_modules/agent-browser/bin', new Set(['agent-browser-darwin-arm64', 'agent-browser.js'])],
  ['node_modules/node-pty/prebuilds', new Set(['darwin-arm64'])],
]) {
  const path = join(runtime, directory);
  for (const entry of await readdir(path)) if (!keep.has(entry)) await rm(join(path, entry), { recursive: true, force: true });
}
const recruiting = join(runtime, 'apps/recruiting');
await mkdir(recruiting, { recursive: true });
for (const entry of ['local.mjs', 'src', 'public', 'package.json']) await cp(join(root, 'apps/recruiting', entry), join(recruiting, entry), { recursive: true });
// npm/npx are used by skills/plugins; headers, manpages and Corepack are not.
for (const entry of ['bin/node', 'lib/node_modules/npm', 'LICENSE']) {
  await mkdir(dirname(join(resources, 'node', entry)), { recursive: true });
  await cp(join(nodeHome, entry), join(resources, 'node', entry), { recursive: true, verbatimSymlinks: true });
}
for (const entry of ['npm', 'npx']) await cp(join(nodeHome, 'bin', entry), join(resources, 'node/bin', entry), { verbatimSymlinks: true });
await mkdir(join(resources, 'browsers'), { recursive: true });
for (const directory of browserPaths.directories) {
  await cp(directory, join(resources, 'browsers', relative(browserHome, directory)), { recursive: true, verbatimSymlinks: true });
}
// The dependency snapshot can contain a non-executable agent-browser binary.
// Normalize and actually launch it before signing so GUI publication cannot
// ship with an EACCES failure. The app never mutates its signed bundle.
const agentBrowser = join(runtime, 'node_modules/agent-browser/bin', `agent-browser-${process.platform}-${process.arch}`);
await chmod(agentBrowser, 0o755);
await run(agentBrowser, ['--version']);
// Correct PTY executable permissions before signing.
await run(node, ['--input-type=module', '-e', `import {prepareNativeHost} from ${JSON.stringify(new URL('../electron/native-host.mjs', import.meta.url).href)}; prepareNativeHost(${JSON.stringify(runtime)})`]);
await writeFile(join(resources, 'desktop-runtime.json'), JSON.stringify({ buildId: randomUUID(), nodeVersion, browserExecutable, builtAt: new Date().toISOString(), demoAuth, demoModel: demoConfig?.modelId, recruitingUrl: recruitingUrl.href }, null, 2));
await rename(join(app, 'Contents/MacOS/Electron'), join(app, 'Contents/MacOS/Syntropic'));
await cp(join(root, 'electron/assets/Syntropic.icns'), join(resources, 'Syntropic.icns'));
const plist = join(app, 'Contents/Info.plist');
for (const [key, value] of Object.entries({ CFBundleIconFile: 'Syntropic.icns', CFBundleExecutable: 'Syntropic', CFBundleIdentifier: 'com.syntropic.desktop', CFBundleName: 'Syntropic', CFBundleDisplayName: 'Syntropic', CFBundleShortVersionString: '0.8.11' })) {
  await run('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${value}`, plist]);
}
// Preserve framework symlinks and perform the final ad-hoc signature after all copies.
await run('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', app]);
await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', app]);
// The source snapshot is disposable build input, not another installed runtime.
await rm(source, { recursive: true, force: true });
await writeFile(join(release, '使用说明.txt'), '安装前如果已经打开过 Syntropic，请先按 ⌘Q 完全退出。将 Syntropic.app 拖到「应用程序」，等待复制完成，再双击启动。只关闭窗口不等于退出；移动或替换 App 前同样需要完全退出。\n招聘网站：' + recruitingUrl.href + '\n运行代码直接引用 App 内文件，只在用户目录保存清单和缓存；新版本启动成功后自动删除旧运行目录。内置网页通过 Chromium Headless Shell 显示和操作，无需预装 Chrome。\n' + (demoAuth === 'deepseek' ? '需要联网；已预置 DeepSeek 官方 API 演示配置，无需登录或填写 Key。主 Agent、后台任务与浏览器统一使用 DeepSeek V4.1 Flash（low）。额度耗尽或授权失效时请联系提供者。\n' : demoAuth === 'openrouter' ? '需要联网；已预置 OpenRouter 演示额度，无需登录或配置 Key。主 Agent、后台任务与浏览器统一使用 GPT-5.6 Luna（low）。额度耗尽或授权失效时请联系提供者。\n' : '需要联网及 Pi 中有效的 ChatGPT 授权才能执行 Agent 任务。\n') + '桌面本轮记录保存于 App 专属运行目录；刷新保留，完全退出后下次从空记录开始。线上招聘网站的数据持续保存，不会随 App 退出而清空。飞书演示资料通过随包专用应用配置读取。\n⌘Q 退出并停止本 App 启动的服务。\n此包为本机签名的 macOS Apple Silicon 内部演示版本，未做 Apple 公证。\n');
console.log(`完成：${app}`);
