const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw9x_CwQz3CAQFSZENxZ6tFwTETOv-vol39dGDR5-A0cFj-pvbgd5_HI_1vLLm5yOxG4Q/exec";
const MASTER_SPREADSHEET_ID = "1VpJ6AXRYIpGbx9lYgip-evU2lRLm_HoXqEd9FFtMuBc";

function jsonResponse(payload, status, origin) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "X-Task-API": "V75"
    }
  });
}

function paramsToForm(params) {
  const out = new URLSearchParams();
  for (const [k, v] of params.entries()) out.append(k, String(v));
  return out;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health" || url.pathname === "/api/health/") {
      return jsonResponse({ status: "success", version: "V.75", proxy: "active", spreadsheetId: MASTER_SPREADSHEET_ID, endpointConfigured: true }, 200, url.origin);
    }
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": url.origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400"
      }});
      if (request.method !== "GET" && request.method !== "POST") return jsonResponse({ status: "error", message: "Method not allowed.", version: "V.75" }, 405, url.origin);
      try {
        let body;
        let contentType = "application/x-www-form-urlencoded;charset=UTF-8";
        if (request.method === "GET") {
          body = paramsToForm(url.searchParams).toString();
        } else {
          const incomingType = (request.headers.get("content-type") || "").toLowerCase();
          if (incomingType.includes("multipart/form-data")) {
            const form = await request.formData();
            const hasFile = [...form.values()].some(v => typeof v !== "string");
            if (hasFile) {
              body = new FormData();
              for (const [k, v] of form.entries()) body.append(k, v);
              contentType = null; // fetch must generate the multipart boundary
            } else {
              body = paramsToForm(form).toString();
            }
          } else if (incomingType.includes("application/x-www-form-urlencoded")) {
            body = await request.text();
          } else if (incomingType.includes("application/json")) {
            // Apps Script backend reads e.parameter; convert JSON key/value payloads into form fields.
            const raw = await request.text();
            let obj = {};
            try { obj = JSON.parse(raw || "{}"); } catch (_) {}
            body = paramsToForm(new URLSearchParams(Object.entries(obj).map(([k,v]) => [k, String(v ?? "")]))).toString();
          } else {
            body = await request.text();
          }
        }
        const headers = new Headers({ "Accept": "application/json, text/plain, */*" });
        if (contentType) headers.set("Content-Type", contentType);
        const upstream = await fetch(APPS_SCRIPT_URL, { method: "POST", headers, body, redirect: "follow", signal: AbortSignal.timeout(60000) });
        const raw = await upstream.text();
        let payload;
        try { payload = JSON.parse(raw.trim()); }
        catch (_) {
          const preview = raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
          return jsonResponse({ status: "error", code: "APPS_SCRIPT_NON_JSON", message: "Google Apps Script ne JSON response nahi diya. Apps Script deployment/access check karein.", upstreamStatus: upstream.status, responsePreview: preview || "Empty response", version: "V.75" }, 502, url.origin);
        }
        return jsonResponse(payload, upstream.ok ? 200 : upstream.status, url.origin);
      } catch (err) {
        return jsonResponse({ status: "error", code: "APPS_SCRIPT_PROXY_ERROR", message: "Apps Script proxy request failed.", detail: String(err?.message || err), version: "V.75" }, 502, url.origin);
      }
    }
    if (env && env.ASSETS && typeof env.ASSETS.fetch === "function") return env.ASSETS.fetch(request);
    return new Response("Static asset binding ASSETS is not configured.", { status: 500 });
  }
};
