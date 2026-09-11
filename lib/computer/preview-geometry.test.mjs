import assert from 'node:assert/strict';
import test from 'node:test';
import { previewFrame } from './preview-geometry.ts';

test('compact and enlarged recordings retain their full aspect ratio within the desktop', () => {
  for (const area of [{ width: 1440, height: 744 }, { width: 320, height: 450 }]) {
    for (const ratio of [16 / 9, 1, 2 / 3]) for (const expanded of [true, false]) {
      const frame = previewFrame(area, ratio, expanded, { x: 10000, y: -900 });
      assert.ok(Math.abs(frame.width / frame.height - ratio) < .00001);
      assert.ok(frame.x >= 16 && frame.y >= 16);
      assert.ok(frame.x + frame.width <= area.width - 16 + .001);
      assert.ok(frame.y + frame.height <= area.height - 16 + .001);
      if (expanded) assert.ok(frame.y + frame.height <= area.height - 72 + .001);
      if (!expanded) assert.ok(frame.width <= 350);
    }
  }
});
test('expansion does not consume the compact placement and resize clamps it back on screen', () => {
  const area = { width: 1440, height: 744 }, position = { x: 90, y: 230 };
  const compact = previewFrame(area, 16 / 9, false, position);
  assert.equal(compact.width, 350);
  assert.ok(previewFrame(area, 16 / 9, true, position).width > 1000);
  assert.deepEqual(previewFrame(area, 16 / 9, false, position), compact);
  assert.deepEqual(previewFrame(area, NaN, false, null), previewFrame(area, 16 / 9, false, null));
});
