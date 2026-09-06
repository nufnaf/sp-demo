"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import "./InvestmentWorkspaceApp.css";
import { WorkspaceAppIcon } from "./WorkspaceAppIcon";

type InvestmentView = "portfolio" | "company" | "sources";
type DealStage = "初步接触" | "商业尽调" | "投决中" | "已交割" | "退出中";
type CompanySection = "overview" | "research" | "investment";
type InvestmentSourceId = "feishu" | "google" | "qichacha";
type SourceConnection = { state: "connected" | "disconnected" | "loading" | "error"; account?: string; detail?: string };

interface DealRecord {
  round: string;
  stage: DealStage;
  owner: string;
  source: string;
  lastContact: string;
  nextAction: string;
  nextActionDue: string;
  updatedAt: string;
}

interface InvestmentRecord {
  fund: string;
  round: string;
  date: string;
  amount: string;
  instrument: string;
  preMoney: string;
  ownership: string;
  currentValue: string;
  moic: string;
  boardSeat: string;
}

interface PortfolioCompany {
  id: string;
  name: string;
  initials: string;
  sector: string;
  companyStatus: "潜在项目" | "已投企业" | "退出管理";
  location: string;
  founded: string;
  currentDeal: DealRecord;
  contacts: Array<{ name: string; role: string; relationship: string; internalOwner: string; lastContact: string }>;
  investments: InvestmentRecord[];
  score: number;
  metric: string;
  metricLabel: string;
  thesis: string;
  sourceCount: number;
  sourceLabels: string[];
  research: Array<{ title: string; summary: string; source: string; time: string; type: "内部记录" | "公司材料" | "工商数据" }>;
}

function InvestmentIcon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

const icons = {
  portfolio: <InvestmentIcon><rect x="3" y="5" width="18" height="15" rx="3"/><path d="M8 5V3h8v2M3 10h18M10 13h4"/></InvestmentIcon>,
  sources: <InvestmentIcon><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></InvestmentIcon>,
  shield: <InvestmentIcon size={15}><path d="M12 3 5 6v5c0 4.6 2.8 8.2 7 10 4.2-1.8 7-5.4 7-10V6Z"/><path d="m9 12 2 2 4-4"/></InvestmentIcon>,
  search: <InvestmentIcon size={15}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></InvestmentIcon>,
  refresh: <InvestmentIcon size={15}><path d="M20 6v5h-5"/><path d="M18.5 15a7 7 0 1 1-.8-7.8L20 10"/></InvestmentIcon>,
};

