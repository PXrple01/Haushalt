// Figuren für „Herzchen versenken“ – waagerecht gezeichnet (viewBox Länge×100 × 100), senkrecht werden sie gedreht.
const PL = '#5E2350';

const ART = {
  einhorn: `
    <g class="pa-tail">
      <circle cx="44" cy="46" r="15" fill="#FFA6D2" stroke="#F07DB9" stroke-width="3"/>
      <circle cx="30" cy="62" r="12" fill="#C9B2FF" stroke="#A88BF0" stroke-width="3"/>
      <circle cx="26" cy="38" r="10" fill="#9FDCFF" stroke="#72C2F0" stroke-width="3"/>
      <circle cx="40" cy="76" r="9" fill="#A8F0D0" stroke="#74D9AE" stroke-width="3"/>
    </g>
    <g class="pa-legs" fill="#fff" stroke="${PL}" stroke-width="3">
      <rect x="96" y="70" width="22" height="22" rx="10"/><rect x="146" y="72" width="22" height="20" rx="10"/>
      <rect x="226" y="72" width="22" height="20" rx="10"/><rect x="272" y="70" width="22" height="22" rx="10"/>
    </g>
    <path d="M98 84h18v2a7 7 0 0 1-7 7h-4a7 7 0 0 1-7-7zM274 84h18v2a7 7 0 0 1-7 7h-4a7 7 0 0 1-7-7z" fill="#FFB8DB"/>
    <ellipse cx="192" cy="60" rx="132" ry="29" fill="#fff" stroke="${PL}" stroke-width="3"/>
    <ellipse cx="200" cy="72" rx="96" ry="11" fill="#F3EAFF" opacity=".9"/>
    <path d="M150 58 l-6 -6 a4 4 0 0 1 6 -5 a4 4 0 0 1 6 5 z M206 50 l-5 -5 a3.4 3.4 0 0 1 5 -4.2 a3.4 3.4 0 0 1 5 4.2 z M238 62 l-5 -5 a3.4 3.4 0 0 1 5 -4.2 a3.4 3.4 0 0 1 5 4.2 z" fill="#FF9DCB"/>
    <path d="M118 52 l2 -6 2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 z M182 66 l1.6 -4.6 1.6 4.6 4.6 1.6 -4.6 1.6 -1.6 4.6 -1.6 -4.6 -4.6 -1.6 z" fill="#C9B2FF"/>
    <g class="pa-mane">
      <circle cx="292" cy="34" r="13" fill="#FFA6D2" stroke="#F07DB9" stroke-width="3"/>
      <circle cx="281" cy="50" r="11" fill="#C9B2FF" stroke="#A88BF0" stroke-width="3"/>
      <circle cx="276" cy="66" r="9" fill="#9FDCFF" stroke="#72C2F0" stroke-width="3"/>
    </g>
    <path d="M314 22 L322 2 L336 22 Z" fill="#fff" stroke="${PL}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M318 18 L322 8 L329 18 Z" fill="#FFC2E0"/>
    <circle cx="334" cy="46" r="32" fill="#fff" stroke="${PL}" stroke-width="3"/>
    <ellipse cx="364" cy="56" rx="24" ry="17" fill="#FFF0F7" stroke="${PL}" stroke-width="3"/>
    <circle cx="372" cy="52" r="2.6" fill="#E879B5"/><circle cx="366" cy="60" r="2.2" fill="#E879B5"/>
    <path class="pa-horn" d="M330 16 L352 -6 L346 20 Z" fill="#FFD966" stroke="${PL}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M336 12 L345 9 M340 5 L347 3" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
    <path class="pa-eye" d="M326 44 Q333 37 340 44" fill="none" stroke="#3A1030" stroke-width="3.6" stroke-linecap="round"/>
    <ellipse cx="346" cy="58" rx="7" ry="4" fill="#FF8CC6" opacity=".6"/>`,
  wolke: `
    <defs><linearGradient id="pw-g" x1="0" y1="0" x2="0" y2="1"><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#E9DDFF"/></linearGradient></defs>
    <path d="M52 86 A30 30 0 0 1 46 30 A40 40 0 0 1 120 14 A44 44 0 0 1 202 22 A34 34 0 0 1 262 46 A26 26 0 0 1 250 86 Z" fill="url(#pw-g)" stroke="#B79CFF" stroke-width="3.5" stroke-linejoin="round"/>
    <ellipse class="pa-eye" cx="128" cy="56" rx="5" ry="6.5" fill="#5E2350"/><ellipse class="pa-eye" cx="172" cy="56" rx="5" ry="6.5" fill="#5E2350"/>
    <circle cx="130" cy="53" r="1.8" fill="#fff"/><circle cx="174" cy="53" r="1.8" fill="#fff"/>
    <path d="M141 66 Q150 74 159 66" fill="none" stroke="#5E2350" stroke-width="3.4" stroke-linecap="round"/>
    <ellipse cx="112" cy="68" rx="9" ry="5" fill="#FF9DCB" opacity=".7"/><ellipse cx="188" cy="68" rx="9" ry="5" fill="#FF9DCB" opacity=".7"/>`,
  katze: `
    <path class="pa-tail" d="M54 74 C20 74 14 40 34 32" fill="none" stroke="${PL}" stroke-width="16" stroke-linecap="round"/>
    <path class="pa-tail" d="M54 74 C20 74 14 40 34 32" fill="none" stroke="#C9B8F0" stroke-width="10" stroke-linecap="round"/>
    <ellipse cx="140" cy="62" rx="98" ry="29" fill="#C9B8F0" stroke="${PL}" stroke-width="3"/>
    <path d="M96 40 q6 10 0 18 M124 36 q6 12 0 22 M152 38 q6 10 0 20" fill="none" stroke="#9D86DC" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="150" cy="80" rx="60" ry="9" fill="#E6DCFF" opacity=".9"/>
    <path d="M222 30 L226 2 L246 20 Z M268 20 L286 2 L290 30 Z" fill="#C9B8F0" stroke="${PL}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M228 22 L230 10 L239 18 Z M275 18 L283 10 L284 22 Z" fill="#FFB8DB"/>
    <ellipse cx="256" cy="50" rx="38" ry="32" fill="#C9B8F0" stroke="${PL}" stroke-width="3"/>
    <path class="pa-eye" d="M236 48 Q242 42 248 48 M264 48 Q270 42 276 48" fill="none" stroke="#3A1030" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M252 58 L260 58 L256 63 Z" fill="#FF6FB5"/>
    <path d="M249 66 Q252.5 70 256 66 Q259.5 70 263 66" fill="none" stroke="#3A1030" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M226 60 L206 56 M226 66 L208 70 M286 60 L300 56 M286 66 L298 70" stroke="#7B6AB0" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="236" cy="62" rx="6" ry="3.6" fill="#FF8CC6" opacity=".6"/><ellipse cx="276" cy="62" rx="6" ry="3.6" fill="#FF8CC6" opacity=".6"/>`,
  herz: `
    <path d="M62 88 L56 82 C30 60 16 48 16 32 C16 20 26 12 37 12 C45 12 52 16 56 22 C60 16 67 12 75 12 C86 12 96 20 96 32 C96 48 82 60 62 82 Z" fill="#FF6FB1" stroke="#C72A78" stroke-width="3"/>
    <path d="M142 90 L136 84 C110 62 96 50 96 34 C96 22 106 14 117 14 C125 14 132 18 136 24 C140 18 147 14 155 14 C166 14 176 22 176 34 C176 50 162 62 142 84 Z" fill="#B79CFF" stroke="#7B4FD6" stroke-width="3"/>
    <ellipse cx="38" cy="28" rx="10" ry="6" fill="#fff" opacity=".7" transform="rotate(-30 38 28)"/>
    <ellipse cx="118" cy="30" rx="10" ry="6" fill="#fff" opacity=".7" transform="rotate(-30 118 30)"/>
    <path class="pa-crack" d="M62 22 L56 40 L66 52 L58 70" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0"/>`,
  stern: `
    <defs><linearGradient id="ps-g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#C9B2FF" stop-opacity="0"/><stop offset=".6" stop-color="#FFB3D9"/><stop offset="1" stop-color="#FFE27A"/></linearGradient></defs>
    <path class="pa-trail" d="M8 46 Q70 30 128 42 L128 58 Q70 70 8 54 Z" fill="url(#ps-g)" opacity=".95"/>
    <path d="M30 40 Q80 34 120 44 M36 60 Q84 66 120 56" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>
    <path d="M156 8 L167 33 L194 35 L173 52 L180 79 L156 64 L132 79 L139 52 L118 35 L145 33 Z" fill="#FFD966" stroke="#E9A21F" stroke-width="3.4" stroke-linejoin="round"/>
    <path class="pa-eye" d="M147 44 Q151 40 155 44 M159 44 Q163 40 167 44" fill="none" stroke="#5A3B00" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M151 52 Q156 57 161 52" fill="none" stroke="#5A3B00" stroke-width="2.6" stroke-linecap="round"/>
    <ellipse cx="143" cy="52" rx="4.5" ry="2.8" fill="#FF8CC6" opacity=".7"/><ellipse cx="169" cy="52" rx="4.5" ry="2.8" fill="#FF8CC6" opacity=".7"/>`,
};

