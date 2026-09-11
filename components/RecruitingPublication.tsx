"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { DesktopNotification } from "./DesktopNotification";
import { isJdDemoArtifact, publicationPrompt, publicationDestinations, type JdArtifact, type PublishedRecruitingJob } from "@/lib/recruiting-publication";
import { JD_PREVIEW_DURATION_MS } from "@/lib/recruiting-jd-timing";
import { encodeFilePathForApi } from "@/lib/file-paths";
import type { BrowserTaskState } from "@/lib/browser/types";

import type { WorkspaceWidgetItem } from "./DesktopWorkspaceWidgets";
import type { InsightResult } from "@/lib/insight-automation";
import type { PublicationInsightItem, WorkspaceInsightItem } from "@/lib/workspace-insights";

interface Props {
  presentation?: boolean;
  notice: string | null;
  onDismissNotice: () => void;
  insights: InsightResult[];
  browserTasks: BrowserTaskState[];
  onOpenInsight: (insight: InsightResult) => void;
  cwd: string | null;
  children: (surfaces: { notification: ReactNode; widgetInsights: WorkspaceWidgetItem[]; insightItems: WorkspaceInsightItem[] }) => ReactNode;
  viewedArtifact: JdArtifact | null;
  availableJd?: JdArtifact | null;
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

async function readTaskFailure(sessionId: string): Promise<string | undefined> {
  try {
    const data = await readJson<{ context?: { messages?: { role: string; stopReason?: string; errorMessage?: string; content?: { type: string; text?: string }[] }[] } }>(`/api/sessions/${encodeURIComponent(sessionId)}?tail=1`);
    const message = data.context?.messages?.find(item => item.role === "assistant" && item.stopReason === "error");
    return message?.errorMessage || message?.content?.filter(item => item.type === "text").map(item => item.text).join("\n");
  } catch { return undefined; }
}

// Includes both 30s website reads and the browser task's 180s execution budget.
const PUBLICATION_RESULT_TIMEOUT_MS = 270_000;

export function RecruitingPublication(props: Props) {
  const [suggestion, setSuggestion] = useState<(JdArtifact & { recognizedAt?: string }) | null>(null);
  const [completedJob, setCompletedJob] = useState<PublishedRecruitingJob | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [publicationError, setPublicationError] = useState<string | null>(null);
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
      setPublicationError(typeof saved.publicationError === "string" ? saved.publicationError : null);
      seen.current = new Set((saved.seen ?? []).map((id: string) => id === saved.suggestion?.filePath
        ? `${saved.suggestion.sessionId}:${id}` : id)); setReadInsights(saved.readInsights ?? []);
    } catch { /* Invalid optional UI state does not affect saved work. */ }
    setLoaded(true);
  }, [storageKey, props.cwd]);
  useEffect(() => {
    if (!loaded || !props.cwd) return;
    localStorage.setItem(storageKey, JSON.stringify({ suggestion, completedJob, dismissed, pending, publicationError, seen: [...seen.current], readInsights }));
  }, [storageKey, props.cwd, loaded, suggestion, completedJob, dismissed, pending, publicationError, readInsights]);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const callbacks = useRef(props);
  useEffect(() => { callbacks.current = props; });
  const path = props.viewedArtifact?.filePath;
  const candidate = props.presentation ? props.availableJd : props.viewedArtifact;
  const candidatePath = candidate?.filePath;
  const candidateTitle = candidate?.taskTitle;
  const candidateSessionId = candidate?.sessionId;
  const writtenAt = candidate?.writtenAt;
  useEffect(() => {
    if (!loaded || !path || !props.insights.some((item) => item.filePath === path)) return;
    setReadInsights((items) => items.includes(path) ? items : [...items, path]);
  }, [loaded, path, props.insights]);

  useEffect(() => {
    const artifact = callbacks.current.presentation ? callbacks.current.availableJd : callbacks.current.viewedArtifact;
    if (!loaded || !artifact || artifact.cwd !== props.cwd || !isJdDemoArtifact(artifact) || pending || preparing) return;
    const identity = `${artifact.sessionId}:${artifact.filePath}`;
    if (seen.current.has(identity)) return;
    // The persisted write-result timestamp survives reloads and keeps playback,
    // window focus and later session messages from restarting the deadline.
    if (props.presentation && !Number.isFinite(writtenAt)) return;
    const delay = props.presentation ? Math.max(0, writtenAt! + JD_PREVIEW_DURATION_MS - Date.now()) : 1400;
    const timer = setTimeout(() => {
      seen.current.add(identity);
      setSuggestion({ ...artifact, recognizedAt: new Date().toISOString() });
      setCompletedJob(null);
      setPublicationError(null);
      setDismissed(false);
    }, delay);
    return () => clearTimeout(timer);
  }, [candidatePath, candidateTitle, candidateSessionId, writtenAt, props.presentation, props.cwd, pending, preparing, loaded]);

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
      setPublicationError(message ?? null);
      if (message) { setDismissed(true); callbacks.current.onNotice(message); }
    };
    const poll = async () => {
      if (Date.now() - pending.startedAt > PUBLICATION_RESULT_TIMEOUT_MS) return settled("发布结果暂时无法确认，请在招聘网页核对岗位后再重试。");
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
        // The persisted parent outcome also covers failures before browser startup
        // and after browser completion, when the final website read/save fails.
        if (callbacks.current.presentation) {
          const failure = await readTaskFailure(pending.sessionId);
          if (cancelled) return;
          if (failure) return settled(failure);
        }
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
        if (task && ["failed", "stopped"].includes(task.status)) return settled(task.status === "stopped" ? "发布任务已停止，请核对网页中的保存结果。" : task.error || task.result || "发布未完成，请稍后重试。");
        if (!task && Date.now() - pending.startedAt > 6000) {
          const agent = await readJson<{ running?: boolean; state?: { isStreaming?: boolean } }>(`/api/agent/${pending.sessionId}`);
          if (cancelled) return;
          if (agent.running === false || agent.state?.isStreaming === false) {
            const published = await readJson<{ jobs: PublishedRecruitingJob[] }>("/api/apps/internal-recruiting");
            const job = published.jobs.find(item => item.draft === pending.draft);
            if (cancelled) return;
            if (job) { setCompletedJob(job); callbacks.current.onPublished(job, pending.sessionId); return settled(); }
            return settled("发布未完成，请稍后重试。");
          }
        }
      } catch {
        if (Date.now() - pending.startedAt > PUBLICATION_RESULT_TIMEOUT_MS) return settled("发布结果暂时无法确认，请在招聘网页核对岗位后再重试。");
      }
      if (!cancelled) timer = setTimeout(() => void poll(), 750);
    };
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [pending, props.cwd, publicationStatus]);

  const publish = async () => {
    if (!suggestion || completedJob || pending || preparing) return;
    setPreparing(true);
    setPublicationError(null);
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
      if (!sessionId && mounted.current) setPublicationError("发布任务尚未启动，请稍后重试。");
      if (sessionId && mounted.current) {
        props.onTaskStarted(sessionId);
        setPending({ sessionId, draft, startedAt: Date.now() });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "无法启动发布任务";
      setPublicationError(message);
      props.onNotice(message);
    } finally { setPreparing(false); }
  };

  const nextInsight = props.insights.find((item) => !readInsights.includes(item.filePath));
  const consumeInsight = () => {
    if (!nextInsight) return;
    setReadInsights((items) => [...items, nextInsight.filePath]);
    props.onOpenInsight(nextInsight);
  };
  const visibleNotice = props.notice;
  const publicationInsight: PublicationInsightItem | null = loaded && suggestion ? {
    kind: "publication",
    id: `publication:${suggestion.filePath}`,
    artifact: suggestion,
    stage: completedJob ? "published" : pending ? "publishing" : preparing ? "preparing" : publicationError ? "attention" : "ready",
    job: completedJob,
    includesBoss: Boolean(props.presentation || completedJob?.bossPublication),
    modified: suggestion.recognizedAt,
    title: completedJob ? "岗位发布建议 · 已完成" : publicationError && !pending && !preparing ? "岗位发布需要处理" : "已识别新创建的 JD",
    detail: completedJob ? `「${completedJob.title}」已发布到${publicationDestinations(completedJob)}。` : pending ? "正在通过招聘网页发布岗位，完成后将同步招聘进展。" : preparing ? "正在准备岗位发布，请稍候。" : publicationError || (props.presentation ? "岗位 JD 已准备好，可以发布到内部招聘系统和 BOSS 直聘。" : "岗位 JD 已准备好，可以发布到内部招聘系统。"),
    actionLabel: completedJob ? "已发布" : pending ? "正在发布…" : preparing ? "正在准备…" : "发布岗位",
    disabled: Boolean(completedJob || pending) || preparing,
    onPublish: () => void publish(),
  } : null;
  let notification: ReactNode = null;
  // Both surfaces use this same suggestion and action. Dismissing the toast
  // leaves the suggestion actionable in the desktop widget.
  if (loaded) {
    if (publicationInsight && !completedJob && !pending && !dismissed) notification = <DesktopNotification
      ariaLabel="岗位发布建议" label="需要确认" title={`AI 主动洞察：${publicationInsight.title}`}
      description={visibleNotice || publicationInsight.detail}
      action={{ label: `${publicationInsight.actionLabel} ›`, onClick: publicationInsight.onPublish, disabled: publicationInsight.disabled }}
      dismissLabel="稍后发布" onDismiss={() => setDismissed(true)}
    />;
    else if (visibleNotice) notification = <DesktopNotification
      ariaLabel="工作台通知" label="工作台动态" title={visibleNotice} autoDismiss
      dismissLabel="关闭通知" onDismiss={props.onDismissNotice}
    />;
    else if (nextInsight) notification = <DesktopNotification
      ariaLabel="洞察通知" label="AI 洞察已生成" title={nextInsight.title}
      action={{ label: "查看洞察", onClick: consumeInsight }}
      dismissLabel="稍后查看洞察" onDismiss={() => setReadInsights((items) => [...items, nextInsight.filePath])}
    />;
  }
  const insightItems: WorkspaceInsightItem[] = props.insights.map(result => ({
    kind: "report", id: result.filePath, title: result.title, detail: result.summary ?? "",
    modified: result.modified, result,
  }));
  if (publicationInsight) {
    if (!dismissed && !completedJob) insightItems.unshift(publicationInsight);
    else insightItems.push(publicationInsight);
  }
  const widgetInsights: WorkspaceWidgetItem[] = insightItems.map(item => ({
    id: item.id, title: item.title, detail: item.detail,
    ...(item.kind === "publication"
      ? { actionLabel: item.actionLabel, disabled: item.disabled, onOpen: item.onPublish }
      : { onOpen: () => props.onOpenInsight(item.result) }),
  }));
  return props.children({ notification, widgetInsights, insightItems });
}
