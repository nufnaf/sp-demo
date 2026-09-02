"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { getInstalledLaunchpadApps, getPluginPackageName, type LaunchpadApp } from "@/lib/launchpad-apps";
import type { AppStoreCatalogResponse, AppStorePackage } from "@/lib/app-store-types";
import type { PluginPackageInfo, PluginsResponse } from "@/lib/api-types";

type StoreSection = "discover" | "popular" | "new" | "installed";

const SECTIONS: Array<{ id: StoreSection; label: string }> = [
  { id: "discover", label: "发现" },
  { id: "popular", label: "热门排行" },
  { id: "new", label: "最近上架" },
  { id: "installed", label: "已安装" },
];

type StoreIconKind = "agent" | "code" | "globe" | "lens" | "memory" | "question" | "research" | "shield" | "tasks" | "workflow" | "app";

function storeIconKind(item: AppStorePackage): StoreIconKind {
  const value = `${item.packageName} ${item.name} ${item.description}`.toLowerCase();
  if (/web|browser|url|fetch|search|mcp/.test(value)) return "globe";
  if (/subagent|agent|delegate|fleet/.test(value)) return "agent";
  if (/question|ask|interview/.test(value)) return "question";
  if (/todo|task|goal|plan/.test(value)) return "tasks";
  if (/lens|review|lint|feedback|inspect/.test(value)) return "lens";
  if (/memory|context|knowledge/.test(value)) return "memory";
  if (/research|paper|feynman/.test(value)) return "research";
  if (/security|safety|permission|guard/.test(value)) return "shield";
  if (/workflow|dynamic|orchestrat/.test(value)) return "workflow";
  if (/code|edit|github|figma|linear|slack|notion|google|developer/.test(value)) return "code";
  return "app";
}

function StoreGlyph({ kind }: { kind: StoreIconKind }) {
  const paths: Record<StoreIconKind, ReactNode> = {
    agent: <><circle cx="10" cy="10" r="3"/><circle cx="22" cy="10" r="3"/><path d="M5 24c.8-4 2.5-6 5-6s4.2 2 5 6M17 24c.8-4 2.5-6 5-6s4.2 2 5 6M16 7v6"/></>,
    code: <><path d="m12 9-6 7 6 7M20 9l6 7-6 7M18 5l-4 22"/></>,
    globe: <><circle cx="16" cy="16" r="11"/><path d="M5 16h22M16 5c3 3 4.5 6.7 4.5 11S19 24 16 27M16 5c-3 3-4.5 6.7-4.5 11S13 24 16 27"/></>,
    lens: <><circle cx="14" cy="14" r="7"/><path d="m19.5 19.5 7 7M11 14l2 2 4-5"/></>,
    memory: <><path d="M11 7a5 5 0 0 0-5 5c0 1 .3 2 .8 2.8A5 5 0 0 0 10 23h3M21 7a5 5 0 0 1 5 5c0 1-.3 2-.8 2.8A5 5 0 0 1 22 23h-3M16 5v22M11 11h5M16 16h5M11 21h5"/></>,
    question: <><path d="M10 11a6 6 0 1 1 9 5.2c-2 1-3 2.2-3 4.3M16 26h.01"/></>,
    research: <><path d="M7 6h8c2 0 3 1 3 3v17H10c-2 0-3-1-3-3ZM25 6h-8c-2 0-3 1-3 3v17h8c2 0 3-1 3-3Z"/><path d="M11 11h4M21 11h-4"/></>,
    shield: <><path d="M16 4 26 8v7c0 6.5-4 10.5-10 13-6-2.5-10-6.5-10-13V8Z"/><path d="m11 16 3 3 7-8"/></>,
    tasks: <><rect x="7" y="5" width="18" height="23" rx="4"/><path d="M11 12h10M11 17h10M11 22h6M12 5V3h8v2"/></>,
    workflow: <><circle cx="8" cy="8" r="3"/><circle cx="24" cy="8" r="3"/><circle cx="16" cy="24" r="3"/><path d="M11 8h10M10 10l4 10M22 10l-4 10"/></>,
    app: <><rect x="5" y="5" width="9" height="9" rx="3"/><rect x="18" y="5" width="9" height="9" rx="3"/><rect x="5" y="18" width="9" height="9" rx="3"/><rect x="18" y="18" width="9" height="9" rx="3"/></>,
  };
  return <svg viewBox="0 0 32 32" aria-hidden="true">{paths[kind]}</svg>;
}

