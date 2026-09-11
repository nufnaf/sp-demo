import { createServer } from 'node:http';
import { mkdtemp, chmod, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const hopHeaders = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'host']);

function nativeFetch(request, url, options) {
  return new Promise((resolve, reject) => {
    const client = request({ url, method: options.method, headers: Object.fromEntries(options.headers),
      redirect: 'manual', useSessionCookies: false, cache: 'no-store' });
    const abort = () => { client.abort(); reject(options.signal.reason ?? new Error('Request aborted')); };
    options.signal.addEventListener('abort', abort, { once: true });
    client.on('close', () => options.signal.removeEventListener('abort', abort));
    client.on('error', reject);
    // A credential challenge must settle, not leave a background request stuck.
    // Explicit authenticated proxies continue through the existing env path.
    client.on('login', (_info, callback) => callback());
    const responseHeaders = values => {
      const headers = new Headers();
      for (const [name, value] of Object.entries(values)) for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
      return headers;
    };
    // net.fetch rejects manual redirects. Return the original redirect to
    // Undici so its fetch caller owns redirect policy and credential stripping.
    client.on('redirect', (status, _method, _url, headers) => {
      resolve(new Response(null, { status, headers: responseHeaders(headers) }));
    });
    client.on('response', response => {
      let ended = false;
      const stream = new ReadableStream({
        start(controller) {
          const fail = error => { if (!ended) { ended = true; controller.error(error); } };
          response.on('end', () => { if (!ended) { ended = true; controller.close(); } });
          response.on('error', fail);
          response.on('aborted', () => fail(new Error('Response aborted')));
          response.on('data', chunk => {
            if (ended) return;
            // Electron exposes data events rather than pause/resume. Bound only
            // unread buffered data, not the total response or stream length.
            if (controller.desiredSize < -16 * 1024 * 1024) {
              fail(new Error('Network response consumer is too slow')); client.abort();
            } else controller.enqueue(new Uint8Array(chunk));
          });
        },
        cancel() { ended = true; client.abort(); },
      }, { highWaterMark: 65536, size: chunk => chunk.byteLength });
      const noBody = options.method === 'HEAD' || [204, 205, 304].includes(response.statusCode);
      resolve(new Response(noBody ? null : stream, { status: response.statusCode, headers: responseHeaders(response.headers) }));
    });
    if (options.signal.aborted) { abort(); return; }
    if (options.body) {
      // Chromium cannot start a chunked upload with no chunks. Enable streaming
      // only when bytes arrive, including when the caller supplies an empty stream.
      let started = false;
      const upload = new Transform({ transform(chunk, _encoding, callback) {
        if (chunk.length && !started) { client.chunkedEncoding = true; started = true; }
        callback(null, chunk);
      } });
      void pipeline(Readable.fromWeb(options.body), upload, client, { signal: options.signal }).catch(error => { client.abort(); reject(error); });
    } else client.end();
  });
}

/** Private, per-App transport into Chromium's system network stack. No TCP port,
 * stored credentials, PAC evaluator, or renderer-accessible IPC is exposed. */
export async function createSystemNetworkBridge(request) {
  // macOS Unix socket paths are limited to 104 bytes; its user TMPDIR is long.
  const directory = await mkdtemp('/tmp/syntropic-net-');
  const socketPath = join(directory, 'http.sock');
  const controllers = new Set();
  const server = createServer(async (incoming, outgoing) => {
    const abort = new AbortController();
    controllers.add(abort);
    outgoing.on('close', () => { if (!outgoing.writableFinished) abort.abort(); });
    incoming.on('aborted', () => abort.abort());
    try {
      const endpoint = new URL(incoming.url, 'http://localhost');
      const url = new URL(endpoint.searchParams.get('url'));
      if (endpoint.pathname !== '/request' || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        outgoing.writeHead(400).end();
        return;
      }
      const excluded = new Set([...hopHeaders, ...(incoming.headers.connection ?? '').toLowerCase().split(',').map(s => s.trim())]);
      const headers = new Headers();
      for (let i = 0; i < incoming.rawHeaders.length; i += 2) {
        const name = incoming.rawHeaders[i];
        const lower = name.toLowerCase();
        // Chromium supplies its own Fetch Metadata and compression negotiation.
        if (!excluded.has(lower) && !['accept-encoding', 'content-length'].includes(lower) && !lower.startsWith('sec-')) headers.append(name, incoming.rawHeaders[i + 1]);
      }
      const hasBody = !['GET', 'HEAD'].includes(incoming.method)
        && (incoming.headers['transfer-encoding'] !== undefined || Number(incoming.headers['content-length']) > 0);
      const response = await nativeFetch(request, url.href, {
        method: incoming.method, headers, signal: abort.signal,
        ...(hasBody ? { body: Readable.toWeb(incoming) } : {}),
      });
      // Chromium has already decoded compression. The Node caller must not
      // decode it a second time or validate the compressed Content-Length.
      response.headers.forEach((value, name) => {
        if (!hopHeaders.has(name) && !['content-encoding', 'content-length', 'set-cookie'].includes(name)) outgoing.setHeader(name, value);
      });
      const cookies = response.headers.getSetCookie();
      if (cookies.length) outgoing.setHeader('set-cookie', cookies);
      outgoing.writeHead(response.status);
      if (response.body) await pipeline(Readable.fromWeb(response.body), outgoing, { signal: abort.signal });
      else outgoing.end();
    } catch {
      // Preserve network failure semantics. Never turn a proxy failure into an
      // upstream HTTP response, log a credential-bearing URL, or retry a POST.
      outgoing.destroy();
    } finally { controllers.delete(abort); }
  });
  server.requestTimeout = 0; // Callers own deadlines, including model streams.
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(socketPath, resolve); });
    await chmod(socketPath, 0o600);
  } catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
  return {
    socketPath,
    async close() {
      for (const controller of controllers) controller.abort();
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
      await rm(directory, { recursive: true, force: true });
    },
  };
}
