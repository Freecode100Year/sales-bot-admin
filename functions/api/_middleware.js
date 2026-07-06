import { verifyJWT } from "../_lib/jwt.js";

// 无需鉴权的路径
const PUBLIC_PATHS = ["/api/auth/login"];

function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  if (PUBLIC_PATHS.includes(url.pathname)) {
    return next();
  }

  const token = getCookie(request, "admin_token");
  if (!token) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) {
    return new Response(JSON.stringify({ error: "登录已过期，请重新登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  context.data.admin = payload;
  return next();
}
