import { randomUUID } from "node:crypto";
export class ValidationError extends Error {}

export const STAGES = {
  applied: "待简历筛选",
  screened: "待安排面试",
  interviewing: "面试进行中",
  pending: "面试结束 · 待结论",
  passed: "面试通过",
  failed: "面试失败",
  rejected: "简历未通过",
};

export function interviewsFinished(application) {
  return (
    application.interviews.length > 0 &&
    application.interviews.every((round) => Boolean(round.endedAt))
  );
}

export function missingReviews(application) {
  return application.interviews.filter(
    (round) => round.endedAt && round.review?.status !== "submitted",
  );
}

export function stage(application) {
  if (application.decision) return application.decision;
  if (interviewsFinished(application)) return "pending";
  if (application.interviews.length) return "interviewing";
  if (application.screening === "passed") return "screened";
  if (application.screening === "rejected") return "rejected";
  return "applied";
}

// Milestones are historical facts. A later decision never removes someone
// from an earlier cumulative count. Current states are mutually exclusive.
export function metrics(applications) {
  return {
    applied: applications.length,
    screened: applications.filter((a) => Boolean(a.screenedAt)).length,
    interviewing: applications.filter((a) => a.interviews.length > 0).length,
    finished: applications.filter(interviewsFinished).length,
    passed: applications.filter((a) => a.decision === "passed").length,
    failed: applications.filter((a) => a.decision === "failed").length,
    missing: applications.filter(
      (a) => interviewsFinished(a) && missingReviews(a).length > 0,
    ).length,
    current: Object.fromEntries(
      Object.keys(STAGES).map((key) => [
        key,
        applications.filter((a) => stage(a) === key).length,
      ]),
    ),
  };
}

export function filterApplications(data, params) {
  const q = (params.get("q") ?? "").trim().toLowerCase();
  return data.applications.filter((a) => {
    const job = data.jobs.find((j) => j.id === a.jobId);
    return (
      (!params.get("job") || a.jobId === params.get("job")) &&
      (!q ||
        [a.name, a.id, a.school, a.company, job.title]
          .join(" ")
          .toLowerCase()
          .includes(q)) &&
      (!params.get("stage") || stage(a) === params.get("stage")) &&
      (!params.get("finished") || interviewsFinished(a)) &&
      (!params.get("missing") || missingReviews(a).length > 0)
    );
  });
}

function required(value, label, max = 3000) {
  const text = String(value ?? "").trim();
  if (!text || text.length > max)
    throw new ValidationError(`${label}必填，且不能超过 ${max} 字`);
  return text;
}

export function mutate(data, path, fields, now = new Date().toISOString()) {
  const next = structuredClone(data);
  const parts = path.split("/").filter(Boolean);
  if (path === "/jobs/publish") {
    const draft = required(fields.draft, "发布编号", 80);
    if (!/^[a-zA-Z0-9-]{8,80}$/.test(draft)) throw new ValidationError("发布编号无效");
    if (next.jobs.some((job) => job.draft === draft)) return next;
    const target = Number(fields.target);
    if (!Number.isInteger(target) || target < 1 || target > 100) throw new ValidationError("招聘目标应为 1–100 的整数");
    next.jobs.unshift({
      id: `job-${randomUUID()}`, draft, publishedAt: now,
      title: required(fields.title, "岗位名称", 100),
      department: required(fields.department, "部门", 80),
      location: required(fields.location, "工作地点", 100),
      owner: required(fields.owner, "招聘负责人", 40),
      target, description: required(fields.description, "岗位 JD", 12000), skills: [],
    });
    if (next.presentation && !next.presentation.jobId) {
      const job = next.jobs[0];
      next.presentation.jobId = job.id;
      next.applications.push(...next.presentation.pendingCandidates.map((candidate) => ({ ...candidate, jobId: job.id })));
      next.presentation.pendingCandidates = [];
    }
    return next;
  }
  if (parts[0] === "jobs") {
    const job = next.jobs.find((j) => j.id === parts[1]);
    if (!job || parts[2] !== "save") throw new ValidationError("职位不存在");
    const target = Number(fields.target);
    if (!Number.isInteger(target) || target < 1 || target > 100)
      throw new ValidationError("招聘目标应为 1–100 的整数");
    job.target = target;
    job.owner = required(fields.owner, "负责人", 40);
    job.description = required(fields.description, "职位说明", 12000);
    return next;
  }
  const a = next.applications.find((a) => a.id === parts[1]);
  if (!a) throw new ValidationError("候选人不存在");
  if (parts[2] === "review") {
    const round = a.interviews.find((r) => r.id === parts[3]);
    if (!round?.endedAt)
      throw new ValidationError("只有已结束的面试可以填写评价");
    if (!["draft", "submitted"].includes(fields.status))
      throw new ValidationError("无效的评价状态");
    const score = Number(fields.score);
    if (!Number.isInteger(score) || score < 1 || score > 5)
      throw new ValidationError("评分应为 1–5 的整数");
    if (!["strong_yes", "yes", "no", "undecided"].includes(fields.conclusion))
      throw new ValidationError("请选择有效的面试结论");
    const opinion =
      fields.status === "submitted"
        ? required(fields.opinion, "评价意见")
        : String(fields.opinion ?? "").trim();
    if (opinion.length > 3000)
      throw new ValidationError("评价意见不能超过 3000 字");
    if (fields.status === "submitted" && fields.conclusion === "undecided")
      throw new ValidationError("提交评价时必须选择明确结论");
    if (a.decision && fields.status === "draft")
      throw new ValidationError("候选人已有最终结论，不能将评价退回草稿");
    round.review = {
      status: fields.status,
      score,
      opinion,
      conclusion: fields.conclusion,
      updatedAt: now,
    };
    a.history.push({
      at: now,
      text: `${round.name} · ${round.interviewer}的评价${fields.status === "draft" ? "保存为草稿" : "已提交"}`,
    });
  } else if (parts[2] === "decision") {
    if (!interviewsFinished(a))
      throw new ValidationError("所有已安排面试结束后才能记录最终结论");
    if (missingReviews(a).length)
      throw new ValidationError("请先提交所有面试评价，再标记面试通过或失败");
    if (!["passed", "failed"].includes(fields.decision))
      throw new ValidationError("请选择通过或失败");
    const reason = required(fields.reason, "决策说明", 1000);
    a.decision = fields.decision;
    a.decisionReason = reason;
    a.history.push({ at: now, text: `${STAGES[a.decision]}：${reason}` });
  } else throw new ValidationError("操作不存在");
  return next;
}
