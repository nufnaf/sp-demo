import { readProgress, advancePresentation } from "@/lib/presentation-progress";
import { presentationRoot } from "@/lib/presentation-runtime";
import { isApiRequestAllowed, hasJsonContentType } from "@/lib/request-security";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!isApiRequestAllowed(request) || !presentationRoot()) return Response.json({}, { status: 403 });
  return Response.json(await readProgress());
}
export async function POST(request: Request) {
  if (!isApiRequestAllowed(request) || !hasJsonContentType(request) || !presentationRoot()) return Response.json({}, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!["insight", "meeting"].includes(body?.action)) return Response.json({}, { status: 400 });
  try { return Response.json(await advancePresentation(body.action)); }
  catch (e) { return Response.json({ error: e instanceof Error ? e.message : "无法更新工作台" }, { status: 409 }); }
}
