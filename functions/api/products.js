// /api/products
// GET    -> 列表 (支持 ?category=xxx 过滤)
// POST   -> 新增
// PUT    -> 更新 (body需含id)
// DELETE -> 删除 (?id=xxx)

function uuid() {
  return crypto.randomUUID();
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const category = url.searchParams.get("category");

  let query = "SELECT * FROM products";
  let params = [];
  if (category) {
    query += " WHERE category = ?";
    params.push(category);
  }
  query += " ORDER BY updated_at DESC";

  const { results } = await env.DB.prepare(query).bind(...params).all();
  return Response.json({ products: results });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json().catch(() => ({}));
  const { name, category, price, stock, description } = body;

  if (!name) {
    return Response.json({ error: "商品名称不能为空" }, { status: 400 });
  }

  const id = uuid();
  await env.DB.prepare(
    `INSERT INTO products (id, name, category, price, stock, description)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, name, category || null, price || 0, stock || 0, description || null)
    .run();

  // TODO: 接入 Vectorize 时，在此处生成 embedding 并写入向量库
  // const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: description });
  // await env.VECTORIZE_INDEX.insert([{ id, values: embedding.data[0], metadata: { product_id: id } }]);

  return Response.json({ ok: true, id });
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const body = await request.json().catch(() => ({}));
  const { id, name, category, price, stock, description } = body;

  if (!id) {
    return Response.json({ error: "缺少商品id" }, { status: 400 });
  }

  await env.DB.prepare(
    `UPDATE products
     SET name = ?, category = ?, price = ?, stock = ?, description = ?, updated_at = unixepoch()
     WHERE id = ?`
  )
    .bind(name, category || null, price || 0, stock || 0, description || null, id)
    .run();

  return Response.json({ ok: true });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return Response.json({ error: "缺少商品id" }, { status: 400 });
  }

  await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
  return Response.json({ ok: true });
}
