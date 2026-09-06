import assert from "node:assert/strict";
import test from "node:test";
import { compactDesktopTurns } from "./desktop-conversation.ts";

const task = { sessionId: "task-1", description: "生成报告", status: "running", createdAt: "2026-09-06" };
test("task completion updates the original card without removing surrounding conversation", () => {
  const turns = [
    { id: 1, role: "user", text: "生成报告" },
    { id: 2, role: "task", text: "生成报告", task, taskEvent: "started" },
    { id: 3, role: "assistant", text: "我开始了" },
    { id: 4, role: "task", text: "完成", task: { ...task, status: "completed" }, taskEvent: "settled" },
    { id: 5, role: "assistant", text: "报告已完成" },
  ];
  const result = compactDesktopTurns(turns, []);
  assert.deepEqual(result.map((turn) => turn.id), [1, 2, 3, 5]);
  assert.equal(result[1].task.status, "completed");
  assert.equal(turns[1].task.status, "running");
});
test("live task state wins and a completion without a start still remains visible", () => {
  const turns = [{ id: 4, role: "task", text: "完成", task, taskEvent: "started" }];
  assert.equal(compactDesktopTurns(turns, [{ ...task, status: "aborted" }])[0].taskEvent, "settled");
  assert.equal(compactDesktopTurns([{ ...turns[0], task: { ...task, status: "completed" } }], []).length, 1);
});
