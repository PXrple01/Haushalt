// Krimi Fall 2 – Grafiken: der Horror-Kasperl, das Theater, und die Zeichnungen für die fünf Rätsel.
import { makeRng } from '../../escape/rng.js';
import { COLORS, STAGE, TC, onTurn } from './puzzles.js';

let n = 0;
const uid = (p) => `${p}${++n}`;

// =====================================================================
// Der Kasperl (eigene Figur): Holzkopf, Zipfelmütze mit Glöckchen, geschnitztes Grinsen, Blut
// mood: grin | talk | mad | broken
// =====================================================================
export function kasperl(mood = 'grin', o = {}) {
  const id = uid('kas');
  const mouth = {
    grin: '<path d="M38 92q22 20 44 0q-22 9-44 0z" fill="#3a0608"/><path d="M41 93l4 5 3-5 4 6 4-6 4 6 4-6 4 6 3-6 4 5" fill="none" stroke="#efe4c8" stroke-width="2.2" stroke-linejoin="round"/>',
    talk: '<path d="M40 90q20 28 40 0q-20 6-40 0z" fill="#2a0305"/><path d="M43 92l4 5 3-5 4 6 4-6 4 6 4-6 4 6 3-6" fill="none" stroke="#efe4c8" stroke-width="2.2" stroke-linejoin="round"/><path d="M48 104q12 6 24 0" stroke="#efe4c8" stroke-width="2" fill="none"/>',
    mad: '<path d="M40 98q20-10 40 0q-20 12-40 0z" fill="#2a0305"/><path d="M43 99l4-4 4 5 4-5 4 5 4-5 4 5 4-5 4 4" fill="none" stroke="#efe4c8" stroke-width="2.2"/>',
    broken: '<path d="M44 96q16 4 32-2" stroke="#2a0305" stroke-width="3" fill="none"/>',
  }[mood] || '';
  const brows = mood === 'mad' ? '<path d="M36 58l16 7M84 58l-16 7" stroke="#2a1a12" stroke-width="3.4" stroke-linecap="round"/>' : '<path d="M36 60q8-6 16-1M68 59q8-5 16 1" stroke="#2a1a12" stroke-width="3" stroke-linecap="round" fill="none"/>';
  return `<svg class="k2-kasperl ${mood}${o.cls ? ' ' + o.cls : ''}" viewBox="0 0 120 160" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="${id}f" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#f6d7b4"/><stop offset=".7" stop-color="#d9a77c"/><stop offset="1" stop-color="#9c6a45"/></radialGradient>
      <linearGradient id="${id}c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3262b"/><stop offset="1" stop-color="#7a0b10"/></linearGradient>
    </defs>
    ${o.strings === false ? '' : '<g class="k2-strings" stroke="#d8d2c4" stroke-width=".7" opacity=".7"><path d="M60 0v20M26 0l6 70M94 0l-6 70M44 0v128M76 0v128"/></g>'}
    <path d="M18 160c4-26 18-38 42-38s38 12 42 38z" fill="#c4161c"/><path d="M40 124l20 36 20-36" fill="#f0c419"/><path d="M50 128h20l-10 18z" fill="#1d4f9c"/>
    <path d="M28 120q32 16 64 0l-4 10q-28 12-56 0z" fill="#f4efe4"/><path d="M34 126q8 6 14 2M70 128q8 4 16-2" stroke="#8a0f14" stroke-width="2.2" fill="none"/>
    <ellipse cx="60" cy="78" rx="34" ry="40" fill="url(#${id}f)"/>
    <path d="M40 46l-2-1M80 46l2-1" stroke="#7a4a2a" stroke-width="1"/>
    <path d="M30 70c-2 10 0 18 4 24M88 68c3 10 1 20-3 26" stroke="#7a4a2a" stroke-width="1.2" fill="none" opacity=".5"/>
    <circle cx="42" cy="84" r="8" fill="#e05a5a" opacity=".55"/><circle cx="78" cy="84" r="8" fill="#e05a5a" opacity=".55"/>
    ${brows}
    <circle cx="45" cy="70" r="7.5" fill="#f9f3e6"/><circle cx="75" cy="70" r="7.5" fill="#f9f3e6"/>
    <circle cx="${mood === 'broken' ? 45 : 46}" cy="${mood === 'broken' ? 73 : 71}" r="3.6" fill="#1a0f0a"/><circle cx="${mood === 'broken' ? 77 : 74}" cy="71" r="3.6" fill="#3b6fb3"/>
    <circle cx="47" cy="69.5" r="1.2" fill="#fff"/><circle cx="75.5" cy="69.5" r="1.2" fill="#fff"/>
    <path d="M71 64l9 12M78 63l-5 7" stroke="#2a1a12" stroke-width=".8"/>
    <path d="M60 72q-6 10-3 20q8 8 18 2q6-6 2-11q-6-2-9 2q-3-8-8-13z" fill="#e07c5c" stroke="#9c4a32" stroke-width="1"/>
    ${mouth}
    <path d="M37 97l-2 9M83 97l2 8" stroke="#8a0f14" stroke-width="2.4" stroke-linecap="round"/><circle cx="35" cy="108" r="1.8" fill="#8a0f14"/><circle cx="85.4" cy="107" r="1.5" fill="#8a0f14"/>
    <path d="M24 56c4-30 30-44 58-30 12 6 22 6 30-6-2 18-14 26-26 28-18 2-42-6-62 8z" fill="url(#${id}c)"/>
    <path d="M24 56q30-12 62-6" stroke="#2a1a12" stroke-width="3" fill="none"/>
    <circle cx="112" cy="20" r="6" fill="#d8b04a" stroke="#8a6a1a"/><path d="M109 22h6" stroke="#5a4210"/>
    ${mood === 'broken' ? '<path d="M50 30l6 22-4 14 8 10" stroke="#2a1a12" stroke-width="1.6" fill="none"/>' : ''}
  </svg>`;
}

