import { createInterface } from 'node:readline';
import { mkdir, writeFile } from 'node:fs/promises';
import { ComputerUseDriver } from '../electron/computer-use/driver.mjs';

// Development-only, model-free acceptance console. Input is one JSON command per
// line, never eval. Every action is grounded in the immediately preceding AX read.
const driver = await ComputerUseDriver.create({ liveCapture: true });
const viewer = await ComputerUseDriver.create({ liveCapture: true });
const directory = 'build/verification/computer-use/manual';
await mkdir(directory, { recursive: true });
let state;
let step = 0;
let targetId;
const controls = value => value.elements.filter(element => !/^AX(Image|Menu)/.test(element.role))
  .map(({ elementIndex, role, label, value }) => ({ index: elementIndex, role, label, value }));
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
console.log(JSON.stringify({ ready: true, model: false }));
try {
  for await (const line of input) {
    if (!line.trim()) continue;
    const started = performance.now();
    try {
      const command = JSON.parse(line);
      if (command.op === 'close') break;
      let result;
      if (command.op === 'windows') result = await driver.listWindows();
      else if (command.op === 'bind') {
        const windows = await driver.listWindows();
        const candidates = windows.filter(window => command.windowId ? window.windowId === command.windowId : window.title === command.title);
        if (candidates.length !== 1) throw new Error('Window is not unique');
        targetId = candidates[0].windowId;
        await driver.bind(targetId);
        state = await driver.observe();
        result = controls(state);
      } else if (command.op === 'observe') {
        driver.includeScreenshots = command.screenshot === true;
        state = await driver.observe();
        result = controls(state);
      } else if (command.op === 'act') {
        if (!state) throw new Error('Observe first');
        let element;
        if (command.index !== undefined) element = state.elements.find(element => String(element.elementIndex) === String(command.index));
        else if (command.label) {
          const candidates = state.elements.filter(element => (element.label === command.label || element.value === command.label)
            && (!command.role || element.role === command.role));
          if (candidates.length !== 1) throw new Error(`Expected one control, found ${candidates.length}`);
          element = candidates[0];
        }
        if (!element && ['click', 'clickCenter', 'setValue', 'scroll'].includes(command.kind)) throw new Error('Exact control required');
        const action = { kind: command.kind, snapshotId: state.snapshotId, elementToken: element?.elementToken,
          text: command.text, key: command.key, modifiers: command.modifiers, count: command.count,
          direction: command.direction, amount: command.amount };
        if (command.kind === 'clickCenter' || command.kind === 'scroll') {
          if (!state.windowBounds || !state.screenshotWidth || !element?.frame) throw new Error('Observe with screenshot:true for current coordinate geometry');
          const { x, y, w, h } = element.frame;
          action.kind = command.kind === 'scroll' ? 'scroll' : 'click';
          delete action.elementToken;
          action.x = (x + w / 2 - state.windowBounds.x) * state.screenshotWidth / state.windowBounds.width;
          action.y = (y + h / 2 - state.windowBounds.y) * state.screenshotHeight / state.windowBounds.height;
        }
        const response = await driver.act(action);
        state = response.observation;
        result = { outcome: response.outcome, controls: controls(state) };
      } else if (command.op === 'capture') {
        await viewer.bind(targetId);
        const frame = await viewer.capture();
        const path = `${directory}/${String(++step).padStart(3, '0')}.jpg`;
        await writeFile(path, Buffer.from(frame.image.dataBase64, 'base64'), { mode: 0o600 });
        result = { path, width: frame.width, height: frame.height };
      } else throw new Error('Unknown command');
      if (state) await writeFile(`${directory}/latest-state.json`, JSON.stringify(state), { mode: 0o600 });
      console.log(JSON.stringify({ ok: true, elapsedMs: Math.round(performance.now() - started), result }));
    } catch (error) {
      console.log(JSON.stringify({ ok: false, elapsedMs: Math.round(performance.now() - started), error: error.message, code: error.code }));
    }
  }
} finally { await Promise.all([driver.close(), viewer.close()]); input.close(); }
