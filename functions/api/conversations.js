// /api/conversations
// GET    -> 列表 (支持 ?platform=xxx&user_id=xxx 过滤)
// DELETE -> 清除某用户上下文 (?user_id=xxx&platform=xxx)

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const platform = url.searchParams.get("platform");
  const userId = url.searchParams.get("user_id");

  let query = "SELECT * FROM conversations WHERE 1=1";
  let params = [];
  if (platform) {
    query += " AND platform = ?";
    params.push(platform);
  }
  if (userId) {
    query += " AND user_id = ?";
    params.push(userId);
  }
  query += " ORDER BY updated_at DESC LIMIT 200";

  const { results } = await env.DB.prepare(query).bind(...params).all();
  return Response.json({ conversations: results });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const userId = url.searchParams.get("user_id");
  const platform = url.searchParams.get("platform");

  if (!userId || !platform) {
    return Response.json({ error: "缺少 user_id 或 platform" }, { status: 400 });
  }

  await env.DB.prepare(
    "DELETE FROM conversations WHERE user_id = ? AND platform = ?"
  )
    .bind(userId, platform)
    .run();

  return Response.json({ ok: true });
}
