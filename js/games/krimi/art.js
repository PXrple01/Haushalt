// Krimi – Grafiken: Noir-Porträts, Spuren-Symbole, Hotel-Grundriss, Fingerabdrücke, Blutspritzer, Hotel im Sturm, Uhr.
import { makeRng } from '../escape/rng.js';

let uidN = 0;
const uid = (p) => `${p}${++uidN}`;

// =====================================================================
// Porträts (viewBox 0 0 100 120)
// =====================================================================
const LOOK = {
  wendt: { skin: '#d8b49b', cloth: '#5a5634', hair: '#c9c6c0', bg: '#3b2f25' },
  marie: { skin: '#e9c4a7', cloth: '#f2efe8', hair: '#24160f', bg: '#3a1f22' },
  viktoria: { skin: '#f0cfb8', cloth: '#6b0f2a', hair: '#d9b46a', bg: '#36202a' },
  novak: { skin: '#d4ab8e', cloth: '#23272f', hair: '#16161a', bg: '#232a33' },
  lukas: { skin: '#c88f69', cloth: '#b3261e', hair: '#6b4a2b', bg: '#2b2a33' },
  greta: { skin: '#e2c0a9', cloth: '#1d1b1c', hair: '#a7a4a0', bg: '#2e2a26' },
  sophie: { skin: '#f1d1bc', cloth: '#c9952c', hair: '#e4c57d', bg: '#2a2833' },
  emil: { skin: '#d7af95', cloth: '#23412f', hair: '#7b6a5b', bg: '#2a3029' },
  konrad: { skin: '#cdb8ab', cloth: '#1d2027', hair: '#9b9893', bg: '#2a1414' },
  brandl: { skin: '#e2b49a', cloth: '#2b2f3a', hair: '#d9d6d0', bg: '#2a2418' },
  haslinger: { skin: '#d9b39a', cloth: '#3d4a3a', hair: '#8f8f8f', bg: '#20262a' },
  gerda: { skin: '#ecc8b0', cloth: '#6b3a5a', hair: '#b9a07a', bg: '#2a1e26' },
  tobias: { skin: '#d6b09a', cloth: '#16181c', hair: '#2a1d16', bg: '#1a1416' },
  anton: { skin: '#d8b49b', cloth: '#3a2f26', hair: '#4a3a2c', bg: '#2a221a' },
  marianne: { skin: '#f0cdb6', cloth: '#7a2a2a', hair: '#5a3a24', bg: '#2a1c1a' },
};

function face(L, o = {}) {
  const sk = L.skin;
  return `
    <path d="M42 70h16v20H42z" fill="${sk}"/><path d="M42 78c5 4 11 4 16 0v6H42z" fill="#000" opacity=".22"/>
    <ellipse cx="32.5" cy="55" rx="3.2" ry="5" fill="${sk}"/><ellipse cx="67.5" cy="55" rx="3.2" ry="5" fill="${sk}"/>
    <ellipse cx="50" cy="52" rx="${o.rx || 18}" ry="${o.ry || 22.5}" fill="${sk}"/>
    <path d="M43 50.2q-3-2-6 0M57 50.2q3-2 6 0" stroke="#3a2a22" stroke-width="${o.brow || 1.5}" fill="none" stroke-linecap="round"/>
    <ellipse cx="43" cy="54" rx="2.1" ry="${o.eyes || 1.5}" fill="#1b1212"/><ellipse cx="57" cy="54" rx="2.1" ry="${o.eyes || 1.5}" fill="#1b1212"/>
    <path d="M50.5 55.5l-2.4 7.5 3.4.8" stroke="#000" stroke-opacity=".28" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    <path d="${o.mouth || 'M45 68.5q5 1.6 10 0'}" stroke="${o.lip || '#7a3b33'}" stroke-width="${o.lipw || 1.6}" fill="none" stroke-linecap="round"/>`;
}
const SHOULDERS = 'M6 120C8 98 28 88 50 88s42 10 44 32z';

