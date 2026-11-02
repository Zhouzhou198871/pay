import { currentUser, json } from "../../../_lib/auth.js";
import { checkFirestoreConnection } from "../../../_lib/firebase.js";

export async function onRequestGet({ request, env }) {
  if (!env.AUTH_DB) return json({ error: "账户服务暂不可用。" }, 503);
  const user = await currentUser(request, env.AUTH_DB);
  if (!user) return json({ error: "请先登录。" }, 401);
  const result = await checkFirestoreConnection(env);
  return json(result, result.connected ? 200 : 503);
}
