import { NextResponse } from "next/server";
import { scheduleCompanyCareersAlignmentMeeting } from "@/lib/company-careers";
import { createLocalCalendarEvent } from "@/lib/local-calendar";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasJsonContentType(request)) return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  try {
    const body = await request.json() as { action?: unknown };
    if (body.action !== "schedule_alignment_meeting") return NextResponse.json({ error: "未知操作" }, { status: 400 });
    const meeting = await scheduleCompanyCareersAlignmentMeeting();
    const localCalendar = await createLocalCalendarEvent({
      id: meeting.id,
      title: meeting.title,
      startsAt: meeting.startsAt,
      endsAt: meeting.endsAt,
      location: "线上会议（会议链接待补充）",
      attendees: meeting.attendees,
      agenda: meeting.agenda,
      materials: meeting.materials,
    });
    return NextResponse.json({ meeting, localCalendar });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
