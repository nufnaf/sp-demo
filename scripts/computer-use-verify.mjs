import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { ComputerUseDriver } from '../electron/computer-use/driver.mjs';

// Fixed, model-free native acceptance. Only touches an explicitly identified
// test draft. Never saves, chooses attendees, runs keyboard shortcuts, or raises.
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const windowId = option('window-id');
const expectedTitle = option('expected-title');
if (!windowId || !expectedTitle) throw new Error('Provide --window-id and --expected-title for an owned, unsaved test draft.');
const driver = await ComputerUseDriver.create({ liveCapture: true });
const viewer = await ComputerUseDriver.create({ liveCapture: true });
const directory = `build/verification/computer-use/fixed-${Date.now()}`;
await mkdir(directory, { recursive: true, mode: 0o700 });
const report = { modelCalls: 0, saved: false, windowId, steps: [], imagesRequireVisualReview: true };
const description = '讨论候选人评价标准与后续分工。';
const tomorrow = new Date(Date.now() + 86400000);
const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'numeric', day: 'numeric' })
  .formatToParts(tomorrow).map(part => [part.type, part.value]));
const dateText = `${parts.year}年${Number(parts.month)}月${Number(parts.day)}日`;
const datePattern = /^\d{4}年\d{1,2}月\d{1,2}日$/;
const timePattern = /^\d{2}:\d{2}$/;
let state;
const elements = () => state.elements;
const one = (matches, name) => { if (matches.length !== 1) throw new Error(`${name}: expected one control, found ${matches.length}`); return matches[0]; };
const named = (label, role) => one(elements().filter(e => e.label === label && e.role === role), label);
const dates = () => elements().filter(e => datePattern.test(e.value ?? '') && e.frame);
const times = () => elements().filter(e => timePattern.test(e.value ?? '') && e.frame
  && Math.abs(e.frame.y - dates()[0]?.frame.y) < 20
  && e.frame.x > dates()[0]?.frame.x && e.frame.x < dates()[1]?.frame.x);
const title = () => one(elements().filter(e => e.role === 'AXTextField' && !timePattern.test(e.value ?? '')), 'title');
const richText = () => one(elements().filter(e => e.role === 'AXTextArea' && e.value !== undefined), 'description');

async function read(screenshot = false) {
  driver.includeScreenshots = screenshot;
  state = await driver.observe();
}
async function waitFor(predicate, label) {
  const deadline = Date.now() + 15000;
  do {
    await read();
    if (predicate()) return;
    await delay(250);
  } while (Date.now() < deadline);
  throw new Error(`Timed out observing ${label}; action was not repeated.`);
}
async function act(selector, kind, text) {
  await read(kind === 'center' || kind === 'edit' || kind === 'scroll');
  const element = selector();
  const action = { kind, snapshotId: state.snapshotId, elementToken: element.elementToken, text };
  if (kind === 'center' || kind === 'edit' || kind === 'scroll') {
    if (!element.frame || !state.windowBounds) throw new Error('Missing current AX coordinate geometry');
    action.kind = kind === 'scroll' ? 'scroll' : 'click';
    // Cua's single coordinate click may resolve to AXPress. Text editing
    // requires real pointer focus/blur; double-click is the SDK's explicit
    // routed pointer path and is appropriate for selecting a text field.
    if (kind === 'edit') action.count = 2;
    if (kind === 'scroll') { action.direction = 'down'; action.amount = 8; }
    delete action.elementToken;
    action.x = (element.frame.x + element.frame.w / 2 - state.windowBounds.x) * state.screenshotWidth / state.windowBounds.width;
    action.y = (element.frame.y + element.frame.h / 2 - state.windowBounds.y) * state.screenshotHeight / state.windowBounds.height;
  }
  state = (await driver.act(action)).observation;
}
async function checkpoint(name) {
  const { apps } = await driver.driver.listApps(driver.sdk.ListAppsInput.new({}));
  const target = apps.find(app => app.pid === driver.target.pid);
  if (!target || target.active !== false) throw new Error(`${name}: Feishu was not confirmed in background`);
  const frame = await viewer.capture();
  const image = `${name}.jpg`;
  await writeFile(`${directory}/${image}`, Buffer.from(frame.image.dataBase64, 'base64'), { mode: 0o600 });
  report.steps.push({ name, at: new Date().toISOString(), background: true, image,
    title: title().value, dates: dates().map(e => e.value), times: times().map(e => e.value) });
  console.log(JSON.stringify({ step: name, background: true, image: `${directory}/${image}` }));
}

try {
  const bound = await driver.bind(windowId);
  if (bound.title !== '创建日程') throw new Error('Target must be a calendar editor');
  await viewer.bind(windowId);
  await read();
  if (title().value !== expectedTitle) throw new Error('Draft title differs; will not touch an existing user draft');
  if (dates().length !== 2 || times().length !== 2) throw new Error('Unexpected calendar editor layout');
  // This fixture deliberately does not guess calendar navigation across months.
  if (!dates()[0].value.startsWith(`${parts.year}年${Number(parts.month)}月`)) throw new Error('This fixture requires tomorrow in the displayed month');
  for (const iteration of [1, 2, 3]) {
    const value = `面试标准对齐 · 全遮挡验证 ${iteration}`;
    await act(title, 'setValue', value);
    await waitFor(() => title().value === value, 'updated title');
    await checkpoint(`title-${iteration}`);
  }
  if (dates()[0].value !== dateText) {
    await act(() => dates()[0], 'center');
    await waitFor(() => elements().some(e => e.role === 'AXStaticText' && e.label === String(Number(parts.day))), 'date picker');
    await act(() => named(String(Number(parts.day)), 'AXStaticText'), 'center');
    await waitFor(() => dates().length === 2 && dates().every(e => e.value === dateText), 'tomorrow');
  }
  await checkpoint('date');
  for (const [index, value] of ['14:00', '14:30'].entries()) {
    await act(() => times()[index], 'edit');
    await waitFor(() => times()[index]?.role === 'AXTextField', 'time field');
    await act(() => times()[index], 'setValue', value);
    await waitFor(() => times()[index]?.value === value, 'updated time');
    await act(title, 'edit');
    await waitFor(() => times()[index]?.role === 'AXStaticText' && times()[index]?.value === value, 'committed time after pointer blur');
  }
  await act(title, 'edit');
  await waitFor(() => times().map(e => e.value).join('-') === '14:00-14:30', 'time range after blur');
  await checkpoint('times');
  await act(() => named('添加描述', 'AXButton'), 'click');
  await waitFor(() => elements().some(e => e.role === 'AXTextArea' && e.value !== undefined), 'description editor');
  await act(richText, 'setValue', description);
  await waitFor(() => richText().value.includes(description), 'description value');
  await checkpoint('description');
  await act(() => named('添加会议室', 'AXButton'), 'scroll');
  await waitFor(() => richText().frame?.h > 30, 'visible description after scroll');
  await checkpoint('description-visible');
  report.description = description;
  report.axVerified = true;
  console.log(JSON.stringify({ axVerified: true, modelCalls: 0, saved: false, directory }));
} catch (error) {
  report.error = error.message;
  if (state) await writeFile(`${directory}/failure-state.json`, JSON.stringify(state), { mode: 0o600 });
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
  await Promise.all([driver.close(), viewer.close()]);
}
