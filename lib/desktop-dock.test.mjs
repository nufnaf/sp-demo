import assert from 'node:assert/strict';
import test from 'node:test';
import { dockMagnification } from './desktop-dock.ts';

test('magnification peaks under the pointer, tapers symmetrically and leaves distant icons unchanged', () => {
  assert.equal(dockMagnification(0), 1);
  assert.ok(dockMagnification(52) > dockMagnification(104));
  assert.ok(dockMagnification(104) > 0);
  assert.equal(dockMagnification(-52), dockMagnification(52));
  assert.equal(dockMagnification(120), 0);
  assert.equal(dockMagnification(400), 0);
  assert.equal(dockMagnification(NaN), 0);
});
