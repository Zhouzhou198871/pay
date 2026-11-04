import { currentUser, hashPassword, json, randomHex, sha256, verifyPassword } from "../../_lib/auth.js";
import { ensurePlatformKeyPair } from "../../_lib/platform-signature.js";

const networks = new Set(["USDT-TRC20", "USDT-ERC20", "USDT-BEP20"]);
const encoder = new TextEncoder();

async function encryptV2PrivateKey(privatePem, masterSecret) {
  const keyBytes = await crypto.subtle.digest('SHA-256', encoder.encode(masterSecret));
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(privatePem));
  const toHex = (bytes) => [...new Uint8Array(bytes)].map((v) => v.toString(16).padStart(2, '0')).join('');
  return toHex(iv) + '.' + toHex(encrypted);
}

function pem(label, bytes) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  const base64 = btoa(binary);
  return '-----BEGIN ' + label + '-----\n' + base64.match(/.{1,64}/g).join('\n') + '\n-----END ' + label + '-----';
}

async function generateV2KeyPair(masterSecret) {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const [privateDer, publicDer] = await Promise.all([crypto.subtle.exportKey('pkcs8', pair.privateKey), crypto.subtle.exportKey('spki', pair.publicKey)]);
  const privatePem = pem('PRIVATE KEY', privateDer);
  const publicPem = pem('PUBLIC KEY', publicDer);
  return { privatePem, publicPem, ciphertext: await encryptV2PrivateKey(privatePem, masterSecret) };
}

function validAddress(address, network) {
  if (network === "USDT-TRC20") return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
  if (network === "USDT-ERC20" || network === "USDT-BEP20") return /^0x[a-fA-F0-9]{40}$/.test(address);
  return false;
}

async function encryptAppSecret(secret, masterSecret) {
  const keyBytes = await crypto.subtle.digest("SHA-256", encoder.encode(masterSecret));
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(secret));
  const toHex = (bytes) => [...new Uint8Array(bytes)].map((v) => v.toString(16).padStart(2, "0")).join("");
  return toHex(iv) + "." + toHex(encrypted);
}

function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}

async function ensureMerchant(db, user, origin, secret) {
  let merchant = await db.prepare("SELECT id, user_id, site_name, site_url, status, app_id, merchant_no, api_key, usdt_address, usdt_network, withdraw_password_hash, v2_private_key, v2_public_key, v2_key_created_at FROM pay_merchants WHERE user_id = ? ORDER BY created_at DESC LIMIT 1")
    .bind(user.id).first();

  if (!merchant) {
    const now = Math.floor(Date.now() / 1000);
    const id = randomHex(16);
    const appId = "qt_" + randomHex(12);
    const appSecret = randomHex(32);
    const ciphertext = await encryptAppSecret(appSecret, secret);
    const siteName = String(user.display_name || user.username || "晴天支付商户").slice(0, 100);
    const siteUrl = origin;
    for (let attempt = 0; attempt < 20; attempt++) {
      const merchantNo = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
      const apiKey = randomHex(20);
      try {
        await db.prepare("INSERT INTO pay_merchants (id,user_id,site_name,site_url,contact,notify_url,status,app_id,app_secret_ciphertext,created_at,merchant_no,api_key,usdt_network) VALUES (?,?,?,?,?,?, 'pending',?,?,?,?,?,'USDT-TRC20')")
          .bind(id, user.id, siteName, siteUrl, user.email, "", appId, ciphertext, now, merchantNo, apiKey).run();
        merchant = { id, user_id: user.id, site_name: siteName, site_url: siteUrl, status: "pending", app_id: appId, merchant_no: merchantNo, api_key: apiKey, usdt_address: null, usdt_network: "USDT-TRC20", withdraw_password_hash: null };
        break;
      } catch (error) {
        if (attempt === 19) throw error;
      }
    }
  }

  if (merchant && (!merchant.merchant_no || !merchant.api_key)) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const merchantNo = merchant.merchant_no || String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
      const apiKey = merchant.api_key || randomHex(20);
      try {
        await db.prepare("UPDATE pay_merchants SET merchant_no = ?, api_key = ?, usdt_network = COALESCE(usdt_network, 'USDT-TRC20') WHERE id = ?")
          .bind(merchantNo, apiKey, merchant.id).run();
        merchant = { ...merchant, merchant_no: merchantNo, api_key: apiKey, usdt_network: merchant.usdt_network || "USDT-TRC20" };
        break;
      } catch (error) {
        if (attempt === 19) throw error;
      }
    }
  }
  return merchant;
}

export async function onRequestGet({ request, env }) {
  if (!env.AUTH_DB || !env.AUTH_SECRET) return json({ error: "商户资料服务暂不可用。" }, 503);
  const user = await currentUser(request, env.AUTH_DB);
  if (!user) return json({ error: "请先登录。" }, 401);
  try {
    const merchant = await ensureMerchant(env.AUTH_DB, user, new URL(request.url).origin, env.AUTH_SECRET);
    return json({
      user: { id: user.id, email: user.email, display_name: user.display_name || user.username || "" },
      merchant: {
        merchant_no: merchant.merchant_no,
        api_key: merchant.api_key,
        v2_public_key: merchant.v2_public_key || "",
        v2_key_created_at: merchant.v2_key_created_at || null,
        v2_key_configured: Boolean(merchant.v2_public_key && merchant.v2_private_key),
        platform_public_key: platformPublicKey,
        usdt_address: merchant.usdt_address || "",
        usdt_network: merchant.usdt_network || "USDT-TRC20",
        withdraw_password_set: Boolean(merchant.withdraw_password_hash),
        status: merchant.status
      }
    });
  } catch (error) {
    console.error("[merchant/profile:get]", String(error?.message || error).slice(0, 200));
    return json({ error: "商户资料初始化失败，请检查数据库迁移后重试。" }, 503);
  }
}

