import * as undici from "undici";
import { isIP } from "node:net";

const BRIDGE_ORIGIN = "http://syntropic-system-network.invalid";

export function bypassSystemProxy(url: URL): boolean {
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host === "::1" || (isIP(host) === 4 && host.startsWith("127."))) return true;
  const noProxy = process.env.no_proxy ?? process.env.NO_PROXY ?? "";
  return noProxy.split(/[\s,]+/).filter(Boolean).some(rule => {
    if (rule === "*") return true;
    const match = /^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/.exec(rule.toLowerCase());
    if (!match && rule.includes(":")) return host === rule.toLowerCase();
    if (!match) return false;
    const name = match[1].replace(/^\[|\]$/g, "").replace(/^\*?\./, "");
    if (match[2] && match[2] !== (url.port || (url.protocol === "https:" ? "443" : "80"))) return false;
    return host === name || host.endsWith(`.${name}`);
  });
}

/** One Agent owns both direct pools and the private Chromium transport. Routing
 * happens per request, so NO_PROXY changes and per-URL PAC rules stay effective. */
export function createSystemNetworkDispatcher(socketPath: string, timeoutMs: number, poolFactory?: (origin: string | URL, options: object) => undici.Dispatcher): undici.Dispatcher {
  const agent = new undici.Agent({
    allowH2: false, headersTimeout: timeoutMs, bodyTimeout: timeoutMs,
    factory(origin, options) {
      const poolOptions = {
        ...options,
        ...(String(origin) === BRIDGE_ORIGIN ? { connect: { socketPath }, pipelining: 1 } : {}),
      };
      return poolFactory ? poolFactory(origin, poolOptions) : new undici.Pool(origin, poolOptions);
    },
  });
  return agent.compose(dispatch => (options, handler) => {
    const url = new URL(options.path, options.origin);
    if (bypassSystemProxy(url)) return dispatch(options, handler);
    return dispatch({ ...options, origin: BRIDGE_ORIGIN, path: `/request?url=${encodeURIComponent(url.href)}` }, handler);
  });
}
