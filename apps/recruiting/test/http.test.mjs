import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { FileStore } from "../src/store.mjs";
import { createHandler } from "../src/handler.mjs";

test("HTML forms save then redirect to persisted detail; stale/cross-site forms cannot overwrite data", async () => {
  const dir = await mkdtemp(join(tmpdir(), "recruiting-http-"));
  const store = new FileStore(join(dir, "state.json"));
  const server = createServer(createHandler(async () => store));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const post = (path, fields, from = origin) =>
    fetch(origin + path, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: from,
      },
      body: new URLSearchParams(fields),
    });
  try {
    const html = await fetch(
      origin + "/jobs/ai-agent?finished=1&missing=1",
    ).then((r) => r.text());
    assert.match(html, /筛选结果：3 人/);
    assert.match(html, /NF-1001/);
    assert.doesNotMatch(html, /NF-1013/);
    const { revision } = await store.read();
    const fields = {
      revision,
      score: "4",
      opinion: "演示评价已保存 <script>test</script>",
      conclusion: "yes",
      status: "submitted",
    };
    const saved = await post("/candidates/NF-1001/review/round-2", fields);
    assert.equal(saved.status, 303);
    const detail = await fetch(origin + saved.headers.get("location")).then(
      (r) => r.text(),
    );
    assert.match(detail, /保存成功/);
    assert.match(detail, /演示评价已保存 &lt;script&gt;test&lt;\/script&gt;/);
    assert.match(detail, /最终面试结论/);
    assert.equal(
      (await post("/candidates/NF-1001/review/round-2", fields)).status,
      409,
    );
    assert.equal(
      (
        await post(
          "/reset",
          { revision: (await store.read()).revision, confirm: "reset" },
          "https://other.example",
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await post("/reset", {
          revision: (await store.read()).revision,
          confirm: "reset",
        })
      ).status,
      303,
    );
    assert.equal(
      (await fetch(origin + "/api/candidates")).status,
      404,
      "no Agent business API",
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});
