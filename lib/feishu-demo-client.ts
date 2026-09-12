import { currentWorkspace, userRequest, type FeishuWorkspace } from "./feishu-workspace";
import type { CalendarRequest } from "./feishu-calendar";
import { FeishuCalendarClient } from "./feishu-calendar";

interface Config { identity: string; folderToken: string; documentIds: string[]; resourceIds?: string[]; wikiNodeIds?: string[]; calendarId?: string; calendarName?: string }
export class FeishuDemoError extends Error {
  constructor(public kind: "configuration" | "authorization" | "network", message: string) { super(message); }
}
export interface DemoDocument { id: string; title: string; type: "docx" | "sheet" | "bitable" | "wiki"; readable: boolean; url?: string; modifiedAt?: string; source: "feishu-demo" }
function resourceUrl(value?: string): string | undefined {
  try {
    const url = new URL(value ?? "");
    if (url.protocol === "https:" && !url.username && !url.password && ["feishu.cn", "larksuite.com"].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) return url.href;
  } catch { /* Only validated Feishu links may leave the application. */ }
}
export class FeishuDemoClient {
  constructor(private config: Config, private request: CalendarRequest = userRequest(config.identity), private clock = Date.now) {}
  private async get(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
    return this.request(path, init);
  }
  calendar(): FeishuCalendarClient {
    const id = this.config.calendarId;
    if (typeof id !== "string" || !id.trim() || id.trim() === "primary") throw new FeishuDemoError("configuration", "团队日历尚未配置，请联系管理员设置日历并完成授权。");
    const name = this.config.calendarName;
    if (name !== undefined && (typeof name !== "string" || !name.trim() || name.length > 200 || /[\r\n]/.test(name))) throw new FeishuDemoError("configuration", "日历名称配置无效，请核对飞书客户端中的日历名称。");
    return new FeishuCalendarClient(id.trim(), `${this.config.identity}:${id.trim()}`, (path, init) => this.get(path, init), [], name?.trim());
  }
  private async folderDocuments(query = ""): Promise<DemoDocument[]> {
    const items: DemoDocument[] = [];
    const visibleIds = new Set([...this.config.documentIds, ...(this.config.resourceIds ?? [])]);
    let pageToken = "";
    let complete = false;
    for (let page = 0; page < 20; page++) {
      const params = new URLSearchParams({ folder_token: this.config.folderToken, page_size: "200" });
      if (pageToken) params.set("page_token", pageToken);
      const data = await this.get(`/drive/v1/files?${params}`);
      const files = Array.isArray(data.files) ? data.files as Array<{ token: string; name: string; type: string; url?: string; modified_time?: string }> : [];
      for (const file of files) {
        if ((file.type === "docx" || file.type === "sheet" || file.type === "bitable") && visibleIds.has(file.token) && file.name.includes(query)) items.push({ id: file.token, title: file.name, type: file.type, readable: file.type === "docx" && this.config.documentIds.includes(file.token), url: resourceUrl(file.url), modifiedAt: file.modified_time ? new Date(Number(file.modified_time) * 1000).toISOString() : undefined, source: "feishu-demo" });
      }
      if (!data.has_more) { complete = true; break; }
      pageToken = String(data.next_page_token ?? "");
      if (!pageToken) break;
    }
    if (!complete) throw new FeishuDemoError("configuration", "文档列表加载未完成，请稍后重试或联系管理员。");
    return items;
  }
  async documents(query = ""): Promise<DemoDocument[]> {
    const folderItems = await this.folderDocuments();
    const items = folderItems.filter(item => item.title.includes(query));
    const origin = new URL(folderItems.find(item => item.url)?.url ?? "https://www.feishu.cn").origin;
    // Wiki nodes live outside Drive folders. Only explicitly configured nodes
    // are resolved, with live permissions and titles checked on every request.
    for (const id of this.config.wikiNodeIds ?? []) {
      const data = await this.get(`/wiki/v2/spaces/get_node?token=${encodeURIComponent(id)}`);
      const node = data.node as { node_token?: string; title?: string; obj_edit_time?: string } | undefined;
      if (!node?.title || node.node_token !== id) throw new FeishuDemoError("authorization", "知识库页面不存在或已停止共享。");
      if (node.title.includes(query)) items.push({ id, title: node.title, type: "wiki", readable: false, url: `${origin}/wiki/${encodeURIComponent(id)}`, modifiedAt: node.obj_edit_time ? new Date(Number(node.obj_edit_time) * 1000).toISOString() : undefined, source: "feishu-demo" });
    }
    return items;
  }
  async read(id: string) {
    if (!this.config.documentIds.includes(id)) throw new FeishuDemoError("authorization", "当前工作台无权访问此文档。");
    const document = (await this.folderDocuments()).find((item) => item.id === id);
    if (!document) throw new FeishuDemoError("authorization", "文档不存在或已停止共享。");
    return this.readDocument(document);
  }
  async findAndRead(title: string) {
    const exactTitle = title.trim();
    if (!exactTitle) throw new FeishuDemoError("configuration", "请提供完整的飞书文档标题。");
    // Resolve against a fresh, fully paginated allow-listed folder response.
    // Reuse that result rather than fetching the same list again in read(id).
    const matches = (await this.folderDocuments(exactTitle)).filter(item => item.title === exactTitle && item.readable);
    if (!matches.length) throw new FeishuDemoError("authorization", "未找到标题完全匹配且已授权的文档，请确认文档标题或联系管理员检查共享权限。");
    if (matches.length !== 1) throw new FeishuDemoError("configuration", "发现多份同名资料，尚未读取正文。请联系资料管理员区分文档标题后重试。");
    return this.readDocument(matches[0]);
  }
  private async readDocument(document: DemoDocument) {
    if (!document.readable) throw new FeishuDemoError("authorization", "该资料请在飞书中打开，当前应用仅支持读取业务介绍正文。");
    // Feishu independently checks live document permissions on this request.
    const data = await this.get(`/docx/v1/documents/${encodeURIComponent(document.id)}/raw_content`);
    if (typeof data.content !== "string" || !data.content.trim()) throw new FeishuDemoError("authorization", "文档正文为空，请联系文档管理员。");
    return { ...document, content: data.content, fetchedAt: new Date(this.clock()).toISOString() };
  }
}
export function workspaceClient(state: FeishuWorkspace): FeishuDemoClient {
  const r = state.resources;
  return new FeishuDemoClient({ identity: state.identity, folderToken: r.folder, documentIds: [r.business], resourceIds: [r.weekly, r.sheet, r.base], wikiNodeIds: [r.wiki], calendarId: r.calendar, calendarName: r.calendarName }, userRequest(state.identity));
}
export async function getFeishuDemoClient(): Promise<FeishuDemoClient> {
  return workspaceClient(await currentWorkspace());
}
