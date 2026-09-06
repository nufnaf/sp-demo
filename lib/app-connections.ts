import { randomBytes, createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { updateStoredAuthSection } from "./provider-credential-store";
import type {
  AppConnectResponse,
  AppConnectionStatus,
  AppDataItem,
  AppDataResponse,
  ConnectedAppId,
} from "@/lib/app-connection-types";
import { CHINA_CONNECTOR_APPS, getChinaAppDefinition, isChinaConnectorAppId, type ChinaConnectorAppId } from "./china-apps";

type JsonObject = Record<string, unknown>;

interface PrivateConnections {
  github?: { token?: string; login?: string };
  slack?: { botToken?: string; userToken?: string; team?: string };
  connectors?: Partial<Record<ChinaConnectorAppId, { credentials: Record<string, string>; connectedAt: string }>>;
}

interface PendingOAuth {
  notion?: {
    state: string;
    codeVerifier: string;
    clientId: string;
    clientSecret?: string;
    redirectUri: string;
    createdAt: number;
  };
  google?: {
    state: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    createdAt: number;
  };
  wps?: {
    state: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string;
    createdAt: number;
  };
}

interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokens: {
    access_token: string;
    refresh_token?: string;
    token_type?: string;
    scope?: string;
    expiry_date?: number;
  };
}

const AGENT_DIR = getAgentDir();
const AUTH_PATH = join(AGENT_DIR, "auth.json");
const PRIVATE_PATH = join(AGENT_DIR, "app-connections.json");
const PENDING_PATH = join(AGENT_DIR, "app-oauth-pending.json");
const NOTION_PATH = join(AGENT_DIR, "notion-mcp-auth.json");
const GOOGLE_PATH = join(AGENT_DIR, "google-workspace", "oauth.json");
const NOTION_MCP_URL = "https://mcp.notion.com/mcp";
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/presentations",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/gmail.readonly",
];

const APP_SCOPES = {
  github: ["读取仓库", "读取 Pull Requests", "读取 Issues", "创建分支与 PR"],
  figma: ["读取获准访问的文件", "读取组件与变量", "导出节点图像"],
  slack: ["读取已加入频道", "读取消息与文件", "搜索（可选用户令牌）"],
  notion: ["通过 Notion 官方 MCP 访问已授权内容"],
  linear: ["读取工作区、项目和 Issues", "创建与更新 Issues"],
  google: ["Gmail（只读）", "Google Drive", "Docs", "Sheets", "Slides"],
  ...Object.fromEntries(CHINA_CONNECTOR_APPS.map((app) => [app.id, app.scopes])),
} as Record<ConnectedAppId, string[]>;

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return null;
  }
}

async function writePrivateJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomBytes(5).toString("hex")}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
  await chmod(path, 0o600);
}

async function updateAuthPath(appId: "figma" | "linear", key: "token" | "key", value?: string): Promise<void> {
  await updateStoredAuthSection(appId, value ? { [key]: value } : undefined, AUTH_PATH);
}

