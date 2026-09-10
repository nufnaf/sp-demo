import { getFeishuDemoClient } from "@/lib/feishu-demo-client";
import { resetPresentationCalendar } from "@/lib/feishu-calendar-reset";
import { presentationRoot } from "@/lib/presentation-runtime";
import { isApiRequestAllowed } from "@/lib/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isApiRequestAllowed(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const root = presentationRoot();
  if (!root) return Response.json({ error: "此操作仅适用于桌面工作台。" }, { status: 404 });
  try {
    await resetPresentationCalendar(root, (await getFeishuDemoClient()).calendar());
    return Response.json({ ready: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "无法同步团队日程，请重试。" }, { status: 503 });
  }
}
