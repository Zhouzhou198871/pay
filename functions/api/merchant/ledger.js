import { merchantContext, pagination } from "../../_lib/merchant.js";
import { json } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const context = await merchantContext(request, env);
  if (context.response) return context.response;
  const { page, pageSize, offset } = pagination(request);
  const url = new URL(request.url);
  const filters = ["user_id = ?"];
  const binds = [context.user.id];
  const direction = String(url.searchParams.get("direction") || "").trim();
  if (direction && ["credit","debit"].includes(direction)) { filters.push("direction = ?"); binds.push(direction); }
  const keyword = String(url.searchParams.get("keyword") || "").trim().slice(0, 120);
  if (keyword) {
    filters.push("(entry_no LIKE ? OR description LIKE ? OR category LIKE ? OR related_id LIKE ?)");
    const q = "%" + keyword.replace(/[\\%_]/g, "\\$&") + "%";
    binds.push(q,q,q,q);
  }
  const where = " WHERE " + filters.join(" AND ");
  try {
    const [rows, count] = await Promise.all([
      context.db.prepare("SELECT id, entry_no, direction, amount_micro, balance_after_micro, currency, category, description, related_type, related_id, created_at FROM merchant_ledger" + where + " ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?")
        .bind(...binds, pageSize, offset).all(),
      context.db.prepare("SELECT COUNT(*) AS total FROM merchant_ledger" + where).bind(...binds).first()
    ]);
    const total = Number(count?.total || 0);
    return json({ items: rows.results || [], pagination: { page, page_size: pageSize, total, pages: Math.ceil(total / pageSize) } });
  } catch (error) {
    console.error("[merchant/ledger]", String(error?.message || error).slice(0, 180));
    return json({ error: "暂时无法读取资金明细，请稍后重试。" }, 503);
  }
}
