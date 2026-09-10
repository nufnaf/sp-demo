import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import { calendarDescriptionForDisplay, demoCalendarDescription, DEMO_CALENDAR_MARKER } from "../lib/feishu-demo-calendar-marker.ts";
import * as calendarView from "../lib/calendar-view.ts";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("./PresentationSchedule.tsx", import.meta.url), "utf8");
const compiled = ts.transpile(source, { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX });

test("schedule hides only the ownership marker, preserves meeting details and leaves source data intact", () => {
  const event = {
    id: "alignment", title: "招聘标准对齐会", description: demoCalendarDescription("核对候选人的评价依据。\n保留团队议程。"),
    startsAt: "2026-09-11T10:00:00+08:00", endsAt: "2026-09-11T10:30:00+08:00", allDay: false,
    appLink: "https://applink.feishu.cn/client/calendar/event/detail",
  };
  const testModule = { exports: {} };
  vm.runInNewContext(compiled, { module: testModule, exports: testModule.exports, require: id => {
    if (id.endsWith(".css")) return {};
    if (id.includes("useFeishuCalendar")) return { useFeishuCalendar: () => ({ events: [event], date: "2026-09-11", loading: false, error: "", refresh() {}, setDate() {} }) };
    if (id.includes("calendar-view")) return calendarView;
    if (id.includes("feishu-demo-calendar-marker")) return { calendarDescriptionForDisplay };
    return require(id);
  } });
  const render = () => renderToStaticMarkup(testModule.exports.PresentationSchedule());
  const html = render();
  assert.match(html, /招聘标准对齐会/);
  assert.match(html, /核对候选人的评价依据。\n保留团队议程。/);
  assert.match(html, /在飞书中查看/);
  assert.doesNotMatch(html, /Syntropic 演示日程/);
  assert.ok(event.description.endsWith(DEMO_CALENDAR_MARKER), "reset retains the original ownership marker");
  event.description = DEMO_CALENDAR_MARKER;
  assert.doesNotMatch(render(), /会议说明/, "marker-only descriptions do not leave an empty section");
  const ordinary = `议程提及 ${DEMO_CALENDAR_MARKER}，请保留原文。`;
  assert.equal(calendarDescriptionForDisplay(ordinary), ordinary);
  assert.equal(calendarDescriptionForDisplay(`议程\r\n\r\n  ${DEMO_CALENDAR_MARKER}  `), "议程");
});
