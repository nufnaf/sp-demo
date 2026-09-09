import type { BrowserPageState, BrowserTaskState } from "./types";

export interface BrowserReturnContext {
  cwd: string | null;
  publicationSessionId?: string | null;
  taskSessionId: string | null;
  browserOpen: boolean;
  frontWindow: string;
}
export interface BrowserReturnOrigin {
  pageId: string;
  cwd: string;
  sessionId: string;
  destination: "recruiting" | "tasks";
}

export function captureBrowserOrigin(page: BrowserPageState, context: BrowserReturnContext): BrowserReturnOrigin | null {
  if (page.controller !== "agent" || page.cwd !== context.cwd || !page.taskSessionId) return null;
  const destination = page.taskSessionId === context.publicationSessionId ? "recruiting"
    : page.taskSessionId === context.taskSessionId ? "tasks" : null;
  return destination ? { pageId: page.pageId, cwd: page.cwd, sessionId: page.taskSessionId, destination } : null;
}

export function isBrowserOriginCurrent(origin: BrowserReturnOrigin, context: BrowserReturnContext): boolean {
  return context.browserOpen && context.frontWindow === "browser" && context.cwd === origin.cwd
    && origin.sessionId === (origin.destination === "recruiting" ? context.publicationSessionId : context.taskSessionId);
}

export function browserReturnDestination(origin: BrowserReturnOrigin, task: BrowserTaskState, context: BrowserReturnContext) {
  if (task.pageId !== origin.pageId || task.cwd !== origin.cwd || task.parentSessionId !== origin.sessionId
      || !["completed", "failed"].includes(task.status) || !isBrowserOriginCurrent(origin, context)) return null;
  return origin.destination;
}
