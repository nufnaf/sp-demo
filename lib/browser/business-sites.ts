/** Entry-point metadata only. Business records must be read through the UI. */
export function recruitingBrowserContext(): string {
  const configured = process.env.SYNTROPIC_RECRUITING_URL?.trim() || "http://127.0.0.1:30143";
  const url = new URL(configured);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("SYNTROPIC_RECRUITING_URL 必须是不含凭据的 HTTP/HTTPS 网页地址");
  }
  return [
    `已登记的业务网站：星流科技 NovaFlow 内部招聘系统（虚构演示数据），入口 ${url.href}。`,
    "用途：管理本公司的招聘职位、候选人、面试进展与评价。",
  ].join("\n");
}
