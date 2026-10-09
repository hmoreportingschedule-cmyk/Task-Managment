const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw9x_CwQz3CAQFSZENxZ6tFwTETOv-vol39dGDR5-A0cFj-pvbgd5_HI_1vLLm5yOxG4Q/exec";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": url.origin,
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "86400",
          },
        });
      }
      if (request.method !== "GET" && request.method !== "POST") {
        return Response.json({ status: "error", message: "Method not allowed." }, { status: 405 });
      }
      try {
        const target = new URL(APPS_SCRIPT_URL);
        if (request.method === "GET") target.search = url.search;
        const headers = new Headers();
        const contentType = request.headers.get("content-type");
        if (contentType) headers.set("content-type", contentType);
        headers.set("accept", "application/json, text/plain, */*");
        const init = { method: request.method, headers, redirect: "follow" };
        if (request.method === "POST") init.body = await request.arrayBuffer();
        const upstream = await fetch(target.toString(), init);
        const raw = await upstream.text();
        let payload;
        try {
          payload = JSON.parse(raw);
        } catch (_) {
          return Response.json({
            status: "error",
            message: "Google Apps Script ne JSON response nahi diya. Web App deployment/access aur doPost/doGet response check karein.",
            upstreamStatus: upstream.status,
            responsePreview: raw.slice(0, 300),
          }, { status: 502, headers: { "Cache-Control": "no-store" } });
        }
        return Response.json(payload, {
          status: 200,
          headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": url.origin },
        });
      } catch (err) {
        return Response.json({ status: "error", message: "Apps Script proxy connection failed: " + String(err?.message || err) }, {
          status: 502,
          headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": url.origin },
        });
      }
    }
    if (env && env.ASSETS && typeof env.ASSETS.fetch === "function") return env.ASSETS.fetch(request);
    return new Response("Static asset binding ASSETS is not configured.", { status: 500 });
  },
};
