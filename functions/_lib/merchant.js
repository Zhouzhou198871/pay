import { currentUser, json } from "./auth.js";

export const merchantContext = async (request, env) => {
  if (!env.AUTH_DB) return { response: json({ error: "商户数据服务暂不可用。" }, 503) };
  const user = await currentUser(request, env.AUTH_DB);
  if (!user) return { response: json({ error: "请先登录。" }, 401) };
  return { db: env.AUTH_DB, user };
};

export const pagination = (request) => {
  const url = new URL(request.url);
  const page = Math.max(1, Math.min(100000, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1));
  const pageSize = Math.max(1, Math.min(50, Number.parseInt(url.searchParams.get("page_size") || "20", 10) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
};

export const listForMerchant = async ({ request, env, table, columns, orderBy }) => {
  const context = await merchantContext(request, env);
  if (context.response) return context.response;
  const { page, pageSize, offset } = pagination(request);
  try {
    const [rows, count] = await Promise.all([
      context.db.prepare(`SELECT ${columns} FROM ${table} WHERE user_id = ? ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
        .bind(context.user.id, pageSize, offset).all(),
      context.db.prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE user_id = ?`)
        .bind(context.user.id).first()
    ]);
    return json({ items: rows.results || [], pagination: { page, page_size: pageSize, total: count?.total || 0, pages: Math.ceil((count?.total || 0) / pageSize) } });
  } catch (error) {
    console.error("[merchant/list]", table, String(error?.message || error).slice(0, 180));
    return json({ error: "暂时无法读取商户记录，请稍后重试。" }, 503);
  }
};
