import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileStore, NeonStore, Conflict } from "../src/store.mjs";
import { mutate, metrics } from "../src/domain.mjs";
import { seedData } from "../src/seed.mjs";

test("file persistence survives a new store, serializes races and scoped reset invalidates old forms", async () => {
  const dir = await mkdtemp(join(tmpdir(), "recruiting-test-"));
  try {
    const file = join(dir, "state.json");
    await writeFile(join(dir, "other-app.json"), "untouched");
    const store = new FileStore(file),
      state = await store.read();
    const change = (data) =>
      mutate(data, "/jobs/ai-agent/save", {
        target: "8",
        owner: "演示负责人",
        description: "新的职位说明",
      });
    const concurrent = await Promise.allSettled([
      store.update(state.revision, change),
      store.update(state.revision, change),
    ]);
    assert.deepEqual(
      concurrent.map((r) => r.status),
      ["fulfilled", "rejected"],
    );
    assert.ok(concurrent[1].reason instanceof Conflict);
    const reloaded = await new FileStore(file).read();
    assert.equal(reloaded.data.jobs[0].target, 8);
    const reset = await store.update(reloaded.revision, seedData);
    assert.equal(reset.data.jobs[0].target, 6);
    assert.equal(metrics(reset.data.applications).applied, 62);
    await assert.rejects(store.update(reloaded.revision, change), Conflict);
    assert.equal(
      await readFile(join(dir, "other-app.json"), "utf8"),
      "untouched",
    );
    await writeFile(file, "corrupt");
    await assert.rejects(new FileStore(file).read(), SyntaxError);
    assert.equal(
      await readFile(file, "utf8"),
      "corrupt",
      "bad data must never silently reset",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("cloud storage rejects a competing write instead of reporting a save", async () => {
  const sql = async (parts) =>
    parts.join("").startsWith("SELECT")
      ? [{ revision: "v1", data: seedData() }]
      : [];
  await assert.rejects(
    new NeonStore(sql).update("v1", (data) => data),
    Conflict,
  );
});

test('cloud run rows initialize once and writes never address another run', async () => {
  const rows = new Map();
  const sql = async (parts, ...values) => {
    const query = parts.join('?');
    if (query.startsWith('SELECT')) return rows.has(values[0]) ? [rows.get(values[0])] : [];
    if (query.startsWith('INSERT')) {
      const [id,revision,data] = values;
      if (rows.has(id)) return [];
      const row = {revision,data:JSON.parse(data)}; rows.set(id,row); return [row];
    }
    const [data,revision,id,previous] = values;
    if (rows.get(id)?.revision !== previous) return [];
    const row = {revision,data:JSON.parse(data)}; rows.set(id,row); return [row];
  };
  const a = new NeonStore(sql,'a'.repeat(32)), b = new NeonStore(sql,'b'.repeat(32));
  const [one,two] = await Promise.all([a.read(),a.read()]); assert.equal(one.revision,two.revision);
  const other = await b.read();
  await a.update(one.revision,data=>({...data,marker:'only-a'}));
  assert.equal((await a.read()).data.marker,'only-a'); assert.deepEqual(await b.read(),other);
  assert.equal(rows.size,2); await assert.rejects(new NeonStore(sql).read(),/未初始化/);
});