const PARTS = {
  wendt: (L) => `
    <path d="${SHOULDERS}" fill="${L.cloth}"/>
    <path d="M14 108l12-14M22 116l14-18M66 98l12 14M74 96l14 18" stroke="#8b8456" stroke-width="1" opacity=".55"/>
    <path d="M40 88l10 12 10-12" fill="#ece6da"/><path d="M48 92h4l1.5 26h-7z" fill="#5d1a1a"/>
    <path d="M36 89l14 17-7 14H28zM64 89L50 106l7 14h15z" fill="#4c4a2c"/>
    ${face(L, { mouth: 'M45 69q5 .6 10 0' })}
    <path d="M32 46c0-14 8-20 18-20s18 6 18 18c-2-6-6-9-9-9-8 0-17 2-27 11z" fill="${L.hair}"/>
    <path d="M43 64.5c2.5-2 11.5-2 14 0-2 2.6-12 2.6-14 0z" fill="#b9b5ad"/>
    <g fill="none" stroke="#c9a24d" stroke-width="1.4"><circle cx="43" cy="54" r="5"/><circle cx="57" cy="54" r="5"/><path d="M48 54h4M38 53l-5-2M62 53l5-2"/></g>`,
  marie: (L) => `
    <path d="${SHOULDERS}" fill="${L.cloth}"/>
    <path d="M40 88l10 10 10-10" fill="#fff" stroke="#d8d2c4"/>
    <path d="M24 104c4-3 8 1 6 5s-9 2-6-5zM60 112c5-5 12 0 9 4s-11 3-9-4zM70 100c2-2 5 0 4 2s-5 1-4-2zM38 116c3-2 6 1 4 3s-6 1-4-3z" fill="#8a0f14"/>
    ${face(L, { mouth: 'M45.5 69q4.5-1.4 9 0', lip: '#8d4a45' })}
    <path d="M41.5 57.5c.5 3 .2 5-.6 7" stroke="#9ab" stroke-width=".9" fill="none" opacity=".8"/>
    <g fill="${L.hair}"><circle cx="34" cy="40" r="9"/><circle cx="44" cy="31" r="10"/><circle cx="57" cy="31" r="10"/><circle cx="66" cy="40" r="9"/><circle cx="30" cy="52" r="7"/><circle cx="70" cy="52" r="7"/><circle cx="29" cy="64" r="6.5"/><circle cx="71" cy="64" r="6.5"/><circle cx="31" cy="76" r="6"/><circle cx="69" cy="76" r="6"/></g>
    <path d="M36 42c5-6 22-8 28 0-6-3-20-3-28 0z" fill="${L.hair}"/>`,
  viktoria: (L) => `
    <path d="${SHOULDERS}" fill="${L.cloth}"/>
    <path d="M34 89l16 26 16-26" fill="none" stroke="#9e2446" stroke-width="5"/>
    <path d="M42 89l8 12 8-12" fill="${L.skin}"/>
    ${face(L, { mouth: 'M45 68.5q5 1.8 10 0', lip: '#b3121b', lipw: 2.4, eyes: 1.3 })}
    <path d="M38.5 52.5l-2-1M61.5 52.5l2-1" stroke="#1b1212" stroke-width="1"/>
    <path d="M32 50c-2-16 6-24 18-24s20 8 18 24c-3-9-9-14-18-14s-15 5-18 14z" fill="${L.hair}"/>
    <ellipse cx="50" cy="24" rx="10" ry="8" fill="${L.hair}"/><path d="M44 22q6-4 12 0" stroke="#b8933f" fill="none"/>
    <circle cx="32" cy="62" r="2.2" fill="#f4f1ea"/><circle cx="68" cy="62" r="2.2" fill="#f4f1ea"/>`,
  novak: (L) => `
    <path d="${SHOULDERS}" fill="${L.cloth}"/>
    <path d="M40 88l10 12 10-12" fill="#f1f1f1"/><path d="M48 92h4l2 26h-8z" fill="#3d5a80"/>
    <path d="M36 89l14 17-6 14H26zM64 89L50 106l6 14h18z" fill="#1a1d23"/>
    ${face(L, { mouth: 'M45 68.5h10', lip: '#6e3a32', rx: 17.5 })}
    <g fill="#000" opacity=".16"><path d="M36 60c3 12 9 16 14 16s11-4 14-16c-2 9-7 13-14 13s-12-4-14-13z"/></g>
    <path d="M32 50c-1-16 7-23 18-23s19 6 18 21c-4-8-11-12-20-12-6 0-12 4-16 14z" fill="${L.hair}"/>
    <path d="M40 34c8-4 18-4 26 4" stroke="#3a3a44" stroke-width="1" fill="none"/>`,
  lukas: (L) => `
    <path d="${SHOULDERS}" fill="${L.cloth}"/>
    <path d="M38 88c4 6 20 6 24 0l2 8c-6 6-22 6-28 0z" fill="#8f1d17"/><path d="M50 96v24" stroke="#e6e6e6" stroke-width="1.6"/>
    <path d="M18 104h12M70 104h12" stroke="#fff" stroke-width="2" opacity=".5"/>
    ${face(L, { mouth: 'M45 68q5 2.4 10 0', lip: '#6e3a32' })}
    <path d="M31 50c-3-12 2-22 12-24 2-4 10-4 13 0 9 0 14 8 13 20-3-7-8-6-9-12-4 5-10 5-13 1-4 6-10 6-16 15z" fill="${L.hair}"/>
    <path d="M30 41c6-4 34-4 40 0v6c-6-4-34-4-40 0z" fill="#222"/><rect x="38" y="38" width="24" height="9" rx="4.5" fill="#f2a33a" stroke="#222" stroke-width="1.2"/>`,
  greta: (L) => `
    <path d="${SHOULDERS}" fill="${L.cloth}"/>
    <path d="M38 88q12 10 24 0l3 5q-15 11-30 0z" fill="#f4f1ea"/>
    <path d="M50 96v9M47 99h6" stroke="#c9a24d" stroke-width="1.6"/>
    ${face(L, { mouth: 'M45.5 69.5q4.5-1 9 0', lip: '#7a4a44', rx: 17.6 })}
    <path d="M40 60q3 1.5 6 0M54 60q3 1.5 6 0M44 46l-3 1M56 46l3 1" stroke="#000" stroke-opacity=".2" fill="none"/>
    <path d="M32 50c-2-15 6-22 18-22s20 7 18 22c-2-8-8-13-18-13s-16 5-18 13z" fill="${L.hair}"/>
    <circle cx="50" cy="24" r="8" fill="${L.hair}"/><path d="M44 24q6-5 12 0" stroke="#8a8783" fill="none"/>`,
  sophie: (L) => `
    <path d="${SHOULDERS}" fill="#2e3a46"/>
    <path d="M30 92c8 8 32 8 40 0 4 4 4 10 0 13-8 6-32 6-40 0-4-3-4-9 0-13z" fill="${L.cloth}"/><path d="M58 100l6 20h-9z" fill="#b3841f"/>
    <path d="M22 118L70 90" stroke="#111" stroke-width="2.4"/>
    ${face(L, { mouth: 'M45.5 68.8q4.5 1 9 0', lip: '#a3504a' })}
    <path d="M31 66c-3-22 4-38 19-38s22 16 19 38c-3-2-4-8-4-14-4-6-10-9-15-9 1 4-6 8-13 9-1 6-2 12-6 14z" fill="${L.hair}"/>`,
  emil: (L) => `
    <path d="${SHOULDERS}" fill="#f2f0ea"/>
    <path d="M26 92c6-3 14-4 18-2l-2 30H14c2-14 6-24 12-28zM74 92c-6-3-14-4-18-2l2 30h28c-2-14-6-24-12-28z" fill="${L.cloth}"/>
    <circle cx="40" cy="106" r="1.6" fill="#c9a24d"/><circle cx="40" cy="114" r="1.6" fill="#c9a24d"/><circle cx="60" cy="106" r="1.6" fill="#c9a24d"/><circle cx="60" cy="114" r="1.6" fill="#c9a24d"/>
    <path d="M42 90l8 4 8-4v7l-8-4-8 4z" fill="#111"/>
    ${face(L, { mouth: 'M45.5 69.5q4.5-1 9 0', lip: '#6e3a32', ry: 22 })}
    <path d="M32 54c-2-8 1-13 4-15 1 6 0 10-1 15zM68 54c2-8-1-13-4-15-1 6 0 10 1 15z" fill="${L.hair}"/>
    <path d="M36 36c4-6 24-6 28 0" stroke="${L.hair}" stroke-width="1.4" fill="none" opacity=".6"/>
    <path d="M42.5 64.5c3-2.4 12-2.4 15 0-2 1.5-5 1.6-7.5.4-2.5 1.2-5.5 1.1-7.5-.4z" fill="#5d4c3f"/>`,
  brandl: (L) => `
    <path d="${SHOULDERS}" fill="${L.cloth}"/>
    <path d="M40 88l10 12 10-12" fill="#f1f1f1"/><path d="M47 92h6l1 22h-8z" fill="#8a6a1a"/>
    ${face(L, { mouth: 'M44 70q6-2 12 0', lip: '#7a3b33', rx: 19.5, ry: 23 })}
    <path d="M34 66q16 20 32 0q-2 14-16 16q-14-2-16-16z" fill="#000" opacity=".12"/>
    <path d="M33 48c-1-6 1-10 3-12M67 48c1-6-1-10-3-12" stroke="${L.hair}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M38 98q12 8 24 0" stroke="#d8b04a" stroke-width="2" fill="none"/>
    <rect x="30" y="56" width="6" height="2" rx="1" fill="#000" opacity=".2"/>
    <path d="M41 50h6M53 50h6" stroke="#3a2a22" stroke-width="2"/>
    <path d="M20 112l10-6M80 106l10 6" stroke="#666" stroke-width="3"/>`,
  haslinger: (L) => `
    <path d="${SHOULDERS}" fill="${L.cloth}"/>
    <path d="M40 88l10 10 10-10" fill="#dcdcd0"/><path d="M28 98h12M60 98h12" stroke="#c9a24d" stroke-width="2"/>
    ${face(L, { mouth: 'M45 70q5-1.5 10 0', lip: '#7a3b33' })}
    <path d="M33 44c2-12 10-16 17-16s15 4 17 16c-4-6-10-8-17-8s-13 2-17 8z" fill="${L.hair}"/>
    <g fill="none" stroke="#2a2a2a" stroke-width="1.6"><rect x="37" y="49" width="12" height="9" rx="2"/><rect x="51" y="49" width="12" height="9" rx="2"/><path d="M49 53h2"/></g>
    <path d="M62 60l6 6M64 58l7 3" stroke="#8a0f14" stroke-width="1.6"/>`,
  gerda: (L) => `
    <path d="${SHOULDERS}" fill="${L.cloth}"/>
    <path d="M38 90q12 10 24 0" stroke="#f4f1ea" stroke-width="3" fill="none"/>
    ${face(L, { mouth: 'M45 69q5 1 10 0', lip: '#a3504a' })}
    <g fill="${L.hair}"><circle cx="36" cy="40" r="9"/><circle cx="46" cy="33" r="9"/><circle cx="56" cy="33" r="9"/><circle cx="65" cy="40" r="9"/><circle cx="31" cy="52" r="6"/><circle cx="69" cy="52" r="6"/></g>
    <circle cx="33" cy="62" r="2" fill="#f4f1ea"/><circle cx="67" cy="62" r="2" fill="#f4f1ea"/>`,
  tobias: (L) => `
    <path d="${SHOULDERS}" fill="${L.cloth}"/>
    <path d="M36 88q14 12 28 0l4 8q-18 14-36 0z" fill="#2a2d33"/><path d="M44 96v18M56 96v18" stroke="#9aa3ab" stroke-width="1.4"/>
    ${face(L, { mouth: 'M45 70h10', lip: '#6e3a32', eyes: 1.1 })}
    <path d="M38 58q5 3 10 0M52 58q5 3 10 0" stroke="#5a3a4a" stroke-width="1.4" fill="none" opacity=".7"/>
    <g fill="#000" opacity=".22"><path d="M36 62c3 12 9 16 14 16s11-4 14-16c-2 9-7 13-14 13s-12-4-14-13z"/></g>
    <path d="M32 50c-2-16 6-24 18-24s20 6 18 20c-6-8-12-10-18-8-6-4-14-2-18 12z" fill="${L.hair}"/>`,
  anton: (L) => `
    <path d="${SHOULDERS}" fill="${L.cloth}"/>
    ${face(L, { mouth: 'M45 70q5 1.5 10 0', lip: '#6e3a32' })}
    <path d="M36 62q14 26 28 0q0 18-14 20q-14-2-14-20z" fill="${L.hair}"/>
    <ellipse cx="50" cy="30" rx="22" ry="8" fill="#2a2420"/><circle cx="50" cy="22" r="2.6" fill="#2a2420"/>`,
  marianne: (L) => `
    <path d="${SHOULDERS}" fill="${L.cloth}"/>
    ${face(L, { mouth: 'M45 69q5 2 10 0', lip: '#a3504a' })}
    <path d="M32 54c-2-18 6-26 18-26s20 8 18 26c-3-8-9-14-18-14s-15 6-18 14z" fill="${L.hair}"/>
    <path d="M66 50q8 18 2 40" stroke="${L.hair}" stroke-width="8" stroke-linecap="round" fill="none"/>`,
  konrad: (L) => `
    <path d="${SHOULDERS}" fill="${L.cloth}"/>
    <path d="M40 88l10 12 10-12" fill="#ddd"/><path d="M48 92h4l1.5 26h-7z" fill="#5a1a1a"/>
    ${face(L, { mouth: 'M45 69q5-1.6 10 0', lip: '#6a3a35', eyes: .5 })}
    <path d="M32 48c0-13 8-21 18-21s18 8 18 21c-3-7-9-11-18-11s-15 4-18 11z" fill="${L.hair}"/>`,
};

