export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json().catch(() => ({}));
  const { id } = body;
  if (!id) return Response.json({ error: "缺少id" }, { status: 400 });

  await env.DB.prepare(
    `UPDATE api_keys SET used_count = 0, status = 'active', last_reset_at = unixepoch() WHERE id = ?`
  )
    .bind(id)
    .run();
  return Response.json({ ok: true });
}
