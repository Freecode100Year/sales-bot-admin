import { encryptSecret } from "../_lib/crypto.js";

export async function onRequestGet(context) {
  const { env } = context;
  const row = await env.DB.prepare(
    `SELECT platform, webhook_url, status, updated_at FROM bot_configs WHERE platform = 'telegram'`
  ).first();

  return Response.json({ config: row || null });
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

export async function onRequestPost(context) {
  const { request, env } = context;
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
