const encoder = new TextEncoder();

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\\+/g, "-").replace(/\\//g, "_");
}

function pemToBytes(pem) {
  const normalized = String(pem || "").replace(/\\n/g, "\n");
  const body = normalized.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\\s/g, "");
  if (!body) throw new Error("missing_private_key");
  const binary = atob(body);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function createGoogleAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claim = base64url(encoder.encode(JSON.stringify({
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  })));
  const unsigned = header + "." + claim;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(env.FIREBASE_PRIVATE_KEY),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(unsigned));
  const assertion = unsigned + "." + base64url(new Uint8Array(signature));
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(8000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw new Error("google_token_exchange_failed");
  return payload.access_token;
}

export async function checkFirestoreConnection(env) {
  const projectId = String(env.FIREBASE_PROJECT_ID || "").trim();
  const databaseId = String(env.FIREBASE_DATABASE_ID || "(default)").trim();
  const clientEmail = String(env.FIREBASE_CLIENT_EMAIL || "").trim();
  const privateKey = String(env.FIREBASE_PRIVATE_KEY || "").trim();
  if (!projectId || !clientEmail || !privateKey) {
    return { configured: false, connected: false, missing: [
      ...(!projectId ? ["FIREBASE_PROJECT_ID"] : []),
      ...(!clientEmail ? ["FIREBASE_CLIENT_EMAIL"] : []),
      ...(!privateKey ? ["FIREBASE_PRIVATE_KEY"] : [])
    ] };
  }
  try {
    const token = await createGoogleAccessToken(env);
    const url = "https://firestore.googleapis.com/v1/projects/" +
      encodeURIComponent(projectId) + "/databases/" + encodeURIComponent(databaseId);
    const response = await fetch(url, {
      headers: { Authorization: "Bearer " + token, Accept: "application/json" },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) {
      return { configured: true, connected: false, reason:
        response.status === 403 ? "permission_denied" :
        response.status === 404 ? "project_or_database_not_found" : "firestore_request_failed",
        http_status: response.status };
    }
    const database = await response.json().catch(() => ({}));
    return {
      configured: true,
      connected: true,
      project_id: projectId,
      database_id: database.name?.split("/").pop() || databaseId,
      location_id: database.locationId || null,
      database_type: database.type || null
    };
  } catch (error) {
    console.error("[firebase/status]", String(error?.message || "unknown").slice(0, 120));
    return { configured: true, connected: false, reason: "connection_check_failed" };
  }
}
