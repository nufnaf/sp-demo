import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ComputerUseDriver } from './driver.mjs';

test('coordinate input releases native focus before observing, even on failure or cancellation', async () => {
  for (const mode of ['success', 'failure', 'cancel']) {
    const { sdk, native } = fixture();
    const order = [];
    const controller = new AbortController();
    const read = native.getWindowState;
    native.getWindowState = async () => { order.push('observe'); return read(); };
    native.click = async () => { order.push('click'); if (mode === 'failure') throw new Error('native failed'); return { effect: 2 }; };
    const driver = new ComputerUseDriver(sdk, native, { inputFocusFactory: async () => {
      order.push('borrow'); if (mode === 'cancel') controller.abort();
      return { release: async () => { order.push('release'); } };
    } });
    await driver.bind('9007199254740993'); const state = await driver.observe(); order.length = 0;
    const result = driver.act({ kind: 'click', count: 2, x: 12, y: 12, snapshotId: state.snapshotId }, controller.signal);
    if (mode === 'success') { await result; assert.deepEqual(order, ['borrow', 'click', 'release', 'observe']); }
    else { await assert.rejects(result); assert.deepEqual(order, mode === 'cancel' ? ['borrow', 'release'] : ['borrow', 'click', 'release']); }
    await driver.close();
  }
});

test('focus protection does not intercept AX input and refuses coordinates when protection fails', async () => {
  const { sdk, native, calls } = fixture(); let borrows = 0;
  const driver = new ComputerUseDriver(sdk, native, { inputFocusFactory: async () => { borrows++; throw new Error('focus unavailable'); } });
  await driver.bind('9007199254740993'); let state = await driver.observe();
  await driver.act({ kind: 'click', elementToken: state.elements[0].elementToken, snapshotId: state.snapshotId });
  assert.equal(borrows, 0); assert.equal(calls.length, 1);
  state = await driver.observe();
  await assert.rejects(driver.act({ kind: 'click', count: 2, x: 12, y: 12, snapshotId: state.snapshotId }), /focus unavailable/);
  assert.equal(calls.length, 1); assert.equal(borrows, 1);
  await driver.close();
});

test('focus release failure stops the action without observing or replaying input', async () => {
  const { sdk, native, calls } = fixture();
  const driver = new ComputerUseDriver(sdk, native, { inputFocusFactory: async () => ({ release: async () => { throw new Error('focus not restored'); } }) });
  await driver.bind('9007199254740993'); const state = await driver.observe();
  await assert.rejects(driver.act({ kind: 'click', x: 12, y: 12, snapshotId: state.snapshotId }), /focus not restored/);
  assert.equal(calls.length, 1); assert.equal(driver.snapshot, null);
  await assert.rejects(driver.act({ kind: 'click', x: 12, y: 12, snapshotId: state.snapshotId }), /画面已更新/);
  assert.equal(calls.length, 1); await driver.close();
});

