// Das Puzzle-Herz: linke Hälfte (Josefine, pink) mit Knubbel, rechte Hälfte (Johann, lila) mit passender Mulde.
// Beide Hälften teilen sich exakt dieselbe Trennlinie → sie greifen perfekt ineinander.
// Koordinatensystem: viewBox 0 0 240 220, Mitte x = 120.

const LEFT_OUTLINE = 'M120 58 C108 30 82 16 58 20 C30 25 14 50 15 80 C16 118 52 150 120 206';
const RIGHT_OUTLINE = 'M120 58 C132 30 158 16 182 20 C210 25 226 50 225 80 C224 118 188 150 120 206';
// Von der Spitze nach oben, mit rundem Knubbel nach rechts
const SPLIT_UP = 'L120 150 C120 143 127 141 127 134 A14 14 0 1 0 127 118 C127 111 120 109 120 102 L120 58';

export const HEART = {
  view: '0 0 240 220',
  left: `${LEFT_OUTLINE} ${SPLIT_UP} Z`,
  right: `${RIGHT_OUTLINE} ${SPLIT_UP} Z`,
  seam: `M120 206 ${SPLIT_UP}`,
  outline: `${LEFT_OUTLINE} M120 58 ${RIGHT_OUTLINE.slice(8)}`,
};

// Farbverläufe + Deko für die großen Hälften (Personenauswahl)
export function heartDefs(id = 'h') {
  return `
  <defs>
    <linearGradient id="${id}-jos" x1="0" y1="0" x2=".9" y2="1">
      <stop offset="0" stop-color="#FFB3D9"/>
      <stop offset=".45" stop-color="#FF6FB1"/>
      <stop offset="1" stop-color="#E23C8C"/>
    </linearGradient>
    <linearGradient id="${id}-joh" x1="1" y1="0" x2=".1" y2="1">
      <stop offset="0" stop-color="#B996FF"/>
      <stop offset=".5" stop-color="#8253FF"/>
      <stop offset="1" stop-color="#4E22C9"/>
    </linearGradient>
    <linearGradient id="${id}-rim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7DF3FF"/>
      <stop offset="1" stop-color="#47E5FF" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="${id}-gloss" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#fff" stop-opacity=".95"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <pattern id="${id}-dots" width="7" height="7" patternUnits="userSpaceOnUse">
      <circle cx="3.5" cy="3.5" r="1.25" fill="#fff" fill-opacity=".16"/>
    </pattern>
    <pattern id="${id}-polka" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
      <circle cx="4" cy="4" r="2.2" fill="#fff" fill-opacity=".28"/>
      <circle cx="12" cy="12" r="1.5" fill="#fff" fill-opacity=".2"/>
    </pattern>
    <clipPath id="${id}-cl"><path d="${HEART.left}"/></clipPath>
    <clipPath id="${id}-cr"><path d="${HEART.right}"/></clipPath>
  </defs>`;
}

// Inhalt der linken (pinken) Hälfte
export function halfJos(id = 'h') {
  return `
    <path class="hf-base" d="${HEART.left}" fill="url(#${id}-jos)"/>
    <g clip-path="url(#${id}-cl)">
      <rect x="0" y="0" width="160" height="220" fill="url(#${id}-polka)"/>
      <ellipse cx="62" cy="50" rx="27" ry="14" fill="url(#${id}-gloss)" transform="rotate(-32 62 50)" opacity=".9"/>
      <path d="M30 120 C46 150 80 178 120 206 L120 230 L0 230 Z" fill="#B8226C" opacity=".22"/>
    </g>
    <path d="${HEART.left}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2.5"/>
    <path d="M86 70 l3 -9 l3 9 l9 3 l-9 3 l-3 9 l-3 -9 l-9 -3 z" fill="#fff" opacity=".95"/>`;
}

// Inhalt der rechten (lila) Hälfte
export function halfJoh(id = 'h') {
  return `
    <path class="hf-base" d="${HEART.right}" fill="url(#${id}-joh)"/>
    <g clip-path="url(#${id}-cr)">
      <rect x="80" y="0" width="160" height="220" fill="url(#${id}-dots)"/>
      <ellipse cx="176" cy="48" rx="24" ry="11" fill="url(#${id}-gloss)" transform="rotate(30 176 48)" opacity=".55"/>
      <path d="M225 80 C224 118 188 150 120 206" fill="none" stroke="url(#${id}-rim)" stroke-width="7" opacity=".85"/>
    </g>
    <path d="${HEART.right}" fill="none" stroke="#D9C4FF" stroke-opacity=".7" stroke-width="2"/>
    <path d="M196 92 l2.2 -7 l2.2 7 l7 2.2 l-7 2.2 l-2.2 7 l-2.2 -7 l-7 -2.2 z" fill="#7DF3FF"/>`;
}

// Kleine Herzhälfte für den Personen-Chip
export function miniHalf(p) {
  const left = p === 'jos';
  return `<svg viewBox="${left ? '0 0 160 220' : '80 0 160 220'}" aria-hidden="true">
    <path d="${left ? HEART.left : HEART.right}" fill="${left ? '#FF5FA8' : '#8B5CFF'}"/></svg>`;
}

// Ganzes kleines Herz (beide Hälften, z. B. Logo, Bilanz)
export function fullHeart(cls = '') {
  return `<svg class="${cls}" viewBox="${HEART.view}" aria-hidden="true">
    <path d="${HEART.left}" fill="#FF5FA8"/><path d="${HEART.right}" fill="#8B5CFF"/></svg>`;
}

// Logo: Herz, das aus einer kleinen Kiste hüpft + Schriftzug
export function logo() {
  return `<span class="logo" aria-label="Kicherkiste">
    <svg class="logo-mark" viewBox="0 0 64 64" aria-hidden="true">
      <g transform="translate(9 1) scale(.19)">
        <path d="${HEART.left}" fill="#FF5FA8"/><path d="${HEART.right}" fill="#8B5CFF"/>
      </g>
      <path class="logo-lid" d="M8 37.5h48l-2.5 7h-43z"/>
      <path class="logo-box" d="M11.5 44.5h41l-2.6 15.2a3 3 0 0 1-3 2.3H17.1a3 3 0 0 1-3-2.3z"/>
    </svg>
    <span class="logo-word" aria-hidden="true">Kicherkiste</span>
  </span>`;
}
