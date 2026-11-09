/**
 * CORS proxy for the free JEV model on OpenCode Zen.
 *
 * Deploy with Wrangler:
 *   cd worker
 *   npx wrangler deploy
 *
 * Then paste the Worker URL (for example https://sekeping-jev.<you>.workers.dev)
 * into Sekeping → Pengaturan → Pemindaian & AI → URL JEV / proxy.
 *
 * The Worker holds no API key. It only forwards the request body and the
 * upstream status; the free jev-1.13-free model is keyless.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method === 'GET') {
      return Response.json(
        { ok: true, service: 'sekeping-jev-proxy' },
        { headers: CORS },
      );
    }
    if (request.method !== 'POST') {
      return Response.json({ error: 'method_not_allowed' }, { status: 405, headers: CORS });
    }

    const body = await request.text();
    if (!body) {
      return Response.json({ error: 'empty_body' }, { status: 400, headers: CORS });
    }

    try {
      const upstream = await fetch('https://opencode.ai/zen/v1/systemone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'sekeping-jev-proxy/1.0',
        },
        body,
      });

      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          ...CORS,
          'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    } catch (error) {
      return Response.json(
        { error: 'upstream_unreachable', message: error instanceof Error ? error.message : String(error) },
        { status: 502, headers: CORS },
      );
    }
  },
};
