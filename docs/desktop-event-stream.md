# Desktop event connection budget

The packaged App serves HTTP/1 on loopback. Chromium allows six concurrent
connections per origin. Computer Use originally added separate status and frame
EventSources to the existing Browser, file-app, Jarvis and JD watch streams.
With all six open, the publication POST stayed queued before reaching the server;
`RecruitingPublication` therefore remained in its preparation state.

The desktop now multiplexes Browser, file-app, Computer status and optional
Computer frames through `/api/desktop/events`. `subscribeDesktopEvents` owns one
EventSource per renderer. Opening or hiding the preview replaces that source
(close first) to acquire or release the native frame subscription. Spaces moves
keep the subscription. Legacy endpoints remain available to diagnostic clients.
Agent-session streams and individual file watches retain their existing owners.
This leaves three connections in the original failing desktop configuration;
it does not remove the browser's connection limit for arbitrary extra documents
or other same-origin tabs.

The server emits channel-specific events and fresh ready/status signals after
reconnect. Video frames can be dropped under backpressure; file and task state
cannot. Abort, cancel and subscription failure release server subscriptions.
Native status and frames retain the loopback boundary; remote desktops can still
receive Browser and file events without exposing native Computer state.

Validation:

- `lib/desktop-events.test.mjs`: connection sharing, frame lease changes, stale
  callbacks, cancellation, backpressure and failed subscription cleanup.
- `lib/browser/client-events.test.mjs`: independent desktop/browser consumers,
  reconnect notification and late subscription.
- `scripts/desktop-connection-budget.test.mjs`: actual Chromium and HTTP/1 sockets,
  without request interception. Six legacy streams reproduce a queued POST.
  Shared desktop stream plus four other streams completes the POST while frames
  continue (2ms in the local run; this is transport latency, not publication time).
- `scripts/computer-preview.test.mjs`: real React controls, hide/reopen, pause,
  recovery, cross-Space dragging and resizing, using fixture API/frame data.

The original user's queued publication resumed after hiding the old preview and
completed successfully. That observation establishes the root cause; it is not
claimed as end-to-end acceptance of a newly built package.