// =====================================================================
// Theater-Szene (Karte, Intro): Bühnenportal, Vorhänge, Kasperl an Fäden, drei Gefesselte
// =====================================================================
export function theaterScene(o = {}) {
  const id = uid('th');
  const R = makeRng('th' + (o.seed || ''));
  const dust = Array.from({ length: 40 }, () => `<circle cx="${R.int(80, 320)}" cy="${R.int(20, 200)}" r="${(R.int(3, 10) / 10).toFixed(1)}" style="--d:${-R.int(0, 80) / 10}s"/>`).join('');
  return `<svg class="k2-scene" viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="${id}s" cx=".5" cy=".18" r=".75"><stop offset="0" stop-color="#f2e2a0" stop-opacity=".55"/><stop offset=".45" stop-color="#b38b3a" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}v" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4a0508"/><stop offset=".5" stop-color="#9b111a"/><stop offset="1" stop-color="#4a0508"/></linearGradient>
    </defs>
    <rect width="400" height="220" fill="#090506"/>
    <path d="M70 220V40q130-40 260 0v180z" fill="#140c0a"/>
    <path d="M0 0h400v34q-200-30-400 0z" fill="#3a0b0f"/><path d="M0 34q200-30 400 0" stroke="#c9a24d" stroke-width="3" fill="none"/>
    <g class="k2-curtain l"><path d="M0 30q40 10 70 0v190H0z" fill="url(#${id}v)"/><path d="M14 36v184M30 38v182M46 36v184M60 34v186" stroke="#000" stroke-opacity=".28" stroke-width="3"/></g>
    <g class="k2-curtain r"><path d="M330 30q40 10 70 0v190h-70z" fill="url(#${id}v)"/><path d="M340 34v186M354 36v184M370 38v182M386 36v184" stroke="#000" stroke-opacity=".28" stroke-width="3"/></g>
    <path d="M70 160h260l26 60H44z" fill="#2a1a12"/><path d="M70 160h260" stroke="#5a3a22" stroke-width="2"/>
    <rect x="70" y="0" width="260" height="220" fill="url(#${id}s)" class="k2-spot"/>
    <g class="k2-hang"><g transform="translate(176 22) scale(.4)">${kasperl('grin', { strings: false }).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>
      <path d="M200 0v26M186 0l2 44M214 0l-2 44" stroke="#d8d2c4" stroke-width=".7" opacity=".7"/></g>
    <g class="k2-seats">${[110, 200, 290].map((x, i) => `<g transform="translate(${x} 182)"><path d="M-22 38v-30q0-10 10-10h24q10 0 10 10v30z" fill="#4a0b10"/><circle cy="-12" r="9" fill="#1a1110"/><path d="M-12 0q12-8 24 0v16h-24z" fill="#1a1110"/><path d="M-14 6h28" stroke="#888" stroke-width="2"/><path d="M0 -22V-${120 + i * 6}" stroke="#d8d2c4" stroke-width=".6" opacity=".6"/><rect x="-7" y="-${136 + i * 6}" width="14" height="14" rx="2" fill="#3a2a1a"/></g>`).join('')}</g>
    <g class="k2-drip" fill="#8a0f14"><path d="M120 0v30q0 4 2 4t2-4V0z"/><path d="M278 0v52q0 5 3 5t3-5V0z"/><path d="M226 0v18q0 3 2 3t2-3V0z"/></g>
    <g class="k2-dust" fill="#f2e2a0">${dust}</g>
  </svg>`;
}

