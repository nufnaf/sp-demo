import { ComputerUseDriver } from './driver.mjs';

/** Explicit setup action: exercise the production capture path, then release it.
 * No input, model request, audio, saved image or renderer image transfer.
 */
export async function verifyComputerCapture() {
  const driver = await ComputerUseDriver.create({ liveCapture: true });
  try {
    const windows = await driver.listWindows();
    const target = windows.find(window => window.title === '飞书' && window.bounds.width > 400);
    if (!target) throw new Error('请打开飞书桌面客户端的主窗口，再点击「验证屏幕访问」。');
    await driver.bind(target.windowId);
    if (!(await driver.previewFrame())?.image) throw new Error('尚未获取到飞书画面，请允许系统弹窗中的屏幕访问后重试。');
  } finally { await driver.close(); }
}
