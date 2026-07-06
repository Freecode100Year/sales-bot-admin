import { decryptSecret } from "../../_lib/crypto.js";

export async function onRequestPost(context) {
  const { env } = context;
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
