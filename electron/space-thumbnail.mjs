/** Capture only the trusted workbench, never a native app or another renderer. */
export function createSpaceThumbnailCapture(getWindow, acceptsUrl) {
  let busy = false;
  return async event => {
    const win = getWindow();
    if (!win || win.isDestroyed() || !win.isVisible() || win.isMinimized() || busy
      || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame
      || !acceptsUrl(event.senderFrame.url) || new URL(event.senderFrame.url).pathname !== '/') return null;
    busy = true;
    try {
      const image = await win.webContents.capturePage();
      if (image.isEmpty()) return null;
      return `data:image/jpeg;base64,${image.resize({ width: 480 }).toJPEG(75).toString('base64')}`;
    } catch {
      return null; // Closing a window must not interrupt the task for a thumbnail.
    } finally { busy = false; }
  };
}
