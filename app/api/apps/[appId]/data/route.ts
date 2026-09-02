import { NextResponse } from "next/server";
import { getAppData, isConnectedAppId } from "@/lib/app-connections";
import { isApiRequestAllowed } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ appId: string }> }) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { appId } = await context.params;
  if (!isConnectedAppId(appId)) return NextResponse.json({ error: "未知应用" }, { status: 404 });
  const url = new URL(request.url);
  try {
    return NextResponse.json(await getAppData(appId, url.searchParams.get("section") ?? "概览", url.searchParams.get("q") ?? ""));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
