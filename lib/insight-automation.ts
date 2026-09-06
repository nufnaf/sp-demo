import type { SessionInfo } from "./types";

export const INSIGHT_TASK_MARKER = "<pi-web-insight-analysis>";

export interface InsightResult {
  sessionId: string;
  filePath: string;
  cwd: string;
  fileName: string;
  title: string;
  modified: string;
}

function decodeHtmlText(value: string): string {
  const entities: Record<string, string> = {
    amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"',
  };
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
      if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
      if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
      return entities[entity.toLowerCase()] ?? match;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function truncateInsightText(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max).trimEnd()}…` : value;
}

export function extractInsightMetadata(html: string, fileName: string): Pick<InsightResult, "fileName" | "title"> {
  const insightStart = html.search(/<[^>]+class=["'][^"']*\binsight\b[^"']*["'][^>]*>/i);
  const insightBlock = insightStart >= 0 ? html.slice(insightStart, insightStart + 6_000) : "";
  const insightTitle = insightBlock.match(/<[^>]+class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1];
  const documentTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const title = truncateInsightText(decodeHtmlText(insightTitle ?? documentTitle ?? fileName), 68);
  return { fileName, title };
}

export function isInsightTaskSession(session: Pick<SessionInfo, "firstMessage">): boolean {
  return session.firstMessage.includes(INSIGHT_TASK_MARKER);
}
