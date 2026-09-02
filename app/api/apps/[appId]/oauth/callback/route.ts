import { completeOAuth } from "@/lib/app-connections";

export const dynamic = "force-dynamic";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function page(title: string, message: string, success: boolean): Response {
  const color = success ? "#23865f" : "#b3403a";
  return new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f2f6f7;color:#273137;font:14px -apple-system,BlinkMacSystemFont,sans-serif}.card{width:min(420px,calc(100vw - 48px));padding:36px;border:1px solid #dfe7e9;border-radius:20px;background:#fff;box-shadow:0 18px 60px #58707c22;text-align:center}.dot{width:42px;height:42px;margin:auto;border-radius:50%;display:grid;place-items:center;color:#fff;background:${color};font-size:22px}h1{margin:18px 0 8px;font-size:22px}p{margin:0;color:#657279;line-height:1.6}</style><div class="card"><div class="dot">${success ? "✓" : "!"}</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><p>现在可以关闭此页面并返回 Agent OS。</p></div><script>setTimeout(()=>window.close(),1800)</script></html>`, { status: success ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function GET(request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  if (appId !== "notion" && appId !== "google") return page("授权失败", "未知应用。", false);
  try {
    return page("授权完成", await completeOAuth(appId, new URL(request.url).searchParams), true);
  } catch (error) {
    return page("授权失败", error instanceof Error ? error.message : String(error), false);
  }
}
