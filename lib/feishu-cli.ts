import { randomUUID } from "node:crypto";
import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { runNpm, runNpx } from "./npx";

const execFileAsync = promisify(execFile);
const LARK_ENV = { ...process.env, LARKSUITE_CLI_NO_UPDATE_NOTIFIER: "1", LARKSUITE_CLI_NO_SKILLS_NOTIFIER: "1" };

export interface FeishuCliStatus {
  installed: boolean;
  configured: boolean;
  version?: string;
  authState: "authenticated" | "not_authenticated" | "unknown";
  authDetail: string;
  account?: string;
}

export interface FeishuAuthFlow {
  flowId?: string;
  kind: "configuration" | "permission" | "login";
  verificationUrl: string;
  qrCodeDataUrl: string;
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

interface PendingLogin { deviceCode: string; completion?: Promise<void> }
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

function larkCommand(): string { return process.platform === "win32" ? "lark-cli.cmd" : "lark-cli"; }

async function runLarkCli(args: string[], timeout = 12_000, cwd?: string): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(larkCommand(), args, { timeout, cwd, env: LARK_ENV, shell: process.platform === "win32", windowsHide: true });
}

function commandFailure(error: unknown): { output: string; json: Record<string, unknown> | null } {
  const failure = error as { stdout?: string; stderr?: string; message?: string };
  const output = failure.stdout || failure.stderr || failure.message || "";
  return { output, json: parseJson(failure.stderr || failure.stdout || "") };
}

export async function getFeishuCliStatus(): Promise<FeishuCliStatus> {
  let version = "";
  try {
    const result = await runLarkCli(["--version"], 5_000);
    version = compactOutput(result.stdout || result.stderr);
  } catch {
    return { installed: false, configured: false, authState: "unknown", authDetail: "尚未安装飞书 CLI。" };
  }

  try {
    const result = await runLarkCli(["auth", "status", "--json", "--verify"]);
    const body = parseJson(result.stdout);
    const identities = asRecord(body?.identities);
    const user = asRecord(identities?.user);
    const userStatus = directString(user, ["tokenStatus", "token_status", "status"]);
    const account = directString(user, ["userName", "user_name"]);
    const authenticated = user?.verified === true && user.available !== false
      || /^(valid|active|authenticated|logged[_ -]?in|ready)$/i.test(userStatus ?? "") && user?.available !== false;
    return {
      installed: true, configured: true, version: version || undefined,
      authState: authenticated ? "authenticated" : "not_authenticated",
      authDetail: authenticated ? "飞书用户身份已验证，可直接使用内置 CLI 能力。" : "应用配置已完成，请扫码登录飞书账号。",
      account,
    };
  } catch (error) {
    const failure = commandFailure(error);
    const subtype = deepString(failure.json, ["subtype"]);
    const notConfigured = subtype === "not_configured" || /not configured|config init/i.test(failure.output);
    return {
      installed: true, configured: !notConfigured, version: version || undefined,
      authState: notConfigured ? "unknown" : "not_authenticated",
      authDetail: notConfigured ? "需要先创建或绑定飞书应用。" : "应用已配置，请扫码登录飞书账号。",
    };
  }
}

let installation: Promise<FeishuCliStatus> | null = null;
export function installFeishuCli(): Promise<FeishuCliStatus> {
  if (installation) return installation;
  installation = (async () => {
    await runNpm(["install", "--global", "@larksuite/cli"], { timeout: 3 * 60_000 });
    await runNpx(["-y", "skills", "add", "https://open.feishu.cn", "--skill", "-y"], { timeout: 3 * 60_000 });
    return getFeishuCliStatus();
  })().finally(() => { installation = null; });
  return installation;
}

async function generateQrCode(url: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "pi-web-feishu-qr-"));
  const fileName = "qrcode.png";
  try {
    await runLarkCli(["auth", "qrcode", url, "--output", fileName, "--size", "320"], 15_000, directory);
    const image = await readFile(join(directory, fileName));
    return `data:image/png;base64,${image.toString("base64")}`;
  } finally { await rm(directory, { recursive: true, force: true }); }
}

