import { createHash, randomUUID } from "node:crypto";
import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { promisify } from "node:util";
import { feishuCommand, feishuEnvironment } from "./feishu-paths";

const execFileAsync = promisify(execFile);


export interface FeishuCliStatus {
  installed: boolean;
  configured: boolean;
  version?: string;
  authState: "authenticated" | "not_authenticated" | "unknown";
  authDetail: string;
  account?: string;
  identity?: string;
  authorization?: { flow: FeishuAuthFlow; result: FeishuLoginResult };
}

export interface FeishuAuthFlow {
  flowId?: string;
  kind: "configuration" | "permission" | "login";
  verificationUrl: string;
}

export interface FeishuDocument {
  id: string;
  title: string;
  type: string;
  url?: string;
  summary?: string;
  modifiedAt?: string;
}

export interface FeishuDocumentsResult {
  items: FeishuDocument[];
  hasMore: boolean;
  mode: "recent" | "search";
  query: string;
}

export interface FeishuDocumentActivity {
  kind: "opened" | "edited";
  document: FeishuDocument;
  occurredAt: string;
}

export class FeishuDocumentsError extends Error {
  constructor(
    message: string,
    readonly kind: "not_authenticated" | "missing_scope" | "cli_error",
    readonly consoleUrl?: string,
  ) {
    super(message);
    this.name = "FeishuDocumentsError";
  }
}

export interface FeishuLoginResult { state: "pending" | "succeeded" | "failed" | "expired"; message?: string; missingScopes?: string[] }
interface PendingLogin { deviceCode: string; controller: AbortController; completion?: Promise<void>; flow: FeishuAuthFlow; result: FeishuLoginResult; createdAt: number }
interface FeishuRuntimeState {
  configurationProcess: ChildProcessWithoutNullStreams | null;
  configurationFlow: Promise<FeishuAuthFlow> | null;
  pendingLogins: Map<string, PendingLogin>;
}

const runtimeGlobal = globalThis as typeof globalThis & { __piFeishuRuntime?: FeishuRuntimeState };
const runtime = runtimeGlobal.__piFeishuRuntime ??= { configurationProcess: null, configurationFlow: null, pendingLogins: new Map() };

function compactOutput(value: string): string {
  return value.replace(/\x1b\[[0-9;?>=!]*[a-zA-Z]/g, "").replace(/\s+/g, " ").trim().slice(0, 500);
}

function parseJson(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}

function deepValue(value: unknown, keys: string[]): unknown {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of keys) if (record[key] !== undefined) return record[key];
  for (const child of Object.values(record)) {
    const found = deepValue(child, keys);
    if (found !== undefined) return found;
  }
  return undefined;
}

function deepString(value: unknown, keys: string[]): string | undefined {
  const found = deepValue(value, keys);
  return typeof found === "string" && found.trim() ? found : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function directString(value: unknown, keys: string[]): string | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return undefined;
}

function cleanSearchText(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const clean = value
    .replace(/<\/?(?:h|hb)>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return clean || undefined;
}

const larkCommand = feishuCommand;

export async function runLarkCli(args: string[], timeout = 12_000, cwd?: string, signal?: AbortSignal): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(larkCommand(), args, { timeout, cwd, signal, maxBuffer: 8 * 1024 * 1024, env: feishuEnvironment(), shell: process.platform === "win32", windowsHide: true });
}

function commandFailure(error: unknown): { output: string; json: Record<string, unknown> | null } {
  const failure = error as { stdout?: string; stderr?: string; message?: string };
  const output = failure.stdout || failure.stderr || failure.message || "";
  return { output, json: parseJson(failure.stderr || failure.stdout || "") };
}

