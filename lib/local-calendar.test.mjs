import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const calendarSource = await readFile(new URL("./local-calendar.ts", import.meta.url), "utf8");
const actionSource = await readFile(
  new URL("../app/api/apps/company-careers/actions/route.ts", import.meta.url),
  "utf8",
);

test("local calendar events are idempotent and use argument-safe AppleScript", () => {
  assert.match(calendarSource, /\[agent-os-calendar:\$\{input\.id\}\]/);
  assert.match(calendarSource, /whose description contains eventMarker/);
  assert.match(calendarSource, /return "existing"/);
  assert.match(calendarSource, /return "created"/);
  assert.match(calendarSource, /\["-e", CALENDAR_SCRIPT, "--", \.\.\.scriptArgs\]/);
  assert.doesNotMatch(calendarSource, /summary:\$\{/);
});

test("local calendar events carry the complete meeting context", () => {
  assert.match(calendarSource, /由 Syntropic 根据招聘洞察创建/);
  assert.match(calendarSource, /参会人/);
  assert.match(calendarSource, /议程/);
  assert.match(calendarSource, /会前材料/);
  assert.match(calendarSource, /trigger interval:-600/);
  assert.equal(calendarSource.match(/show (?:existing|created)Event/g)?.length, 2);
  assert.equal(calendarSource.match(/\n\s+activate/g)?.length, 2);
});

test("the recruiting action writes the scheduled meeting to the local calendar", () => {
  assert.match(actionSource, /scheduleCompanyCareersAlignmentMeeting\(\)/);
  assert.match(actionSource, /createLocalCalendarEvent\(\{/);
  assert.match(actionSource, /return NextResponse\.json\(\{ meeting, localCalendar \}\)/);
});

test("calendar permission and platform failures are explained", () => {
  assert.match(calendarSource, /process\.platform/);
  assert.match(calendarSource, /目前仅支持 macOS/);
  assert.match(calendarSource, /隐私与安全性 → 自动化/);
  assert.match(calendarSource, /授权超时/);
});
