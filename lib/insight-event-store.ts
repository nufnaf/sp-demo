import { emitFileEvent } from "./files-app/events";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { applicationDataDir } from "./presentation-runtime";
import { writePrivateFileAtomicSync } from "./atomic-file";
import { extractInsightMetadata, type InsightResult } from "./insight-automation";

export type InsightEventSource = "feishu" | "task" | "crm";

export interface InsightEvent {
  id: string;
  source: InsightEventSource;
  type: string;
  occurredAt: string;
  cwd?: string;
  objectId?: string;
  title: string;
  summary?: string;
  payload?: unknown;
}

export interface InsightSourceStatus {
  state: "starting" | "ready" | "unavailable" | "error";
  detail: string;
  updatedAt: string;
}

interface StoredInsightState {
  version: 1;
  activeCwd?: string;
  pendingEvents: InsightEvent[];
  processedEventIds: string[];
  results: InsightResult[];
  sources: Record<string, InsightSourceStatus>;
}

const MAX_PENDING_EVENTS = 100;
const MAX_PROCESSED_IDS = 1_000;
const MAX_RESULTS = 50;
const STATE_PATH = join(applicationDataDir(), "pi-web", "insights.json");

declare global {
  var __piInsightState: StoredInsightState | undefined;
  var __piInsightEventListener: (() => void) | undefined;
}

function emptyState(): StoredInsightState {
  return { version: 1, pendingEvents: [], processedEventIds: [], results: [], sources: {} };
}

function loadState(): StoredInsightState {
  if (globalThis.__piInsightState) return globalThis.__piInsightState;
  try {
    const value = JSON.parse(readFileSync(STATE_PATH, "utf8")) as Partial<StoredInsightState>;
    if (value.version === 1) {
      globalThis.__piInsightState = {
        version: 1,
        activeCwd: typeof value.activeCwd === "string" ? value.activeCwd : undefined,
        pendingEvents: Array.isArray(value.pendingEvents) ? value.pendingEvents : [],
        processedEventIds: Array.isArray(value.processedEventIds) ? value.processedEventIds : [],
        results: Array.isArray(value.results) ? value.results : [],
        sources: value.sources && typeof value.sources === "object" ? value.sources : {},
      };
      return globalThis.__piInsightState;
    }
  } catch {
    // A missing or malformed cache starts a clean local observer.
  }
  globalThis.__piInsightState = emptyState();
  return globalThis.__piInsightState;
}

function saveState(): void {
  const state = loadState();
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writePrivateFileAtomicSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

export function stableInsightEventId(parts: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 32);
}

export function setActiveInsightCwd(cwd: string): void {
  const state = loadState();
  if (state.activeCwd === cwd) return;
  state.activeCwd = cwd;
  saveState();
}

export function getActiveInsightCwd(): string | undefined {
  return loadState().activeCwd;
}

export function recordInsightEvent(event: Omit<InsightEvent, "id" | "occurredAt"> & { id?: string; occurredAt?: string }): boolean {
  const state = loadState();
  const normalized: InsightEvent = {
    ...event,
    id: event.id ?? randomUUID(),
    occurredAt: event.occurredAt ?? new Date().toISOString(),
  };
  if (state.processedEventIds.includes(normalized.id) || state.pendingEvents.some((item) => item.id === normalized.id)) return false;
  state.pendingEvents.push(normalized);
  state.pendingEvents = state.pendingEvents.slice(-MAX_PENDING_EVENTS);
  saveState();
  globalThis.__piInsightEventListener?.();
  return true;
}

export function peekPendingInsightEvents(): InsightEvent[] {
  return [...loadState().pendingEvents];
}

export function markInsightEventsProcessed(ids: string[]): void {
  if (!ids.length) return;
  const state = loadState();
  const completed = new Set(ids);
  state.pendingEvents = state.pendingEvents.filter((event) => !completed.has(event.id));
  state.processedEventIds = [...state.processedEventIds, ...ids].slice(-MAX_PROCESSED_IDS);
  saveState();
}

export function addInsightResult(result: InsightResult): void {
  const state = loadState();
  state.results = [
    result,
    ...state.results.filter((item) => item.filePath !== result.filePath),
  ].slice(0, MAX_RESULTS);
  saveState();
  emitFileEvent({ type: "insight.updated", cwd: result.cwd });
}

export function listInsightResults(cwd: string): InsightResult[] {
  return loadState().results.filter((result) => result.cwd === cwd && existsSync(result.filePath)).map(result => {
    if (result.summary) return result;
    try {
      const { summary } = extractInsightMetadata(readFileSync(result.filePath, "utf8"), result.fileName);
      return { ...result, summary };
    } catch { return result; }
  });
}

export function setInsightSourceStatus(source: string, status: InsightSourceStatus): void {
  const state = loadState();
  state.sources[source] = status;
  saveState();
}

export function listInsightSourceStatuses(): Record<string, InsightSourceStatus> {
  return { ...loadState().sources };
}
