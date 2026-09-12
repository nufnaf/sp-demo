import { ComputerUseDriver } from './driver.mjs';

/**
 * The Feishu bundle id is the authoritative app identity. Window titles vary
 * with the client language, account and release (and may be empty), so the
 * probe must not require the Chinese app name.
 */
export function selectFeishuMainWindow(windows) {
  return windows
    .filter(window => window.bounds?.width > 400 && (window.bounds?.height === undefined || window.bounds.height > 300))
    .filter(window => !['创建日程', '新建日程'].includes(String(window.title ?? '').trim()))
    .sort((a, b) => (b.bounds.width * (b.bounds.height ?? 0)) - (a.bounds.width * (a.bounds.height ?? 0)))[0];
}

/** Explicit setup action: exercise the production capture path, then release it.
 * No input, model request, audio, saved image or renderer image transfer.
 */
export async function verifyComputerCapture() {
  const driver = await ComputerUseDriver.create({ liveCapture: true });
  try {
    const windows = await driver.listWindows();
    const target = selectFeishuMainWindow(windows);
    if (!target) throw new Error('请打开飞书桌面客户端的主窗口，再点击「验证屏幕访问」。');
    await driver.bind(target.windowId);
    if (!(await driver.previewFrame())?.image) throw new Error('尚未获取到飞书画面，请允许系统弹窗中的屏幕访问后重试。');
  } finally { await driver.close(); }
}
