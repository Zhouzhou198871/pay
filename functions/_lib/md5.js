const shifts = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
const constants = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0);
const rotate = (value, amount) => (value << amount) | (value >>> (32 - amount));

export function md5(input) {
  const bytes = new TextEncoder().encode(String(input));
  const bitLength = bytes.length * 8;
  const paddedLength = (((bytes.length + 8) >>> 6) + 1) * 64;
  const data = new Uint8Array(paddedLength);
  data.set(bytes);
  data[bytes.length] = 0x80;
  const view = new DataView(data.buffer);
  view.setUint32(paddedLength - 8, bitLength >>> 0, true);
  view.setUint32(paddedLength - 4, Math.floor(bitLength / 0x100000000), true);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let offset = 0; offset < paddedLength; offset += 64) {
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const word = view.getUint32(offset + g * 4, true);
      const sum = (a + f + constants[i] + word) >>> 0;
      const next = (b + rotate(sum, shifts[i])) >>> 0;
      a = d; d = c; c = b; b = next;
    }
    a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
  }
  return [a0, b0, c0, d0].map((word) => [0,8,16,24].map((shift) => ((word >>> shift) & 255).toString(16).padStart(2,"0")).join("")).join("");
}

export function paymentSignString(params, apiKey) {
  return Object.entries(params)
    .filter(([key, value]) => key !== "sign" && value !== undefined && value !== null && String(value) !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => key + "=" + String(value))
    .concat("key=" + apiKey)
    .join("&");
}

export function signPaymentParams(params, apiKey) {
  return md5(paymentSignString(params, apiKey));
}

export function isFreshTimestamp(value, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!/^\d{10}$/.test(String(value || ""))) return false;
  const timestamp = Number(value);
  return Number.isSafeInteger(timestamp) && Math.abs(nowSeconds - timestamp) <= 300;
}
