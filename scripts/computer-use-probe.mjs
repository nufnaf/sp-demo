import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ComputerUseDriver } from '../electron/computer-use/driver.mjs';

// Read-only: never opens an app, requests permissions, clicks, or edits a calendar.
const sdkCapture = process.argv.includes('--sdk-capture');
const driver = await ComputerUseDriver.create({ includeScreenshots: true, liveCapture: !sdkCapture });
try {
  const windows = await driver.listWindows();
  const requested = process.argv.find(value => value.startsWith('--window='))?.slice(9);
  const candidates = requested ? windows.filter(window => window.windowId === requested)
    : windows.filter(window => window.title === '飞书' && window.bounds.width >= 400 && window.bounds.height >= 300);
  const report = { driver: await driver.metadata(), permissions: driver.permissions(), windows,
    captureMode: sdkCapture ? 'sdk-independent-screenshot' : 'shared-display-stream', captured: false };
  if (candidates.length === 1) {
    await driver.bind(candidates[0].windowId);
    const started = performance.now();
    const state = await driver.observe();
    const image = state.images[0];
    if (image && state.screenshotFrameValid === true) {
      const directory = resolve('build/verification/computer-use');
      await mkdir(directory, { recursive: true });
      const extension = image.mimeType === 'image/jpeg' ? 'jpg' : 'png';
      await writeFile(resolve(directory, `feishu-probe${sdkCapture ? '-sdk' : ''}.${extension}`), Buffer.from(image.dataBase64, 'base64'), { mode: 0o600 });
      Object.assign(report, { captured: true, elapsedMs: Math.round(performance.now() - started),
        width: state.screenshotWidth, height: state.screenshotHeight,
        elements: state.elements?.length ?? 0, degraded: state.degraded ?? false,
        calendarPageError: state.treeMarkdown?.includes('检测到页面出现异常') ?? false });
      await writeFile(resolve(directory, 'probe.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
    }
  }
  console.log(JSON.stringify(report, null, 2));
  if (!report.captured) process.exitCode = 1;
} catch {
  console.error('飞书读取未完成。请检查应用权限及窗口状态，再重新运行探针。');
  process.exitCode = 1;
} finally { await driver.close(); }
