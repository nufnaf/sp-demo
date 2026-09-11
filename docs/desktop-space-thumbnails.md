# Desktop overview thumbnails

The desktop overview uses recent images of the actual Electron workbench. Window
content is never mounted a second time to produce a preview. The existing Spaces
ownership, PiP layer and shared desktop event stream are unchanged.

The active, visible desktop is captured after a 600 ms settling delay, then at
one-second intervals. The main process resizes its own webContents capture to a
480 px JPEG. The narrow preload method accepts no window ID, path or executable;
the handler checks the sender, main frame and workbench URL. Concurrent captures
are rejected. No macOS screen recording is needed for this internal page capture.
Native Feishu recording continues through the existing computer-use pipeline.

Opening the overview pauses sampling. Desktop transitions and overview changes
invalidate pending captures, so a late image cannot be assigned to another Space
or include a recursively captured overview. Each inactive Space retains its last
frame. This is a recent screenshot, not live rendering of all inactive desktops.
Snapshots are held in renderer memory only, not written to localStorage or disk.
A desktop with no captured frame (including after refresh or in a plain browser)
shows the cropped wallpaper until a native image is available.

The desktop/add cards share dimensions; the add label is “新建桌面”. The remove
button uses a centered SVG and fits inside the strip's padded scroll area. The
wallpaper source has its white perimeter removed (5 px left, 8 right, 10 top,
7 bottom), preserving every interior pixel in the 1479 × 1479 PNG. The fallback
uses this same borderless asset without CSS overscan.

The menu bar uses shared, non-shrinking 32 px controls. Text controls size to
their content; clock spacing and tabular numerals are separate from buttons.
There is no manual preview entry in the menu bar. PiP opens automatically on the
first computer-use interaction. Hiding it does not stop the task or cause it to
reopen on the next status update; a new task's interaction can open it again.

Desktop cards, app windows and PiP share a 520 ms Space transition with a smooth
ease-in/ease-out curve. Transitions belong to the base surfaces, so entering and
leaving both animate. The cards use the same index-based offset as windows,
including jumps across multiple Spaces. Reduced motion disables both directions.
The 600 ms thumbnail settling delay remains longer than the slide.

## Open-source assessment (2026-09-11)

Read source, without installing or executing these projects:

- [react-ui-os](https://github.com/saschb2b/react-ui-os/tree/36642e509e9ad5485763904fcfc09b00d95cee3d), MIT.
  `packages/desktop/src/spaces-bar.tsx` draws window outlines, not screenshots.
  `MissionControl.tsx` mounts another instance of app content for its window
  previews, which does not retain unsaved state and could duplicate our effects
  and connections. The inspected Spaces bar has click/add but no cross-Space drop
  handlers. Both core and desktop packages are private version 0.0.0 in this
  checkout. Useful interaction and reducer reference; not a drop-in replacement.
- [daedalOS window peek](https://github.com/DustinBrett/daedalOS/blob/2197e8ab2d792eb9b48e4b1ae18844ea256784e1/components/system/Taskbar/TaskbarEntry/Peek/useWindowPeek.ts), MIT.
  Uses HTML-to-image canvas conversion with a 15 FPS target, with app-specific
  preview elements or images. Adopting that path would still require validation
  of our iframe and recording content; the existing Electron compositor can
  capture the page's painted result directly.
- [OpenStation overview](https://github.com/WordPress/openstation/blob/1e98fef0caa39b60172522497e8866310384fe4d/src/window-manager/overview.ts), GPL-2.0.
  Scales existing window elements in its full-window overview. Its desktop strip
  currently uses window-count badges; actual per-window thumbnails are noted as
  future work. Its manager is integrated with WordPress shell and hooks.
- [maomaolabs/core](https://github.com/maomaolabs/core), MIT.
  Its inspected 1.1.0 source covers window dragging/resizing/snapping but does not
  expose virtual-desktop or Mission Control management.

Decision: retain the tested Syntropic window lifecycle, use built-in Electron
capture for images, and avoid introducing a second window manager for these UI
fixes. No third-party implementation was copied or added as a dependency.

## Verification

`scripts/desktop-space-thumbnails.test.mjs` exercises the real React UI and native
Electron capture, with business APIs replaced by fixtures. It checks per-Space
images, capture pausing, card geometry, centered unclipped remove buttons, and
the six-desktop limit/scrolling. `electron/space-thumbnail.test.mjs` checks sender
isolation and concurrent capture. Existing PiP/Spaces regression tests cover
cross-desktop movement and foreground insight preservation. No external meeting
or job publication is performed by these checks.
