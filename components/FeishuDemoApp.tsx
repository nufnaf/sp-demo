"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AudioLines, BookOpen, File, Layers, Sheet, type LucideIcon } from "lucide-react";
import type { DemoDocument } from "@/lib/feishu-demo-client";
import { PresentationSchedule } from "./RecruitingPipeline";
import "./FeishuApp.css";

const sections = ["最近使用", "会议", "团队空间", "与我共享", "收藏"] as const;
type Section = typeof sections[number];
const favoriteKey = "syntropic:feishu:favorites";

// The resource API supplies type and readability independently: a docx may be
// list-only. Missing readability keeps the existing docx-only API compatible.
type FeishuListResource = Omit<DemoDocument, "type"> & { type: string; readable?: boolean };
const resourceTypes = new Map<string, { label: string; tone: string; icon?: LucideIcon }>([
  ["docx", { label: "文档", tone: "document" }],
  ["sheet", { label: "电子表格", tone: "sheet", icon: Sheet }],
  ["bitable", { label: "多维表格", tone: "bitable", icon: Layers }],
  ["wiki", { label: "知识库", tone: "wiki", icon: BookOpen }],
  ["minutes", { label: "妙记", tone: "minutes", icon: AudioLines }],
]);
const genericResource = { label: "文件", tone: "file", icon: File };

function Glyph({ name }: { name: string }) {
  const paths: Record<string, string> = {
    最近使用: "M12 8v4l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    会议: "M8 3v4m8-4v4M4 10h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1",
    团队空间: "M3 7h7l2 2h9v11H3V5h7l2 2",
    与我共享: "M15 21v-3a5 5 0 0 0-10 0v3m15 0v-3a5 5 0 0 0-3-4.6M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0m3-4a4 4 0 0 1 0 8",
    收藏: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z",
    search: "m20 20-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
    document: "M14 3v6h6M14 3H4v18h16V9l-6-6M8 13h8m-8 4h6",
    refresh: "M20 7v5h-5M4 17v-5h5M5.5 7a7 7 0 0 1 12-2L20 8M4 16l2.5 3a7 7 0 0 0 12-2",
  };
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.document}/></svg>;
}
function dateLabel(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return "—";
  return new Date(value).toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
}

