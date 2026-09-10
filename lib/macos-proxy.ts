import { execFileSync } from "node:child_process";
import { BlockList, isIP } from "node:net";

export interface MacOSProxySettings {
  http?: string;
  https?: string;
  socks?: string;
  exceptions: string[];
  excludeSimpleHostnames: boolean;
}

/** Read the top-level effective settings, not per-interface __SCOPED__ entries. */
export function parseMacOSProxySettings(output: string): MacOSProxySettings | undefined {
  const fields: Record<string, string> = {};
  const exceptions: string[] = [];
  let depth = 0;
  let inExceptions = false;
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.endsWith("{")) {
      if (depth === 1) inExceptions = line.startsWith("ExceptionsList :");
      depth++;
    } else if (line === "}") {
      if (depth === 2) inExceptions = false;
      depth--;
    } else {
      const pair = /^([^:]+?)\s*:\s*(.*)$/.exec(line);
      if (!pair) continue;
      if (depth === 1) fields[pair[1].trim()] = pair[2];
      if (depth === 2 && inExceptions) exceptions.push(pair[2]);
    }
  }
  // PAC requires a browser's per-URL resolver; do not misinterpret it as a
  // static proxy or silently use inactive manual settings beneath it.
  if (fields.ProxyAutoConfigEnable === "1" || fields.ProxyAutoDiscoveryEnable === "1") return undefined;
  const endpoint = (kind: string, scheme: string) => {
    const host = fields[`${kind}Proxy`];
    const port = Number(fields[`${kind}Port`]);
    if (fields[`${kind}Enable`] !== "1" || !host || !Number.isInteger(port) || port < 1 || port > 65535) return undefined;
    if (/[\s/@?#]/.test(host)) return undefined;
    try {
      return new URL(`${scheme}://${host.includes(":") && !host.startsWith("[") ? `[${host}]` : host}:${port}`).href;
    } catch { return undefined; }
  };
  const settings = {
    http: endpoint("HTTP", "http"), https: endpoint("HTTPS", "http"), socks: endpoint("SOCKS", "socks5"),
    exceptions, excludeSimpleHostnames: fields.ExcludeSimpleHostnames === "1",
  };
  return settings.http || settings.https || settings.socks ? settings : undefined;
}

export function readMacOSProxySettings(): MacOSProxySettings | undefined {
  if (process.platform !== "darwin") return undefined;
  try {
    return parseMacOSProxySettings(execFileSync("/usr/sbin/scutil", ["--proxy"], {
      encoding: "utf8", timeout: 2_000, maxBuffer: 256_000, stdio: ["ignore", "pipe", "ignore"],
    }));
  } catch { return undefined; }
}

function matchesException(host: string, pattern: string): boolean {
  const slash = pattern.lastIndexOf("/");
  if (slash > 0) {
    const address = pattern.slice(0, slash);
    const family = isIP(address);
    const prefix = Number(pattern.slice(slash + 1));
    if (!family || !Number.isInteger(prefix) || prefix < 0 || prefix > (family === 4 ? 32 : 128) || isIP(host) !== family) return false;
    const list = new BlockList();
    list.addSubnet(address, prefix, family === 4 ? "ipv4" : "ipv6");
    return list.check(host, family === 4 ? "ipv4" : "ipv6");
  }
  const escaped = pattern.toLowerCase().replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(host);
}

export function macOSProxyForUrl(settings: MacOSProxySettings, url: URL): string | undefined {
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  // App control traffic and local browser debugging must stay on this machine.
  if (host === "localhost" || host.endsWith(".localhost") || host === "::1" || (isIP(host) === 4 && host.startsWith("127."))) return undefined;
  if (settings.excludeSimpleHostnames && !isIP(host) && !host.includes(".")) return undefined;
  if (settings.exceptions.some(pattern => matchesException(host, pattern))) return undefined;
  return (url.protocol === "https:" ? settings.https : settings.http) ?? settings.socks;
}
