export type DesktopEventChannel = "browser" | "file" | "computer-status" | "computer-frame";
type Listener = { message: (event: MessageEvent) => void; open?: () => void; error?: () => void };
type Subscription = { channel: DesktopEventChannel; listener: Listener };
const subscriptions = new Set<Subscription>();
let stream: EventSource | null = null;
let streamingFrames = false;

// Share desktop streams to leave HTTP/1 connections for Agent SSE, watches and commands.
function reconcile() {
  const frames = [...subscriptions].some(item => item.channel === "computer-frame");
  if (stream && subscriptions.size && frames === streamingFrames) return;
  stream?.close();
  stream = null;
  if (!subscriptions.size) return;
  streamingFrames = frames;
  const source = new EventSource(`/api/desktop/events${frames ? "?frames=1" : ""}`);
  stream = source;
  for (const channel of ["browser", "file", "computer-status", "computer-frame"] as const) {
    source.addEventListener(channel, event => {
      if (stream !== source) return;
      for (const item of [...subscriptions]) {
        if (item.channel === channel && subscriptions.has(item)) item.listener.message(event as MessageEvent);
      }
    });
  }
  source.onopen = () => {
    if (stream === source) for (const item of [...subscriptions]) item.listener.open?.();
  };
  source.onerror = () => {
    if (stream === source) for (const item of [...subscriptions]) item.listener.error?.();
  };
}

export function subscribeDesktopEvents(channel: DesktopEventChannel, listener: Listener): () => void {
  const item = { channel, listener };
  const previous = stream;
  subscriptions.add(item);
  reconcile();
  const source = stream;
  if (source === previous && source?.readyState === EventSource.OPEN) {
    queueMicrotask(() => { if (stream === source && subscriptions.has(item)) listener.open?.(); });
  }
  return () => { if (subscriptions.delete(item)) reconcile(); };
}
