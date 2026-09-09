import type { DemoMeeting } from "./recruiting-scene";

/** Presentation-only appointments, shared by the home card and schedule window. */
export function recruitingHomeSchedule(now: Date, meeting: DemoMeeting | null): DemoMeeting[] {
  const appointment = (id: string, title: string, hour: number, minute: number, agenda: string[]): DemoMeeting => {
    const start = new Date(now);
    start.setHours(hour, minute, 0, 0);
    return { id: `home-${id}`, title, startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 30 * 60_000).toISOString(), attendees: ["招聘负责人", "Agent 研发负责人"], agenda, simulated: true };
  };
  return [
    appointment("requirements", "AI Agent 工程师 · 招聘需求沟通", 10, 0, ["确认 6 位工程师的招聘目标与优先级", "核对岗位职责、工作地点和团队协作方式"]),
    appointment("materials", "招聘渠道与 JD 材料评审", 16, 30, ["审阅业务介绍和岗位材料", "确认招聘渠道及待补充信息"]),
    ...(meeting ? [meeting] : []),
  ].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}
