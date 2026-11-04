const encoder = new TextEncoder();
const asciiCompare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

export function canonicalV2Params(params) {
  return Object.entries(params)
    .filter(([key]) => key !== 'sign')
    .sort(([a], [b]) => asciiCompare(a, b))
    .map(([key, value]) => {
      if (value === null || value === undefined || typeof value === 'object') throw new TypeError('V2 parameters must be scalar values.');
      return key + '=' + String(value);
    })
    .join('&');
}

function pemBytes(pem) {
  const base64 = String(pem || '').replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s/g, '');
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function verifyV2Signature(params, publicPem, signatureBase64) {
  try {
    if (typeof signatureBase64 !== 'string' || signatureBase64.length > 1024) return false;
    const key = await crypto.subtle.importKey('spki', pemBytes(publicPem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const signature = Uint8Array.from(atob(signatureBase64), (char) => char.charCodeAt(0));
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, encoder.encode(canonicalV2Params(params)));
  } catch { return false; }
}

export function isFreshV2Timestamp(value, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!/^\d{10}$/.test(String(value || ''))) return false;
  const timestamp = Number(value);
  return Number.isSafeInteger(timestamp) && Math.abs(nowSeconds - timestamp) <= 300;
}