const portfolioCompanies: PortfolioCompany[] = [
  { id: "nebula", name: "星云科技", initials: "星", sector: "企业级 AI", companyStatus: "已投企业", location: "北京", founded: "2021", currentDeal: { round: "B 轮跟投", stage: "投决中", owner: "陈思", source: "经纬王总引荐", lastContact: "昨天 18:20", nextAction: "获取核心客户续约合同", nextActionDue: "9月8日", updatedAt: "今天 10:32" }, contacts: [{ name: "李明", role: "创始人兼 CEO", relationship: "强", internalOwner: "陈思", lastContact: "昨天" }, { name: "韩雪", role: "财务负责人", relationship: "一般", internalOwner: "林嘉", lastContact: "7天前" }], investments: [{ fund: "成长基金一期", round: "A 轮", date: "2024-03-18", amount: "¥30M", instrument: "A轮优先股", preMoney: "¥320M", ownership: "8.6%", currentValue: "¥52M", moic: "1.73×", boardSeat: "观察员席位" }], score: 78, metric: "¥68M", metricLabel: "ARR", thesis: "Agent 基础设施正从试点走向生产，公司的工具编排能力形成差异化。", sourceCount: 26, sourceLabels: ["飞书", "Gmail", "企查查"], research: [
    { title: "B 轮项目周会纪要", summary: "团队已完成商业尽调分工，下一步补充三家核心客户的续约合同。", source: "飞书会议纪要", time: "今天 10:04", type: "内部记录" },
    { title: "创始人跟进邮件", summary: "公司已发送最新 BP 与客户名单，附件归档在本轮交易资料中。", source: "Gmail", time: "昨天 18:20", type: "公司材料" },
    { title: "工商主体核验", summary: "企业为存续状态，统一社会信用代码和法定代表人已完成匹配。", source: "企查查 · 企业工商信息", time: "今天 09:48", type: "工商数据" },
  ] },
  { id: "orbit", name: "环流机器人", initials: "环", sector: "具身智能", companyStatus: "潜在项目", location: "上海", founded: "2022", currentDeal: { round: "A 轮", stage: "商业尽调", owner: "周屿", source: "奇绩创业营", lastContact: "3天前", nextAction: "完成剩余 2 场客户访谈", nextActionDue: "9月10日", updatedAt: "今天 09:15" }, contacts: [{ name: "徐卓", role: "联合创始人兼 CEO", relationship: "一般", internalOwner: "周屿", lastContact: "3天前" }, { name: "孙宁", role: "销售副总裁", relationship: "新建立", internalOwner: "周屿", lastContact: "12天前" }], investments: [], score: 71, metric: "42台", metricLabel: "付费部署", thesis: "柔性制造场景中，软硬一体的交付能力可能形成规模化壁垒。", sourceCount: 18, sourceLabels: ["飞书", "Gmail", "企查查"], research: [
    { title: "客户访谈完成 6/8", summary: "已访谈客户普遍认可部署速度，但两家客户提到二次开发投入超预期。", source: "飞书文档 · 客户访谈", time: "昨天 16:40", type: "内部记录" },
    { title: "管理层经营计划", summary: "管理层预计标准化模块可将部署周期缩短 35%。", source: "Gmail · 创始人来信", time: "9月4日", type: "公司材料" },
    { title: "主体与股东核验", summary: "工商主体存续，创始团队持股和公开登记信息已归档。", source: "企查查 · 股东信息", time: "今天 08:55", type: "工商数据" },
  ] },
  { id: "photon", name: "光屿芯片", initials: "光", sector: "AI 芯片", companyStatus: "已投企业", location: "深圳", founded: "2019", currentDeal: { round: "投后跟踪", stage: "已交割", owner: "林嘉", source: "产业专家推荐", lastContact: "昨天 19:06", nextAction: "准备 Q3 董事会材料", nextActionDue: "9月15日", updatedAt: "昨天 19:06" }, contacts: [{ name: "郑凯", role: "创始人兼 CEO", relationship: "强", internalOwner: "林嘉", lastContact: "昨天" }, { name: "顾言", role: "董事会秘书", relationship: "强", internalOwner: "陈思", lastContact: "5天前" }], investments: [{ fund: "硬科技基金二期", round: "C 轮", date: "2023-11-02", amount: "¥80M", instrument: "C轮优先股", preMoney: "¥2.1B", ownership: "3.5%", currentValue: "¥126M", moic: "1.58×", boardSeat: "董事席位" }], score: 84, metric: "1.6×", metricLabel: "收入增速", thesis: "国产推理芯片在特定负载下具备明确性价比，生态适配是核心变量。", sourceCount: 31, sourceLabels: ["飞书", "Gmail", "企查查"], research: [
    { title: "季度经营复盘", summary: "董事会材料及内部跟踪记录已完成归档。", source: "飞书文档 · Q3 董事会", time: "昨天 19:06", type: "内部记录" },
    { title: "新一代芯片流片进度", summary: "公司预计首批样片将在下月交付核心客户测试。", source: "Gmail · 董秘来信", time: "9月3日", type: "公司材料" },
    { title: "企业变更记录", summary: "近期工商变更记录已同步，未发现企业经营状态异常。", source: "企查查 · 变更记录", time: "昨天 14:30", type: "工商数据" },
  ] },
  { id: "river", name: "澄川生物", initials: "澄", sector: "创新药", companyStatus: "潜在项目", location: "苏州", founded: "2023", currentDeal: { round: "Pre-A", stage: "初步接触", owner: "王清", source: "医药顾问推荐", lastContact: "9月3日", nextAction: "签署 NDA 并开放数据室", nextActionDue: "9月9日", updatedAt: "9月4日" }, contacts: [{ name: "唐睿", role: "创始人兼 CSO", relationship: "新建立", internalOwner: "王清", lastContact: "9月3日" }, { name: "杨倩", role: "融资顾问", relationship: "一般", internalOwner: "王清", lastContact: "9月4日" }], investments: [], score: 66, metric: "2项", metricLabel: "临床前管线", thesis: "靶点机制有潜在差异化，但技术验证和资金需求仍有较大不确定性。", sourceCount: 12, sourceLabels: ["飞书", "Gmail", "企查查"], research: [
    { title: "首次项目评审记录", summary: "两项管线均处于临床前阶段，关键动物实验数据尚未完整披露。", source: "飞书文档 · 项目评审", time: "9月4日", type: "内部记录" },
    { title: "团队补充材料", summary: "公司预计在 IND 前完成核心临床团队搭建。", source: "Gmail · 融资顾问来信", time: "9月3日", type: "公司材料" },
    { title: "企业与股东信息", summary: "工商主体、登记股东和主要人员信息已归档。", source: "企查查 · 工商信息", time: "9月4日", type: "工商数据" },
  ] },
  { id: "north", name: "北辰能源", initials: "北", sector: "新能源", companyStatus: "退出管理", location: "常州", founded: "2016", currentDeal: { round: "退出计划", stage: "退出中", owner: "赵一", source: "原股东推荐", lastContact: "9月2日", nextAction: "确认首档减持窗口", nextActionDue: "9月12日", updatedAt: "9月2日" }, contacts: [{ name: "吴峰", role: "董事长", relationship: "强", internalOwner: "赵一", lastContact: "9月2日" }, { name: "谢芳", role: "董事会秘书", relationship: "强", internalOwner: "赵一", lastContact: "9月2日" }], investments: [{ fund: "新能源基金一期", round: "Pre-IPO", date: "2021-06-25", amount: "¥120M", instrument: "普通股", preMoney: "¥3.8B", ownership: "2.9%", currentValue: "¥142M", moic: "1.18×", boardSeat: "无" }], score: 63, metric: "18%", metricLabel: "持仓回报", thesis: "现金流改善兑现，但行业供给压力使估值修复空间受限。", sourceCount: 22, sourceLabels: ["飞书", "Gmail", "企查查"], research: [
    { title: "退出工作组记录", summary: "首档减持窗口、内部负责人和法律文件清单已经确认。", source: "飞书文档 · 退出工作组", time: "9月2日", type: "内部记录" },
    { title: "董秘确认函", summary: "公司已通过邮件确认未来 45 天的窗口安排。", source: "Gmail · 董秘来信", time: "9月2日", type: "公司材料" },
    { title: "主体风险复核", summary: "经营状态正常，司法与经营风险记录已按授权套餐更新。", source: "企查查 · 风险扫描", time: "9月2日", type: "工商数据" },
  ] },
];