// ---------- Kurvige Figuren (Grundausrichtung, 100 Einheiten pro Feld) ----------
const RAINBOW = ['#FF6B8B', '#FFA45C', '#FFD54D', '#7BE08F', '#5CC8FF', '#9B7BFF'];
const arch = (d) => {
  const L = 50 - d, T = 50 - d, R = 250 + d, r = 34 + d;
  return `M${L} 198 V${T + r} Q${L} ${T} ${L + r} ${T} H${R - r} Q${R} ${T} ${R} ${T + r} V198`;
};
// Bogen: Felder (0,0) (1,0) (2,0) und darunter (0,1) (2,1)
ART.regenbogen = `
  <g fill="none" stroke-linecap="butt" stroke-linejoin="round">
    ${RAINBOW.map((c, i) => `<path d="${arch(30 - i * 12)}" stroke="${c}" stroke-width="12.5"/>`).join('')}
  </g>
  <path d="${arch(37)}" fill="none" stroke="#fff" stroke-width="2.5" opacity=".7"/>
  <g class="pa-cloud">
    <path d="M14 196 A16 16 0 0 1 16 166 A22 22 0 0 1 56 156 A20 20 0 0 1 90 172 A14 14 0 0 1 86 196 Z" fill="#fff" stroke="#C9B2FF" stroke-width="3" stroke-linejoin="round"/>
    <path d="M214 196 A16 16 0 0 1 216 166 A22 22 0 0 1 256 156 A20 20 0 0 1 290 172 A14 14 0 0 1 286 196 Z" fill="#fff" stroke="#C9B2FF" stroke-width="3" stroke-linejoin="round"/>
  </g>
  <path class="pa-eye" d="M40 178 Q45 173 50 178 M60 178 Q65 173 70 178" fill="none" stroke="${PL}" stroke-width="3" stroke-linecap="round"/>
  <path d="M50 186 Q55 190 60 186" fill="none" stroke="${PL}" stroke-width="2.6" stroke-linecap="round"/>
  <ellipse cx="34" cy="186" rx="5" ry="3" fill="#FF9DCB" opacity=".7"/><ellipse cx="76" cy="186" rx="5" ry="3" fill="#FF9DCB" opacity=".7"/>
  <path class="pa-spark" d="M150 26 l3 -8 3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 z M112 66 l2 -5 2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 z M190 70 l2 -5 2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 z" fill="#fff"/>`;

