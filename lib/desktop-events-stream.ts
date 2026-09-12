type Send = (value: unknown) => void;
type Subscribe = (send: Send) => () => void;
export function desktopEventsStream(signal: AbortSignal, sources: {
  browser: Subscribe; file: Subscribe; status: Subscribe; snapshot: () => unknown; frames?: Subscribe;
}) {
  let cleanup = () => {};
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const releases: (() => void)[] = [];
      let ended = false;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      cleanup = () => {
        if (ended) return;
        ended = true;
        clearInterval(heartbeat);
        signal.removeEventListener("abort", cleanup);
        for (const release of releases) release();
        try { controller.close(); } catch { /* Already cancelled. */ }
      };
      const send = (channel: string, data: unknown) => {
        if (ended) return;
        // Video may drop a frame; task state must still arrive.
        if (channel === "computer-frame" && (controller.desiredSize ?? 0) <= 0) return;
        controller.enqueue(encoder.encode(`event: ${channel}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const attach = (subscribe: Subscribe, channel: string) => {
        const release = subscribe(value => send(channel, value));
        if (ended) release(); else releases.push(release);
      };
      signal.addEventListener("abort", cleanup, { once: true });
      if (signal.aborted) { cleanup(); return; }
      try {
        send("browser", { type: "browser.ready" });
        send("file", { type: "file.ready" });
        attach(sources.browser, "browser");
        attach(sources.file, "file");
        attach(sources.status, "computer-status");
        if (sources.frames) attach(sources.frames, "computer-frame");
        if (!ended) heartbeat = setInterval(() => send("computer-status", sources.snapshot()), 1500);
      } catch { cleanup(); }
    },
    cancel() { cleanup(); },
  });
}
