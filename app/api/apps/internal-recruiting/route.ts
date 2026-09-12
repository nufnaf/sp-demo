import { NextResponse } from "next/server";
import { recruitingSiteUrl } from "@/lib/browser/business-sites";
import { presentationRoot } from "@/lib/presentation-runtime";
import { readProgress } from "@/lib/presentation-progress";
import { readRecruitingSnapshot } from "@/lib/recruiting-snapshot";

export const dynamic = "force-dynamic";

// This read-only bridge feeds the native recruiting result window. Agents
// publish through the website; there is intentionally no write method here.
export async function GET() {
  try {
    const base = recruitingSiteUrl();
    const data = presentationRoot()
      ? (await readProgress()).recruiting ?? { jobs: [], scene: null }
      : await readRecruitingSnapshot();
    return NextResponse.json({ baseUrl: base.href, ...data });
  } catch {
    return NextResponse.json({ error: "暂时无法读取内部招聘系统，请确认网站已启动。" }, { status: 502 });
  }
}
