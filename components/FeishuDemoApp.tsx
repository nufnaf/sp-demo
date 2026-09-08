"use client";
import { useEffect, useState } from "react";
import type { DemoDocument } from "@/lib/feishu-demo-client";
export function FeishuDemoApp({ onOpen }: { onOpen: (document: DemoDocument) => void }) {
  const [documents, setDocuments] = useState<DemoDocument[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    void fetch("/api/apps/feishu/documents", { signal: controller.signal, cache: "no-store" }).then(async (r) => {
      const data = await r.json(); if (!r.ok) throw new Error(data.error); setDocuments(data.items);
    }).catch((e) => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  return <section className="presentation-documents"><header><small>飞书 · 星流科技演示资料</small><h2>团队资料</h2><p>由专用应用从飞书读取</p><input aria-label="搜索演示资料" placeholder="搜索文档" value={query} onChange={(e) => setQuery(e.target.value)}/><button onClick={() => setRevision((n) => n + 1)}>刷新</button></header>{loading ? <p role="status">正在读取飞书资料…</p> : error ? <p role="alert">{error}</p> : documents.filter((d) => d.title.includes(query)).map((d) => <button className="presentation-document-row" key={d.id} onClick={() => onOpen(d)}><strong>{d.title}</strong><span>飞书文档 ↗</span></button>)}{!loading && !error && !documents.length && <p>授权文件夹中没有可用演示文档，请管理员检查文档白名单与阅读权限。</p>}</section>;
}
export function FeishuDemoDocument({ id }: { id: string }) {
  const [document, setDocument] = useState<{ title: string; content: string; fetchedAt: string } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController(); setDocument(null); setError("");
    void fetch(`/api/apps/feishu/documents/${encodeURIComponent(id)}`, { cache: "no-store", signal: controller.signal }).then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error); setDocument(data); }).catch((e) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [id]);
  return <article className="presentation-document">{error ? <p role="alert">{error}</p> : !document ? <p role="status">正在读取飞书正文…</p> : <><small>飞书 · 真实读取于 {new Date(document.fetchedAt).toLocaleTimeString()}</small><h1>{document.title}</h1><div style={{ whiteSpace: "pre-wrap", lineHeight: 1.9 }}>{document.content}</div></>}</article>;
}
