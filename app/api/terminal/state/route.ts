import { assertTerminalRequestAllowed, resolveTerminalCwd, terminalErrorResponse } from "@/lib/terminal/api";
import { getTerminalManager } from "@/lib/terminal/manager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    assertTerminalRequestAllowed(request);
    const cwd = await resolveTerminalCwd(new URL(request.url).searchParams.get("cwd"));
    return Response.json({ terminals: getTerminalManager().list(cwd) }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return terminalErrorResponse(error);
  }
}
