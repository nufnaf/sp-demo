import { randomUUID } from "node:crypto";
import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import QRCode from "qrcode";
import { runNpm, runNpx } from "./npx";

const execFileAsync = promisify(execFile);

export type CollaborationCliId = "wecom" | "dingtalk" | "beisen" | "boss-zhipin";

export interface CollaborationCliStatus {
  appId: CollaborationCliId;
  installed: boolean;
  skillsInstalled: boolean;
  version?: string;
  authState: "authenticated" | "not_authenticated" | "unknown";
  authDetail: string;
  account?: string;
  organization?: string;
}

export interface CollaborationAuthFlow {
  flowId: string;
  verificationUrl: string;
  qrCodeDataUrl: string;
  userCode?: string;
  instruction: string;
  requiresConfirmation?: boolean;
}

interface CliDefinition {
  command: string;
  packageName: string;
  versionArgs: string[];
  statusArgs: string[];
  loginArgs: string[];
  skills: () => Promise<void>;
}

interface ActiveFlow {
  appId: CollaborationCliId;
  process: ChildProcessWithoutNullStreams;
  output: string;
  settled: boolean;
  temporaryQrPath?: string;
}

const definitions: Record<CollaborationCliId, CliDefinition> = {
  wecom: {
    command: "wecom-cli",
    packageName: "@wecom/cli",
    versionArgs: ["--version"],
    statusArgs: ["auth", "show", "--status"],
    loginArgs: ["auth", "init", "--noninteractive", "--no-browser"],
    skills: async () => { await runNpx(["-y", "skills", "add", "WeComTeam/wecom-cli", "-y", "-g"], { timeout: 3 * 60_000 }); },
  },
  dingtalk: {
    command: "dws",
    packageName: "dingtalk-workspace-cli",
    versionArgs: ["version"],
    statusArgs: ["auth", "status", "--format", "json"],
    loginArgs: ["auth", "login", "--device"],
    skills: async () => { await runCli("dingtalk", ["skill", "setup", "--mode", "multi", "--target", "all", "--yes"], 3 * 60_000); },
  },
  beisen: {
    command: "beisen-cli",
    packageName: "beisen-cli",
    versionArgs: ["version"],
    statusArgs: ["auth", "status"],
    loginArgs: ["auth", "login"],
    skills: async () => { await runCli("beisen", ["install"], 3 * 60_000); },
  },
  "boss-zhipin": {
    command: "boss",
    packageName: "@joohw/boss-cli",
    versionArgs: ["version"],
    statusArgs: [],
    loginArgs: ["login"],
    skills: async () => { await runNpx(["-y", "skills", "add", "joohw/boss-cli", "-y", "-g"], { timeout: 3 * 60_000 }); },
  },
};

const runtimeGlobal = globalThis as typeof globalThis & {
  __piCollaborationCliFlows?: Map<string, ActiveFlow>;
  __piVerifiedCollaborationApps?: Set<CollaborationCliId>;
};
const activeFlows = runtimeGlobal.__piCollaborationCliFlows ??= new Map<string, ActiveFlow>();
const verifiedApps = runtimeGlobal.__piVerifiedCollaborationApps ??= new Set<CollaborationCliId>();

function commandFor(appId: CollaborationCliId): string {
  const command = definitions[appId].command;
  return process.platform === "win32" ? `${command}.cmd` : command;
}

function cleanOutput(value: string): string {
  return value.replace(/\x1b\[[0-9;?>=!]*[a-zA-Z]/g, "").replace(/[\u2500-\u257f]/g, " ").trim();
}

async function runCli(appId: CollaborationCliId, args: string[], timeout = 15_000, extraEnv: Record<string, string> = {}) {
  return execFileAsync(commandFor(appId), args, {
    timeout,
    env: { ...process.env, NO_COLOR: "1", CI: "1", ...extraEnv },
    shell: process.platform === "win32",
    windowsHide: true,
  });
}

function parseJson(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(cleanOutput(value)) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}

function deepString(value: unknown, keys: string[]): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  for (const child of Object.values(record)) {
    const found = deepString(child, keys);
    if (found) return found;
  }
  return undefined;
}

