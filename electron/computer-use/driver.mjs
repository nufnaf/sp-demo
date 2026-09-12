import { randomUUID } from 'node:crypto';

export const FEISHU_BUNDLE_ID = 'com.electron.lark';

export function serializable(value) {
  return JSON.parse(JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item));
}

/** One runtime and one exact native window; the viewer never owns this session. */
export class ComputerUseDriver {
  constructor(sdk, driver, { bundleId = FEISHU_BUNDLE_ID, includeScreenshots = false, captureFactory, inputFocusFactory } = {}) {
    this.sdk = sdk;
    this.driver = driver;
    this.bundleId = bundleId;
    this.includeScreenshots = includeScreenshots;
    this.captureFactory = captureFactory;
    this.inputFocusFactory = inputFocusFactory;
    this.session = `syntropic-${randomUUID()}`;
    this.target = null;
    this.snapshot = null;
    this.queue = Promise.resolve();
    this.closing = false;
  }

  static async create(options = {}) {
    const sdk = await import('@trycua/cua-driver');
    const captureFactory = options.liveCapture ? (await import('./capture-connection.mjs')).acquireWindowCapture : undefined;
    const inputFocusFactory = process.platform === 'darwin' && (!options.bundleId || options.bundleId === FEISHU_BUNDLE_ID)
      ? (await import('./input-focus.mjs')).acquireInputFocus : undefined;
    return new ComputerUseDriver(sdk, sdk.CuaDriver.create(), { ...options, captureFactory, inputFocusFactory });
  }

  permissions() { return this.sdk.currentMacOsPermissionStatus(); }
  metadata() { return this.driver.metadata(); }

  run(operation) {
    if (this.closing) return Promise.reject(new Error('电脑操作已停止。'));
    const work = this.queue.then(() => {
      if (this.closing) throw new Error('电脑操作已停止。');
      return operation();
    });
    this.queue = work.catch(() => {});
    return work;
  }

  async discover() {
    const { apps } = await this.driver.listApps(this.sdk.ListAppsInput.new({}));
    const targets = apps.filter(app => app.bundleId === this.bundleId && app.running);
    const windows = [];
    for (const app of targets) {
      const result = await this.driver.listWindows(this.sdk.ListWindowsInput.new({ pid: app.pid, onScreenOnly: false }));
      for (const window of result.windows) {
        if (window.pid === app.pid && window.bounds.width > 0 && window.bounds.height > 0) {
          windows.push({ ...window, bundleId: app.bundleId });
        }
      }
    }
    return windows;
  }

  listWindows() { return this.run(async () => serializable((await this.discover()).filter(window => window.isOnScreen !== false))); }

  bind(windowId) {
    return this.run(async () => {
      const windows = (await this.discover()).filter(window => window.windowId.toString() === String(windowId));
      if (windows.length !== 1) throw new Error('飞书窗口不存在或无法唯一识别，请重新选择。');
      if (this.target?.pid === windows[0].pid && this.target?.windowId === windows[0].windowId && this.liveCapture) {
        await this.assertTarget();
        await this.liveCapture.frame(windows[0].bounds);
        this.snapshot = null;
        return serializable(windows[0]);
      }
      await this.liveCapture?.close();
      this.liveCapture = null;
      this.target = windows[0];
      this.snapshot = null;
      if (this.captureFactory) this.liveCapture = await this.captureFactory(this.target);
      return serializable(this.target);
    });
  }

  // Capture reads use the same queue as bind/unbind: never read a closing stream.
  previewFrame() {
    return this.run(async () => {
      if (!this.liveCapture || !this.target) return null;
      const frame = await this.liveCapture.frame();
      return { ...frame, windowId: String(this.target.windowId) };
    });
  }

  reconnectCapture() {
    return this.run(async () => {
      const target = await this.assertTarget({ validateCapture: false });
      this.snapshot = null;
      const previous = this.liveCapture;
      this.liveCapture = null;
      await previous?.close();
      if (this.captureFactory) this.liveCapture = await this.captureFactory(target);
    });
  }

  unbind() {
    return this.run(async () => {
      this.snapshot = null;
      this.target = null;
      const capture = this.liveCapture;
      this.liveCapture = null;
      await capture?.close();
    });
  }

  async assertTarget({ validateCapture = true } = {}) {
    if (!this.target) throw new Error('请先选择飞书窗口。');
    // The app identity was resolved at bind time. Re-enumerating every installed
    // app on every frame is expensive; validate only the bound process/window.
    const { windows } = await this.driver.listWindows(this.sdk.ListWindowsInput.new({
      pid: this.target.pid, onScreenOnly: false,
    }));
    const current = windows.find(window => window.pid === this.target.pid && window.windowId === this.target.windowId);
    if (!current) { this.target = null; this.snapshot = null; throw new Error('飞书窗口已关闭，请重新选择。'); }
    // Feishu can retain the native window after dismissing an editor. A cached
    // window ID is not proof of a live, visible form. Full occlusion is still
    // isOnScreen=true; internal Syntropic Spaces never hide the source window.
    if (current.isOnScreen === false) { this.snapshot = null; throw new Error('飞书窗口已隐藏或关闭，请展开目标窗口后重新选择。'); }
    if (validateCapture && this.liveCapture) await this.liveCapture.frame(current.bounds);
    return current;
  }

