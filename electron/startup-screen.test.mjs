import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { registerHooks } from 'node:module';
import test from 'node:test';

// Exercise the real screen lifecycle without starting Electron or a service.
const fakeElectron = 'data:text/javascript,' + encodeURIComponent(`
  import { EventEmitter } from 'node:events';
  export const ipcMain = new EventEmitter();
  export class WebContentsView {
    constructor() {
      this.webContents = Object.assign(new EventEmitter(), {
        setWindowOpenHandler() {}, loadURL() { return Promise.resolve(); },
        isDestroyed() { return false; }, send() {}, close() {},
      });
    }
    setBackgroundColor() {}
    setBounds() {}
    setVisible(value) { this.visible = value; }
  }
`);
const screenURL = new URL('./startup-screen.mjs', import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'electron' && context.parentURL === screenURL) {
      return { url: fakeElectron, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const { StartupScreen } = await import(screenURL);
hooks.deregister();

function fixture(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let focuses = 0;
  const window = Object.assign(new EventEmitter(), {
    contentView: { addChildView() {}, removeChildView() {} },
    getContentSize: () => [1440, 960], isDestroyed: () => false,
    webContents: { focus: () => { focuses++; } },
  });
  const screen = new StartupScreen(window, {
    onTimeout: () => screen.show({ phase: 'error', reason: 'workbench-timeout', retry: true }),
  });
  t.after(() => screen.dispose());
  return { screen, focuses: () => focuses };
}

test('late usable-frame readiness dismisses a workbench timeout without reloading', t => {
  const { screen, focuses } = fixture(t);
  screen.waitForWorkbench();
  t.mock.timers.tick(45000);
  assert.equal(screen.state.phase, 'error');
  assert.equal(screen.view.visible, true);
  screen.reveal();
  assert.equal(screen.state.phase, 'revealing');
  t.mock.timers.tick(700);
  assert.equal(screen.state.phase, 'hidden');
  assert.equal(screen.view.visible, false);
  assert.equal(focuses(), 1);
});

test('late readiness cannot dismiss a service or renderer failure', t => {
  const { screen } = fixture(t);
  for (const retry of [false, true]) {
    screen.waitForWorkbench();
    t.mock.timers.tick(45000);
    screen.show({ phase: 'error', title: '服务或页面已停止', retry });
    screen.reveal();
    t.mock.timers.tick(700);
    assert.equal(screen.state.phase, 'error');
    assert.equal(screen.view.visible, true);
  }
});

test('a new failure cancels timeout recovery while a new navigation starts a fresh wait', t => {
  const { screen } = fixture(t);
  screen.waitForWorkbench();
  t.mock.timers.tick(45000);
  screen.reveal();
  screen.show({ phase: 'error', title: '服务已停止', retry: true });
  t.mock.timers.tick(700);
  assert.equal(screen.state.phase, 'error');
  screen.waitForWorkbench();
  screen.reveal();
  t.mock.timers.tick(700);
  assert.equal(screen.state.phase, 'hidden');
  t.mock.timers.tick(45000);
  assert.equal(screen.state.phase, 'hidden');
});
