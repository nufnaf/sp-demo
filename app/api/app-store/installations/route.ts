import { NextResponse } from "next/server";
import { installConnector, listInstalledConnectorIds, uninstallConnector } from "@/lib/app-installations";
import { isChinaConnectorAppId } from "@/lib/china-apps";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ installed: await listInstalledConnectorIds(), builtins: ["feishu"] });
}

async function mutate(request: Request, action: "install" | "uninstall") {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasJsonContentType(request)) return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  const body = await request.json() as { appId?: unknown };
  if (typeof body.appId !== "string" || !isChinaConnectorAppId(body.appId)) {
    return NextResponse.json({ error: "未知的中国区连接器" }, { status: 404 });
  }
  const installed = action === "install" ? await installConnector(body.appId) : await uninstallConnector(body.appId);
  return NextResponse.json({ installed, builtins: ["feishu"] });
}

export async function POST(request: Request) { return mutate(request, "install"); }
export async function DELETE(request: Request) { return mutate(request, "uninstall"); }
