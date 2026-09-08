import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Public, non-secret identity. Prevents attaching the desktop to another checkout
// merely because it happens to occupy the development port.
export function GET() {
  return Response.json({
    app: "syntropic-local",
    presentationRun: process.env.SYNTROPIC_PRESENTATION_RUN,
    checkoutId: createHash("sha256").update(realpathSync(process.cwd())).digest("hex"),
  }, { headers: { "Cache-Control": "no-store" } });
}
