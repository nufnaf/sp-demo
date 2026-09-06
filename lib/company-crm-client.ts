import { EventEmitter } from "node:events";
import { execFile } from "node:child_process";
import { request } from "node:https";
import { lookup } from "node:dns";
import { BlockList, isIP } from "node:net";
import { parseCrmData, type CrmDataset } from "./crm";

const blocked = new BlockList();
const blockedV6 = new BlockList();
for (const [address, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 4], ["240.0.0.0", 4]] as const) blocked.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [["::", 128], ["::1", 128], ["::ffff:0:0", 96], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["2001:db8::", 32]] as const) blockedV6.addSubnet(address, prefix, "ipv6");
export function isPublicCrmAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? !blocked.check(address, "ipv4") : family === 6 && /^[23]/.test(address) && !blockedV6.check(address, "ipv6");
}
export function normalizeCompanyCrmUrl(value: string): string {
  const url = new URL(value.trim());
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash || url.pathname !== "/") throw new Error("请填写 HTTPS 网站首页地址，不含路径、端口或账号密码");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || (isIP(host) && !isPublicCrmAddress(host))) throw new Error("公司 CRM 必须使用公开 HTTPS 地址");
  return url.origin;
}
export interface RemoteCrmSnapshot { data: CrmDataset; meta: { sourceId: "company-crm"; sourceName: string; revision: number; updatedAt: string; syntheticData: boolean } }
export function parseRemoteCrmSnapshot(value: unknown): RemoteCrmSnapshot {
  const body = value as Partial<RemoteCrmSnapshot> | null;
  if (!body?.meta || body.meta.sourceId !== "company-crm" || !Number.isSafeInteger(body.meta.revision) || body.meta.revision < 1 || typeof body.meta.sourceName !== "string" || !body.meta.sourceName.trim() || body.meta.sourceName.length > 100 || typeof body.meta.updatedAt !== "string" || !Number.isFinite(Date.parse(body.meta.updatedAt)) || typeof body.meta.syntheticData !== "boolean") throw new Error("公司 CRM 返回的数据版本无效");
  if (!body.data || ![body.data.customers, body.data.orders, body.data.activities].every(Array.isArray)) throw new Error("公司 CRM 缺少客户、订单或跟进数据");
  return { data: parseCrmData(body.data), meta: body.meta };
}
/** DNS lookup is validated inside the connection, preventing rebinding between check and fetch. */
export async function requestCompanyCrmJson(baseUrl: string, pathname: string, token?: string): Promise<unknown> {
  const url = new URL(pathname, normalizeCompanyCrmUrl(baseUrl));
  const proxy = await configuredProxy();
  if (proxy) return requestViaConfiguredProxy(url, proxy, token);
  return new Promise((resolve, reject) => {
    const req = request(url, {
      method: "GET", headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(12_000),
      lookup(hostname, options, callback) {
        lookup(hostname, { ...options, all: true }, (error, addresses) => {
          if (error) { callback(error, []); return; }
          if (!addresses.length || addresses.some((item) => !isPublicCrmAddress(item.address))) { callback(new Error("公司 CRM 域名不能指向内部网络"), []); return; }
          if (options.all) callback(null, addresses);
          else callback(null, addresses[0].address, addresses[0].family);
        });
      },
    }, (response) => {
      const status = response.statusCode ?? 500;
      if (status !== 200) { response.resume(); reject(new Error(status === 401 || status === 403 ? "公司 CRM 授权失败，请检查访问令牌" : `公司 CRM 返回 HTTP ${status}`)); return; }
      const chunks: Buffer[] = []; let size = 0;
      response.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 2_000_000) { response.destroy(); reject(new Error("公司 CRM 数据超过 2 MB 上限")); } else chunks.push(chunk); });
      response.on("error", () => reject(new Error("公司 CRM 数据传输中断")));
      response.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch { reject(new Error("公司 CRM 返回了无效 JSON")); } });
    });
    req.on("error", (error) => reject(new Error(error.message.includes("内部网络") ? error.message : `无法连接公司 CRM（${(error as NodeJS.ErrnoException).code ?? "NETWORK_ERROR"}），请检查网址或网络后重试`)));
    req.end();
  });
}
export async function verifyCompanyCrm(baseUrl: string, token: string): Promise<RemoteCrmSnapshot> {
  const health = await requestCompanyCrmJson(baseUrl, "/api/v1/health") as { status?: string; sourceId?: string };
  if (health.status !== "ok" || health.sourceId !== "company-crm") throw new Error("目标网站不是兼容的公司 CRM");
  return parseRemoteCrmSnapshot(await requestCompanyCrmJson(baseUrl, "/api/v1/snapshot", token));
}


async function requestViaConfiguredProxy(url: URL, proxy: string, token?: string): Promise<unknown> {
  // The explicitly configured system proxy is trusted to resolve the public target.
  // Direct requests still validate and pin DNS inside the TLS connection above.
  const { lookup: resolveHost } = await import("node:dns/promises");
  const addresses = await resolveHost(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicCrmAddress(address))) throw new Error("公司 CRM 域名不能指向内部网络");
  const { fetch: proxyFetch, ProxyAgent } = await import("undici");
  const dispatcher = new ProxyAgent(proxy);
  EventEmitter.prototype.on.call(dispatcher, "error", () => {});
  try {
  const response = await proxyFetch(url, { dispatcher, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000), headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(response.status === 401 || response.status === 403 ? "公司 CRM 授权失败，请检查访问令牌" : `公司 CRM 返回 HTTP ${response.status}`);
  }
  if (!response.body) throw new Error("公司 CRM 返回了空响应");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2_000_000) { await reader.cancel(); throw new Error("公司 CRM 数据超过 2 MB 上限"); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally { reader.releaseLock(); }
  } finally { await dispatcher.close(); }
}


let proxyCache: { checkedAt: number; value?: string } | undefined;
async function configuredProxy(): Promise<string | undefined> {
  const envProxy = process.env.https_proxy || process.env.HTTPS_PROXY;
  if (envProxy) return envProxy;
  if (process.platform !== "darwin") return undefined;
  if (proxyCache && Date.now() - proxyCache.checkedAt < 60_000) return proxyCache.value;
  // Desktop-launched Node processes do not inherit shell proxy variables.
  // Honor the user's existing macOS HTTPS proxy without modifying system settings.
  const output = await new Promise<string>((resolve) => execFile("/usr/sbin/scutil", ["--proxy"], { timeout: 2000 }, (error, stdout) => resolve(error ? "" : stdout)));
  const enabled = /HTTPS(?:Enable)\s*:\s*1/.test(output);
  const host = output.match(/HTTPSProxy\s*:\s*(\S+)/)?.[1];
  const port = Number(output.match(/HTTPSPort\s*:\s*(\d+)/)?.[1]);
  const value = enabled && host && port > 0 && port < 65536 ? `http://${host.includes(":") ? `[${host}]` : host}:${port}` : undefined;
  proxyCache = { checkedAt: Date.now(), value };
  return value;
}
