import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { applicationDataDir } from "./presentation-runtime";
import { writePrivateFileAtomicSync } from "./atomic-file";
import type { RemoteCrmSnapshot } from "./company-crm-client";
import { CRM_DEMO_SOURCES, crmDemoData, crmRecords, emptyCrmState, parseCrmData, type CrmState } from "./crm";

function statePath(cwd: string): string {
  return join(applicationDataDir(), "pi-web", "crm", `${createHash("sha256").update(resolve(cwd)).digest("hex")}.json`);
}
export function readCrmState(cwd: string): CrmState {
  try {
    const state = JSON.parse(readFileSync(statePath(cwd), "utf8")) as CrmState;
    if (state.version !== 1 || !Array.isArray(state.sources)) throw new Error("CRM 数据格式无效");
    return state;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyCrmState();
    throw error;
  }
}
/** Synchronous read/modify/atomic-write prevents interleaving inside the server process. */
export function updateCrmState(cwd: string, body: Record<string, unknown>): CrmState {
  const state = readCrmState(cwd);
  if (body.revision !== state.revision) throw new Error("数据已更新，请刷新后重试");
  const sourceId = typeof body.sourceId === "string" ? body.sourceId : "";
  if (body.action === "connect-demo") {
    const definition = CRM_DEMO_SOURCES.find((source) => source.id === sourceId);
    if (!definition) throw new Error("未知数据源");
    // Re-syncing a static demo preserves dates and any user's local edits.
    if (!state.sources.some((source) => source.id === sourceId)) state.sources.push({ id: sourceId, name: definition.name, mode: "demo", syncedAt: new Date().toISOString(), data: crmDemoData(sourceId) });
  } else if (body.action === "import") {
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
    if (!name) throw new Error("请填写数据源名称");
    const data = parseCrmData(body.data);
    if (!data.customers.length && !data.orders.length && !data.activities.length) throw new Error("导入文件没有销售记录");
    const id = `import:${name}`;
    if (!state.sources.some((source) => source.id === id) && state.sources.length >= 20) throw new Error("最多添加 20 个数据源");
    state.sources = [...state.sources.filter((source) => source.id !== id), { id, name, mode: "import", syncedAt: new Date().toISOString(), data }];
  } else if (body.action === "disconnect") {
    const source = state.sources.find((source) => source.id === sourceId);
    if (!source) throw new Error("数据源不存在");
    state.sources = state.sources.filter((item) => item.id !== sourceId);
    // Remove edits overlaying disconnected records; keep independently created records.
    const remove = <T extends { id: string }>(rows: T[], sourceRows: T[]) => {
      const ids = new Set(sourceRows.map((row) => row.id));
      return rows.filter((row) => !ids.has(row.id));
    };
    state.manual = {
      customers: remove(state.manual.customers, source.data.customers),
      orders: remove(state.manual.orders, source.data.orders),
      activities: remove(state.manual.activities, source.data.activities),
    };
  } else if (body.action === "save") {
    const data = parseCrmData(body.data);
    if ([...data.customers, ...data.orders, ...data.activities].some((row) => row.id.startsWith("company-crm:"))) throw new Error("公司 CRM 记录为只读同步，请到公司 CRM 网站编辑");
    const customers = new Set([...crmRecords(state).customers, ...data.customers].map((customer) => customer.id));
    if ([...data.orders, ...data.activities].some((row) => !customers.has(row.customerId))) throw new Error("请先创建关联客户");
    const merge = <T extends { id: string }>(rows: T[], updates: T[]) => {
      const ids = new Set(updates.map((row) => row.id));
      return [...rows.filter((row) => !ids.has(row.id)), ...updates];
    };
    state.manual = {
      customers: merge(state.manual.customers, data.customers),
      orders: merge(state.manual.orders, data.orders),
      activities: merge(state.manual.activities, data.activities),
    };
  } else throw new Error("未知操作");
  state.revision += 1;
  const path = statePath(cwd);
  mkdirSync(join(path, ".."), { recursive: true });
  writePrivateFileAtomicSync(path, `${JSON.stringify(state, null, 2)}\n`);
  return state;
}


/** Remote identifiers are namespaced, so source records cannot overwrite local customers. */
export function applyCompanyCrmSnapshot(cwd: string, baseUrl: string, snapshot: RemoteCrmSnapshot): { state: CrmState; changed: boolean } {
  const state = readCrmState(cwd);
  const prefix = (id: string) => `company-crm:${id}`;
  const data = {
    customers: snapshot.data.customers.map((row) => ({ ...row, id: prefix(row.id) })),
    orders: snapshot.data.orders.map((row) => ({ ...row, id: prefix(row.id), customerId: prefix(row.customerId) })),
    activities: snapshot.data.activities.map((row) => ({ ...row, id: prefix(row.id), customerId: prefix(row.customerId) })),
  };
  const previous = state.sources.find((source) => source.id === "company-crm");
  if (previous?.baseUrl === baseUrl && previous.remoteRevision === snapshot.meta.revision && JSON.stringify(previous.data) === JSON.stringify(data)) return { state, changed: false };
  state.sources = [...state.sources.filter((source) => source.id !== "company-crm"), { id: "company-crm", name: snapshot.meta.sourceName, mode: "remote", baseUrl, remoteRevision: snapshot.meta.revision, syntheticData: snapshot.meta.syntheticData, syncedAt: new Date().toISOString(), data }];
  state.revision++;
  const path = statePath(cwd);
  mkdirSync(join(path, ".."), { recursive: true });
  writePrivateFileAtomicSync(path, `${JSON.stringify(state, null, 2)}\n`);
  return { state, changed: true };
}
