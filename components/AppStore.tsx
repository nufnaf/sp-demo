"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { getLaunchpadApps, type LaunchpadApp } from "@/lib/launchpad-apps";
import type { AppStoreCatalogResponse, AppStorePackage } from "@/lib/app-store-types";

type StoreSection = "discover" | "enterprise" | "finance" | "legal" | "installed";

const SECTIONS: Array<{ id: StoreSection; label: string }> = [
  { id: "discover", label: "发现" },
  { id: "enterprise", label: "企业协同" },
  { id: "finance", label: "金融数据" },
  { id: "legal", label: "法律服务" },
  { id: "installed", label: "已安装" },
];

function StoreNavIcon({ section }: { section: StoreSection }) {
  const paths: Record<StoreSection, ReactNode> = {
    discover: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/><path d="m19 16 .9 2.6 2.6.9-2.6.9L19 24l-.9-2.6-2.6-.9 2.6-.9Z"/></>,
    enterprise: <><rect x="4" y="7" width="16" height="13" rx="3"/><path d="M8 7V4h8v3M8 12h8M8 16h5"/></>,
    finance: <><path d="M4 19V9M9 19V5M14 19v-7M19 19V3"/><path d="M3 21h18"/></>,
    legal: <><path d="M12 3v18M6 6h12M5 21h14M6 6l-3 7h6ZM18 6l-3 7h6Z"/></>,
    installed: <path d="m5 12 4 4L19 6"/>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[section]}</svg>;
}

export function AppStoreBrandIcon({ className = "" }: { className?: string }) {
  return <span className={`agent-store-brand-icon ${className}`.trim()} aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M7.5 25.5 16 6.5l8.5 19M10.8 18.2h10.4"/></svg></span>;
}

function StoreIcon({ item, large = false }: { item: AppStorePackage; large?: boolean }) {
  return <span className={`agent-store-icon is-${item.connectionId ?? "app"}${large ? " is-large" : ""}`} aria-hidden="true">
    {/* Official brand assets are intentionally loaded without Next image optimization. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={item.logoUrl} alt="" referrerPolicy="no-referrer"/>
  </span>;
}

function displayDescription(item: AppStorePackage): string {
  return item.description
    .replace(/\bPi\s+(?:coding\s+agent\s+)?extension\b/gi, "Agent OS app")
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
          if (!response.ok) throw new Error(data.error ?? "应用商店暂时不可用");
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
    const category = section === "enterprise" ? "企业协同" : section === "finance" ? "金融数据" : section === "legal" ? "法律服务" : null;
    return category ? items.filter((item) => item.category === category) : items;
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

  const hero = visiblePackages[0];
  const list = section === "discover" && !query ? visiblePackages.slice(1) : visiblePackages;

  return <div className="agent-store">
    <aside className="agent-store-sidebar">
      <header><AppStoreBrandIcon className="agent-store-mark"/><div><strong>应用商店</strong><small>Agent OS Apps</small></div></header>
      <label className="agent-store-sidebar-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索应用" aria-label="搜索应用商店"/></label>
      <nav aria-label="应用商店分类">{SECTIONS.map((item) => <button key={item.id} type="button" aria-current={section === item.id ? "page" : undefined} onClick={() => setSection(item.id)}><i><StoreNavIcon section={item.id}/></i><span>{item.label}</span></button>)}</nav>
      <footer><span>π</span><div><strong>中国区精选</strong><small>{catalog ? `${catalog.total.toLocaleString()} 个应用` : "正在同步"}</small></div><button type="button" aria-label="同步应用目录" title="同步应用目录" onClick={() => { void loadInstallations(); setRefreshRevision((value) => value + 1); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 9a7 7 0 0 1 11.8-2L20 9M4 15l2.1 2a7 7 0 0 0 11.8-2"/></svg></button></footer>
    </aside>

    <main className="agent-store-main">
      <div className="agent-store-scroll">
        <header className="agent-store-title"><small>{SECTIONS.find((item) => item.id === section)?.label}</small><h1>{section === "installed" ? "你的应用" : query ? `“${query}”的搜索结果` : "让 Pi Agent 更懂你的工作"}</h1><p>{section === "installed" ? "这里汇总你已经安装的所有应用。" : "探索 Agent OS 应用，安装后会自动出现在启动台。"}</p></header>

        {loading && !catalog ? <div className="agent-store-state"><span/>正在同步中国区应用目录…</div> : null}
        {error ? <div className="agent-store-state is-error"><strong>无法载入应用目录</strong><small>{error}</small></div> : null}

        {!error && hero && section === "discover" && !query ? <button className="agent-store-hero" type="button" onClick={() => setSelected(hero)}>
          <span><small>中国区精选 · 官方品牌</small><h2>{hero.name}</h2><p>{displayDescription(hero)}</p><em>{hero.downloadsLabel} · 官方接入</em></span>
          <StoreIcon item={hero} large/>
        </button> : null}

        {!error && list.length ? <section className="agent-store-featured"><header><h2>{section === "installed" ? "已安装" : "精选应用"}</h2><span>{list.length} 个结果</span></header><div className="agent-store-grid">{list.map((item) => {
          const installed = installedNames.has(item.packageName);
          return <article key={item.packageName} onClick={() => setSelected(item)}>
            <StoreIcon item={item}/><div><strong>{item.name}</strong><small>{item.author} · Agent OS 应用</small><p>{displayDescription(item)}</p><em>{item.downloadsLabel} · 更新于 {item.updatedLabel}</em></div>
            <button type="button" disabled={installing === item.packageName} onClick={(event) => { event.stopPropagation(); if (installed) openInstalled(item); else void install(item); }}>{installing === item.packageName ? <span className="agent-os-spinner"/> : installed ? "打开" : "获取"}</button>
          </article>;
        })}</div></section> : null}
        {!loading && !error && !list.length ? <div className="agent-store-state"><strong>没有找到应用</strong><small>换一个关键词或分类试试。</small></div> : null}
      </div>
    </main>

    {selected ? <section className="agent-store-detail" role="dialog" aria-modal="true" aria-label={`${selected.name} 详情`} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><article>
      <button className="agent-store-detail-close" type="button" aria-label="关闭详情" onClick={() => setSelected(null)}>×</button>
      <header><StoreIcon item={selected} large/><div><h2>{selected.name}</h2><p>{selected.packageName}</p><small>{selected.author} · {selected.downloadsLabel}</small></div><button type="button" disabled={installing === selected.packageName} onClick={() => installedNames.has(selected.packageName) ? openInstalled(selected) : void install(selected)}>{installing === selected.packageName ? "安装中…" : installedNames.has(selected.packageName) ? "打开" : "获取"}</button></header>
      <p>{displayDescription(selected)}</p>
      {selected.capabilities?.length ? <div className="agent-store-capabilities">{selected.capabilities.map((capability) => <span key={capability}>{capability}</span>)}</div> : null}
      <div className="agent-store-detail-meta"><span><small>兼容性</small><strong>Agent OS</strong></span><span><small>更新</small><strong>{selected.updatedLabel}</strong></span><span><small>来源</small><strong>官方/企业连接器</strong></span></div>
      <footer><a href={selected.catalogUrl} target="_blank" rel="noreferrer">官方接入文档</a></footer>
    </article></section> : null}
  </div>;
}
