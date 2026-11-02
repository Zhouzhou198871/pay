import { listForMerchant } from "../../_lib/merchant.js";
export async function onRequestGet({ request, env }) {
  return listForMerchant({ request, env, table: "merchant_orders", columns: "id, merchant_order_no, subject, amount_micro, currency, status, payment_channel, created_at, paid_at", orderBy: "created_at DESC" });
}