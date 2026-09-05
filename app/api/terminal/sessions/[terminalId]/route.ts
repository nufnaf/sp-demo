import { hasJsonContentType } from "@/lib/request-security";
import { assertTerminalRequestAllowed, resolveTerminalCwd, terminalErrorResponse } from "@/lib/terminal/api";
import { getTerminalManager } from "@/lib/terminal/manager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface TerminalCommandBody {
  cwd?: unknown;
  type?: unknown;
  data?: unknown;
  cols?: unknown;
  rows?: unknown;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ terminalId: string }> },
) {
  try {
    assertTerminalRequestAllowed(request);
    if (!hasJsonContentType(request)) return Response.json({ error: "Content-Type must be application/json" }, { status: 415 });
    const body = await request.json() as TerminalCommandBody;
    const cwd = await resolveTerminalCwd(body.cwd);
    const { terminalId } = await params;
    const manager = getTerminalManager();
    if (body.type === "input" && typeof body.data === "string") {
      if (Buffer.byteLength(body.data) > 64 * 1024) return Response.json({ error: "Terminal input is too large" }, { status: 413 });
      return Response.json({ terminal: manager.write(terminalId, cwd, body.data) });
    }
    if (body.type === "resize" && typeof body.cols === "number" && typeof body.rows === "number") {
      return Response.json({ terminal: manager.resize(terminalId, cwd, body.cols, body.rows) });
    }
    if (body.type === "restart") {
      return Response.json({ terminal: manager.restart(terminalId, cwd) });
    }
    return Response.json({ error: "Invalid terminal command" }, { status: 400 });
  } catch (error) {
    return terminalErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ terminalId: string }> },
) {
  try {
    assertTerminalRequestAllowed(request);
    if (!hasJsonContentType(request)) return Response.json({ error: "Content-Type must be application/json" }, { status: 415 });
    const body = await request.json() as { cwd?: unknown };
    const cwd = await resolveTerminalCwd(body.cwd);
    const { terminalId } = await params;
    getTerminalManager().close(terminalId, cwd);
    return Response.json({ success: true });
  } catch (error) {
    return terminalErrorResponse(error);
  }
}