// S-Kurve: Felder (0,0) (1,0) (1,1) (2,1) – Schwanz links oben, Kopf rechts unten
const SNAKE = 'M12 50 H108 Q150 50 150 92 V108 Q150 150 192 150 H232';
ART.schlange = `
  <path d="M14 50 L-2 30 L6 50 L-2 70 Z" fill="#2FB39C" stroke="#1E6F62" stroke-width="3" stroke-linejoin="round"/>
  <path d="${SNAKE}" fill="none" stroke="#1E6F62" stroke-width="58" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${SNAKE}" fill="none" stroke="#3FD0B4" stroke-width="50" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${SNAKE}" fill="none" stroke="#B7F5E6" stroke-width="16" stroke-linecap="round" stroke-dasharray="3 15" opacity=".95"/>
  <path d="M60 24 l8 -12 8 12 M100 24 l8 -12 8 12 M178 124 l8 -12 8 12" fill="#FF9DCB" stroke="#E86FA8" stroke-width="2.5" stroke-linejoin="round"/>
  <ellipse cx="256" cy="150" rx="42" ry="36" fill="#3FD0B4" stroke="#1E6F62" stroke-width="4"/>
  <path d="M236 118 L230 100 L248 112 Z M264 114 L270 96 L278 116 Z" fill="#FFD54D" stroke="#C9971A" stroke-width="2.5" stroke-linejoin="round"/>
  <ellipse cx="282" cy="160" rx="16" ry="12" fill="#B7F5E6"/>
  <circle cx="286" cy="157" r="2.4" fill="#1E6F62"/>
  <path class="pa-eye" d="M244 144 Q251 136 258 144 M262 144 Q269 136 276 144" fill="none" stroke="#163C36" stroke-width="3.6" stroke-linecap="round"/>
  <path d="M262 168 Q270 175 278 168" fill="none" stroke="#163C36" stroke-width="3" stroke-linecap="round"/>
  <ellipse cx="240" cy="160" rx="7" ry="4" fill="#FF8CC6" opacity=".65"/>`;