function StoreNavIcon({ section }: { section: StoreSection }) {
  const paths: Record<StoreSection, ReactNode> = {
    discover: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/><path d="m19 16 .9 2.6 2.6.9-2.6.9L19 24l-.9-2.6-2.6-.9 2.6-.9Z"/></>,
    popular: <><path d="M5 19 19 5M10 5h9v9"/><path d="M5 12v7h7"/></>,
    new: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    installed: <path d="m5 12 4 4L19 6"/>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[section]}</svg>;
}

export function AppStoreBrandIcon({ className = "" }: { className?: string }) {
  return <span className={`agent-store-brand-icon ${className}`.trim()} aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M7.5 25.5 16 6.5l8.5 19M10.8 18.2h10.4"/></svg></span>;
}

function installedFallback(plugin: PluginPackageInfo): AppStorePackage {
  const packageName = getPluginPackageName(plugin);
  const launchpadApp = getInstalledLaunchpadApps([plugin])[0];
  const unscoped = packageName.split("/").at(-1) ?? packageName;
  return {
    packageName,
    source: plugin.source,
    name: launchpadApp?.name ?? unscoped.replace(/^pi[-_]/i, "").split(/[-_]+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "),
    description: launchpadApp?.description ?? "已安装的 Pi Agent 应用",
    author: packageName.startsWith("@") ? packageName.slice(1).split("/")[0] : "Pi Community",
    monthlyDownloads: 0,
    downloadsLabel: "已安装",
    updatedLabel: plugin.version ? `v${plugin.version}` : "当前版本",
    types: plugin.counts.extensions ? ["extension"] : plugin.counts.skills ? ["skill"] : ["package"],
    catalogUrl: `https://pi.dev/packages/${packageName}`,
    npmUrl: `https://www.npmjs.com/package/${packageName}`,
  };
}

function StoreIcon({ item, large = false }: { item: AppStorePackage; large?: boolean }) {
  const kind = storeIconKind(item);
  return <span className={`agent-store-icon is-${kind}${large ? " is-large" : ""}`} aria-hidden="true"><StoreGlyph kind={kind}/></span>;
}

function displayDescription(item: AppStorePackage): string {
  return item.description
    .replace(/\bPi\s+(?:coding\s+agent\s+)?extension\b/gi, "Agent OS app")
    .replace(/\bplugin\b/gi, "app");
}

export function AppStore({ cwd, ensureCwd, onOpenApp, onNotice }: {
  cwd: string | null;
  ensureCwd: () => Promise<string>;
  onOpenApp: (app: LaunchpadApp) => void;
  onNotice: (message: string) => void;
}) {
  const [section, setSection] = useState<StoreSection>("discover");
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<AppStoreCatalogResponse | null>(null);
  const [plugins, setPlugins] = useState<PluginPackageInfo[]>([]);
  const [selected, setSelected] = useState<AppStorePackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const [refreshRevision, setRefreshRevision] = useState(0);

  const installedNames = useMemo(() => new Set(plugins
    .filter((plugin) => plugin.status !== "missing")
    .map(getPluginPackageName)), [plugins]);

  const loadPlugins = useCallback(async () => {
    const url = cwd ? `/api/plugins?cwd=${encodeURIComponent(cwd)}` : "/api/plugins";
    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json() as PluginsResponse & { error?: string };
    if (!response.ok) throw new Error(data.error ?? "无法读取已安装应用");
    setPlugins(data.packages);
    return data.packages;
  }, [cwd]);

  useEffect(() => {
    void loadPlugins().catch(() => undefined);
  }, [loadPlugins]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (query.trim()) params.set("name", query.trim());
      if (section === "new") params.set("sort", "recent");
      else params.set("sort", "downloads");
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
  }, [query, refreshRevision, section]);

  const visiblePackages = useMemo(() => {
    if (section === "installed") {
      const catalogByName = new Map((catalog?.packages ?? []).map((item) => [item.packageName, item]));
      return plugins
        .filter((plugin) => plugin.status !== "missing")
        .map((plugin) => catalogByName.get(getPluginPackageName(plugin)) ?? installedFallback(plugin))
        .filter((item) => !query.trim() || `${item.name} ${item.packageName} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase()));
    }
    return catalog?.packages ?? [];
  }, [catalog, plugins, query, section]);

  const install = async (item: AppStorePackage) => {
    if (installedNames.has(item.packageName) || installing) return;
    setInstalling(item.packageName);
    try {
      const installCwd = await ensureCwd();
      const response = await fetch("/api/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "install", source: item.source, scope: "global", cwd: installCwd }),
      });
      const data = await response.json() as PluginsResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "安装失败");
      setPlugins(data.packages);
      window.dispatchEvent(new CustomEvent("agent-os:apps-changed"));
      onNotice(`${item.name} 已安装，并已加入启动台`);
    } catch (installError) {
      onNotice(installError instanceof Error ? installError.message : String(installError));
    } finally {
      setInstalling(null);
    }
  };

  const openInstalled = (item: AppStorePackage) => {
    const app = getInstalledLaunchpadApps(plugins).find((candidate) => getPluginPackageName(candidate.plugin) === item.packageName);
    if (app) onOpenApp(app);
  };

  const hero = visiblePackages[0];
  const list = section === "discover" && !query ? visiblePackages.slice(1) : visiblePackages;

  return <div className="agent-store">
    <aside className="agent-store-sidebar">
      <header><AppStoreBrandIcon className="agent-store-mark"/><div><strong>应用商店</strong><small>Agent OS Apps</small></div></header>
      <label className="agent-store-sidebar-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索应用" aria-label="搜索应用商店"/></label>
      <nav aria-label="应用商店分类">{SECTIONS.map((item) => <button key={item.id} type="button" aria-current={section === item.id ? "page" : undefined} onClick={() => setSection(item.id)}><i><StoreNavIcon section={item.id}/></i><span>{item.label}</span></button>)}</nav>
      <footer><span>π</span><div><strong>应用目录</strong><small>{catalog ? `${catalog.total.toLocaleString()} 个应用` : "正在同步"}</small></div><button type="button" aria-label="同步应用目录" title="同步应用目录" onClick={() => { void loadPlugins(); setRefreshRevision((value) => value + 1); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 9a7 7 0 0 1 11.8-2L20 9M4 15l2.1 2a7 7 0 0 0 11.8-2"/></svg></button></footer>
    </aside>

    <main className="agent-store-main">
      <div className="agent-store-scroll">
        <header className="agent-store-title"><small>{SECTIONS.find((item) => item.id === section)?.label}</small><h1>{section === "installed" ? "你的应用" : query ? `“${query}”的搜索结果` : "让 Pi Agent 更懂你的工作"}</h1><p>{section === "installed" ? "这里汇总你已经安装的所有应用。" : "探索 Agent OS 应用，安装后会自动出现在启动台。"}</p></header>

        {loading && !catalog ? <div className="agent-store-state"><span/>正在同步 Pi 应用目录…</div> : null}
        {error ? <div className="agent-store-state is-error"><strong>无法载入应用目录</strong><small>{error}</small></div> : null}

        {!error && hero && section === "discover" && !query ? <button className="agent-store-hero" type="button" onClick={() => setSelected(hero)}>
          <span><small>编辑精选 · Agent OS 应用</small><h2>{hero.name}</h2><p>{displayDescription(hero)}</p><em>{hero.downloadsLabel} · 社区热门</em></span>
          <StoreIcon item={hero} large/>
        </button> : null}

        {!error && list.length ? <section className="agent-store-featured"><header><h2>{section === "installed" ? "已安装" : section === "new" ? "最新发布" : "热门应用"}</h2><span>{list.length} 个结果</span></header><div className="agent-store-grid">{list.map((item) => {
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
      <div className="agent-store-detail-meta"><span><small>兼容性</small><strong>Agent OS</strong></span><span><small>更新</small><strong>{selected.updatedLabel}</strong></span><span><small>来源</small><strong>社区应用目录</strong></span></div>
      <footer><a href={selected.catalogUrl} target="_blank" rel="noreferrer">在 pi.dev 查看</a><a href={selected.npmUrl} target="_blank" rel="noreferrer">npm</a>{selected.repositoryUrl ? <a href={selected.repositoryUrl} target="_blank" rel="noreferrer">源代码</a> : null}</footer>
    </article></section> : null}
  </div>;
}
