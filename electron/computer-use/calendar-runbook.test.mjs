import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { calendarRunbook } from './calendar-runbook.mjs';

test('runbook consumers are limited to the native calendar agent and its opt-in acceptance script', async () => {
  const root = new URL('../../', import.meta.url);
  const consumers = [];
  for (const directory of ['app', 'lib', 'electron', 'scripts']) {
    for (const file of await readdir(new URL(`${directory}/`, root), { recursive: true })) {
      if (!/\.(?:mjs|[jt]sx?)$/.test(file) || /\.test\./.test(file)) continue;
      const path = `${directory}/${file}`;
      if (path === 'electron/computer-use/calendar-runbook.mjs') continue;
      const source = await readFile(new URL(path, root), 'utf8');
      // Check both imports and copied prompt text, including shared main/browser prompts.
      if (/calendarRunbook|calendar-runbook|FEISHU CALENDAR RUNBOOK|computer_edit_field/.test(source)) consumers.push(path);
    }
  }
  assert.deepEqual(consumers.sort(), ['electron/computer-use/calendar-agent.mjs', 'scripts/computer-use-draft.mjs']);
});

test('both acceptance and production require the exact calendar; only production may submit', () => {
  assert.match(calendarRunbook(), /call computer_blocked immediately/);
  assert.match(calendarRunbook({ draftOnly: true }), /computer_finish with completed:false/);
  assert.doesNotMatch(calendarRunbook({ draftOnly: true }), /Call computer_submit/);
  for (const draftOnly of [false, true]) {
    const prompt = calendarRunbook({ draftOnly });
    assert.match(prompt, /do not open (?:the picker|it again)/);
    assert.doesNotMatch(prompt, /Syntropic 演示日历|刘星|ou_[a-z0-9]+|feishu\.cn_\w+/);
  }
});

test('composed-tool guidance is opt-in and retains the independent submit boundary', () => {
  const enhanced = calendarRunbook({ enhanced: true });
  assert.match(enhanced, /computer_edit_field/);
  assert.match(enhanced, /waitForEditor:true/);
  assert.match(enhanced, /screenshot:true/);
  assert.match(enhanced, /never repeat submission after an uncertain result/);
  assert.doesNotMatch(calendarRunbook(), /computer_edit_field|waitForEditor/);
  assert.doesNotMatch(calendarRunbook({ draftOnly: true }), /computer_edit_field|waitForEditor/);
});
