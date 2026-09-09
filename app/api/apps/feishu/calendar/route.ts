import { getFeishuDemoClient, FeishuDemoError } from "@/lib/feishu-demo-client";
import { calendarRange } from "@/lib/calendar-view";
import { isApiRequestAllowed } from "@/lib/request-security";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!isApiRequestAllowed(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const date = new URL(request.url).searchParams.get("date") ?? undefined;
  if (date !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) return Response.json({ error: "无效的日程日期" }, { status: 400 });
  try {
    const range = calendarRange(date);
    const calendar = (await getFeishuDemoClient()).calendar();
    return Response.json({ events: await calendar.events(range.start, range.end), date: range.date, fetchedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "飞书日程暂时不可用" }, { status: error instanceof FeishuDemoError && error.kind === "configuration" ? 503 : 502 });
  }
}
