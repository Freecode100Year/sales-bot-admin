import { signJWT } from "../_lib/jwt.js";

async function handleLogin(request, env) {
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

function handleLogout() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `admin_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`,
    },
  });
}

// POST /api/auth/login  { password }
// 密码校验通过后签发 JWT 并写入 HttpOnly Cookie
export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (url.pathname === "/api/auth/login") {
    return handleLogin(request, env);
  }

  if (url.pathname === "/api/auth/logout") {
    return handleLogout();
  }

  return new Response("Not found", { status: 404 });
}