const sourceApps = [
  { id: "feishu", name: "飞书", short: "飞", detail: "同步项目群沟通、会议纪要、文档和多维表格", scope: "内部协作 · 只读检索", color: "blue", logoUrl: "/icons/feishu-logo.svg" },
  { id: "google", name: "Google 邮箱", short: "G", detail: "归集创始人往来邮件、融资附件和沟通时间线", scope: "邮件与附件 · 只读授权", color: "amber" },
  { id: "qichacha", name: "企查查", short: "企", detail: "核验工商主体、股东、变更记录和企业风险", scope: "企业工商数据 · API", color: "orange" },
] satisfies Array<{ id: InvestmentSourceId; name: string; short: string; detail: string; scope: string; color: string; logoUrl?: string }>;

const sourceLabelById: Record<InvestmentSourceId, string> = { feishu: "飞书", google: "Gmail", qichacha: "企查查" };
const researchTypeClass: Record<PortfolioCompany["research"][number]["type"], string> = {
  "内部记录": "type-fact",
  "公司材料": "type-claim",
  "工商数据": "type-web",
};

export function InvestmentWorkspaceApp({ cwd, onStartTask, onNotice, onOpenSource }: {
  cwd: string | null;
  onStartTask: (message: string) => Promise<string | null>;
  onNotice: (message: string) => void;
  onOpenSource: (sourceId: InvestmentSourceId) => void;
}) {
  const [view, setView] = useState<InvestmentView>("portfolio");
  const [activeCompanyId, setActiveCompanyId] = useState("nebula");
  const [taskBusy, setTaskBusy] = useState(false);
  const [linkedSourceIds, setLinkedSourceIds] = useState<Set<InvestmentSourceId>>(() => new Set());
  const [sourceConnections, setSourceConnections] = useState<Record<InvestmentSourceId, SourceConnection>>({
    feishu: { state: "loading" },
    google: { state: "loading" },
    qichacha: { state: "loading" },
  });

  const refreshSourceConnections = useCallback(async () => {
    const read = async (sourceId: InvestmentSourceId, url: string) => {
      const response = await fetch(url, { cache: "no-store" });
      const body = await response.json() as { state?: string; authState?: string; account?: string; organization?: string; detail?: string; authDetail?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? "连接状态读取失败");
      const connected = sourceId === "feishu" ? body.authState === "authenticated" : body.state === "connected";
      return { state: connected ? "connected" : "disconnected", account: body.account ?? body.organization, detail: body.detail ?? body.authDetail } satisfies SourceConnection;
    };
    const checks = await Promise.allSettled([
      read("feishu", "/api/apps/feishu"),
      read("google", "/api/apps/google/connection"),
      read("qichacha", "/api/apps/qichacha/connection"),
    ]);
    const ids: InvestmentSourceId[] = ["feishu", "google", "qichacha"];
    setSourceConnections((current) => {
      const next = { ...current };
      checks.forEach((result, index) => {
        next[ids[index]] = result.status === "fulfilled"
          ? result.value
          : { state: "error", detail: result.reason instanceof Error ? result.reason.message : String(result.reason) };
      });
      return next;
    });
  }, []);

  useEffect(() => {
    void refreshSourceConnections();
    const refresh = () => void refreshSourceConnections();
    window.addEventListener("focus", refresh);
    window.addEventListener("agent-os:apps-changed", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("agent-os:apps-changed", refresh);
    };
  }, [refreshSourceConnections]);

  useEffect(() => {
    if (!cwd) return;
    try {
      const stored = window.localStorage.getItem(`agent-os-investment-linked-sources:${cwd}`);
      if (stored) setLinkedSourceIds(new Set((JSON.parse(stored) as InvestmentSourceId[]).filter((id) => sourceApps.some((source) => source.id === id))));
      else if (sourceApps.every((source) => sourceConnections[source.id].state !== "loading")) {
        const connectedIds = sourceApps.filter((source) => sourceConnections[source.id].state === "connected").map((source) => source.id);
        setLinkedSourceIds(new Set(connectedIds));
        window.localStorage.setItem(`agent-os-investment-linked-sources:${cwd}`, JSON.stringify(connectedIds));
      }
    } catch {
      setLinkedSourceIds(new Set());
    }
  }, [cwd, sourceConnections]);

  const saveLinkedSources = (next: Set<InvestmentSourceId>) => {
    setLinkedSourceIds(next);
    if (cwd) {
      try {
        window.localStorage.setItem(`agent-os-investment-linked-sources:${cwd}`, JSON.stringify([...next]));
      } catch {
        // The in-memory selection still works when browser storage is unavailable.
      }
    }
  };

  const connectSource = (sourceId: InvestmentSourceId) => {
    const connection = sourceConnections[sourceId];
    if (connection.state !== "connected") {
      onOpenSource(sourceId);
      return;
    }
    const next = new Set(linkedSourceIds).add(sourceId);
    saveLinkedSources(next);
    onNotice(`${sourceLabelById[sourceId]}已接入投资管理`);
  };

  const disconnectSource = (sourceId: InvestmentSourceId) => {
    const next = new Set(linkedSourceIds);
    next.delete(sourceId);
    saveLinkedSources(next);
    onNotice(`${sourceLabelById[sourceId]}已从投资管理移除，账号授权仍保留`);
  };

  const activeCompany = portfolioCompanies.find((company) => company.id === activeCompanyId) ?? portfolioCompanies[0];

  const openCompany = (companyId: string) => {
    setActiveCompanyId(companyId);
    setView("company");
  };

  const startCompanyResearch = async () => {
    const activeSources = sourceApps.filter((source) => linkedSourceIds.has(source.id) && sourceConnections[source.id].state === "connected");
    if (!activeSources.length) {
      setView("sources");
      onNotice("请先连接至少一个投资数据源");
      return;
    }
    setTaskBusy(true);
    const sessionId = await onStartTask(`作为 VC 投资研究 Agent，请更新「${activeCompany.name}」的公司档案。\n\n公司状态：${activeCompany.companyStatus}\n当前交易：${activeCompany.currentDeal.round} · ${activeCompany.currentDeal.stage}\n项目负责人：${activeCompany.currentDeal.owner}\n下一步动作：${activeCompany.currentDeal.nextAction}（${activeCompany.currentDeal.nextActionDue} 前）\n当前投资逻辑：${activeCompany.thesis}\n\n请读取当前已授权并接入投资管理的数据源：${activeSources.map((source) => source.name).join("、")}。整理新增材料、工商变更、沟通记录及尚缺资料。只记录来源能够核验的事实，每条记录保留数据来源与更新时间；本任务只做资料整理，不生成任何投资判断或建议。任何外部发送或系统写入先生成草稿等待确认。`);
    setTaskBusy(false);
    if (sessionId) onNotice(`${activeCompany.name} 资料更新任务已启动`);
  };

  return <div className="investment-workspace os-workspace">
    <aside className="investment-sidebar">
      <header><span className="investment-brand-mark"><WorkspaceAppIcon name="investment" size={20}/></span><span><strong>投资管理</strong><small>机构投资工作台</small></span></header>
      <nav aria-label="投资工作台导航">
        <button type="button" className={view !== "sources" ? "active" : ""} aria-current={view !== "sources" ? "page" : undefined} aria-label="公司管理" title="公司管理" onClick={() => setView("portfolio")}>{icons.portfolio}<span>公司管理</span><em>{portfolioCompanies.length}</em></button>
        <button type="button" className={view === "sources" ? "active" : ""} aria-current={view === "sources" ? "page" : undefined} aria-label="数据源管理" title="数据源管理" onClick={() => setView("sources")}>{icons.sources}<span>数据源管理</span><em>{sourceApps.filter((source) => linkedSourceIds.has(source.id) && sourceConnections[source.id].state === "connected").length}</em></button>
      </nav>
      <section className="investment-sidebar-case">
        <small>当前公司</small>
        <button type="button" onClick={() => setView("company")}>
          <span>{activeCompany.initials}</span><span><strong>{activeCompany.name}</strong><small>{activeCompany.currentDeal.stage} · {activeCompany.currentDeal.round}</small></span><em>›</em>
        </button>
      </section>
      <footer><span>{icons.shield}</span><p><strong>证据优先</strong><small>结论均可回溯到原始材料</small></p></footer>
    </aside>

    <main className="investment-main">
      {view === "portfolio" ? <PortfolioView companies={portfolioCompanies} onOpenCompany={openCompany} onNotice={onNotice} /> : null}
      {view === "company" ? <CompanyResearchView company={activeCompany} busy={taskBusy} sourceConnections={sourceConnections} linkedSourceIds={linkedSourceIds} onBack={() => setView("portfolio")} onResearch={() => void startCompanyResearch()} onOpenSource={onOpenSource} /> : null}
      {view === "sources" ? <InvestmentSourcesView sourceConnections={sourceConnections} linkedSourceIds={linkedSourceIds} onConnect={connectSource} onDisconnect={disconnectSource} onOpenSource={onOpenSource} onRefresh={() => void refreshSourceConnections()} /> : null}
    </main>
  </div>;
}