async function readNativeToken(appId: "figma" | "linear", key: "token" | "key", envName: string): Promise<string | null> {
  const fromEnvironment = process.env[envName]?.trim();
  if (fromEnvironment) return fromEnvironment;
  const auth = await readJson<JsonObject>(AUTH_PATH);
  const section = auth?.[appId];
  const value = isRecord(section) ? section[key] : undefined;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function readPrivateConnections(): Promise<PrivateConnections> {
  const connections = await readJson<PrivateConnections>(PRIVATE_PATH) ?? {};
  if (connections.github?.token) process.env.GH_TOKEN = connections.github.token;
  if (connections.slack?.botToken) process.env.SLACK_BOT_TOKEN = connections.slack.botToken;
  if (connections.slack?.userToken) process.env.SLACK_USER_TOKEN = connections.slack.userToken;
  return connections;
}

export async function hydrateAppConnectionEnvironment(): Promise<void> {
  const connections = await readPrivateConnections();
  for (const [appId, entry] of Object.entries(connections.connectors ?? {})) {
    for (const [key, value] of Object.entries(entry?.credentials ?? {})) {
      const envName = `AGENT_OS_${appId}_${key}`.replace(/[^a-z0-9]+/gi, "_").toUpperCase();
      process.env[envName] = value;
    }
  }
}

async function savePrivateConnections(connections: PrivateConnections): Promise<void> {
  await writePrivateJson(PRIVATE_PATH, connections);
}

async function commandExists(command: string): Promise<boolean> {
  const paths = (process.env.PATH ?? "").split(":");
  for (const path of paths) {
    try {
      await access(join(path, command), constants.X_OK);
      return true;
    } catch {
      // Continue searching PATH.
    }
  }
  return false;
}

async function fetchPayload(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  const text = await response.text();
  let body: unknown = {};
  try { body = JSON.parse(text); } catch { body = {}; }
  if (!response.ok) {
    const record = isRecord(body) ? body : {};
    const nested = isRecord(record.error) ? record.error.message : undefined;
    const message = typeof record.message === "string" ? record.message : typeof nested === "string" ? nested : `请求失败（${response.status}）`;
    throw new Error(message);
  }
  return body;
}

async function fetchJson(url: string, init?: RequestInit): Promise<JsonObject> {
  const body = await fetchPayload(url, init);
  return isRecord(body) ? body : {};
}

function status(appId: ConnectedAppId, state: AppConnectionStatus["state"], detail: string, options: Partial<AppConnectionStatus> = {}): AppConnectionStatus {
  const definition = getChinaAppDefinition(appId);
  return { appId, state, detail, authMode: appId === "notion" || appId === "google" ? "oauth" : definition?.authMode === "mcp" ? "mcp" : definition?.authMode === "openapi" ? "openapi" : "token", scopes: APP_SCOPES[appId], ...options };
}

export function isConnectedAppId(value: string): value is ConnectedAppId {
  return ["github", "figma", "slack", "notion", "linear", "google"].includes(value) || isChinaConnectorAppId(value);
}

export async function getAppConnectionStatus(appId: ConnectedAppId): Promise<AppConnectionStatus> {
  if (isChinaConnectorAppId(appId)) {
    const definition = getChinaAppDefinition(appId)!;
    const entry = (await readPrivateConnections()).connectors?.[appId];
    if (appId === "wps" && !entry) {
      const managedOAuthReady = Boolean(process.env.AGENT_OS_WPS_CLIENT_ID?.trim() && process.env.AGENT_OS_WPS_CLIENT_SECRET?.trim() && process.env.AGENT_OS_WPS_SCOPES?.trim());
      return status(appId, "disconnected", managedOAuthReady
        ? "点击继续，通过 WPS 官方页面授权。"
        : "支持 WPS OAuth；当前部署尚未配置服务商应用，也可以使用已有 Token。", { authMode: "oauth", ...(!managedOAuthReady ? { dependency: "部署管理员配置 WPS 服务商应用" } : {}) });
    }
    return entry
      ? status(appId, "connected", `已配置${definition.authMode === "mcp" ? " MCP 服务" : "开放平台凭据"}；权限由厂商与企业管理员控制。`, { account: entry.credentials.corpId ?? entry.credentials.clientId ?? entry.credentials.appKey })
      : status(appId, "disconnected", `需要连接${definition.authMode === "mcp" ? "厂商或企业 MCP 服务" : "厂商开放平台应用"}。`);
  }
  if (appId === "github") {
    const connections = await readPrivateConnections();
    if (!await commandExists("gh")) return status(appId, "setup_required", "需要先安装 GitHub CLI，Syntropic 插件才能执行 GitHub 工作流。", { dependency: "GitHub CLI（gh）" });
    return connections.github?.token
      ? status(appId, "connected", "GitHub 凭据已保存在本机，并同时提供给 Syntropic 插件。", { account: connections.github.login })
      : status(appId, "disconnected", "使用 Fine-grained Personal Access Token 连接 GitHub。", { dependency: "GitHub CLI（gh）" });
  }
  if (appId === "figma") {
    const token = await readNativeToken("figma", "token", "FIGMA_TOKEN");
    return token ? status(appId, "connected", "凭据来自本机的 figma.token 配置。") : status(appId, "disconnected", "需要具备 File content/read 权限的 Figma Personal Access Token。");
  }
  if (appId === "linear") {
    const token = await readNativeToken("linear", "key", "LINEAR_API_KEY");
    return token ? status(appId, "connected", "凭据来自本机的 linear.key 配置。") : status(appId, "disconnected", "使用 Linear Personal API Key 连接工作区。");
  }
  if (appId === "slack") {
    const connections = await readPrivateConnections();
    return connections.slack?.botToken
      ? status(appId, "connected", connections.slack.userToken ? "Bot 与搜索令牌均已配置。" : "Bot 已连接；未配置跨工作区搜索令牌。", { account: connections.slack.team })
      : status(appId, "disconnected", "Slack Plugin 需要 Bot Token；User Token 仅在需要搜索时使用。");
  }
  if (appId === "notion") {
    const config = await readJson<{ accessToken?: string }>(NOTION_PATH);
    return config?.accessToken ? status(appId, "connected", "已通过 Notion 官方 MCP OAuth 授权。") : status(appId, "disconnected", "将通过 Notion 官方 MCP OAuth 页面授权。");
  }
  const config = await readJson<GoogleConfig>(GOOGLE_PATH);
  return config?.tokens?.access_token
    ? status(appId, "connected", "Google OAuth 凭据已保存，可只读访问 Gmail 与 Workspace 文件。")
    : status(appId, "disconnected", "需要 Google Cloud OAuth Client ID 与 Client Secret。");
}

async function verifyGitHub(token: string): Promise<{ login: string }> {
  const body = await fetchJson("https://api.github.com/user", { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } });
  if (typeof body.login !== "string") throw new Error("GitHub 没有返回有效账号信息");
  return { login: body.login };
}