// =====================================================================
// 1) Marionette: Körper von hinten (so wie die Puppe sich selbst fühlt) · Skizze von vorne
// =====================================================================
const HAND = [[[78, 150], [48, 96], [66, 36]], [[122, 150], [152, 96], [134, 36]]]; // [links|rechts][Stufe]
const FOOT = [[[88, 214], [64, 186], [46, 158]], [[112, 214], [136, 186], [154, 158]]];
const LIMB_IDX = { lh: 0, rh: 1, lf: 2, rf: 3 };
function limbPoint(li, lv) {
  if (li < 2) return HAND[li][lv];
  return FOOT[li - 2][lv];
}
// pos: Stufen je Glied [lh, rh, lf, rf] · colors: Farbe je Glied · danger: [{li, lv}] · drop: 0..1 (Seil sinkt)
export function puppetBody({ pos, colors, danger = [], drop = 0, keyOn = true, hurt = false }) {
  const dy = Math.round(drop * 26);
  const parts = [];
  // Sicheln an den gefährlichen Stellen
  for (const dd of danger) {
    const [x, y] = limbPoint(dd.li, dd.lv);
    const flip = x < 100 ? 1 : -1;
    parts.push(`<g class="k2-sickle" transform="translate(${x} ${y + dy}) scale(${flip} 1)"><path d="M-16 -18c16 -8 30 4 26 22-4-12-14-18-26-14z" fill="#cfd6dd" stroke="#6d7680" stroke-width="1"/><path d="M-16 -18l-8 -10" stroke="#5a3a22" stroke-width="4" stroke-linecap="round"/><path d="M8 0c1-6-2-12-6-14" stroke="#8a0f14" stroke-width="1.6" fill="none" opacity=".8"/></g>`);
  }
  const P = [0, 1, 2, 3].map((li) => limbPoint(li, pos[li]).map((v, k) => v + (k ? dy : 0)));
  const sh = [[86, 92 + dy], [114, 92 + dy]], hip = [[92, 150 + dy], [108, 150 + dy]];
  const top = [[62, 0], [138, 0], [84, 0], [116, 0]];
  const strings = P.map(([x, y], li) => `<path d="M${top[li][0]} 0L${x} ${y}" stroke="${colors[li]}" stroke-width="1.6"/>`).join('');
  return `<svg class="k2-body${hurt ? ' hurt' : ''}" viewBox="0 0 200 260" aria-label="Deine Haltung" focusable="false">
    <rect width="200" height="260" fill="#0f0b0b"/>
    <path d="M0 0h200v8H0z" fill="#2a1a12"/>
    ${keyOn ? `<g transform="translate(166 44)"><g class="k2-key"><path d="M0 -44V-8" stroke="#888" stroke-width="1"/><path d="M-4 -10q4-6 8 0" stroke="#888" fill="none" stroke-width="1.5"/><circle cy="0" r="6" fill="none" stroke="#d8b04a" stroke-width="3"/><path d="M0 6v18M0 16h6M0 22h5" stroke="#d8b04a" stroke-width="3"/></g></g>` : ''}
    <g class="k2-nails">${Array.from({ length: 13 }, (_, i) => `<path d="M${8 + i * 15} 260l4-18 4 18z" fill="#9aa3ab"/>`).join('')}</g>
    ${parts.join('')}
    <g class="k2-puppet-strings">${strings}</g>
    <g class="k2-me" stroke="#e9dccb" stroke-width="7" stroke-linecap="round" fill="none">
      <path d="M100 ${84 + dy}V${150 + dy}"/>
      <path d="M${sh[0][0]} ${sh[0][1]}L${P[0][0]} ${P[0][1]}M${sh[1][0]} ${sh[1][1]}L${P[1][0]} ${P[1][1]}"/>
      <path d="M${hip[0][0]} ${hip[0][1]}L${P[2][0]} ${P[2][1]}M${hip[1][0]} ${hip[1][1]}L${P[3][0]} ${P[3][1]}"/>
      <path d="M86 ${92 + dy}H114M92 ${150 + dy}H108" stroke-width="9"/>
    </g>
    <circle cx="100" cy="${70 + dy}" r="13" fill="#e9dccb"/><path d="M90 ${64 + dy}q10-10 20 0" stroke="#3a2a20" stroke-width="5" fill="none"/>
    ${P.map(([x, y], li) => `<circle cx="${x}" cy="${y}" r="5.2" fill="${colors[li]}" stroke="#fff" stroke-width="1.4"/>`).join('')}
    <text x="10" y="252" font-size="11" fill="#9aa3ab">links</text><text x="190" y="252" font-size="11" fill="#9aa3ab" text-anchor="end">rechts</text>
  </svg>`;
}
// Skizze (von vorne gezeichnet = gespiegelt): Bleistift auf Papier
export function puppetSketch(target) {
  const P = [0, 1, 2, 3].map((li) => limbPoint(li, target[li])).map(([x, y]) => [200 - x, y]);
  const sh = [[114, 92], [86, 92]], hip = [[108, 150], [92, 150]];
  return `<svg class="k2-sketch" viewBox="0 0 200 240" aria-label="Skizze der Haltung, von vorne" focusable="false">
    <rect width="200" height="240" fill="#efe4c8"/>
    <g stroke="#5a4636" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".88">
      <path d="M100 84V150"/><path d="M${sh[0][0]} ${sh[0][1]}L${P[0][0]} ${P[0][1]}M${sh[1][0]} ${sh[1][1]}L${P[1][0]} ${P[1][1]}"/>
      <path d="M${hip[0][0]} ${hip[0][1]}L${P[2][0]} ${P[2][1]}M${hip[1][0]} ${hip[1][1]}L${P[3][0]} ${P[3][1]}"/>
      <path d="M86 92H114M92 150H108"/><circle cx="100" cy="70" r="13"/><path d="M95 68h.1M105 68h.1M95 76q5 4 10 0" stroke-width="2"/>
    </g>
    <path d="M150 36l10 -6M150 36q8 4 6 12" stroke="#5a4636" stroke-width="1.4" fill="none"/>
    <text x="100" y="230" font-size="13" fill="#5a4636" text-anchor="middle" font-family="Caveat, cursive" font-weight="700">Haltung 7 – von vorne</text>
  </svg>`;
}