test('stop during native coordinates waits for dispatch completion before returning focus', async () => {
  const { sdk, native } = fixture(); const order = [];
  const controller = new AbortController(); let finishClick, dispatchStarted;
  const started = new Promise(resolve => { dispatchStarted = resolve; });
  native.click = async (_input, options) => {
    assert.equal(options, undefined); order.push('dispatch'); dispatchStarted();
    await new Promise(resolve => { finishClick = resolve; });
    order.push('dispatched'); return { effect: 2 };
  };
  const driver = new ComputerUseDriver(sdk, native, { inputFocusFactory: async () => ({ release: async () => { order.push('release'); } }) });
  await driver.bind('9007199254740993'); const state = await driver.observe();
  const pending = driver.act({ kind: 'click', count: 2, x: 12, y: 12, snapshotId: state.snapshotId }, controller.signal);
  const stopped = assert.rejects(pending, { name: 'AbortError' });
  await started; controller.abort(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(order, ['dispatch']); finishClick(); await stopped;
  assert.deepEqual(order, ['dispatch', 'dispatched', 'release']); assert.equal(driver.snapshot, null);
  await driver.close();
});

test('an element double-click cannot silently become AXPress', async () => {
  const { driver, calls } = fixture();
  await driver.bind('9007199254740993');
  const state = await driver.observe();
  await assert.rejects(driver.act({ kind: 'click', count: 2, elementToken: state.elements[0].elementToken, snapshotId: state.snapshotId }), /截图坐标/);
  assert.equal(calls.length, 0);
  await driver.close();
});

test('native runtime shuts down even if capture release fails', async () => {
  const { sdk, native, calls } = fixture();
  const driver = new ComputerUseDriver(sdk, native, { captureFactory: async () => ({
    frame: async () => ({}), close: async () => { throw new Error('release timeout'); },
  }) });
  await driver.bind('9007199254740993');
  await assert.rejects(driver.close(), /release timeout/);
  assert.deepEqual(calls, ['shutdown', 'destroy']);
});

test('a disconnected live capture blocks input and releases its lease on unbind', async () => {
  const { sdk, native, calls } = fixture();
  let failure;
  let closed = 0;
  const driver = new ComputerUseDriver(sdk, native, { captureFactory: async () => ({
    frame: async () => { if (failure) throw failure; return { image: {}, width: 1000, height: 600 }; },
    close: async () => { closed++; },
  }) });
  await driver.bind('9007199254740993');
  const state = await driver.observe();
  failure = new Error('capture stopped');
  await assert.rejects(driver.act({ kind: 'click', elementToken: state.elements[0].elementToken, snapshotId: state.snapshotId }), /capture stopped/);
  assert.equal(calls.length, 0);
  await driver.unbind();
  assert.equal(closed, 1);
  await driver.close();
  assert.equal(closed, 1);
});

test('rebinding the same live target preserves capture; changing targets releases it', async () => {
  const { sdk, native } = fixture();
  let opened = 0;
  let closed = 0;
  const driver = new ComputerUseDriver(sdk, native, { captureFactory: async () => {
    opened++;
    return { frame: async () => ({}), close: async () => { closed++; } };
  } });
  await driver.bind('9007199254740993');
  await driver.bind('9007199254740993');
  assert.equal(opened, 1);
  native.windows.push({ ...native.windows[0], windowId: 2n });
  await driver.bind('2');
  assert.equal(opened, 2);
  assert.equal(closed, 1);
  await driver.close();
  assert.equal(closed, 2);
});

test('addressed text insertion stays on the exact snapshot element without a keyboard retry', async () => {
  const { driver, native, calls } = fixture();
  native.callTool = async (tool, payload) => {
    calls.push({ tool, payload: JSON.parse(payload) });
    return { isError: true, errorCode: 'same_pid_keyboard_ambiguity' };
  };
  await driver.bind('9007199254740993');
  const state = await driver.observe();
  await assert.rejects(driver.act({ kind: 'type', snapshotId: state.snapshotId, elementToken: state.elements[0].elementToken, text: '14:00' }), /未确认/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].tool, 'type_text');
  assert.equal(calls[0].payload.element_token, state.elements[0].elementToken);
  assert.equal(calls[0].payload.snapshot_id, state.snapshotId);
  await driver.close();
});

test('only native Feishu web text areas encode multiline input as Unicode line separators in one AX write', async () => {
  for (const [role, inWebContent, bundleId, encoded] of [
    ['AXTextArea', true, 'com.electron.lark', true],
    ['AXTextField', true, 'com.electron.lark', false],
    ['AXTextArea', false, 'com.electron.lark', false],
    ['AXTextArea', true, 'another.app', false],
  ]) {
    const {sdk,native,calls}=fixture();
    native.listApps=async()=>({apps:[{pid:20,bundleId,running:true}]});
    const read=native.getWindowState;
    native.getWindowState=async()=>{const state=await read();Object.assign(state.elements[0],{role,inWebContent});return state;};
    native.callTool=async(name,payload)=>{calls.push({name,...JSON.parse(payload)});return {isError:false,action:{effect:2}};};
    const driver=new ComputerUseDriver(sdk,native,{bundleId});
    await driver.bind('9007199254740993');const state=await driver.observe();
    const text='第一段\r\n\r\n第二段\n由 Syntropic 安排';
    await driver.act({kind:'setValue',snapshotId:state.snapshotId,elementToken:state.elements[0].elementToken,text});
    assert.equal(calls.length,1);assert.equal(calls[0].name,'set_value');
    assert.equal(calls[0].value,encoded?'第一段\u2028\u2028第二段\u2028由 Syntropic 安排':text);
    await driver.close();
  }
});

