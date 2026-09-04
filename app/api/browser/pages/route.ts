import { NextRequest, NextResponse } from "next/server";
import { getBrowserManager } from "@/lib/browser/manager";
import { getAllowedFileRoots, isExistingFilePathAllowed } from "@/lib/file-access";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Untrusted API request" }, { status: 403 });
  if (!hasJsonContentType(request)) return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  try {
    const body = await request.json() as { cwd?: unknown; taskSessionId?: unknown; url?: unknown; foreground?: unknown };
    if (typeof body.cwd !== "string" || !body.cwd.trim()) {
      return NextResponse.json({ error: "cwd is required" }, { status: 400 });
    }
    if (!isExistingFilePathAllowed(body.cwd, await getAllowedFileRoots())) {
      return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });
    }
    const page = await getBrowserManager().open({
      cwd: body.cwd,
      ...(typeof body.taskSessionId === "string" ? { taskSessionId: body.taskSessionId } : {}),
      ...(typeof body.url === "string" ? { url: body.url } : {}),
      ...(typeof body.foreground === "boolean" ? { foreground: body.foreground } : {}),
    });
    return NextResponse.json({ page });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
