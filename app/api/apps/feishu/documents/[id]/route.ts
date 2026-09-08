import { getFeishuDemoClient, FeishuDemoError } from "@/lib/feishu-demo-client";
import { presentationRoot } from "@/lib/presentation-runtime";
import { isApiRequestAllowed } from "@/lib/request-security";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isApiRequestAllowed(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!presentationRoot()) return Response.json({ error: "专用演示读取未启用" }, { status: 404 });
  try { return Response.json(await (await getFeishuDemoClient()).read((await context.params).id)); }
  catch (error) { return Response.json({ error: error instanceof FeishuDemoError ? error.message : "飞书读取失败" }, { status: 502 }); }
}