function fixture() {
  const factory = { new: value => value };
  const sdk = Object.fromEntries(['ListAppsInput', 'ListWindowsInput', 'GetWindowStateInput', 'ClickInput', 'TypeTextInput', 'PressKeyInput', 'ScrollInput'].map(name => [name, factory]));
  Object.assign(sdk, {
    currentMacOsPermissionStatus: () => ({ accessibility: true, screenRecording: true }),
    ActionTarget: { Window: factory }, ClickPosition: { Element: factory, Coordinates: factory },
    InputDeliveryMode: { Background: 0 }, ActionEffect: { Refused: 4, SuspectedNoop: 3 },
    ScrollDirection: { Up: 0, Down: 1 }, ScrollBy: { Line: 0 },
  });
  const calls = [];
  let version = 0;
  const native = {
    windows: [{ pid: 20, windowId: 9007199254740993n, title: '飞书', bounds: { width: 1000, height: 600 } }],
    listApps: async () => ({ apps: [{ pid: 20, bundleId: 'com.electron.lark', running: true }] }),
    listWindows: async () => ({ windows: native.windows }),
    getWindowState: async () => ({ snapshotId: `frame-${++version}`, pid: 20, windowId: 9007199254740993n,
      images: [], screenshotFrameValid: true, screenshotWidth: 1000, screenshotHeight: 600,
      elements: [{ elementToken: `token-${version}`, enabled: true }] }),
    click: async input => { calls.push(input); return { effect: 2, delivery: { mode: 0 } }; },
    typeText: async input => { calls.push(input); return { isError: false, action: { effect: 2 } }; },
    pressKey: async input => { calls.push(input); return { isError: false, action: { effect: 2 } }; },
    scroll: async input => { calls.push(input); return { isError: false, action: { effect: 2 } }; },
    shutdown: async () => { calls.push('shutdown'); }, uniffiDestroy: () => { calls.push('destroy'); },
  };
  return { sdk, native, calls, driver: new ComputerUseDriver(sdk, native) };
}

test('keeps native window IDs exact and rejects a window from another application', async () => {
  const { driver, native } = fixture();
  native.windows.push({ pid: 30, windowId: 2n, bounds: { width: 500, height: 500 } });
  assert.deepEqual((await driver.listWindows()).map(window => window.windowId), ['9007199254740993']);
  await assert.rejects(driver.bind('2'), /不存在/);
  assert.equal((await driver.bind('9007199254740993')).windowId, '9007199254740993');
  await driver.close();
});

test('a vanished target does not bind silently to a replacement Feishu window', async () => {
  const { driver, native, calls } = fixture();
  await driver.bind('9007199254740993');
  const state = await driver.observe();
  native.windows[0] = { ...native.windows[0], windowId: 10n };
  await assert.rejects(driver.act({ kind: 'type', text: '会议', snapshotId: state.snapshotId }), /已关闭/);
  assert.equal(calls.length, 0);
  await driver.close();
});

test('a dismissed editor with a retained native ID cannot be captured or edited', async () => {
  const { driver, native, calls } = fixture();
  await driver.bind('9007199254740993');
  const state = await driver.observe();
  native.windows[0].isOnScreen = false;
  await assert.rejects(driver.capture(), /隐藏或关闭/);
  await assert.rejects(driver.act({ kind: 'setValue', text: 'meeting',
    elementToken: state.elements[0].elementToken, snapshotId: state.snapshotId }), /隐藏或关闭/);
  assert.equal(calls.length, 0);
  await driver.close();
});

test('a newer observation invalidates old actions before native dispatch', async () => {
  const { driver, calls } = fixture();
  await driver.bind('9007199254740993');
  const first = await driver.observe();
  await driver.observe();
  await assert.rejects(driver.act({ kind: 'click', elementToken: first.elements[0].elementToken, snapshotId: first.snapshotId }), /画面已更新/);
  assert.equal(calls.length, 0);
  await driver.close();
});

