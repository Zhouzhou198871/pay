import { currentUser, json } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const user = await currentUser(request, env.AUTH_DB);
  if (!user) return json({ error: "未登录。" }, 401);
  return json({ user });
}
