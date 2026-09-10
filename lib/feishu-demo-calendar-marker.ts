// A dedicated marker, not a title match: never delete a user's similarly named meeting.
export const DEMO_CALENDAR_MARKER = "[Syntropic 演示日程]";
export function demoCalendarDescription(description: string): string {
  return `${description}\n\n${DEMO_CALENDAR_MARKER}`;
}

/** Hide the ownership marker only in the UI; reset still needs the original description. */
export function calendarDescriptionForDisplay(description: string): string {
  return description.split(/\r?\n/).filter(line => line.trim() !== DEMO_CALENDAR_MARKER).join("\n").trim();
}
