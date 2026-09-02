import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const desktopSource = await readFile(new URL("./AgentDesktop.tsx", import.meta.url), "utf8");
const reminderSource = await readFile(new URL("./DesktopReminders.tsx", import.meta.url), "utf8");
const cssSource = await readFile(new URL("./AgentDesktop.css", import.meta.url), "utf8");

test("desktop starts a silent insight analysis after five queued completions", () => {
  assert.match(desktopSource, /queuedCompletedIds\.length < INSIGHT_BATCH_SIZE/);
  assert.match(desktopSource, /buildInsightAnalysisPrompt/);
  assert.match(desktopSource, /startInsightAnalysis/);
  assert.match(desktopSource, /analysisSessionId: sessionId/);
  assert.match(reminderSource, /onHistoryChange\?\.\(items\)/);
});

test("a fast completion burst cannot start duplicate insight analyses", () => {
  assert.match(desktopSource, /insightStartingRef\.current = true/);
  assert.match(desktopSource, /if \(!sessionId\) \{\s*insightStartingRef\.current = false/);
  assert.match(desktopSource, /if \(insightAutomation\?\.analysisSessionId\) insightStartingRef\.current = false/);
  assert.doesNotMatch(desktopSource, /startInsightAnalysis\(message, activeCwd\)[\s\S]{0,500}\.finally\(\(\) => \{\s*insightStartingRef\.current = false/);
});

test("insight artifacts stay closed and are surfaced through lists and notifications", () => {
  assert.match(desktopSource, /desktopArtifacts = newlyGenerated\.filter/);
  assert.match(desktopSource, /!insightSessionIds\.has\(artifact\.sessionId\)/);
  assert.match(desktopSource, /className="agent-os-insight-notification"/);
  assert.match(desktopSource, /className="agent-os-notification-center"/);
  assert.match(desktopSource, /className="agent-os-insight-list"/);
  assert.match(desktopSource, /insightResults\.slice\(0, 4\)\.map/);
  assert.doesNotMatch(desktopSource, /result\.summary/);
  assert.match(desktopSource, /hydrateInsightResult/);
  assert.match(desktopSource, /showBrowserNotification/);
  assert.match(desktopSource, /onClick=\{\(\) => openInsightResult\(result\)\}/);
  assert.match(cssSource, /\.agent-os-insight-notification \{[^}]*right: 18px;[^}]*top: 56px/);
  assert.match(cssSource, /\.agent-os-notification-center \{[^}]*transform-origin:/);
});
