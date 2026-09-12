import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const { POST } = await createJiti(import.meta.url, { alias: { '@': root } }).import('./route.ts');

test('reset respects request and preparation guards, clears only app-owned Feishu state even if logout fails', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'feishu-reset-'));
  const keys = ['SYNTROPIC_FEISHU_HOME', 'SYNTROPIC_FEISHU_CLI', 'SYNTROPIC_PRESENTATION_ROOT'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const home = join(dir, 'feishu'), run = join(dir, 'run'), cli = join(dir, 'cli');
  const request = origin => new Request('http://localhost/api/apps/feishu', {
    method: 'POST', headers: { host: 'localhost', origin, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'reset' }),
  });
  try {
    await mkdir(join(home, 'cli'), { recursive: true });
    await mkdir(run);
    await writeFile(join(home, 'cli/config.json'), 'private configuration');
    await writeFile(join(run, 'feishu-account.json'), JSON.stringify({ ready: true }));
    await writeFile(join(run, 'unrelated.json'), 'preserved');
    await writeFile(cli, `#!${process.execPath}\nif (JSON.stringify(process.argv.slice(2)) !== JSON.stringify(['auth','logout','--json'])) process.exit(99);\nrequire('node:fs').writeFileSync(${JSON.stringify(join(dir, 'logout-called'))}, 'yes');\nconsole.error('private upstream output'); process.exit(1);\n`, { mode: 0o700 });
    Object.assign(process.env, { SYNTROPIC_FEISHU_HOME: home, SYNTROPIC_FEISHU_CLI: cli, SYNTROPIC_PRESENTATION_ROOT: run });
    assert.equal((await POST(request('https://evil.example'))).status, 403);
    await access(home);
    globalThis.__feishuPreparation = new Promise(() => {});
    assert.equal((await POST(request('http://localhost'))).status, 409);
    globalThis.__feishuPreparation = undefined;
    await access(home);
    const response = await POST(request('http://localhost'));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { reset: true });
    assert.equal(await readFile(join(dir, 'logout-called'), 'utf8'), 'yes');
    await assert.rejects(access(home), { code: 'ENOENT' });
    await assert.rejects(access(join(run, 'feishu-account.json')), { code: 'ENOENT' });
    assert.equal(await readFile(join(run, 'unrelated.json'), 'utf8'), 'preserved');
  } finally {
    globalThis.__feishuPreparation = undefined;
    for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
    await rm(dir, { recursive: true, force: true });
  }
});