// =====================================================================
// 2) Blutspur: Werkstattboden. view: 'oben' (gedreht, mit Blut) | 'unten' (Bretter, ohne Blut)
// =====================================================================
const MARK_ART = {
  stuhl: (top) => top ? '<rect x="-12" y="-12" width="24" height="24" rx="3" fill="#5a3a22"/><circle r="8" fill="#e9dccb"/><path d="M-8 -2h16" stroke="#3a2a20" stroke-width="5"/>' : '<path d="M-10 14v-26M10 14v-26M-12 -2h24" stroke="#5a3a22" stroke-width="4"/><circle cy="-16" r="6" fill="#e9dccb"/>',
  werkbank: () => '<rect x="-17" y="-12" width="34" height="24" rx="2" fill="#7a5532"/><path d="M-12 -4h24M-12 4h18" stroke="#4a3220" stroke-width="2"/>',
  ofen: () => '<rect x="-14" y="-14" width="28" height="28" rx="4" fill="#2b2b2e"/><circle r="7" fill="#c9481f" opacity=".85"/>',
  abfluss: () => '<circle r="10" fill="#3a3a3e"/><path d="M-6 0h12M0 -6v12M-4 -4l8 8M4 -4l-8 8" stroke="#1a1a1c" stroke-width="2"/>',
  koepfe: () => '<circle cx="-7" cy="-4" r="7" fill="#e9dccb"/><circle cx="6" cy="-5" r="6" fill="#d9c3a8"/><circle cx="0" cy="7" r="7" fill="#efe4c8"/><circle cx="-9" cy="-5" r="1.2" fill="#000"/><circle cx="2" cy="6" r="1.2" fill="#000"/>',
  kiste: () => '<rect x="-13" y="-11" width="26" height="22" fill="#8a6a3a"/><path d="M-13 -11l26 22M13 -11l-26 22" stroke="#5a4220" stroke-width="2"/>',
};
export function floorView(spec, o) {
  const N = spec.N, S = 40, W = N * S;
  const top = o.view === 'oben';
  const marks = Object.entries(spec.marks).map(([m, [x, y]]) => `<g class="k2-mark" transform="translate(${x * S + S / 2} ${y * S + S / 2})">${MARK_ART[m](top)}</g>`).join('');
  const markCells = new Set(Object.values(spec.marks).map(([x, y]) => y * N + x));
  let boards = '';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const c = y * N + x;
    const tried = o.tried?.includes(c);
    const sel = o.sel === c;
    boards += `<rect class="k2-plank${tried ? ' tried' : ''}${sel ? ' sel' : ''}${markCells.has(c) ? ' mark' : ''}" data-c="${c}" x="${x * S + 1}" y="${y * S + 1}" width="${S - 2}" height="${S - 2}" rx="2"/>`;
    if (!top) boards += `<path d="M${x * S + 4} ${y * S + 14}h${S - 8}M${x * S + 4} ${y * S + 27}h${S - 8}" stroke="#3a2618" stroke-width="1" opacity=".5" pointer-events="none"/>`;
    if (tried) boards += `<path d="M${x * S + 8} ${y * S + 8}l24 24M${x * S + 32} ${y * S + 8}l-24 24" stroke="#8a0f14" stroke-width="3" pointer-events="none"/>`;
  }
  let blood = '';
  if (top) {
    blood = spec.drops.map((dd, i) => {
      const x = dd.x * S, y = dd.y * S, deg = (dd.a * 180) / Math.PI;
      const L = 9 * dd.s, Wd = 4.2 * dd.s;
      return `<g class="k2-drop${o.lines?.includes(i) ? ' on' : ''}" data-drop="${i}" transform="translate(${x} ${y}) rotate(${deg})">
        <ellipse cx="0" cy="0" rx="${L}" ry="${Wd}" fill="#8a0f14"/><path d="M${L - 1} -1.4L${L + 14 * dd.s} 0L${L - 1} 1.4z" fill="#8a0f14"/>
        <circle cx="${L + 18 * dd.s}" cy="0" r="1.3" fill="#8a0f14"/><circle cx="${L + 24 * dd.s}" cy="1.5" r=".9" fill="#8a0f14"/>
        <rect x="-16" y="-12" width="${L + 44}" height="24" fill="transparent"/></g>`;
    }).join('');
    blood += (o.lines || []).map((i) => {
      const dd = spec.drops[i];
      const dx = Math.cos(dd.a), dy = Math.sin(dd.a);
      const x = dd.x * S, y = dd.y * S;
      return `<path class="k2-traj" d="M${x - dx * 400} ${y - dy * 400}L${x + dx * 400} ${y + dy * 400}"/>`;
    }).join('');
  }
  const rot = top ? spec.rot * 90 : 0;
  const clip = uid('fl');
  return `<svg class="k2-floor ${top ? 'top' : 'low'}" viewBox="0 0 ${W} ${W}" focusable="false" aria-label="Werkstattboden">
    <defs><clipPath id="${clip}"><rect width="${W}" height="${W}"/></clipPath></defs>
    <g clip-path="url(#${clip})"><g transform="rotate(${rot} ${W / 2} ${W / 2})">
      <rect width="${W}" height="${W}" fill="${top ? '#2a1d14' : '#1c130d'}"/>
      ${boards}${marks}${blood}
    </g></g>
    ${top ? '' : `<radialGradient id="${clip}g" cx="${(spec.marks.stuhl[0] + .5) / N}" cy="${(spec.marks.stuhl[1] + .5) / N}" r=".9"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".55" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient><rect width="${W}" height="${W}" fill="url(#${clip}g)" pointer-events="none"/>`}
  </svg>`;
}

