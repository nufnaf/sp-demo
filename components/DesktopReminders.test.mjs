import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const remindersSource = await readFile(new URL("./DesktopReminders.tsx", import.meta.url), "utf8");
const desktopSource = await readFile(new URL("./AgentDesktop.tsx", import.meta.url), "utf8");
const cssSource = await readFile(new URL("./AgentDesktop.css", import.meta.url), "utf8");

test("desktop reminders persist per workspace and turn launches into task links", () => {
  assert.match(remindersSource, /pi-web:desktop-reminders:/);
  assert.match(remindersSource, /window\.localStorage\.setItem/);
  assert.match(remindersSource, /aria-label=\{`交给 Pi 执行：\$\{item\.title\}`\}/);
  assert.match(remindersSource, /const sessionId = await onLaunch\(item\.title\)/);
  assert.match(remindersSource, /candidate\.id === item\.id \? \{ \.\.\.candidate, sessionId \}/);
  assert.match(remindersSource, /aria-label=\{`查看任务：\$\{item\.title\}`\}/);
  assert.match(remindersSource, /onOpenTask\(item\.sessionId!\)/);
  assert.match(remindersSource, /className="agent-os-reminder-action is-detail"/);
  assert.match(remindersSource, /className="agent-os-reminder-action is-run"/);
  assert.match(remindersSource, /<span>查看任务<\/span>/);
  assert.match(remindersSource, /launching \? "下发中" : "交给 Pi"/);
  assert.match(desktopSource, /<DesktopReminders/);
  assert.match(desktopSource, /请完成以下待办事项：\$\{title\}/);
  assert.match(desktopSource, /onOpenTask=\{openTask\}/);
  assert.match(desktopSource, /fetch\("\/api\/agent\/new"/);
  assert.match(desktopSource, /return data\.sessionId/);
});

test("desktop reminders follow the desktop material and accessibility rules", () => {
  assert.match(cssSource, /\.agent-os-reminders \{[^}]*--reminder-accent: #ff9500/);
  assert.match(cssSource, /\.agent-os-reminder-check:active/);
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(remindersSource, /aria-live="polite"/);
  assert.match(remindersSource, /aria-pressed=\{item\.completed\}/);
  assert.match(remindersSource, /const pendingItems = useMemo/);
  assert.match(remindersSource, /const completedItems = useMemo/);
  assert.match(remindersSource, /aria-expanded=\{showCompleted\}/);
  assert.match(remindersSource, />待完成</);
  assert.match(remindersSource, />已完成 /);
  assert.match(remindersSource, /想到什么，先记下来/);
  assert.match(remindersSource, /一句话就够了，之后可以交给 Pi/);
  assert.doesNotMatch(remindersSource, />发起</);
  assert.doesNotMatch(remindersSource, />查看 /);
  assert.match(cssSource, /\.agent-os-reminder-row\.is-completed \.agent-os-reminder-check/);
  assert.match(cssSource, /\.agent-os-reminders-group\.is-completed-group/);
  assert.match(cssSource, /\.agent-os \.agent-os-reminder-action \{[^}]*font-size: 8px/);
  assert.match(cssSource, /\.agent-os \.agent-os-reminders-completed-toggle \{[^}]*font-size: 8px/);
});
