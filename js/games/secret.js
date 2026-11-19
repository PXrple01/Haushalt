// Geheimnisse (Wort, Figur, Zahl) werden leicht verschleiert gespeichert und verschickt,
// damit sie nicht im Klartext im Speicher stehen. (Kein echter Schutz – aber ihr schummelt ja nicht. 😉)
const key = (sid) => [...String(sid || 'kk')].map((c) => c.charCodeAt(0));

export function enc(text, sid) {
  const k = key(sid);
  const bytes = new TextEncoder().encode(String(text));
  const out = bytes.map((b, i) => b ^ k[i % k.length] ^ (i * 7 & 255));
  let s = '';
  out.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s);
}

export function dec(code, sid) {
  try {
    const k = key(sid);
    const raw = atob(String(code || ''));
    const bytes = Uint8Array.from(raw, (c, i) => c.charCodeAt(0) ^ k[i % k.length] ^ (i * 7 & 255));
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}
