// A dedicated marker, not a title match: never delete a user's similarly named meeting.
export const DEMO_CALENDAR_MARKER = "[Syntropic 演示日程]";
export function demoCalendarDescription(description: string): string {
  return `${description}\n\n${DEMO_CALENDAR_MARKER}`;
}
