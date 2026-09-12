import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";
import { allowFileRoot } from "@/lib/file-access";
import { invalidateSessionListCache, resolveSessionPath } from "@/lib/session-reader";
import { getRpcSession, listJarvisTasks, setJarvisAttention, startRpcSession } from "@/lib/rpc-manager";
import { readJarvisSessionId, writeJarvisSessionId } from "@/lib/jarvis-registry";

export const dynamic = "force-dynamic";

/**
 * PUT /api/jarvis  body: { sessionId: string; busy: boolean }
 * The desktop reports whether the user is talking or Jarvis is speaking, so
 * task results wait for a pause instead of interrupting.
 */
export async function PUT(request: Request) {
  if (!isApiRequestAllowed(request)) {
    return NextResponse.json({ error: "Request is not allowed" }, { status: 403 });
  }
  if (!hasJsonContentType(request)) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }
  const body = await request.json().catch(() => ({})) as { sessionId?: unknown; busy?: unknown };
  if (typeof body.sessionId !== "string" || !body.sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }
  setJarvisAttention(body.sessionId, body.busy === true);
  return NextResponse.json({ ok: true });
}

/**
 * POST /api/jarvis  body: { cwd: string; reset?: boolean }
 * Returns the Jarvis conversation session for a working directory, creating
 * or resuming it so the event stream can connect right away.
 */
export async function POST(request: Request) {
  if (!isApiRequestAllowed(request)) {
    return NextResponse.json({ error: "Request is not allowed" }, { status: 403 });
  }
  if (!hasJsonContentType(request)) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }
  try {
    const body = await request.json() as { cwd?: unknown; reset?: unknown };
    const cwd = typeof body.cwd === "string" ? body.cwd.trim() : "";
    if (!cwd) return NextResponse.json({ error: "cwd is required" }, { status: 400 });
    if (!existsSync(cwd)) return NextResponse.json({ error: `Directory does not exist: ${cwd}` }, { status: 400 });

    const remembered = body.reset === true ? null : readJarvisSessionId(cwd);
    if (remembered) {
      const existing = getRpcSession(remembered);
      if (existing?.isAlive()) {
        return NextResponse.json({ sessionId: remembered, created: false, tasks: listJarvisTasks(remembered) });
      }
      const sessionFile = await resolveSessionPath(remembered);
      if (sessionFile && existsSync(sessionFile)) {
        await startRpcSession(remembered, sessionFile, undefined);
        return NextResponse.json({ sessionId: remembered, created: false, tasks: listJarvisTasks(remembered) });
      }
    }

    // Concurrent desktop mounts must share one creation, so both clients and
    // the registry agree on the active conversation for this workspace.
    const { realSessionId } = await startRpcSession(`__jarvis__${cwd}`, "", cwd, { role: "jarvis" });
    writeJarvisSessionId(cwd, realSessionId);
    allowFileRoot(cwd);
    invalidateSessionListCache();
    return NextResponse.json({ sessionId: realSessionId, created: true, tasks: [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
