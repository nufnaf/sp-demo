// A dedicated marker, not a title match: never delete a user's similarly named meeting.
export const DEMO_CALENDAR_MARKER = "[Syntropic 演示日程]";
// GUI previews expose the native description, so use a natural attribution.
export const COMPUTER_CALENDAR_MARKER = "由 Syntropic 安排";
export const SYNTROPIC_CALENDAR_NAME = "招聘日程-syntropic";
export const SYNTROPIC_EVENT_SUFFIX = "-syntropic";
export const SYNTROPIC_ALIGNMENT_EVENT_TITLE = "面试标准对齐-syntropic";
export function syntropicEventTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed.endsWith(SYNTROPIC_EVENT_SUFFIX) ? trimmed : `${trimmed}${SYNTROPIC_EVENT_SUFFIX}`;
}
export function computerCalendarDescription(description: string): string { return `${description}\n\n${COMPUTER_CALENDAR_MARKER}`; }
export function demoCalendarDescription(description: string): string {
  return `${description}\n\n${DEMO_CALENDAR_MARKER}`;
}

/** Hide the ownership marker only in the UI; reset still needs the original description. */
export function calendarDescriptionForDisplay(description: string): string {
  return description.split(/\r?\n/).filter(line => ![DEMO_CALENDAR_MARKER, COMPUTER_CALENDAR_MARKER].includes(line.trim())).join("\n").trim();
}
