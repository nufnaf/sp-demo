import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import lockfile from "proper-lockfile";
import { feishuHome } from "./feishu-paths";
import { getFeishuCliStatus } from "./feishu-cli";
import { userCommand, userRequest, FeishuUserError } from "./feishu-user-api";
import { RECRUITING_JD_DEMO } from "./recruiting-jd-fixture";
import { BUSINESS_SECTIONS } from "./feishu-business-template";
import { SYNTROPIC_CALENDAR_NAME } from "./feishu-demo-calendar-marker";

export interface FeishuWorkspace {
  version: 1;
  identity: string;
  nonce: string;
  account: string;
  consent: boolean;
  resources: Record<string, string>;
  pending?: string;
  ready: boolean;
}
export async function readJson<T>(file: string): Promise<T | undefined> {
  try { return JSON.parse(await readFile(file, "utf8")) as T; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw new Error("飞书连接记录无法读取，请检查本机存储。"); }
}
export async function saveJson(file: string, value: unknown): Promise<void> {
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(value), { mode: 0o600 });
  await rename(temp, file);
}
export async function readWorkspace(identity: string): Promise<FeishuWorkspace | undefined> {
  if (!/^[a-f0-9]{64}$/.test(identity)) throw new Error("飞书账号信息不完整，请重新连接。");
  const state = await readJson<FeishuWorkspace>(join(feishuHome(), `${identity}.json`));
  if (state && (state.version !== 1 || state.identity !== identity || !/^[a-f0-9-]{36}$/.test(state.nonce) || !state.resources || typeof state.resources !== "object" || Array.isArray(state.resources) || !Object.values(state.resources).every(v => typeof v === "string" && v.trim()) || typeof state.ready !== "boolean")) throw new Error("飞书资料记录不完整，已停止自动准备。");
  return state;
}
export const BUSINESS_TITLE = "星流科技业务介绍";
const escapeXml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const BUSINESS_CONTENT = BUSINESS_SECTIONS.map(([heading, paragraph]) => `<h1>${escapeXml(heading)}</h1><p>${escapeXml(paragraph)}</p>`).join("");
const LEGACY_CONTENT = `<title>${BUSINESS_TITLE}</title>` + RECRUITING_JD_DEMO.about.map(p => `<p>${escapeXml(p)}</p>`).join("");
type Command = (identity: string, args: string[]) => Promise<Record<string, unknown>>;
function field(data: Record<string, unknown>, group: string, key: string): string {
  const value = group ? (data[group] as Record<string, unknown> | undefined)?.[key] : data[key];
  if (typeof value !== "string" || !value.trim()) throw new FeishuUserError("飞书没有返回完整的资料标识，请重试核对创建结果。", true);
  return value;
}
/** Paginate only where preparation recovery needs it. Lists never reach UI/agents. */
async function files(command: Command, identity: string, folder: string) {
  const items: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let page = "";
  for (let n = 0; n < 100; n++) {
    const data = await command(identity, ["drive", "files", "list", "--params", JSON.stringify({ folder_token: folder, page_size: 200, ...(page ? { page_token: page } : {}) })]);
    if (data.files !== undefined && !Array.isArray(data.files)) break;
    items.push(...(data.files ?? []) as Record<string, unknown>[]);
    if (!data.has_more) return items;
    page = String(data.next_page_token ?? "");
    if (!page || seen.has(page)) break;
    seen.add(page);
  }
  throw new Error("资料列表尚未完整加载，请重试。");
}
function unique(items: Record<string, unknown>[], key: string): string | undefined {
  if (items.length > 1) throw new Error("发现重复的工作资料，已停止自动准备，请检查飞书中的工作资料文件夹。");
  return items.length ? field(items[0], "", key) : undefined;
}
const SYNTROPIC_CALENDAR_LEGACY_NAME = /^招聘日程 · [a-f0-9]{8}$/;
const SYNTROPIC_CALENDAR_LEGACY_DESCRIPTION = /^Syntropic [a-f0-9-]{36}$/;
function isOwnedSyntropicCalendar(value: Record<string, unknown>): boolean {
  return value.type === "shared" && value.role === "owner" && value.permissions === "private"
    && (value.summary === SYNTROPIC_CALENDAR_NAME && value.description === "Syntropic"
      || typeof value.summary === "string" && SYNTROPIC_CALENDAR_LEGACY_NAME.test(value.summary)
        && typeof value.description === "string" && SYNTROPIC_CALENDAR_LEGACY_DESCRIPTION.test(value.description));
}
async function calendars(command: Command, identity: string): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let page = "";
  for (let n = 0; n < 100; n++) {
    const data = await command(identity, ["calendar", "calendars", "list", "--params", JSON.stringify({ page_size: 100, ...(page ? { page_token: page } : {}) })]);
    if (!Array.isArray(data.calendar_list)) throw new Error("日历列表尚未完整加载，请重试。");
    items.push(...data.calendar_list as Record<string, unknown>[]);
    if (!data.has_more) return items;
    const next = String(data.page_token ?? "");
    if (!next || seen.has(next)) break;
    seen.add(next); page = next;
  }
  throw new Error("日历列表加载未完成，请重试。");
}

