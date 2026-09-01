"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { AppShell } from "./AppShell";
import { FileViewer } from "./FileViewer";
import { extractTurnWrittenFiles } from "@/lib/turn-written-files";
import { getFileName } from "@/lib/file-paths";
import type { AgentMessage, SessionContext, SessionInfo, ToolResultMessage } from "@/lib/types";
import "./AgentDesktop.css";

const AgentSettingsApp = dynamic(
  () => import("./AgentSettingsApp").then((module) => module.AgentSettingsApp),
  {
    ssr: false,
    loading: () => <div className="agent-settings-loading" role="status">正在打开设置…</div>,
  },
);

type IconName =
  | "arrow-up" | "bell" | "calendar" | "chat" | "clock" | "close"
  | "eye" | "file" | "grid" | "insight" | "list" | "maximize" | "mic" | "minimize"
  | "plus" | "settings" | "spark" | "tasks" | "tiles";

const ICONS: Record<IconName, ReactNode> = {
  "arrow-up": <><path d="M12 19V5"/><path d="m6 11 6-6 6 6"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  close: <path d="m7 7 10 10M17 7 7 17"/>,
  eye: <><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.5"/></>,
  file: <><path d="M6 2h8l4 4v16H6Z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  insight: <><path d="M12 3a7 7 0 0 0-4 12.7V19h8v-3.3A7 7 0 0 0 12 3Z"/><path d="M9 22h6M9 15h6"/></>,
  maximize: <><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"/></>,
  mic: <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></>,
  minimize: <path d="M5 12h14"/>,
  list: <><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="5" cy="6" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="18" r="1"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
  spark: <><path d="m12 3 1.5 4.3L18 9l-4.5 1.7L12 15l-1.5-4.3L6 9l4.5-1.7Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z"/></>,
  tasks: <><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  tiles: <><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></>,
};

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg className="agent-os-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>;
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`agent-os-brand-mark${compact ? " compact" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M5 6.5h10.5c6 0 10 3.6 10 8.7 0 4.9-3.4 8.1-8.5 8.1h-3" stroke="currentColor" strokeWidth="5.4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5 25.5l8.4-8.2a2.9 2.9 0 0 1 4.1 0l8 8.2" stroke="currentColor" strokeWidth="5.4" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="15.45" cy="19.25" r="3.25" fill="#8ed8af"/>
      </svg>
    </span>
  );
}

interface Artifact {
  filePath: string;
  sessionId: string;
  cwd: string;
  taskTitle: string;
  modified: string;
}

interface SessionDetailResponse {
  context?: SessionContext;
}

function artifactIdentity(artifact: Artifact): string {
  return `${artifact.sessionId}:${artifact.filePath}`;
}

function taskTitle(session: SessionInfo): string {
  return session.name?.trim() || session.firstMessage?.trim() || "未命名任务";
}

function compactText(value: string, max = 64): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized;
}

function isHtmlArtifact(artifact: Artifact): boolean {
  return /\.html?$/i.test(artifact.filePath);
}

function formatArtifactModified(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function extractArtifacts(session: SessionInfo, messages: AgentMessage[]): Artifact[] {
  const results = new Map<string, ToolResultMessage>();
  for (const message of messages) {
    if (message.role === "toolResult") results.set(message.toolCallId, message);
  }
  const seen = new Set<string>();
  const artifacts: Artifact[] = [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "assistant") continue;
    for (const { filePath } of extractTurnWrittenFiles(message.content, results, session.cwd)) {
      if (seen.has(filePath)) continue;
      seen.add(filePath);
      artifacts.push({
        filePath,
        sessionId: session.id,
        cwd: session.cwd,
        taskTitle: taskTitle(session),
        modified: session.modified,
      });
    }
  }
  return artifacts;
}

function ArtifactLibrary({ artifacts, selectedId, onSelect, onOpen }: {
  artifacts: Artifact[];
  selectedId: string | null;
  onSelect: (artifact: Artifact) => void;
  onOpen: (artifact: Artifact) => void;
}) {
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [quickLookOpen, setQuickLookOpen] = useState(false);
  const [quickLookOffset, setQuickLookOffset] = useState({ x: 0, y: 0 });
  const [quickLookDragging, setQuickLookDragging] = useState(false);
  const quickLookDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null>(null);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return artifacts;
    return artifacts.filter((artifact) => `${getFileName(artifact.filePath)} ${artifact.taskTitle}`.toLocaleLowerCase().includes(normalized));
  }, [artifacts, query]);
  const selected = artifacts.find((artifact) => artifactIdentity(artifact) === selectedId) ?? null;

  const toggleQuickLook = () => {
    if (!selected) return;
    setQuickLookOpen((current) => !current);
  };

  const startQuickLookDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    const quickLook = event.currentTarget.parentElement;
    const library = quickLook?.parentElement;
    if (!quickLook || !library) return;
    const quickLookRect = quickLook.getBoundingClientRect();
    const libraryRect = library.getBoundingClientRect();
    quickLookDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: quickLookOffset.x,
      originY: quickLookOffset.y,
      minX: quickLookOffset.x + libraryRect.left + 8 - quickLookRect.left,
      maxX: quickLookOffset.x + libraryRect.right - 8 - quickLookRect.right,
      minY: quickLookOffset.y + libraryRect.top + 8 - quickLookRect.top,
      maxY: quickLookOffset.y + libraryRect.bottom - 8 - quickLookRect.bottom,
    };
    setQuickLookDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveQuickLook = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = quickLookDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setQuickLookOffset({
      x: Math.max(drag.minX, Math.min(drag.maxX, drag.originX + event.clientX - drag.startX)),
      y: Math.max(drag.minY, Math.min(drag.maxY, drag.originY + event.clientY - drag.startY)),
    });
  };

  const finishQuickLookDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (quickLookDragRef.current?.pointerId !== event.pointerId) return;
    quickLookDragRef.current = null;
    setQuickLookDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <section
      className="agent-os-library"
      aria-label="产物库"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Escape" && quickLookOpen) {
          event.preventDefault();
          setQuickLookOpen(false);
          return;
        }
        if (event.code !== "Space" || (event.target as HTMLElement).closest("button,input")) return;
        event.preventDefault();
        toggleQuickLook();
      }}
    >
      <header className="agent-os-library-toolbar">
        <div><strong>全部产物</strong><small>{filtered.length} 个文件</small></div>
        <label><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索" aria-label="搜索产物"/></label>
        <div className="agent-os-library-view-switch" aria-label="文件显示方式">
          <button type="button" aria-label="图标视图" aria-pressed={viewMode === "grid"} onClick={() => setViewMode("grid")}><Icon name="tiles" size={15}/></button>
          <button type="button" aria-label="列表视图" aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")}><Icon name="list" size={15}/></button>
        </div>
        <button className="agent-os-library-quicklook-toggle" type="button" aria-label="Quick Look" aria-pressed={quickLookOpen} disabled={!selected} onClick={toggleQuickLook}><Icon name="eye" size={17}/></button>
      </header>
      <div className={`agent-os-library-files is-${viewMode}`} role="listbox" aria-label="产物文件">
        {viewMode === "list" && <div className="agent-os-library-columns" aria-hidden="true"><strong>名称</strong><span>最后修改时间</span><span>最后关联的任务</span></div>}
        {filtered.length ? filtered.map((artifact) => {
          const identity = artifactIdentity(artifact);
          const selectedNow = identity === selectedId;
          return <div
            role="option"
            tabIndex={0}
            aria-selected={selectedNow}
            className={selectedNow ? "selected" : ""}
            key={identity}
            onClick={() => onSelect(artifact)}
            onDoubleClick={() => onOpen(artifact)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              onOpen(artifact);
            }}
          >
            <span className={`agent-os-library-file-icon${viewMode === "grid" && isHtmlArtifact(artifact) ? " has-preview" : ""}`} aria-hidden="true" inert>
              {viewMode === "grid" && isHtmlArtifact(artifact) ? <FileViewer
                filePath={artifact.filePath}
                cwd={artifact.cwd}
                sourceSessionId={artifact.sessionId}
                initialDisplayMode="preview"
                watchEnabled={false}
              /> : <Icon name="file" size={viewMode === "grid" ? 31 : 17}/>}
            </span>
            <span className="agent-os-library-file-name"><strong>{getFileName(artifact.filePath)}</strong></span>
            <time dateTime={artifact.modified}>{formatArtifactModified(artifact.modified)}</time>
            <span className="agent-os-library-associated-task" title={artifact.taskTitle}>{compactText(artifact.taskTitle, 54)}</span>
          </div>;
        }) : <div className="agent-os-library-empty"><Icon name="file" size={28}/><strong>{query ? "没有匹配的产物" : "还没有文件产物"}</strong><small>{query ? "试试其他关键词" : "Agent 生成文件后会自动出现在这里"}</small></div>}
      </div>
      {selected && quickLookOpen && <aside
        className={`agent-os-library-quicklook${quickLookDragging ? " is-dragging" : ""}`}
        aria-label="Quick Look"
        style={{ transform: `translate(calc(-50% + ${quickLookOffset.x}px), calc(-50% + ${quickLookOffset.y}px))` }}
      >
        <header onPointerDown={startQuickLookDrag} onPointerMove={moveQuickLook} onPointerUp={finishQuickLookDrag} onPointerCancel={finishQuickLookDrag}>
          <span><Icon name="file" size={14}/><strong>{getFileName(selected.filePath)}</strong></span>
          <span><button type="button" onClick={() => onOpen(selected)}>打开</button><button type="button" aria-label="关闭 Quick Look" onClick={() => setQuickLookOpen(false)}><Icon name="close" size={14}/></button></span>
        </header>
        <div className="agent-os-library-preview">
          <FileViewer filePath={selected.filePath} cwd={selected.cwd} sourceSessionId={selected.sessionId} initialDisplayMode={isHtmlArtifact(selected) ? "preview" : undefined} watchEnabled/>
        </div>
      </aside>}
    </section>
  );
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function DesktopWindow({
  title,
  kind,
  front,
  onFocus,
  onClose,
  children,
  cascadeIndex = 0,
}: {
  title: string;
  kind: "tasks" | "file" | "library" | "settings";
  front: boolean;
  onFocus: () => void;
  onClose: () => void;
  children: ReactNode;
  cascadeIndex?: number;
}) {
  const [maximized, setMaximized] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
    maxX: number;
    maxY: number;
  } | null>(null);
  const cascadeStep = kind === "file" ? cascadeIndex % 6 : 0;
  const centeredPosition = {
    left: `calc(50% + ${cascadeStep * 22}px)`,
    top: `calc(50% + ${cascadeStep * 16}px)`,
    translate: "-50% -50%",
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    onFocus();
    if (maximized || (event.target as HTMLElement).closest("button")) return;
    const windowElement = event.currentTarget.parentElement;
    const windowLayer = windowElement?.parentElement;
    if (!windowElement || !windowLayer) return;
    const windowRect = windowElement.getBoundingClientRect();
    const layerRect = windowLayer.getBoundingClientRect();
    const currentPosition = position ?? {
      x: windowRect.left - layerRect.left,
      y: windowRect.top - layerRect.top,
    };
    if (!position) setPosition(currentPosition);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: currentPosition.x,
      top: currentPosition.y,
      maxX: Math.max(8, layerRect.width - 180),
      maxY: Math.max(8, layerRect.height - 42),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setPosition({
      x: Math.max(8, Math.min(drag.maxX, drag.left + event.clientX - drag.x)),
      y: Math.max(8, Math.min(drag.maxY, drag.top + event.clientY - drag.y)),
    });
  };

  return (
    <article
      className={`agent-os-window agent-os-window-${kind}${front ? " is-front" : ""}${maximized ? " is-maximized" : ""}`}
      style={maximized ? undefined : position
        ? { left: position.x, top: position.y, translate: "none" }
        : centeredPosition}
      onPointerDown={onFocus}
    >
      <header
        className="agent-os-window-bar"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => { dragRef.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }}
        onPointerCancel={() => { dragRef.current = null; }}
        onDoubleClick={() => setMaximized((value) => !value)}
      >
        <span className="agent-os-traffic" aria-label="窗口控制">
          <button className="close" type="button" aria-label="关闭" onClick={onClose}/>
          <button className="minimize" type="button" aria-label="最小化" onClick={onClose}/>
          <button className="maximize" type="button" aria-label={maximized ? "还原" : "最大化"} onClick={() => setMaximized((value) => !value)}/>
        </span>
        <strong><Icon name={kind === "tasks" ? "tasks" : kind === "settings" ? "settings" : "file"} size={15}/>{title}</strong>
        <span />
      </header>
      <div className="agent-os-window-body">{children}</div>
    </article>
  );
}

export function AgentDesktop() {
  const now = useClock();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [runningIds, setRunningIds] = useState<Set<string>>(() => new Set());
  const [activeCwd, setActiveCwd] = useState<string | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [composerFocused, setComposerFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [taskSessionId, setTaskSessionId] = useState<string | null>(null);
  const [openArtifacts, setOpenArtifacts] = useState<Artifact[]>([]);
  const [artifactLibraryOpen, setArtifactLibraryOpen] = useState(false);
  const [selectedLibraryArtifactId, setSelectedLibraryArtifactId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const knownArtifactIdsRef = useRef<Set<string> | null>(null);
  const [frontWindow, setFrontWindow] = useState<string>("tasks");

  const refreshSessions = useCallback(async () => {
    try {
      const response = await fetch("/api/sessions", { cache: "no-store" });
      const data = await response.json() as { sessions?: SessionInfo[]; runningSessionIds?: string[] };
      if (!response.ok || !data.sessions) return;
      const nextSessions = data.sessions
        .filter((session) => session.relation?.kind !== "subagent")
        .sort((a, b) => Date.parse(b.modified) - Date.parse(a.modified));
      setSessions(nextSessions);
      setRunningIds(new Set(data.runningSessionIds ?? []));
      setActiveCwd((current) => current ?? nextSessions[0]?.cwd ?? null);
    } catch {
      // The desktop stays usable while a transient refresh fails.
    }
  }, []);

  useEffect(() => {
    void refreshSessions();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshSessions();
    }, 2_500);
    return () => window.clearInterval(timer);
  }, [refreshSessions]);

  const artifactRefreshKey = sessions.map((session) => `${session.id}:${session.modified}`).join("|");
  useEffect(() => {
    if (!artifactRefreshKey) {
      setArtifacts([]);
      return;
    }
    const controller = new AbortController();
    void Promise.all(sessions.map(async (session) => {
      try {
        const response = await fetch(`/api/sessions/${encodeURIComponent(session.id)}?tail=200&deferThinking=1&deferMedia=1`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json() as SessionDetailResponse;
        return response.ok && data.context ? extractArtifacts(session, data.context.messages) : [];
      } catch {
        return [];
      }
    })).then((groups) => {
      if (controller.signal.aborted) return;
      const nextArtifacts = groups.flat().sort((a, b) => Date.parse(b.modified) - Date.parse(a.modified));
      const nextIds = new Set(nextArtifacts.map(artifactIdentity));
      const knownIds = knownArtifactIdsRef.current;
      setArtifacts(nextArtifacts);
      setOpenArtifacts((current) => current.map((openArtifact) =>
        nextArtifacts.find((artifact) => artifactIdentity(artifact) === artifactIdentity(openArtifact)) ?? openArtifact));
      if (knownIds) {
        const newlyGenerated = nextArtifacts.filter((artifact) => !knownIds.has(artifactIdentity(artifact))).reverse();
        if (newlyGenerated.length) {
          setOpenArtifacts((current) => {
            const openIds = new Set(current.map(artifactIdentity));
            return [...current, ...newlyGenerated.filter((artifact) => !openIds.has(artifactIdentity(artifact)))];
          });
          const activeElement = document.activeElement;
          const composerIsActive = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement;
          if (!composerIsActive) setFrontWindow(`file:${artifactIdentity(newlyGenerated.at(-1)!)}`);
        }
      }
      knownArtifactIdsRef.current = nextIds;
    });
    return () => controller.abort();
    // session metadata is intentionally represented by this stable string.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifactRefreshKey]);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("session");
    if (requested) setTaskSessionId(requested);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3_200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const workspaces = useMemo(() => {
    const map = new Map<string, string>();
    for (const session of sessions) map.set(session.cwd, session.cwd.split(/[\\/]/).filter(Boolean).at(-1) ?? session.cwd);
    if (activeCwd && !map.has(activeCwd)) map.set(activeCwd, activeCwd.split(/[\\/]/).filter(Boolean).at(-1) ?? activeCwd);
    return [...map.entries()].map(([cwd, name]) => ({ cwd, name }));
  }, [activeCwd, sessions]);

  const visibleTasks = useMemo(() => {
    const running = sessions.filter((session) => runningIds.has(session.id));
    const recent = sessions.filter((session) => !runningIds.has(session.id));
    return [...running, ...recent].slice(0, 4);
  }, [runningIds, sessions]);

  const openTask = useCallback((sessionId: string) => {
    setTaskSessionId(sessionId);
    setFrontWindow("tasks");
    window.history.replaceState(null, "", `?session=${encodeURIComponent(sessionId)}`);
  }, []);

  const openArtifact = useCallback((artifact: Artifact) => {
    const identity = artifactIdentity(artifact);
    setOpenArtifacts((current) => current.some((item) => artifactIdentity(item) === identity)
      ? current.map((item) => artifactIdentity(item) === identity ? artifact : item)
      : [...current, artifact]);
    setFrontWindow(`file:${identity}`);
  }, []);

  const openArtifactLibrary = useCallback(() => {
    setArtifactLibraryOpen(true);
    setSelectedLibraryArtifactId((current) => current ?? (artifacts[0] ? artifactIdentity(artifacts[0]) : null));
    setFrontWindow("library");
  }, [artifacts]);

  const ensureCwd = useCallback(async () => {
    if (activeCwd) return activeCwd;
    const response = await fetch("/api/default-cwd", { method: "POST" });
    const data = await response.json() as { cwd?: string; error?: string };
    if (!response.ok || !data.cwd) throw new Error(data.error ?? "无法创建默认工作目录");
    setActiveCwd(data.cwd);
    return data.cwd;
  }, [activeCwd]);

  const submitPrompt = async (event: FormEvent) => {
    event.preventDefault();
    const message = prompt.trim();
    if (!message || submitting) return;
    setSubmitting(true);
    try {
      const cwd = await ensureCwd();
      const response = await fetch("/api/agent/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd, type: "prompt", message }),
      });
      const data = await response.json() as { sessionId?: string; error?: string };
      if (!response.ok || !data.sessionId) throw new Error(data.error ?? "任务创建失败");
      setSessions((current) => [{
        id: data.sessionId!, path: "", cwd, created: new Date().toISOString(), modified: new Date().toISOString(),
        messageCount: 1, firstMessage: message, transient: true,
      }, ...current.filter((session) => session.id !== data.sessionId)]);
      setRunningIds((current) => new Set(current).add(data.sessionId!));
      setPrompt("");
      setComposerFocused(false);
      setNotice("任务已交给 Pi Agent，正在桌面持续推进");
      window.setTimeout(() => void refreshSessions(), 450);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", weekday: "short" }).format(now);
  const formatTime = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const day = new Intl.DateTimeFormat("zh-CN", { day: "numeric" }).format(now);
  const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(now);
  const runningCount = runningIds.size;
  const latestArtifact = artifacts[0];

  return (
    <main className="agent-os">
      <div className="agent-os-wallpaper" aria-hidden="true"><i/><i/><span/></div>

      <header className="agent-os-menu-bar">
        <button className="agent-os-brand" type="button" onClick={() => { setTaskSessionId(null); setOpenArtifacts([]); setArtifactLibraryOpen(false); window.history.replaceState(null, "", "/"); }}>
          <BrandMark/><strong>Syntropic</strong>
        </button>
        <div className="agent-os-workspace-wrap">
          <button className="agent-os-workspace" type="button" aria-expanded={workspaceOpen} onClick={() => setWorkspaceOpen((value) => !value)}>
            <i/><span>{workspaces.find((item) => item.cwd === activeCwd)?.name ?? "Agent 工作台"}</span><small>⌄</small>
          </button>
          {workspaceOpen && <section className="agent-os-workspace-menu">
            <header><strong>工作空间</strong><small>{workspaces.length || 1} 个目录</small></header>
            {workspaces.length ? workspaces.map((workspace) => <button key={workspace.cwd} type="button" className={workspace.cwd === activeCwd ? "active" : ""} onClick={() => { setActiveCwd(workspace.cwd); setWorkspaceOpen(false); }}><span>{workspace.name}</span><small>{workspace.cwd}</small></button>) : <p>首次发送任务时自动创建工作目录</p>}
          </section>}
        </div>
        <div className="agent-os-system-status"><button type="button" aria-label="通知"><Icon name="bell" size={18}/>{runningCount > 0 && <i/>}</button><span>{formatDate}</span><span>{formatTime}</span><button className="agent-os-avatar" type="button">J</button></div>
      </header>

      <section className="agent-os-desktop" aria-label="Agent OS 桌面">
        <section className="agent-os-left-widgets">
          <article className="agent-os-card agent-os-goal-card">
            <header><span><Icon name="spark" size={15}/><strong>业务目标</strong><small>Agent OS</small></span><em>持续推进</em></header>
            <div className="agent-os-orbit" aria-hidden="true"><i/><i/><i/></div>
            <h2>把意图变成可交付的结果</h2><p>每个任务都是一个可持续运行、可追溯的 Agent 工作单元。</p>
            <button type="button" onClick={() => document.querySelector<HTMLInputElement>(".agent-os-composer input")?.focus()}>发起任务 <span>›</span></button>
          </article>
          <article className="agent-os-card agent-os-calendar-card">
            <header><span><Icon name="calendar" size={15}/><strong>日程</strong></span><time>{formatDate.split(" ")[0]}</time></header>
            <div><span><small>{weekday}</small><strong>{day}</strong><em>{now.getMonth() + 1}月</em></span><p><b>{runningCount ? `${runningCount} 个 Agent 任务正在推进` : "今天没有进行中的 Agent 任务"}</b><small>{runningCount ? "完成后结果会自动回到桌面" : "从全局输入框开始一次新的协作"}</small></p></div>
          </article>
        </section>

        <section className="agent-os-right-widgets">
          <article className="agent-os-card agent-os-task-widget">
            <header><span><i className="agent-os-live-dot"/><strong>当前任务</strong></span><em>{runningCount} 项</em></header>
            <div className="agent-os-task-list">
              {visibleTasks.length ? visibleTasks.map((session) => {
                const running = runningIds.has(session.id);
                const taskArtifacts = artifacts.filter((artifact) => artifact.sessionId === session.id);
                return <button type="button" className="agent-os-task-row" key={session.id} onClick={() => openTask(session.id)}>
                  <span><strong>{compactText(taskTitle(session), 42)}</strong><small>{running ? "Pi Agent 正在执行，过程会持续同步" : taskArtifacts.length ? `已生成 ${taskArtifacts.length} 个文件产物` : "任务已完成，可打开查看详情"}</small></span>
                  <i className={running ? "running" : "done"}>{running ? "" : "✓"}</i>
                </button>;
              }) : <div className="agent-os-empty"><Icon name="tasks" size={29}/><strong>任务会在这里持续推进</strong><small>从下方输入框发送你的第一个任务</small></div>}
            </div>
          </article>

          <article className="agent-os-card agent-os-insight-card">
            <header><span><i className="agent-os-live-dot"/><strong>AI 洞察</strong></span><em>持续观察</em></header>
            <div className="agent-os-insight-graphic"><i/><i/><i/></div>
            <h2>{latestArtifact ? `最新产物：${getFileName(latestArtifact.filePath)}` : runningCount ? "Agent 正在组织下一步行动" : "洞察会在合适的时机出现"}</h2>
            <p>{latestArtifact ? `来自任务「${compactText(latestArtifact.taskTitle, 28)}」，已保存在产物库。` : "Syntropic 会理解任务、调用工具，并把可交付结果带回桌面。"}</p>
            {latestArtifact && <button type="button" onClick={() => openArtifact(latestArtifact)}>打开文件 <span>›</span></button>}
          </article>
        </section>
      </section>

      <section className="agent-os-window-layer">
        {taskSessionId && <DesktopWindow title="任务" kind="tasks" front={frontWindow === "tasks"} onFocus={() => setFrontWindow("tasks")} onClose={() => { setTaskSessionId(null); window.history.replaceState(null, "", "/"); }}>
          <div className="agent-os-pi-app"><AppShell key={taskSessionId} initialSessionId={taskSessionId}/></div>
        </DesktopWindow>}
        {artifactLibraryOpen && <DesktopWindow title="产物库" kind="library" front={frontWindow === "library"} onFocus={() => setFrontWindow("library")} onClose={() => setArtifactLibraryOpen(false)}>
          <ArtifactLibrary
            artifacts={artifacts}
            selectedId={selectedLibraryArtifactId}
            onSelect={(artifact) => setSelectedLibraryArtifactId(artifactIdentity(artifact))}
            onOpen={openArtifact}
          />
        </DesktopWindow>}
        {openArtifacts.map((artifact, index) => {
          const identity = artifactIdentity(artifact);
          const windowId = `file:${identity}`;
          return <DesktopWindow
            key={identity}
            title={getFileName(artifact.filePath)}
            kind="file"
            cascadeIndex={index}
            front={frontWindow === windowId}
            onFocus={() => setFrontWindow(windowId)}
            onClose={() => {
              const remaining = openArtifacts.filter((item) => artifactIdentity(item) !== identity);
              const nextFront = remaining.at(-1);
              setOpenArtifacts(remaining);
              setFrontWindow(nextFront ? `file:${artifactIdentity(nextFront)}` : artifactLibraryOpen ? "library" : "tasks");
            }}
          >
            <div className="agent-os-file-app"><FileViewer filePath={artifact.filePath} cwd={artifact.cwd} sourceSessionId={artifact.sessionId} initialDisplayMode={isHtmlArtifact(artifact) ? "preview" : undefined} watchEnabled/></div>
          </DesktopWindow>;
        })}
        {settingsOpen && <DesktopWindow title="设置" kind="settings" front={frontWindow === "settings"} onFocus={() => setFrontWindow("settings")} onClose={() => setSettingsOpen(false)}>
          <AgentSettingsApp cwd={activeCwd} sessionId={taskSessionId} onClose={() => setSettingsOpen(false)} onSessionReloaded={() => void refreshSessions()}/>
        </DesktopWindow>}
      </section>

      <section className={`agent-os-ai-surface${composerFocused || prompt ? " expanded" : ""}`}>
        {(composerFocused || prompt) && <div className="agent-os-suggestion"><small>你可能想做</small><button type="button" onClick={() => setPrompt("分析当前项目，给出最值得优先处理的三个改进，并直接完成第一项。")}>分析当前项目，给出最值得优先处理的三个改进，并直接完成第一项。</button></div>}
        <form className="agent-os-composer" onSubmit={submitPrompt}>
          <BrandMark compact/>
          <button className="attach" type="button" aria-label="添加上下文"><Icon name="plus" size={19}/></button>
          <input value={prompt} onChange={(event) => setPrompt(event.target.value)} onFocus={() => setComposerFocused(true)} onBlur={() => { if (!prompt) window.setTimeout(() => setComposerFocused(false), 120); }} placeholder="向 Pi Agent 交付任务" aria-label="向 Pi Agent 交付任务"/>
          <button className="voice" type="button" aria-label="语音输入"><Icon name="mic" size={19}/></button>
          <button className="send" type="submit" aria-label="发送任务" disabled={!prompt.trim() || submitting}>{submitting ? <span className="agent-os-spinner"/> : <Icon name="arrow-up" size={19}/>}</button>
        </form>
      </section>

      <nav
        className="agent-os-dock"
        aria-label="应用程序 Dock"
      >
        <button className="dock-launchpad" type="button" aria-label="启动台" data-label="启动台"><Icon name="grid" size={22}/></button><i/>
        <button className="dock-new-task" type="button" aria-label="新任务" data-label="新任务" onClick={() => document.querySelector<HTMLInputElement>(".agent-os-composer input")?.focus()}><Icon name="plus" size={23}/></button>
        <button className={`dock-tasks${taskSessionId ? " is-open" : ""}`} type="button" aria-label="任务" aria-pressed={Boolean(taskSessionId)} data-label="任务" onClick={() => sessions[0] && openTask(sessions[0].id)}><Icon name="chat" size={22}/>{runningCount > 0 && <em>{runningCount}</em>}</button>
        <button className="dock-history" type="button" aria-label="历史" data-label="历史"><Icon name="clock" size={22}/></button>
        <button className={`dock-library${artifactLibraryOpen ? " is-open" : ""}`} type="button" aria-label="产物库" aria-pressed={artifactLibraryOpen} data-label="产物库" onClick={openArtifactLibrary}><Icon name="file" size={22}/></button>
        <button className={`dock-settings${settingsOpen ? " is-open" : ""}`} type="button" aria-label="设置" aria-pressed={settingsOpen} data-label="设置" onClick={() => { setSettingsOpen(true); setFrontWindow("settings"); }}><Icon name="settings" size={22}/></button>
      </nav>

      {notice && <div className="agent-os-toast" role="status"><BrandMark compact/><span>{notice}</span></div>}
    </main>
  );
}
