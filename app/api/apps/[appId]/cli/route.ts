import { NextResponse } from "next/server";
import {
  cancelCollaborationLogin,
  getCollaborationCliStatus,
  installCollaborationCli,
  isCollaborationCliId,
  startCollaborationLogin,
  verifyCollaborationLogin,
} from "@/lib/collaboration-cli";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";

export const dynamic = "force-dynamic";

function resolveAppId(value: string) {
  if (!isCollaborationCliId(value)) throw new Error("此应用不支持 CLI OAuth 授权");
  return value;
}

export async function GET(request: Request, context: { params: Promise<{ appId: string }> }) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { appId } = await context.params;
    return NextResponse.json(await getCollaborationCliStatus(resolveAppId(appId)));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ appId: string }> }) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasJsonContentType(request)) return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  try {
    const { appId: rawAppId } = await context.params;
    const appId = resolveAppId(rawAppId);
    const body = await request.json() as { action?: unknown; flowId?: unknown };
    if (body.action === "install") return NextResponse.json(await installCollaborationCli(appId));
    if (body.action === "login") return NextResponse.json(await startCollaborationLogin(appId));
    if (body.action === "verify") return NextResponse.json(await verifyCollaborationLogin(appId));
    if (body.action === "cancel" && typeof body.flowId === "string") {
      return NextResponse.json({ cancelled: cancelCollaborationLogin(body.flowId, appId) });
    }
    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
