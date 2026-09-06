"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { sendAgentCommand } from "@/lib/agent-client";
import { splitFinalAssistantBlocks } from "@/lib/message-display";
import { INITIAL_STREAMING_STATE, streamReducer, type ClientAssistantMessageEvent } from "@/lib/streaming-message";
import type { AgentMessage, AssistantMessage, CustomMessage, UserMessage } from "@/lib/types";

export type JarvisTaskStatus = "running" | "completed" | "aborted";

export interface JarvisTask {
  sessionId: string;
  description: string;
  status: JarvisTaskStatus;
  createdAt: string;
  completedAt?: string;
}

export interface JarvisTurn {
  id: number;
  role: "user" | "assistant" | "task";
  text: string;
  /** Present for task turns: the task that was started or settled. */
  task?: JarvisTask;
  /** For task turns, whether this marks the start or the end of the task. */
  taskEvent?: "started" | "settled";
}

const TASK_DETAIL_KIND = "pi-web:jarvis-task";
const TASK_BATCH_KIND = "pi-web:jarvis-task-batch";
const TASK_NOTIFICATION_TYPE = "pi-web:jarvis-task-notification";
const MAX_TURNS = 80;
const HISTORY_TAIL = 80;

function assistantText(message: AssistantMessage): string {
  return splitFinalAssistantBlocks(message).answerBlocks
    .filter((block): block is Extract<AssistantMessage["content"][number], { type: "text" }> => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function plainText(content: UserMessage["content"] | CustomMessage["content"]): string {
  if (typeof content === "string") return content.trim();
  return content.filter((block) => block.type === "text").map((block) => (block as { text: string }).text).join("\n").trim();
}

function parseTask(value: unknown): JarvisTask | null {
  if (!value || typeof value !== "object") return null;
  const details = value as { kind?: unknown; sessionId?: unknown; description?: unknown; status?: unknown; createdAt?: unknown; completedAt?: unknown };
  if (details.kind !== TASK_DETAIL_KIND || typeof details.sessionId !== "string") return null;
  const status = details.status === "completed" || details.status === "aborted" ? details.status : "running";
  return {
    sessionId: details.sessionId,
    description: typeof details.description === "string" ? details.description : "任务",
    status,
    createdAt: typeof details.createdAt === "string" ? details.createdAt : new Date().toISOString(),
    ...(typeof details.completedAt === "string" ? { completedAt: details.completedAt } : {}),
  };
}

/** Tasks carried by a notification: a batch, or a single task from older sessions. */
function parseTaskBatch(value: unknown): JarvisTask[] {
  if (value && typeof value === "object" && (value as { kind?: unknown }).kind === TASK_BATCH_KIND) {
    const tasks = (value as { tasks?: unknown }).tasks;
    return Array.isArray(tasks) ? tasks.map(parseTask).filter((task): task is JarvisTask => task !== null) : [];
  }
  const single = parseTask(value);
  return single ? [single] : [];
}

function upsertTask(tasks: JarvisTask[], task: JarvisTask): JarvisTask[] {
  const index = tasks.findIndex((item) => item.sessionId === task.sessionId);
  if (index === -1) return [...tasks, task];
  const next = [...tasks];
  next[index] = { ...next[index], ...task };
  return next;
}

/** Turn a session's messages into transcript turns and known tasks. */
function turnsFromMessages(messages: AgentMessage[], nextId: () => number): { turns: JarvisTurn[]; tasks: JarvisTask[] } {
  const turns: JarvisTurn[] = [];
  let tasks: JarvisTask[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      const text = plainText(message.content);
      if (text) turns.push({ id: nextId(), role: "user", text });
    } else if (message.role === "assistant") {
      const text = assistantText(message);
      if (text) turns.push({ id: nextId(), role: "assistant", text });
    } else if (message.role === "toolResult") {
      const task = parseTask((message as { details?: unknown }).details);
      if (task && !tasks.some((item) => item.sessionId === task.sessionId)) {
        tasks = upsertTask(tasks, task);
        turns.push({ id: nextId(), role: "task", text: task.description, task, taskEvent: "started" });
      }
    } else if (message.role === "custom" && message.customType === TASK_NOTIFICATION_TYPE) {
      for (const task of parseTaskBatch(message.details)) {
        tasks = upsertTask(tasks, task);
        turns.push({ id: nextId(), role: "task", text: task.description, task, taskEvent: "settled" });
      }
    }
  }
  return { turns: turns.slice(-MAX_TURNS), tasks };
}

export interface UseJarvisOptions {
  cwd: string | null;
  onTaskStarted?(task: JarvisTask): void;
  onTaskSettled?(task: JarvisTask): void;
}

/**
 * The desktop's always-on Jarvis conversation: one persistent Pi session per
 * working directory that only talks and delegates. Exposes the transcript,
 * the live reply for the voice engine, and the tasks Jarvis manages.
 */
export function useJarvis({ cwd, onTaskStarted, onTaskSettled }: UseJarvisOptions) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<JarvisTurn[]>([]);
  const [tasks, setTasks] = useState<JarvisTask[]>([]);
  // Only advances for replies received by this mounted client. Restored
  // transcript entries must not be presented as fresh desktop notifications.
  const [latestReplyTurnId, setLatestReplyTurnId] = useState(0);
  /** Text of the latest assistant message in the current turn; cleared when a new turn starts. */
  const [lastReply, setLastReply] = useState("");
  const [stream, dispatch] = useReducer(streamReducer, INITIAL_STREAMING_STATE);
  const [resetCount, setResetCount] = useState(0);
  const runningRef = useRef(false);
  const idleWaitersRef = useRef<Array<() => void>>([]);
  const turnIdRef = useRef(0);
  const nextTurnId = useCallback(() => ++turnIdRef.current, []);
  const resetPendingRef = useRef(false);
  const callbacks = useRef({ onTaskStarted, onTaskSettled });
  callbacks.current = { onTaskStarted, onTaskSettled };

  const pushTurn = useCallback((turn: Omit<JarvisTurn, "id">) => {
    if (!turn.text) return 0;
    const id = nextTurnId();
    setTurns((current) => [...current, { id, ...turn }].slice(-MAX_TURNS));
    return id;
  }, [nextTurnId]);

  // Resolve (or create) the Jarvis session, then load its recent transcript.
  useEffect(() => {
    if (!cwd) return;
    let cancelled = false;
    setSessionId(null);
    setConnected(false);
    setRunning(false);
    setTurns([]);
    setTasks([]);
    setLatestReplyTurnId(0);
    setLastReply("");
    setError(null);
    dispatch({ type: "end" });
    void (async () => {
      try {
        const response = await fetch("/api/jarvis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cwd, ...(resetPendingRef.current ? { reset: true } : {}) }),
        });
        const data = await response.json() as { sessionId?: string; tasks?: JarvisTask[]; created?: boolean; error?: string };
        if (cancelled) return;
        resetPendingRef.current = false;
        if (!response.ok || !data.sessionId) throw new Error(data.error ?? "Syntropic 启动失败");
        const id = data.sessionId;
        if (!data.created) {
          try {
            const history = await fetch(`/api/sessions/${encodeURIComponent(id)}?tail=${HISTORY_TAIL}&deferThinking=1&deferMedia=1`, { cache: "no-store" });
            const detail = await history.json() as { context?: { messages?: AgentMessage[] } };
            if (cancelled) return;
            const restored = turnsFromMessages(detail.context?.messages ?? [], nextTurnId);
            setTurns(restored.turns);
            const lastAssistant = [...restored.turns].reverse().find((turn) => turn.role === "assistant");
            if (lastAssistant) setLastReply(lastAssistant.text);
            setTasks(restored.tasks);
          } catch {
            // The transcript is a convenience; the conversation still works without it.
          }
        }
        if (cancelled) return;
        // Live task state from the server wins over what the transcript implies.
        setTasks((current) => (data.tasks ?? []).reduce(upsertTask, current));
        setSessionId(id);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();
    return () => { cancelled = true; };
  }, [cwd, nextTurnId, resetCount]);

  // Follow the session's event stream.
  useEffect(() => {
    if (!sessionId) return;
    const source = new EventSource(`/api/agent/${encodeURIComponent(sessionId)}/events`);
    source.onmessage = (event: MessageEvent<string>) => {
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(event.data) as Record<string, unknown>;
      } catch {
        return;
      }
      switch (payload.type) {
        case "connected":
          setConnected(true);
          runningRef.current = payload.isStreaming === true;
          setRunning(payload.isStreaming === true);
          if (payload.isStreaming === true) dispatch({ type: "start" });
          break;
        case "startup_error":
          setError(typeof payload.errorMessage === "string" ? payload.errorMessage : "Syntropic 启动失败");
          break;
        case "agent_start":
          runningRef.current = true;
          setRunning(true);
          // A new turn: nothing said in it yet, so never fall back to older replies.
          setLastReply("");
          break;
        case "agent_end":
          runningRef.current = false;
          setRunning(false);
          dispatch({ type: "end" });
          for (const resolve of idleWaitersRef.current.splice(0)) resolve();
          break;
        case "message_start": {
          const message = payload.message as AgentMessage | undefined;
          if (message?.role === "assistant") dispatch({ type: "snapshot", message });
          else dispatch({ type: "start" });
          break;
        }
        case "message_update":
          dispatch({ type: "delta", event: payload.assistantMessageEvent as ClientAssistantMessageEvent });
          break;
        case "message_end": {
          const message = payload.message as AgentMessage | undefined;
          if (!message) break;
          if (message.role === "assistant") {
            const text = assistantText(message);
            if (text) {
              setLastReply(text);
              setLatestReplyTurnId(pushTurn({ role: "assistant", text }));
            }
            dispatch({ type: "end" });
          } else if (message.role === "user") {
            pushTurn({ role: "user", text: plainText(message.content) });
          } else if (message.role === "custom" && message.customType === TASK_NOTIFICATION_TYPE) {
            for (const task of parseTaskBatch(message.details)) {
              setTasks((current) => upsertTask(current, task));
              callbacks.current.onTaskSettled?.(task);
              pushTurn({ role: "task", text: task.description, task, taskEvent: "settled" });
            }
          }
          break;
        }
        case "tool_execution_end": {
          if (payload.toolName !== "start_task") break;
          const result = payload.result as { details?: unknown } | undefined;
          const task = parseTask(result?.details);
          if (!task) break;
          setTasks((current) => upsertTask(current, task));
          callbacks.current.onTaskStarted?.(task);
          pushTurn({ role: "task", text: task.description, task, taskEvent: "started" });
          break;
        }
        default:
          break;
      }
    };
    source.onerror = () => {
      setConnected(false);
    };
    return () => {
      source.close();
    };
  }, [pushTurn, sessionId]);

  const send = useCallback(async (text: string) => {
    const message = text.trim();
    if (!sessionId || !message) return;
    setError(null);
    try {
      await sendAgentCommand(sessionId, running ? { type: "steer", message } : { type: "prompt", message });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [running, sessionId]);

  const abort = useCallback(async () => {
    if (!sessionId) return;
    try {
      await sendAgentCommand(sessionId, { type: "abort" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [sessionId]);

  /**
   * The user talked over Jarvis: drop the answer in progress and start over
   * from what they just said, the way a person would after being cut off.
   */
  const interruptAndSend = useCallback(async (text: string) => {
    const message = text.trim();
    if (!sessionId || !message) return;
    setError(null);
    try {
      if (runningRef.current) {
        const idle = new Promise<void>((resolve) => {
          idleWaitersRef.current.push(resolve);
          window.setTimeout(resolve, 2_500);
        });
        await sendAgentCommand(sessionId, { type: "abort" });
        await idle;
      }
      await sendAgentCommand(sessionId, runningRef.current ? { type: "steer", message } : { type: "prompt", message });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [sessionId]);

  /** Start a fresh Jarvis conversation for this working directory. */
  const reset = useCallback(() => {
    resetPendingRef.current = true;
    setResetCount((count) => count + 1);
  }, []);

  const streamingText = useMemo(() => (
    stream.isStreaming && stream.streamingMessage ? assistantText(stream.streamingMessage) : null
  ), [stream]);
  // Between messages of one turn (for example around a tool call) there is no
  // streaming text; report an empty string rather than an older reply, which
  // would read as new content to the voice engine.
  const speechText = streamingText ?? (running ? "" : lastReply);

  return {
    sessionId,
    ready: connected && !error,
    running,
    error,
    turns,
    tasks,
    latestReplyTurnId,
    /** Live reply while streaming, else the reply of the current turn. */
    speechText,
    streamingText,
    send,
    interruptAndSend,
    abort,
    reset,
  };
}
