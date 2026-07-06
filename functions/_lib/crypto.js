// ============================================
// AES-GCM 加解密工具
// master key 来自 env.MASTER_SECRET (Wrangler Secret)
// 用于加密 API Key / Bot Token，D1 中永不落地明文
// ============================================

async function getKey(masterSecret) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(masterSecret.padEnd(32, "0").slice(0, 32)), // 固定为32字节
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
  return keyMaterial;
}

function toBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromBase64(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// 加密：返回 { ciphertext, iv } 均为 base64 字符串
export async function encryptSecret(plaintext, masterSecret) {
  const key = await getKey(masterSecret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );
  return {
    ciphertext: toBase64(ciphertextBuf),
    iv: toBase64(iv),
  };
}

// 解密：输入 base64 ciphertext + base64 iv，返回明文字符串
export async function decryptSecret(ciphertextB64, ivB64, masterSecret) {
  const key = await getKey(masterSecret);
  const iv = fromBase64(ivB64);
  const ciphertext = fromBase64(ciphertextB64);
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plainBuf);
}
