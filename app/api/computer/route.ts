import { computerRuntime } from "@/lib/computer/runtime";
import { computerRequestAllowed } from "@/lib/computer/request";
import { hasJsonContentType } from "@/lib/request-security";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!computerRequestAllowed(request)) return Response.json({}, { status: 403 });
  return Response.json(computerRuntime().snapshot(), { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  if (!computerRequestAllowed(request) || !hasJsonContentType(request)) return Response.json({}, { status: 403 });
  const body = await request.json().catch(() => null);
  if (body?.action === "warmup") { computerRuntime().warmup(); return Response.json({ accepted: true }); }
  if (!["pause", "resume", "stop", "reconnect"].includes(body?.action)) return Response.json({}, { status: 400 });
  computerRuntime().control(body.action);
  return Response.json({ accepted: true });
}