// =====================================================================
// 3) Drehbühne von oben
// =====================================================================
export function stageView(spec, st, holeAt, turns) {
  const S = 34, W = STAGE * S;
  const k = turns;
  let cells = '';
  for (let y = 0; y < STAGE; y++) for (let x = 0; x < STAGE; x++) {
    const hole = holeAt(spec, x, y, k);
    const exit = x === spec.exit[0] && y === spec.exit[1];
    const start = x === spec.start[0] && y === spec.start[1];
    cells += `<rect x="${x * S + 1}" y="${y * S + 1}" width="${S - 2}" height="${S - 2}" rx="3" class="k2-cell${onTurn(x, y) ? ' turn' : ''}${hole ? ' hole' : ''}${exit ? ' exit' : ''}${start ? ' start' : ''}"/>`;
    if (hole) cells += `<g transform="translate(${x * S + S / 2} ${y * S + S / 2})" class="k2-spikes"><path d="M-10 8l3-14 3 14M-3 8l3-16 3 16M4 8l3-14 3 14"/></g>`;
    if (exit) cells += `<text x="${x * S + S / 2}" y="${y * S + S / 2 + 4}" text-anchor="middle" font-size="10" class="k2-exit-t">AUS</text>`;
  }
  const deg = [0, 90, 180, 270][st.f];
  return `<svg class="k2-stage" viewBox="-6 -6 ${W + 12} ${W + 12}" focusable="false" aria-label="Bühne von oben">
    <rect x="-6" y="-6" width="${W + 12}" height="${W + 12}" rx="8" fill="#1b120d"/>
    ${cells}
    <circle class="k2-turnring" cx="${TC * S + S / 2}" cy="${TC * S + S / 2}" r="${S * 1.62}" style="transform: rotate(${k * 90}deg); transform-origin: ${TC * S + S / 2}px ${TC * S + S / 2}px"/>
    <g class="k2-walker" style="transform: translate(${st.x * S + S / 2}px, ${st.y * S + S / 2}px) rotate(${deg}deg)">
      <circle r="11" fill="#e9dccb" stroke="#000" stroke-width="1"/><path d="M0 -15l6 9h-12z" fill="#ffd166"/><path d="M-6 -2h12v6h-12z" fill="#7a5532"/></g>
  </svg>`;
}