function InvestmentSourcesView({ sourceConnections, linkedSourceIds, onConnect, onDisconnect, onOpenSource, onRefresh }: {
  sourceConnections: Record<InvestmentSourceId, SourceConnection>;
  linkedSourceIds: Set<InvestmentSourceId>;
  onConnect: (sourceId: InvestmentSourceId) => void;
  onDisconnect: (sourceId: InvestmentSourceId) => void;
  onOpenSource: (sourceId: InvestmentSourceId) => void;
  onRefresh: () => void;
}) {
  const connectedCount = sourceApps.filter((source) => linkedSourceIds.has(source.id) && sourceConnections[source.id].state === "connected").length;
  return <section className="investment-sources-page">
    <header className="investment-page-header">
      <div><small>应用连接</small><h1>投资数据源</h1><p>连接机构已有系统，把项目沟通、邮件材料和工商信息汇入同一家公司档案</p></div>
      <button type="button" className="investment-source-refresh" onClick={onRefresh}>{icons.refresh}刷新状态</button>
    </header>
    <section className="investment-source-summary">
      <span>{icons.sources}</span><div><strong>统一投资数据</strong><p>应用授权与工作台接入相互独立；只有接入后的来源才会参与公司资料更新。</p></div><em>{connectedCount} / {sourceApps.length} 已连接</em>
    </section>
    <section className="investment-source-manager-grid" aria-label="投资数据源列表">
      {sourceApps.map((source) => {
        const connection = sourceConnections[source.id];
        const linked = linkedSourceIds.has(source.id);
        const connected = linked && connection.state === "connected";
        const stateLabel = connection.state === "loading" ? "检测中" : connection.state === "error" ? "检测失败" : connected ? "已连接" : connection.state === "connected" ? "可连接" : "待授权";
        const actionLabel = connected ? "打开应用" : connection.state === "connected" ? "连接到投资管理" : connection.state === "error" ? "重试连接" : connection.state === "loading" ? "检测中…" : "完成授权";
        return <article key={source.id} className={connection.state === "error" ? "has-error" : ""}>
          <header><span className={`investment-source-logo is-${source.color}`}>{source.logoUrl ? <Image src={source.logoUrl} alt="" width={23} height={23}/> : source.short}</span><em className={connected ? "connected" : connection.state}><i/>{stateLabel}</em></header>
          <h2>{source.name}</h2><p>{source.detail}</p><small>{connection.account ?? connection.detail ?? source.scope}</small>
          <dl><div><dt>接入范围</dt><dd>{source.scope}</dd></div><div><dt>写入权限</dt><dd>默认不写入源系统</dd></div></dl>
          <div className="investment-source-actions"><button type="button" className={connected ? "connected" : ""} disabled={connection.state === "loading"} onClick={() => connected ? onOpenSource(source.id) : onConnect(source.id)}>{actionLabel}</button>{connected ? <button type="button" className="disconnect" onClick={() => onDisconnect(source.id)}>移除</button> : null}</div>
        </article>;
      })}
    </section>
    <footer className="investment-source-note">连接凭证由各应用单独管理；从投资管理移除只会停止在本工作台使用，不会撤销原应用授权。</footer>
  </section>;
}

