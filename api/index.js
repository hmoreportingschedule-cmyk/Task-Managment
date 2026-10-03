const DEFAULT_UPSTREAM = "https://script.google.com/macros/s/AKfycbyC84fh1gaAeOQlwPPYjEH1_JEiVLhugfDX8OICvdoAOILhu-j0r38cmZotbx8Qr5Sg/exec";

export default async function handler(req, res) {
  const target = process.env.GOOGLE_APPS_SCRIPT_URL || DEFAULT_UPSTREAM;
  try {
    const init = {
      method: req.method,
      headers: { "Content-Type": req.headers["content-type"] || "application/json" },
      redirect: "follow",
      cache: "no-store"
    };
    if (req.method !== "GET" && req.method !== "HEAD") {
      init.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
    }
    const upstream = await fetch(target, init);
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, max-age=0");
    if (!upstream.ok) {
      return res.end(JSON.stringify({ok:false,message:`Google Apps Script returned HTTP ${upstream.status}. Check the Web App deployment URL and set GOOGLE_APPS_SCRIPT_URL in Vercel.`}));
    }
    return res.end(text);
  } catch (err) {
    res.status(502);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ok:false,message:"API proxy error: "+(err.message || "Unknown error")}));
  }
}