/** Durable step journal. A lost create response is reconciled, never replayed blindly. */
export async function prepareWorkspace(state: FeishuWorkspace, save: (state: FeishuWorkspace) => Promise<void>, command: Command = userCommand): Promise<FeishuWorkspace> {
  if (!state.consent) throw new Error("请先连接飞书并确认自动准备工作资料。");
  const r = state.resources;
  const stepNames: Record<string, string> = { folder: "创建工作资料文件夹", business: "准备业务介绍文档", weekly: "准备招聘进展文档", sheet: "准备招聘计划表格", base: "准备候选人招聘进度表", wikiSpace: "创建工作知识空间", wiki: "准备招聘与面试 FAQ", calendar: "准备工作日历" };
  const step = async (key: string, create: () => Promise<string>, recover: () => Promise<string | undefined>) => {
    if (r[key]) return;
    if (state.pending && state.pending !== key) throw new Error("上次资料准备尚未完成，请重试。");
    if (state.pending === key) {
      const found = await recover();
      if (!found) throw new Error("上次创建结果尚未确认，请稍后重试。为避免重复创建，应用已暂停准备。");
      r[key] = found;
    } else {
      state.pending = key;
      await save(state);
      try { r[key] = await create(); }
      catch (error) {
        if (error instanceof FeishuUserError && !error.uncertain) { delete state.pending; await save(state); }
        if (error instanceof FeishuUserError) throw new FeishuUserError(`${stepNames[key] ?? "准备工作资料"}失败：${error.message}`, error.uncertain, error.requiresAuthorization);
        if (error instanceof Error) throw new Error(`${stepNames[key] ?? "准备工作资料"}失败：${error.message}`);
        throw error;
      }
    }
    delete state.pending;
    await save(state);
  };
  const folderName = `Syntropic 工作资料 · ${state.nonce.slice(0, 8)}`;
  await step("folder", async () => field(await command(state.identity, ["drive", "files", "create_folder", "--data", JSON.stringify({ name: folderName, folder_token: "" })]), "", "token"), async () => unique((await files(command, state.identity, "")).filter(f => f.name === folderName && f.type === "folder"), "token"));
  const createDoc = (title: string, content?: string) => command(state.identity, ["docs", "+create", "--title", title, "--parent-token", r.folder, ...(content ? ["--content", content] : [])]).then(d => field(d, "document", "document_id"));
  const recoverDoc = (title: string, type = "docx") => files(command, state.identity, r.folder).then(items => unique(items.filter(f => f.name === title && f.type === type), "token"));
  await step("business", () => createDoc(BUSINESS_TITLE, BUSINESS_CONTENT), () => recoverDoc(BUSINESS_TITLE));
  // Validate the initial content before calling preparation complete, including
  // recovered compound creates. Never overwrite a user's later document edits.
  if (r.businessVerified !== "2") {
    const data = await command(state.identity, ["api", "GET", `/open-apis/docx/v1/documents/${encodeURIComponent(r.business)}/raw_content`]);
    const complete = (content: unknown) => typeof content === "string" && BUSINESS_SECTIONS.every(([heading, paragraph]) => content.includes(heading) && content.includes(paragraph));
    if (!complete(data.content)) {
      const legacyText = [BUSINESS_TITLE, ...RECRUITING_JD_DEMO.about].join("\n");
      if (typeof data.content === "string" && [legacyText, RECRUITING_JD_DEMO.about.join("\n")].includes(data.content.trim())) {
        // Read full structure and revision: identical plain text alone could hide
        // images or other user content. Only replace our untouched two paragraphs.
        const fetched = await command(state.identity, ["docs", "+fetch", "--doc", r.business, "--detail", "full"]);
        const doc = fetched.document as { content?: string; revision_id?: number } | undefined;
        const xml = doc?.content ?? "";
        const ids = [...xml.matchAll(/<p id="([A-Za-z0-9]+)">/g)].map(match => match[1]);
        if (xml.replace(/ id="[A-Za-z0-9]+"/g, "") === LEGACY_CONTENT && ids.length === 2 && Number.isInteger(doc?.revision_id)) {
          await command(state.identity, ["docs", "+update", "--doc", r.business, "--command", "block_replace", "--start-block-id", ids[0], "--end-block-id", ids[1], "--revision-id", String(doc!.revision_id), "--content", BUSINESS_CONTENT]);
          const verified = await command(state.identity, ["api", "GET", `/open-apis/docx/v1/documents/${encodeURIComponent(r.business)}/raw_content`]);
          if (!complete(verified.content)) throw new Error("业务介绍正文尚未补齐，请重试。");
        } else if (!r.businessVerified) throw new Error("业务介绍内容已变化，请检查文档后重试。");
      } else if (!r.businessVerified) throw new Error("业务介绍正文尚未准备完整，请检查飞书文档后重试。");
      // Existing edited documents belong to the user and are preserved.
    }
    r.businessVerified = "2"; await save(state);
  }
  await step("weekly", () => createDoc("本周招聘进展"), () => recoverDoc("本周招聘进展"));
  await step("sheet", async () => field(await command(state.identity, ["sheets", "spreadsheets", "create", "--data", JSON.stringify({ title: "Q3 招聘计划与编制", folder_token: r.folder })]), "spreadsheet", "spreadsheet_token"), () => recoverDoc("Q3 招聘计划与编制", "sheet"));
  await step("base", async () => {
    const data = await command(state.identity, ["api", "POST", "/open-apis/bitable/v1/apps", "--data", JSON.stringify({ name: "候选人招聘进度", folder_token: r.folder })]);
    return field(data, "app", "app_token");
  }, () => recoverDoc("候选人招聘进度", "bitable"));
  // Keep FAQ as a real Wiki node in a private, separately created space.
  await step("wikiSpace", async () => field(await command(state.identity, ["wiki", "spaces", "create", "--yes", "--data", JSON.stringify({ name: folderName, description: `Syntropic ${state.nonce}`, open_sharing: "closed" })]), "space", "space_id"), async () => {
    const items: Record<string, unknown>[] = []; let page = "";
    for (let n = 0; n < 100; n++) {
      const data = await command(state.identity, ["wiki", "spaces", "list", "--params", JSON.stringify({ page_size: 50, ...(page ? { page_token: page } : {}) })]);
      items.push(...(data.items ?? []) as Record<string, unknown>[]);
      if (!data.has_more) return unique(items.filter(i => i.name === folderName && i.description === `Syntropic ${state.nonce}`), "space_id");
      const next = String(data.page_token ?? ""); if (!next || next === page) break; page = next;
    }
    throw new Error("知识空间列表加载未完成，请重试。");
  });
  await step("wiki", async () => field(await command(state.identity, ["wiki", "nodes", "create", "--params", JSON.stringify({ space_id: r.wikiSpace }), "--data", JSON.stringify({ obj_type: "docx", node_type: "origin", title: "招聘与面试 FAQ" })]), "node", "node_token"), async () => {
    const data = await command(state.identity, ["wiki", "nodes", "list", "--params", JSON.stringify({ space_id: r.wikiSpace, page_size: 50 })]);
    if (data.has_more) throw new Error("工作知识空间已发生变化，请检查后重试。");
    return unique(((data.items ?? []) as Record<string, unknown>[]).filter(i => i.title === "招聘与面试 FAQ"), "node_token");
  });
  const name = SYNTROPIC_CALENDAR_NAME;
  // Migrate old nonce-based calendars and collapse duplicate fixed-name
  // calendars before resolving the current resource. Calendar creation remains
  // an API resource-preparation step; only meeting/event creation uses CUA.
  const listedCalendars = await calendars(command, state.identity);
  const fixed = listedCalendars.filter(calendar => calendar && calendar.summary === name && calendar.description === "Syntropic" && calendar.type === "shared" && calendar.role === "owner" && calendar.permissions === "private");
  const legacy = listedCalendars.filter(calendar => calendar && isOwnedSyntropicCalendar(calendar) && calendar.summary !== name);
  const stale = [...legacy, ...(fixed.length > 1 ? fixed : [])];
  for (const calendar of stale) {
    const id = field(calendar, "", "calendar_id");
    await command(state.identity, ["calendar", "calendars", "delete", "--calendar-id", id, "--yes"]);
    if (r.calendar === id) { delete r.calendar; delete r.calendarName; }
  }
  if (fixed.length > 1) { delete r.calendar; delete r.calendarName; }
  if (stale.length) await save(state);
  await step("calendar", async () => field(await command(state.identity, ["calendar", "calendars", "create", "--data", JSON.stringify({ summary: name, description: "Syntropic", permissions: "private" })]), "calendar", "calendar_id"), async () => unique((await calendars(command, state.identity)).filter(c => c.summary === name && c.description === "Syntropic" && c.type === "shared" && c.role === "owner"), "calendar_id"));
  if (r.calendar === "primary") throw new Error("工作日历无效，已停止准备。");
  r.calendarName = name;
  // Verify ownership and visibility every startup before allowing calendar reset.
  // calendar.get returns the calendar directly in data; calendar.create wraps it.
  const calendar = await command(state.identity, ["calendar", "calendars", "get", "--params", JSON.stringify({ calendar_id: r.calendar })]);
  if (calendar.calendar_id !== r.calendar || calendar.summary !== name || calendar.type !== "shared" || calendar.role !== "owner" || calendar.permissions !== "private" || calendar.description !== "Syntropic" || calendar.is_deleted) throw new Error("工作日历信息与准备记录不一致，请检查日历的所有者和可见范围后重试。");
  if (typeof calendar.summary === "string" && calendar.summary.trim()) r.calendarName = calendar.summary.trim();
  // Created calendars already appear in the user's calendar list. Re-subscribing
  // asks for an extra scope absent from CLI's all-domain set and is unnecessary.
  if (!(await calendars(command, state.identity)).some(c => c.calendar_id === r.calendar)) throw new Error("工作日历尚未显示在飞书日历列表中，请在飞书客户端添加该日历后重试。");
  const wiki = (await command(state.identity, ["wiki", "spaces", "get_node", "--params", JSON.stringify({ token: r.wiki })])).node as Record<string, unknown> | undefined;
  if (!wiki || wiki.node_token !== r.wiki || wiki.space_id !== r.wikiSpace) throw new Error("工作知识页面已被移动或删除，请在飞书中恢复后重试。");
  // A deleted document must not be silently replaced with a fresh copy.
  const visible = await files(command, state.identity, r.folder);
  if (![r.business, r.weekly, r.sheet, r.base].every(id => visible.some(f => f.token === id))) throw new Error("工作资料已被移动或删除，请在飞书中恢复后重试。");
  state.ready = true; await save(state); return state;
}

