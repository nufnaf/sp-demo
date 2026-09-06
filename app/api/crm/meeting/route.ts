import { createHash } from "node:crypto";
import { dirname, basename, resolve } from "node:path";
import { NextResponse } from "next/server";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";
import { listInsightResults } from "@/lib/insight-event-store";
import { readCrmState } from "@/lib/crm-store";
import { companyCrmDemoReport } from "@/lib/company-crm-demo-report";
import { crmMeetingProposal } from "@/lib/company-crm-meeting";
import { createLocalCalendarEvent } from "@/lib/local-calendar";

declare global { var __piCrmMeetingLocks: Map<string, Promise<unknown>> | undefined }
export async function POST(request: Request) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasJsonContentType(request)) return NextResponse.json({ error: "Expected JSON" }, { status: 415 });
  try {
    const body = await request.json();
    if (typeof body.filePath !== "string" || !["preview", "confirm"].includes(body.action)) throw new Error("无效的会议请求");
    const filePath = resolve(body.filePath);
    const cwd = dirname(dirname(dirname(filePath)));
    if (!/^crm-payment-blocker-[\w-]+\.html$/.test(basename(filePath)) || !listInsightResults(cwd).some((row) => row.filePath === filePath && row.sessionId.startsWith("company-crm-demo:"))) throw new Error("此报告未注册或已不可用");
    const source = readCrmState(cwd).sources.find((row) => row.id === "company-crm");
    if (!source || !companyCrmDemoReport(source)) throw new Error("当前数据已不再符合回款阻塞案例，请刷新洞察");
    const meeting = crmMeetingProposal(source);
    if (body.action === "preview") return NextResponse.json({ meeting, revision: source.remoteRevision });
    if (body.revision !== source.remoteRevision) throw new Error("CRM 数据已更新，请重新打开报告确认会议内容");
    const startsAt = new Date(body.startsAt);
    if (typeof body.startsAt !== "string" || !Number.isFinite(startsAt.getTime()) || startsAt.getTime() <= Date.now() || startsAt.getTime() > Date.now() + 90 * 86400000) throw new Error("请选择未来 90 天内的会议时间");
    meeting.startsAt = startsAt.toISOString();
    meeting.endsAt = new Date(startsAt.getTime() + 30 * 60000).toISOString();
    const id = `crm-payment:${createHash("sha256").update(cwd).digest("hex").slice(0, 16)}:SO-26001`;
    const locks = globalThis.__piCrmMeetingLocks ??= new Map();
    const previous = locks.get(id) ?? Promise.resolve();
    const work = previous.catch(() => {}).then(() => createLocalCalendarEvent({ ...meeting, id, sourceLabel: "销售回款洞察" }));
    locks.set(id, work);
    try { return NextResponse.json({ meeting, localCalendar: await work }); }
    finally { if (locks.get(id) === work) locks.delete(id); }
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "无法安排会议" }, { status: 400 }); }
}