export function FeishuDemoApp({ onOpen, recruiting = true }: { recruiting?: boolean; onOpen: (document: FeishuListResource) => void }) {
  const [documents, setDocuments] = useState<FeishuListResource[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [revision, setRevision] = useState(0);
  const [section, setSection] = useState<Section>("最近使用");
  const [favorites, setFavorites] = useState<string[]>([]);
  useEffect(() => {
    try { const saved: unknown = JSON.parse(localStorage.getItem(favoriteKey) || "[]"); if (Array.isArray(saved)) setFavorites(saved.filter((id): id is string => typeof id === "string")); } catch { /* An unavailable cache does not prevent reading documents. */ }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    void fetch("/api/apps/feishu/documents", { signal: controller.signal, cache: "no-store" }).then(async (r) => {
      const data = await r.json(); if (!r.ok) throw new Error(data.error || "暂时无法加载文档，请稍后重试。");
      if (!controller.signal.aborted) setDocuments(data.items);
    }).catch((e) => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  function toggleFavorite(id: string) {
    const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
    setFavorites(next);
    try { localStorage.setItem(favoriteKey, JSON.stringify(next)); } catch { /* Keep the current view usable without storage. */ }
  }
  const visible = documents.filter((doc) => (section !== "收藏" || favorites.includes(doc.id)) && doc.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => (b.modifiedAt || "").localeCompare(a.modifiedAt || ""));
  return <div className="feishu-workspace">
    <aside className="feishu-sidebar">
      <div className="feishu-account"><Image src="/icons/feishu-logo.svg" width={36} height={36} alt="" unoptimized/><div><strong>飞书</strong><small><i/>星流科技</small></div></div>
      <nav aria-label="飞书导航">{sections.map((item) => <button type="button" key={item} aria-current={section === item ? "page" : undefined} onClick={() => { setSection(item); setQuery(""); }}><Glyph name={item}/>{item}</button>)}</nav>
      <footer><Glyph name="团队空间"/><div><strong>团队资料</strong><small>星流科技 · 共享空间</small></div></footer>
    </aside>
    <main className="feishu-main">{section === "会议" ? <PresentationSchedule recruiting={recruiting}/> : <>
      <header className="feishu-home-header">
        <span className="feishu-eyebrow">飞书文档</span>
        <h2>{section}</h2>
        <label className="feishu-search"><Glyph name="search"/><input aria-label="搜索飞书文档" placeholder="搜索飞书文档" value={query} onChange={(e) => setQuery(e.target.value)}/></label>
        <p>连接团队正在使用的工具，让 Agent 在授权范围内理解上下文并完成工作。</p>
      </header>
      <section className="feishu-list" aria-label="文档列表"><div className="feishu-list-head"><span>文件</span><span>所属空间</span><span>最近更新</span></div>
        {error ? <div className="feishu-empty" role="alert"><Glyph name="document"/><strong>文档暂时无法加载</strong><p>{error}</p><button type="button" onClick={() => setRevision((n) => n + 1)}>重新加载</button></div>
          : loading && !documents.length ? <div className="feishu-empty" role="status"><span className="agent-os-spinner"/><p>正在加载文档…</p></div>
          : visible.length ? visible.map((doc) => {
            const resource = resourceTypes.get(doc.type) ?? genericResource;
            const ResourceIcon = resource.icon;
            const readable = doc.type === "docx" && doc.readable !== false;
            return <div className="feishu-doc-row" key={doc.id}>
            {readable && <button type="button" className="feishu-doc-open" aria-label={`打开${doc.title}`} onClick={() => onOpen(doc)}/>}
            <span className={`feishu-doc-icon is-${resource.tone}`} aria-label={resource.label}>{ResourceIcon ? <ResourceIcon size={16} strokeWidth={1.6} aria-hidden="true"/> : <Glyph name="document"/>}</span>
            <div className="feishu-doc-copy">
              <div className="feishu-doc-title"><strong title={doc.title}>{doc.title}</strong><button type="button" className="feishu-star" aria-label={`${favorites.includes(doc.id) ? "取消收藏" : "收藏"}${doc.title}`} aria-pressed={favorites.includes(doc.id)} onClick={() => toggleFavorite(doc.id)}><Glyph name="收藏"/></button></div>
              <small>{resource.label} · 团队资料</small>
            </div>
            <span className="feishu-space">星流科技</span><time dateTime={doc.modifiedAt}>{dateLabel(doc.modifiedAt)}</time>
          </div>; }) : <div className="feishu-empty"><Glyph name={query ? "search" : section === "收藏" ? "收藏" : "document"}/><strong>{query ? "没有找到文档" : section === "收藏" ? "还没有收藏的文档" : "这里还没有文档"}</strong><p>{query ? "尝试搜索其他文档名称。" : section === "收藏" ? "点击文档旁的星标，方便下次查找。" : "团队共享的资料会显示在这里。"}</p></div>}
      </section>
    </>}</main>
  </div>;
}

export function FeishuDemoDocument({ id }: { id: string }) {
  const [document, setDocument] = useState<(DemoDocument & { content: string }) | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setDocument(null); setError("");
    void fetch(`/api/apps/feishu/documents/${encodeURIComponent(id)}`, { cache: "no-store", signal: controller.signal }).then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "暂时无法加载正文。"); if (!controller.signal.aborted) setDocument(data); }).catch((e) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [id, revision]);
  return <section className="feishu-preview">{error ? <div className="feishu-empty" role="alert"><strong>文档暂时无法加载</strong><p>{error}</p><button type="button" onClick={() => setRevision((n) => n + 1)}>重新加载</button></div> : !document ? <div className="feishu-empty" role="status"><span className="agent-os-spinner"/><p>正在加载文档…</p></div> : <>
    <div className="feishu-document-toolbar"><span>团队空间 / 星流科技</span><button type="button" aria-label="刷新正文" onClick={() => setRevision((n) => n + 1)}><Glyph name="refresh"/>刷新</button></div>
    <article className="feishu-document"><header><span className="feishu-doc-icon"><Glyph name="document"/></span><div><h1>{document.title}</h1><p>星流科技 · 团队资料{document.modifiedAt ? ` · 更新于 ${dateLabel(document.modifiedAt)}` : ""}</p></div></header>
      <div className="feishu-document-content">{document.content.split(/\r?\n/).filter((line, index) => line.trim() && !(index === 0 && line.trim() === document.title)).map((line, index) => line.trim().length < 30 && !/[。；，：:]/.test(line) ? <h2 key={index}>{line}</h2> : <p key={index}>{line}</p>)}</div>
    </article>
  </>}</section>;
}
