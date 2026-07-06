// /api/phrases
// GET    -> 列表 (支持 ?intent_tag=xxx 过滤)
// POST   -> 新增
// PUT    -> 更新
// DELETE -> 删除 (?id=xxx)

function uuid() {
  return crypto.randomUUID();
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const intentTag = url.searchParams.get("intent_tag");

  let query = "SELECT * FROM phrases";
  let params = [];
  if (intentTag) {
    query += " WHERE intent_tag = ?";
    params.push(intentTag);
  }
  query += " ORDER BY intent_tag, updated_at DESC";

  const { results } = await env.DB.prepare(query).bind(...params).all();
  return Response.json({ phrases: results });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json().catch(() => ({}));
  const { intent_tag, template_text, variables } = body;

  if (!intent_tag || !template_text) {
    return Response.json({ error: "intent_tag 和 template_text 必填" }, { status: 400 });
  }

  const id = uuid();
  await env.DB.prepare(
    `INSERT INTO phrases (id, intent_tag, template_text, variables_json)
     VALUES (?, ?, ?, ?)`
  )
    .bind(id, intent_tag, template_text, JSON.stringify(variables || []))
    .run();

  return Response.json({ ok: true, id });
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const body = await request.json().catch(() => ({}));
  const { id, intent_tag, template_text, variables } = body;

  if (!id) {
    return Response.json({ error: "缺少id" }, { status: 400 });
  }

  await env.DB.prepare(
    `UPDATE phrases
     SET intent_tag = ?, template_text = ?, variables_json = ?, updated_at = unixepoch()
     WHERE id = ?`
  )
    .bind(intent_tag, template_text, JSON.stringify(variables || []), id)
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

  await env.DB.prepare("DELETE FROM phrases WHERE id = ?").bind(id).run();
  return Response.json({ ok: true });
}
