// Kleine Helfer ohne Abhängigkeiten.

export const PLAYERS = {
  jos: { id: 'jos', name: 'Josefine', theme: 'baby' },
  joh: { id: 'joh', name: 'Johann', theme: 'lila' },
};
export const PIDS = ['jos', 'joh'];
export const other = (p) => (p === 'jos' ? 'joh' : 'jos');
export const nameOf = (p) => PLAYERS[p]?.name ?? '';

// Zufällige ID (für Partien und Ereignisse)
export function uid(n = 10) {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => abc[b % abc.length]).join('');
}

export const rnd = (a, b) => a + Math.random() * (b - a);
export const rint = (a, b) => Math.floor(rnd(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// SHA-256 als Hex (für den Kanalnamen im Fern-Modus)
export async function sha256hex(text) {
  const data = new TextEncoder().encode(text);
  if (crypto?.subtle?.digest) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Notlösung ohne sicheren Kontext (nur lokal beim Testen relevant)
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (const b of data) { h1 = Math.imul(h1 ^ b, 16777619); h2 = Math.imul(h2 + b, 2246822519); }
  return ((h1 >>> 0).toString(16) + (h2 >>> 0).toString(16)).padStart(16, '0').repeat(4);
}

// ---------- Text-Vergleiche (Wer bin ich?) ----------
// „Prinzessin Elsa“ ≈ „elsa“? Kleinbuchstaben, ohne Akzente/Umlaute, ohne Satzzeichen und Artikel.
export function normName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(der|die|das|the|ein|eine)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// Exakter Treffer (nach Normalisierung) oder nur kleiner Tippfehler?
export function nameMatch(guess, target) {
  const g = normName(guess), t = normName(target);
  if (!g || !t) return 'no';
  if (g === t || g.replace(/ /g, '') === t.replace(/ /g, '')) return 'exact';
  const tol = t.length <= 4 ? 0 : t.length <= 8 ? 1 : 2;
  if (levenshtein(g, t) <= tol) return 'close';
  // „Elsa“ für „Elsa (Die Eiskönigin)“ oder Nachname allein
  const words = t.split(' ').filter((w) => w.length > 2);
  if (words.length > 1 && words.some((w) => w === g || levenshtein(w, g) <= (w.length > 6 ? 1 : 0))) return 'close';
  return 'no';
}

// ---------- Galgenmännchen-Wörter ----------
// Erlaubt: A–Z, Ä Ö Ü, ß, dazu Leerzeichen und Bindestrich (werden sofort aufgedeckt).
export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜß'.split('');
export function upLetter(ch) {
  if (ch === 'ß' || ch === 'ẞ') return 'ß';
  if ('äöüÄÖÜ'.includes(ch)) return ch.toUpperCase();
  const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return base.toUpperCase();
}
export function cleanWord(input) {
  const raw = String(input || '').replace(/\s+/g, ' ').trim();
  const out = [];
  const bad = new Set();
  for (const ch of raw) {
    if (ch === ' ' || ch === '-') { out.push(ch); continue; }
    const u = upLetter(ch);
    if (u.length === 1 && LETTERS.includes(u)) out.push(u);
    else bad.add(ch);
  }
  const word = out.join('').replace(/^[ -]+|[ -]+$/g, '').replace(/ {2,}/g, ' ');
  const letters = [...word].filter((c) => LETTERS.includes(c)).length;
  return { word, letters, bad: [...bad] };
}

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Deutsche Aufzählung: „A, B und C“
export function listDe(items) {
  if (items.length <= 1) return items.join('');
  return items.slice(0, -1).join(', ') + ' und ' + items[items.length - 1];
}
