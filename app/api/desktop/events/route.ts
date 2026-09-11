import { getBrowserManager } from "@/lib/browser/manager";
import { subscribeToFileEvents } from "@/lib/files-app/events";
import { computerRuntime, computerAvailable } from "@/lib/computer/runtime";
import { computerRequestAllowed } from "@/lib/computer/request";
import { isApiRequestAllowed } from "@/lib/request-security";
import { desktopEventsStream } from "@/lib/desktop-events-stream";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!isApiRequestAllowed(request)) return Response.json({}, { status: 403 });
  if (request.signal.aborted) return new Response(null, { status: 204 });
  const frames = new URL(request.url).searchParams.get("frames") === "1";
  const local = computerRequestAllowed(request);
  if (frames && !local) return Response.json({}, { status: 403 });
  if (frames && !computerAvailable()) return Response.json({ error: "电脑操作暂不可用" }, { status: 409 });
  const unavailable = { available: false, phase: "idle", detail: "请在本机使用电脑操作", steps: 0 };
  const runtime = local ? computerRuntime() : null;
  const stream = desktopEventsStream(request.signal, {
    browser: send => getBrowserManager().subscribe(send),
    file: subscribeToFileEvents,
    status: send => { if (runtime) return runtime.subscribeStatus(send); send(unavailable); return () => {}; },
    snapshot: () => runtime?.snapshot() ?? unavailable,
    frames: frames && runtime ? send => runtime.subscribeFrames(send) : undefined,
  });
  return new Response(stream, { headers: {
    "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform",
    "X-Accel-Buffering": "no", Connection: "keep-alive",
  } });
}