test('background input is bound to the exact window and returns a fresh observation', async () => {
  const { driver, calls } = fixture();
  await driver.bind('9007199254740993');
  const first = await driver.observe();
  const result = await driver.act({ kind: 'click', x: 230, y: 100, snapshotId: first.snapshotId });
  assert.deepEqual(calls[0].target, { pid: 20, windowId: 9007199254740993n });
  assert.equal(calls[0].deliveryMode, 0);
  assert.notEqual(result.observation.snapshotId, first.snapshotId);
  // Delivery is not presented as proof that a calendar was saved.
  assert.equal(result.outcome.effect, 2);
  await driver.close();
});

test('out-of-image coordinates and invalid tokens cannot dispatch', async () => {
  const { driver, calls } = fixture();
  await driver.bind('9007199254740993');
  const state = await driver.observe();
  for (const patch of [{ x: -1, y: 1 }, { x: 1000, y: 1 }, { x: 1, y: NaN }, { elementToken: 'stale' }]) {
    await assert.rejects(driver.act({ kind: 'click', snapshotId: state.snapshotId, ...patch }));
  }
  assert.equal(calls.length, 0);
  await driver.close();
});

test('refused background input never retries in foreground or reuses its observation', async () => {
  const { driver, native, calls } = fixture();
  native.click = async input => { calls.push(input); return { effect: 4 }; };
  await driver.bind('9007199254740993');
  const state = await driver.observe();
  const action = { kind: 'click', x: 2, y: 2, snapshotId: state.snapshotId };
  await assert.rejects(driver.act(action), /未确认/);
  await assert.rejects(driver.act(action), /画面已更新/);
  assert.equal(calls.length, 1);
  await driver.close();
});

test('shutdown waits for admitted work, rejects queued actions, and frees native state once', async () => {
  const { driver, native, calls } = fixture();
  await driver.bind('9007199254740993');
  const state = await driver.observe();
  let finish;
  native.click = async input => { calls.push(input); await new Promise(resolve => { finish = resolve; }); return { effect: 2 }; };
  const action = driver.act({ kind: 'click', x: 1, y: 1, snapshotId: state.snapshotId });
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  const queued = driver.observe();
  const refused = assert.rejects(queued, /已停止/);
  const closing = driver.close();
  assert.equal(driver.close(), closing);
  finish();
  await action;
  await refused;
  await closing;
  assert.deepEqual(calls.slice(-2), ['shutdown', 'destroy']);
  await assert.rejects(driver.observe(), /已停止/);
});

test('preview captures avoid app-wide discovery and invalidate input observations', async () => {
  const { driver, native } = fixture();
  await driver.bind('9007199254740993');
  const previous = await driver.observe();
  native.listApps = async () => { throw new Error('Do not enumerate apps per frame'); };
  native.getWindowState = async input => {
    assert.equal(input.includeAccessibilityTree, false);
    return { images: [{ mimeType: 'image/png', dataBase64: 'frame' }], screenshotFrameValid: true,
      screenshotWidth: 1000, screenshotHeight: 600 };
  };
  assert.equal((await driver.capture()).image.dataBase64, 'frame');
  await assert.rejects(driver.act({ kind: 'type', text: '会议', snapshotId: previous.snapshotId }), /画面已更新/);
  native.windows[0].minimized = true;
  await assert.rejects(driver.capture(), /最小化/);
  await driver.close();
});

test('semantic writes use only the registered tool and current exact element', async () => {
  const { driver, native, calls } = fixture();
  native.callTool = async (name, payload) => {
    calls.push({ name, ...JSON.parse(payload) });
    return { isError: false, action: { effect: 2 } };
  };
  await driver.bind('9007199254740993');
  const state = await driver.observe();
  await assert.rejects(driver.act({ kind: 'setValue', elementToken: 'stale', text: '会议', snapshotId: state.snapshotId }), /无效/);
  await driver.act({ kind: 'setValue', elementToken: state.elements[0].elementToken, text: '会议', snapshotId: state.snapshotId });
  assert.deepEqual(calls[0], { name: 'set_value', pid: 20, element_token: state.elements[0].elementToken,
    snapshot_id: state.snapshotId, value: '会议', session: driver.session });
  await driver.close();
});