async function verifyFigma(token: string): Promise<{ account?: string }> {
  const body = await fetchJson("https://api.figma.com/v1/me", { headers: { "X-Figma-Token": token } });
  return { account: typeof body.handle === "string" ? body.handle : typeof body.email === "string" ? body.email : undefined };
}

async function linearGraphql(token: string, query: string, variables: JsonObject = {}): Promise<JsonObject> {
  const body = await fetchJson("https://api.linear.app/graphql", { method: "POST", headers: { Authorization: token.replace(/^Bearer\s+/i, ""), "Content-Type": "application/json" }, body: JSON.stringify({ query, variables }) });
  if (Array.isArray(body.errors) && body.errors.length) {
    const first = body.errors[0];
    throw new Error(isRecord(first) && typeof first.message === "string" ? first.message : "Linear GraphQL 请求失败");
  }
  return isRecord(body.data) ? body.data : {};
}

async function verifyLinear(token: string): Promise<{ account?: string }> {
  const body = await linearGraphql(token, "query { viewer { id name email } }");
  const viewer = isRecord(body.viewer) ? body.viewer : {};
  return { account: typeof viewer.name === "string" ? viewer.name : typeof viewer.email === "string" ? viewer.email : undefined };
}

async function slackApi(token: string, method: string, params?: URLSearchParams): Promise<JsonObject> {
  const url = `https://slack.com/api/${method}${params ? `?${params.toString()}` : ""}`;
  const body = await fetchJson(url, { headers: { Authorization: `Bearer ${token}` } });
  if (body.ok !== true) throw new Error(typeof body.error === "string" ? `Slack：${body.error}` : "Slack 请求失败");
  return body;
}

export async function connectApp(appId: ConnectedAppId, body: JsonObject, origin: string): Promise<AppConnectResponse> {
  if (isChinaConnectorAppId(appId)) {
    const definition = getChinaAppDefinition(appId)!;
    if (appId === "wps" && !(typeof body.accessToken === "string" && body.accessToken.trim())) return startWpsOAuth(origin);
    const credentials: Record<string, string> = {};
    for (const field of definition.fields) {
      const rawValue = body[field.name];
      const value = typeof rawValue === "string" ? rawValue.trim() : "";
      if (!value && !field.optional) throw new Error(`请输入${field.label}`);
      if (value) credentials[field.name] = value;
    }
    if (credentials.mcpUrl) {
      let url: URL;
      try { url = new URL(credentials.mcpUrl); } catch { throw new Error("MCP Server 地址格式不正确"); }
      if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname))) throw new Error("MCP Server 必须使用 HTTPS；本机服务可使用 HTTP");
    }
    const connections = await readPrivateConnections();
    connections.connectors ??= {};
    connections.connectors[appId] = { credentials, connectedAt: new Date().toISOString() };
    await savePrivateConnections(connections);
    await hydrateAppConnectionEnvironment();
    return { status: status(appId, "connected", `${definition.name} 授权配置已安全保存到本机。`, { account: credentials.corpId ?? credentials.clientId ?? credentials.appKey }) };
  }
  if (appId === "github") {
    if (!await commandExists("gh")) throw new Error("未找到 GitHub CLI。请先安装 gh，再返回完成授权。");
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) throw new Error("请输入 GitHub Personal Access Token");
    const { login } = await verifyGitHub(token);
    const connections = await readPrivateConnections();
    connections.github = { token, login };
    process.env.GH_TOKEN = token;
    await savePrivateConnections(connections);
    return { status: status(appId, "connected", "GitHub 已连接，凭据同时提供给 Syntropic 插件。", { account: login, dependency: "GitHub CLI（gh）" }) };
  }
  if (appId === "figma") {
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) throw new Error("请输入 Figma Personal Access Token");
    const verified = await verifyFigma(token);
    await updateAuthPath("figma", "token", token);
    return { status: status(appId, "connected", "Figma 已连接。", { account: verified.account }) };
  }
  if (appId === "linear") {
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) throw new Error("请输入 Linear Personal API Key");
    const verified = await verifyLinear(token);
    await updateAuthPath("linear", "key", token);
    return { status: status(appId, "connected", "Linear 已连接。", { account: verified.account }) };
  }
  if (appId === "slack") {
    const botToken = typeof body.botToken === "string" ? body.botToken.trim() : "";
    const userToken = typeof body.userToken === "string" ? body.userToken.trim() : "";
    if (!botToken) throw new Error("请输入 Slack Bot Token");
    const verified = await slackApi(botToken, "auth.test");
    if (userToken) await slackApi(userToken, "auth.test");
    const connections = await readPrivateConnections();
    connections.slack = { botToken, userToken: userToken || undefined, team: typeof verified.team === "string" ? verified.team : undefined };
    process.env.SLACK_BOT_TOKEN = botToken;
    if (userToken) process.env.SLACK_USER_TOKEN = userToken;
    await savePrivateConnections(connections);
    return { status: status(appId, "connected", userToken ? "Slack Bot 与搜索令牌已连接。" : "Slack Bot 已连接。", { account: connections.slack.team }) };
  }
  if (appId === "notion") return startNotionOAuth(origin);
  return startGoogleOAuth(body, origin);
}

