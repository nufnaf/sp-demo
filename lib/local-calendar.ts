import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const CALENDAR_SCRIPT = String.raw`
on run argv
  set eventTitle to item 1 of argv
  set startYear to item 2 of argv as integer
  set startMonth to item 3 of argv as integer
  set startDay to item 4 of argv as integer
  set startHour to item 5 of argv as integer
  set startMinute to item 6 of argv as integer
  set endYear to item 7 of argv as integer
  set endMonth to item 8 of argv as integer
  set endDay to item 9 of argv as integer
  set endHour to item 10 of argv as integer
  set endMinute to item 11 of argv as integer
  set eventLocation to item 12 of argv
  set eventNotes to item 13 of argv
  set eventMarker to item 14 of argv

  set startDate to current date
  set year of startDate to startYear
  set month of startDate to startMonth
  set day of startDate to startDay
  set time of startDate to (startHour * 3600 + startMinute * 60)

  set endDate to current date
  set year of endDate to endYear
  set month of endDate to endMonth
  set day of endDate to endDay
  set time of endDate to (endHour * 3600 + endMinute * 60)

  tell application "Calendar"
    set writableCalendars to every calendar whose writable is true
    if (count of writableCalendars) is 0 then error "没有可写入的本地日历"
    set targetCalendar to item 1 of writableCalendars

    set matchingEvents to every event of targetCalendar whose description contains eventMarker
    if (count of matchingEvents) > 0 then
      set existingEvent to item 1 of matchingEvents
      show existingEvent
      activate
      return "existing" & tab & (uid of existingEvent) & tab & (name of targetCalendar)
    end if

    set createdEvent to make new event at end of events of targetCalendar with properties {summary:eventTitle, start date:startDate, end date:endDate, location:eventLocation, description:eventNotes}
    tell createdEvent to make new display alarm at end of display alarms with properties {trigger interval:-600}
    show createdEvent
    activate
    return "created" & tab & (uid of createdEvent) & tab & (name of targetCalendar)
  end tell
end run
`;

export interface LocalCalendarEventInput {
  id: string;
  sourceLabel?: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  attendees: Array<{ name: string; role: string }>;
  agenda: string[];
  materials: string[];
}

export interface LocalCalendarEventResult {
  provider: "macos-calendar";
  status: "created" | "existing";
  eventId: string;
  calendarName: string;
  startsAt: string;
  endsAt: string;
}

interface LocalCalendarOptions {
  platform?: NodeJS.Platform;
  runScript?: (args: string[]) => Promise<string>;
}

function calendarDateParts(value: Date): string[] {
  return [
    value.getFullYear(),
    value.getMonth() + 1,
    value.getDate(),
    value.getHours(),
    value.getMinutes(),
  ].map(String);
}

function calendarNotes(input: LocalCalendarEventInput, marker: string): string {
  const attendees = input.attendees.map((attendee) => `• ${attendee.name}（${attendee.role}）`).join("\n");
  const agenda = input.agenda.map((item, index) => `${index + 1}. ${item}`).join("\n");
  const materials = input.materials.map((item) => `• ${item}`).join("\n");
  return [
    input.sourceLabel ? `由 Agent OS 根据${input.sourceLabel}创建。` : "由 Agent OS 根据招聘洞察创建。",
    "",
    "参会人",
    attendees,
    "",
    "议程",
    agenda,
    "",
    "会前材料",
    materials,
    "",
    marker,
  ].join("\n");
}

function explainCalendarError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (/(-1743|not authorized|not permitted|不允许|无权)/i.test(message)) {
    return new Error("没有本地日历权限，请在“系统设置 → 隐私与安全性 → 自动化”中允许当前应用控制日历");
  }
  if (/timed out|timeout/i.test(message)) {
    return new Error("等待本地日历授权超时，请确认系统授权弹窗后重试");
  }
  return new Error(`无法写入本地日历：${message}`);
}

export async function createLocalCalendarEvent(
  input: LocalCalendarEventInput,
  options: LocalCalendarOptions = {},
): Promise<LocalCalendarEventResult> {
  if ((options.platform ?? process.platform) !== "darwin") {
    throw new Error("本地日历写入目前仅支持 macOS");
  }
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
    throw new Error("会议时间无效");
  }

  const marker = `[agent-os-calendar:${input.id}]`;
  const args = [
    input.title,
    ...calendarDateParts(startsAt),
    ...calendarDateParts(endsAt),
    input.location,
    calendarNotes(input, marker),
    marker,
  ];
  const runScript = options.runScript ?? (async (scriptArgs: string[]) => {
    const { stdout } = await execFileAsync("/usr/bin/osascript", ["-e", CALENDAR_SCRIPT, "--", ...scriptArgs], {
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });
    return stdout;
  });

  try {
    const output = (await runScript(args)).trim();
    const [status, eventId, calendarName] = output.split("\t");
    if ((status !== "created" && status !== "existing") || !eventId || !calendarName) {
      throw new Error("日历没有返回有效的事件信息");
    }
    return {
      provider: "macos-calendar",
      status,
      eventId,
      calendarName,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    };
  } catch (error) {
    throw explainCalendarError(error);
  }
}

export { CALENDAR_SCRIPT };