// =====================================================================
// 4) Schattentheater
// =====================================================================
export function shadowCard(segs, o = {}) {
  return `<svg class="k2-card" viewBox="0 0 120 120" focusable="false" aria-hidden="true">
    <rect x="2" y="2" width="116" height="116" rx="10" fill="rgba(240,230,200,.12)" stroke="#c9a24d" stroke-width="1.5" stroke-dasharray="4 3"/>
    <g ${o.mirror ? 'transform="translate(120 0) scale(-1 1)"' : ''} stroke="#0b0707" stroke-width="7" stroke-linecap="round">${segs.map(([[x1, y1], [x2, y2]]) => `<path d="M${x1} ${y1}L${x2} ${y2}"/>`).join('')}</g>
  </svg>`;
}
export function shadowScreen(lines) {
  const id = uid('sh');
  return `<svg class="k2-screen" viewBox="0 0 120 120" focusable="false" aria-label="Leinwand mit Schatten">
    <defs><radialGradient id="${id}" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="#fff2c6"/><stop offset=".7" stop-color="#e9c983"/><stop offset="1" stop-color="#8a6a3a"/></radialGradient>
    <filter id="${id}b"><feGaussianBlur stdDeviation="1.2"/></filter></defs>
    <rect width="120" height="120" fill="url(#${id})"/>
    <g filter="url(#${id}b)" stroke="#120a06" stroke-width="7" stroke-linecap="round" opacity=".88">${lines.map(([[x1, y1], [x2, y2]]) => `<path d="M${x1} ${y1}L${x2} ${y2}"/>`).join('')}</g>
  </svg>`;
}