function PortfolioView({ companies, onOpenCompany, onNotice }: { companies: PortfolioCompany[]; onOpenCompany: (companyId: string) => void; onNotice: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<"全部" | DealStage>("全部");
  const stages: Array<"全部" | DealStage> = ["全部", "初步接触", "商业尽调", "投决中", "已交割", "退出中"];
  const visibleCompanies = companies.filter((company) => (stage === "全部" || company.currentDeal.stage === stage) && `${company.name}${company.sector}${company.currentDeal.owner}${company.currentDeal.source}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="investment-portfolio-page">
    <header className="investment-page-header">
      <div><small>公司管理</small><h1>投资组合</h1><p>{companies.length} 家公司 · 覆盖投前、投决、投后与退出</p></div>
      <button type="button" className="investment-primary" onClick={() => onNotice("新项目录入流程已准备好")}>＋ 录入新项目</button>
    </header>
    <section className="investment-portfolio-overview">
      <article><small>在管项目</small><strong>5</strong><em>3 个本周有更新</em></article>
      <article><small>投前项目</small><strong>3</strong><em>覆盖接触、调研和投决</em></article>
      <article><small>已投企业</small><strong>2</strong><em>含 1 家退出观察</em></article>
      <article><small>调研材料</small><strong>109</strong><em>来自 3 个数据源</em></article>
    </section>
    <div className="investment-portfolio-toolbar">
      <label>{icons.search}<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索公司、行业或负责人" /></label>
      <div>{stages.map((item) => <button type="button" key={item} className={stage === item ? "active" : ""} onClick={() => setStage(item)}>{item}</button>)}</div>
    </div>
    <div className="investment-company-table" role="table" aria-label="投资公司列表">
      <header role="row"><span>公司</span><span>当前交易</span><span>交易阶段</span><span>项目来源 / 最近接触</span><span>下一步动作</span><span>负责人</span></header>
      {visibleCompanies.map((company) => <button type="button" role="row" key={company.id} onClick={() => onOpenCompany(company.id)}>
        <span className="investment-company-name"><i>{company.initials}</i><span><strong>{company.name}</strong><small>{company.sector} · {company.companyStatus}</small></span></span>
        <span className="investment-company-metric"><strong>{company.currentDeal.round}</strong><small>{company.metric} {company.metricLabel}</small></span>
        <span><em className={`stage-${company.currentDeal.stage}`}>{company.currentDeal.stage}</em></span>
        <span className="investment-company-contact-meta"><strong>{company.currentDeal.source}</strong><small>最近接触 {company.currentDeal.lastContact}</small></span>
        <span className="investment-company-sources"><strong>{company.currentDeal.nextAction}</strong><small>{company.currentDeal.nextActionDue} 前</small></span>
        <span className="investment-company-owner"><i>{company.currentDeal.owner.slice(0, 1)}</i>{company.currentDeal.owner}<b>›</b></span>
      </button>)}
      {visibleCompanies.length === 0 ? <p className="investment-empty">没有符合条件的公司</p> : null}
    </div>
  </section>;
}

function CompanyResearchView({ company, busy, sourceConnections, linkedSourceIds, onBack, onResearch, onOpenSource }: { company: PortfolioCompany; busy: boolean; sourceConnections: Record<InvestmentSourceId, SourceConnection>; linkedSourceIds: Set<InvestmentSourceId>; onBack: () => void; onResearch: () => void; onOpenSource: (sourceId: InvestmentSourceId) => void }) {
  const [section, setSection] = useState<CompanySection>("overview");
  const [actionDone, setActionDone] = useState(false);
  return <section className="investment-company-page">
    <button type="button" className="investment-back" onClick={onBack}>‹ 返回投资组合</button>
    <header className="investment-company-hero">
      <span>{company.initials}</span><div><small>{company.sector} · {company.location} · 成立于 {company.founded}</small><h1>{company.name}</h1><p>{company.thesis}</p><div><em>{company.companyStatus}</em><small>{company.currentDeal.round}</small><small>负责人 {company.currentDeal.owner}</small></div></div>
      <section><small>资料状态</small><strong>{company.sourceCount} 份</strong><em>3 项待补充</em><small>更新于 {company.currentDeal.updatedAt}</small></section>
      <aside><button type="button" onClick={onResearch} disabled={busy}>{icons.refresh}{busy ? "正在启动…" : "更新公司资料"}</button></aside>
    </header>
    <nav className="investment-company-tabs" aria-label="公司详情导航">
      <button type="button" className={section === "overview" ? "active" : ""} onClick={() => setSection("overview")}>概览</button>
      <button type="button" className={section === "research" ? "active" : ""} onClick={() => setSection("research")}>调研与资料</button>
      <button type="button" className={section === "investment" ? "active" : ""} onClick={() => setSection("investment")}>投资与持仓</button>
    </nav>

    {section === "overview" ? <section className="investment-company-overview">
      <div>
        <article className="investment-detail-card investment-deal-card">
          <header><div><small>CURRENT DEAL</small><h2>当前交易</h2></div><em className={`stage-${company.currentDeal.stage}`}>{company.currentDeal.stage}</em></header>
          <div className="investment-deal-fields">
            <p><small>交易轮次</small><strong>{company.currentDeal.round}</strong></p><p><small>项目负责人</small><strong>{company.currentDeal.owner}</strong></p>
            <p><small>项目来源</small><strong>{company.currentDeal.source}</strong></p><p><small>最近接触</small><strong>{company.currentDeal.lastContact}</strong></p>
          </div>
          <footer className={actionDone ? "is-done" : ""}><span><small>{actionDone ? "COMPLETED" : `NEXT ACTION · ${company.currentDeal.nextActionDue} 前`}</small><strong>{company.currentDeal.nextAction}</strong></span><button type="button" onClick={() => setActionDone((current) => !current)}>{actionDone ? "恢复待办" : "标记完成"}</button></footer>
        </article>
        <article className="investment-detail-card investment-contacts-card">
          <header><div><small>KEY RELATIONSHIPS</small><h2>关键联系人与关系</h2></div><em>{company.contacts.length} 位联系人</em></header>
          {company.contacts.map((contact) => <div key={contact.name}><span>{contact.name.slice(0, 1)}</span><p><strong>{contact.name}</strong><small>{contact.role}</small></p><p><small>内部关系人</small><strong>{contact.internalOwner}</strong></p><p><small>关系强度</small><strong>{contact.relationship}</strong></p><p><small>最近联系</small><strong>{contact.lastContact}</strong></p></div>)}
        </article>
      </div>
      <aside>
        <article className="investment-detail-card investment-profile-card"><header><div><small>COMPANY PROFILE</small><h2>公司信息</h2></div></header><dl><div><dt>公司状态</dt><dd>{company.companyStatus}</dd></div><div><dt>行业</dt><dd>{company.sector}</dd></div><div><dt>所在地</dt><dd>{company.location}</dd></div><div><dt>成立年份</dt><dd>{company.founded}</dd></div><div><dt>{company.metricLabel}</dt><dd>{company.metric}</dd></div></dl></article>
        <article className="investment-detail-card investment-activity-card"><header><div><small>RECENT ACTIVITY</small><h2>最近活动</h2></div></header><ol><li><i/><p><strong>{company.currentDeal.lastContact} · 项目沟通</strong><small>来自飞书与 Gmail 的已授权记录</small></p></li><li><i/><p><strong>{company.research[0].title}</strong><small>{company.research[0].time} · {company.research[0].source}</small></p></li></ol></article>
      </aside>
    </section> : null}

    {section === "research" ? <section className="investment-company-layout">
      <div><article className="investment-research-feed investment-research-feed-first"><header><div><small>RESEARCH TIMELINE</small><h2>公司调研</h2></div><em>{company.research.length} 项最新研究</em></header>{company.research.map((item) => <section key={item.title}><i /><div><header><strong>{item.title}</strong><em className={researchTypeClass[item.type]}>{item.type}</em></header><p>{item.summary}</p><footer><span>{item.source}</span><time>{item.time}</time></footer></div></section>)}</article></div>
      <aside><article className="investment-research-sources"><header><small>CONNECTED SOURCES</small><h2>调研数据来源</h2></header>{sourceApps.map((source) => { const connection = sourceConnections[source.id]; const connected = linkedSourceIds.has(source.id) && connection.state === "connected"; return <button type="button" key={source.id} onClick={() => onOpenSource(source.id)}><span className={`is-${source.color}`}>{source.short}</span><p><strong>{source.name}</strong><small>{connection.account ?? source.detail}</small></p><em className={`is-${connected ? "connected" : connection.state}`}>{connected && company.sourceLabels.includes(sourceLabelById[source.id]) ? "已连接" : connection.state === "loading" ? "检测中" : connection.state === "error" ? "重试" : "连接"}</em></button>; })}</article><article className="investment-research-questions"><small>RESEARCH CHECKLIST</small><h2>待补充资料</h2><ol><li>更新最近一期经营数据</li><li>补充客户与团队访谈记录</li><li>归档最新融资及股权材料</li></ol></article></aside>
    </section> : null}

    {section === "investment" ? <InvestmentRecords company={company} /> : null}
  </section>;
}

function InvestmentRecords({ company }: { company: PortfolioCompany }) {
  if (company.investments.length === 0) return <section className="investment-empty-investments"><span>¥</span><h2>尚未投资</h2><p>当前正在跟踪 {company.currentDeal.round}，交易进入交割后将在这里形成投资与持仓记录。</p><div><small>当前阶段</small><strong>{company.currentDeal.stage}</strong><small>项目来源</small><strong>{company.currentDeal.source}</strong></div></section>;
  return <section className="investment-records-page">
    <header><div><small>INVESTMENT POSITION</small><h2>投资与持仓</h2><p>公司与每笔投资记录独立管理，金额与估值均保留口径和更新时间。</p></div><span><small>累计投资</small><strong>{company.investments[0].amount}</strong></span><span><small>当前价值</small><strong>{company.investments[0].currentValue}</strong></span><span><small>MOIC</small><strong>{company.investments[0].moic}</strong></span></header>
    {company.investments.map((record) => <article key={`${record.fund}-${record.round}`}><header><div><span>{record.round}</span><p><strong>{record.fund}</strong><small>投资日期 {record.date}</small></p></div><em>已交割</em></header><dl><div><dt>投资金额</dt><dd>{record.amount}</dd></div><div><dt>投资工具</dt><dd>{record.instrument}</dd></div><div><dt>投前估值</dt><dd>{record.preMoney}</dd></div><div><dt>当前持股</dt><dd>{record.ownership}</dd></div><div><dt>当前价值</dt><dd>{record.currentValue}</dd></div><div><dt>董事席位</dt><dd>{record.boardSeat}</dd></div></dl><footer>估值口径：最近一轮融资 · 更新时间：{company.currentDeal.updatedAt}</footer></article>)}
  </section>;
}
