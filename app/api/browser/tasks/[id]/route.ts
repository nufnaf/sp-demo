import { stopBrowserTask } from "@/lib/browser/tasks";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isApiRequestAllowed(request)) return Response.json({ error: "Untrusted API request" }, { status: 403 });
  if (!hasJsonContentType(request)) return Response.json({ error: "Content-Type must be application/json" }, { status: 415 });
  try {
    const body = await request.json();
    if (body.action !== "stop") return Response.json({ error: "Only stop is supported" }, { status: 400 });
    const { id } = await params;
    return Response.json({ task: await stopBrowserTask(id) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