export async function onRequestPatch({ request, env }) {
  if (!env.AUTH_DB || !env.AUTH_SECRET) return json({ error: "商户资料服务暂不可用。" }, 503);
  if (!sameOrigin(request)) return json({ error: "请求来源校验失败。" }, 403);
  const user = await currentUser(request, env.AUTH_DB);
  if (!user) return json({ error: "登录状态已失效，请重新登录。" }, 401);
  try {
    const body = await request.json();
    const merchant = await ensureMerchant(env.AUTH_DB, user, new URL(request.url).origin, env.AUTH_SECRET);
    const db = env.AUTH_DB;

    if (body.action === "account") {
      const displayName = String(body.display_name || "").trim();
      if (!displayName || displayName.length > 40) return json({ error: "昵称需为 1 至 40 个字符。" }, 400);
      const updates = ["display_name = ?"];
      const values = [displayName];
      if (body.new_password !== undefined && String(body.new_password)) {
        const currentPassword = String(body.current_password || "");
        const newPassword = String(body.new_password);
        if (newPassword.length < 8 || newPassword.length > 128) return json({ error: "新登录密码需为 8 至 128 位。" }, 400);
        const stored = await db.prepare("SELECT password_hash FROM users WHERE id = ?").bind(user.id).first();
        if (!stored || !(await verifyPassword(currentPassword, stored.password_hash))) return json({ error: "当前登录密码不正确。" }, 400);
        updates.push("password_hash = ?");
        values.push(await hashPassword(newPassword));
      }
      values.push(user.id);
      await db.prepare("UPDATE users SET " + updates.join(", ") + " WHERE id = ?").bind(...values).run();
      if (body.new_password) {
        const cookie = request.headers.get("Cookie") || "";
        const token = cookie.match(/(?:^|;\s*)__Host-qt_session=([^;]+)/)?.[1] || "";
        const currentHash = token ? await sha256(token) : "";
        await db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?").bind(user.id, currentHash).run();
      }
      return json({ success: true, message: "账户资料已保存。" });
    }

    if (body.action === "payout") {
      const address = String(body.usdt_address || "").trim();
      const network = String(body.usdt_network || "USDT-TRC20").trim();
      if (!networks.has(network)) return json({ error: "请选择支持的 USDT 网络。" }, 400);
      if (!validAddress(address, network)) return json({ error: network + " 地址格式不正确，请检查后重试。" }, 400);
      await db.prepare("UPDATE pay_merchants SET usdt_address = ?, usdt_network = ? WHERE id = ?")
        .bind(address, network, merchant.id).run();
      return json({ success: true, message: "USDT 提款地址已保存。" });
    }

    if (body.action === "withdraw_password") {
      const password = String(body.withdraw_password || "");
      if (password.length < 8 || password.length > 64) return json({ error: "支付密码需为 8 至 64 位。" }, 400);
      if (!merchant.usdt_address) return json({ error: "请先绑定 USDT 提款地址。" }, 400);
      if (merchant.withdraw_password_hash) {
        const current = String(body.current_withdraw_password || "");
        if (!(await verifyPassword(current, merchant.withdraw_password_hash))) return json({ error: "当前支付密码不正确。" }, 400);
      }
      const hash = await hashPassword(password);
      await db.prepare("UPDATE pay_merchants SET withdraw_password_hash = ? WHERE id = ?").bind(hash, merchant.id).run();
      return json({ success: true, message: "支付密码已安全保存。" });
    }

    if (body.action === "rotate_api_key") {
      const apiKey = randomHex(20);
      await db.prepare("UPDATE pay_merchants SET api_key = ? WHERE id = ?").bind(apiKey, merchant.id).run();
      return json({ success: true, api_key: apiKey, message: "V1 商户密钥已重置，请同步更新接入方配置。" });
    }

    if (body.action === "generate_v2_keys" || body.action === "reset_v2_keys") {
      const keys = await generateV2KeyPair(env.AUTH_SECRET);
      const now = Math.floor(Date.now() / 1000);
      await db.prepare("UPDATE pay_merchants SET v2_private_key = ?, v2_public_key = ?, v2_key_created_at = ? WHERE id = ?")
        .bind(keys.ciphertext, keys.publicPem, now, merchant.id).run();
      return json({ success: true, v2_public_key: keys.publicPem, v2_private_key_once: keys.privatePem, v2_key_created_at: now,
        message: body.action === "reset_v2_keys" ? "V2 RSA 密钥对已重置。旧私钥立即失效，请更新调用方配置。" : "V2 RSA 密钥对已生成。私钥仅本次展示，请立即安全保存。" });
    }

    return json({ error: "不支持的资料操作。" }, 400);
  } catch (error) {
    console.error("[merchant/profile:patch]", String(error?.message || error).slice(0, 200));
    return json({ error: "资料保存失败，请稍后重试。" }, 500);
  }
}
