import { readFile } from "node:fs/promises";
import { getStore, Conflict } from "./store.mjs";
import { seedData } from "./seed.mjs";
import { mutate, ValidationError } from "./domain.mjs";
import {
  layout,
  escape,
  jobsPage,
  jobPage,
  candidatePage,
  candidatesPage,
  settingsPage,
  publishJobPage,
} from "./views.mjs";

export function createHandler(storeProvider = getStore) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",
    );
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
    try {
      if (url.pathname === "/style.css" && req.method === "GET") {
        res.setHeader("Content-Type", "text/css; charset=utf-8");
        return res.end(
          await readFile(new URL("../public/style.css", import.meta.url)),
        );
      }
      if (url.pathname === "/favicon.ico") {
        res.statusCode = 204;
        return res.end();
      }
      const store = await storeProvider();
      if (req.method === "POST") {
        // Plain HTML forms. Reject cross-origin submissions, including local
        // websites trying to reset this demo from another browser tab.
        const origin = req.headers.origin;
        const expectedOrigin = process.env.PUBLIC_ORIGIN || url.origin;
        if (!origin || origin !== expectedOrigin) {
          res.statusCode = 403;
          return res.end("不允许跨站表单提交");
        }
        if (
          !String(req.headers["content-type"]).startsWith(
            "application/x-www-form-urlencoded",
          )
        ) {
          res.statusCode = 415;
          return res.end("请通过网页表单保存");
        }
        let body = "";
        // Vercel may already have parsed the incoming form.
        if (
          req.body &&
          typeof req.body === "object" &&
          !Buffer.isBuffer(req.body)
        )
          body = new URLSearchParams(req.body).toString();
        else if (typeof req.body === "string") body = req.body;
        else
          for await (const chunk of req) {
            body += chunk;
            if (body.length > 200000) throw new ValidationError("提交内容过长");
          }
        if (body.length > 200000) throw new ValidationError("提交内容过长");
        const fields = Object.fromEntries(new URLSearchParams(body));
        let destination;
        if (url.pathname === "/reset") {
          if (fields.confirm !== "reset")
            throw new ValidationError("请先确认重置范围");
          await store.update(fields.revision, () => seedData());
          destination = "/settings?reset=1";
        } else if (url.pathname === "/jobs/publish") {
          const next = await store.update(fields.revision, (data) => mutate(data, url.pathname, fields));
          const job = next.data.jobs.find((item) => item.draft === fields.draft);
          destination = `/jobs/${job.id}?published=1`;
        } else {
          if (
            !/^\/(jobs\/[^/]+\/save|candidates\/[^/]+\/(decision|review\/[^/]+))$/.test(
              url.pathname,
            )
          ) {
            res.statusCode = 404;
            return res.end("操作不存在");
          }
          await store.update(fields.revision, (data) =>
            mutate(data, url.pathname, fields),
          );
          destination = `${url.pathname.split("/").slice(0, 3).join("/")}?saved=1`;
        }
        res.writeHead(303, { Location: destination });
        return res.end();
      }
      if (req.method !== "GET") {
        res.statusCode = 405;
        return res.end("不支持的请求");
      }
      const state = await store.read();
      // Read-only projection for Syntropic's result window. Publication still
      // goes exclusively through the visible HTML form above.
      if (url.pathname === "/desktop/published-jobs") {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.end(JSON.stringify({ app: "syntropic-recruiting", jobs: state.data.jobs.filter((job) => job.draft && job.publishedAt).map((job) => ({
          id: job.id, draft: job.draft, title: job.title, location: job.location,
          department: job.department, headcount: job.target, owner: job.owner,
          publishedAt: job.publishedAt, candidateCount: state.data.applications.filter((a) => a.jobId === job.id).length,
        })) }));
      }
      const path = url.pathname.split("/").filter(Boolean);
      let page;
      if (!path.length) page = jobsPage(state, url.searchParams);
      else if (url.pathname === "/jobs/new") page = publishJobPage(state, url.searchParams);
      else if (path[0] === "jobs" && path.length === 2)
        page = jobPage(state, path[1], url.searchParams);
      else if (path[0] === "candidates" && path.length === 2)
        page = candidatePage(state, path[1], url.searchParams);
      else if (path.length === 1 && ["candidates", "reviews"].includes(path[0]))
        page = candidatesPage(state, url.searchParams, path[0] === "reviews");
      else if (url.pathname === "/settings")
        page = settingsPage(state, url.searchParams);
      if (!page) {
        res.statusCode = 404;
        page = layout(
          "页面不存在",
          '<h1>没有找到这条记录</h1><a href="/">返回招聘职位</a>',
        );
      }
      res.end(page);
    } catch (error) {
      res.statusCode =
        error instanceof Conflict ? 409 : error instanceof ValidationError ? 400 : 503;
      // Infrastructure errors may contain connection strings. Never render raw
      // storage/driver diagnostics, while preserving safe business validation.
      const safe =
        error instanceof Conflict || error instanceof ValidationError;
      const message = safe
        ? error.message
        : "招聘数据暂时无法加载，请稍后重试或联系系统管理员。";
      const back = url.pathname === "/jobs/publish" ? "/jobs/new"
        : /^\/(jobs|candidates)\/[^/]+/.exec(url.pathname)?.[0] || "/settings";
      res.end(
        layout(
          "操作未完成",
          `<section class="panel"><h1>操作未完成</h1><p role="alert">${escape(message)}</p><a class="button" href="${escape(back)}">返回并读取最新数据</a></section>`,
        ),
      );
    }
  };
}
export const handler = createHandler();
