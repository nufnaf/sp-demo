import { existsSync } from 'node:fs';

// macOS can activate the original process after its bundle has been moved.
// Creating another BrowserWindow then asks Chromium to launch a helper from
// the old bundle path and can abort the entire process before JS can catch it.
export function createAppLocationGuard(resourcesPath, onUnavailable) {
  let unavailable = false;
  return () => {
    if (unavailable) return false;
    if (!resourcesPath || existsSync(resourcesPath)) return true;
    unavailable = true;
    onUnavailable();
    return false;
  };
}