async function readPending(): Promise<PendingOAuth> {
  return await readJson<PendingOAuth>(PENDING_PATH) ?? {};
}

async function savePending(pending: PendingOAuth): Promise<void> {
  await writePrivateJson(PENDING_PATH, pending);
}

async function startNotionOAuth(origin: string): Promise<AppConnectResponse> {
  const redirectUri = `${origin}/api/apps/notion/oauth/callback`;
  const registration = await fetchJson("https://mcp.notion.com/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ redirect_uris: [redirectUri], token_endpoint_auth_method: "client_secret_post", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], client_name: "Syntropic" }) });
  if (typeof registration.client_id !== "string") throw new Error("Notion OAuth 客户端注册失败");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const state = randomBytes(20).toString("hex");
  const pending = await readPending();
  pending.notion = { state, codeVerifier, clientId: registration.client_id, clientSecret: typeof registration.client_secret === "string" ? registration.client_secret : undefined, redirectUri, createdAt: Date.now() };
  await savePending(pending);
  const url = new URL("https://mcp.notion.com/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", registration.client_id);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "consent");
  return { status: status("notion", "connecting", "正在等待 Notion 完成授权。"), authUrl: url.toString() };
}

async function startGoogleOAuth(body: JsonObject, origin: string): Promise<AppConnectResponse> {
  const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
  const clientSecret = typeof body.clientSecret === "string" ? body.clientSecret.trim() : "";
  if (!clientId || !clientSecret) throw new Error("请输入 Google OAuth Client ID 与 Client Secret");
  const redirectUri = `${origin}/api/apps/google/oauth/callback`;
  const state = randomBytes(20).toString("hex");
  const pending = await readPending();
  pending.google = { state, clientId, clientSecret, redirectUri, createdAt: Date.now() };
  await savePending(pending);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return { status: status("google", "connecting", "正在等待 Google 完成授权。"), authUrl: url.toString() };
}

async function startWpsOAuth(origin: string): Promise<AppConnectResponse> {
  const clientId = process.env.AGENT_OS_WPS_CLIENT_ID?.trim();
  const clientSecret = process.env.AGENT_OS_WPS_CLIENT_SECRET?.trim();
  const scopes = process.env.AGENT_OS_WPS_SCOPES?.trim();
  if (!clientId || !clientSecret || !scopes) {
    throw new Error("AgentOS 尚未配置 WPS 服务商应用。管理员需设置 WPS Client ID、Client Secret 与已审批权限；也可展开“使用已有 Token”手动连接。");
  }
  const redirectUri = `${origin}/api/apps/wps/oauth/callback`;
  const state = randomBytes(20).toString("hex");
  const pending = await readPending();
  pending.wps = { state, clientId, clientSecret, redirectUri, scopes, createdAt: Date.now() };
  await savePending(pending);
  const url = new URL("https://openapi.wps.cn/oauth2/auth");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("state", state);
  return { status: status("wps", "connecting", "正在等待 WPS 完成授权。", { authMode: "oauth" }), authUrl: url.toString() };
}

