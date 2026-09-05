import { assertTerminalRequestAllowed, resolveTerminalCwd, terminalErrorResponse } from "@/lib/terminal/api";
import { getTerminalManager } from "@/lib/terminal/manager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ terminalId: string }> },
) {
  try {
    assertTerminalRequestAllowed(request);
    const cwd = await resolveTerminalCwd(new URL(request.url).searchParams.get("cwd"));
    const { terminalId } = await params;
    getTerminalManager().state(terminalId, cwd);

    if (request.signal.aborted) return new Response(null, { status: 204 });
    const encoder = new TextEncoder();
    let unsubscribe = () => {};
    let keepAlive: ReturnType<typeof setInterval> | undefined;
    let closed = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (value: unknown) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
          } catch {
            closed = true;
          }
        };
        unsubscribe = getTerminalManager().subscribe(terminalId, cwd, send);
        keepAlive = setInterval(() => {
          if (closed) return;
          try { controller.enqueue(encoder.encode(": keepalive\n\n")); } catch { closed = true; }
        }, 15_000);
        request.signal.addEventListener("abort", () => {
          closed = true;
          unsubscribe();
          if (keepAlive) clearInterval(keepAlive);
          try { controller.close(); } catch { /* already closed */ }
        }, { once: true });
      },
      cancel() {
        closed = true;
        unsubscribe();
        if (keepAlive) clearInterval(keepAlive);
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return terminalErrorResponse(error);
  }
}
