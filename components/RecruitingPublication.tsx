"use client";

import { useEffect, useRef, useState } from "react";
import { SyntropicMark } from "./SyntropicMark";
import { encodeFilePathForApi } from "@/lib/file-paths";
import { isJdDemoArtifact, publicationPrompt, type JdArtifact, type PublishedRecruitingJob } from "@/lib/recruiting-publication";
import type { BrowserTaskState } from "@/lib/browser/types";

interface Props {
  cwd: string;
  viewedArtifact: JdArtifact | null;
  onStartTask: (message: string) => Promise<string | null>;
  onTaskStarted: (sessionId: string) => void;
  onPublished: (job: PublishedRecruitingJob, sessionId: string) => void;
  onSettled: (sessionId: string) => void;
  onNotice: (message: string) => void;
}

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "暂时无法读取发布信息");
  return data as T;
}

export function RecruitingPublication(props: Props) {
  const [suggestion, setSuggestion] = useState<JdArtifact | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [pending, setPending] = useState<{ sessionId: string; draft: string; startedAt: number } | null>(null);
  const seen = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const callbacks = useRef(props);
  useEffect(() => { callbacks.current = props; });
  const path = props.viewedArtifact?.filePath;
  const artifact = props.viewedArtifact;

  useEffect(() => {
    if (!artifact || artifact.cwd !== props.cwd || !isJdDemoArtifact(artifact) || pending || preparing || seen.current.has(artifact.filePath)) return;
    const timer = setTimeout(() => {
      seen.current.add(artifact.filePath);
      setSuggestion(artifact);
    }, 1400);
    return () => clearTimeout(timer);
  }, [path, artifact, props.cwd, pending, preparing]);

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const settled = (message?: string) => {
      if (cancelled) return;
      setPending(null);
      callbacks.current.onSettled(pending.sessionId);
      if (message) callbacks.current.onNotice(message);
    };
    const poll = async () => {
      if (Date.now() - pending.startedAt > 210000) return settled("发布结果暂时无法确认，请查看任务和招聘网页。");
      try {
        const state = await readJson<{ tasks: BrowserTaskState[] }>(`/api/browser/state?cwd=${encodeURIComponent(props.cwd)}`);
        if (cancelled) return;
        const task = state.tasks.filter((item) => item.parentSessionId === pending.sessionId).at(-1);
        if (task?.status === "completed") {
          const data = await readJson<{ jobs: PublishedRecruitingJob[] }>("/api/apps/internal-recruiting");
          if (cancelled) return;
          const job = data.jobs.find((item) => item.draft === pending.draft);
          if (!job) return settled("浏览器任务已结束，但没有找到对应的已发布岗位，请核对网页。");
          setSuggestion(null);
          callbacks.current.onPublished(job, pending.sessionId);
          settled();
          return;
        }
        if (task && ["failed", "stopped"].includes(task.status)) return settled(task.status === "stopped" ? "发布任务已停止，请核对网页中的保存结果。" : "发布未完成，可以重试或查看任务详情。");
        if (!task && Date.now() - pending.startedAt > 6000) {
          const agent = await readJson<{ running?: boolean; state?: { isStreaming?: boolean } }>(`/api/agent/${pending.sessionId}`);
          if (cancelled) return;
          if (agent.running === false || agent.state?.isStreaming === false) return settled("任务已结束，但尚未完成网页发布，可以重试。");
        }
      } catch {
        if (Date.now() - pending.startedAt > 210000) return settled("发布结果暂时无法确认，请查看任务和招聘网页。");
      }
      if (!cancelled) timer = setTimeout(() => void poll(), 750);
    };
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [pending, props.cwd]);

  const publish = async () => {
    if (!suggestion || pending || preparing) return;
    setPreparing(true);
    try {
      const [file, site] = await Promise.all([
        readJson<{ content: string }>(`/api/files/${encodeFilePathForApi(suggestion.filePath)}?type=read`),
        readJson<{ baseUrl: string }>("/api/apps/internal-recruiting"),
      ]);
      if (!mounted.current) return;
      let text = file.content.trim();
      let title = text.match(/^#\s+(.+)$/m)?.[1] || "高级 AI Agent 研发工程师";
      if (/\.html?$/i.test(suggestion.filePath)) {
        const document = new DOMParser().parseFromString(text, "text/html");
        title = document.querySelector("h1")?.textContent?.trim() || document.title || title;
        document.querySelectorAll("script,style,nav,button").forEach((element) => element.remove());
        document.querySelectorAll("p,li,h1,h2,h3,br,section,div").forEach((element) => element.append(document.createTextNode("\n")));
        text = (document.body.textContent || "").replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n\n").trim();
      }
      if (!text || text.length > 9000) throw new Error("JD 正文为空或过长，请先在成果中调整后发布。");
      const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${suggestion.cwd}\n${suggestion.filePath}`));
      const draft = Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
      const url = new URL("/jobs/new", site.baseUrl);
      url.searchParams.set("draft", draft);
      if (!mounted.current) return;
      const sessionId = await props.onStartTask(publicationPrompt(url.href, title, text));
      if (sessionId && mounted.current) {
        props.onTaskStarted(sessionId);
        setPending({ sessionId, draft, startedAt: Date.now() });
        void fetch(`/api/agent/${sessionId}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "set_session_name", name: `发布岗位 · ${title}` }),
        }).catch(() => { /* The task itself remains available if naming fails. */ });
      }
    } catch (error) {
      props.onNotice(error instanceof Error ? error.message : "无法启动发布任务");
    } finally { setPreparing(false); }
  };

  if (!suggestion || pending) return null;
  return <aside className="agent-os-insight-notification agent-os-jd-notification" aria-label="岗位发布建议">
    <span><SyntropicMark size={25}/></span>
    <span><small className="label">需要确认</small><strong>AI 主动洞察：已识别新创建的 JD</strong><small>岗位 JD 已准备好，可以发布到内部招聘系统。</small></span>
    <button type="button" onClick={() => void publish()} disabled={preparing}>{preparing ? "正在准备…" : "发布岗位"}<span aria-hidden="true"> ›</span></button>
    <button type="button" className="jd-dismiss" aria-label="稍后发布" onClick={() => setSuggestion(null)}>×</button>
  </aside>;
}
