"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

export interface ReminderItem {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  sessionId?: string;
}

interface DesktopRemindersProps {
  workspaceKey: string;
  onLaunch: (title: string) => Promise<string | null>;
  onOpenTask: (sessionId: string) => void;
  onHistoryChange?: (items: ReminderItem[]) => void;
}

const STORAGE_PREFIX = "pi-web:desktop-reminders:";

function storageKey(workspaceKey: string): string {
  return `${STORAGE_PREFIX}${workspaceKey}`;
}

export function clearDesktopReminders(workspaceKey: string): void {
  window.localStorage.removeItem(storageKey(workspaceKey));
}

function readItems(workspaceKey: string): ReminderItem[] {
  try {
    const value = window.localStorage.getItem(storageKey(workspaceKey));
    if (!value) return [];
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ReminderItem => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Partial<ReminderItem>;
      return typeof candidate.id === "string"
        && typeof candidate.title === "string"
        && candidate.title.trim().length > 0
        && typeof candidate.completed === "boolean"
        && typeof candidate.createdAt === "string";
    }).map((item) => ({
      ...item,
      sessionId: typeof item.sessionId === "string" ? item.sessionId : undefined,
    }));
  } catch {
    return [];
  }
}

export function DesktopReminders({ workspaceKey, onLaunch, onOpenTask, onHistoryChange }: DesktopRemindersProps) {
  const [items, setItems] = useState<ReminderItem[]>([]);
  const [draft, setDraft] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    setItems(readItems(workspaceKey));
    setHydrated(true);
  }, [workspaceKey]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey(workspaceKey), JSON.stringify(items));
    onHistoryChange?.(items);
  }, [hydrated, items, onHistoryChange, workspaceKey]);

  const remaining = useMemo(() => items.filter((item) => !item.completed).length, [items]);
  const pendingItems = useMemo(() => items.filter((item) => !item.completed), [items]);
  const completedItems = useMemo(() => items.filter((item) => item.completed), [items]);

  const addItem = (event: FormEvent) => {
    event.preventDefault();
    const title = draft.trim();
    if (!title) return;
    setItems((current) => [{
      id: window.crypto.randomUUID(),
      title,
      completed: false,
      createdAt: new Date().toISOString(),
    }, ...current]);
    setDraft("");
  };

  const launch = async (item: ReminderItem) => {
    if (launchingId) return;
    setLaunchingId(item.id);
    try {
      const sessionId = await onLaunch(item.title);
      if (sessionId) {
        setItems((current) => current.map((candidate) =>
          candidate.id === item.id ? { ...candidate, sessionId } : candidate));
      }
    } finally {
      setLaunchingId(null);
    }
  };

  const renderItem = (item: ReminderItem) => {
    const launching = launchingId === item.id;
    return (
      <div className={`agent-os-reminder-row${item.completed ? " is-completed" : ""}`} key={item.id}>
        <button
          className="agent-os-reminder-check"
          type="button"
          aria-label={item.completed ? `将“${item.title}”标记为未完成` : `完成“${item.title}”`}
          aria-pressed={item.completed}
          onClick={() => setItems((current) => current.map((candidate) =>
            candidate.id === item.id ? { ...candidate, completed: !candidate.completed } : candidate))}
        >
          <span aria-hidden="true">✓</span>
        </button>
        <span className="agent-os-reminder-title">{item.title}</span>
        {item.sessionId ? (
          <button
            className="agent-os-reminder-action is-detail"
            type="button"
            title="查看任务"
            onClick={() => onOpenTask(item.sessionId!)}
            aria-label={`查看任务：${item.title}`}
          ><span>查看任务</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 5.5 4.75 4.5-4.75 4.5"/></svg></button>
        ) : (
          <button
            className="agent-os-reminder-action is-run"
            type="button"
            title="交给 Syntropic"
            disabled={Boolean(launchingId) || item.completed}
            onClick={() => void launch(item)}
            aria-label={`交给 Syntropic 执行：${item.title}`}
          >
            <span>{launching ? "下发中" : "交给 Syntropic"}</span>
            {launching ? <i className="agent-os-reminder-spinner" aria-hidden="true"/> : (
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.25 5.65 7 4.35-7 4.35Z"/></svg>
            )}
          </button>
        )}
        <button
          className="agent-os-reminder-delete"
          type="button"
          aria-label={`删除“${item.title}”`}
          onClick={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))}
        >×</button>
      </div>
    );
  };

  return (
    <article className="agent-os-card agent-os-reminders" aria-label="待办事项">
      <header>
        <span><i className="agent-os-reminders-mark" aria-hidden="true">✓</i><strong>待办事项</strong></span>
        <em>{remaining} 项</em>
      </header>

      <form className="agent-os-reminders-add" onSubmit={addItem}>
        <span aria-hidden="true">＋</span>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="记下一个待办…"
          aria-label="添加待办事项"
        />
        <button type="submit" disabled={!draft.trim()} aria-label="添加">添加</button>
      </form>

      <div className="agent-os-reminders-list" aria-live="polite">
        {items.length ? <>
          <section className="agent-os-reminders-group" aria-labelledby="agent-os-pending-label">
            <div className="agent-os-reminders-group-label" id="agent-os-pending-label"><span>待完成</span><em>{pendingItems.length}</em></div>
            {pendingItems.length ? pendingItems.map(renderItem) : <p className="agent-os-reminders-all-done">今天的事项都完成了</p>}
          </section>
          {completedItems.length > 0 && <section className="agent-os-reminders-group is-completed-group">
            <button
              className="agent-os-reminders-completed-toggle"
              type="button"
              aria-expanded={showCompleted}
              onClick={() => setShowCompleted((current) => !current)}
            >
              <span>已完成 <em>{completedItems.length}</em></span>
              <i aria-hidden="true">⌄</i>
            </button>
            {showCompleted && <div className="agent-os-reminders-completed-items">{completedItems.map(renderItem)}</div>}
          </section>}
        </> : (
          <div className="agent-os-reminders-empty">
            <i aria-hidden="true">＋</i>
            <strong>想到什么，先记下来</strong>
            <small>一句话就够了，之后可以交给 Syntropic</small>
          </div>
        )}
      </div>
    </article>
  );
}
