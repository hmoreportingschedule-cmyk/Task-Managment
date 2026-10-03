/**
 * Cloudflare Worker - Task Attendance Dashboard API Proxy
 * V.4
 *
 * Frontend calls:
 *   https://YOUR-WORKER.workers.dev/api
 *
 * Set secret/variable:
 *   APPS_SCRIPT_URL = https://script.google.com/macros/s/....../exec
 */

const DEFAULT_UPSTREAM = 'PASTE_APPS_SCRIPT_WEB_APP_URL_HERE';

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '*';
    const headers = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response('', { status: 204, headers });
    }

    const upstream = env.APPS_SCRIPT_URL || DEFAULT_UPSTREAM;
    if (!upstream || upstream.indexOf('PASTE_') === 0) {
      return new Response(JSON.stringify({
        status:'error',
        message:'Cloudflare Worker mein APPS_SCRIPT_URL set nahi hai.'
      }), {status:500, headers:{...headers,'Content-Type':'application/json'}});
    }

    try {
      const url = new URL(request.url);
      const target = new URL(upstream);

      // Health/status can use GET; all application writes use POST.
      if (request.method === 'GET') {
        const action = url.searchParams.get('action') || 'health';
        target.searchParams.set('action', action);
        const r = await fetch(target.toString(), {method:'GET', redirect:'follow'});
        const text = await r.text();
        return new Response(text, {status:r.ok ? 200 : r.status, headers:{...headers,'Content-Type':'application/json'}});
      }

      const body = await request.text();
      const r = await fetch(target.toString(), {
        method:'POST',
        redirect:'follow',
        headers:{'Content-Type':'text/plain;charset=utf-8'},
        body:body
      });
      const text = await r.text();
      return new Response(text, {status:r.ok ? 200 : r.status, headers:{...headers,'Content-Type':'application/json'}});
    } catch (e) {
      return new Response(JSON.stringify({
        status:'error',
        message:'API proxy error: '+String(e.message || e)
      }), {status:502, headers:{...headers,'Content-Type':'application/json'}});
    }
  }
};
