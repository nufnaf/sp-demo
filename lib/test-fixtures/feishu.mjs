import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
export async function connectFixture(root, config) {
  const keys = ['SYNTROPIC_FEISHU_HOME', 'SYNTROPIC_FEISHU_CLI', 'FEISHU_FIXTURE_APP', 'FEISHU_FIXTURE_ORIGIN'];
  const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  const home = join(root, 'personal-feishu'); await mkdir(home, { recursive: true });
  const identity = createHash('sha256').update(`${config.appId}:test-user`).digest('hex');
  const state = { version: 1, identity, account: '测试用户', nonce: '9a97f0e2-bf48-47de-8844-aecb94729638', ready: true, consent: true, resources: { folder: config.folderToken, business: config.documentIds[0], weekly: 'weekly', sheet: 'sheet', base: 'base', wiki: 'wiki', wikiSpace: 'space', calendar: config.calendarId, calendarName: '招聘日程' } };
  await writeFile(join(home, `${identity}.json`), JSON.stringify(state));
  await writeFile(join(root, 'feishu-account.json'), JSON.stringify({ identity, ready: true }));
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const input = JSON.parse(Buffer.concat(chunks));
    try {
      const response = await globalThis.fetch(`https://open.feishu.cn/open-apis${input.path}`, { method: input.method, body: input.body });
      const body = await response.json();
      res.end(JSON.stringify(body.code && body.code !== 0 ? { ok: false, error: { subtype: 'fixture_error' } } : { ok: true, data: body.data ?? {} }));
    } catch { res.end(JSON.stringify({ ok: false, error: { subtype: 'network' } })); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  Object.assign(process.env, { SYNTROPIC_FEISHU_HOME: home, SYNTROPIC_FEISHU_CLI: fileURLToPath(new URL('./feishu-cli.mjs', import.meta.url)), FEISHU_FIXTURE_APP: config.appId, FEISHU_FIXTURE_ORIGIN: `http://127.0.0.1:${server.address().port}` });
  return async () => { await new Promise(resolve => server.close(resolve)); for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } };
}
