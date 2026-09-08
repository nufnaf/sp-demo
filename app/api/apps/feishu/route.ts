import { presentationRoot } from "@/lib/presentation-runtime";
import { getFeishuDemoClient } from "@/lib/feishu-demo-client";
import { NextResponse } from "next/server";
import { completeFeishuLogin, getFeishuCliStatus, installFeishuCli, startFeishuConfiguration, startFeishuLogin } from "@/lib/feishu-cli";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (presentationRoot()) {
    try { await getFeishuDemoClient(); return NextResponse.json({ installed: true, authState: "authenticated", authDetail: "专用只读演示应用（读取时校验授权）", account: "星流科技演示资料", mode: "application" }); }
    catch { return NextResponse.json({ installed: true, authState: "not_authenticated", authDetail: "请管理员配置专用演示应用", mode: "application" }); }
  }
  return NextResponse.json(await getFeishuCliStatus());
}

export async function POST(request: Request) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasJsonContentType(request)) return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  if (presentationRoot()) return NextResponse.json({ error: "演示资料由管理员配置应用身份，无需用户登录。" }, { status: 409 });
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
