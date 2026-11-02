import { listForMerchant } from "../../_lib/merchant.js";
export async function onRequestGet({ request, env }) {
  return listForMerchant({ request, env, table: "merchant_ledger", columns: "id, entry_no, direction, amount_micro, balance_after_micro, currency, category, description, related_type, related_id, created_at", orderBy: "created_at DESC" });
}