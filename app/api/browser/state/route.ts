import { NextResponse } from "next/server";
import { getBrowserManager } from "@/lib/browser/manager";
import { listBrowserTasks } from "@/lib/browser/tasks";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const cwd = new URL(request.url).searchParams.get("cwd") ?? undefined;
    const pages = await getBrowserManager().list(cwd);
    return NextResponse.json({ pages, tasks: listBrowserTasks(cwd) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
