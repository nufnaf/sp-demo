import { NextRequest, NextResponse } from "next/server";
import { getBrowserManager } from "@/lib/browser/manager";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> },
) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Untrusted API request" }, { status: 403 });
  if (!hasJsonContentType(request)) return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  const { pageId } = await params;
  try {
    const body = await request.json() as Record<string, unknown>;
    const manager = getBrowserManager();
    if (body.type === "navigate") {
      const action = body.action === "back" || body.action === "forward" || body.action === "reload" ? body.action : undefined;
      const page = await manager.navigate(pageId, {
        ...(typeof body.url === "string" ? { url: body.url } : {}),
        ...(action ? { action } : {}),
      });
      return NextResponse.json({ page });
    }
    if (body.type === "resize" && typeof body.width === "number" && typeof body.height === "number") {
      const page = await manager.resize(pageId, body.width, body.height);
      return NextResponse.json({ page });
    }
    if (body.type === "input") {
      const action = body.action;
      const page = action === "coordinate_click" && typeof body.x === "number" && typeof body.y === "number"
        ? await manager.userInput(pageId, { action, x: body.x, y: body.y })
        : action === "scroll" && typeof body.deltaY === "number"
          ? await manager.userInput(pageId, { action, deltaY: body.deltaY, ...(typeof body.deltaX === "number" ? { deltaX: body.deltaX } : {}) })
          : action === "insert_text" && typeof body.text === "string" && body.text.length > 0
            ? await manager.userInput(pageId, { action, text: body.text })
          : action === "press" && typeof body.key === "string"
            ? await manager.userInput(pageId, { action, key: body.key })
            : null;
      if (!page) return NextResponse.json({ error: "Invalid browser input" }, { status: 400 });
      return NextResponse.json({ page });
    }
    if (body.type === "close") {
      await manager.close(pageId);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Invalid browser command" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