  async read(signal) {
    const target = await this.assertTarget();
    const permissions = this.permissions();
    if (!permissions.accessibility || (this.includeScreenshots && !permissions.screenRecording)) throw new Error('请在系统设置中允许当前应用使用所需的辅助功能或屏幕录制权限，然后重新打开应用。');
    const state = await this.driver.getWindowState(this.sdk.GetWindowStateInput.new({
      pid: target.pid, windowId: target.windowId, session: this.session,
      includeAccessibilityTree: true, includeScreenshot: this.includeScreenshots, maxDimension: 1440,
    }), signal ? { signal } : undefined);
    if (this.liveCapture) {
      const frame = await this.liveCapture.frame(target.bounds);
      if (this.includeScreenshots) {
        if (state.screenshotWidth !== frame.width || state.screenshotHeight !== frame.height) throw new Error('窗口尺寸正在变化，请重新读取。');
        state.images = [frame.image];
        state.screenshotFrameValid = true;
      }
    }
    this.snapshot = state;
    return serializable(state);
  }

  observe(signal) { return this.run(() => this.read(signal)); }

  /** A preview gets its own runtime so its captures do not replace an agent's AX snapshot. */
  capture() {
    return this.run(async () => {
      const target = await this.assertTarget();
      if (target.minimized) throw new Error('飞书窗口已最小化，请展开后继续查看。');
      this.snapshot = null;
      if (this.liveCapture) return this.liveCapture.frame(target.bounds);
      const state = await this.driver.getWindowState(this.sdk.GetWindowStateInput.new({
        pid: target.pid, windowId: target.windowId, session: this.session,
        includeAccessibilityTree: false, includeScreenshot: true, maxDimension: 1440,
      }));
      if (state.screenshotFrameValid !== true || !state.images[0]) throw new Error('暂时无法获取飞书画面，请检查窗口状态。');
      return { image: state.images[0], width: state.screenshotWidth, height: state.screenshotHeight };
    });
  }

