import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const bridgeSource = await readFile(new URL("./RecruitingInsightPreview.tsx", import.meta.url), "utf8");
const viewerSource = await readFile(new URL("./FileViewer.tsx", import.meta.url), "utf8");

test("recruiting artifacts use a narrow parent-page bridge for local calendar access", () => {
  assert.match(viewerSource, /recruiting-interviewer-alignment-/);
  assert.match(viewerSource, /<RecruitingInsightPreview content=\{content\}/);
  assert.match(bridgeSource, /event\.origin !== "null"/);
  assert.match(bridgeSource, /data\?\.type !== "recruiting-calendar"/);
  assert.match(bridgeSource, /data\.action !== "schedule"/);
  assert.match(bridgeSource, /schedule_alignment_meeting/);
  assert.match(bridgeSource, /type: "recruiting-calendar-result"/);
  assert.match(bridgeSource, /bridgeLegacyInsight\(content\)/);
  assert.match(bridgeSource, /calendar-legacy-/);
  assert.match(bridgeSource, /input!==\'\/api\/apps\/company-careers\/actions\'/);
});

test("the bridge keeps the artifact sandboxed and meeting details server-owned", () => {
  assert.match(bridgeSource, /sandbox="allow-scripts"/);
  assert.doesNotMatch(bridgeSource, /allow-same-origin/);
  assert.doesNotMatch(bridgeSource, /startsAt: data/);
  assert.doesNotMatch(bridgeSource, /attendees: data/);
});
