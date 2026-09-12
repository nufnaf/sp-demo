import test from 'node:test';
import assert from 'node:assert/strict';
import { createComputerPermissions, registerComputerPermissions } from './computer-permissions.mjs';

function fixture() {
  const state = { accessibility: false, screenRecording: false };
  const calls = [];
  const adapters = {
    platform: 'darwin',
    verifyCapture: async () => { calls.push('capture'); },
    systemPreferences: {
      isTrustedAccessibilityClient: prompt => { if (prompt) calls.push('accessibility'); return state.accessibility; },
      getMediaAccessStatus: kind => { assert.equal(kind, 'screen'); return state.screenRecording ? 'granted' : 'denied'; },
    },
    desktopCapturer: { getSources: async options => { calls.push(options); throw new Error('denied'); } },
    shell: { openExternal: async url => { calls.push(url); } },
  };
  return { state, calls, adapters, permissions: createComputerPermissions(adapters) };
}
test('checks do not request permissions; revoked grants are read afresh', async () => {
  const { permissions, state, calls } = fixture();
  assert.deepEqual(permissions.read(), { supported: true, accessibility: false, screenRecording: false, captureVerified: false, initializationComplete: false });
  state.accessibility = true; state.screenRecording = true;
  assert.deepEqual(permissions.read(), { supported: true, accessibility: true, screenRecording: true, captureVerified: false, initializationComplete: false });
  await permissions.request('screenRecording');
  state.screenRecording = false;
  assert.equal(permissions.read().screenRecording, false);
  assert.deepEqual(calls, []);
});
test('each explicit action requests only its permission and denied requests open the matching settings', async () => {
  const { permissions, calls } = fixture();
  assert.equal((await permissions.request('accessibility')).accessibility, false);
  assert.deepEqual(calls, ['accessibility', 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility']);
  calls.length = 0;
  assert.equal((await permissions.request('screenRecording')).screenRecording, false);
  assert.deepEqual(calls, [{ types: ['screen'], thumbnailSize: { width: 0, height: 0 }, fetchWindowIcons: false }, 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture']);
  await assert.rejects(permissions.request('https://untrusted.invalid'), /未知/);
  await assert.rejects(permissions.request('__proto__'), /未知/);
  assert.equal(calls.length, 2);
});
test('unsupported platforms do not call native APIs or claim granted', async () => {
  const { adapters, calls } = fixture();
  const permissions = createComputerPermissions({ ...adapters, platform: 'linux' });
  assert.deepEqual(permissions.read(), { supported: false, accessibility: false, screenRecording: false, captureVerified: false, initializationComplete: false });
  await assert.rejects(permissions.request('accessibility'), /macOS/);
  assert.deepEqual(calls, []);
});
test('only the workbench main frame can check or request permissions', async () => {
  const handlers = new Map();
  const { permissions, calls } = fixture();
  const contents = { mainFrame: { url: 'http://127.0.0.1:30141/' } };
  registerComputerPermissions({ handle: (name, handler) => handlers.set(name, handler) }, permissions,
    () => ({ webContents: contents }), url => new URL(url).origin === 'http://127.0.0.1:30141');
  const event = { sender: contents, senderFrame: contents.mainFrame };
  for (const handler of handlers.values()) {
    assert.throws(() => handler({ ...event, sender: {} }, 'accessibility'), /Untrusted/);
    assert.throws(() => handler({ ...event, senderFrame: { url: contents.mainFrame.url } }, 'accessibility'), /Untrusted/);
    contents.mainFrame.url = 'https://untrusted.invalid/';
    assert.throws(() => handler(event, 'accessibility'), /Untrusted/);
    contents.mainFrame.url = 'http://127.0.0.1:30141/apps';
    assert.throws(() => handler(event, 'accessibility'), /Untrusted/);
    contents.mainFrame.url = 'http://127.0.0.1:30141/';
  }
  assert.deepEqual(calls, []);
  assert.equal(handlers.get('desktop:computer-permissions:get')(event).supported, true);
  await handlers.get('desktop:computer-permissions:request')(event, 'accessibility');
  assert.equal(calls[0], 'accessibility');
});

test('real Electron preload reads macOS status without requesting or altering permissions', { timeout: 30000 }, async () => {
  const [{ mkdtemp, rm }, { tmpdir }, { join }, { execFile }, { promisify }, { default: electron }] = await Promise.all([
    import('node:fs/promises'), import('node:os'), import('node:path'), import('node:child_process'), import('node:util'), import('electron'),
  ]);
  const directory = await mkdtemp(join(tmpdir(), 'syntropic-permissions-electron-'));
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  try {
    const { stdout } = await promisify(execFile)(electron, ['scripts/fixtures/computer-permissions-harness.mjs', directory], { env, timeout: 25000 });
    assert.match(stdout, /PERMISSIONS_BRIDGE_OK/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('system grants control completion and revoked grants invalidate it',async()=>{
 const { adapters, state, calls }=fixture();
 let saved={},fail=true;
 const startupState={read:()=>({...saved}),write:value=>{saved=value;}};
 const build=()=>createComputerPermissions({...adapters,startupState,verifyCapture:async()=>{calls.push('capture');if(fail)throw Error('capture denied');}});
 const permissions=build();state.accessibility=true;state.screenRecording=true;
 permissions.complete(true);
 await permissions.request('screenRecording');
 const restored=build();assert.equal(restored.read().initializationComplete,true);
 assert.equal(restored.read().captureVerified,false);
 assert.deepEqual(calls,[],'status and restart never perform an active capture probe');
 state.screenRecording=false;
 assert.equal(restored.read().initializationComplete,false);
 state.screenRecording=true;
 assert.equal(restored.read().captureVerified,false);
});