export async function completeOAuth(appId: "notion" | "google" | "wps", params: URLSearchParams): Promise<string> {
  const pending = await readPending();
  const providerError = params.get("error");
  if (providerError) throw new Error(`授权被取消：${providerError}`);
  const code = params.get("code");
  if (!code) throw new Error("授权回调缺少 code");

  if (appId === "notion") {
    const entry = pending.notion;
    if (!entry || Date.now() - entry.createdAt > 10 * 60_000) throw new Error("授权请求已过期，请返回 Syntropic 重试。");
    if (params.get("state") !== entry.state) throw new Error("授权状态校验失败，请返回 Syntropic 重试。");
    const body = new URLSearchParams({ grant_type: "authorization_code", client_id: entry.clientId, code, redirect_uri: entry.redirectUri, code_verifier: entry.codeVerifier });
    if (entry.clientSecret) body.set("client_secret", entry.clientSecret);
    const token = await fetchJson("https://mcp.notion.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    if (typeof token.access_token !== "string") throw new Error("Notion 没有返回访问令牌");
    await writePrivateJson(NOTION_PATH, { mcpUrl: NOTION_MCP_URL, accessToken: token.access_token, clientId: entry.clientId, clientSecret: entry.clientSecret });
    delete pending.notion;
    await savePending(pending);
    return "Notion 已成功连接到 Syntropic。";
  }

  if (appId === "wps") {
    const entry = pending.wps;
    if (!entry || Date.now() - entry.createdAt > 10 * 60_000) throw new Error("授权请求已过期，请返回 Syntropic 重试。");
    if (params.get("state") !== entry.state) throw new Error("授权状态校验失败，请返回 Syntropic 重试。");
    const body = new URLSearchParams({ grant_type: "authorization_code", client_id: entry.clientId, client_secret: entry.clientSecret, code, redirect_uri: entry.redirectUri });
    const token = await fetchJson("https://openapi.wps.cn/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    if (typeof token.access_token !== "string") throw new Error("WPS 没有返回访问令牌");
    const connections = await readPrivateConnections();
    connections.connectors ??= {};
    connections.connectors.wps = { credentials: { mcpUrl: "https://openapi.wps.cn/mcp/v2/kso-doc/message", accessToken: token.access_token, ...(typeof token.refresh_token === "string" ? { refreshToken: token.refresh_token } : {}) }, connectedAt: new Date().toISOString() };
    await savePrivateConnections(connections);
    await hydrateAppConnectionEnvironment();
    delete pending.wps;
    await savePending(pending);
    return "WPS 365 已成功连接到 Syntropic。";
  }

  const entry = pending.google;
  if (!entry || Date.now() - entry.createdAt > 10 * 60_000) throw new Error("授权请求已过期，请返回 Syntropic 重试。");
  if (params.get("state") !== entry.state) throw new Error("授权状态校验失败，请返回 Syntropic 重试。");
  const body = new URLSearchParams({ client_id: entry.clientId, client_secret: entry.clientSecret, code, grant_type: "authorization_code", redirect_uri: entry.redirectUri });
  const token = await fetchJson("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (typeof token.access_token !== "string") throw new Error("Google 没有返回访问令牌");
  const expiresIn = typeof token.expires_in === "number" ? token.expires_in : 3600;
  await writePrivateJson(GOOGLE_PATH, { clientId: entry.clientId, clientSecret: entry.clientSecret, redirectUri: entry.redirectUri, tokens: { access_token: token.access_token, refresh_token: typeof token.refresh_token === "string" ? token.refresh_token : undefined, token_type: typeof token.token_type === "string" ? token.token_type : "Bearer", scope: typeof token.scope === "string" ? token.scope : GOOGLE_SCOPES.join(" "), expiry_date: Date.now() + expiresIn * 1000 } } satisfies GoogleConfig);
  delete pending.google;
  await savePending(pending);
  return "Google Workspace 已成功连接到 Syntropic。";
}

export async function disconnectApp(appId: ConnectedAppId): Promise<AppConnectionStatus> {
  if (isChinaConnectorAppId(appId)) {
    const connections = await readPrivateConnections();
    const credentials = connections.connectors?.[appId]?.credentials ?? {};
    if (connections.connectors) delete connections.connectors[appId];
    for (const key of Object.keys(credentials)) delete process.env[`AGENT_OS_${appId}_${key}`.replace(/[^a-z0-9]+/gi, "_").toUpperCase()];
    await savePrivateConnections(connections);
  } else if (appId === "figma") await updateAuthPath("figma", "token");
  else if (appId === "linear") await updateAuthPath("linear", "key");
  else if (appId === "notion") await rm(NOTION_PATH, { force: true });
  else if (appId === "google") await rm(GOOGLE_PATH, { force: true });
  else {
    const connections = await readPrivateConnections();
    if (appId === "github") {
      delete connections.github;
      delete process.env.GH_TOKEN;
    } else {
      delete connections.slack;
      delete process.env.SLACK_BOT_TOKEN;
      delete process.env.SLACK_USER_TOKEN;
    }
    await savePrivateConnections(connections);
  }
  return status(appId, "disconnected", "连接已从本机移除。", appId === "github" ? { dependency: "GitHub CLI（gh）" } : {});
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function githubHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
}

async function getGitHubData(section: string, query: string): Promise<AppDataResponse> {
  const connection = (await readPrivateConnections()).github;
  if (!connection?.token) throw new Error("GitHub 尚未连接");
  let endpoint = "https://api.github.com/user/repos?sort=pushed&per_page=30";
  if (section === "Pull Requests") endpoint = "https://api.github.com/search/issues?q=is%3Apr+author%3A%40me&sort=updated&per_page=30";
  if (section === "Issues") endpoint = "https://api.github.com/issues?filter=assigned&state=open&per_page=30";
  const body = await fetchPayload(endpoint, { headers: githubHeaders(connection.token) });
  const rows = isRecord(body) && Array.isArray(body.items) ? body.items : Array.isArray(body) ? body : [];
  const items = rows.filter(isRecord).map((row, index): AppDataItem => ({ id: String(row.id ?? row.node_id ?? `github-${index}`), title: text(row.full_name) ?? text(row.title) ?? "Untitled", subtitle: text(row.description) ?? text(isRecord(row.repository) ? row.repository.full_name : undefined), meta: text(row.updated_at), url: text(row.html_url), kind: section === "Pull Requests" ? "PR" : section === "Issues" ? "Issue" : "仓库" }));
  return filterData({ appId: "github", section, account: connection.login, items }, query);
}

async function getFigmaData(section: string): Promise<AppDataResponse> {
  const token = await readNativeToken("figma", "token", "FIGMA_TOKEN");
  if (!token) throw new Error("Figma 尚未连接");
  const me = await fetchJson("https://api.figma.com/v1/me", { headers: { "X-Figma-Token": token } });
  const account = text(me.handle) ?? text(me.email);
  return { appId: "figma", section, account, items: [{ id: String(me.id ?? "me"), title: account ?? "Figma 账号", subtitle: text(me.email), kind: "账号" }], note: "Figma API 不提供跨团队的“最近文件”列表；粘贴文件链接后，Syntropic 插件 可读取对应设计数据。" };
}

async function getSlackData(section: string, query: string): Promise<AppDataResponse> {
  const connection = (await readPrivateConnections()).slack;
  if (!connection?.botToken) throw new Error("Slack 尚未连接");
  if (section === "搜索" && query && connection.userToken) {
    const body = await slackApi(connection.userToken, "search.messages", new URLSearchParams({ query, count: "30" }));
    const matches = isRecord(body.messages) && Array.isArray(body.messages.matches) ? body.messages.matches : [];
    return { appId: "slack", section, account: connection.team, items: matches.filter(isRecord).map((row, index): AppDataItem => ({ id: String(row.ts ?? `slack-message-${index}`), title: text(row.text) ?? "消息", subtitle: text(row.username), url: text(row.permalink), kind: "消息" })) };
  }
  const body = await slackApi(connection.botToken, "conversations.list", new URLSearchParams({ limit: "100", types: section === "私信" ? "im,mpim" : "public_channel,private_channel" }));
  const channels = Array.isArray(body.channels) ? body.channels : [];
  return filterData({ appId: "slack", section, account: connection.team, items: channels.filter(isRecord).map((row, index): AppDataItem => ({ id: String(row.id ?? `slack-channel-${index}`), title: text(row.name) ?? text(row.user) ?? "会话", subtitle: row.is_member === true ? "已加入" : "可见", kind: "频道" })) }, query);
}

async function getLinearData(section: string, query: string): Promise<AppDataResponse> {
  const token = await readNativeToken("linear", "key", "LINEAR_API_KEY");
  if (!token) throw new Error("Linear 尚未连接");
  const data = await linearGraphql(token, "query AgentOSLinearData { viewer { id name email assignedIssues(first: 40, filter: { state: { type: { nin: [\"completed\", \"canceled\"] } } }) { nodes { id identifier title url priority updatedAt state { name } team { name } } } } }");
  const viewer = isRecord(data.viewer) ? data.viewer : {};
  const assigned = isRecord(viewer.assignedIssues) && Array.isArray(viewer.assignedIssues.nodes) ? viewer.assignedIssues.nodes : [];
  return filterData({ appId: "linear", section, account: text(viewer.name) ?? text(viewer.email), items: assigned.filter(isRecord).map((row, index): AppDataItem => ({ id: String(row.id ?? `linear-${index}`), title: `${text(row.identifier) ?? ""} ${text(row.title) ?? "Untitled"}`.trim(), subtitle: text(isRecord(row.state) ? row.state.name : undefined), meta: text(isRecord(row.team) ? row.team.name : undefined), url: text(row.url), kind: "Issue" })) }, query);
}

function parseMcpResponse(raw: string): JsonObject {
  const chunks = raw.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim());
  const candidate = chunks.at(-1) ?? raw;
  try { const parsed: unknown = JSON.parse(candidate); return isRecord(parsed) ? parsed : {}; } catch { return {}; }
}

async function notionRpc(accessToken: string, method: string, params: JsonObject, sessionId?: string): Promise<{ body: JsonObject; sessionId?: string }> {
  const response = await fetch(NOTION_MCP_URL, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json, text/event-stream", "Content-Type": "application/json", ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}) }, body: JSON.stringify({ jsonrpc: "2.0", id: randomBytes(4).toString("hex"), method, params }), signal: AbortSignal.timeout(20_000) });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Notion MCP 请求失败（${response.status}）`);
  return { body: parseMcpResponse(raw), sessionId: response.headers.get("mcp-session-id") ?? sessionId };
}

async function connectorMcpRpc(appId: ChinaConnectorAppId, method: string, params: JsonObject, sessionId?: string): Promise<{ body: JsonObject; sessionId?: string }> {
  const entry = (await readPrivateConnections()).connectors?.[appId];
  const url = entry?.credentials.mcpUrl;
  if (!entry || !url) throw new Error(`${getChinaAppDefinition(appId)?.name ?? appId} 尚未配置 MCP Server 地址`);
  const token = entry.credentials.accessToken ?? entry.credentials.token;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      ...(token && appId === "tencent-meeting" ? { "X-Tencent-Meeting-Token": token } : token ? { Authorization: `Bearer ${token}` } : {}),
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: randomBytes(4).toString("hex"), method, params }),
    signal: AbortSignal.timeout(30_000),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`MCP 请求失败（${response.status}）`);
  const parsed = parseMcpResponse(raw);
  if (isRecord(parsed.error)) throw new Error(text(parsed.error.message) ?? "MCP 返回错误");
  return { body: parsed, sessionId: response.headers.get("mcp-session-id") ?? sessionId };
}

