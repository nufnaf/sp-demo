import { readFile } from "node:fs/promises";

interface Config { appId: string; appSecret: string; folderToken: string; documentIds: string[] }
interface Envelope { code?: number; msg?: string; expire?: number; tenant_access_token?: string; data?: Record<string, unknown> }
export class FeishuDemoError extends Error {
  constructor(public kind: "configuration" | "authorization" | "network", message: string) { super(message); }
}
export interface DemoDocument { id: string; title: string; type: "docx"; url?: string; modifiedAt?: string; source: "feishu-demo" }
const ORIGIN = "https://open.feishu.cn/open-apis";
const INVALID_TOKEN = new Set([99991661, 99991663, 99991664, 99991668]);

export class FeishuDemoClient {
  private token?: { value: string; renewAt: number };
  private acquiring?: Promise<string>;
  constructor(private config: Config, private request: typeof fetch = fetch, private clock = Date.now) {}
  private async json(path: string, init?: RequestInit): Promise<Envelope> {
    let response: Response;
    try { response = await this.request(`${ORIGIN}${path}`, { ...init, redirect: "error", signal: AbortSignal.timeout(15000) }); }
    catch { throw new FeishuDemoError("network", "无法连接飞书，请检查网络后重试。"); }
    try {
      const body = await response.json() as Envelope;
      if (!response.ok && body.code === undefined) throw new Error();
      return body;
    } catch { throw new FeishuDemoError("network", "飞书返回异常响应，请稍后重试。"); }
  }
  private async accessToken(): Promise<string> {
    if (this.token && this.clock() < this.token.renewAt) return this.token.value;
    if (this.acquiring) return this.acquiring;
    this.acquiring = (async () => {
      const body = await this.json("/auth/v3/tenant_access_token/internal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ app_id: this.config.appId, app_secret: this.config.appSecret }) });
      if (body.code !== 0 || !body.tenant_access_token || !body.expire || body.expire <= 0) throw new FeishuDemoError("configuration", "专用飞书应用凭据无效，请由配置管理员检查 App ID、App Secret 和应用发布状态。");
      this.token = { value: body.tenant_access_token, renewAt: this.clock() + Math.max(1, body.expire - Math.min(120, body.expire / 5)) * 1000 };
      return this.token.value;
    })().finally(() => { this.acquiring = undefined; });
    return this.acquiring;
  }
  private async get(path: string): Promise<Record<string, unknown>> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await this.accessToken();
      const body = await this.json(path, { headers: { Authorization: `Bearer ${token}` } });
      if (body.code === 0) return body.data ?? {};
      if (INVALID_TOKEN.has(body.code ?? -1) && attempt === 0) {
        if (this.token?.value === token) this.token = undefined;
        continue;
      }
      // Never propagate upstream messages which could echo credential material.
      throw new FeishuDemoError("authorization", "专用飞书应用无法读取演示资料。请管理员检查只读接口权限、应用发布状态和目标文件夹／文档的阅读授权。");
    }
    throw new FeishuDemoError("authorization", "飞书凭证刷新后仍不可用，请管理员检查应用配置。");
  }
  async documents(query = ""): Promise<DemoDocument[]> {
    const items: DemoDocument[] = [];
    let pageToken = "";
    for (let page = 0; page < 20; page++) {
      const params = new URLSearchParams({ folder_token: this.config.folderToken, page_size: "200" });
      if (pageToken) params.set("page_token", pageToken);
      const data = await this.get(`/drive/v1/files?${params}`);
      const files = Array.isArray(data.files) ? data.files as Array<{ token: string; name: string; type: string; url?: string; modified_time?: string }> : [];
      for (const file of files) {
        if (file.type === "docx" && this.config.documentIds.includes(file.token) && file.name.includes(query)) items.push({ id: file.token, title: file.name, type: "docx", url: file.url, modifiedAt: file.modified_time ? new Date(Number(file.modified_time) * 1000).toISOString() : undefined, source: "feishu-demo" });
      }
      if (!data.has_more) return items;
      pageToken = String(data.next_page_token ?? "");
      if (!pageToken) break;
    }
    throw new FeishuDemoError("configuration", "演示文件夹文件过多或分页异常，请管理员使用专用小型资料文件夹。");
  }
  async read(id: string) {
    if (!this.config.documentIds.includes(id)) throw new FeishuDemoError("authorization", "此文档不在专用演示资料范围内。");
    const document = (await this.documents()).find((item) => item.id === id);
    if (!document) throw new FeishuDemoError("authorization", "未在已授权的演示文件夹中找到此文档。");
    const data = await this.get(`/docx/v1/documents/${encodeURIComponent(id)}/raw_content`);
    if (typeof data.content !== "string" || !data.content.trim()) throw new FeishuDemoError("authorization", "飞书文档正文为空，请管理员检查演示文档。");
    return { ...document, content: data.content, fetchedAt: new Date(this.clock()).toISOString() };
  }
}
let client: FeishuDemoClient | undefined;
export async function getFeishuDemoClient(): Promise<FeishuDemoClient> {
  if (client) return client;
  let config: Config;
  try {
    config = JSON.parse(await readFile(process.env.SYNTROPIC_FEISHU_CONFIG || ".env.feishu-demo.json", "utf8")) as Config;
    if (![config.appId, config.appSecret, config.folderToken].every((value) => typeof value === "string" && value.trim()) || !Array.isArray(config.documentIds) || !config.documentIds.length || !config.documentIds.every((id) => typeof id === "string" && /^[a-zA-Z0-9]+$/.test(id))) throw new Error();
  } catch { throw new FeishuDemoError("configuration", "请管理员先配置专用飞书演示应用与文档授权。演示者无需安装 CLI 或登录飞书。"); }
  client = new FeishuDemoClient(config);
  return client;
}