export function portrait(id, o = {}) {
  const L = LOOK[id] || LOOK.konrad;
  const g = uid('kp');
  const dead = !!o.dead;
  return `<svg class="kr-portrait${dead ? ' dead' : ''}" viewBox="0 0 100 120" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="${g}b" cx=".3" cy=".25" r=".95"><stop offset="0" stop-color="${L.bg}" stop-opacity="1"/><stop offset="1" stop-color="#0a0708"/></radialGradient>
      <linearGradient id="${g}l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".08"/><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>
    </defs>
    <rect width="100" height="120" fill="url(#${g}b)"/>
    ${PARTS[id] ? PARTS[id](L) : PARTS.konrad(L)}
    <rect width="100" height="120" fill="url(#${g}l)"/>
    ${dead ? '<path d="M0 0h100v120H0z" fill="#000" opacity=".35"/><path d="M70 0h30v30z" fill="#111"/><path d="M84 6v12M79 10h10" stroke="#ddd" stroke-width="2"/>' : ''}
  </svg>`;
}

// =====================================================================
// Spuren-Symbole (24×24, Linien)
// =====================================================================
const IC = {
  body: '<circle cx="6" cy="8" r="2.3"/><path d="M8.2 9.6l4.8 1.4 4-2 3 1.2M13 11l-1 5-3 3.4M13 11l3 4 4.2 1M10 10.2l-3.4 4"/>',
  key: '<circle cx="7.5" cy="12" r="3.6"/><path d="M11 12h10M17.5 12v3M20.5 12v2.2"/>',
  watch: '<circle cx="12" cy="12" r="6"/><path d="M12 8.6V12l2.6 1.6M9 3h6l-.8 3M9 21h6l-.8-3M14.5 8l-2.5 2.5" />',
  medal: '<path d="M8 3l4 6 4-6"/><circle cx="12" cy="15" r="5.5"/><circle cx="12" cy="15" r="2.4"/>',
  wound: '<path d="M4 13.5c3-2 6-3 8-3s5 1 8 3"/><path d="M8 12.5v3M12 11v4.5M16 12.5v3M12 19.5c-1.2-1.4-1.2-2.6 0-3.6 1.2 1 1.2 2.2 0 3.6z"/>',
  shards: '<path d="M4 20l4-9 3 5zM12 21l2-8 4 6zM14 9l3-6 2 5zM5 7l3-3 1 4z"/>',
  bottle: '<path d="M10 2h4v4l2 3v12a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l2-3z"/><path d="M8 13h8"/>',
  candle: '<path d="M9 10h6v11H9z"/><path d="M12 10V7.5"/><path d="M12 2.6c1.6 1.6 1.6 3.2 0 4.2-1.6-1-1.6-2.6 0-4.2z"/>',
  print: '<path d="M7 10a5 5 0 0 1 10 0v4M9.5 10a2.5 2.5 0 0 1 5 0v6M12 10v8.5M5 14.5V11a7 7 0 0 1 14 0v2M7.4 18.4c-.6-1-1-2.2-1-3.6M16.8 17.8c.2-.9.2-1.8.2-2.8"/>',
  steps: '<path d="M7 3.5c2 0 2.6 3 2 5.2s-3 2-3.6 0S5 3.5 7 3.5zM16.5 10c2 0 2.6 3 2 5.2s-3 2-3.6 0-.4-5.2 1.6-5.2z"/><path d="M6.4 11.5h2.6M15.9 17.8h2.6"/>',
  sink: '<path d="M3 10h18v2a7 7 0 0 1-7 7h-4a7 7 0 0 1-7-7z"/><path d="M12 10V5h4M12 19v2"/>',
  towel: '<path d="M6 4h12v13H6z"/><path d="M6 8h12M9 17v3h6v-3"/>',
  string: '<circle cx="9" cy="12" r="5"/><circle cx="9" cy="12" r="2"/><path d="M14 12c3 0 3 4 6.5 4"/>',
  clip: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M8 9h8M8 13h8M8 17h5"/>',
  skis: '<path d="M6 3l3 18M12 3l3 18M4 8h7M10 8h7M19 4v15"/><circle cx="19" cy="20" r="1.4"/>',
  scarf: '<path d="M6 5c4 2 8 2 12 0v4c-4 2-8 2-12 0z"/><path d="M14 9.4l2.2 10.6-3-1-1 2-1-10.8"/>',
  letter: '<rect x="3" y="6" width="18" height="12" rx="1.5"/><path d="M3 7l9 6 9-6"/>',
  letters: '<rect x="3" y="8" width="15" height="11" rx="1.2"/><path d="M3 9l7.5 5L18 9M6 5h14.5v10.5"/>',
  photo: '<rect x="4" y="4" width="16" height="16" rx="1"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18c1-3 3-4.5 5.5-4.5s4.5 1.5 5.5 4.5"/>',
  sign: '<rect x="4" y="5" width="16" height="9" rx="1"/><path d="M8 14v6M16 14v6M7 9.5h10"/>',
  thermo: '<path d="M10 4a2 2 0 0 1 4 0v10a4 4 0 1 1-4 0z"/><path d="M12 9v8"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h7"/>',
  pad: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M5 6.5h14M8 10h8M8 13.5h8M8 17h5"/>',
  drops: '<path d="M8 4c2 3 3 4.5 3 6a3 3 0 0 1-6 0c0-1.5 1-3 3-6zM16 11c2 3 3 4.5 3 6a3 3 0 0 1-6 0c0-1.5 1-3 3-6z"/>',
  mirror: '<ellipse cx="12" cy="10" rx="6" ry="7"/><path d="M12 17v4M9 21h6M9 7.2c.9-1.4 2-2 3.5-2"/>',
  path: '<path d="M4 19.5c4 0 4-6.5 8-6.5s4-6.5 8-6.5" stroke-dasharray="2.2 2.6"/><path d="M16.8 4l3.2 2.5-3.2 2.5"/>',
  chess: '<circle cx="12" cy="6" r="2.6"/><path d="M10 9h4l1 6H9zM7 21h10l-1-4H8z"/>',
  window: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M12 3v18M5 12h14"/>',
  glasses: '<circle cx="7" cy="14" r="3.5"/><circle cx="17" cy="14" r="3.5"/><path d="M10.5 14h3M3.5 13L2 10M20.5 13L22 10"/>',
  altar: '<path d="M7 21V11M17 21V11M5 21h14M12 4v8M9.5 6.5h5"/><path d="M7 11c-1-1.2-1-2.4 0-3.6 1 1.2 1 2.4 0 3.6zM17 11c-1-1.2-1-2.4 0-3.6"/>',
  hanky: '<path d="M5 5c3 1 11 1 14 0-1 4-1 10 0 14-3-1-11-1-14 0 1-4 1-10 0-14z"/><path d="M8 9h3"/>',
  scalpel: '<path d="M3 21l9-9"/><path d="M12 12l7-8c1 2 0 5-3 7l-2 3z"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="15" cy="15" r="2.5"/>',
  diary: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 3v18M12 9h4M12 13h3"/>',
  note: '<path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5"/>',
  dna: '<path d="M7 3c0 6 10 6 10 9s-10 3-10 9M17 3c0 6-10 6-10 9s10 3 10 9"/><path d="M8.6 6.5h6.8M8.6 17.5h6.8"/>',
  safe: '<rect x="3.5" y="4" width="17" height="15" rx="2"/><circle cx="12" cy="11.5" r="4"/><path d="M12 9v2.5l1.6 1M6 19v2M18 19v2"/>',
  contract: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h5"/>',
  dress: '<path d="M9 3l3 3 3-3 2 4-2 3 4 11H5l4-11-2-3z"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M10.5 18.5h3"/>',
  laptop: '<rect x="5" y="5" width="14" height="10" rx="1"/><path d="M3 19h18l-2-4H5z"/>',
  camera: '<rect x="3" y="7" width="18" height="12" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 7l1.5-2.5h5L16 7"/>',
  keys: '<circle cx="8" cy="8" r="3.6"/><circle cx="8" cy="8" r="1"/><path d="M10.6 10.6l8 8M15 15l2-2M17.6 17.6l2-2"/>',
  card: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M12 10h6M12 14h4"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6M15.5 16h2.5"/>',
  shoe: '<path d="M3 15c0-3 1-7 2-9 3 0 3 2 5 3s7 2 9 3c2 1 2 3 2 4v1H3z"/><path d="M3 18h18"/>',
  bag: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V5h6v3M12 11v6M9 14h6"/>',
  jacket: '<path d="M8 3l4 4 4-4 4 3-1 6h-2v9H7v-9H5L4 6z"/><path d="M12 7v14"/>',
  ash: '<path d="M3 13h18l-2 6H5z"/><path d="M8 13c0-3 2-3 2-6M13.5 13c0-2 2-3 1-5"/>',
  pocketwatch: '<circle cx="12" cy="14" r="7"/><path d="M12 7V4M10 3h4M12 10.5V14l2.5 1.6"/>',
  bucket: '<path d="M5 8h14l-2 13H7zM5 8c1-3 13-3 14 0M9 12l1 6M15 12l-1 6"/>',
  knife: '<path d="M4 20l7-7"/><path d="M11 13l9-9c0 4-3 8-7 11z"/>',
  radio: '<rect x="5" y="8" width="14" height="13" rx="2"/><path d="M9 8l6-5M8.5 12h7M8.5 15h7M8.5 18h4"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
  ear: '<path d="M4 5h16v11h-9l-5 4v-4H4z"/><path d="M9 9.5c0 1.5-1 2-1.5 2M13.5 9.5c0 1.5-1 2-1.5 2"/>',
  pin: '<path d="M12 3a4 4 0 0 1 4 4c0 2-2 3-2 5h-4c0-2-2-3-2-5a4 4 0 0 1 4-4zM12 12v9"/>',
  board: '<rect x="3" y="4" width="18" height="15" rx="1.5"/><path d="M7 9l5 5 5-4M7 9h.01M12 14h.01M17 10h.01M8 22l2-3M16 22l-2-3"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 10h18"/>',
  people: '<circle cx="9" cy="8" r="3.4"/><path d="M2.6 20a6.4 6.4 0 0 1 12.8 0"/><path d="M15.5 4.8a3.4 3.4 0 0 1 0 6.4M18 14a6.4 6.4 0 0 1 3.4 6"/>',
  gavel: '<path d="M13 4l7 7M10 7l7 7M11.5 5.5l-5 5 4 4 5-5M8.5 12.5L3 18l2 2 5.5-5.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  walk: '<circle cx="13" cy="4.5" r="2"/><path d="M11 21l2-6-3-3 1-5 3 3 3 1M10 12l-3 2-1 3"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  thread: '<path d="M5 6c4 0 4 12 8 12s5-8 6-12"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/>',
  sign2: '<path d="M3 17c3-4 5-9 7-9 3 0-1 9 2 9 2 0 3-4 5-4 1 0 1 3 4 3"/><path d="M3 21h18"/>',
};
export function clueIcon(name, cls = '') {
  return `<svg class="kr-ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${IC[name] || IC.clip}</g></svg>`;
}
export const kIcon = (k) => ({ spur: 'search', dok: 'clip', ding: 'key', aussage: 'ear', funk: 'radio', erk: 'bulb', fp: 'print' }[k] || 'clip');

