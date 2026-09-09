type Listener = { message: (event: MessageEvent) => void; open?: () => void };
let stream: EventSource | null = null;
const listeners = new Set<Listener>();

// The desktop and its browser window observe the same events. Share one HTTP
// connection so open documents and Agent streams leave room for screenshots.
export function subscribeBrowserEvents(listener: Listener): () => void {
  listeners.add(listener);
  if (!stream) {
    stream = new EventSource("/api/browser/events");
    stream.onmessage = (event) => { for (const item of listeners) item.message(event); };
    stream.onopen = () => { for (const item of listeners) item.open?.(); };
  } else if (stream.readyState === EventSource.OPEN) {
    queueMicrotask(() => { if (listeners.has(listener)) listener.open?.(); });
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { stream?.close(); stream = null; }
  };
}
