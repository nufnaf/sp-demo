import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { writePrivateFileAtomicSync } from "./atomic-file";
import { readCrmState } from "./crm-store";
import { addInsightResult } from "./insight-event-store";
import { companyCrmDemoReport } from "./company-crm-demo-report";

declare global { var __piCompanyCrmInsightTimers: Map<string, ReturnType<typeof setTimeout>> | undefined }
const timers = () => globalThis.__piCompanyCrmInsightTimers ??= new Map();
export function cancelCompanyCrmInsight(cwd: string): void {
  const timer = timers().get(cwd);
  if (timer) clearTimeout(timer);
  timers().delete(cwd);
}
/** Only called after an explicit, verified connection to our synthetic demo site. */
export function scheduleCompanyCrmInsight(cwd: string): void {
  cancelCompanyCrmInsight(cwd);
  const bindingId = randomUUID();
  const timer = setTimeout(() => {
    if (timers().get(cwd) !== timer) return;
    timers().delete(cwd);
    try {
      const source = readCrmState(cwd).sources.find((row) => row.id === "company-crm");
      const report = source && companyCrmDemoReport(source);
      if (!report) return;
      const modified = new Date().toISOString();
      const fileName = `crm-payment-blocker-${bindingId}.html`;
      const filePath = join(cwd, ".pi-web", "insights", fileName);
      mkdirSync(join(cwd, ".pi-web", "insights"), { recursive: true });
      writePrivateFileAtomicSync(filePath, report.html);
      addInsightResult({ sessionId: `company-crm-demo:${bindingId}`, filePath, fileName, cwd, modified, title: report.title });
    } catch (error) { console.error("Failed to generate company CRM demo insight", error); }
  }, 10_000);
  timer.unref?.();
  timers().set(cwd, timer);
}
