import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const desktopSource = await readFile(new URL("./AgentDesktop.tsx", import.meta.url), "utf8");
const reminderSource = await readFile(new URL("./DesktopReminders.tsx", import.meta.url), "utf8");
const cssSource = await readFile(new URL("./AgentDesktop.css", import.meta.url), "utf8");
const engineSource = await readFile(new URL("../lib/insight-engine.ts", import.meta.url), "utf8");
const rpcSource = await readFile(new URL("../lib/rpc-manager.ts", import.meta.url), "utf8");

test("desktop reads server-owned proactive insights instead of counting browser task completions", () => {
  assert.match(desktopSource, /fetch\(`\/api\/insights\?\$\{params\}`/);
  assert.match(desktopSource, /setInsightResults\(results\)/);
  assert.match(desktopSource, /持续监听飞书文档、会议和任务变化/);
  assert.doesNotMatch(desktopSource, /queuedCompletedIds\.length < INSIGHT_BATCH_SIZE/);
  assert.doesNotMatch(desktopSource, /pi-web:insight-automation:/);
});

test("server engine coalesces task and Feishu changes before a tool-free analysis", () => {
  assert.match(engineSource, /ANALYSIS_DEBOUNCE_MS = 20_000/);
  assert.match(engineSource, /vc\.meeting\.participant_meeting_ended_v1/);
  assert.match(engineSource, /getFeishuDocumentActivities\("opened"\)/);
  assert.match(engineSource, /getFeishuDocumentActivities\("edited"\)/);
  assert.doesNotMatch(engineSource, /im\.message\.receive_v1/);
  assert.match(desktopSource, /activity: "document\.opened"/);
  assert.match(engineSource, /role: "insight"/);
  assert.match(engineSource, /toolNames: \[\]/);
  assert.match(engineSource, /<NO_INSIGHT\/>/);
  assert.match(rpcSource, /type: "task\.requirement_changed"/);
  assert.match(rpcSource, /type: "task\.completed"/);
  assert.match(reminderSource, /onHistoryChange\?\.\(items\)/);
});

test("insight artifacts stay closed and are surfaced through lists and notifications", () => {
  assert.match(desktopSource, /desktopArtifacts = newlyGenerated\.filter/);
  assert.match(desktopSource, /!insightSessionIds\.has\(artifact\.sessionId\)/);
  assert.match(desktopSource, /className="agent-os-insight-notification"/);
  assert.match(desktopSource, /className="agent-os-notification-center"/);
  assert.match(desktopSource, /className="agent-os-insight-list"/);
  assert.match(desktopSource, /insightResults\.slice\(0, 4\)\.map/);
  assert.doesNotMatch(desktopSource, /result\.summary/);
  assert.match(engineSource, /writeFile\(filePath/);
  assert.match(engineSource, /notifyInsight/);
  assert.match(desktopSource, /onClick=\{\(\) => openInsightResult\(result\)\}/);
  assert.match(cssSource, /\.agent-os-insight-notification \{[^}]*right: 18px;[^}]*top: 56px/);
  assert.match(cssSource, /\.agent-os-notification-center \{[^}]*transform-origin:/);
  assert.match(cssSource, /\.agent-os-insight-card \{[^}]*width: 350px;[^}]*overflow: hidden;[^}]*\}/);
  assert.match(cssSource, /\.agent-os-insight-list \{[^}]*padding: 5px 8px 8px;[^}]*\}/);
  assert.doesNotMatch(cssSource, /\.agent-os-insight-list \{[^}]*overflow-y:\s*auto/);
});
