import { NextResponse } from "next/server";
import { buildPiCatalogUrl, parsePiPackageCatalog } from "@/lib/app-store-catalog";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 10 * 60 * 1_000;
const cache = new Map<string, { expiresAt: number; html: string }>();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Math.min(200, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1));
  const catalogUrl = buildPiCatalogUrl({
    name: searchParams.get("name") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    page,
  });

  try {
    const cached = cache.get(catalogUrl);
    let html = cached && cached.expiresAt > Date.now() ? cached.html : undefined;
    if (!html) {
      const response = await fetch(catalogUrl, {
        headers: { Accept: "text/html", "User-Agent": "Pi-Web-App-Store/1.0" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error(`Pi catalog returned ${response.status}`);
      html = await response.text();
      cache.set(catalogUrl, { html, expiresAt: Date.now() + CACHE_TTL_MS });
    }
    return NextResponse.json(parsePiPackageCatalog(html, page));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
