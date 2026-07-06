// ============================================
// 极简 JWT (HS256) 签发与校验，无第三方依赖
// ============================================

function base64url(input) {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

async function hmacKey(secret) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signJWT(payload, secret, expiresInSeconds = 86400) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSeconds };

  const enc = new TextEncoder();
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64url(enc.encode(JSON.stringify(fullPayload)));
  const data = `${headerB64}.${payloadB64}`;

  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const sigB64 = base64url(sig);

  return `${data}.${sigB64}`;
}

export async function verifyJWT(token, secret) {
  try {
    const [headerB64, payloadB64, sigB64] = token.split(".");
    if (!headerB64 || !payloadB64 || !sigB64) return null;

    const data = `${headerB64}.${payloadB64}`;
    const key = await hmacKey(secret);
    const enc = new TextEncoder();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlDecode(sigB64),
      enc.encode(data)
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64)));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    return payload;
  } catch (e) {
    return null;
  }
}
