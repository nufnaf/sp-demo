import { NextResponse } from "next/server";
import { recruitingSiteUrl } from "@/lib/browser/business-sites";
import type { PublishedRecruitingJob } from "@/lib/recruiting-publication";

export const dynamic = "force-dynamic";

// This read-only bridge feeds the native recruiting result window. Agents
// publish through the website; there is intentionally no write method here.
export async function GET() {
  try {
    const base = recruitingSiteUrl();
    const response = await fetch(new URL("/desktop/published-jobs", base), {
      cache: "no-store", signal: AbortSignal.timeout(5000), redirect: "error",
    });
    if (!response.ok) throw new Error("内部招聘系统暂时不可用");
    const data = await response.json() as { app?: string; scene?: unknown; jobs?: Omit<PublishedRecruitingJob, "url">[] };
    if (data.app !== "syntropic-recruiting" || !Array.isArray(data.jobs)) throw new Error("内部招聘系统版本不支持发布结果展示");
    return NextResponse.json({ baseUrl: base.href, scene: data.scene ?? null, jobs: data.jobs.map((job) => ({ ...job, url: new URL(`/jobs/${encodeURIComponent(job.id)}`, base).href })) });
  } catch {
    return NextResponse.json({ error: "暂时无法读取内部招聘系统，请确认网站已启动。" }, { status: 502 });
  }
}
