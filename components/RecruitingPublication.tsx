"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { DesktopNotification } from "./DesktopNotification";
import { isJdDemoArtifact, publicationPrompt, type JdArtifact, type PublishedRecruitingJob } from "@/lib/recruiting-publication";
import { encodeFilePathForApi } from "@/lib/file-paths";
import type { BrowserTaskState } from "@/lib/browser/types";

import type { WorkspaceWidgetItem } from "./DesktopWorkspaceWidgets";
import type { InsightResult } from "@/lib/insight-automation";

interface Props {
  presentation?: boolean;
  notice: string | null;
  onDismissNotice: () => void;
  insights: InsightResult[];
  browserTasks: BrowserTaskState[];
  onOpenInsight: (insight: InsightResult) => void;
  cwd: string | null;
  children: (surfaces: { notification: ReactNode; widgetInsights: WorkspaceWidgetItem[] }) => ReactNode;
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
  const [completedJob, setCompletedJob] = useState<PublishedRecruitingJob | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [pending, setPending] = useState<{ sessionId: string; draft: string; startedAt: number } | null>(null);
  const seen = useRef(new Set<string>());
  const [loaded, setLoaded] = useState(false);
  const [readInsights, setReadInsights] = useState<string[]>([]);
  const storageKey = `syntropic:notifications:${props.cwd}`;
  useEffect(() => {
    if (!props.cwd) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
      setCompletedJob(saved.completedJob ?? null); setDismissed(saved.dismissed === true); setSuggestion(saved.suggestion ?? null); setPending(saved.pending ?? null);
      seen.current = new Set(saved.seen ?? []); setReadInsights(saved.readInsights ?? []);
    } catch { /* Invalid optional UI state does not affect saved work. */ }
    setLoaded(true);
  }, [storageKey, props.cwd]);
  useEffect(() => {
    if (!loaded || !props.cwd) return;
    localStorage.setItem(storageKey, JSON.stringify({ suggestion, completedJob, dismissed, pending, seen: [...seen.current], readInsights }));
  }, [storageKey, props.cwd, loaded, suggestion, completedJob, dismissed, pending, readInsights]);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const callbacks = useRef(props);
  useEffect(() => { callbacks.current = props; });
  const path = props.viewedArtifact?.filePath;
  const artifactTitle = props.viewedArtifact?.taskTitle;
  useEffect(() => {
    if (!loaded || !path || !props.insights.some((item) => item.filePath === path)) return;
    setReadInsights((items) => items.includes(path) ? items : [...items, path]);
  }, [loaded, path, props.insights]);

  useEffect(() => {
    const artifact = callbacks.current.viewedArtifact;
    if (!loaded || !artifact || artifact.cwd !== props.cwd || !isJdDemoArtifact(artifact) || pending || preparing || seen.current.has(artifact.filePath)) return;
    const timer = setTimeout(() => {
      seen.current.add(artifact.filePath);
      setSuggestion(artifact);
      setCompletedJob(null);
      setDismissed(false);
    }, 1400);
    return () => clearTimeout(timer);
  }, [path, artifactTitle, props.cwd, pending, preparing, loaded]);

  useEffect(() => {
    if (!loaded || !suggestion || pending || preparing) return;
    let cancelled = false;
    const reconcile = async () => {
      try {
        const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${suggestion.cwd}\n${suggestion.filePath}`));
        const draft = Array.from(new Uint8Array(bytes)).map(byte => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
        const data = await readJson<{ jobs: PublishedRecruitingJob[] }>("/api/apps/internal-recruiting");
        if (!cancelled) setCompletedJob(data.jobs.find(job => job.draft === draft) ?? null);
      } catch { /* Keep the actionable suggestion when the site is unavailable. */ }
    };
    void reconcile();
    window.addEventListener("agent-os:presentation-changed", reconcile);
    return () => { cancelled = true; window.removeEventListener("agent-os:presentation-changed", reconcile); };
  }, [loaded, suggestion, pending, preparing]);

  const publicationStatus = props.browserTasks.filter((task) => task.parentSessionId === pending?.sessionId).at(-1)?.status;
  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const settled = (message?: string) => {
      if (cancelled) return;
      setPending(null);
      callbacks.current.onSettled(pending.sessionId);
      if (message) { setDismissed(true); callbacks.current.onNotice(message); }
    };
    const poll = async () => {
      if (Date.now() - pending.startedAt > 210000) return settled("发布结果暂时无法确认，请查看任务和招聘网页。");
      try {
        const state = await readJson<{ tasks: BrowserTaskState[] }>(`/api/browser/state?cwd=${encodeURIComponent(props.cwd ?? "")}`);
        if (cancelled) return;
        // Browser completion precedes the parent task's final website verification
        // and local save. Wait for that boundary before deciding success/failure.
        if (callbacks.current.presentation) {
          const running = await readJson<{ runningSessionIds: string[] }>("/api/agent/running");
          if (cancelled) return;
          if (running.runningSessionIds.includes(pending.sessionId)) {
            timer = setTimeout(() => void poll(), 750);
            return;
          }
        }
        const task = state.tasks.filter((item) => item.parentSessionId === pending.sessionId).at(-1);
        if (task?.status === "completed") {
          const data = await readJson<{ jobs: PublishedRecruitingJob[] }>("/api/apps/internal-recruiting");
          if (cancelled) return;
          const job = data.jobs.find((item) => item.draft === pending.draft);
          if (!job) return settled("浏览器任务已结束，但没有找到对应的已发布岗位，请核对网页。");
          setCompletedJob(job);
          callbacks.current.onPublished(job, pending.sessionId);
          settled();
          return;
        }
        if (task && ["failed", "stopped"].includes(task.status)) return settled(task.status === "stopped" ? "发布任务已停止，请核对网页中的保存结果。" : "发布未完成，可以重试或查看任务详情。");
        if (!task && Date.now() - pending.startedAt > 6000) {
          const agent = await readJson<{ running?: boolean; state?: { isStreaming?: boolean } }>(`/api/agent/${pending.sessionId}`);
          if (cancelled) return;
          if (agent.running === false || agent.state?.isStreaming === false) {
            const published = await readJson<{ jobs: PublishedRecruitingJob[] }>("/api/apps/internal-recruiting");
            const job = published.jobs.find(item => item.draft === pending.draft);
            if (cancelled) return;
            if (job) { setCompletedJob(job); callbacks.current.onPublished(job, pending.sessionId); return settled(); }
            return settled("发布未完成，请查看任务状态后重试。");
          }
        }
      } catch {
        if (Date.now() - pending.startedAt > 210000) return settled("发布结果暂时无法确认，请查看任务和招聘网页。");
      }
      if (!cancelled) timer = setTimeout(() => void poll(), 750);
    };
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [pending, props.cwd, publicationStatus]);

  const publish = async () => {
    if (!suggestion || completedJob || pending || preparing) return;
    setPreparing(true);
    try {
      const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${suggestion.cwd}\n${suggestion.filePath}`));
      const draft = Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
      let message = "发布岗位";
      // Standalone Web workspaces retain their existing general Agent flow.
      // The installed demo sends only the fixed action above.
      if (!props.presentation) {
        const [file, site] = await Promise.all([
          readJson<{ content: string }>(`/api/files/${encodeFilePathForApi(suggestion.filePath)}?type=read`),
          readJson<{ baseUrl: string }>("/api/apps/internal-recruiting"),
        ]);
        const document = /\.html?$/i.test(suggestion.filePath) ? new DOMParser().parseFromString(file.content, "text/html") : null;
        const title = document?.querySelector("h1")?.textContent?.trim() || document?.title || file.content.match(/^#\s+(.+)$/m)?.[1] || "AI Agent 工程师";
        const url = new URL("/jobs/new", site.baseUrl); url.searchParams.set("draft", draft);
        message = publicationPrompt(url.href, title, suggestion.filePath);
      }
      if (!mounted.current) return;
      const sessionId = await props.onStartTask(message);
      if (sessionId && mounted.current) {
        props.onTaskStarted(sessionId);
        setPending({ sessionId, draft, startedAt: Date.now() });
      }
    } catch (error) {
      props.onNotice(error instanceof Error ? error.message : "无法启动发布任务");
    } finally { setPreparing(false); }
  };

  const nextInsight = props.insights.find((item) => !readInsights.includes(item.filePath));
  const consumeInsight = () => {
    if (!nextInsight) return;
    setReadInsights((items) => [...items, nextInsight.filePath]);
    props.onOpenInsight(nextInsight);
  };
  const publicationInsight: WorkspaceWidgetItem | null = loaded && suggestion ? {
    id: `publication:${suggestion.filePath}`,
    title: completedJob ? "岗位发布建议 · 已完成" : "已识别新创建的 JD",
    detail: completedJob ? `「${completedJob.title}」已发布到内部招聘系统。` : pending ? "正在通过招聘网页发布岗位，完成后将同步招聘进展。" : "岗位 JD 已准备好，可以发布到内部招聘系统。",
    actionLabel: completedJob ? "已发布" : pending ? "正在发布…" : preparing ? "正在准备…" : "发布岗位",
    disabled: Boolean(completedJob || pending) || preparing,
    onOpen: () => void publish(),
  } : null;
  let notification: ReactNode = null;
  // Both surfaces use this same suggestion and action. Dismissing the toast
  // leaves the suggestion actionable in the desktop widget.
  if (loaded) {
    if (publicationInsight && !completedJob && !pending && !dismissed) notification = <DesktopNotification
      ariaLabel="岗位发布建议" label="需要确认" title={`AI 主动洞察：${publicationInsight.title}`}
      description={props.notice || publicationInsight.detail}
      action={{ label: `${publicationInsight.actionLabel} ›`, onClick: publicationInsight.onOpen, disabled: publicationInsight.disabled }}
      dismissLabel="稍后发布" onDismiss={() => setDismissed(true)}
    />;
    else if (props.notice) notification = <DesktopNotification
      ariaLabel="工作台通知" label="工作台动态" title={props.notice} autoDismiss
      dismissLabel="关闭通知" onDismiss={props.onDismissNotice}
    />;
    else if (nextInsight) notification = <DesktopNotification
      ariaLabel="洞察通知" label="AI 洞察已生成" title={nextInsight.title}
      action={{ label: "查看洞察", onClick: consumeInsight }}
      dismissLabel="稍后查看洞察" onDismiss={() => setReadInsights((items) => [...items, nextInsight.filePath])}
    />;
  }
  const widgetInsights: WorkspaceWidgetItem[] = props.insights.map(result => ({
    id: result.filePath, title: result.title, detail: result.summary ?? "",
    onOpen: () => props.onOpenInsight(result),
  }));
  if (publicationInsight) {
    if (!dismissed && !completedJob) widgetInsights.unshift(publicationInsight);
    else widgetInsights.push(publicationInsight);
  }
  return props.children({ notification, widgetInsights });
}
