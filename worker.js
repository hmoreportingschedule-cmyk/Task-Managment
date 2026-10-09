const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw9x_CwQz3CAQFSZENxZ6tFwTETOv-vol39dGDR5-A0cFj-pvbgd5_HI_1vLLm5yOxG4Q/exec";

function jsonResponse(payload, status, origin) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: {
          "Access-Control-Allow-Origin": url.origin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        }});
      }
      if (request.method !== "GET" && request.method !== "POST")
        return jsonResponse({ status: "error", message: "Method not allowed." }, 405, url.origin);

      try {
        const target = new URL(APPS_SCRIPT_URL);
        if (request.method === "GET") {
          target.search = url.search;
        }
        const headers = new Headers({ "Accept": "application/json, text/plain, */*" });
        const init = { method: request.method, headers, redirect: "follow" };

        if (request.method === "POST") {
          const contentType = (request.headers.get("content-type") || "").toLowerCase();
          // Apps Script reliably exposes application/x-www-form-urlencoded fields
          // through e.parameter. Convert ordinary browser FormData requests to this
          // format; keep file/multipart requests intact for upload workflows.
          if (contentType.includes("multipart/form-data")) {
            const form = await request.formData();
            const hasFile = [...form.values()].some(v => typeof v !== "string");
            if (!hasFile) {
              const params = new URLSearchParams();
              for (const [key, value] of form.entries()) params.append(key, value);
              headers.set("Content-Type", "application/x-www-form-urlencoded;charset=UTF-8");
              init.body = params.toString();
            } else {
              headers.set("Content-Type", request.headers.get("content-type"));
              const rawForm = new FormData();
              for (const [key, value] of form.entries()) rawForm.append(key, value);
              init.body = rawForm;
            }
          } else {
            const ct = request.headers.get("content-type");
            if (ct) headers.set("Content-Type", ct);
            init.body = await request.arrayBuffer();
          }
        }

        const upstream = await fetch(target.toString(), init);
        const raw = await upstream.text();
        let payload;
        try {
          payload = JSON.parse(raw.trim());
        } catch (_) {
          const preview = raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
          return jsonResponse({
            status: "error",
            code: "APPS_SCRIPT_NON_JSON",
            message: "Apps Script ne JSON response diya. Deployment access, deployment version, aur doPost/doGet response check karein.",
            upstreamStatus: upstream.status,
            responsePreview: preview || "Empty response",
          }, 502, url.origin);
        }
        return jsonResponse(payload, 200, url.origin);
      } catch (err) {
        return jsonResponse({
          status: "error",
          code: "APPS_SCRIPT_PROXY_ERROR",
          message: "Apps Script proxy failed: " + String(err?.message || err),
        }, 502, url.origin);
      }
    }
    if (env && env.ASSETS && typeof env.ASSETS.fetch === "function") return env.ASSETS.fetch(request);
    return new Response("Static asset binding ASSETS is not configured.", { status: 500 });
  },
};
