import test from 'node:test';
import assert from 'node:assert/strict';
import { selectFeishuMainWindow } from './permission-probe.mjs';

test('screen permission probe accepts localized or account-specific Feishu window titles', () => {
  const main = { title: 'Lark', windowId: 'main', bounds: { width: 1200, height: 800 } };
  assert.equal(selectFeishuMainWindow([
    { title: '创建日程', windowId: 'editor', bounds: { width: 1400, height: 900 } },
    main,
  ]), main);
});

test('screen permission probe ignores small utility windows and editors', () => {
  assert.equal(selectFeishuMainWindow([
    { title: '飞书', windowId: 'tiny', bounds: { width: 300, height: 200 } },
    { title: '新建日程', windowId: 'editor', bounds: { width: 900, height: 700 } },
  ]), undefined);
});