test('AX-only observations work without screen recording and do not request images', async () => {
  const { driver, native, sdk } = fixture();
  sdk.currentMacOsPermissionStatus = () => ({ accessibility: true, screenRecording: false });
  await driver.bind('9007199254740993');
  let reads = 0;
  native.getWindowState = async input => {
    reads++;
    assert.equal(input.includeAccessibilityTree, true);
    assert.equal(input.includeScreenshot, false);
    return { snapshotId: 'ax-only', elements: [], images: [] };
  };
  assert.equal((await driver.observe()).snapshotId, 'ax-only');
  driver.includeScreenshots = true;
  await assert.rejects(driver.observe(), /权限/);
  assert.equal(reads, 1);
  await driver.close();
});

test('invalid click counts are rejected without dispatch', async () => {
  const { driver, calls } = fixture();
  await driver.bind('9007199254740993');
  const state = await driver.observe();
  for (const count of [0, 3, '2']) {
    await assert.rejects(driver.act({ kind: 'click', elementToken: state.elements[0].elementToken,
      count, snapshotId: state.snapshotId }), /点击次数/);
  }
  assert.equal(calls.length, 0);
  await driver.close();
});

test('scroll rejects ungrounded coordinates and binds bounded wheel input to the window', async () => {
  const { driver, calls } = fixture();
  await driver.bind('9007199254740993');
  const state = await driver.observe();
  const action = { kind: 'scroll', x: 500, y: 400, direction: 'down', amount: 8, snapshotId: state.snapshotId };
  for (const patch of [{ x: -1 }, { y: 600 }, { direction: 'sideways' }, { amount: 0 }, { amount: 11 }, { amount: 1.5 }]) {
    await assert.rejects(driver.act({ ...action, ...patch }), /滚动/);
  }
  assert.equal(calls.length, 0);
  await driver.act(action);
  assert.deepEqual(calls[0], { target: { pid: 20, windowId: 9007199254740993n }, session: driver.session,
    x: 500, y: 400, direction: 1, by: 0, amount: 8n });
  await driver.close();
});


test('preview reads cannot race the release of a window while switching targets', async () => {
  const { sdk, native } = fixture();
  native.windows.push({ ...native.windows[0], windowId: 2n });
  let allowRelease, releaseStarted;
  const started = new Promise(resolve => { releaseStarted = resolve; });
  const gate = new Promise(resolve => { allowRelease = resolve; });
  let readsDuringClose = 0;
  const driver = new ComputerUseDriver(sdk, native, { captureFactory: async target => {
    let closing = false;
    return {
      frame: async () => { if (closing) { readsDuringClose++; throw Error('old capture closed'); } return { image: {}, sequence: Number(target.windowId) }; },
      close: async () => { closing = true; if (target.windowId !== 2n) { releaseStarted(); await gate; } },
    };
  } });
  await driver.bind('9007199254740993');
  const switching = driver.bind('2');
  await started;
  await assert.rejects(driver.liveCapture.frame(), /old capture closed/);
  const preview = driver.previewFrame();
  allowRelease();
  await switching;
  assert.equal((await preview).windowId, '2');
  assert.equal(readsDuringClose, 1, "only the old unsynchronized reader fails");
  await driver.close();
});

test('reconnect replaces the capture on the exact target and invalidates old action snapshots', async () => {
  const { sdk, native, calls } = fixture();
  const targets = []; let closed = 0; let disconnected = false;
  const driver = new ComputerUseDriver(sdk, native, { captureFactory: async target => {
    targets.push(String(target.windowId));
    const generation = targets.length;
    return { frame: async () => { if (disconnected && generation === 1) throw new Error('capture disconnected'); return { image: {}, width: 1000, height: 600 }; }, close: async () => { closed++; } };
  } });
  await driver.bind('9007199254740993');
  const state = await driver.observe();
  disconnected = true;
  await assert.rejects(driver.previewFrame(), /capture disconnected/);
  await driver.reconnectCapture();
  assert.deepEqual(targets, ['9007199254740993', '9007199254740993']);
  assert.equal(closed, 1);
  await assert.rejects(driver.act({ kind: 'click', elementToken: state.elements[0].elementToken, snapshotId: state.snapshotId }));
  assert.equal(calls.length, 0, 'reconnect never replays input');
  assert.equal((await driver.previewFrame()).windowId, '9007199254740993');
  await driver.close();
  assert.equal(closed, 2);
});
