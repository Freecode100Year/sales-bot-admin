import { signJWT } from "../../_lib/jwt.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json().catch(() => ({}));
  const { password } = body;

  if (!password || password !== env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: "密码错误" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = await signJWT({ role: "admin" }, env.JWT_SECRET, 86400 * 7);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `admin_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${86400 * 7}`,
    },
  });
}
