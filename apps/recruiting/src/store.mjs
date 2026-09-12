import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { seedData } from "./seed.mjs";

export class Conflict extends Error {}
const initial = (seed = seedData) => ({ revision: randomUUID(), data: seed() });

export class FileStore {
  tail = Promise.resolve();
  constructor(file, seed = seedData) {
    this.file = file;
    this.seed = seed;
  }
  async read() {
    try {
      const state = JSON.parse(await readFile(this.file, "utf8"));
      if (state.data?.schemaVersion !== 1 || !state.revision)
        throw new Error("招聘数据格式不兼容；请先备份数据并检查版本");
      return state;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const state = initial(this.seed);
      await mkdir(dirname(this.file), { recursive: true });
      try {
        await writeFile(this.file, JSON.stringify(state), {
          flag: "wx",
          mode: 0o600,
        });
      } catch (error) {
        if (error.code === "EEXIST") return this.read();
        throw error;
      }
      return state;
    }
  }
  update(revision, change) {
    const operation = this.tail.then(async () => {
      const previous = await this.read();
      if (previous.revision !== revision)
        throw new Conflict(
          "数据已被另一页面修改。请刷新后核对，再保存；本次未覆盖其他修改。",
        );
      const next = { revision: randomUUID(), data: change(previous.data) };
      const temporary = `${this.file}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(next), { mode: 0o600 });
      await rename(temporary, this.file);
      return next;
    });
    this.tail = operation.catch(() => {});
    return operation;
  }
}

export class NeonStore {
  constructor(sql, scope) {
    this.sql = sql;
    this.id = scope ? `run:${scope}` : "demo";
    this.scoped = Boolean(scope);
  }
  async read() {
    const rows = await this
      .sql`SELECT revision, data FROM recruiting_demo_state WHERE id = ${this.id}`;
    if (!rows.length && this.scoped) {
      const state = initial(() => seedData(true));
      const created = await this.sql`INSERT INTO recruiting_demo_state (id, revision, data) VALUES (${this.id}, ${state.revision}, ${JSON.stringify(state.data)}::jsonb) ON CONFLICT (id) DO NOTHING RETURNING revision, data`;
      return created[0] ?? this.read();
    }
    if (!rows.length) throw new Error("云端招聘数据未初始化，请运行 npm run db:init");
    return rows[0];
  }
  async update(revision, change) {
    const previous = await this.read();
    if (previous.revision !== revision)
      throw new Conflict("数据已更新，请刷新后再保存。");
    const data = change(previous.data);
    const nextRevision = randomUUID();
    const rows = await this
      .sql`UPDATE recruiting_demo_state SET data = ${JSON.stringify(data)}::jsonb, revision = ${nextRevision} WHERE id = ${this.id} AND revision = ${revision} RETURNING revision, data`;
    if (!rows.length) throw new Conflict("数据已更新，请刷新后再保存。");
    return rows[0];
  }
}

const stores = new Map();
export function getStore(scope) {
  if (scope !== undefined && !/^[a-f0-9]{32}$/.test(scope)) throw new Error("Invalid demo scope");
  const key = scope ?? "demo";
  if (!stores.has(key)) stores.set(key, (async () => {
    if (process.env.DATABASE_URL) {
      const { neon } = await import("@neondatabase/serverless");
      return new NeonStore(neon(process.env.DATABASE_URL), scope);
    }
    if (process.env.VERCEL) throw new Error("云端持久化未配置：请设置 DATABASE_URL 并初始化招聘数据库。不会回退到临时文件。");
    const file = process.env.RECRUITING_DATA_FILE || resolve(dirname(fileURLToPath(import.meta.url)), "../.data/state.json");
    return new FileStore(scope ? resolve(dirname(file), "runs", `${scope}.json`) : file, scope ? () => seedData(true) : seedData);
  })());
  return stores.get(key);
}
