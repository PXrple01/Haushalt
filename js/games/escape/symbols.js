// Symbole und Farben für das Escape-Abenteuer. Gut beschreibbar („ein Mond“, „Türkis“).
// Jedes Symbol: d = Grundform (Farbe), d2 = helle Details (optional), s2 = Linie in Grundfarbe (optional). viewBox 0 0 100 100.

const circ = (cx, cy, r) => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
const flower = () => {
  let d = '';
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; d += circ(50 + Math.cos(a) * 25, 52 + Math.sin(a) * 25, 19); }
  return d;
};
const sun = () => {
  let d = circ(50, 50, 24);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const p = (r, da) => `${(50 + Math.cos(a + da) * r).toFixed(1)} ${(50 + Math.sin(a + da) * r).toFixed(1)}`;
    d += ` M${p(30, -.2)} L${p(47, 0)} L${p(30, .2)} Z`;
  }
  return d;
};
const gear = () => {
  let d = '';
  const n = 8;
  for (let i = 0; i < n * 2; i++) {
    const a0 = (i / (n * 2)) * Math.PI * 2, a1 = ((i + 1) / (n * 2)) * Math.PI * 2;
    const r = i % 2 ? 34 : 45;
    d += `${i ? 'L' : 'M'}${(50 + Math.cos(a0) * r).toFixed(1)} ${(50 + Math.sin(a0) * r).toFixed(1)} L${(50 + Math.cos(a1) * r).toFixed(1)} ${(50 + Math.sin(a1) * r).toFixed(1)} `;
  }
  return d + 'Z';
};
const clover = () => circ(36, 36, 17) + circ(64, 36, 17) + circ(36, 64, 17) + circ(64, 64, 17) + ' M47 66 L53 66 L62 96 L56 96 Z';

