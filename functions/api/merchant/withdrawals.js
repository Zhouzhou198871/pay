import { listForMerchant } from "../../_lib/merchant.js";
export async function onRequestGet({ request, env }) {
  return listForMerchant({ request, env, table: "merchant_withdrawals", columns: "id, request_no, amount_micro, fee_micro, currency, destination_masked, status, requested_at, reviewed_at", orderBy: "requested_at DESC" });
}