// =====================================================================
// 5) Drehorgel + Krokodil
// =====================================================================
export function organ(angle = 0) {
  return `<svg class="k2-organ" viewBox="0 0 240 200" focusable="false" aria-hidden="true">
    <rect x="30" y="40" width="150" height="130" rx="10" fill="#5a2a14" stroke="#c9a24d" stroke-width="3"/>
    <rect x="44" y="54" width="122" height="60" rx="6" fill="#2a120a"/>
    ${Array.from({ length: 9 }, (_, i) => `<rect x="${52 + i * 12.5}" y="62" width="8" height="${44 - (i % 3) * 8}" rx="3" fill="#d8b04a"/>`).join('')}
    <circle cx="105" cy="142" r="16" fill="#3a1a0c" stroke="#c9a24d" stroke-width="2"/>
    <path d="M60 170l-8 22M150 170l8 22" stroke="#3a1a0c" stroke-width="6" stroke-linecap="round"/>
    <g class="k2-crank" style="transform: rotate(${angle}deg); transform-origin: 196px 112px">
      <circle cx="196" cy="112" r="34" fill="none" stroke="rgba(201,162,77,.35)" stroke-width="2" stroke-dasharray="4 4"/>
      <path d="M196 112L196 82" stroke="#c9a24d" stroke-width="7" stroke-linecap="round"/><circle cx="196" cy="80" r="9" fill="#8a0f14" stroke="#f3e3b0" stroke-width="2"/>
    </g>
    <circle cx="196" cy="112" r="7" fill="#c9a24d"/>
  </svg>`;
}
export function crocRail(step, max) {
  const x = 30 + (step / max) * 150;
  return `<svg class="k2-rail" viewBox="0 0 240 90" focusable="false" aria-label="Das Krokodil kommt näher">
    <path d="M10 70h220" stroke="#5a4636" stroke-width="6"/><path d="M10 78h220" stroke="#3a2a20" stroke-width="2"/>
    <g transform="translate(206 52)"><rect x="-10" y="-14" width="30" height="22" rx="6" fill="#e9dccb"/><circle cx="-14" cy="-6" r="9" fill="#e9dccb"/><path d="M-6 -16v26M6 -16v26" stroke="#5a3a22" stroke-width="3"/></g>
    <g class="k2-croc" style="transform: translateX(${x}px)">
      <path d="M-30 48q10-22 40-18l26 6-26 10q-30 8-40 2z" fill="#2f6b3a"/><path d="M10 30l26 6M10 46l26-10" stroke="#1d4426" stroke-width="2"/>
      <path d="M12 36l3 5 3-5 3 5 3-5 3 5 3-5" fill="none" stroke="#cfd6dd" stroke-width="1.6"/><circle cx="2" cy="32" r="2.4" fill="#ffd166"/>
      <path d="M-30 48q-14 4-24-4" stroke="#2f6b3a" stroke-width="7" stroke-linecap="round" fill="none"/>
    </g>
  </svg>`;
}
// Takt-Anzeige: Halbkreis, grüne Zone, Nadel (Werte 0..2,5 Umdrehungen/s)
export function gauge(center, width, value, live = true) {
  const MAX = 2.5;
  const ang = (v) => Math.PI * (1 - Math.min(MAX, Math.max(0, v)) / MAX);
  const pt = (v, r) => [120 + Math.cos(ang(v)) * r, 120 - Math.sin(ang(v)) * r];
  const [a1x, a1y] = pt(center - width, 96), [a2x, a2y] = pt(center + width, 96);
  const [nx, ny] = pt(value, 88);
  return `<svg class="k2-gauge" viewBox="0 0 240 140" focusable="false" aria-label="Takt">
    <path d="M24 120a96 96 0 0 1 192 0" fill="none" stroke="#3a2a20" stroke-width="18"/>
    <path d="M${a1x} ${a1y}A96 96 0 0 1 ${a2x} ${a2y}" fill="none" stroke="#2fa35a" stroke-width="18"/>
    <text x="24" y="136" font-size="11" fill="#9aa3ab">langsam</text><text x="216" y="136" font-size="11" fill="#9aa3ab" text-anchor="end">schnell</text>
    ${live ? `<path class="k2-needle" d="M120 120L${nx} ${ny}" stroke="#ffd166" stroke-width="4" stroke-linecap="round"/>` : ''}
    <circle cx="120" cy="120" r="7" fill="#ffd166"/>
  </svg>`;
}

