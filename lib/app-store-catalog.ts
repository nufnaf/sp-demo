import type { AppStoreCatalogResponse, AppStorePackage, AppStorePackageType } from "./app-store-types";

const CATALOG_ORIGIN = "https://pi.dev";

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function attribute(markup: string, name: string): string {
  return decodeHtml(markup.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? "");
}

function packageTitle(packageName: string): string {
  const unscoped = packageName.split("/").at(-1) ?? packageName;
  return unscoped
    .replace(/^pi[-_]/i, "")
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || packageName;
}

function packageTypes(value: string): AppStorePackageType[] {
  const types = value.split(/\s+/).filter(Boolean) as AppStorePackageType[];
  return types.length ? types : ["package"];
}

export function parsePiPackageCatalog(html: string, page = 1): AppStoreCatalogResponse {
  const packages: AppStorePackage[] = [];
  const cards = html.matchAll(/<article\b([^>]*data-package-card="true"[^>]*)>([\s\S]*?)<\/article>/g);

  for (const match of cards) {
    const attrs = match[1];
    const body = match[2];
    const packageName = attribute(attrs, "data-package-name");
    if (!packageName) continue;
    const description = stripTags(body.match(/<p class="packages-desc">([\s\S]*?)<\/p>/)?.[1] ?? "");
    const meta = [...(body.match(/<div class="packages-meta">([\s\S]*?)<\/div>/)?.[1] ?? "").matchAll(/<span>([\s\S]*?)<\/span>/g)]
      .map((item) => stripTags(item[1]));
    const links = [...body.matchAll(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
      .map((item) => ({ url: decodeHtml(item[1]), label: stripTags(item[2]).toLowerCase() }));
    const repositoryUrl = links.find((link) => link.label === "repo")?.url;

    packages.push({
      packageName,
      source: `npm:${packageName}`,
      name: packageTitle(packageName),
      description: description || "Pi Agent 社区应用",
      author: meta[0] || "Pi Community",
      monthlyDownloads: Number(attribute(attrs, "data-package-downloads")) || 0,
      downloadsLabel: meta[1] || "—",
      updatedLabel: meta[2] || "—",
      types: packageTypes(attribute(attrs, "data-package-types")),
      catalogUrl: `${CATALOG_ORIGIN}/packages/${packageName}`,
      npmUrl: links.find((link) => link.label === "npm")?.url ?? `https://www.npmjs.com/package/${packageName}`,
      ...(repositoryUrl ? { repositoryUrl } : {}),
    });
  }

  const totalText = html.match(/class="packages-count">[^<]*\/\s*([\d,]+)/)?.[1] ?? "0";
  return {
    packages,
    total: Number(totalText.replace(/,/g, "")) || packages.length,
    page,
    source: "pi.dev",
    fetchedAt: new Date().toISOString(),
  };
}

export function buildPiCatalogUrl(input: {
  name?: string;
  type?: string;
  sort?: string;
  page?: number;
}): string {
  const url = new URL("/packages", CATALOG_ORIGIN);
  const name = input.name?.trim().slice(0, 120);
  if (name) url.searchParams.set("name", name);
  if (["extension", "skill", "prompt", "theme"].includes(input.type ?? "")) url.searchParams.set("type", input.type!);
  if (["downloads", "recent", "name"].includes(input.sort ?? "")) url.searchParams.set("sort", input.sort!);
  const page = Math.max(1, Math.min(200, Math.trunc(input.page ?? 1)));
  if (page > 1) url.searchParams.set("page", String(page));
  return url.toString();
}