function extractVerificationUrl(output: string): string | undefined {
  const clean = output.replace(/\x1b\[[0-9;?>=!]*[a-zA-Z]/g, "");
  for (const line of clean.split(/\r?\n/)) {
    const url = deepString(parseJson(line.trim()), ["verification_url", "verification_uri_complete", "verification_uri", "console_url"]);
    if (url) return url;
  }
  return clean.match(/https?:\/\/[^\s"'<>]+/)?.[0];
}

function waitForConfigurationUrl(process: ChildProcessWithoutNullStreams): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = "";
    let settled = false;
    const timer = setTimeout(() => fail(new Error("等待飞书配置二维码超时，请重试。")), 20_000);
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };
    const inspect = (chunk: Buffer) => {
      output += chunk.toString("utf8");
      const url = extractVerificationUrl(output);
      if (url && !settled) {
        settled = true;
        clearTimeout(timer);
        resolve(url);
      }
    };
    process.stdout.on("data", inspect);
    process.stderr.on("data", inspect);
    process.once("error", fail);
    process.once("exit", (code) => fail(new Error(compactOutput(output) || `飞书应用配置进程已退出（${code ?? "unknown"}）`)));
  });
}

export function startFeishuConfiguration(): Promise<FeishuAuthFlow> {
  if (runtime.configurationFlow) return runtime.configurationFlow;
  const child = spawn(larkCommand(), ["config", "init", "--new", "--brand", "feishu", "--lang", "zh_cn"], {
    env: LARK_ENV, shell: process.platform === "win32", windowsHide: true,
  });
  runtime.configurationProcess = child;
  child.once("exit", () => { runtime.configurationProcess = null; runtime.configurationFlow = null; });
  runtime.configurationFlow = waitForConfigurationUrl(child).then(async (verificationUrl) => ({
    kind: "configuration" as const, verificationUrl, qrCodeDataUrl: await generateQrCode(verificationUrl),
  }));
  return runtime.configurationFlow;
}

export async function startFeishuLogin(): Promise<FeishuAuthFlow> {
  let result: { stdout: string; stderr: string };
  try {
    result = await runLarkCli(["auth", "login", "--recommend", "--scope", "search:docs:read", "--no-wait", "--json"], 20_000);
  } catch (error) {
    const failure = commandFailure(error);
    const consoleUrl = deepString(failure.json, ["console_url"]);
    if (consoleUrl) return { kind: "permission", verificationUrl: consoleUrl, qrCodeDataUrl: await generateQrCode(consoleUrl) };
    throw new Error(compactOutput(failure.output) || "无法发起飞书授权，请重试。");
  }
  const body = parseJson(result.stdout);
  const verificationUrl = deepString(body, ["verification_url", "verification_uri_complete", "verification_uri"]);
  const deviceCode = deepString(body, ["device_code"]);
  if (!verificationUrl || !deviceCode) throw new Error("飞书 CLI 没有返回有效的授权地址，请重试。");
  const flowId = randomUUID();
  runtime.pendingLogins.set(flowId, { deviceCode });
  return { flowId, kind: "login", verificationUrl, qrCodeDataUrl: await generateQrCode(verificationUrl) };
}

function documentError(error: unknown): FeishuDocumentsError {
  const failure = commandFailure(error);
  const subtype = deepString(failure.json, ["subtype"]);
  const consoleUrl = deepString(failure.json, ["console_url"]);
  const missingScopes = deepValue(failure.json, ["missing_scopes"]);
  if (subtype === "token_missing" || subtype === "not_authenticated") {
    return new FeishuDocumentsError("请先扫码登录飞书账号，再查看云文档。", "not_authenticated");
  }
  if (subtype === "missing_scope" || subtype === "app_scope_not_applied" || Array.isArray(missingScopes)) {
    return new FeishuDocumentsError("需要启用云文档搜索权限后重新授权。", "missing_scope", consoleUrl);
  }
  return new FeishuDocumentsError(compactOutput(failure.output) || "读取飞书云文档失败，请稍后重试。", "cli_error");
}

function searchResults(value: unknown): unknown[] {
  const record = asRecord(value);
  if (!record) return [];
  if (Array.isArray(record.results)) return record.results;
  if (record.data) return searchResults(record.data);
  return [];
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

  const items = searchResults(body).map((raw, index): FeishuDocument => {
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
  });
  const data = asRecord(body.data) ?? body;
  return {
    items,
    hasMore: data.has_more === true,
    mode: normalizedQuery ? "search" : "recent",
    query: normalizedQuery,
  };
}

export function completeFeishuLogin(flowId: string): void {
  const pending = runtime.pendingLogins.get(flowId);
  if (!pending) throw new Error("授权流程已过期，请重新扫码。");
  if (pending.completion) return;
  pending.completion = runLarkCli(["auth", "login", "--device-code", pending.deviceCode], 10 * 60_000)
    .then(() => undefined, () => undefined)
    .finally(() => runtime.pendingLogins.delete(flowId));
}
