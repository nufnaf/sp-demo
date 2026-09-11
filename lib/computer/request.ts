import { isApiRequestAllowed } from "../request-security";
export function computerRequestAllowed(request: Request) {
  if (!isApiRequestAllowed(request)) return false;
  try { return ["127.0.0.1", "localhost", "[::1]"].includes(new URL(`http://${request.headers.get("host")}`).hostname); }
  catch { return false; }
}
