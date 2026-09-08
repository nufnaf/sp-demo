import { getFeishuDemoClient } from "@/lib/feishu-demo-client";
import { presentationRoot } from "@/lib/presentation-runtime";
import { NextResponse } from "next/server";
import { FeishuDocumentsError, getFeishuDocuments } from "@/lib/feishu-cli";
import { isApiRequestAllowed } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if ([...query].length > 30) return NextResponse.json({ error: "搜索关键词最多 30 个字符。" }, { status: 400 });
  try {
    if (presentationRoot()) return NextResponse.json({ items: await (await getFeishuDemoClient()).documents(query), mode: query ? "search" : "recent", hasMore: false });
    return NextResponse.json(await getFeishuDocuments(query));
  } catch (error) {
    if (error instanceof FeishuDocumentsError) {
      const status = error.kind === "not_authenticated" ? 401 : error.kind === "missing_scope" ? 403 : 502;
      return NextResponse.json({ error: error.message, kind: error.kind, consoleUrl: error.consoleUrl }, { status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
