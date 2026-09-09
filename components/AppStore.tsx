"use client";

import "./AppStore.css";
import { AppBrandImage } from "./AppBrandImage";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Bot, Compass, Database, PackageCheck, PanelsTopLeft, Search, Store, type LucideIcon } from "lucide-react";
import { getLaunchpadApps, type LaunchpadApp } from "@/lib/launchpad-apps";
import type { AppStoreCatalogResponse, AppStorePackage } from "@/lib/app-store-types";

type StoreSection = "discover" | "data" | "office" | "tools" | "installed";

const SECTIONS: Array<{ id: StoreSection; label: string; icon: LucideIcon }> = [
  { id: "discover", label: "发现", icon: Compass },
  { id: "data", label: "数据源", icon: Database },
  { id: "office", label: "办公应用", icon: PanelsTopLeft },
  { id: "tools", label: "Agent 工具", icon: Bot },
  { id: "installed", label: "已安装", icon: PackageCheck },
];

export function AppStoreBrandIcon({ className = "" }: { className?: string }) {
  return <span className={`agent-store-brand-icon ${className}`.trim()} aria-hidden="true">
    <Store className="agent-store-brand-glyph" size={28} strokeWidth={2} focusable="false"/>
  </span>;
}

function StoreIcon({ item, large = false }: { item: AppStorePackage; large?: boolean }) {
  return <span className={`agent-store-icon is-${item.connectionId ?? "app"}${large ? " is-large" : ""}`} aria-hidden="true">
    <AppBrandImage appId={item.connectionId} src={item.logoUrl}/>
  </span>;
}

function displayDescription(item: AppStorePackage): string {
  return item.description
    .replace(/\bPi\s+(?:coding\s+agent\s+)?extension\b/gi, "Syntropic app")
    .replace(/\bplugin\b/gi, "app");
}

