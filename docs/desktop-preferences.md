# Desktop preferences and preview placement

The two controls are under Settings → General → 桌面与悬浮窗:

- 多桌面: defaults off. Hides overview and window move menus and disables Spaces keyboard/drag gestures. Turning it off gathers existing windows on the first desktop without stopping tasks or remounting their content.
- 悬浮窗宽度: 1 / 1.25 / 1.5 / 1.75 / 2 times the desktop card width; defaults to 1.5. Applies to the live Computer Use preview immediately, keeping the recording aspect ratio. Enlarged mode remains independent.

Electron stores only these allowlisted values in `app.getPath('userData')/ui-preferences.json`, outside disposable presentation runs and renderer partitions. Writes are serialized and atomically renamed, and the main frame IPC guard checks the owning BrowserWindow and workbench URL. Browser-only mode uses versioned localStorage. A failed write retains the last saved settings and shows an error.

Default preview placement searches free space around cards, preferring the lower right and reserving clearance above the collapsed composer. When needed it shrinks to a free rectangle. At App widths 761–1199, an open home preview reserves the right column and the cards use a scrollable left column. Closing/hiding/moving the preview away releases that column. Manually dragged positions are respected, so users can still place the preview over content intentionally.

The recent-results title icon is removed from both the presentation widgets and the ordinary workbench shelf. File entries retain their own file-type indicators.

## Validation

- Native Electron fixture: actual sandboxed preload → IPC → disk write, process exit, second Electron process with a fresh temporary partition → same preferences. Uses temporary test userData and hidden windows, never the installed Syntropic App.
- Settings, geometry, Spaces and native bridge tests: 18 passed.
- Browser fixture: default off, keyboard disabled, enable, save/reload, disabling from a secondary desktop, live size changes, write failure, preserved preview image, 1440×1000 and 960×640 card clearance, preview pause/resume/stop/reconnect, drag between Spaces, expand/restore, mobile viewport bounds and reduced motion.
- TypeScript and changed-file ESLint. Test frames and API responses are fixtures; no external calendar writes or model calls.

## Packaged acceptance (2026-09-11)

The macOS Apple Silicon package built from `f299875` was installed and verified. Settings saved as Spaces on / preview width 1.75 survived a normal App restart. They were then restored to Spaces off / width 1.5 and verified again after quitting and relaunching. The installed App also passed notification-driven publication, recruiting progress lookup and duplicate-publication protection. Package signature, ZIP integrity and extracted build identity checks passed. Another Mac's first launch and PAC environment remain unverified.
