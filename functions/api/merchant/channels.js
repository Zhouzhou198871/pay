import { listForMerchant } from "../../_lib/merchant.js";
export async function onRequestGet({ request, env }) {
  return listForMerchant({ request, env, table: "merchant_payment_channels", columns: "id, channel_code, display_name, status, created_at", orderBy: "created_at DESC" });
}