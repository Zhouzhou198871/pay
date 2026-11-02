import { json } from "../../_lib/auth.js";

export async function onRequestGet({ env }) {
  return json({ siteKey: env.TURNSTILE_SITE_KEY || "" });
}
