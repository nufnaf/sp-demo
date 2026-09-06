import { createHash } from "node:crypto";
import { readStoredAuthSection, updateStoredAuthSection } from "./provider-credential-store";
import { applyCompanyCrmSnapshot, readCrmState, updateCrmState } from "./crm-store";
import { normalizeCompanyCrmUrl, parseRemoteCrmSnapshot, requestCompanyCrmJson, verifyCompanyCrm } from "./company-crm-client";
import { enqueueCrmInsight } from "./crm-insights";

import { cancelCompanyCrmInsight, scheduleCompanyCrmInsight } from "./company-crm-demo-insight";
import { isCompanyCrmDemo } from "./company-crm-demo-report";

interface Connection { baseUrl: string; token: string }
export interface CompanyCrmStatus { connected: boolean; baseUrl?: string; state: "disconnected" | "syncing" | "ready" | "error"; error?: string; checkedAt?: string; insightWarning?: string }
interface SyncRuntime { locks: Map<string, Promise<unknown>>; statuses: Map<string, CompanyCrmStatus>; timers: Map<string, ReturnType<typeof setTimeout>> }
declare global { var __piCompanyCrmSync: SyncRuntime | undefined }
function runtime(): SyncRuntime { return globalThis.__piCompanyCrmSync ??= { locks: new Map(), statuses: new Map(), timers: new Map() }; }
function section(cwd: string) { return `pi-web:company-crm:${createHash("sha256").update(cwd).digest("hex")}`; }
async function connection(cwd: string): Promise<Connection | null> {
  const stored = await readStoredAuthSection(section(cwd));
  return typeof stored?.baseUrl === "string" && typeof stored.token === "string" ? { baseUrl: stored.baseUrl, token: stored.token } : null;
}
async function exclusive<T>(cwd: string, action: () => Promise<T>): Promise<T> {
  const previous = runtime().locks.get(cwd) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(action);
  runtime().locks.set(cwd, current);
  try { return await current; } finally { if (runtime().locks.get(cwd) === current) runtime().locks.delete(cwd); }
}
function schedule(cwd: string): void {
  if (runtime().timers.has(cwd)) return;
  const timer = setTimeout(() => { runtime().timers.delete(cwd); void syncCompanyCrm(cwd).catch(() => {}); }, 30_000);
  timer.unref?.(); runtime().timers.set(cwd, timer);
}
async function acceptSnapshot(cwd: string, input: Connection, snapshot: ReturnType<typeof parseRemoteCrmSnapshot>, skipGenericInsight = false): Promise<void> {
  const { state, changed } = applyCompanyCrmSnapshot(cwd, input.baseUrl, snapshot);
  let insightWarning: string | undefined;
  if (changed && !skipGenericInsight) {
    try { await enqueueCrmInsight(cwd, state, "company-crm.synced"); }
    catch { insightWarning = "同步已完成，但后台 AI 洞察暂时不可用"; }
  }
  runtime().statuses.set(cwd, { connected: true, state: "ready", baseUrl: input.baseUrl, checkedAt: new Date().toISOString(), insightWarning });
}
export async function connectCompanyCrm(cwd: string, baseUrl: unknown, token: unknown): Promise<void> {
  if (typeof baseUrl !== "string" || typeof token !== "string" || !token.trim() || token.length > 1000 || /[\r\n]/.test(token)) throw new Error("请填写有效的网站地址和访问令牌");
  const input = { baseUrl: normalizeCompanyCrmUrl(baseUrl), token: token.trim() };
  await exclusive(cwd, async () => {
    const snapshot = await verifyCompanyCrm(input.baseUrl, input.token);
    await updateStoredAuthSection(section(cwd), input);
    const demo = isCompanyCrmDemo(input.baseUrl, snapshot.meta.syntheticData);
    cancelCompanyCrmInsight(cwd);
    await acceptSnapshot(cwd, input, snapshot, demo);
    if (demo) scheduleCompanyCrmInsight(cwd);
    schedule(cwd);
  });
}
export async function syncCompanyCrm(cwd: string): Promise<void> {
  await exclusive(cwd, async () => {
    const input = await connection(cwd);
    if (!input) return;
    runtime().statuses.set(cwd, { ...runtime().statuses.get(cwd), connected: true, state: "syncing", baseUrl: input.baseUrl });
    try {
      const snapshot = parseRemoteCrmSnapshot(await requestCompanyCrmJson(input.baseUrl, "/api/v1/snapshot", input.token));
      await acceptSnapshot(cwd, input, snapshot);
    } catch (error) {
      runtime().statuses.set(cwd, { connected: true, state: "error", baseUrl: input.baseUrl, checkedAt: new Date().toISOString(), error: error instanceof Error ? error.message : "公司 CRM 同步失败" });
      throw error;
    } finally { schedule(cwd); }
  });
}
export async function companyCrmStatus(cwd: string): Promise<CompanyCrmStatus> {
  const input = await connection(cwd);
  if (!input) return { connected: false, state: "disconnected" };
  if (!runtime().timers.has(cwd) && !runtime().locks.has(cwd)) void syncCompanyCrm(cwd).catch(() => {});
  return runtime().statuses.get(cwd) ?? { connected: true, state: "syncing", baseUrl: input.baseUrl };
}
export async function disconnectCompanyCrm(cwd: string): Promise<void> {
  await exclusive(cwd, async () => {
    await updateStoredAuthSection(section(cwd), undefined);
    cancelCompanyCrmInsight(cwd);
    const timer = runtime().timers.get(cwd); if (timer) clearTimeout(timer);
    runtime().timers.delete(cwd); runtime().statuses.delete(cwd);
    const state = readCrmState(cwd);
    if (state.sources.some((source) => source.id === "company-crm")) {
      const next = updateCrmState(cwd, { action: "disconnect", sourceId: "company-crm", revision: state.revision });
      await enqueueCrmInsight(cwd, next, "company-crm.disconnected").catch(() => {});
    }
  });
}
