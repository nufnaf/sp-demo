import { hasJsonContentType } from "@/lib/request-security";
import { assertTerminalRequestAllowed, resolveTerminalCwd, terminalErrorResponse } from "@/lib/terminal/api";
import { getTerminalManager } from "@/lib/terminal/manager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertTerminalRequestAllowed(request);
    if (!hasJsonContentType(request)) return Response.json({ error: "Content-Type must be application/json" }, { status: 415 });
    const body = await request.json() as { cwd?: unknown; cols?: unknown; rows?: unknown; reuse?: unknown };
    const cwd = await resolveTerminalCwd(body.cwd);
    const manager = getTerminalManager();
    const terminal = (body.reuse === true ? manager.ensure.bind(manager) : manager.create.bind(manager))(cwd, {
      ...(typeof body.cols === "number" ? { cols: body.cols } : {}),
      ...(typeof body.rows === "number" ? { rows: body.rows } : {}),
    });
    return Response.json({ terminal }, { status: 201 });
  } catch (error) {
    return terminalErrorResponse(error);
  }
}
