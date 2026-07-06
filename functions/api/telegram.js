import { encryptSecret, decryptSecret } from "../_lib/crypto.js";

// /api/telegram/config  POST { token, webhook_url } -> 加密保存并自动调用 setWebhook
// /api/telegram/status  GET  -> 返回当前绑定状态 (不含明文token)
// /api/telegram/test    POST -> 用已保存的token调用 getMe 验证有效性

export async function onRequestGet(context) {
  const { env } = context;
  const row = await env.DB.prepare(
    `SELECT platform, webhook_url, status, updated_at FROM bot_configs WHERE platform = 'telegram'`
  ).first();

  return Response.json({ config: row || null });
}

async function handleTestTelegram(env) {
  const row = await env.DB.prepare(
    `SELECT token_ciphertext, token_iv FROM bot_configs WHERE platform = 'telegram'`
  ).first();

  if (!row) {
    return Response.json({ error: "尚未配置 Telegram Token" }, { status: 400 });
  }

  const token = await decryptSecret(row.token_ciphertext, row.token_iv, env.MASTER_SECRET);
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const data = await res.json();

  if (!data.ok) {
    return Response.json({ error: "Token 无效", detail: data.description }, { status: 400 });
  }

  return Response.json({ ok: true, bot: data.result });
}

async function setTelegramWebhook(token, webhook_url) {
  const setRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhook_url }),
  });
  return setRes.json();
}

async function saveBotConfig(db, ciphertext, iv, webhook_url) {
  await db.prepare(
    `INSERT INTO bot_configs (platform, token_ciphertext, token_iv, webhook_url, status, updated_at)
     VALUES ('telegram', ?, ?, ?, 'active', unixepoch())
     ON CONFLICT(platform) DO UPDATE SET
       token_ciphertext = excluded.token_ciphertext,
       token_iv = excluded.token_iv,
       webhook_url = excluded.webhook_url,
       status = 'active',
       updated_at = unixepoch()`
  )
    .bind(ciphertext, iv, webhook_url)
    .run();
}

async function handleSaveTelegram(request, env) {
  const body = await request.json().catch(() => ({}));
  const { token, webhook_url } = body;

  if (!token || !webhook_url) {
    return Response.json({ error: "token 和 webhook_url 必填" }, { status: 400 });
  }
  if (!env.MASTER_SECRET) {
    return Response.json({ error: "服务端未配置 MASTER_SECRET" }, { status: 500 });
  }

  const setData = await setTelegramWebhook(token, webhook_url);
  if (!setData.ok) {
    return Response.json(
      { error: "setWebhook 失败", detail: setData.description },
      { status: 400 }
    );
  }

  const { ciphertext, iv } = await encryptSecret(token, env.MASTER_SECRET);
  await saveBotConfig(env.DB, ciphertext, iv, webhook_url);

  return Response.json({ ok: true });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (url.pathname.endsWith("/test")) {
    return handleTestTelegram(env);
  }
  return handleSaveTelegram(request, env);
}
