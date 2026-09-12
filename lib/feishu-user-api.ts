import { runLarkCli, getFeishuCliStatus } from "./feishu-cli";

export class FeishuUserError extends Error {
  constructor(message: string, readonly uncertain = false, readonly requiresAuthorization = false) { super(message); }
}
function failureForSubtype(subtype: string): FeishuUserError {
  const requiresAuthorization = ["missing_scope", "app_scope_not_applied", "token_missing", "token_invalid", "token_expired", "refresh_token_expired", "refresh_token_revoked", "user_unauthorized", "token_scope_insufficient", "not_authenticated"].includes(subtype);
  const rejected = requiresAuthorization || ["permission_denied", "invalid_argument", "confirmation_required"].includes(subtype);
  return new FeishuUserError(requiresAuthorization ? "飞书授权不完整，请重新授权后继续。" : "飞书请求未完成，请检查网络或工作资料的访问权限后重试。", !rejected, requiresAuthorization);
}
export function cliData(stdout: string): Record<string, unknown> {
  const body = JSON.parse(stdout) as Record<string, unknown>;
  if (body.ok === false || (typeof body.code === "number" && body.code !== 0)) {
    const error = body.error && typeof body.error === "object" ? body.error as Record<string, unknown> : body;
    const subtype = typeof error.subtype === "string" ? error.subtype : "";
    throw failureForSubtype(subtype);
  }
  const data = body.data ?? body;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new FeishuUserError("飞书返回的数据不完整。");
  return data as Record<string, unknown>;
}
export async function userCommand(identity: string, args: string[]): Promise<Record<string, unknown>> {
  const status = await getFeishuCliStatus(false);
  if (!identity || status.identity !== identity) throw new FeishuUserError("飞书账号已变化或授权已失效，请退出并重新打开 App。");
  try { return cliData((await runLarkCli([...args, "--as", "user", "--format", "json"], 60_000)).stdout); }
  catch (error) {
    if (error instanceof FeishuUserError) throw error;
    const result = error as { stdout?: string; stderr?: string };
    // A CLI structured failure is safe to retry only when the command rejected it
    // before network I/O. Never expose upstream output (may contain credentials).
    let subtype = "";
    try { subtype = JSON.parse(result.stdout || result.stderr || "").error?.subtype ?? ""; } catch { /* transport failure */ }
    throw failureForSubtype(subtype);
  }
}
/** Fixed operation adapter; never accepts a caller-supplied CLI command or host. */
export function userRequest(identity: string) {
  return async (path: string, init?: RequestInit): Promise<Record<string, unknown>> => {
    const url = new URL(path, "https://open.feishu.cn");
    if (url.origin !== "https://open.feishu.cn") throw new Error("无效的飞书请求。");
    const method = init?.method ?? "GET";
    const params: Record<string, string> = Object.fromEntries(url.searchParams);
    let args: string[];
    const calendar = url.pathname.match(/^\/calendar\/v4\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/);
    if (calendar) {
      params.calendar_id = decodeURIComponent(calendar[1]);
      if (calendar[2] && calendar[2] !== "instance_view") params.event_id = decodeURIComponent(calendar[2]);
      const operation = method === "DELETE" ? "delete" : method === "POST" ? "create" : calendar[2] === "instance_view" ? "instance_view" : calendar[2] ? "get" : "list";
      args = operation === "list" ? ["api", "GET", `/open-apis${url.pathname}`] : ["calendar", "events", operation];
      if (operation === "list") delete params.calendar_id;
      // Only the reset code calls DELETE, after matching owned event markers.
    } else if (url.pathname === "/drive/v1/files" && method === "GET") {
      args = ["drive", "files", "list"];
    } else if (url.pathname === "/wiki/v2/spaces/get_node" && method === "GET") {
      args = ["wiki", "spaces", "get_node"];
    } else if (/^\/docx\/v1\/documents\/[^/]+\/raw_content$/.test(url.pathname) && method === "GET") {
      args = ["api", method, `/open-apis${url.pathname}`];
    } else throw new Error("此飞书操作不在工作台支持范围内。");
    if (Object.keys(params).length) args.push("--params", JSON.stringify(params));
    if (init?.body) args.push("--data", String(init.body));
    return userCommand(identity, args);
  };
}
