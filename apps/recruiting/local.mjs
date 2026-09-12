import { createServer } from "node:http";
import { handler } from "./src/handler.mjs";

import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getStore } from "./src/store.mjs";
const checkoutId = createHash("sha256").update(realpathSync(dirname(fileURLToPath(import.meta.url)))).digest("hex");
const port = Number(process.env.PORT || 30143);
const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/api/desktop/health") {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json");
    try {
      await (await getStore()).read();
      res.end(JSON.stringify({ app: "syntropic-recruiting", checkoutId }));
    } catch {
      res.statusCode = 503;
      res.end(JSON.stringify({ error: "招聘数据无法加载" }));
    }
    return;
  }
  await handler(req, res);
});
server.listen(port, "127.0.0.1", () =>
  console.log(`NovaFlow 内部招聘 Demo：http://127.0.0.1:${port}`),
);
server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `端口 ${port} 已被占用，请复用已运行的招聘服务。`
      : "招聘服务启动失败",
  );
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close());
