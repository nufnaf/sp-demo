import { NextResponse } from "next/server";
import { connectApp, disconnectApp, getAppConnectionStatus, isConnectedAppId } from "@/lib/app-connections";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";

export const dynamic = "force-dynamic";

function invalidApp() {
  return NextResponse.json({ error: "未知应用" }, { status: 404 });
}

export async function GET(request: Request, context: { params: Promise<{ appId: string }> }) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { appId } = await context.params;
  if (!isConnectedAppId(appId)) return invalidApp();
  try {
    return NextResponse.json(await getAppConnectionStatus(appId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ appId: string }> }) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasJsonContentType(request)) return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  const { appId } = await context.params;
  if (!isConnectedAppId(appId)) return invalidApp();
  try {
    const body = await request.json() as Record<string, unknown>;
    return NextResponse.json(await connectApp(appId, body, new URL(request.url).origin));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ appId: string }> }) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasJsonContentType(request)) return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  const { appId } = await context.params;
  if (!isConnectedAppId(appId)) return invalidApp();
  try {
    return NextResponse.json(await disconnectApp(appId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