// =====================================================================
// Finale: Kasperls Brust mit Naht
// =====================================================================
export function seamChest(progress = 0) {
  const y2 = 40 + progress * 150;
  return `<svg class="k2-chest" viewBox="0 0 200 220" focusable="false" aria-label="Kasperls Brust mit Naht">
    <path d="M30 220c0-120 20-200 70-210 50 10 70 90 70 210z" fill="#c4161c"/>
    <path d="M100 30v160" stroke="#5a0a0d" stroke-width="3"/>
    ${Array.from({ length: 11 }, (_, i) => { const y = 40 + i * 15; const cut = y < y2; return `<path d="M92 ${y}l16 6M108 ${y}l-16 6" stroke="${cut ? 'transparent' : '#f3e3b0'}" stroke-width="2.4" stroke-linecap="round"/>`; }).join('')}
    ${progress > 0 ? `<path d="M100 40V${y2}" stroke="#120806" stroke-width="${6 + progress * 10}" stroke-linecap="round"/>` : ''}
    ${progress >= 1 ? '<rect x="84" y="90" width="32" height="40" rx="2" fill="#efe4c8" transform="rotate(-6 100 110)"/>' : ''}
  </svg>`;
}
export const colorHex = (c) => COLORS[c].hex;
export { LIMB_IDX };
