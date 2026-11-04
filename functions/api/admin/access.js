import { adminContext } from "../../_lib/admin.js";
import { json } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const context = await adminContext(request, env);
  if (context.response) return context.response;
  return json({ is_admin: true, user: { id: context.user.id, email: context.user.email } });
}
