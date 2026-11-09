#!/usr/bin/env node
/**
 * Tiny JEV proxy for local development or a static build.
 *
 * OpenCode Zen answers POST /zen/v1/systemone, but it does not answer the
 * browser's CORS preflight, and the free tier needs the caller's address in
 * X-Real-IP. This server adds CORS headers, forwards the browser's address and
 * sends the request from Node. Run it on a non-Cloudflare host: Cloudflare
 * strips X-Real-IP on cross-zone Worker subrequests.
 *
 *   node scripts/jev-proxy.mjs
 *   PORT=4178 node scripts/jev-proxy.mjs
 *   JEV_MOCK='{"answers":{...}}' node scripts/jev-proxy.mjs   # tests
 *
 * Then set Settings → Pemindaian & AI → URL JEV / proxy to
 * http://127.0.0.1:4178. The free model needs no API key.
 */
import http from 'node:http';

const PORT = Number(process.env.PORT || process.env.JEV_PROXY_PORT || 4178);
const HOST = process.env.HOST || '0.0.0.0';
const UPSTREAM = process.env.JEV_UPSTREAM || 'https://opencode.ai/zen/v1/systemone';
const MOCK = process.env.JEV_MOCK || '';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key',
  'Access-Control-Max-Age': '86400',
};

function send(res, status, body) {
  res.writeHead(status, {
    ...CORS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  if (req.method === 'GET') {
    send(res, 200, JSON.stringify({ ok: true, service: 'sekeping-jev-proxy', mock: Boolean(MOCK) }));
    return;
  }
  if (req.method !== 'POST') {
    send(res, 405, JSON.stringify({ error: 'method_not_allowed' }));
    return;
  }

  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const clientIp =
    forwarded ||
    String(req.headers['x-real-ip'] || '') ||
    String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');

  let body = '';
  for await (const chunk of req) body += chunk;
  if (!body) {
    send(res, 400, JSON.stringify({ error: 'empty_body' }));
    return;
  }

  if (MOCK) {
    try {
      const parsed = JSON.parse(MOCK);
      setTimeout(() => send(res, 200, JSON.stringify(parsed)), 250);
    } catch {
      send(res, 500, JSON.stringify({ error: 'bad_mock' }));
    }
    return;
  }

  try {
    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'sekeping-jev-proxy/1.0',
        // OpenCode's free tier buckets by this address. On a non-Cloudflare
        // host the header survives, unlike a Cloudflare Worker subrequest.
        ...(clientIp ? { 'X-Real-IP': clientIp } : {}),
      },
      body,
      signal: AbortSignal.timeout(20000),
    });
    const text = await upstream.text();
    res.writeHead(upstream.status, {
      ...CORS,
      'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(text);
  } catch (error) {
    send(
      res,
      502,
      JSON.stringify({
        error: 'upstream_unreachable',
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
});

server.listen(PORT, HOST, () => {
  console.log(`JEV proxy on http://${HOST}:${PORT}${MOCK ? ' (mock)' : ` → ${UPSTREAM}`}`);
});
