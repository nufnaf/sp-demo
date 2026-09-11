import { ComputerUseDriver } from './driver.mjs';
import { runCalendarAgent } from './calendar-agent.mjs';
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

// One process owns the exact target. Renderer subscriptions never own task life.
let driver, initializing, active, viewing = false, paused = false, waiters = [], stopping = false;
let frameTimer, epoch = 0;
const send = value => { if (process.connected) process.send(value); };
const status = patch => send({ type: 'status', patch });
async function ready() {
  if (driver) return driver;
  initializing ??= ComputerUseDriver.create({ liveCapture: true });
  try { driver = await initializing; return driver; } finally { initializing = null; }
}
async function selectWindow() {
  await ready();
  const windows = await driver.listWindows();
  const editors = windows.filter(w => w.title === '创建日程');
  const choices = editors.length ? editors : windows.filter(w => w.title === '飞书' && w.bounds.width > 400);
  if (choices.length !== 1) throw new Error('请打开一个飞书主窗口或日程编辑窗口。');
  await driver.bind(choices[0].windowId); targetChanged();
}
function targetChanged() {
  epoch++;
  status({ target: driver.target ? { windowId: String(driver.target.windowId), title: driver.target.title } : null });
}
async function publish() {
  const current = epoch;
  try {
    if (viewing && driver) {
      const frame = await driver.previewFrame();
      if (frame && viewing && current === epoch && frame.windowId === String(driver.target?.windowId)) send({ type: 'frame', frame: { dataUrl: `data:${frame.image.mimeType};base64,${frame.image.dataBase64}`, sequence: frame.sequence, receivedAt: frame.receivedAt, windowId: frame.windowId } });
    }
  } catch { if (viewing && current === epoch) send({ type: 'frame', frame: { error: '画面暂时不可用，请检查飞书窗口。' } }); }
  if (!stopping) frameTimer = setTimeout(() => void publish(), 200);
}
let pendingSubmit;
async function run(message) {
  if (active) { send({ type: 'result', id: message.id, error: '另一项电脑操作尚未结束。' }); return; }
  const controller = new AbortController(); active = { id: message.id, controller }; paused = false;
  controller.signal.addEventListener('abort', () => {
    pendingSubmit?.reject(new Error('操作已停止。')); pendingSubmit = null;
    waiters.splice(0).forEach(resolve => resolve());
  }, { once: true });
  const timer = setTimeout(() => controller.abort(), 15 * 60_000);
  let resultError;
  status({ taskId: message.id, phase: 'running', detail: '正在打开飞书', steps: 0, error: null });
  try {
    const traceDirectory = process.env.SYNTROPIC_COMPUTER_TRACE_DIR;
    if (traceDirectory) await mkdir(traceDirectory, { recursive: true, mode: 0o700 });
    await selectWindow();
    await runCalendarAgent({ driver, draft: message.draft, calendarName: message.calendarName, signal: controller.signal,
      waitReady: async () => { if (paused) { status({ phase: 'paused', detail: '操作已暂停，可继续或检查飞书草稿' }); await new Promise(resolve => waiters.push(resolve)); } controller.signal.throwIfAborted(); },
      onTarget: targetChanged, onInteraction: () => status({ interactionStarted: true }), onProgress: patch => status(patch),
      onTrace: event => { if (traceDirectory) void appendFile(join(traceDirectory, `${message.id}.jsonl`), `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`, { mode: 0o600 }).catch(() => {}); },
      beforeSubmit: () => new Promise((resolve, reject) => { pendingSubmit = { resolve, reject }; send({ type: 'before-submit', id: message.id }); }),
    });
    status({ phase: 'verifying', detail: '正在核对飞书日历' });
  } catch (error) {
    const messageText = controller.signal.aborted ? '操作已停止，请检查飞书中保留的草稿。' : error.message;
    resultError = messageText;
    status({ phase: controller.signal.aborted ? 'stopped' : 'failed', detail: messageText, error: messageText });
  } finally {
    clearTimeout(timer); active = null; paused = false; waiters.splice(0).forEach(resolve => resolve()); pendingSubmit = null;
    if (!viewing) await driver?.unbind().catch(() => {});
    else if (driver) {
      const windows = await driver.listWindows().catch(() => []);
      if (!windows.some(window => String(window.windowId) === String(driver.target?.windowId))) await selectWindow().catch(() => {});
    }
  }
  send({ type: 'result', id: message.id, ...(resultError ? { error: resultError } : { submitted: true }) });
}
async function shutdown() {
  if (stopping) return; stopping = true;
  clearTimeout(frameTimer); active?.controller.abort(); pendingSubmit?.reject(new Error('操作已停止。'));
  waiters.splice(0).forEach(resolve => resolve());
  await driver?.close(); process.exit();
}
process.on('message', message => {
  if (message.type === 'run') void run(message);
  else if (message.type === 'reconnect') {
    void (async () => {
      await ready();
      if (driver.target) await driver.reconnectCapture(); else await selectWindow();
      targetChanged();
    })().catch(() => send({ type: 'frame', frame: { error: '无法恢复飞书画面，请检查窗口与录屏权限。' } }));
  }
  else if (message.type === 'submit-ready') { pendingSubmit?.resolve(); pendingSubmit = null; }
  else if (message.type === 'submit-refused') { pendingSubmit?.reject(new Error('会议记录未准备好，已停止保存。')); pendingSubmit = null; }
  else if (message.type === 'view') {
    viewing = message.enabled === true;
    if (viewing && !active) void selectWindow().catch(error => status({ phase: 'failed', detail: error.message, error: error.message }));
    else if (!viewing && !active) { epoch++; void driver?.unbind().catch(() => {}); }
  } else if (message.type === 'pause' && active) { paused = true; status({ phase: 'pausing', detail: '已请求暂停，将在当前步骤结束后等待' }); }
  else if (message.type === 'resume' && active) { paused = false; waiters.splice(0).forEach(resolve => resolve()); status({ phase: 'running', detail: '继续处理会议' }); }
  else if (message.type === 'stop') { active?.controller.abort(); pendingSubmit?.reject(new Error('操作已停止。')); pendingSubmit = null; waiters.splice(0).forEach(resolve => resolve()); }
  else if (message.type === 'verified') status({ phase: 'completed', detail: '会议已保存，日历已同步', error: null });
  else if (message.type === 'verification-failed') status({ phase: 'failed', detail: message.error, error: message.error });
});
process.on('disconnect', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());
void publish();
