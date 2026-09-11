import { EventEmitter } from "node:events";
import * as undici from "undici";
import { macOSProxyForUrl, readMacOSProxySettings, type MacOSProxySettings } from "./macos-proxy";
import { createSystemNetworkDispatcher } from "./system-network-dispatcher";

export const DEFAULT_HTTP_IDLE_TIMEOUT_MS = 300_000;

type DispatcherGlobal = typeof globalThis & {
  __piWebHttpDispatcherConfigured?: boolean;
};

const dispatcherGlobal = globalThis as DispatcherGlobal;
const originalGlobalFetch = globalThis.fetch;
const ignoreUndiciDispatcherError = (): void => {};

function parseHttpIdleTimeoutMs(value: unknown): number | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.toLowerCase() === "disabled") return 0;
    if (trimmed.length === 0) return undefined;
    return parseHttpIdleTimeoutMs(Number(trimmed));
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.floor(value);
}

// Undici can emit an internal Client error while terminating a response body.
// The body stream still rejects; this prevents the EventEmitter error from
// terminating the Next.js process first.
function withUndiciErrorListener<T extends undici.Dispatcher>(dispatcher: T): T {
  if (dispatcher instanceof EventEmitter) {
    EventEmitter.prototype.on.call(dispatcher, "error", ignoreUndiciDispatcherError);
  }
  return dispatcher;
}

function createUndiciClient(origin: string | URL, options: object): undici.Dispatcher {
  return withUndiciErrorListener(
    new undici.Client(origin, options as undici.Client.Options),
  );
}

function createUndiciOriginDispatcher(origin: string | URL, options: object): undici.Dispatcher {
  const dispatcherOptions = options as undici.Pool.Options;
  if (dispatcherOptions.connections === 1) {
    return createUndiciClient(origin, dispatcherOptions);
  }

  return withUndiciErrorListener(
    new undici.Pool(origin, {
      ...dispatcherOptions,
      factory: createUndiciClient,
    }),
  );
}

export function createHttpDispatcher(timeoutMs: number, systemProxy?: MacOSProxySettings): undici.Dispatcher {
  const normalizedTimeoutMs = parseHttpIdleTimeoutMs(timeoutMs);
  if (normalizedTimeoutMs === undefined) {
    throw new Error(`Invalid HTTP idle timeout: ${String(timeoutMs)}`);
  }

  const options = {
    allowH2: false,
    bodyTimeout: normalizedTimeoutMs,
    headersTimeout: normalizedTimeoutMs,
    clientFactory: createUndiciClient,
    factory: createUndiciOriginDispatcher,
  };
  // Explicit environment settings retain their original precedence and dynamic
  // NO_PROXY behavior. GUI-launched Apps commonly have none of these variables.
  const explicitProxy = ["http_proxy", "HTTP_PROXY", "https_proxy", "HTTPS_PROXY", "all_proxy", "ALL_PROXY"]
    .some(key => process.env[key] !== undefined);
  if (!explicitProxy && process.env.SYNTROPIC_NETWORK_SOCKET) {
    return withUndiciErrorListener(createSystemNetworkDispatcher(process.env.SYNTROPIC_NETWORK_SOCKET, normalizedTimeoutMs, createUndiciOriginDispatcher));
  }
  const allProxy = process.env.all_proxy ?? process.env.ALL_PROXY;
  if (allProxy) return withUndiciErrorListener(new undici.EnvHttpProxyAgent({
    ...options,
    httpProxy: process.env.http_proxy ?? process.env.HTTP_PROXY ?? allProxy,
    httpsProxy: process.env.https_proxy ?? process.env.HTTPS_PROXY ?? allProxy,
  }));
  if (!systemProxy || explicitProxy) return withUndiciErrorListener(new undici.EnvHttpProxyAgent(options));
  // Let EnvHttpProxyAgent keep ownership of environment NO_PROXY matching even
  // when the proxy endpoint itself comes from macOS. Its direct agent factory
  // is intentionally not used here: that would proxy bypassed requests again.
  return withUndiciErrorListener(new undici.Agent({
    ...options,
    factory(origin, poolOptions) {
      const proxy = macOSProxyForUrl(systemProxy, new URL(origin));
      if (!proxy) return createUndiciOriginDispatcher(origin, poolOptions);
      return withUndiciErrorListener(new undici.EnvHttpProxyAgent({
        ...options, httpProxy: proxy, httpsProxy: proxy,
      }));
    },
  }));
}

export function configureHttpDispatcher(
  timeoutMs: number = DEFAULT_HTTP_IDLE_TIMEOUT_MS,
): void {
  if (dispatcherGlobal.__piWebHttpDispatcherConfigured) return;
  const dispatcher = createHttpDispatcher(timeoutMs, process.env.SYNTROPIC_NETWORK_SOCKET ? undefined : readMacOSProxySettings());
  undici.setGlobalDispatcher(dispatcher);

  // Keep fetch and the dispatcher on the same undici implementation. Preserve
  // an intentional fetch override installed after this module was loaded.
  if (globalThis.fetch === originalGlobalFetch) {
    undici.install?.();
  }

  dispatcherGlobal.__piWebHttpDispatcherConfigured = true;
}