declare global { var __feishuPreparation: Promise<FeishuWorkspace> | undefined }
export async function ensurePersonalWorkspace(): Promise<FeishuWorkspace> {
  if (globalThis.__feishuPreparation) return globalThis.__feishuPreparation;
  const work = (async () => {
    const status = await getFeishuCliStatus();
    if (status.authState !== "authenticated" || !status.identity) throw new Error("请先连接自己的飞书账号。");
    await mkdir(feishuHome(), { recursive: true, mode: 0o700 });
    const release = await lockfile.lock(feishuHome(), { retries: 0 });
    try {
      const file = join(feishuHome(), `${status.identity}.json`);
      const existing = await readWorkspace(status.identity);
      const consent = await readJson<{ accepted: boolean }>(join(feishuHome(), "consent.json"));
      const state = existing ?? { version: 1, identity: status.identity, nonce: randomUUID(), account: status.account ?? "飞书用户", consent: consent?.accepted === true, resources: {}, ready: false } as FeishuWorkspace;
      return await prepareWorkspace(state, state => saveJson(file, state));
    } finally { await release(); }
  })();
  globalThis.__feishuPreparation = work;
  try { return await work; } finally { globalThis.__feishuPreparation = undefined; }
}

export async function currentWorkspace(): Promise<FeishuWorkspace> {
  const status = await getFeishuCliStatus(false);
  if (!status.identity) throw new Error("请先连接飞书账号。");
  const state = await readWorkspace(status.identity);
  if (!state?.ready || !["folder", "business", "weekly", "sheet", "base", "wiki", "wikiSpace", "calendar", "calendarName"].every(key => state.resources[key])) throw new Error("请先完成飞书资料准备。");
  const root = process.env.SYNTROPIC_PRESENTATION_ROOT;
  if (root) {
    const binding = await readJson<{ identity: string; ready: boolean }>(join(root, "feishu-account.json"));
    if (!binding?.ready || binding.identity !== state.identity) throw new Error("飞书账号已变化，请退出并重新打开 App。");
  }
  return state;
}
export { userRequest };