export const SYMBOLS = {
  stern: { name: 'Stern', d: 'M50 6 L62 37 L96 38 L69 59 L79 92 L50 72 L21 92 L31 59 L4 38 L38 37 Z' },
  mond: { name: 'Mond', d: 'M62 6 A45 45 0 1 0 94 68 A37 37 0 1 1 62 6 Z' },
  herz: { name: 'Herz', d: 'M50 90 L44 84 C20 62 6 49 6 31 C6 18 16 8 29 8 C38 8 46 13 50 20 C54 13 62 8 71 8 C84 8 94 18 94 31 C94 49 80 62 56 84 Z', d2: circ(28, 28, 7) },
  krone: { name: 'Krone', d: 'M10 76 L4 24 L30 46 L50 12 L70 46 L96 24 L90 76 Z M12 82 H88 V94 H12 Z', d2: circ(50, 58, 7) },
  blitz: { name: 'Blitz', d: 'M60 2 L16 56 H46 L36 98 L84 40 H54 Z' },
  tropfen: { name: 'Tropfen', d: 'M50 4 C50 4 16 44 16 64 A34 34 0 0 0 84 64 C84 44 50 4 50 4 Z', d2: circ(36, 66, 8) },
  blatt: { name: 'Blatt', d: 'M88 8 C38 8 10 34 10 64 C10 80 22 92 38 92 C68 92 92 62 88 8 Z', s2: 'M22 86 C40 66 56 50 76 22' },
  flamme: { name: 'Flamme', d: 'M50 2 C60 24 80 34 80 60 A30 30 0 0 1 20 60 C20 44 30 36 34 24 C40 36 44 40 48 42 C48 30 45 16 50 2 Z', d2: 'M50 58 C56 66 62 70 62 78 A12 12 0 0 1 38 78 C38 70 46 66 50 58 Z' },
  diamant: { name: 'Diamant', d: 'M26 10 H74 L96 36 L50 94 L4 36 Z', s2: 'M4 36 H96 M38 10 L30 36 L50 94 M62 10 L70 36 L50 94' },
  muschel: { name: 'Muschel', d: 'M50 8 C18 8 2 40 8 64 L50 94 L92 64 C98 40 82 8 50 8 Z', s2: 'M50 94 L50 14 M50 94 L28 18 M50 94 L72 18 M50 94 L12 44 M50 94 L88 44' },
  note: { name: 'Note', d: `${circ(36, 74, 15)} M46 74 V10 C60 20 78 22 84 42 C74 34 62 32 54 30 V74 Z` },
  schluessel: { name: 'Schlüssel', d: `${circ(28, 50, 22)} M48 44 H96 V56 H96 V70 H86 V56 H80 V66 H70 V56 H48 Z`, d2: circ(28, 50, 9) },
  pilz: { name: 'Pilz', d: 'M6 54 C6 26 26 8 50 8 C74 8 94 26 94 54 Z M34 54 H66 V84 A16 10 0 0 1 34 84 Z', d2: circ(28, 36, 7) + circ(56, 24, 8) + circ(74, 42, 6) },
  blume: { name: 'Blume', d: flower(), d2: circ(50, 52, 13) },
  wolke: { name: 'Wolke', d: 'M22 80 A20 20 0 0 1 20 40 A26 26 0 0 1 68 28 A22 22 0 0 1 84 80 Z' },
  anker: { name: 'Anker', d: `${circ(50, 16, 11)} M44 26 H56 V36 H70 V46 H56 V80 C68 78 76 70 80 60 L72 57 L90 44 L94 66 L88 63 C82 80 68 92 50 92 C32 92 18 80 12 63 L6 66 L10 44 L28 57 L20 60 C24 70 32 78 44 80 V46 H30 V36 H44 Z`, d2: circ(50, 16, 5) },
  planet: { name: 'Planet', d: circ(50, 50, 28), s2: 'M4 60 C-4 44 96 26 96 40 C100 52 8 76 4 60 Z', d2: circ(40, 40, 7) },
  sonne: { name: 'Sonne', d: sun() },
  kleeblatt: { name: 'Kleeblatt', d: clover() },
  glocke: { name: 'Glocke', d: 'M50 6 C30 6 22 26 22 44 V64 L10 78 H90 L78 64 V44 C78 26 70 6 50 6 Z M38 84 A12 12 0 0 0 62 84 Z', d2: 'M34 44 C34 30 40 20 48 18 C42 26 40 36 40 46 Z' },
  bonbon: { name: 'Bonbon', d: `M30 50 L6 30 V70 Z M70 50 L94 30 V70 Z ${circ(50, 50, 24)}`, s2: 'M38 30 L62 70 M50 26 L70 58 M30 42 L48 74' },
  fisch: { name: 'Fisch', d: 'M10 50 C28 22 64 20 80 50 C64 80 28 78 10 50 Z M76 50 L98 28 V72 Z', d2: circ(30, 46, 6) },
  kuerbis: { name: 'Kürbis', d: 'M50 24 C28 18 6 32 6 56 C6 80 28 92 50 88 C72 92 94 80 94 56 C94 32 72 18 50 24 Z M46 24 C46 12 52 4 62 4 V12 C56 12 54 16 56 24 Z', s2: 'M50 28 C38 40 38 76 50 86 M50 28 C62 40 62 76 50 86' },
  geist: { name: 'Geist', d: 'M18 92 V44 A32 32 0 0 1 82 44 V92 L71 82 L61 92 L50 82 L39 92 L29 82 Z', d2: circ(38, 46, 7) + circ(62, 46, 7) },
  rakete: { name: 'Rakete', d: 'M50 4 C68 18 72 42 68 68 H32 C28 42 32 18 50 4 Z M32 50 L14 74 L32 72 Z M68 50 L86 74 L68 72 Z M40 72 H60 L56 90 H44 Z', d2: circ(50, 36, 9) },
  zahnrad: { name: 'Zahnrad', d: gear(), d2: circ(50, 50, 13) },
  katze: { name: 'Katze', d: 'M16 32 L22 6 L42 22 C46 21 54 21 58 22 L78 6 L84 32 C90 42 92 54 88 66 C82 84 66 94 50 94 C34 94 18 84 12 66 C8 54 10 42 16 32 Z', d2: 'M30 56 C34 50 40 50 44 56 C40 60 34 60 30 56 Z M56 56 C60 50 66 50 70 56 C66 60 60 60 56 56 Z' },
  perle: { name: 'Perle', d: circ(50, 52, 38), d2: circ(36, 38, 10) },
  muenze: { name: 'Münze', d: circ(50, 50, 42), s2: circ(50, 50, 30), d2: 'M44 34 H56 V66 H44 Z' },
  flasche: { name: 'Flasche', d: 'M40 4 H60 V26 C74 32 80 44 80 58 V86 A8 8 0 0 1 72 94 H28 A8 8 0 0 1 20 86 V58 C20 44 26 32 40 26 Z', d2: 'M30 60 H70 V78 H30 Z' },
};

export const COLORS = {
  rosa: { name: 'Rosa', hex: '#FF6FB1' },
  blau: { name: 'Blau', hex: '#3FA7FF' },
  gold: { name: 'Gold', hex: '#FFC21A' },
  gruen: { name: 'Grün', hex: '#2FCB86' },
  lila: { name: 'Lila', hex: '#9B6BFF' },
  weiss: { name: 'Weiß', hex: '#FFFFFF' },
  orange: { name: 'Orange', hex: '#FF8A3D' },
  tuerkis: { name: 'Türkis', hex: '#22D3C5' },
  rot: { name: 'Rot', hex: '#FF4F5E' },
};

export const symName = (id) => SYMBOLS[id]?.name || id;
export const colName = (id) => COLORS[id]?.name || id;

// SVG für ein Symbol in einer Farbe
export function symbol(id, color = 'currentColor', cls = '') {
  const s = SYMBOLS[id];
  if (!s) return '';
  const fill = COLORS[color]?.hex || color;
  const dark = fill === '#FFFFFF' ? ' stroke="#5E2350" stroke-width="4" paint-order="stroke"' : '';
  return `<svg class="sym ${cls}" viewBox="-4 -4 108 108" aria-hidden="true"><path d="${s.d}" fill="${fill}" fill-rule="evenodd"${dark}/>`
    + (s.s2 ? `<path d="${s.s2}" fill="none" stroke="${fill === '#FFFFFF' ? '#5E2350' : 'rgba(0,0,0,.28)'}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` : '')
    + (s.d2 ? `<path d="${s.d2}" fill="${fill === '#FFFFFF' ? '#FFC2E0' : 'rgba(255,255,255,.85)'}"/>` : '')
    + '</svg>';
}