async function initializeConnectorMcp(appId: ChinaConnectorAppId) {
  const initialized = await connectorMcpRpc(appId, "initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "Syntropic", version: "1.0.0" } });
  await connectorMcpRpc(appId, "notifications/initialized", {}, initialized.sessionId);
  return initialized.sessionId;
}

export async function listConnectorMcpTools(appId: ChinaConnectorAppId): Promise<unknown[]> {
  const sessionId = await initializeConnectorMcp(appId);
  const response = await connectorMcpRpc(appId, "tools/list", {}, sessionId);
  const result = isRecord(response.body.result) ? response.body.result : {};
  return Array.isArray(result.tools) ? result.tools : [];
}

export async function callConnectorMcpTool(appId: ChinaConnectorAppId, toolName: string, args: JsonObject): Promise<unknown> {
  const sessionId = await initializeConnectorMcp(appId);
  const response = await connectorMcpRpc(appId, "tools/call", { name: toolName, arguments: args }, sessionId);
  return response.body.result ?? response.body;
}

async function getNotionData(section: string, query: string): Promise<AppDataResponse> {
  const config = await readJson<{ accessToken?: string }>(NOTION_PATH);
  if (!config?.accessToken) throw new Error("Notion 尚未连接");
  const initialized = await notionRpc(config.accessToken, "initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "Syntropic", version: "1.0.0" } });
  await notionRpc(config.accessToken, "notifications/initialized", {}, initialized.sessionId);
  const tools = await notionRpc(config.accessToken, "tools/list", {}, initialized.sessionId);
  const result = isRecord(tools.body.result) ? tools.body.result : {};
  const available = Array.isArray(result.tools) ? result.tools.filter(isRecord) : [];
  const searchTool = available.find((tool) => tool.name === "notion-search");
  if (!searchTool) return { appId: "notion", section, items: available.map((tool): AppDataItem => ({ id: String(tool.name), title: String(tool.name), subtitle: text(tool.description), kind: "能力" })), note: "连接有效；当前 Notion MCP 未返回搜索能力。" };
  const called = await notionRpc(config.accessToken, "tools/call", { name: "notion-search", arguments: { query, content_search_mode: "workspace_search", filters: {} } }, initialized.sessionId);
  const callResult = isRecord(called.body.result) ? called.body.result : {};
  const content = Array.isArray(callResult.content) ? callResult.content.filter(isRecord) : [];
  const items = content.map((row, index): AppDataItem => ({ id: String(index), title: text(row.text)?.split("\n")[0] ?? "Notion 结果", subtitle: text(row.text), kind: "页面" }));
  return { appId: "notion", section, items };
}

async function getValidGoogleConfig(): Promise<GoogleConfig> {
  const config = await readJson<GoogleConfig>(GOOGLE_PATH);
  if (!config?.tokens?.access_token) throw new Error("Google Workspace 尚未连接");
  if (!config.tokens.expiry_date || Date.now() < config.tokens.expiry_date - 60_000) return config;
  if (!config.tokens.refresh_token) throw new Error("Google 授权已过期，请重新连接");
  const body = new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: config.tokens.refresh_token, grant_type: "refresh_token" });
  const token = await fetchJson("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (typeof token.access_token !== "string") throw new Error("Google 令牌刷新失败");
  const next: GoogleConfig = { ...config, tokens: { ...config.tokens, access_token: token.access_token, expiry_date: Date.now() + (typeof token.expires_in === "number" ? token.expires_in : 3600) * 1000 } };
  await writePrivateJson(GOOGLE_PATH, next);
  return next;
}

async function getGoogleData(section: string, query: string): Promise<AppDataResponse> {
  const config = await getValidGoogleConfig();
  if (section === "邮件") {
    const listParams = new URLSearchParams({ maxResults: "30" });
    if (query) listParams.set("q", query);
    const list = await fetchJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${listParams}`, { headers: { Authorization: `Bearer ${config.tokens.access_token}` } });
    const messageRefs = Array.isArray(list.messages) ? list.messages.filter(isRecord).slice(0, 30) : [];
    const messages = await Promise.all(messageRefs.map(async (message) => {
      const id = text(message.id);
      if (!id) return null;
      const params = new URLSearchParams({ format: "metadata", fields: "id,threadId,internalDate,snippet,payload(headers)" });
      for (const header of ["Subject", "From", "Date"]) params.append("metadataHeaders", header);
      return fetchJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?${params}`, { headers: { Authorization: `Bearer ${config.tokens.access_token}` } });
    }));
    const profile = await fetchJson("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { Authorization: `Bearer ${config.tokens.access_token}` } });
    const items = messages.filter(isRecord).map((message, index): AppDataItem => {
      const payload = isRecord(message.payload) ? message.payload : {};
      const headers = Array.isArray(payload.headers) ? payload.headers.filter(isRecord) : [];
      const header = (name: string) => text(headers.find((item) => text(item.name)?.toLocaleLowerCase() === name.toLocaleLowerCase())?.value);
      const id = text(message.id) ?? `gmail-${index}`;
      const internalDate = text(message.internalDate);
      return {
        id,
        title: header("Subject") ?? "（无主题）",
        subtitle: header("From") ?? text(message.snippet),
        meta: header("Date") ?? (internalDate ? new Date(Number(internalDate)).toISOString() : undefined),
        url: `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(id)}`,
        kind: "邮件",
      };
    });
    return { appId: "google", section, account: text(profile.emailAddress), items, note: "Gmail 仅以只读权限访问；不会发送、修改或删除邮件。" };
  }
  const params = new URLSearchParams({ pageSize: "40", orderBy: "modifiedTime desc", fields: "files(id,name,mimeType,modifiedTime,webViewLink,owners(displayName))" });
  if (query) params.set("q", `name contains '${query.replaceAll("'", "\\'")}' and trashed = false`);
  const body = await fetchJson(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: { Authorization: `Bearer ${config.tokens.access_token}` } });
  const files = Array.isArray(body.files) ? body.files : [];
  return { appId: "google", section, items: files.filter(isRecord).map((row, index): AppDataItem => ({ id: String(row.id ?? `google-${index}`), title: text(row.name) ?? "Untitled", subtitle: text(row.mimeType), meta: text(row.modifiedTime), url: text(row.webViewLink), kind: "文件" })) };
}

