import { getCompanyCareersData } from "@/lib/company-careers";
import { renderCompanyCareersInsightHtml } from "@/lib/company-careers-insight-html";
import { isApiRequestAllowed } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isApiRequestAllowed(request)) return new Response("Forbidden", { status: 403 });
  try {
    const html = renderCompanyCareersInsightHtml(await getCompanyCareersData());
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Failed to render company careers insight", error);
    return new Response("<!doctype html><html lang=\"zh-CN\"><meta charset=\"utf-8\"><title>洞察生成失败</title><body><h1>洞察生成失败</h1><p>暂时无法读取招聘官网数据，请稍后重试。</p></body></html>", { status: 502, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}
