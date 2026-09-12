export const APP_ORIGIN = 'http://127.0.0.1:30141';
export function isAppUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === APP_ORIGIN && !url.username && !url.password;
  } catch { return false; }
}
export function isExternalUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:', 'mailto:'].includes(url.protocol)
      && !url.username && !url.password;
  } catch { return false; }
}