async function getQichachaData(section: string, query: string): Promise<AppDataResponse> {
  const entry = (await readPrivateConnections()).connectors?.qichacha;
  const appKey = entry?.credentials.appKey;
  const secretKey = entry?.credentials.secretKey;
  if (!appKey || !secretKey) throw new Error("企查查尚未连接");
  if (!query.trim()) {
    return {
      appId: "qichacha",
      section,
      account: appKey,
      items: [],
      note: "输入企业名称、统一社会信用代码、创始人或产品名，查询企查查企业模糊搜索接口。实际字段取决于机构已购买的接口套餐。",
    };
  }
  const timespan = Math.floor(Date.now() / 1_000).toString();
  const token = createHash("md5").update(`${appKey}${timespan}${secretKey}`).digest("hex").toUpperCase();
  const params = new URLSearchParams({ key: appKey, searchKey: query.trim(), pageIndex: "1" });
  const body = await fetchJson(`https://api.qichacha.com/FuzzySearch/GetList?${params}`, { headers: { Token: token, Timespan: timespan } });
  const rows = Array.isArray(body.Result) ? body.Result : Array.isArray(body.Data) ? body.Data : [];
  if (!rows.length && typeof body.Message === "string" && body.Message.trim()) throw new Error(`企查查：${body.Message.trim()}`);
  const items = rows.filter(isRecord).map((row, index): AppDataItem => ({
    id: text(row.KeyNo) ?? text(row.CreditCode) ?? `qichacha-${index}`,
    title: text(row.Name) ?? "未命名企业",
    subtitle: [text(row.OperName) ? `法定代表人 ${text(row.OperName)}` : undefined, text(row.Address)].filter(Boolean).join(" · ") || undefined,
    meta: [text(row.Status), text(row.StartDate), text(row.CreditCode)].filter(Boolean).join(" · ") || undefined,
    url: text(row.KeyNo) ? `https://www.qcc.com/firm/${encodeURIComponent(text(row.KeyNo)!)}` : undefined,
    kind: "企业",
  }));
  return { appId: "qichacha", section, account: appKey, items, note: "结果来自企查查企业模糊搜索 API；调用会按企查查套餐计费。" };
}

