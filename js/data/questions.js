// Fragen-Ideen für „Zahl erraten“ (1–100).
// test(n) = true heißt: Für die Zahl n wäre die Antwort „Ja“. Karten ohne test sind reine Inspiration (kein Auto-Streichen).
const isPrime = (n) => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
const digits = (n) => String(n).split('').map(Number);

export const CARDS = [
  { id: 'bier', e: '🍺', q: 'Wäre das mein Alter – dürfte ich in Deutschland Alkohol kaufen? (Bier & Wein ab 16)', test: (n) => n >= 16 },
  { id: 'schnaps', e: '🥃', q: 'Wäre das mein Alter – dürfte ich Schnaps kaufen? (ab 18)', test: (n) => n >= 18 },
  { id: 'auto', e: '🚗', q: 'Wäre das mein Alter – dürfte ich allein Auto fahren? (ab 18)', test: (n) => n >= 18 },
  { id: 'praesident', e: '🏛️', q: 'Wäre das mein Alter – dürfte ich Bundespräsident werden? (ab 40)', test: (n) => n >= 40 },
  { id: 'rente', e: '👵', q: 'Wäre das mein Alter – wäre ich schon in Rente? (ab 67)', test: (n) => n >= 67 },
  { id: 'fsk12', e: '🎮', q: 'Wäre das mein Alter – dürfte ich ein Spiel ab 12 spielen?', test: (n) => n >= 12 },
  { id: 'monat', e: '📅', q: 'Gibt es diesen Tag in jedem Monat? (bis 28)', test: (n) => n <= 28 },
  { id: 'tag', e: '🗓️', q: 'Könnte das ein Tag im Monat sein? (bis 31)', test: (n) => n <= 31 },
  { id: 'stunde', e: '🕐', q: 'Gibt es diese Stunde auf der Uhr? (0 bis 23)', test: (n) => n <= 23 },
  { id: 'minute', e: '⏱️', q: 'Könnte das eine Minutenzahl sein? (bis 59)', test: (n) => n <= 59 },
  { id: 'wochen', e: '📆', q: 'Hat ein Jahr mindestens so viele Wochen? (52)', test: (n) => n <= 52 },
  { id: 'fieber', e: '🌡️', q: 'Wäre das in Grad Celsius schon Fieber? (ab 38 °C)', test: (n) => n >= 38 },
  { id: 'bad', e: '🏊', q: 'Wäre das in °C als Badewasser zu kalt? (unter 20 °C)', test: (n) => n < 20 },
  { id: 'schuh', e: '👟', q: 'Wäre das eine normale Schuhgröße für Erwachsene? (35 bis 48)', test: (n) => n >= 35 && n <= 48 },
  { id: 'skat', e: '🃏', q: 'Hat ein Skatblatt mindestens so viele Karten? (32)', test: (n) => n <= 32 },
  { id: 'roulette', e: '🎰', q: 'Gibt es die Zahl beim Roulette? (0 bis 36)', test: (n) => n <= 36 },
  { id: 'klavier', e: '🎹', q: 'Hat ein Klavier mehr Tasten? (88)', test: (n) => n < 88 },
  { id: 'zaehne', e: '🦷', q: 'Hat ein Erwachsener mehr Zähne? (32)', test: (n) => n < 32 },
  { id: 'laender', e: '🇩🇪', q: 'Hat Deutschland so viele Bundesländer oder mehr? (16)', test: (n) => n <= 16 },
  { id: 'fussball', e: '⚽', q: 'Stehen bei einem Fußballspiel mehr Spieler auf dem Platz? (22)', test: (n) => n < 22 },
  { id: 'gerade', e: '✌️', q: 'Ist die Zahl gerade?', test: (n) => n % 2 === 0 },
  { id: 'drei', e: '🔺', q: 'Ist sie durch 3 teilbar?', test: (n) => n % 3 === 0 },
  { id: 'fuenf', e: '🖐️', q: 'Ist sie durch 5 teilbar?', test: (n) => n % 5 === 0 },
  { id: 'rund', e: '🎂', q: 'Wäre das ein runder Geburtstag? (10, 20, 30 …)', test: (n) => n % 10 === 0 },
  { id: 'prim', e: '🧮', q: 'Ist es eine Primzahl?', test: isPrime },
  { id: 'quadrat', e: '⬛', q: 'Ist es eine Quadratzahl? (1, 4, 9, 16 …)', test: (n) => Number.isInteger(Math.sqrt(n)) },
  { id: 'sieben', e: '7️⃣', q: 'Kommt eine 7 darin vor?', test: (n) => String(n).includes('7') },
  { id: 'zweistellig', e: '🔢', q: 'Ist sie zweistellig?', test: (n) => n >= 10 && n <= 99 },
  { id: 'schnapszahl', e: '🎲', q: 'Ist es eine Schnapszahl? (11, 22, 33 …)', test: (n) => n >= 11 && n <= 99 && n % 11 === 0 },
  { id: 'quersumme', e: '➕', q: 'Ist die Quersumme größer als 9?', test: (n) => digits(n).reduce((a, b) => a + b, 0) > 9 },
  { id: 'haelfte', e: '🌗', q: 'Ist sie größer als 50?', test: (n) => n > 50 },
  { id: 'viertel', e: '🍰', q: 'Ist sie kleiner als 25?', test: (n) => n < 25 },
  { id: 'jahrestag', e: '💞', q: 'Hat die Zahl etwas mit uns zwei zu tun?' },
  { id: 'lieblings', e: '⭐', q: 'Ist das deine Lieblingszahl?' },
  { id: 'song', e: '🎵', q: 'Kommt die Zahl in einem bekannten Songtitel vor?' },
];

export const cardById = (id) => CARDS.find((c) => c.id === id) || null;

// Nach einer Antwort: welche Zahlen passen nicht mehr? (nur Karten mit Regel, nur bei Ja/Nein)
export function excludedBy(cardId, answer) {
  const c = cardById(cardId);
  if (!c?.test || (answer !== 'ja' && answer !== 'nein')) return [];
  const out = [];
  for (let n = 1; n <= 100; n++) {
    const yes = c.test(n);
    if ((answer === 'ja' && !yes) || (answer === 'nein' && yes)) out.push(n);
  }
  return out;
}
