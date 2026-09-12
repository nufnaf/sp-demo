import { currentWorkspace } from "@/lib/feishu-workspace";
import { getFeishuDemoClient } from "@/lib/feishu-demo-client";
import { presentationRoot } from "@/lib/presentation-runtime";
import { NextResponse } from "next/server";
import { FeishuDocumentsError, getFeishuDocuments } from "@/lib/feishu-cli";
import { isApiRequestAllowed } from "@/lib/request-security";
import { readJson } from "@/lib/feishu-workspace";
import { join } from "node:path";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if ([...query].length > 30) return NextResponse.json({ error: "搜索关键词最多 30 个字符。" }, { status: 400 });
  try {
    if (presentationRoot()) {
      const workspace = await currentWorkspace();
      return NextResponse.json({ items: await (await getFeishuDemoClient()).documents(query), identity: workspace.identity, account: workspace.account, mode: query ? "search" : "recent", hasMore: false });
    }
    return NextResponse.json(await getFeishuDocuments(query));
  } catch (error) {
    if (error instanceof FeishuDocumentsError) {
      const status = error.kind === "not_authenticated" ? 401 : error.kind === "missing_scope" ? 403 : 502;
      return NextResponse.json({ error: error.message, kind: error.kind, consoleUrl: error.consoleUrl }, { status });
    }
    const message = error instanceof Error ? error.message : String(error);
    if (presentationRoot() && (message.includes("请先完成飞书资料准备") || message.includes("飞书账号已变化"))) {
      const binding = await readJson<{ ready?: boolean }>(join(presentationRoot()!, "feishu-account.json"));
      if (!binding?.ready) return NextResponse.json({ error: "正在准备飞书资料，请稍候。", kind: "preparing" }, { status: 503 });
      if (message.includes("飞书账号已变化")) return NextResponse.json({ error: message, kind: "account_changed" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
