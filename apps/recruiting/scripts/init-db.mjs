import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import { seedData } from "../src/seed.mjs";

if (!process.env.DATABASE_URL)
  throw new Error("请在环境中设置独立演示数据库的 DATABASE_URL");
const sql = neon(process.env.DATABASE_URL);
await sql`CREATE TABLE IF NOT EXISTS recruiting_demo_state (id text PRIMARY KEY, revision text NOT NULL, data jsonb NOT NULL)`;
await sql`INSERT INTO recruiting_demo_state (id, revision, data) VALUES ('demo', ${randomUUID()}, ${JSON.stringify(seedData())}::jsonb) ON CONFLICT (id) DO NOTHING`;
console.log("招聘 Demo 数据库已就绪；已有数据保持不变。");
