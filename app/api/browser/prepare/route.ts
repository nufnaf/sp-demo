import { NextResponse } from "next/server";
import { getBrowserManager } from "@/lib/browser/manager";
import { presentationCwd } from "@/lib/presentation-runtime";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Untrusted API request" }, { status: 403 });
  if (!hasJsonContentType(request)) return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  const cwd = presentationCwd();
  if (!cwd) return NextResponse.json({ error: "Desktop workspace required" }, { status: 404 });
  // No caller-selected path/URL, navigation, model call or browser.opened event.
  await getBrowserManager().prepareTaskBrowser(cwd);
  return NextResponse.json({ warmup: getBrowserManager().getWarmup() });
}
