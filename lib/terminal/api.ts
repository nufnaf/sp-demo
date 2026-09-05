import { realpathSync } from "node:fs";
import { getAllowedFileRoots, isExistingFilePathAllowed } from "../file-access";
import { isApiRequestAllowed } from "../request-security";
import { isTerminalHostAllowed } from "./security";

export class TerminalApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export function assertTerminalRequestAllowed(request: Request): void {
  if (!isApiRequestAllowed(request)) throw new TerminalApiError("Untrusted API request", 403);
  if (!isTerminalHostAllowed(request)) {
    throw new TerminalApiError(
      "Remote terminal access is disabled. Use localhost or explicitly set PI_WEB_ENABLE_REMOTE_TERMINAL=1.",
      403,
    );
  }
}

export async function resolveTerminalCwd(value: unknown): Promise<string> {
  if (typeof value !== "string" || !value.trim()) throw new TerminalApiError("cwd is required", 400);
  let cwd: string;
  try {
    cwd = realpathSync(value);
  } catch {
    throw new TerminalApiError("Workspace does not exist", 400);
  }
  if (!isExistingFilePathAllowed(cwd, await getAllowedFileRoots())) {
    throw new TerminalApiError("Workspace access denied", 403);
  }
  return cwd;
}

export function terminalErrorResponse(error: unknown): Response {
  const status = error instanceof TerminalApiError ? error.status : 500;
  return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status });
}
