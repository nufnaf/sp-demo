import { computerRuntime, computerAvailable } from "@/lib/computer/runtime";
import { computerRequestAllowed } from "@/lib/computer/request";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!computerRequestAllowed(request)) return Response.json({}, { status: 403 });
  const frames = new URL(request.url).searchParams.get("frames") === "1";
  if (frames && !computerAvailable()) return Response.json({ error: "电脑操作暂不可用" }, { status: 409 });
  let release = () => {};
  let heartbeat: ReturnType<typeof setInterval>;
  let ended = false;
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      cleanup = () => { if (ended) return; ended = true; release(); clearInterval(heartbeat); request.signal.removeEventListener("abort", cleanup); try { controller.close(); } catch { /* already closed */ } };
      const send = (event: string, data: unknown) => {
        if (ended || (controller.desiredSize ?? 0) <= 0) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try { release = frames ? computerRuntime().subscribeFrames(frame => send("frame", frame)) : computerRuntime().subscribeStatus(state => send("status", state)); }
      catch { send("frame", { error: "无法连接飞书画面，请检查客户端与权限。" }); cleanup(); return; }
      heartbeat = setInterval(() => send(frames ? "heartbeat" : "status", frames ? {} : computerRuntime().snapshot()), 1500);
      request.signal.addEventListener("abort", cleanup, { once: true });
      if (request.signal.aborted) cleanup();
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", "X-Accel-Buffering": "no", Connection: "keep-alive" } });
}