// =====================================================================
// Grundriss eines Stockwerks
// =====================================================================
const LAB = {
  portiersloge: 'Loge', personalgang: 'Pers.-\ngang', kaminzimmer: 'Kamin-\nzimmer', speisesaal: 'Speise-\nsaal', bibliothek: 'Biblio-\nthek',
  waschkueche: 'Wasch-\nküche', weinkeller: 'Weinkeller', heizraum: 'Heizraum', skiraum: 'Skiraum', suite: 'Suite\nFalkner', zimmer12: 'Zimmer 12',
  zimmer9: 'Zimmer 9', zimmer3: 'Zimmer 3', buero: 'Büro', marie: 'Marie', greta: 'Greta', lukas: 'Lukas', hinterhof: 'Hinterhof (draußen)',
  kapelle: 'Kapelle', rezeption: 'Rezeption', kueche: 'Küche', bar: 'Bar', spa: 'Spa & Sauna',
};
export const shortLabel = (id) => (LAB[id] || id).replace('-\n', '').replace('\n', ' ');
const SYM_LOCK = '<path d="M-2.2 0v-1.6a2.2 2.2 0 0 1 4.4 0V0" fill="none" stroke="currentColor" stroke-width=".8"/><rect x="-3" y="0" width="6" height="4.2" rx=".9" fill="currentColor"/>';

