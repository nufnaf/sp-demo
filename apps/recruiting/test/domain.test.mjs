import test from "node:test";
import assert from "node:assert/strict";
import { seedData } from "../src/seed.mjs";
import {
  metrics,
  stage,
  missingReviews,
  interviewsFinished,
  filterApplications,
  mutate,
} from "../src/domain.mjs";

test("seed facts, current states and all six counters agree for every role", () => {
  const data = seedData();
  assert.equal(new Set(data.applications.map((a) => a.id)).size, 62);
  assert.equal(new Set(data.applications.map((a) => a.name)).size, 62);
  for (const job of data.jobs) {
    const applications = data.applications.filter((a) => a.jobId === job.id);
    const m = metrics(applications);
    assert.equal(
      Object.values(m.current).reduce((a, b) => a + b, 0),
      m.applied,
    );
    assert.ok(
      m.applied >= m.screened &&
        m.screened >= m.interviewing &&
        m.interviewing >= m.finished,
    );
    assert.equal(m.passed + m.failed + m.current.pending, m.finished);
    for (const a of applications) {
      if (a.interviews.length) assert.ok(a.screenedAt);
      if (a.decision) {
        assert.ok(interviewsFinished(a));
        assert.equal(missingReviews(a).length, 0);
      }
    }
  }
  const { current, missing, ...six } = metrics(
    data.applications.filter((a) => a.jobId === "ai-agent"),
  );
  assert.deepEqual(six, {
    applied: 30,
    screened: 24,
    interviewing: 18,
    finished: 12,
    passed: 7,
    failed: 2,
  });
  assert.equal(missing, 3);
  assert.equal(current.pending, 3);
});

test("query includes drafts and multiple missing rounds, excludes unfinished interview processes", () => {
  const data = seedData();
  const matches = filterApplications(
    data,
    new URLSearchParams({ job: "ai-agent", finished: "1", missing: "1" }),
  );
  assert.deepEqual(
    matches.map((a) => a.name),
    ["林然", "许宁", "苏悦"],
  );
  assert.deepEqual(
    matches.map((a) => missingReviews(a).length),
    [1, 2, 1],
  );
  assert.equal(matches[2].interviews[1].review.status, "draft");
  assert.ok(
    filterApplications(
      data,
      new URLSearchParams({ job: "ai-agent", missing: "1" }),
    ).length > 3,
  );
  assert.deepEqual(
    filterApplications(data, new URLSearchParams({ q: "NF-1002" })).map(
      (a) => a.name,
    ),
    ["许宁"],
  );
});

test("submitting feedback and changing final decisions updates only current results, retaining cumulative milestones", () => {
  const data = seedData();
  assert.throws(
    () =>
      mutate(data, "/candidates/NF-1001/decision", {
        decision: "passed",
        reason: "符合预期",
      }),
    /先提交所有/,
  );
  const reviewed = mutate(data, "/candidates/NF-1001/review/round-2", {
    score: "4",
    opinion: "能清晰拆解 Agent 可靠性问题，具备生产项目经验。",
    conclusion: "yes",
    status: "submitted",
  });
  assert.equal(
    metrics(reviewed.applications).missing,
    metrics(data.applications).missing - 1,
  );
  const passed = mutate(reviewed, "/candidates/NF-1001/decision", {
    decision: "passed",
    reason: "面试证据符合要求",
  });
  const failed = mutate(passed, "/candidates/NF-1001/decision", {
    decision: "failed",
    reason: "复核后更正结论",
  });
  assert.equal(stage(passed.applications[0]), "passed");
  assert.equal(stage(failed.applications[0]), "failed");
  assert.equal(
    metrics(passed.applications).passed,
    metrics(data.applications).passed + 1,
  );
  assert.equal(
    metrics(failed.applications).passed,
    metrics(data.applications).passed,
  );
  for (const key of ["applied", "screened", "interviewing", "finished"])
    assert.equal(
      metrics(failed.applications)[key],
      metrics(data.applications)[key],
    );
  assert.throws(
    () =>
      mutate(passed, "/candidates/NF-1001/review/round-2", {
        score: "4",
        status: "draft",
        conclusion: "yes",
      }),
    /不能将评价退回/,
  );
  assert.equal(
    data.applications[0].interviews[1].review,
    null,
    "mutations must not change the seed",
  );
});

test("invalid submissions never manufacture a completed evaluation", () => {
  const data = seedData();
  const path = "/candidates/NF-1001/review/round-2";
  assert.throws(
    () => mutate(data, path, { score: "9", status: "submitted" }),
    /评分/,
  );
  assert.throws(
    () =>
      mutate(data, path, {
        score: "4",
        status: "submitted",
        conclusion: "yes",
        opinion: "",
      }),
    /必填/,
  );
  assert.throws(
    () =>
      mutate(data, path, {
        score: "4",
        status: "submitted",
        conclusion: "undecided",
        opinion: "意见",
      }),
    /明确结论/,
  );
  assert.throws(
    () =>
      mutate(data, "/candidates/NF-1013/review/round-2", {
        score: "4",
        status: "submitted",
        conclusion: "yes",
        opinion: "意见",
      }),
    /只有已结束/,
  );
});
