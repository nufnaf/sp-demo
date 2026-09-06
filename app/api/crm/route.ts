import { realpathSync, statSync } from "node:fs";
import { NextResponse } from "next/server";
import { getAllowedFileRoots, isExistingFilePathAllowed } from "@/lib/file-access";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";
import { readCrmState, updateCrmState } from "@/lib/crm-store";
import { crmRecords, crmSignals, type CrmState } from "@/lib/crm";
import { enqueueCrmInsight } from "@/lib/crm-insights";
import { companyCrmStatus, connectCompanyCrm, disconnectCompanyCrm, syncCompanyCrm } from "@/lib/company-crm";

export const dynamic = "force-dynamic";
async function workspace(value: unknown): Promise<string> {
  if (typeof value !== "string" || !value.trim()) throw new Error("请先选择工作台");
  const roots = await getAllowedFileRoots();
  if (!isExistingFilePathAllowed(value, roots) || !statSync(value).isDirectory()) throw new Error("当前工作台不可用");
  return realpathSync(value);
}
function snapshot(state: CrmState) {
  const data = crmRecords(state);
  return { ...state, data, signals: crmSignals(data) };
}
export async function GET(request: Request) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const cwd = await workspace(new URL(request.url).searchParams.get("cwd"));
    return NextResponse.json({ ...snapshot(readCrmState(cwd)), companyCrm: await companyCrmStatus(cwd) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
export async function POST(request: Request) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasJsonContentType(request)) return NextResponse.json({ error: "Expected JSON" }, { status: 415 });
  try {
    const text = await request.text();
    if (text.length > 2_000_000) return NextResponse.json({ error: "文件不能超过 2 MB" }, { status: 413 });
    const body = JSON.parse(text) as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("无效请求");
    const cwd = await workspace(body.cwd);
    if (body.action === "connect-company") await connectCompanyCrm(cwd, body.baseUrl, body.token);
    else if (body.action === "sync-company") await syncCompanyCrm(cwd);
    else if (body.action === "disconnect-company" || (body.action === "disconnect" && body.sourceId === "company-crm")) await disconnectCompanyCrm(cwd);
    else {
      const state = updateCrmState(cwd, body);
      let insightWarning: string | undefined;
      try { await enqueueCrmInsight(cwd, state, String(body.action)); }
      catch { insightWarning = "数据已保存，但 AI 洞察队列暂时不可用。"; }
      return NextResponse.json({ ...snapshot(state), companyCrm: await companyCrmStatus(cwd), insightWarning });
    }
    return NextResponse.json({ ...snapshot(readCrmState(cwd)), companyCrm: await companyCrmStatus(cwd) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: message.includes("刷新后重试") ? 409 : 400 });
  }
}
