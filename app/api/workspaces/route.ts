import { existsSync, lstatSync, rmSync, unlinkSync } from "node:fs";
import { NextResponse } from "next/server";
import { allowFileRoot } from "@/lib/file-access";
import {
  invalidateSessionListCache,
  invalidateSessionPathCache,
  listAllSessions,
} from "@/lib/session-reader";
import { getRpcSession, getRpcSessionInfos, getRunningRpcSessionIds } from "@/lib/rpc-manager";
import {
  createManagedWorkspace,
  forgetManagedWorkspace,
  isManagedWorkspacePath,
  listManagedWorkspaces,
} from "@/lib/workspaces";
import { samePath } from "@/lib/paths";

export const dynamic = "force-dynamic";

export async function GET() {
  const workspaces = listManagedWorkspaces();
  for (const workspace of workspaces) allowFileRoot(workspace.cwd);
  return NextResponse.json({ workspaces }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as { name?: unknown };
    if (body.name !== undefined && typeof body.name !== "string") {
      return NextResponse.json({ error: "name must be a string" }, { status: 400 });
    }
    const workspace = createManagedWorkspace(body.name);
    allowFileRoot(workspace.cwd);
    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json() as { cwd?: unknown };
    if (typeof body.cwd !== "string" || !body.cwd) {
      return NextResponse.json({ error: "cwd is required" }, { status: 400 });
    }
    const cwd = body.cwd;
    if (!isManagedWorkspacePath(cwd)) {
      return NextResponse.json({ error: "Only Pi Web managed workspaces can be deleted" }, { status: 403 });
    }
    if (existsSync(cwd) && lstatSync(cwd).isSymbolicLink()) {
      return NextResponse.json({ error: "Symbolic-link workspaces cannot be deleted" }, { status: 400 });
    }

    const persistedSessions = await listAllSessions({ force: true });
    const sessions = [...new Map(
      [...persistedSessions, ...getRpcSessionInfos()]
        .filter((session) => samePath(session.cwd, cwd))
        .map((session) => [session.id, session]),
    ).values()];
    const runningIds = new Set(getRunningRpcSessionIds());
    if (sessions.some((session) => runningIds.has(session.id))) {
      return NextResponse.json({ error: "请先等待此工作台中正在执行的任务完成" }, { status: 409 });
    }

    await Promise.all(sessions.map((session) => getRpcSession(session.id)?.shutdown()));
    for (const session of sessions) {
      if (session.path && existsSync(session.path)) unlinkSync(session.path);
      invalidateSessionPathCache(session.id);
    }
    if (existsSync(cwd)) rmSync(cwd, { recursive: true, force: false });
    forgetManagedWorkspace(cwd);
    invalidateSessionListCache();
    return NextResponse.json({ ok: true, deletedSessionCount: sessions.length });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
