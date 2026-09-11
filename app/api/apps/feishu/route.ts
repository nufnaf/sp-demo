import { presentationRoot } from "@/lib/presentation-runtime";
import { readJson, saveJson } from "@/lib/feishu-workspace";
import { feishuHome } from "@/lib/feishu-paths";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { activeFeishuAuthorization, getFeishuLoginResult, cancelFeishuConfiguration, completeFeishuLogin, getFeishuCliStatus, installFeishuCli, startFeishuConfiguration, startFeishuLogin } from "@/lib/feishu-cli";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ ...await getFeishuCliStatus(), authorization: activeFeishuAuthorization() });
}

export async function POST(request: Request) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasJsonContentType(request)) return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });

  try {
    const body = await request.json() as { action?: unknown; flowId?: unknown };
    const root = presentationRoot();
    if (root && ["configure", "login", "install"].includes(String(body.action))) {
      const binding = await readJson<{ ready: boolean }>(join(root, "feishu-account.json"));
      if (binding?.ready) return NextResponse.json({ error: "更换账号需要退出并重新打开 App。" }, { status: 409 });
    }
    if (["configure", "login"].includes(String(body.action))) {
      await mkdir(feishuHome(), { recursive: true, mode: 0o700 });
      await saveJson(join(feishuHome(), "consent.json"), { accepted: true });
    }
    if (body.action === "login_status" && typeof body.flowId === "string") return NextResponse.json(getFeishuLoginResult(body.flowId));
    if (body.action === "cancel") { cancelFeishuConfiguration(); return NextResponse.json({ cancelled: true }); }
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
