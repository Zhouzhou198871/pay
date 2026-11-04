const encoder = new TextEncoder();

function pemBody(value) {
  return String(value || '')
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s/g, '');
}

function decodeBase64(value) {
  const raw = atob(String(value || ''));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

/** NZZF V2: omit empty values, sign/sign_type, and array/object parameters. */
export function canonicalNzzfParams(params) {
  return Object.keys(params || {})
    .filter((key) => key !== 'sign' && key !== 'sign_type')
    .filter((key) => {
      const value = params[key];
      return value !== undefined && value !== null && value !== '' && typeof value !== 'object';
    })
    .sort()
    .map((key) => key + '=' + String(params[key]))
    .join('&');
}

async function importRsaKey(pem, usage) {
  const body = pemBody(pem);
  if (!body) throw new Error('NZZF_RSA_KEY_MISSING');
  const der = decodeBase64(body);
  return crypto.subtle.importKey(
    usage === 'sign' ? 'pkcs8' : 'spki',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    [usage]
  );
}

export async function signNzzfParams(params, merchantPrivateKey) {
  const key = await importRsaKey(merchantPrivateKey, 'sign');
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', key, encoder.encode(canonicalNzzfParams(params))
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export async function verifyNzzfParams(params, platformPublicKey) {
  if (!params || typeof params.sign !== 'string' || !params.sign || !platformPublicKey) return false;
  if (params.sign_type && String(params.sign_type).toUpperCase() !== 'RSA') return false;
  try {
    const key = await importRsaKey(platformPublicKey, 'verify');
    return await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      decodeBase64(params.sign),
      encoder.encode(canonicalNzzfParams(params))
    );
  } catch {
    return false;
  }
}

export function isFreshNzzfTimestamp(value, nowSeconds = Math.floor(Date.now() / 1000)) {
  const timestamp = String(value ?? '');
  if (!/^\d{10}$/.test(timestamp)) return false;
  return Math.abs(nowSeconds - Number(timestamp)) <= 300;
}

/** Signed application/x-www-form-urlencoded POST; JSON response is signature-checked when signed. */
export async function nzzfPost({ env, path, params = {}, fetchImpl = fetch }) {
  const baseUrl = String(env.NZZF_API_URL || 'https://nzzf.org').replace(/\/+$/, '');
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('NZZF_INVALID_API_PATH');
  const pid = String(env.NZZF_PID || '').trim();
  const privateKey = String(env.NZZF_MERCHANT_PRIVATE_KEY || '').trim();
  const publicKey = String(env.NZZF_PLATFORM_PUBLIC_KEY || '').trim();
  if (!pid || !privateKey || !publicKey) throw new Error('NZZF_CONFIG_MISSING');

  const payload = {
    ...params,
    pid,
    timestamp: String(Math.floor(Date.now() / 1000)),
    sign_type: 'RSA'
  };
  delete payload.sign;
  payload.sign = await signNzzfParams(payload, privateKey);

  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null || typeof value === 'object') continue;
    body.set(key, String(value));
  }

  const timeout = Math.min(20000, Math.max(3000, Number(env.NZZF_TIMEOUT_MS || 12000)));
  const response = await fetchImpl(baseUrl + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: body.toString(),
    signal: AbortSignal.timeout(timeout)
  });
  const responseText = await response.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error('NZZF_INVALID_JSON_RESPONSE');
  }
  if (!response.ok) throw new Error('NZZF_HTTP_' + response.status);
  if (!data || typeof data.sign !== 'string' || String(data.sign_type || '').toUpperCase() !== 'RSA' || !(await verifyNzzfParams(data, publicKey))) {
    throw new Error('NZZF_RESPONSE_SIGNATURE_INVALID');
  }
  return data;
}
