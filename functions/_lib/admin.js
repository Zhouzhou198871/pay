import { currentUser, json } from "./auth.js";

export async function adminContext(request, env) {
  if (!env.AUTH_DB) return { response: json({ error: "管理服务暂不可用。" }, 503) };
  const user = await currentUser(request, env.AUTH_DB);
  if (!user) return { response: json({ error: "请先登录。" }, 401) };
  const allowed = new Set(String(env.ADMIN_USER_IDS || "").split(",").map((id) => id.trim()).filter(Boolean));
  if (!allowed.size || !allowed.has(String(user.id))) {
    return { response: json({ error: "当前账户没有后台管理权限。" }, 403) };
  }
  return { db: env.AUTH_DB, user };
}

export function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
