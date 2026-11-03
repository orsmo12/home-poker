/* Phone numbers: normalised to E.164 and hashed on the device. The server only ever sees the hash. */

/** "050-123 4567" / "+972 50 123 4567" / "972501234567" → "+972501234567" (Israel by default). Null if invalid. */
export function normalizePhone(input, country = '972') {
  let d = String(input || '').replace(/[^\d+]/g, '');
  if (!d) return null;
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = country + d.slice(1);
  else if (d.length <= 10) d = country + d;
  if (!/^\d{9,15}$/.test(d)) return null;
  if (d.startsWith('972') && !/^972(5\d{8}|[23489]\d{7}|7\d{8})$/.test(d)) return null;
  return `+${d}`;
}

export async function hashPhone(e164) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(e164));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Pretty Israeli format for display: 050-123-4567 */
export function prettyPhone(e164) {
  if (!e164) return '';
  if (e164.startsWith('+972')) { const l = `0${e164.slice(4)}`; return l.length === 10 ? `${l.slice(0, 3)}-${l.slice(3, 6)}-${l.slice(6)}` : l; }
  return e164;
}
