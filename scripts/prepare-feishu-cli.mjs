import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { mkdir, readFile, readdir, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cache = join(root, 'build/feishu-cli');
const source = join(root, 'tools/feishu-cli');
const run = (command, args, cwd = root) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd, stdio: 'inherit' });
  child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error('飞书连接组件构建失败')));
});
export async function prepareFeishuCli() {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new Error('此连接组件构建脚本支持 macOS Apple Silicon。');
  await mkdir(cache, { recursive: true });
  const archive = join(cache, 'go.tar.gz');
  if (!existsSync(archive)) await run('/usr/bin/curl', ['-fL', '--retry', '2', '-o', archive, 'https://go.dev/dl/go1.25.1.darwin-arm64.tar.gz']);
  if (createHash('sha256').update(await readFile(archive)).digest('hex') !== '68deebb214f39d542e518ebb0598a406ab1b5a22bba8ec9ade9f55fb4dd94a6c') throw new Error('Go 工具链下载校验失败。');
  const go = join(cache, 'go/bin/go');
  if (!existsSync(go)) await run('/usr/bin/tar', ['-xzf', archive, '-C', cache]);
  const output = join(cache, 'lark-cli');
  await run(go, ['build', '-mod=readonly', '-trimpath', '-ldflags', '-s -w -X github.com/larksuite/cli/internal/build.Version=1.0.95', '-o', output, '.'], source);
  return output;
}
export async function copyFeishuCliLicenses(destination) {
  // All dependencies are pinned by go.sum; retain their licenses in the package.
  await mkdir(destination, { recursive: true });
  await cp(join(source, 'go.mod'), join(destination, 'go.mod'));
  await cp(join(source, 'go.sum'), join(destination, 'go.sum'));
  await cp(join(source, 'LICENSE.lark-cli'), join(destination, 'LICENSE.lark-cli'));
  await cp(join(source, 'THIRD_PARTY_NOTICES.md'), join(destination, 'THIRD_PARTY_NOTICES.md'));
  await cp(join(cache, 'go/LICENSE'), join(destination, 'LICENSE.go'));
  const { stdout } = await promisify(execFile)(join(cache, 'go/bin/go'), ['list', '-m', '-f', '{{.Path}}|{{.Dir}}', 'all'], { cwd: source });
  for (const line of stdout.trim().split('\n')) {
    const [name, directory] = line.split('|');
    if (!directory || name === 'syntropic.local/feishu-cli') continue;
    const target = join(destination, 'dependencies', name.replaceAll('/', '_'));
    await mkdir(target, { recursive: true });
    for (const entry of await readdir(directory)) if (/^(license|copying|notice|copyright)/i.test(entry)) await cp(join(directory, entry), join(target, entry), { recursive: true });
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await prepareFeishuCli();