export async function getFeishuCliStatus(verify = true): Promise<FeishuCliStatus> {
  let version = "";
  try {
    const result = await runLarkCli(["--version"], 5_000);
    version = compactOutput(result.stdout || result.stderr);
    if (!/\b1\.0\.95\b/.test(version)) return { installed: false, configured: false, authState: "unknown", authDetail: "飞书连接组件版本不匹配，请更新完整 App。" };
  } catch {
    return { installed: false, configured: false, authState: "unknown", authDetail: "尚未安装飞书 CLI。" };
  }

  try {
    const result = await runLarkCli(["auth", "status", "--json", ...(verify ? ["--verify"] : [])]);
    const body = parseJson(result.stdout);
    const identities = asRecord(body?.identities);
    const user = asRecord(identities?.user);
    const userStatus = directString(user, ["tokenStatus", "token_status", "status"]);
    const account = directString(user, ["userName", "user_name"]);
    const authenticated = verify ? user?.verified === true && user.available === true : user?.available === true && /^(valid|needs_refresh|ready)$/.test(userStatus ?? "");
    const uncertain = verify && directString(user, ["status"]) === "verify_failed";
    const openId = directString(user, ["openId"]);
    const appId = directString(body, ["appId"]);
    return {
      installed: true, configured: true, version: version || undefined,
      authState: authenticated ? "authenticated" : uncertain ? "unknown" : "not_authenticated",
      authDetail: authenticated ? "飞书账号已连接。" : uncertain ? "暂时无法验证飞书连接，请检查网络后重试，或重新授权。" : "请连接自己的飞书账号。",
      account,
      identity: authenticated && appId && openId ? createHash("sha256").update(`${appId}:${openId}`).digest("hex") : undefined,
    };
  } catch (error) {
    const failure = commandFailure(error);
    const subtype = deepString(failure.json, ["subtype"]);
    const notConfigured = subtype === "not_configured" || /not configured|config init/i.test(failure.output);
    return {
      installed: true, configured: !notConfigured, version: version || undefined,
      authState: notConfigured ? "not_authenticated" : "unknown",
      authDetail: notConfigured ? "请连接自己的飞书账号。" : "暂时无法验证飞书连接，请检查网络后重试。",
    };
  }
}

export async function installFeishuCli(): Promise<FeishuCliStatus> {
  throw new Error("飞书连接组件缺失，请重新安装完整的 Syntropic App。");
}

function extractVerificationUrl(output: string): string | undefined {
  const clean = output.replace(/\x1b\[[0-9;?>=!]*[a-zA-Z]/g, "");
  for (const line of clean.split(/\r?\n/)) {
    const url = deepString(parseJson(line.trim()), ["verification_url", "verification_uri_complete", "verification_uri", "console_url"]);
    if (url) return url;
  }
  return clean.match(/https?:\/\/[^\s"'<>]+/)?.[0];
}

/** Only official Feishu/Lark https links may be handed to the system browser. */
function browserUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const official = ["feishu.cn", "larksuite.com"].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
    return url.protocol === "https:" && !url.username && !url.password && official ? url.href : undefined;
  } catch { return undefined; }
}

function waitForConfigurationUrl(process: ChildProcessWithoutNullStreams): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = "";
    let settled = false;
    const timer = setTimeout(() => { process.kill(); fail(new Error("等待飞书应用配置地址超时，请重试。")); }, 30_000);
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };
    const inspect = (chunk: Buffer) => {
      output += chunk.toString("utf8");
      const url = browserUrl(extractVerificationUrl(output));
      if (url && !settled) {
        settled = true;
        clearTimeout(timer);
        resolve(url);
      }
    };
    process.stdout.on("data", inspect);
    process.stderr.on("data", inspect);
    process.once("error", fail);
    process.once("exit", (code) => fail(new Error(`飞书应用配置进程已退出（${code ?? "unknown"}），请重试。`)));
  });
}

export function startFeishuConfiguration(): Promise<FeishuAuthFlow> {
  if (runtime.configurationFlow) return runtime.configurationFlow;
  const child = spawn(larkCommand(), ["config", "init", "--new", "--brand", "feishu", "--lang", "zh_cn"], {
    env: feishuEnvironment(), shell: process.platform === "win32", windowsHide: true,
  });
  runtime.configurationProcess = child;
  child.once("exit", () => { if (runtime.configurationProcess === child) { runtime.configurationProcess = null; runtime.configurationFlow = null; } });
  runtime.configurationFlow = waitForConfigurationUrl(child).then(async (verificationUrl) => ({
    kind: "configuration" as const, verificationUrl,
  })).catch(error => { cancelFeishuConfiguration(); throw error; });
  return runtime.configurationFlow;
}

/** All business domains are requested, so the browser can show one complete permission page. */
export async function startFeishuLogin(): Promise<FeishuAuthFlow> {
  cancelFeishuConfiguration();
  let result: { stdout: string; stderr: string };
  try {
    result = await runLarkCli(["auth", "login", "--domain", "all", "--no-wait", "--json"], 20_000);
  } catch (error) {
    const failure = commandFailure(error);
    const consoleUrl = browserUrl(deepString(failure.json, ["console_url"]));
    if (consoleUrl) return { kind: "permission", verificationUrl: consoleUrl };
    throw new Error("无法发起飞书授权，请检查网络或应用权限后重试。");
  }
  const body = parseJson(result.stdout);
  const verificationUrl = browserUrl(deepString(body, ["verification_url", "verification_uri_complete", "verification_uri"]));
  const deviceCode = deepString(body, ["device_code"]);
  if (!verificationUrl || !deviceCode) throw new Error("飞书 CLI 没有返回有效的授权地址，请重试。");
  const flowId = randomUUID();
  const flow: FeishuAuthFlow = { flowId, kind: "login", verificationUrl };
  runtime.pendingLogins.set(flowId, { deviceCode, controller: new AbortController(), flow, result: { state: "pending" }, createdAt: Date.now() });
  return flow;
}

