import { NextResponse } from "next/server";
import { chinaAppStorePackages } from "@/lib/china-apps";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name")?.trim().toLocaleLowerCase() ?? "";
  const chinaPackages = chinaAppStorePackages().filter((item) => !name || `${item.name} ${item.description} ${item.category ?? ""} ${item.capabilities?.join(" ") ?? ""}`.toLocaleLowerCase().includes(name));
  const page = Math.max(1, Math.min(200, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1));
  return NextResponse.json({ packages: chinaPackages, total: chinaPackages.length, page, source: "agent-os", fetchedAt: new Date().toISOString() });
}