// L-Form: Felder (0,0) (1,0) (2,0) (2,1) – Kopf links, Schwanz unten rechts
const RAUPE_SEG = [[96, 52], [142, 50], [188, 52], [232, 60], [252, 100], [252, 146]];
ART.raupe = `
  <g stroke="${PL}" stroke-width="3" stroke-linecap="round">
    ${RAUPE_SEG.slice(0, 4).map(([x, y]) => `<path d="M${x - 8} ${y + 26} l-4 12 M${x + 8} ${y + 26} l4 12"/>`).join('')}
  </g>
  ${RAUPE_SEG.slice().reverse().map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === 0 ? 26 : 31}" fill="${i % 2 ? '#8EE06A' : '#B6F07E'}" stroke="#4E9B35" stroke-width="3.5"/>`).join('')}
  ${RAUPE_SEG.map(([x, y], i) => `<circle cx="${x - 6}" cy="${y - 10}" r="5" fill="${i % 2 ? '#FFB3D9' : '#FFE27A'}"/>`).join('')}
  <path d="M30 22 Q20 4 8 6 M52 20 Q58 2 72 4" fill="none" stroke="${PL}" stroke-width="3.5" stroke-linecap="round"/>
  <circle cx="8" cy="6" r="6" fill="#FF6FB1"/><circle cx="72" cy="4" r="6" fill="#FF6FB1"/>
  <circle cx="44" cy="54" r="38" fill="#B6F07E" stroke="#4E9B35" stroke-width="4"/>
  <path class="pa-eye" d="M26 50 Q32 43 38 50 M50 50 Q56 43 62 50" fill="none" stroke="#2D4A1C" stroke-width="3.6" stroke-linecap="round"/>
  <path d="M34 64 Q44 74 54 64" fill="none" stroke="#2D4A1C" stroke-width="3.2" stroke-linecap="round"/>
  <ellipse cx="22" cy="64" rx="6" ry="4" fill="#FF8CC6" opacity=".7"/><ellipse cx="66" cy="64" rx="6" ry="4" fill="#FF8CC6" opacity=".7"/>`;

const DIMS = { einhorn: [4, 1], wolke: [3, 1], katze: [3, 1], herz: [2, 1], stern: [2, 1], regenbogen: [3, 2], schlange: [3, 2], raupe: [3, 2] };

export function pieceSVG(id) {
  const [bw, bh] = DIMS[id] || [1, 1];
  const w = bw * 100;
  const vb = bh === 1 ? `0 -8 ${w} 108` : `0 0 ${w} ${bh * 100}`;
  return `<svg class="pa pa-${id}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${ART[id]}</svg>`;
}
