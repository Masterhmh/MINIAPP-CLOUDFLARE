// functions/api/secure_firebase.js
// Cloudflare Pages Function — trạm kiểm soát truy cập Firebase cho bản cá nhân.
// Đặt cạnh proxy.js: functions/api/secure_firebase.js  ->  endpoint: /api/secure_firebase

export async function onRequest(context) {
  const { request, env } = context;

  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    // 1) Lấy initData Telegram từ header Authorization
    const initData = request.headers.get("Authorization") || "";
    if (!initData) return json({ error: "Missing initData" }, 401, CORS);

    // 2) Xác thực chữ ký Telegram
    const user = await verifyTelegramWebAppData(initData, env.BOT_TOKEN);
    if (!user || !user.id) return json({ error: "Invalid Telegram signature" }, 403, CORS);

    // 3) (Tùy chọn) chỉ cho chủ sở hữu nếu có OWNER_ID
    if (env.OWNER_ID && String(user.id) !== String(env.OWNER_ID)) {
      return json({ error: "Forbidden" }, 403, CORS);
    }

    // 4) Lấy & kiểm tra path Firebase từ query ?path=
    const url = new URL(request.url);
    const path = url.searchParams.get("path") || "";
    if (!path.startsWith("/") || !path.endsWith(".json")) {
      return json({ error: "Invalid path" }, 400, CORS);
    }

    // 5) Ghép URL Firebase kèm secret (không bao giờ lộ ra client)
    const base = String(env.FIREBASE_URL).replace(/\/$/, "");
    const target = `${base}${path}?auth=${env.FIREBASE_SECRET}`;

    // 6) Chuyển tiếp tới Firebase
    const method = request.method;
    const init = { method, headers: { "Content-Type": "application/json" } };
    if (method === "PUT" || method === "PATCH" || method === "POST") {
      init.body = await request.text();
    }
    const fbRes = await fetch(target, init);
    const body = await fbRes.text();

    return new Response(body, {
      status: fbRes.status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return json({ error: "Server error", detail: String(err) }, 500, CORS);
  }
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

// ---- Xác thực Telegram WebApp initData (HMAC-SHA256) ----
async function verifyTelegramWebAppData(initData, botToken) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const enc = new TextEncoder();
  // secret_key = HMAC_SHA256(key="WebAppData", msg=bot_token)
  const secretKey = await hmacRaw(enc.encode("WebAppData"), enc.encode(botToken));
  // computed = HMAC_SHA256(key=secret_key, msg=data_check_string) -> hex
  const computedHex = await hmacHex(secretKey, enc.encode(dataCheckString));
  if (computedHex !== hash) return null;

  // Chống replay: từ chối initData quá 24h (nới lỏng nếu cần)
  const authDate = Number(params.get("auth_date") || 0);
  if (authDate && Date.now() / 1000 - authDate > 86400) return null;

  const userRaw = params.get("user");
  if (!userRaw) return null;
  try { return JSON.parse(userRaw); } catch { return null; }
}

async function hmacRaw(keyBytes, msgBytes) {
  const key = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, msgBytes);
  return new Uint8Array(sig);
}

async function hmacHex(keyBytes, msgBytes) {
  const sig = await hmacRaw(keyBytes, msgBytes);
  return [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
}