import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { getCompanyCareersStatus, removeCompanyCareersConnection, restoreCompanyCareersDemoConnection, saveCompanyCareersConnection } from "@/lib/company-careers";
import { cancelCompanyCareersInsight, scheduleCompanyCareersInsight } from "@/lib/company-careers-demo-insight";
import { getAllowedFileRoots, isExistingFilePathAllowed, isFilePathAllowed } from "@/lib/file-access";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await getCompanyCareersStatus());
}

export async function POST(request: Request) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasJsonContentType(request)) return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  try {
    const body = await request.json() as { baseUrl?: unknown; token?: unknown; cwd?: unknown; useSavedDemo?: unknown };
    const cwd = typeof body.cwd === "string" ? body.cwd.trim() : "";
    const allowedRoots = await getAllowedFileRoots();
    if (!cwd || !existsSync(cwd) || !isFilePathAllowed(cwd, allowedRoots) || !isExistingFilePathAllowed(cwd, allowedRoots)) {
      return NextResponse.json({ error: "当前工作台不可用" }, { status: 400 });
    }
    const status = body.useSavedDemo === true
      ? await restoreCompanyCareersDemoConnection()
      : typeof body.baseUrl === "string" && typeof body.token === "string"
        ? await saveCompanyCareersConnection({ baseUrl: body.baseUrl, token: body.token })
        : null;
    if (!status) {
      return NextResponse.json({ error: "baseUrl 和 token 均为必填项" }, { status: 400 });
    }
    scheduleCompanyCareersInsight(cwd);
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const cwd = new URL(request.url).searchParams.get("cwd")?.trim();
  cancelCompanyCareersInsight(cwd || undefined);
  await removeCompanyCareersConnection();
  return NextResponse.json({ removed: true });
}