function deepBoolean(value: unknown, keys: string[]): boolean | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of keys) if (typeof record[key] === "boolean") return record[key] as boolean;
  for (const child of Object.values(record)) {
    const found = deepBoolean(child, keys);
    if (found !== undefined) return found;
  }
  return undefined;
}

export function isCollaborationCliId(value: string): value is CollaborationCliId {
  return value === "wecom" || value === "dingtalk" || value === "beisen" || value === "boss-zhipin";
}

export async function getCollaborationCliStatus(appId: CollaborationCliId): Promise<CollaborationCliStatus> {
  let version = "";
  try {
    const result = await runCli(appId, definitions[appId].versionArgs);
    version = cleanOutput(result.stdout || result.stderr).split("\n").find(Boolean)?.slice(0, 80) ?? "已安装";
  } catch {
    return { appId, installed: false, skillsInstalled: false, authState: "not_authenticated", authDetail: appId === "boss-zhipin" ? "点击连接后将自动安装社区 CLI 与 Skill。" : "点击连接后将自动安装官方 CLI 与 Skill。" };
  }

  if (appId === "boss-zhipin") {
    const authenticated = verifiedApps.has(appId);
    return {
      appId,
      installed: true,
      skillsInstalled: true,
      version,
      authState: authenticated ? "authenticated" : "unknown",
      authDetail: authenticated ? "本机 BOSS 直聘网页会话已验证。" : "CLI 已就绪；扫码登录后点击“完成并验证”。",
    };
  }

  try {
    const result = await runCli(appId, definitions[appId].statusArgs);
    const output = cleanOutput(`${result.stdout}\n${result.stderr}`);
    const json = parseJson(result.stdout) ?? parseJson(result.stderr);
    const explicitState = json ? deepBoolean(json, ["authenticated", "authorized", "loggedIn", "isLoggedIn", "valid"]) : undefined;
    const stateText = json ? deepString(json, ["status", "state", "authStatus"]) : undefined;
    const authenticated = appId === "wecom"
      ? /(^|\s)authorized(\s|$)/i.test(output) && !/unauthorized/i.test(output)
      : explicitState === true || /authenticated|logged\s*in|authorized|valid/i.test(stateText ?? output);
    const account = json ? deepString(json, ["displayName", "userName", "username", "name", "email", "mobile"]) : undefined;
    const organization = json ? deepString(json, ["organizationName", "orgName", "corpName", "tenantName"]) : undefined;
    return {
      appId,
      installed: true,
      skillsInstalled: true,
      version,
      authState: authenticated ? "authenticated" : "not_authenticated",
      authDetail: authenticated ? "官方 CLI 的 OAuth 授权有效。" : "CLI 已就绪，等待账号授权。",
      account,
      organization,
    };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    const output = cleanOutput(`${failure.stdout ?? ""}\n${failure.stderr ?? ""}`);
    return { appId, installed: true, skillsInstalled: true, version, authState: "not_authenticated", authDetail: output.slice(0, 180) || "尚未完成账号授权。" };
  }
}

export async function installCollaborationCli(appId: CollaborationCliId): Promise<CollaborationCliStatus> {
  const current = await getCollaborationCliStatus(appId);
  if (!current.installed) {
    await runNpm(["install", "--global", definitions[appId].packageName], { timeout: 3 * 60_000 });
  }
  await definitions[appId].skills();
  return getCollaborationCliStatus(appId);
}