  /** Every action consumes the preceding observation; refusals never escalate to foreground. */
  act(action, signal) {
    return this.run(async () => {
      signal?.throwIfAborted();
      const target = await this.assertTarget();
      const state = this.snapshot;
      if (!state?.snapshotId || action.snapshotId !== state.snapshotId) throw new Error('画面已更新，请读取当前窗口后再操作。');
      const nativeTarget = this.sdk.ActionTarget.Window.new({ pid: target.pid, windowId: target.windowId });
      const options = signal ? { signal } : undefined;
      let input;
      let method;
      let protocolTool;
      if (action.kind === 'click') {
        if (action.count !== undefined && ![1, 2].includes(action.count)) throw new Error('点击次数无效。');
        let position;
        if (action.elementToken) {
          // Cua's element path performs AXPress and ignores click count. Never
          // acknowledge a requested double-click as a different interaction.
          if (action.count === 2) throw new Error('双击需要当前截图坐标；控件 token 点击只执行 AXPress。');
          const element = state.elements?.find(element => element.elementToken === action.elementToken);
          if (!element || element.enabled === false) throw new Error('目标控件已失效或不可用，请重新读取窗口。');
          position = this.sdk.ClickPosition.Element.new({ elementToken: action.elementToken });
        } else {
          if (state.windowBounds && (state.windowBounds.width !== target.bounds.width || state.windowBounds.height !== target.bounds.height)) throw new Error('窗口尺寸已变化，请重新读取后操作。');
          if (state.screenshotFrameValid !== true || !Number.isFinite(action.x) || !Number.isFinite(action.y)
            || action.x < 0 || action.y < 0 || action.x >= state.screenshotWidth || action.y >= state.screenshotHeight) {
            throw new Error('点击位置不在当前截图内。');
          }
          position = this.sdk.ClickPosition.Coordinates.new({ x: action.x, y: action.y });
        }
        method = 'click';
        input = this.sdk.ClickInput.new({ target: nativeTarget, position,
          deliveryMode: this.sdk.InputDeliveryMode.Background, session: this.session, count: action.count });
      } else if (action.kind === 'setValue') {
        const element = state.elements?.find(element => element.elementToken === action.elementToken);
        if (!element || element.enabled === false || typeof action.text !== 'string' || action.text.length > 12000) {
          throw new Error('目标控件或输入内容无效，请重新读取窗口。');
        }
        // The typed 0.26.1 API omits set_value; use its public protocol adapter
        // with a closed tool name and the exact snapshot-owned element token.
        method = 'callTool';
        protocolTool = 'set_value';
        // Feishu's Electron rich-text editor visually echoes AXValue containing
        // LF, but persists only its final paragraph. U+2028 keeps line breaks in
        // one text insertion; verified by saving and reading the calendar API.
        // This transport adaptation does not add actions or change other inputs.
        const value = this.bundleId === FEISHU_BUNDLE_ID && element.role === 'AXTextArea' && element.inWebContent
          ? action.text.replace(/\r\n|[\r\n]/g, '\u2028') : action.text;
        input = JSON.stringify({ pid: target.pid, element_token: action.elementToken,
          snapshot_id: state.snapshotId, value, session: this.session });
      } else if (action.kind === 'type') {
        if (typeof action.text !== 'string' || action.text.length > 12000) throw new Error('输入内容无效。');
        if (action.elementToken) {
          const element = state.elements?.find(element => element.elementToken === action.elementToken);
          if (!element || element.enabled === false) throw new Error('目标控件已失效，请重新读取窗口。');
          method = 'callTool';
          protocolTool = 'type_text';
          input = JSON.stringify({ pid: target.pid, element_token: action.elementToken,
            snapshot_id: state.snapshotId, text: action.text, session: this.session });
        } else {
          method = 'typeText';
          input = this.sdk.TypeTextInput.new({ target: nativeTarget, text: action.text, session: this.session });
        }
      } else if (action.kind === 'key') {
        if (typeof action.key !== 'string' || !action.key || action.key.length > 40
          || (action.modifiers !== undefined && (!Array.isArray(action.modifiers)
            || action.modifiers.some(value => !['cmd', 'shift', 'option', 'ctrl'].includes(value))))) throw new Error('按键无效。');
        method = 'pressKey';
        input = this.sdk.PressKeyInput.new({ target: nativeTarget, key: action.key, modifiers: action.modifiers, session: this.session });
      } else if (action.kind === 'scroll') {
        if (state.windowBounds && (state.windowBounds.width !== target.bounds.width || state.windowBounds.height !== target.bounds.height)) throw new Error('窗口尺寸已变化，请重新读取后操作。');
        if (!['up', 'down'].includes(action.direction) || !Number.isInteger(action.amount)
          || action.amount < 1 || action.amount > 10 || state.screenshotFrameValid !== true
          || !Number.isFinite(action.x) || !Number.isFinite(action.y) || action.x < 0 || action.y < 0
          || action.x >= state.screenshotWidth || action.y >= state.screenshotHeight) throw new Error('滚动位置或距离无效。');
        method = 'scroll';
        input = this.sdk.ScrollInput.new({ target: nativeTarget, session: this.session,
          x: action.x, y: action.y, direction: action.direction === 'down' ? this.sdk.ScrollDirection.Down : this.sdk.ScrollDirection.Up,
          by: this.sdk.ScrollBy.Line, amount: BigInt(action.amount) });
      } else throw new Error('不支持这项电脑操作。');
      // Invalid inputs do not consume a snapshot. Once dispatch starts, never replay it.
      this.snapshot = null;
      // AXPress does not borrow AppKit focus. Coordinates can fall through to
      // Cua's raw mouse path (always for double-clicks), which does. Release
      // before the next observation, including rejected/aborted native calls.
      const focus = method === 'click' && !action.elementToken ? await this.inputFocusFactory?.(target) : undefined;
      let result;
      try {
        signal?.throwIfAborted();
        result = method === 'callTool' ? await this.driver.callTool(protocolTool, input, options)
          // Cancellation must not release focus while native mouse events are
          // still being posted. Stop after this atomic input, before observing.
          : await this.driver[method](input, focus ? undefined : options);
      } finally { await focus?.release(); }
      signal?.throwIfAborted();
      const outcome = method === 'click' ? result : result.action;
      if (result.isError || outcome?.effect === this.sdk.ActionEffect.Refused
        || outcome?.effect === this.sdk.ActionEffect.SuspectedNoop) {
        const error = new Error('飞书未确认这次操作，请读取当前窗口后检查。');
        error.code = result.errorCode ?? 'action_unconfirmed';
        error.outcome = serializable(outcome ?? null);
        throw error;
      }
      return { outcome: serializable(outcome ?? null), observation: await this.read(signal) };
    });
  }

  close() {
    if (this.closePromise) return this.closePromise;
    this.closing = true;
    this.closePromise = this.queue.then(async () => {
      try { try { await this.liveCapture?.close(); } finally { await this.driver.shutdown(); } }
      finally { this.driver.uniffiDestroy(); this.target = null; this.snapshot = null; }
    });
    return this.closePromise;
  }
}
