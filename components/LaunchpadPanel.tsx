"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { GridList, GridListItem } from "react-aria-components/GridList";
import { Search, X, ArrowUpRight, LayoutGrid } from "lucide-react";
import "./LaunchpadPanel.css";

interface LauncherItem {
  id: string;
  name: string;
  description: string;
  category: string;
}

export function LaunchpadPanel<T extends LauncherItem>({ apps, categories, loading, error, onClose, onOpenApp, renderIcon, searchText }: {
  apps: T[];
  categories: string[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onOpenApp: (app: T) => void;
  renderIcon: (app: T) => ReactNode;
  searchText: (app: T) => string;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const availableCategories = categories.filter(item => item === "全部" || apps.some(app => app.category === item));
  // A removed app can also remove the active category while the panel is open.
  const activeCategory = availableCategories.includes(category) ? category : "全部";
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleApps = apps.filter(app => (activeCategory === "全部" || app.category === activeCategory)
    && (!normalizedQuery || `${app.name} ${app.description} ${searchText(app)}`.toLocaleLowerCase().includes(normalizedQuery)));

  useEffect(() => {
    searchRef.current?.focus({ preventScroll: true });
  }, []);

  const focusFirstApp = () => gridRef.current?.querySelector<HTMLElement>('[role="row"]')?.focus();

  return <div className="agent-os-launchpad" onMouseDown={event => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section className="launchpad-panel" role="dialog" aria-label="启动台" aria-busy={loading} onKeyDown={event => {
      if (event.key === "Escape" && !event.nativeEvent.isComposing) {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    }}>
      <header className="launchpad-heading">
        <div><span className="launchpad-heading-icon" aria-hidden="true"><LayoutGrid size={18}/></span><h1>应用</h1></div>
        <button className="launchpad-close" type="button" onClick={onClose} aria-label="关闭启动台"><X size={17}/></button>
      </header>
      <div className="launchpad-search">
        <Search size={21} aria-hidden="true"/>
        <input ref={searchRef} value={query} placeholder="搜索应用" aria-label="搜索应用" autoComplete="off" spellCheck={false}
          onChange={event => { setQuery(event.target.value); gridRef.current?.scrollTo({ top: 0 }); }}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "ArrowDown" && visibleApps.length) {
              event.preventDefault();
              focusFirstApp();
            } else if (event.key === "Enter" && visibleApps.length) {
              event.preventDefault();
              onOpenApp(visibleApps[0]);
            }
          }}/>
        {query ? <button type="button" onClick={() => { setQuery(""); searchRef.current?.focus(); }} aria-label="清除搜索"><X size={15}/></button>
          : null}
      </div>
      <nav className="launchpad-categories" aria-label="应用分类">
        {availableCategories.map(item => <button key={item} type="button" aria-pressed={activeCategory === item}
          onClick={event => { setCategory(item); gridRef.current?.scrollTo({ top: 0 }); event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" }); }}>{item}</button>)}
      </nav>
      {error ? <p className="launchpad-error" role="alert">{error}</p> : null}
      <GridList ref={gridRef} className="agent-os-launchpad-grid" aria-label="应用"
        layout="grid" selectionMode="none" items={visibleApps} onAction={id => {
          const app = visibleApps.find(app => app.id === id);
          if (app) onOpenApp(app);
        }}
        renderEmptyState={() => <div className="launchpad-empty">
          <Search size={30} aria-hidden="true"/>
          <strong>{loading ? "正在载入应用…" : "没有匹配的应用"}</strong>
          {!loading ? <span>试试其他名称，或切换应用分类</span> : null}
        </div>}>
        {app => <GridListItem id={app.id} textValue={app.name} className="agent-os-launchpad-app" aria-label={`打开 ${app.name}`}>
          {renderIcon(app)}
          <strong title={app.name}>{app.name}</strong>
        </GridListItem>}
      </GridList>
      <footer className="launchpad-footer">
        <span role="status">{loading ? "正在载入应用…" : `${visibleApps.length} 个应用`}</span>
        <span className="launchpad-keyboard-hints" aria-hidden="true"><span><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd>选择</span><span><kbd>↵</kbd>打开</span></span>
        <span className="launchpad-footer-signature">Syntropic <ArrowUpRight size={12} aria-hidden="true"/></span>
      </footer>
    </section>
  </div>;
}
