import "server-only";

import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { writePrivateFileAtomicSync } from "@/lib/atomic-file";
import { getCompanyCareersData } from "@/lib/company-careers";
import { renderCompanyCareersInsightHtml } from "@/lib/company-careers-insight-html";
import { addInsightResult } from "@/lib/insight-event-store";

const DEMO_INSIGHT_DELAY_MS = 10_000;

declare global {
  var __piCompanyCareersInsightTimers: Map<string, ReturnType<typeof setTimeout>> | undefined;
}

function timers(): Map<string, ReturnType<typeof setTimeout>> {
  return globalThis.__piCompanyCareersInsightTimers ??= new Map();
}

export function cancelCompanyCareersInsight(cwd?: string): void {
  if (cwd) {
    const timer = timers().get(cwd);
    if (timer) clearTimeout(timer);
    timers().delete(cwd);
    return;
  }
  for (const timer of timers().values()) clearTimeout(timer);
  timers().clear();
}

/** Fixed product-demo trigger. This deliberately does not represent generic insight logic. */
export function scheduleCompanyCareersInsight(cwd: string): void {
  cancelCompanyCareersInsight(cwd);
  const bindingId = randomUUID();
  const timer = setTimeout(() => {
    timers().delete(cwd);
    void (async () => {
      try {
        const data = await getCompanyCareersData();
        const directory = join(cwd, ".pi-web", "insights");
        const modified = new Date().toISOString();
        const fileName = `recruiting-interviewer-alignment-${modified.replace(/[:.]/g, "-")}.html`;
        const filePath = join(directory, fileName);
        mkdirSync(directory, { recursive: true });
        writePrivateFileAtomicSync(filePath, renderCompanyCareersInsightHtml(data));
        addInsightResult({
          sessionId: `company-careers:${bindingId}`,
          filePath,
          cwd,
          fileName,
          title: data.interviewerAlignment.title,
          modified,
        });
      } catch (error) {
        console.error("Failed to generate company careers insight", error);
      }
    })();
  }, DEMO_INSIGHT_DELAY_MS);
  timer.unref?.();
  timers().set(cwd, timer);
}
