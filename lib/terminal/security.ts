import { isIP } from "node:net";

function isLoopback(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (normalized === "localhost" || normalized.endsWith(".localhost") || normalized === "::1") return true;
  if (isIP(normalized) === 4) return normalized.startsWith("127.");
  return false;
}

export function isRemoteTerminalEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  return /^(?:1|true|yes)$/i.test(environment.PI_WEB_ENABLE_REMOTE_TERMINAL?.trim() ?? "");
}

export function isTerminalHostAllowed(request: Request, environment: NodeJS.ProcessEnv = process.env): boolean {
  if (isRemoteTerminalEnabled(environment)) return true;
  try {
    const host = request.headers.get("host");
    const hostname = host ? new URL(`http://${host}`).hostname : new URL(request.url).hostname;
    return isLoopback(hostname);
  } catch {
    return false;
  }
}
