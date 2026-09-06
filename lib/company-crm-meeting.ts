import type { CrmSource } from "./crm";

export function crmMeetingProposal(source: CrmSource, now = Date.now()) {
  const customer = source.data.customers.find((row) => row.id === "company-crm:yunzhou");
  if (!customer) throw new Error("客户资料不可用");
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  const delivery = customer.note.match(/交付负责人([^；。]+)/)?.[1]?.trim();
  const attendees = [
    { name: customer.owner, role: "牵头人 · 销售负责人" },
    ...customer.contact.split("/").map((part) => { const [name, role] = part.trim().split("·"); return { name: name.trim(), role: role?.trim() || "客户相关方" }; }),
    { name: delivery || "交付负责人", role: "补齐验收材料" },
  ];
  return {
    title: `${customer.name}回款推进会｜验收与付款安排对齐`,
    startsAt: date.toISOString(), endsAt: new Date(date.getTime() + 30 * 60000).toISOString(),
    location: "线上会议（会议链接待林一补充）",
    attendees,
    agenda: ["林一说明订单余额与回款阻塞（5 分钟）", "交付与客户逐项确认验收缺项、责任人和签字时间（15 分钟）", "财务确认付款前置材料与预计安排（5 分钟）", "林一汇总责任清单和下一次检查时间（5 分钟）"],
    materials: ["订单 SO-26001 及付款条件", "验收报告、培训签到附件和签字状态", "发票接收记录及客户财务要求", "CRM 最新跟进记录"],
  };
}