function extractUrl(value: string): string | undefined {
  return cleanOutput(value).match(/https?:\/\/[^\s<>"')\]]+/)?.[0];
}

function extractUserCode(value: string): string | undefined {
  return cleanOutput(value).match(/(?:user\s*code|device\s*code|验证码|设备码)\s*[:：]?\s*([A-Z0-9-]{4,})/i)?.[1];
}

export async function startCollaborationLogin(appId: CollaborationCliId): Promise<CollaborationAuthFlow> {
  const status = await getCollaborationCliStatus(appId);
  if (!status.installed) throw new Error("官方 CLI 尚未安装，请先完成安装步骤。");

  for (const [id, flow] of activeFlows) {
    if (flow.appId === appId && !flow.settled) {
      flow.process.kill();
      activeFlows.delete(id);
    }
  }

  const flowId = randomUUID();
  const definition = definitions[appId];
  const temporaryQrPath = appId === "wecom" ? join(tmpdir(), `agent-os-wecom-${flowId}.png`) : undefined;
  const loginArgs = temporaryQrPath ? [...definition.loginArgs, "--output-qrcode", temporaryQrPath] : definition.loginArgs;
  const child = spawn(commandFor(appId), loginArgs, {
    env: { ...process.env, NO_COLOR: "1" },
    shell: process.platform === "win32",
    windowsHide: true,
  });
  const active: ActiveFlow = { appId, process: child, output: "", settled: false, temporaryQrPath };
  activeFlows.set(flowId, active);
  const append = (chunk: Buffer | string) => { active.output = `${active.output}${chunk.toString()}`.slice(-12_000); };
  child.stdout.on("data", append);
  child.stderr.on("data", append);
  child.once("exit", () => { active.settled = true; windowCleanup(flowId); });
  child.once("error", () => { active.settled = true; windowCleanup(flowId); });

  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    const verificationUrl = extractUrl(active.output);
    if (verificationUrl) {
      return {
        flowId,
        verificationUrl,
        qrCodeDataUrl: await QRCode.toDataURL(verificationUrl, { width: 448, margin: 2, errorCorrectionLevel: "M" }),
        userCode: extractUserCode(active.output),
        instruction: appId === "wecom" ? "使用企业微信扫码确认授权"
          : appId === "dingtalk" ? "使用钉钉扫码，或在浏览器中确认组织与权限"
            : appId === "beisen" ? "在北森官方页面确认账号与企业权限"
              : "在打开的 BOSS 直聘页面扫码登录",
        requiresConfirmation: appId === "boss-zhipin",
      };
    }
    if (active.settled) throw new Error(cleanOutput(active.output).slice(-500) || "授权进程提前结束，请重试。");
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  child.kill();
  activeFlows.delete(flowId);
  throw new Error("未能从官方 CLI 获取授权地址，请稍后重试。");
}

export async function verifyCollaborationLogin(appId: CollaborationCliId): Promise<CollaborationCliStatus> {
  if (appId !== "boss-zhipin") return getCollaborationCliStatus(appId);
  try {
    await runCli(appId, ["positions"], 60_000, { BOSS_BROWSER_HEADLESS: "true" });
    verifiedApps.add(appId);
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; message?: string };
    const detail = cleanOutput(`${failure.stdout ?? ""}\n${failure.stderr ?? ""}\n${failure.message ?? ""}`).slice(-400);
    throw new Error(detail || "尚未检测到有效的 BOSS 直聘登录状态，请完成扫码后重试。");
  }
  return getCollaborationCliStatus(appId);
}

function windowCleanup(flowId: string) {
  setTimeout(() => {
    const flow = activeFlows.get(flowId);
    activeFlows.delete(flowId);
    if (flow?.temporaryQrPath) void rm(flow.temporaryQrPath, { force: true });
  }, 60_000).unref?.();
}

export function cancelCollaborationLogin(flowId: string, appId: CollaborationCliId): boolean {
  const flow = activeFlows.get(flowId);
  if (!flow || flow.appId !== appId) return false;
  if (!flow.settled) flow.process.kill();
  activeFlows.delete(flowId);
  if (flow.temporaryQrPath) void rm(flow.temporaryQrPath, { force: true });
  return true;
}
