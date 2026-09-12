import { APP_ORIGIN } from './policy.mjs';

export async function preparePresentationCalendar({ root = process.env.SYNTROPIC_PRESENTATION_ROOT, origin = APP_ORIGIN, request = fetch, onStatus = () => {} } = {}) {
  if (!root) return;
  onStatus('正在同步团队日程…', '正在同步飞书日历，请稍候。');
  let response, body;
  try {
    response = await request(`${origin}/api/desktop/prepare`, {
      method: 'POST', headers: { Origin: origin }, signal: AbortSignal.timeout(120_000), redirect: 'error',
    });
    body = await response.json();
  } catch { throw new Error('团队日程同步失败，请检查网络后重试。'); }
  if (!response.ok || body.ready !== true) throw new Error('团队日程同步失败，请检查网络及飞书日历授权后重试。');
}
