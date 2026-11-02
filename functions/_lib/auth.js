const encoder = new TextEncoder();

export const json = (data, status = 200, extraHeaders = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extraHeaders }
});

export const randomHex = (bytes = 32) => {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return [...value].map((part) => part.toString(16).padStart(2, "0")).join("");
};

export const sha256 = async (value) => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
};

export const hmac = async (value, secret) => {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(signature)].map((part) => part.toString(16).padStart(2, "0")).join("");
};

export const safeEqual = (a = "", b = "") => {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
};

export const hashPassword = async (password) => {
  const salt = randomHex(16);
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: encoder.encode(salt), iterations: 150000, hash: "SHA-256" }, key, 256);
  const digest = [...new Uint8Array(bits)].map((part) => part.toString(16).padStart(2, "0")).join("");
  return `pbkdf2$150000$${salt}$${digest}`;
};

export const verifyPassword = async (password, stored) => {
  const [scheme, rounds, salt, expected] = (stored || "").split("$");
  if (scheme !== "pbkdf2" || !rounds || !salt || !expected) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: encoder.encode(salt), iterations: Number(rounds), hash: "SHA-256" }, key, 256);
  const actual = [...new Uint8Array(bits)].map((part) => part.toString(16).padStart(2, "0")).join("");
  return safeEqual(actual, expected);
};

export const createSession = async (db, userId) => {
  const token = randomHex(32);
  const now = Math.floor(Date.now() / 1000);
  await db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256(token), userId, now + 60 * 60 * 24 * 30, now).run();
  return token;
};

export const sessionCookie = (token) => `__Host-qt_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
export const expiredSessionCookie = () => "__Host-qt_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";

export const currentUser = async (request, db) => {
  const cookie = request.headers.get("Cookie") || "";
  const token = cookie.match(/(?:^|;\s*)__Host-qt_session=([^;]+)/)?.[1];
  if (!token) return null;
  const tokenHash = await sha256(token);
  const now = Math.floor(Date.now() / 1000);
  const row = await db.prepare("SELECT users.id, users.email, users.display_name FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND users.status = 'active' LIMIT 1")
    .bind(tokenHash, now).first();
  return row || null;
};

export const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
export const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const verifyTurnstile = async (token, secret, remoteIp = "", expectedAction = "", expectedHostname = "") => {
  if (!token || !secret || !expectedAction || !expectedHostname) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body
    });
    if (!response.ok) return false;
    const result = await response.json();
    return result.success === true
      && result.action === expectedAction
      && result.hostname === expectedHostname;
  } catch { return false; }
};
