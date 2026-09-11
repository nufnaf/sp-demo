import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJiti } from 'jiti';

const { userCommand, FeishuUserError } = await createJiti(import.meta.url).import('./feishu-user-api.ts');
test('only token and scope failures request reauthorization; resource and input failures do not', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'feishu-user-errors-'));
  const command = join(dir, 'cli'), control = join(dir, 'failure');
  const previous = process.env.SYNTROPIC_FEISHU_CLI;
  await writeFile(command, `#!${process.execPath}
const fs = require('node:fs');
if (process.argv.includes('--version')) { console.log('lark-cli 1.0.95'); process.exit(0); }
if (process.argv.includes('status')) {
  console.log(JSON.stringify({appId:'app',identities:{user:{available:true,tokenStatus:'valid',openId:'user'}}}));
  process.exit(0);
}
console.error(JSON.stringify({error:{subtype:fs.readFileSync(${JSON.stringify(control)},'utf8'),message:'private upstream detail'}}));
process.exit(3);
`, { mode: 0o700 });
  process.env.SYNTROPIC_FEISHU_CLI = command;
  const identity = createHash('sha256').update('app:user').digest('hex');
  try {
    for (const [subtype, requiresAuthorization, uncertain] of [
      ['missing_scope', true, false], ['token_expired', true, false],
      ['permission_denied', false, false], ['invalid_argument', false, false],
      ['unknown', false, true],
    ]) {
      await writeFile(control, subtype);
      await assert.rejects(userCommand(identity, ['fixture']), error => {
        assert(error instanceof FeishuUserError);
        assert.equal(error.requiresAuthorization, requiresAuthorization);
        assert.equal(error.uncertain, uncertain);
        assert(!error.message.includes('private upstream detail'));
        return true;
      });
    }
  } finally {
    if (previous === undefined) delete process.env.SYNTROPIC_FEISHU_CLI;
    else process.env.SYNTROPIC_FEISHU_CLI = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
