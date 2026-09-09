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

test("publishing a JD persists one job, verifies it on the page, and projects the same result to the desktop", async () => {
  const dir = await mkdtemp(join(tmpdir(), "recruiting-publish-"));
  const file = join(dir, "state.json");
  const store = new FileStore(file);
  const server = createServer(createHandler(async () => store));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const post = (fields) => fetch(origin + "/jobs/publish", { method: "POST", redirect: "manual", headers: { Origin: origin, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields) });
  try {
    const before = await store.read();
    const draft = "jd-test-publication-2026";
    assert.deepEqual((await fetch(origin + "/desktop/published-jobs").then(r => r.json())).jobs, []);
    assert.match(await fetch(origin + "/jobs/new?draft=" + draft).then(r => r.text()), /name="description"/);
    const description = "职责与任职要求\n" + "参与智能体平台开发、评测和可靠性建设。\n".repeat(200) + "<script>alert(1)</script>";
    const fields = { revision: before.revision, draft, title: "高级 AI Agent 工程师", department: "Agent 研发", location: "北京 / 上海", target: "6", owner: "陈晓", description };
    assert.equal((await post({ ...fields, title: "" })).status, 400);
    assert.equal((await store.read()).data.jobs.length, before.data.jobs.length);
    const response = await post(fields);
    assert.equal(response.status, 303);
    const detail = await fetch(origin + response.headers.get("location")).then(r => r.text());
    assert.match(detail, /职位发布成功/);
    assert.match(detail, /高级 AI Agent 工程师/);
    assert.match(detail, /&lt;script&gt;alert/);
    const after = await new FileStore(file).read();
    assert.equal(after.data.jobs.length, before.data.jobs.length + 1);
    assert.deepEqual(after.data.applications, before.data.applications, "publishing must preserve all existing recruitment history");
    assert.equal(after.data.jobs[0].description, description);
    const projection = await fetch(origin + "/desktop/published-jobs").then(r => r.json());
    assert.equal(projection.jobs.length, 1);
    assert.equal(projection.jobs[0].id, after.data.jobs[0].id);
    assert.equal(projection.jobs[0].candidateCount, 0);
    assert.equal(projection.jobs[0].headcount, 6);
    assert.equal((await post(fields)).status, 409, "stale form must not create another job");
    assert.equal((await post({ ...fields, revision: after.revision })).status, 303);
    assert.equal((await store.read()).data.jobs.length, after.data.jobs.length, "repeat publication key must not duplicate a job");
    const reopened = await fetch(origin + "/jobs/new?draft=" + draft).then(r => r.text());
    assert.match(reopened, /职位发布成功/);
    assert.doesNotMatch(reopened, /action="\/jobs\/publish"/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});

test("two demo runs publish the same JD independently and keep every link, form and redirect scoped", async () => {
  const { seedData } = await import('../src/seed.mjs');
  const dir = await mkdtemp(join(tmpdir(), 'recruiting-scopes-'));
  const stores = new Map();
  const provider = async scope => {
    const key = scope ?? 'legacy';
    if (!stores.has(key)) stores.set(key, new FileStore(join(dir, key + '.json'), () => seedData(true)));
    return stores.get(key);
  };
  const server = createServer(createHandler(provider));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const scopes = ['a'.repeat(32), 'b'.repeat(32)];
  try {
    const ids = [];
    for (const scope of scopes) {
      const prefix = `/demo/${scope}`;
      const read = () => fetch(origin + prefix + '/desktop/published-jobs').then(r => r.json());
      assert.deepEqual((await read()).jobs, []);
      const form = await fetch(origin + prefix + '/jobs/new?draft=same-jd-test').then(r => r.text());
      for (const [, path] of form.matchAll(/(?:href|action)="(\/[^"]*)"/g)) assert.ok(path.startsWith(prefix + '/'), path);
      const revision = (await (await provider(scope)).read()).revision;
      const response = await fetch(origin + prefix + '/jobs/publish', { method: 'POST', redirect: 'manual', headers: {Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({revision,draft:'same-jd-test',title:'AI Agent 工程师',description:'完整 JD',target:'6',location:'北京',department:'研发',owner:'陈晓'}) });
      assert.equal(response.status,303); assert.ok(response.headers.get('location').startsWith(prefix+'/jobs/'));
      const data = await read(); assert.equal(data.jobs.length,1); assert.equal(data.scene.job.id,data.jobs[0].id);
      assert.equal(data.scene.metrics.applied,30); assert.equal(data.scene.insight.disagreementCount,3); ids.push(data.jobs[0].id);
      assert.equal((await fetch(origin + response.headers.get('location'))).status,200);
    }
    assert.notEqual(ids[0],ids[1]);
    const reloaded = await fetch(origin+'/demo/'+scopes[0]+'/desktop/published-jobs').then(r=>r.json());
    assert.equal(reloaded.jobs[0].id,ids[0]);
    assert.deepEqual((await fetch(origin+'/desktop/published-jobs').then(r=>r.json())).jobs,[],'legacy records unchanged');
    assert.equal((await fetch(origin+'/demo/invalid/jobs/new')).status,404);
  } finally { await new Promise(resolve=>server.close(resolve)); await rm(dir,{recursive:true,force:true}); }
});