function documentError(error: unknown): FeishuDocumentsError {
  const failure = commandFailure(error);
  const subtype = deepString(failure.json, ["subtype"]);
  const consoleUrl = deepString(failure.json, ["console_url"]);
  const missingScopes = deepValue(failure.json, ["missing_scopes"]);
  if (subtype === "token_missing" || subtype === "not_authenticated") {
    return new FeishuDocumentsError("请先连接飞书账号，再查看云文档。", "not_authenticated");
  }
  if (subtype === "missing_scope" || subtype === "app_scope_not_applied" || Array.isArray(missingScopes)) {
    return new FeishuDocumentsError("需要启用云文档搜索权限后重新授权。", "missing_scope", consoleUrl);
  }
  return new FeishuDocumentsError("读取飞书云文档失败，请检查连接与授权后重试。", "cli_error");
}

function searchResults(value: unknown): unknown[] {
  const record = asRecord(value);
  if (!record) return [];
  if (Array.isArray(record.results)) return record.results;
  if (record.data) return searchResults(record.data);
  return [];
}

function timestampIso(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const numeric = Number(value);
  const date = Number.isFinite(numeric)
    ? new Date(numeric < 10_000_000_000 ? numeric * 1_000 : numeric)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function mapFeishuDocument(raw: unknown, index: number): FeishuDocument {
  const item = asRecord(raw) ?? {};
  const meta = asRecord(item.result_meta) ?? {};
  const url = directString(item, ["url", "document_url", "wiki_url"]) ?? directString(meta, ["url", "document_url", "wiki_url"]);
  const token = directString(item, ["token", "document_id", "doc_token", "wiki_token"]) ?? directString(meta, ["token", "document_id", "doc_token", "wiki_token"]);
  const type = (directString(item, ["doc_type", "type", "file_type"]) ?? directString(meta, ["doc_types", "doc_type", "file_type"]) ?? directString(item, ["entity_type"]) ?? "docx").toLowerCase();
  return {
    id: token ?? url ?? `${type}-${index}`,
    title: cleanSearchText(directString(item, ["title", "title_highlighted", "name"])) ?? "未命名文档",
    type,
    url: url && /^https?:\/\//i.test(url) ? url : undefined,
    summary: cleanSearchText(directString(item, ["summary", "summary_highlighted", "description"])),
    modifiedAt: directString(item, ["edit_time_iso", "modified_time_iso", "open_time_iso", "edit_time", "modified_time"])
      ?? directString(meta, ["last_open_time_iso", "update_time_iso", "edit_time_iso", "modified_time_iso", "last_open_time", "update_time"]),
  };
}

export async function getFeishuDocuments(query = ""): Promise<FeishuDocumentsResult> {
  const normalizedQuery = [...query.trim()].slice(0, 30).join("");
  const args = [
    "drive", "+search", "--query", normalizedQuery,
    "--doc-types", "doc,docx,wiki,sheet,bitable,slides,mindnote",
    "--page-size", "20", "--as", "user", "--format", "json",
  ];
  if (normalizedQuery) args.push("--sort", "edit_time");
  else args.push("--opened-since", "90d", "--sort", "open_time");

  let body: Record<string, unknown> | null;
  try {
    const result = await runLarkCli(args, 25_000);
    body = parseJson(result.stdout);
    if (!body || body.ok === false) throw Object.assign(new Error("Invalid Feishu CLI response"), { stdout: result.stdout });
  } catch (error) {
    throw documentError(error);
  }

  const items = searchResults(body).map(mapFeishuDocument);
  const data = asRecord(body.data) ?? body;
  return {
    items,
    hasMore: data.has_more === true,
    mode: normalizedQuery ? "search" : "recent",
    query: normalizedQuery,
  };
}

export async function getFeishuDocumentActivities(kind: "opened" | "edited"): Promise<FeishuDocumentActivity[]> {
  const args = [
    "drive", "+search", "--query", "",
    "--doc-types", "doc,docx,wiki,sheet,bitable,slides,mindnote",
    "--page-size", "20", "--as", "user", "--format", "json",
    kind === "opened" ? "--opened-since" : "--edited-since", "1d",
    "--sort", kind === "opened" ? "open_time" : "edit_time",
  ];
  let body: Record<string, unknown> | null;
  try {
    const result = await runLarkCli(args, 25_000);
    body = parseJson(result.stdout);
    if (!body || body.ok === false) throw Object.assign(new Error("Invalid Feishu CLI response"), { stdout: result.stdout });
  } catch (error) {
    throw documentError(error);
  }

  return searchResults(body).flatMap((raw, index) => {
    const item = asRecord(raw) ?? {};
    const meta = asRecord(item.result_meta) ?? {};
    const rawTime = kind === "opened"
      ? directString(item, ["open_time_iso", "last_open_time_iso", "open_time", "last_open_time"])
        ?? directString(meta, ["last_open_time_iso", "open_time_iso", "last_open_time", "open_time"])
      : directString(item, ["my_edit_time_iso", "edit_time_iso", "my_edit_time", "edit_time"])
        ?? directString(meta, ["my_edit_time_iso", "edit_time_iso", "update_time_iso", "my_edit_time", "edit_time", "update_time"]);
    const occurredAt = timestampIso(rawTime);
    return occurredAt ? [{ kind, document: mapFeishuDocument(raw, index), occurredAt }] : [];
  });
}

export function getFeishuLoginResult(flowId: string): FeishuLoginResult {
  const pending = runtime.pendingLogins.get(flowId);
  if (!pending) return { state: "expired", message: "授权流程已失效，请重新连接。" };
  if (pending.result.state === "pending" && Date.now() - pending.createdAt > 10 * 60_000) {
    pending.result = { state: "expired", message: "授权已超时，请重新连接。" };
    pending.controller.abort();
  }
  return pending.result;
}
export function activeFeishuAuthorization(): FeishuCliStatus["authorization"] {
  const entry = [...runtime.pendingLogins.entries()].at(-1);
  return entry ? { flow: entry[1].flow, result: getFeishuLoginResult(entry[0]) } : undefined;
}
export function assertFeishuAuthorizationComplete(): void {
  const auth = activeFeishuAuthorization();
  if (auth && auth.result.state !== "succeeded") throw new Error(auth.result.message || "请先在浏览器中完成本次飞书授权。");
}
/** v1.0.95 saves the new token and emits this event even when optional scopes
 * were declined. In that case it exits with ExitAuth (3), not zero. Never use
 * auth status here: it might describe a token from an earlier login. */
function completedAuthorization(stdout: string): FeishuLoginResult | undefined {
  const body = parseJson(stdout);
  if (body?.event !== "authorization_complete" || !directString(body, ["user_open_id"]) ||
      !Array.isArray(body.granted) || !body.granted.every(scope => typeof scope === "string") ||
      !Array.isArray(body.missing) || !body.missing.every(scope => typeof scope === "string")) return;
  return { state: "succeeded", ...(body.missing.length ? { missingScopes: body.missing as string[] } : {}) };
}
export function completeFeishuLogin(flowId: string): void {
  const pending = runtime.pendingLogins.get(flowId);
  if (!pending) throw new Error("授权流程已过期，请重新连接飞书。");
  if (pending.completion || getFeishuLoginResult(flowId).state !== "pending") return;
  pending.completion = runLarkCli(["auth", "login", "--device-code", pending.deviceCode, "--json"], 10 * 60_000, undefined, pending.controller.signal)
    .then(result => {
      if (!pending.controller.signal.aborted) pending.result = completedAuthorization(result.stdout) ?? {
        state: "failed", message: "未能确认本次飞书授权结果，请重新连接。",
      };
    }, error => {
      if (pending.controller.signal.aborted) return;
      const command = error as { code?: number; stdout?: string };
      const completed = command.code === 3 ? completedAuthorization(command.stdout ?? "") : undefined;
      if (completed) { pending.result = completed; return; }
      const failure = commandFailure(error);
      const missing = deepString(failure.json, ["subtype"]) === "missing_scope" || /missing.scope|not.granted|未授予|未授权/i.test(failure.output);
      pending.result = { state: "failed", message: missing
        ? "飞书尚未完成账号授权，请检查页面上的权限提示后重试。"
        : "本次飞书授权未完成或已被取消，请重新授权。" };
    });
}

export function cancelFeishuConfiguration(): void {
  for (const pending of runtime.pendingLogins.values()) pending.controller.abort();
  runtime.pendingLogins.clear();
  runtime.configurationProcess?.kill();
  runtime.configurationProcess = null;
  runtime.configurationFlow = null;
}