function filterData(data: AppDataResponse, query: string): AppDataResponse {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return data;
  return { ...data, items: data.items.filter((item) => `${item.title} ${item.subtitle ?? ""} ${item.meta ?? ""}`.toLocaleLowerCase().includes(normalized)) };
}

export async function getAppData(appId: ConnectedAppId, section: string, query: string): Promise<AppDataResponse> {
  if (appId === "qichacha") return getQichachaData(section, query);
  if (isChinaConnectorAppId(appId)) {
    const definition = getChinaAppDefinition(appId)!;
    const entry = (await readPrivateConnections()).connectors?.[appId];
    if (!entry) throw new Error(`${definition.name} 尚未连接`);
    return filterData({ appId, section, account: entry.credentials.corpId ?? entry.credentials.clientId ?? entry.credentials.appKey, items: definition.capabilities.map((capability, index) => ({ id: `${appId}-${index}`, title: capability, subtitle: definition.authMode === "mcp" ? "可通过 MCP 调用" : "可通过开放平台访问", kind: definition.authMode.toUpperCase() })), note: "实际可用数据和操作范围由厂商账号、企业管理员审批及数据许可决定。" }, query);
  }
  if (appId === "github") return getGitHubData(section, query);
  if (appId === "figma") return getFigmaData(section);
  if (appId === "slack") return getSlackData(section, query);
  if (appId === "linear") return getLinearData(section, query);
  if (appId === "notion") return getNotionData(section, query);
  return getGoogleData(section, query);
}
