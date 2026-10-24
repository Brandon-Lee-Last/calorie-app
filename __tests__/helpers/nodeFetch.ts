import http from 'node:http';
import https from 'node:https';

/**
 * fetch on Node's own http client. Under jest-expo the global fetch is Expo's native one, which tests stub out, so
 * tests that talk to a real server use this.
 */
export async function nodeFetch(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.from(await req.arrayBuffer());
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => (headers[k] = v));
  if (body) headers['content-length'] = String(body.length);
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const out = client.request(url, { method: req.method, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const resHeaders = new Headers();
        for (const [k, v] of Object.entries(res.headers)) if (v !== undefined) resHeaders.set(k, Array.isArray(v) ? v.join(', ') : v);
        const status = res.statusCode ?? 0;
        resolve(new Response(status === 204 || status === 304 ? null : Buffer.concat(chunks), { status, headers: resHeaders }));
      });
      res.on('error', reject);
    });
    out.on('error', (e) => reject(new TypeError(`Network request failed: ${e.message}`)));
    req.signal?.addEventListener('abort', () => out.destroy(new Error('aborted')));
    out.end(body);
  });
}
