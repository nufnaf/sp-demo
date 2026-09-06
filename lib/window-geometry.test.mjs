import test from 'node:test';
import assert from 'node:assert/strict';
import { resizeWindow, fitWindow } from './window-geometry.ts';
const start = { x: 100, y: 80, width: 700, height: 500 };
const area = { width: 1200, height: 900 };
test('all eight handles move only their grabbed edges', () => {
  for (const edge of ['n','ne','e','se','s','sw','w','nw']) {
    const result = resizeWindow(start, edge, 30, 20, area);
    assert.equal(result.x, edge.includes('w') ? 130 : 100);
    assert.equal(result.y, edge.includes('n') ? 100 : 80);
    assert.equal(result.x + result.width, edge.includes('e') ? 830 : 800);
    assert.equal(result.y + result.height, edge.includes('s') ? 600 : 580);
  }
});
test('minimum size preserves opposite edges and reverses from the original grab', () => {
  assert.deepEqual(resizeWindow(start, 'nw', 999, 999, area), { x: 320, y: 260, width: 480, height: 320 });
  assert.deepEqual(resizeWindow(start, 'se', -999, -999, area), { x: 100, y: 80, width: 480, height: 320 });
  assert.deepEqual(resizeWindow(start, 'nw', 0, 0, area), start);
});
test('outward resizing stops inside the usable desktop', () => {
  assert.deepEqual(resizeWindow(start, 'nw', -999, -999, area), { x: 8, y: 8, width: 792, height: 572 });
  assert.deepEqual(resizeWindow(start, 'se', 999, 999, area), { x: 100, y: 80, width: 1092, height: 812 });
});
test('a smaller display fits the window even below its normal minimum', () => {
  const small = { width: 400, height: 280 };
  const fitted = { x: 8, y: 8, width: 384, height: 264 };
  assert.deepEqual(fitWindow(start, small), fitted);
  assert.deepEqual(resizeWindow(start, 'se', 999, 999, small), fitted);
});
