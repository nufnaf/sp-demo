import { getFeishuDemoClient, FeishuDemoError } from "@/lib/feishu-demo-client";
import { presentationRoot } from "@/lib/presentation-runtime";
import { isApiRequestAllowed } from "@/lib/request-security";
import { readJson } from "@/lib/feishu-workspace";
import { join } from "node:path";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isApiRequestAllowed(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!presentationRoot()) return Response.json({ error: "当前工作台无法访问此文档" }, { status: 404 });
  try { return Response.json(await (await getFeishuDemoClient()).read((await context.params).id)); }
  catch (error) {
    const message = error instanceof Error ? error.message : "飞书读取失败";
    if (message.includes("请先完成飞书资料准备") || message.includes("飞书账号已变化")) {
      const binding = await readJson<{ ready?: boolean }>(join(presentationRoot()!, "feishu-account.json"));
      if (!binding?.ready) return Response.json({ error: "正在准备飞书资料，请稍候。", kind: "preparing" }, { status: 503 });
      if (message.includes("飞书账号已变化")) return Response.json({ error: message, kind: "account_changed" }, { status: 409 });
    }
    return Response.json({ error: error instanceof FeishuDemoError ? error.message : message }, { status: 502 });
  }
}
