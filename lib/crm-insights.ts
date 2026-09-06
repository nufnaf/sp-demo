import { crmRecords, crmSignals, type CrmState } from "./crm";
import { recordInsightEvent, stableInsightEventId } from "./insight-event-store";

export async function enqueueCrmInsight(cwd: string, state: CrmState, action: string): Promise<void> {
  const { ensureInsightEngine } = await import("./insight-engine");
  ensureInsightEngine(cwd);
  const data = crmRecords(state);
  const signals = crmSignals(data);
  recordInsightEvent({
    id: stableInsightEventId(["crm", cwd, state.revision]), source: "crm", type: "crm.data.changed", cwd,
    title: "销售 CRM 数据发生变化", summary: `${data.customers.length} 个客户，${data.orders.length} 个订单，${signals.length} 条规则信号。请关联跟进、订单和付款条件分析销售风险与机会。`,
    payload: { action, sources: state.sources.filter((source) => source.mode !== "demo" || !state.sources.some((item) => item.mode === "remote")).map(({ id, name, mode, syncedAt, baseUrl, remoteRevision, syntheticData }) => ({ id, name, mode, syncedAt, baseUrl, remoteRevision, syntheticData })), signals: signals.slice(0, 30), customers: data.customers.slice(0, 50), orders: data.orders.slice(0, 50), activities: data.activities.slice(-50), truncated: signals.length > 30 || Object.values(data).some((rows) => rows.length > 50) },
  });
}
