import { activeFeishuAuthorization, assertFeishuAuthorizationComplete } from "@/lib/feishu-cli";
import { FeishuUserError } from "@/lib/feishu-user-api";
import { workspaceClient } from "@/lib/feishu-demo-client";
import { resetPresentationCalendar } from "@/lib/feishu-calendar-reset";
import { presentationRoot } from "@/lib/presentation-runtime";
import { isApiRequestAllowed } from "@/lib/request-security";
import { ensurePersonalWorkspace, readJson, saveJson } from "@/lib/feishu-workspace";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
declare global { var __feishuStartup: Promise<void> | undefined }
export async function POST(request: Request) {
  if (!isApiRequestAllowed(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const root = presentationRoot();
  if (!root) return Response.json({ error: "此操作仅适用于桌面工作台。" }, { status: 404 });
  try {
    assertFeishuAuthorizationComplete();
    const active = globalThis.__feishuStartup ??= (async () => {
      const state = await ensurePersonalWorkspace();
      const file = join(root, "feishu-account.json");
      const binding = await readJson<{ identity: string; ready: boolean }>(file);
      if (binding && binding.identity !== state.identity) throw new Error("飞书账号已变化，请退出并重新打开 App。");
      if (binding?.ready) return;
      await saveJson(file, { identity: state.identity, ready: false });
      await resetPresentationCalendar(root, workspaceClient(state).calendar());
      await saveJson(file, { identity: state.identity, ready: true });
    })();
    try { await active; } finally { if (globalThis.__feishuStartup === active) globalThis.__feishuStartup = undefined; }
    return Response.json({ ready: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const authorization = activeFeishuAuthorization();
    const requiresAuthorization = Boolean(authorization && authorization.result.state !== "succeeded") || (error instanceof FeishuUserError && error.requiresAuthorization);
    return Response.json({ error: error instanceof Error ? error.message : "无法同步团队日程，请重试。", requiresAuthorization }, { status: 503 });
  }
}
