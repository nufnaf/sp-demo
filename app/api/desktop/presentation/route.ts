import { readFile } from "node:fs/promises";
import { presentationStatePath } from "@/lib/presentation";

export const dynamic = "force-dynamic";
export async function GET() {
  const path = presentationStatePath("run.json");
  if (!path) return Response.json({});
  return Response.json(JSON.parse(await readFile(path, "utf8")), { headers: { "Cache-Control": "no-store" } });
}