// o: { rooms, halls, stairs, floor, pos: {jos, joh}, me, sel, locked(room)→bool, dots(room)→[{mine, theirs}], body: [room], people: room→n }
export function planSVG(o) {
  const rooms = Object.entries(o.rooms).filter(([, r]) => r.floor === o.floor);
  const pat = uid('kh');
  const out = [`<svg class="kr-plan" viewBox="0 0 100 70" role="group" aria-label="Grundriss">
    <defs><pattern id="${pat}" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0v2.4" stroke="currentColor" stroke-width=".5" opacity=".35"/></pattern></defs>
    <rect class="kr-plan-bg" x=".5" y=".5" width="99" height="69" rx="2"/>`];
  for (const [x, y, w, h] of o.halls?.[o.floor] || []) out.push(`<rect class="kr-hall" x="${x}" y="${y}" width="${w}" height="${h}" rx=".6"/>`);
  for (const [x, y] of o.stairs?.[o.floor] || []) out.push(`<g class="kr-stairs" transform="translate(${x} ${y})"><path d="M-2.6 2h1.7v-1.4h1.7v-1.4h1.7v-1.4h1.7"/></g>`);
  for (const [id, r] of rooms) {
    const [x, y, w, h] = r.r;
    const locked = o.locked?.(id);
    const sel = o.sel === id;
    const lab = (LAB[id] || r.name).split('\n');
    const fs = w < 11 ? 2.3 : w < 14 ? 2.6 : 3.1;
    const ty = y + 5.2;
    out.push(`<g class="kr-room${r.outside ? ' out' : ''}${locked ? ' locked' : ''}${sel ? ' sel' : ''}${o.pos?.[o.me] === id ? ' here' : ''}" data-room="${id}" tabindex="0" role="button" aria-label="${r.name}${locked ? ' (abgesperrt)' : ''}">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.2"/>
      ${locked ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.2" fill="url(#${pat})" class="kr-hatch"/>` : ''}
      <text x="${x + 1.6}" y="${ty}" font-size="${fs}">${lab.map((t, i) => `<tspan x="${x + 1.6}" dy="${i ? fs * 1.05 : 0}">${t}</tspan>`).join('')}</text>
      ${locked ? `<g class="kr-lock" transform="translate(${x + w - 4} ${y + 4})">${SYM_LOCK}</g>` : ''}
      ${spotDots(o.dots?.(id), x, y, h)}
    </g>`);
  }
  // Leichen und Wartende
  for (const id of o.body || []) {
    const r = o.rooms[id]; if (!r || r.floor !== o.floor) continue;
    const [x, y, w, h] = r.r;
    out.push(`<g class="kr-chalk" transform="translate(${x + w * .58} ${y + h * .58}) rotate(-18)"><path d="M-6 0c0-1.4 1.2-2.2 2.4-2.2s2.2.8 2.2 2c2-.2 4-.8 6-.4l2.8-1.8.6 1-2.4 1.8c.6.8.6 1.6 0 2.2l2.8 1.4-.6 1.2-3.4-1.6c-2 .4-4 .2-6-.2C-2.8 4.4-4 5.2-5 5.2S-6.6 4.2-6.4 3c-1-.8-1.4-1.8 0-3z"/></g><circle class="kr-bloodspot" cx="${x + w * .6}" cy="${y + h * .62}" r="${Math.min(w, h) * .16}"/>`);
  }
  for (const [id, n] of Object.entries(o.people || {})) {
    const r = o.rooms[id]; if (!r || r.floor !== o.floor || !n) continue;
    const [x, y, w, h] = r.r;
    out.push(`<g class="kr-wait" transform="translate(${x + w - 5.5} ${y + h - 5})"><circle r="3.4"/><text y="1.15" font-size="3.2" text-anchor="middle">${n}</text></g>`);
  }
  // Ermittler
  const here = {};
  for (const p of ['jos', 'joh']) {
    const id = o.pos?.[p]; const r = o.rooms[id];
    if (!r || r.floor !== o.floor) continue;
    here[id] = (here[id] || 0) + 1;
  }
  const seen = {};
  for (const p of ['jos', 'joh']) {
    const id = o.pos?.[p]; const r = o.rooms[id];
    if (!r || r.floor !== o.floor) continue;
    const [x, y, w, h] = r.r;
    const k = seen[id] = (seen[id] || 0) + 1;
    const dx = here[id] > 1 ? (k === 1 ? -3.6 : 3.6) : 0;
    out.push(`<g class="kr-tok ${p}${p === o.me ? ' me' : ''}" style="transform: translate(${(x + w / 2 + dx).toFixed(2)}px, ${(y + h / 2 + 1.5).toFixed(2)}px)"><circle r="3.6"/><text y="1.3" font-size="3.6" text-anchor="middle">${o.initial?.(p) || p[2].toUpperCase()}</text></g>`);
  }
  out.push('</svg>');
  return out.join('');
}
function spotDots(list, x, y, h) {
  if (!list?.length) return '';
  return `<g class="kr-dots">${list.map((d, i) => `<circle cx="${x + 2.2 + i * 2.6}" cy="${y + h - 2.2}" r=".95" class="${d.mine ? 'mine' : ''} ${d.theirs ? 'theirs' : ''}"/>`).join('')}</g>`;
}
export const roomCenter = (r) => [r.r[0] + r.r[2] / 2, r.r[1] + r.r[3] / 2];

// =====================================================================
// Fingerabdrücke (viewBox 0 0 100 130)
// =====================================================================
function ridgePaths(type, seed) {
  const R = makeRng('fp:' + seed);
  const sp = 4.3 + R.int(0, 6) / 10;
  const cx = 50 + R.int(-3, 3), cy = 62 + R.int(-3, 3);
  const out = [];
  if (type === 'whorl') {
    let d = '';
    for (let t = 0; t <= 9.5 * Math.PI * 2; t += .14) {
      const r = 1.5 + sp * t / (2 * Math.PI);
      d += `${d ? 'L' : 'M'}${(cx + r * Math.cos(t)).toFixed(1)} ${(cy + r * 1.18 * Math.sin(t)).toFixed(1)}`;
    }
    out.push(d);
  } else if (type === 'arch') {
    for (let i = -16; i < 18; i++) {
      const y = cy + i * sp;
      const hg = Math.max(2, 16 - Math.abs(i - 1) * 1.1);
      out.push(`M-4 ${(y + 4).toFixed(1)}Q${cx} ${(y - hg).toFixed(1)} 104 ${(y + 4).toFixed(1)}`);
    }
  } else {
    const dir = type === 'loopL' ? -1 : 1;
    const sweep = dir < 0 ? 1 : 0;
    for (let i = 1; i <= 7; i++) {
      const r = i * sp;
      const ex = cx + dir * 70;
      out.push(`M${ex} ${(cy - r).toFixed(1)}L${cx} ${(cy - r).toFixed(1)}A${r.toFixed(1)} ${r.toFixed(1)} 0 0 ${sweep} ${cx} ${(cy + r).toFixed(1)}L${ex} ${(cy + r).toFixed(1)}`);
    }
    for (let i = 8; i < 19; i++) {
      const y = cy - i * sp;
      out.push(`M-4 ${(y + 12).toFixed(1)}Q${cx - dir * 8} ${(y - 2).toFixed(1)} 104 ${(y + 12).toFixed(1)}`);
    }
    for (let i = 8; i < 14; i++) {
      const y = cy + i * sp;
      out.push(`M-4 ${(y - 8).toFixed(1)}Q${cx - dir * 8} ${(y + 3).toFixed(1)} 104 ${(y - 8).toFixed(1)}`);
    }
  }
  return { out, cx, cy, sp };
}
// spec: { type, scar, island } · o: { seed, partial, rot, ink, bg, label }
export function fingerprint(spec, o = {}) {
  const id = uid('fp');
  const { out, cx, cy, sp } = ridgePaths(spec.type, o.seed || 'x');
  const ink = o.ink || '#1f1a24';
  const bg = o.bg || '#f3eee2';
  const rot = o.rot || 0;
  const clip = o.partial
    ? `<clipPath id="${id}c"><path d="M14 18Q48 2 86 22L70 74Q42 98 16 72Z"/></clipPath>`
    : `<clipPath id="${id}c"><ellipse cx="50" cy="66" rx="40" ry="56"/></clipPath>`;
  return `<svg class="kr-fp${o.partial ? ' partial' : ''}" viewBox="0 0 100 130" aria-hidden="true" focusable="false">
    <defs>${clip}<radialGradient id="${id}g" cx=".5" cy=".45" r=".6"><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".1"/></radialGradient></defs>
    ${o.noBg ? '' : `<rect width="100" height="130" fill="${bg}"/>`}
    <g clip-path="url(#${id}c)"><g transform="rotate(${rot} 50 66)">
      <g fill="none" stroke="${ink}" stroke-width="1.45" stroke-linecap="round" opacity=".9">${out.map((d) => `<path d="${d}"/>`).join('')}</g>
      ${spec.island ? `<ellipse cx="${cx + 7}" cy="${(cy - sp * 1.5).toFixed(1)}" rx="1.9" ry="1.05" fill="${ink}"/>` : ''}
      ${spec.scar ? `<path d="M28 34L74 92" stroke="${bg}" stroke-width="2.8" stroke-linecap="round"/>` : ''}
    </g></g>
    ${o.noBg ? '' : `<rect width="100" height="130" fill="url(#${id}g)"/>`}
  </svg>`;
}

// =====================================================================
// Blutspritzer (viewBox 0 0 200 200)
// =====================================================================
export function splat(seed = 'b', o = {}) {
  const R = makeRng('splat:' + seed);
  const col = o.color || '#8a0f14';
  const cx = 100, cy = 100;
  let d = '';
  const n = 22;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 30 + R.int(0, 26) + (R.chance(.25) ? R.int(10, 30) : 0);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n];
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    d += i === 0 ? `M${mx.toFixed(1)} ${my.toFixed(1)}` : '';
    const [nx, ny] = pts[(i + 1) % n], [nnx, nny] = pts[(i + 2) % n];
    d += `Q${nx.toFixed(1)} ${ny.toFixed(1)} ${((nx + nnx) / 2).toFixed(1)} ${((ny + nny) / 2).toFixed(1)}`;
  }
  const drops = [];
  for (let i = 0; i < 26; i++) {
    const a = R.int(0, 359) * Math.PI / 180, r = 62 + R.int(0, 34);
    const s = 1.5 + R.int(0, 60) / 10;
    drops.push(`<circle cx="${(cx + Math.cos(a) * r).toFixed(1)}" cy="${(cy + Math.sin(a) * r).toFixed(1)}" r="${s.toFixed(1)}"/>`);
  }
  const streaks = [];
  for (let i = 0; i < 7; i++) {
    const a = R.int(0, 359);
    streaks.push(`<ellipse cx="${(cx + 52).toFixed(1)}" cy="${cy}" rx="${16 + R.int(0, 22)}" ry="${2 + R.int(0, 3)}" transform="rotate(${a} ${cx} ${cy})"/>`);
  }
  return `<svg class="kr-splat ${o.cls || ''}" viewBox="0 0 200 200" aria-hidden="true" focusable="false"><g fill="${col}"><path d="${d}Z"/>${streaks.join('')}${drops.join('')}</g><path d="${d}Z" fill="#fff" opacity=".07" transform="translate(-6 -6) scale(1.03)"/></svg>`;
}

// =====================================================================
// Hotel im Schneesturm (viewBox 0 0 400 220)
// =====================================================================
export function hotelScene(o = {}) {
  const id = uid('hs');
  const R = makeRng('snow' + (o.seed || ''));
  const flakes = Array.from({ length: 70 }, () => `<circle cx="${R.int(0, 400)}" cy="${R.int(-20, 220)}" r="${(R.int(4, 16) / 10).toFixed(1)}" style="--d:${-R.int(0, 60) / 10}s;--x:${R.int(-40, -10)}px"/>`).join('');
  const win = (x, y, w = 9, h = 11, cls = '') => `<rect class="kr-win ${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="1"/>`;
  return `<svg class="kr-scene" viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05070d"/><stop offset=".7" stop-color="#16202e"/><stop offset="1" stop-color="#2a3546"/></linearGradient>
      <radialGradient id="${id}m" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#e8edf5" stop-opacity=".9"/><stop offset=".3" stop-color="#9fb0c8" stop-opacity=".35"/><stop offset="1" stop-color="#9fb0c8" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}r" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff2a2a" stop-opacity=".75"/><stop offset="1" stop-color="#ff2a2a" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="400" height="220" fill="url(#${id}s)"/>
    <circle cx="316" cy="46" r="60" fill="url(#${id}m)"/><circle cx="316" cy="46" r="13" fill="#dfe6f0" opacity=".85"/>
    <path class="kr-cloud" d="M230 52c10-14 34-14 42 0 14-6 30 4 26 16H214c-6-10 4-20 16-16z" fill="#1c2534" opacity=".85"/>
    <path d="M0 150L52 86l34 30 50-62 46 52 40-36 52 50 38-28 46 40 42-30v128H0z" fill="#121a26"/>
    <path d="M52 86l14 14-8-2-6 8-4-10zM136 54l16 20-10-4-6 10-6-12zM270 96l14 14-10-2zM346 108l12 12-8-2z" fill="#cfd8e6" opacity=".55"/>
    <path d="M0 176c60-12 120-16 200-14s140 6 200 14v44H0z" fill="#dfe6ef"/>
    <g class="kr-hotel">
      <path d="M108 176v-62h186v62z" fill="#2a1d17"/>
      <path d="M96 118l105-46 105 46z" fill="#1a1110"/><path d="M96 118l105-46 105 46" fill="none" stroke="#e9eef5" stroke-width="5" stroke-linejoin="round" opacity=".9"/>
      <path d="M108 146h186" stroke="#1a1110" stroke-width="4"/><path d="M112 140h178" stroke="#5a3d2c" stroke-width="2" stroke-dasharray="3 3"/>
      <path d="M176 100h50v14h-50z" fill="#1a1110"/>
      ${win(122, 122)}${win(140, 122, 9, 11, 'off')}${win(158, 122)}${win(214, 122, 9, 11, 'off')}${win(232, 122)}${win(250, 122)}${win(268, 122, 9, 11, 'off')}
      ${win(122, 152, 9, 11, 'off')}${win(140, 152)}${win(158, 152)}${win(232, 152, 9, 11, 'off')}${win(250, 152)}${win(268, 152)}
      ${win(186, 103, 8, 8)}${win(206, 103, 8, 8, 'off')}
      <path d="M192 176v-22a9 9 0 0 1 18 0v22z" fill="#f5c46a" opacity=".85" class="kr-door"/>
      <rect class="kr-cellar" x="132" y="171" width="12" height="5" fill="#c41f1f"/><circle cx="138" cy="174" r="16" fill="url(#${id}r)" class="kr-cellar-glow"/>
    </g>
    <path d="M0 196c70-8 140-10 200-8s130 4 200 10v22H0z" fill="#eef2f7"/>
    <g class="kr-snow" fill="#fff">${flakes}</g>
  </svg>`;
}

// =====================================================================
// Zerschlagene Armbanduhr 21:52 (viewBox 0 0 120 120)
// =====================================================================
export function watchArt() {
  const h = (21 % 12 + 52 / 60) * 30, m = 52 * 6;
  const ticks = Array.from({ length: 12 }, (_, i) => `<path d="M60 22v${i % 3 ? 4 : 7}" transform="rotate(${i * 30} 60 60)"/>`).join('');
  return `<svg class="kr-watch" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
    <path d="M44 4h32l-4 20H48zM44 116h32l-4-20H48z" fill="#3a2a22"/>
    <circle cx="60" cy="60" r="42" fill="#c9a24d"/><circle cx="60" cy="60" r="37" fill="#f3ecdc"/>
    <g stroke="#2a2420" stroke-width="2.2" stroke-linecap="round">${ticks}</g>
    <path d="M60 60L60 38" stroke="#1a1512" stroke-width="4" stroke-linecap="round" transform="rotate(${h} 60 60)"/>
    <path d="M60 60L60 28" stroke="#1a1512" stroke-width="2.6" stroke-linecap="round" transform="rotate(${m} 60 60)"/>
    <circle cx="60" cy="60" r="3" fill="#1a1512"/>
    <g stroke="#fff" stroke-width="1.1" opacity=".85" fill="none"><path d="M30 40l22 18 12-4 20 24M52 58l-6 26M64 54l14-22M64 54l4 10"/></g>
    <g fill="#8a0f14"><circle cx="86" cy="80" r="4"/><circle cx="92" cy="72" r="1.8"/><circle cx="78" cy="90" r="2.2"/><circle cx="35" cy="78" r="1.4"/></g>
  </svg>`;
}