export function AppStore({ onOpenApp, onNotice }: {
  onOpenApp: (app: LaunchpadApp) => void;
  onNotice: (message: string) => void;
}) {
  const [section, setSection] = useState<StoreSection>("discover");
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<AppStoreCatalogResponse | null>(null);
  const [installedConnectors, setInstalledConnectors] = useState<Set<string>>(() => new Set(["feishu"]));
  const [selected, setSelected] = useState<AppStorePackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selected) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = detailRef.current;
    dialog?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => previousFocus?.focus();
  }, [selected]);

  const installedNames = useMemo(() => new Set([...installedConnectors].map((id) => `cn.agentos.${id}`)), [installedConnectors]);

  const loadInstallations = useCallback(async () => {
    const response = await fetch("/api/app-store/installations", { cache: "no-store" });
    const data = await response.json() as { installed?: string[]; builtins?: string[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "无法读取已安装应用");
    setInstalledConnectors(new Set([...(data.builtins ?? []), ...(data.installed ?? [])]));
  }, []);

  useEffect(() => {
    void loadInstallations().catch(() => undefined);
  }, [loadInstallations]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (query.trim()) params.set("name", query.trim());
      void fetch(`/api/app-store?${params}`, { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          const data = await response.json() as AppStoreCatalogResponse & { error?: string };
          if (!response.ok) throw new Error(data.error ?? "应用市场暂时不可用");
          setCatalog(data);
        })
        .catch((fetchError: unknown) => {
          if (!controller.signal.aborted) setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, query ? 280 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, refreshRevision]);

  const visiblePackages = useMemo(() => {
    if (section === "installed") {
      return (catalog?.packages ?? []).filter((item) => installedNames.has(item.packageName));
    }
    const items = catalog?.packages ?? [];
    if (section === "office") return items.filter((item) => item.category === "企业协同");
    if (section === "data") return items.filter((item) => item.category === "金融数据" || item.category === "法律服务");
    if (section === "tools") return items.filter((item) => item.types.some((type) => type === "skill" || type === "extension"));
    return items;
  }, [catalog, installedNames, section]);

  const install = async (item: AppStorePackage) => {
    if (installedNames.has(item.packageName) || installing) return;
    setInstalling(item.packageName);
    try {
      if (item.delivery !== "connector" || !item.connectionId) return;
      const response = await fetch("/api/app-store/installations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId: item.connectionId }),
      });
      const data = await response.json() as { installed?: string[]; builtins?: string[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "安装失败");
      setInstalledConnectors(new Set([...(data.builtins ?? ["feishu"]), ...(data.installed ?? [])]));
      window.dispatchEvent(new CustomEvent("agent-os:apps-changed"));
      onNotice(`${item.name} 已安装，并已加入启动台`);
    } catch (installError) {
      onNotice(installError instanceof Error ? installError.message : String(installError));
    } finally {
      setInstalling(null);
    }
  };

  const openInstalled = (item: AppStorePackage) => {
    const app = getLaunchpadApps([], [...installedConnectors]).find((candidate) => candidate.appearance === item.connectionId);
    if (app) onOpenApp(app);
  };

  const isDiscovery = section === "discover" && !query.trim() && !showAll;
  const hero = catalog?.packages.find((item) => item.connectionId === "feishu");
  const list = isDiscovery ? visiblePackages.slice(0, 6) : visiblePackages;
  const sectionLabel = SECTIONS.find((item) => item.id === section)?.label;
  const listTitle = query.trim() ? "搜索结果" : isDiscovery ? "团队常用" : showAll && section === "discover" ? "全部应用" : sectionLabel;
  const selectSection = (id: StoreSection) => { setSection(id); setShowAll(false); };
  const refresh = () => {
    void loadInstallations().catch((reason: unknown) => onNotice(reason instanceof Error ? reason.message : "无法读取已安装应用"));
    setRefreshRevision((value) => value + 1);
  };
  const actionLabel = (item: AppStorePackage) => installing === item.packageName ? "安装中…" : installedNames.has(item.packageName) ? "打开" : "安装";
  const navButton = (item: typeof SECTIONS[number]) => <button key={item.id} type="button" aria-current={section === item.id ? "page" : undefined} onClick={() => selectSection(item.id)} title={item.label} aria-label={item.label}>
    <span className="agent-store-nav-icon"><item.icon className="agent-store-ui-icon" size={20} strokeWidth={2} aria-hidden="true" focusable="false"/></span><span>{item.label}</span>
  </button>;

  return <div className="agent-store">
    <aside className="agent-store-sidebar">
      <header><AppStoreBrandIcon className="agent-store-mark"/><strong>应用市场</strong></header>
      <nav aria-label="应用市场分类"><small>探索</small>{SECTIONS.filter((item) => item.id !== "installed").map(navButton)}</nav>
      <nav aria-label="我的空间"><small>我的空间</small>{SECTIONS.filter((item) => item.id === "installed").map(navButton)}</nav>
      <footer><strong>让 Agent 理解你的团队</strong><p>连接常用应用，给工作流补充真实上下文。</p></footer>
    </aside>

    <main className="agent-store-main">
      <div className="agent-store-scroll" aria-busy={loading}>
        <header className="agent-store-title">
          <h1>{section === "installed" ? "你的应用" : "扩展 Syntropic"}</h1>
          <p>{section === "installed" ? "这里汇总你已经安装的所有应用。" : "连接团队正在使用的工具，让 Agent 在授权范围内理解上下文并完成工作。"}</p>
          <label className="agent-store-search"><Search className="agent-store-ui-icon agent-store-search-icon" size={20} strokeWidth={2} aria-hidden="true" focusable="false"/><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索应用与数据源" aria-label="搜索应用与数据源"/></label>
        </header>

        {loading && !catalog ? <div className="agent-store-state" role="status"><span/>正在加载应用目录…</div> : null}
        {error ? <div className="agent-store-state is-error" role="alert"><strong>无法载入应用目录</strong><small>{error}</small><button type="button" onClick={refresh}>重新加载</button></div> : null}

        {!error && hero && isDiscovery ? <section className="agent-store-hero">
          <h2>让工作上下文自然流入 Syntropic</h2>
          <p>连接飞书文档、会议、任务与多维表格。Agent 可以搜索、引用和更新内容，并保留每一次操作记录。</p>
          <button type="button" onClick={() => setSelected(hero)}>查看飞书插件 <span aria-hidden="true">↗</span></button>
        </section> : null}

        {!error && list.length ? <section className="agent-store-featured" aria-label={listTitle}>
          <header><h2>{listTitle}</h2>{isDiscovery ? <button type="button" onClick={() => setShowAll(true)}>查看全部</button> : <span aria-live="polite">{loading ? "搜索中…" : `${list.length} 个应用`}</span>}</header>
          <div className="agent-store-grid">{list.map((item) => <article key={item.packageName}>
            <button className="agent-store-card-info" type="button" onClick={() => setSelected(item)} aria-label={`查看${item.name}详情`}>
              <StoreIcon item={item}/><span><strong>{item.name}</strong><small>{item.author}</small></span>
              <p>{displayDescription(item)}</p>
            </button>
            <button className="agent-store-install" type="button" disabled={!!installing} aria-label={`${actionLabel(item)}${item.name}`} onClick={() => installedNames.has(item.packageName) ? openInstalled(item) : void install(item)}>{actionLabel(item)}</button>
          </article>)}</div>
        </section> : null}
        {!loading && !error && !list.length ? <div className="agent-store-state" role="status"><strong>{section === "tools" && !query.trim() ? "暂无 Agent 工具" : "没有找到应用"}</strong><small>{section === "tools" && !query.trim() ? "新的 Agent 工具将在这里上架。" : "换一个关键词或分类试试。"}</small></div> : null}
      </div>
    </main>

    {selected ? <div className="agent-store-detail" role="dialog" aria-modal="true" aria-label={`${selected.name}详情`} ref={detailRef}
      onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.stopPropagation(); setSelected(null); }
        if (event.key !== "Tab") return;
        const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]"));
        const first = focusable[0]; const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}><article>
      <button className="agent-store-detail-close" type="button" aria-label="关闭详情" onClick={() => setSelected(null)}>×</button>
      <header><StoreIcon item={selected} large/><div><h2>{selected.name}</h2><p>{selected.author}</p><small>{selected.delivery === "builtin" ? "Syntropic 内置应用" : selected.category}</small></div><button className="agent-store-install" type="button" disabled={!!installing} onClick={() => installedNames.has(selected.packageName) ? openInstalled(selected) : void install(selected)}>{actionLabel(selected)}</button></header>
      <p>{displayDescription(selected)}</p>
      {selected.capabilities?.length ? <div className="agent-store-capabilities">{selected.capabilities.map((capability) => <span key={capability}>{capability}</span>)}</div> : null}
      <div className="agent-store-detail-meta"><span><small>兼容性</small><strong>Syntropic</strong></span><span><small>更新</small><strong>{selected.updatedLabel}</strong></span><span><small>来源</small><strong>{selected.author}</strong></span></div>
      <footer><a href={selected.catalogUrl} target="_blank" rel="noreferrer">查看接入文档 ↗</a></footer>
    </article></div> : null}
  </div>;
}
