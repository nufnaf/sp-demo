export const CRM_STAGES = ["线索", "需求确认", "方案报价", "商务谈判", "已成交", "已流失"] as const;
export type CrmStage = typeof CRM_STAGES[number];
export interface CrmCustomer { id: string; name: string; industry: string; contact: string; owner: string; stage: CrmStage; value: number; lastContact: string; note: string }
export interface CrmOrder { id: string; customerId: string; title: string; amount: number; paid: number; dueDate: string; status: "执行中" | "已完成" | "已取消" }
export interface CrmActivity { id: string; customerId: string; date: string; summary: string }
export interface CrmDataset { customers: CrmCustomer[]; orders: CrmOrder[]; activities: CrmActivity[] }
export interface CrmSource { id: string; name: string; mode: "demo" | "import" | "remote"; baseUrl?: string; remoteRevision?: number; syntheticData?: boolean; syncedAt: string; data: CrmDataset }
export interface CrmState { version: 1; revision: number; sources: CrmSource[]; manual: CrmDataset }
export interface CrmSignal { id: string; customerId: string; title: string; detail: string; action: string; severity: "risk" | "opportunity" }
export const CRM_DEMO_SOURCES = [
  { id: "demo-crm", name: "星流 CRM", description: "客户、联系人、商机与销售阶段", icon: "C" },
  { id: "demo-orders", name: "星流订单中心", description: "销售订单、合同金额与回款进度", icon: "O" },
  { id: "demo-activity", name: "星流客户跟进", description: "拜访记录、客户反馈与下一步计划", icon: "F" },
] as const;
export function emptyCrmData(): CrmDataset { return { customers: [], orders: [], activities: [] }; }
export function emptyCrmState(): CrmState { return { version: 1, revision: 0, sources: [], manual: emptyCrmData() }; }
const DAY = 86_400_000;
export function crmDemoData(sourceId: string, now = Date.now()): CrmDataset {
  const date = (offset: number) => new Date(now + offset * DAY).toISOString().slice(0, 10);
  const data = emptyCrmData();
  if (sourceId === "demo-crm") data.customers = [
    { id: "xinglan", name: "星澜科技", industry: "企业软件", contact: "陈曦 · 采购负责人", owner: "我", stage: "商务谈判", value: 680000, lastContact: date(-18), note: "年度平台采购，法务正在评审合同。" },
    { id: "yunzhou", name: "云舟制造", industry: "智能制造", contact: "周远 · 信息化总监", owner: "我", stage: "已成交", value: 420000, lastContact: date(-3), note: "一期已上线，客户关注后续交付与服务。" },
    { id: "qinghe", name: "青禾零售", industry: "消费零售", contact: "林悦 · 运营负责人", owner: "我", stage: "方案报价", value: 280000, lastContact: date(-2), note: "计划从 20 家门店试点，关注上线周期。" },
    { id: "haichuan", name: "海川物流", industry: "物流运输", contact: "王宁 · 技术负责人", owner: "我", stage: "需求确认", value: 180000, lastContact: date(-6), note: "需要与现有调度系统集成。" },
    { id: "zhiyuan", name: "知远教育", industry: "教育服务", contact: "赵敏 · 总经理", owner: "我", stage: "线索", value: 95000, lastContact: date(-1), note: "官网咨询，待安排首次需求访谈。" },
  ];
  else if (sourceId === "demo-orders") data.orders = [
    { id: "SO-26001", customerId: "yunzhou", title: "智能协作平台年度订阅", amount: 420000, paid: 210000, dueDate: date(-12), status: "执行中" },
    { id: "SO-26002", customerId: "xinglan", title: "试点项目实施服务", amount: 80000, paid: 80000, dueDate: date(-30), status: "已完成" },
    { id: "SO-26003", customerId: "qinghe", title: "门店数字化试点", amount: 60000, paid: 30000, dueDate: date(8), status: "执行中" },
  ];
  else if (sourceId === "demo-activity") data.activities = [
    { id: "follow-1", customerId: "xinglan", date: date(-18), summary: "采购负责人已认可报价，但需要法务确认数据安全条款；尚未约定下一次沟通。" },
    { id: "follow-2", customerId: "yunzhou", date: date(-3), summary: "客户反馈验收报告尚未完成内部签字，财务需要验收材料才能安排尾款。" },
    { id: "follow-3", customerId: "qinghe", date: date(-2), summary: "试点效果得到认可，客户提出后续扩大到 100 家门店，需确认新增预算和交付计划。" },
  ];
  else throw new Error("未知演示数据源");
  return data;
}
export function crmRecords(state: CrmState): CrmDataset {
  const hiddenDemoIds = new Set(state.sources.filter((source) => source.mode === "demo").flatMap((source) => [...source.data.customers, ...source.data.orders, ...source.data.activities].map((row) => row.id)));
  const manual = {
    customers: state.manual.customers.filter((row) => !hiddenDemoIds.has(row.id)),
    orders: state.manual.orders.filter((row) => !hiddenDemoIds.has(row.id)),
    activities: state.manual.activities.filter((row) => !hiddenDemoIds.has(row.id) && !hiddenDemoIds.has(row.customerId)),
  };
  const datasets = [...state.sources.filter((source) => source.mode !== "demo").map((source) => source.data), manual];
  const merge = <T extends { id: string }>(rows: T[][]): T[] => [...new Map(rows.flat().map((row) => [row.id, row])).values()];
  return { customers: merge(datasets.map((data) => data.customers)), orders: merge(datasets.map((data) => data.orders)), activities: merge(datasets.map((data) => data.activities)) };
}
export function crmSignals(data: CrmDataset, now = Date.now()): CrmSignal[] {
  const signals: CrmSignal[] = [];
  for (const customer of data.customers) {
    const activities = data.activities.filter((activity) => activity.customerId === customer.id).sort((a, b) => b.date.localeCompare(a.date));
    const lastContact = [customer.lastContact, ...activities.map((activity) => activity.date)].sort().at(-1)!;
    const idleDays = Math.floor((now - Date.parse(`${lastContact}T00:00:00Z`)) / DAY);
    if (["方案报价", "商务谈判"].includes(customer.stage) && idleDays >= 14) signals.push({ id: `idle:${customer.id}`, customerId: customer.id, title: `${customer.name}的商机跟进停滞`, detail: `${customer.stage}阶段，预计金额 ¥${customer.value.toLocaleString("zh-CN")}；最近一次跟进 ${lastContact}，已 ${idleDays} 天。`, action: "核对采购决策与合同阻塞，准备下一次跟进计划。", severity: "risk" });
    const overdue = data.orders.filter((order) => order.customerId === customer.id && order.status !== "已取消" && order.paid < order.amount && Date.parse(`${order.dueDate}T23:59:59Z`) < now);
    if (overdue.length) signals.push({ id: `overdue:${customer.id}`, customerId: customer.id, title: `${customer.name}存在逾期回款`, detail: `${overdue.map((order) => `${order.id}（到期 ${order.dueDate}）`).join("、")}，未收 ¥${overdue.reduce((sum, order) => sum + order.amount - order.paid, 0).toLocaleString("zh-CN")}。${activities[0] ? `最近跟进：${activities[0].summary}` : "尚无关联跟进记录。"}`, action: "核对验收、开票和付款条件，生成催收沟通草稿。", severity: "risk" });
    const expansion = activities.find((activity) => /扩大|增购|扩容/.test(activity.summary));
    if (expansion) signals.push({ id: `expansion:${customer.id}`, customerId: customer.id, title: `${customer.name}出现增购信号`, detail: `${expansion.date} 跟进记录：${expansion.summary}`, action: "确认新增预算、决策人和交付范围，准备增购方案。", severity: "opportunity" });
  }
  return signals;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("数据必须是对象");
  return value as Record<string, unknown>;
}
function str(row: Record<string, unknown>, key: string, optional = false): string {
  const value = row[key];
  if (optional && value === undefined) return "";
  if (typeof value !== "string" || (!optional && !value.trim()) || value.length > 2000) throw new Error(`${key} 必须是有效文本（最多 2000 字）`);
  return value.trim();
}
function amount(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1e12) throw new Error(`${key} 必须是有效的非负金额`);
  return value;
}
function date(row: Record<string, unknown>, key: string): string {
  const value = str(row, key);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error(`${key} 必须是 YYYY-MM-DD 日期`);
  return value;
}
export function parseCrmData(value: unknown): CrmDataset {
  const body = record(value);
  const rows = (key: string) => {
    const value = body[key] ?? [];
    if (!Array.isArray(value) || value.length > 1000) throw new Error(`${key} 必须是数组，最多 1000 条`);
    const result = value.map(record);
    const ids = result.map((row) => str(row, "id"));
    if (new Set(ids).size !== ids.length) throw new Error(`${key} 中的 id 不能重复`);
    return result;
  };
  const customers = rows("customers").map((row): CrmCustomer => {
    const stage = str(row, "stage") as CrmStage;
    if (!CRM_STAGES.includes(stage)) throw new Error("客户阶段无效");
    return { id: str(row, "id"), name: str(row, "name"), industry: str(row, "industry", true), contact: str(row, "contact", true), owner: str(row, "owner"), stage, value: amount(row, "value"), lastContact: date(row, "lastContact"), note: str(row, "note", true) };
  });
  const orders = rows("orders").map((row): CrmOrder => {
    const status = str(row, "status") as CrmOrder["status"];
    if (!["执行中", "已完成", "已取消"].includes(status)) throw new Error("订单状态无效");
    const total = amount(row, "amount"), paid = amount(row, "paid");
    if (paid > total) throw new Error("已收金额不能超过订单金额");
    return { id: str(row, "id"), customerId: str(row, "customerId"), title: str(row, "title"), amount: total, paid, dueDate: date(row, "dueDate"), status };
  });
  const activities = rows("activities").map((row): CrmActivity => ({ id: str(row, "id"), customerId: str(row, "customerId"), date: date(row, "date"), summary: str(row, "summary") }));
  return { customers, orders, activities };
}
