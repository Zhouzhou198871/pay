const encoder = new TextEncoder();
export function canonicalAlipayNotify(params) {
  return Object.keys(params).filter((key) => key !== 'sign' && key !== 'sign_type' && params[key] !== undefined && params[key] !== null && params[key] !== '')
    .sort().map((key) => key + '=' + String(params[key])).join('&');
}
function publicKeyBody(value) { return String(value || '').replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s/g, ''); }
export async function verifyAlipayNotify(params, publicKeyPem) {
  if (String(params.sign_type || '').toUpperCase() !== 'RSA2' || !params.sign || !publicKeyPem) return false;
  try {
    const der = Uint8Array.from(atob(publicKeyBody(publicKeyPem)), (char) => char.charCodeAt(0));
    const key = await crypto.subtle.importKey('spki', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const signature = Uint8Array.from(atob(String(params.sign)), (char) => char.charCodeAt(0));
    return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, encoder.encode(canonicalAlipayNotify(params)));
  } catch { return false; }
}
export function amountToCents(value) {
  const match = String(value ?? '').trim().match(/^(\d{1,12})(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
}
export function calculateNetCredit(amountMicro, feeRateBps) {
  const fee = Math.round(Number(amountMicro) * Number(feeRateBps) / 10000);
  return { feeMicro: fee, creditMicro: Number(amountMicro) - fee };
}
