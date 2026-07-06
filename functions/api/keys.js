import { encryptSecret } from "../_lib/crypto.js";

function uuid() {
  return crypto.randomUUID();
}

export async function onRequestGet(context) {
  const { env } = context;
  const { results } = await env.DB.prepare(
    `SELECT id, provider, label, status, quota_limit, used_count, last_used_at, last_reset_at, created_at
     FROM api_keys ORDER BY provider, created_at DESC`
  ).all();
  return Response.json({ keys: results });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json().catch(() => ({}));
  const { provider, label, api_key, quota_limit } = body;

  if (!provider || !api_key) {
    return Response.json({ error: "provider 和 api_key 必填" }, { status: 400 });
  }
  if (!env.MASTER_SECRET) {
    return Response.json({ error: "服务端未配置 MASTER_SECRET，无法加密存储" }, { status: 500 });
  }

  const { ciphertext, iv } = await encryptSecret(api_key, env.MASTER_SECRET);
  const id = uuid();

  await env.DB.prepare(
    `INSERT INTO api_keys (id, provider, label, key_ciphertext, key_iv, quota_limit)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, provider, label || null, ciphertext, iv, quota_limit || 0)
    .run();

  return Response.json({ ok: true, id });
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const body = await request.json().catch(() => ({}));
  const { id, status, quota_limit } = body;

  if (!id) {
    return Response.json({ error: "缺少id" }, { status: 400 });
  }

  await env.DB.prepare(
    `UPDATE api_keys SET status = COALESCE(?, status), quota_limit = COALESCE(?, quota_limit) WHERE id = ?`
  )
    .bind(status || null, quota_limit ?? null, id)
    .run();

  return Response.json({ ok: true });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return Response.json({ error: "缺少id" }, { status: 400 });
  }

  await env.DB.prepare("DELETE FROM api_keys WHERE id = ?").bind(id).run();
  return Response.json({ ok: true });
}
