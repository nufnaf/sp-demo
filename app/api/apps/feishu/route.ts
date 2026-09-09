import { presentationRoot } from "@/lib/presentation-runtime";
import { getFeishuDemoClient } from "@/lib/feishu-demo-client";
import { NextResponse } from "next/server";
import { completeFeishuLogin, getFeishuCliStatus, installFeishuCli, startFeishuConfiguration, startFeishuLogin } from "@/lib/feishu-cli";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (presentationRoot()) {
    try { await getFeishuDemoClient(); return NextResponse.json({ installed: true, authState: "authenticated", authDetail: "团队资料已连接", account: "星流科技", mode: "application" }); }
    catch { return NextResponse.json({ installed: true, authState: "not_authenticated", authDetail: "请联系管理员连接飞书", mode: "application" }); }
  }
  return NextResponse.json(await getFeishuCliStatus());
}

export async function POST(request: Request) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasJsonContentType(request)) return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  if (presentationRoot()) return NextResponse.json({ error: "团队资料的连接由管理员管理。" }, { status: 409 });
  try {
    const body = await request.json() as { action?: unknown; flowId?: unknown };
    if (body.action === "install") return NextResponse.json(await installFeishuCli());
    if (body.action === "configure") return NextResponse.json(await startFeishuConfiguration());
    if (body.action === "login") return NextResponse.json(await startFeishuLogin());
    if (body.action === "complete_login" && typeof body.flowId === "string") {
      completeFeishuLogin(body.flowId);
      return NextResponse.json({ started: true });
    }
    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
