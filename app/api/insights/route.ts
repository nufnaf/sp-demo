import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { ensureInsightEngine, getInsightEngineSnapshot, recordFeishuDocumentOpened } from "@/lib/insight-engine";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const cwd = new URL(request.url).searchParams.get("cwd")?.trim() ?? "";
  if (!cwd || !existsSync(cwd)) return NextResponse.json({ error: "cwd is required" }, { status: 400 });
  ensureInsightEngine(cwd);
  return NextResponse.json(getInsightEngineSnapshot(cwd), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasJsonContentType(request)) return NextResponse.json({ error: "Expected JSON" }, { status: 415 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const cwd = typeof body?.cwd === "string" ? body.cwd.trim() : "";
  const activity = body?.activity;
  const rawDocument = body?.document && typeof body.document === "object" && !Array.isArray(body.document)
    ? body.document as Record<string, unknown>
    : null;
  if (!cwd || !existsSync(cwd) || activity !== "document.opened" || !rawDocument) {
    return NextResponse.json({ error: "Invalid insight activity" }, { status: 400 });
  }
  const id = typeof rawDocument.id === "string" ? rawDocument.id.slice(0, 500) : "";
  const title = typeof rawDocument.title === "string" ? rawDocument.title.slice(0, 500) : "";
  const type = typeof rawDocument.type === "string" ? rawDocument.type.slice(0, 50) : "docx";
  if (!id || !title) return NextResponse.json({ error: "Invalid document" }, { status: 400 });
  ensureInsightEngine(cwd);
  recordFeishuDocumentOpened(cwd, {
    id,
    title,
    type,
    summary: typeof rawDocument.summary === "string" ? rawDocument.summary.slice(0, 2_000) : undefined,
    modifiedAt: typeof rawDocument.modifiedAt === "string" ? rawDocument.modifiedAt.slice(0, 100) : undefined,
  });
  return NextResponse.json({ ok: true });
}
