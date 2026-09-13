// APCS 學習站 · 跨裝置同步後端（Vercel Serverless Function）
// 後端儲存：Vercel KV / Upstash for Redis（免費額度即可）。
// 只有一位使用者、單一 key；資料是不敏感的學習進度／筆記。
// 金鑰只放在 Vercel 環境變數，絕不進 client。
//
// 需要的環境變數（用 Vercel KV / Upstash 整合會自動注入）：
//   KV_REST_API_URL    或  UPSTASH_REDIS_REST_URL
//   KV_REST_API_TOKEN  或  UPSTASH_REDIS_REST_TOKEN

const KEY = "apcs:sync:v1";
const MAX_BYTES = 512 * 1024; // 512KB 上限，擋掉異常大的寫入

function kvEnv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
  return { url: url.replace(/\/+$/, ""), token };
}

// 直接打 Upstash REST API，不需要任何 npm 套件。
// 例：body = ["SET", key, value] 或 ["GET", key]，回傳 { result: ... }
async function kv(cmd) {
  const { url, token } = kvEnv();
  if (!url || !token) {
    const e = new Error("KV_NOT_CONFIGURED");
    e.code = "KV_NOT_CONFIGURED";
    throw e;
  }
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error("KV_HTTP_" + r.status);
  const j = await r.json();
  return j.result;
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > MAX_BYTES * 2) { req.destroy(); reject(new Error("BODY_TOO_LARGE")); }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const raw = await kv(["GET", KEY]);
      const data = raw ? JSON.parse(raw) : null;
      return res.status(200).json({ ok: true, data });
    }

    if (req.method === "POST" || req.method === "PUT") {
      let body = req.body;
      if (body == null) {
        const raw = await readRawBody(req);
        body = raw ? JSON.parse(raw) : null;
      } else if (typeof body === "string") {
        body = JSON.parse(body);
      }
      if (!body || typeof body !== "object") return res.status(400).json({ ok: false, error: "BAD_BODY" });
      const payload = JSON.stringify(body);
      if (payload.length > MAX_BYTES) return res.status(413).json({ ok: false, error: "TOO_LARGE" });
      await kv(["SET", KEY, payload]);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "METHOD" });
  } catch (e) {
    if (e && e.code === "KV_NOT_CONFIGURED") return res.status(503).json({ ok: false, error: "KV_NOT_CONFIGURED" });
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
};
