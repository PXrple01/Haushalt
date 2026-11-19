// Escape-Abenteuer – Bilder: eine Szene pro Geschichte, Figuren für die Aufstellung, kleine Geräte-Teile.
import { COLORS } from './symbols.js';

const hex = (c) => COLORS[c]?.hex || c;
const star4 = (x, y, r) => `M${x} ${y - r} C${x + r * .12} ${y - r * .12} ${x + r * .12} ${y - r * .12} ${x + r} ${y} C${x + r * .12} ${y + r * .12} ${x + r * .12} ${y + r * .12} ${x} ${y + r} C${x - r * .12} ${y + r * .12} ${x - r * .12} ${y + r * .12} ${x - r} ${y} C${x - r * .12} ${y - r * .12} ${x - r * .12} ${y - r * .12} ${x} ${y - r} Z`;
const sparkles = (pts, fill = '#fff') => pts.map(([x, y, r], i) => `<path class="tw" style="--d:${(i * .37) % 2}s" d="${star4(x, y, r)}" fill="${fill}"/>`).join('');
const dotsField = (pts, fill = '#fff') => pts.map(([x, y, r], i) => `<circle class="tw" style="--d:${(i * .53) % 3}s" cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join('');

// ---------------------------------------------------------------------
// Szenen (viewBox 360×200, füllen ihre Box)
// ---------------------------------------------------------------------
const SCENES = {
  schloss: () => {
    const bands = ['#FF6B8B', '#FFA45C', '#FFD54D', '#7BE08F', '#5CC8FF', '#8E7BFF', '#C77DFF'];
    return `
    <defs>
      <linearGradient id="es-s1-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFC2E2"/><stop offset=".55" stop-color="#E2D6FF"/><stop offset="1" stop-color="#C4E6FF"/></linearGradient>
      <linearGradient id="es-s1-roof" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF9BD0"/><stop offset="1" stop-color="#E0559F"/></linearGradient>
      <linearGradient id="es-s1-wall" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#EFE2FF"/></linearGradient>
    </defs>
    <rect width="360" height="200" fill="url(#es-s1-sky)"/>
    <g class="sc-rainbow" fill="none" stroke-width="9.5" opacity=".9">${bands.map((c, i) => { const r = 196 - i * 9; return `<path d="M${180 - r} 222 A${r} ${r} 0 0 1 ${180 + r} 222" stroke="${c}"/>`; }).join('')}</g>
    <g class="sc-drift" fill="#fff" opacity=".95"><circle cx="40" cy="58" r="13"/><circle cx="58" cy="52" r="17"/><circle cx="78" cy="60" r="12"/><rect x="34" y="58" width="52" height="13" rx="6.5"/></g>
    <g class="sc-drift d2" fill="#fff" opacity=".9"><circle cx="292" cy="44" r="11"/><circle cx="308" cy="38" r="15"/><circle cx="326" cy="46" r="10"/><rect x="286" y="44" width="46" height="11" rx="5.5"/></g>
    <g stroke="#B58BE6" stroke-width="2" stroke-linejoin="round">
      <rect x="110" y="96" width="32" height="104" fill="url(#es-s1-wall)"/>
      <rect x="218" y="96" width="32" height="104" fill="url(#es-s1-wall)"/>
      <rect x="138" y="112" width="84" height="88" fill="url(#es-s1-wall)"/>
      <rect x="164" y="58" width="32" height="56" fill="url(#es-s1-wall)"/>
      <path d="M104 98 L126 42 L148 98 Z" fill="url(#es-s1-roof)"/>
      <path d="M212 98 L234 38 L256 98 Z" fill="url(#es-s1-roof)"/>
      <path d="M158 60 L180 6 L202 60 Z" fill="url(#es-s1-roof)"/>
      <path d="M132 112 H228" />
    </g>
    <path class="sc-flag" d="M126 42 V26 L140 31 L126 36" fill="#FFD54D" stroke="#E0A92A" stroke-width="1.5"/>
    <path class="sc-flag d2" d="M234 38 V22 L248 27 L234 32" fill="#7BE08F" stroke="#4FB868" stroke-width="1.5"/>
    <path class="sc-flag d3" d="M180 6 V-8 L194 -3 L180 2" fill="#5CC8FF"/>
    <path d="M168 200 V174 A12 12 0 0 1 192 174 V200 Z" fill="#B57BFF" stroke="#8E5BDB" stroke-width="2"/>
    <circle cx="187" cy="188" r="2" fill="#FFD54D"/>
    <g fill="#CDB8F5"><path d="M118 130 V122 A6 6 0 0 1 130 122 V130 Z"/><path d="M226 130 V122 A6 6 0 0 1 238 122 V130 Z"/><path d="M150 150 V142 A6 6 0 0 1 162 142 V150 Z"/><path d="M198 150 V142 A6 6 0 0 1 210 142 V150 Z"/></g>
    <path class="sc-glow" d="M173 92 V80 A7 7 0 0 1 187 80 V92 Z" fill="#FFE27A" stroke="#E7A93A" stroke-width="2"/>
    <path d="M180 133 l-4.5 -4.5 a3.2 3.2 0 0 1 4.5 -4 a3.2 3.2 0 0 1 4.5 4 z" fill="#FF8CC8"/>
    <g class="sc-drift d3" fill="#fff"><circle cx="20" cy="196" r="22"/><circle cx="52" cy="190" r="26"/><circle cx="88" cy="198" r="20"/><circle cx="270" cy="198" r="22"/><circle cx="305" cy="190" r="27"/><circle cx="342" cy="196" r="22"/></g>
    ${sparkles([[64, 104, 6], [296, 92, 7], [330, 130, 5], [32, 128, 5], [252, 16, 6], [104, 22, 5]], '#fff')}`;
  },
  tokio: () => `
    <defs>
      <linearGradient id="es-s2-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B0522"/><stop offset=".6" stop-color="#2A0F55"/><stop offset="1" stop-color="#4D1773"/></linearGradient>
      <radialGradient id="es-s2-moon" cx=".5" cy=".5" r=".5"><stop offset=".55" stop-color="#FFE3F4"/><stop offset=".72" stop-color="#FF8CCB" stop-opacity=".45"/><stop offset="1" stop-color="#FF3DAE" stop-opacity="0"/></radialGradient>
      <linearGradient id="es-s2-street" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2B0E4D"/><stop offset="1" stop-color="#0B0522"/></linearGradient>
    </defs>
    <rect width="360" height="200" fill="url(#es-s2-sky)"/>
    ${dotsField([[20, 20, 1], [70, 36, 1.2], [120, 14, 1], [160, 40, .9], [210, 18, 1.1], [340, 26, 1], [318, 70, .9]], '#FFD6F0')}
    <circle cx="280" cy="48" r="44" fill="url(#es-s2-moon)"/>
    <g fill="#1E0A45"><rect x="0" y="92" width="34" height="108"/><rect x="30" y="70" width="28" height="130"/><rect x="62" y="104" width="40" height="96"/><rect x="232" y="84" width="30" height="116"/><rect x="262" y="60" width="26" height="140"/><rect x="292" y="98" width="70" height="102"/><path d="M106 96 L126 78 L146 96 Z"/><rect x="110" y="96" width="32" height="104"/></g>
    <g fill="#13062E">
      <rect x="-4" y="122" width="58" height="78" rx="3"/><rect x="58" y="134" width="44" height="66" rx="3"/>
      <rect x="150" y="112" width="64" height="88" rx="3"/><rect x="218" y="128" width="46" height="72" rx="3"/><rect x="300" y="118" width="64" height="82" rx="3"/>
    </g>
    <g class="sc-blink"><rect x="6" y="132" width="8" height="5" fill="#FF3DAE"/><rect x="20" y="132" width="8" height="5" fill="#38E8FF"/><rect x="34" y="146" width="8" height="5" fill="#FFD36E"/><rect x="66" y="146" width="7" height="5" fill="#38E8FF"/><rect x="160" y="124" width="8" height="5" fill="#FFD36E"/><rect x="190" y="138" width="8" height="5" fill="#FF3DAE"/><rect x="228" y="140" width="7" height="5" fill="#38E8FF"/><rect x="312" y="130" width="8" height="5" fill="#FF3DAE"/><rect x="340" y="144" width="8" height="5" fill="#FFD36E"/></g>
    <g class="sc-neon" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <rect x="78" y="58" width="16" height="64" rx="8" stroke="#FF3DAE" stroke-width="3"/>
      <path d="M86 68 V78 M82 88 H90 M86 96 V110" stroke="#FFD6F0" stroke-width="2.2"/>
      <path d="M163 66 L170 50 L177 60 H189 L196 50 L203 66 C206 82 196 94 183 94 C170 94 160 82 163 66 Z" stroke="#38E8FF" stroke-width="3"/>
      <path d="M168 72 H180 M186 72 H198 M168 72 C168 78 178 78 180 72 M186 72 C186 78 196 78 198 72" stroke="#FF3DAE" stroke-width="2.4"/>
      <path d="M176 84 Q183 88 190 84" stroke="#38E8FF" stroke-width="2.2"/>
      <path d="M318 80 l-7 -7 a5 5 0 0 1 7 -6.5 a5 5 0 0 1 7 6.5 z" stroke="#FF3DAE" stroke-width="2.6"/>
    </g>
    <path d="M0 162 H360" stroke="#38E8FF" stroke-width="2" opacity=".55"/>
    <g class="sc-train"><rect x="0" y="148" width="92" height="13" rx="6.5" fill="#F1E8FF"/><rect x="10" y="151" width="70" height="5" rx="2.5" fill="#38E8FF"/><path d="M86 148 Q96 154 86 161" fill="#FF3DAE"/></g>
    <rect y="164" width="360" height="36" fill="url(#es-s2-street)"/>
    <g opacity=".5"><rect x="6" y="168" width="8" height="18" fill="#FF3DAE" opacity=".4"/><rect x="160" y="170" width="8" height="16" fill="#FFD36E" opacity=".35"/><rect x="312" y="168" width="8" height="18" fill="#38E8FF" opacity=".35"/></g>
    <g class="sc-rain" stroke="#B9A8FF" stroke-width="1" opacity=".55">${Array.from({ length: 26 }, (_, i) => { const x = (i * 53) % 380 - 10, y = (i * 37) % 180; return `<path d="M${x} ${y} l-5 14"/>`; }).join('')}</g>`,
  lebkuchen: () => `
    <defs>
      <linearGradient id="es-s3-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFC9A3"/><stop offset=".7" stop-color="#FFE6CC"/><stop offset="1" stop-color="#FFF4E6"/></linearGradient>
      <linearGradient id="es-s3-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C77A3E"/><stop offset="1" stop-color="#A65E2A"/></linearGradient>
    </defs>
    <rect width="360" height="200" fill="url(#es-s3-sky)"/>
    <circle cx="300" cy="44" r="20" fill="#FFF3D1"/>
    <path d="M0 168 Q90 146 180 162 T360 156 V200 H0 Z" fill="#FFFFFF"/>
    <g class="sc-sway"><path d="M38 170 V120" stroke="#fff" stroke-width="5"/><path d="M38 170 V120" stroke="#E2453C" stroke-width="5" stroke-dasharray="6 6"/><circle cx="38" cy="108" r="17" fill="#FF8CC8"/><path d="M38 108 m-11 0 a11 11 0 1 0 11 -11 a7 7 0 1 0 -7 7" fill="none" stroke="#fff" stroke-width="3"/></g>
    <g class="sc-sway d2"><path d="M322 172 V128" stroke="#fff" stroke-width="5"/><path d="M322 172 V128" stroke="#2FCB86" stroke-width="5" stroke-dasharray="6 6"/><circle cx="322" cy="116" r="15" fill="#7FD6FF"/><path d="M322 116 m-9 0 a9 9 0 1 0 9 -9 a6 6 0 1 0 -6 6" fill="none" stroke="#fff" stroke-width="3"/></g>
    <rect x="160" y="58" width="16" height="30" fill="#A65E2A" stroke="#7A3E1D" stroke-width="2"/>
    <g class="sc-smoke" fill="#fff" opacity=".85"><circle cx="168" cy="46" r="7"/><circle cx="176" cy="34" r="9"/><circle cx="170" cy="18" r="11"/></g>
    <rect x="112" y="104" width="136" height="80" rx="6" fill="url(#es-s3-wall)" stroke="#7A3E1D" stroke-width="2.5"/>
    <path d="M98 108 L180 46 L262 108 Z" fill="#8A4B22" stroke="#6B3415" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M98 108 L180 46 L262 108 Q254 116 246 108 Q238 118 228 108 Q220 116 212 108 Q202 118 194 108 Q186 116 178 108 Q170 118 160 108 Q152 116 144 108 Q136 118 126 108 Q118 116 110 108 Q104 114 98 108 Z" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>
    <g>${[[150, 88, '#FF6FB1'], [180, 74, '#2FCB86'], [210, 88, '#FFC21A'], [165, 98, '#3FA7FF'], [195, 98, '#FF6FB1'], [130, 100, '#FFC21A'], [230, 100, '#2FCB86']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="5" fill="${c}" stroke="#fff" stroke-width="2"/>`).join('')}</g>
    <path d="M164 184 V150 A16 16 0 0 1 196 150 V184 Z" fill="#6E3517" stroke="#fff" stroke-width="3"/>
    <circle cx="190" cy="168" r="2.6" fill="#FFC21A"/>
    <g class="sc-glow"><rect x="124" y="122" width="26" height="24" rx="5" fill="#FFE08A" stroke="#fff" stroke-width="3"/><rect x="210" y="122" width="26" height="24" rx="5" fill="#FFE08A" stroke="#fff" stroke-width="3"/></g>
    <path d="M137 122 V146 M124 134 H150 M223 122 V146 M210 134 H236" stroke="#fff" stroke-width="2.5"/>
    <path d="M112 184 Q122 176 132 184 T152 184 T172 184 T192 184 T212 184 T232 184 T248 184" fill="none" stroke="#fff" stroke-width="4"/>
    <g>${[[96, 182, '#FF6FB1'], [262, 184, '#9B6BFF'], [278, 180, '#FFC21A']].map(([x, y, c]) => `<path d="M${x - 9} ${y} a9 10 0 0 1 18 0 Z" fill="${c}" stroke="#fff" stroke-width="2"/>`).join('')}</g>
    <g class="sc-snow" fill="#fff">${Array.from({ length: 22 }, (_, i) => `<circle cx="${(i * 47) % 360}" cy="${(i * 29) % 160}" r="${1.4 + (i % 3) * .7}"/>`).join('')}</g>`,
  meer: () => `
    <defs>
      <linearGradient id="es-s4-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1590A6"/><stop offset=".55" stop-color="#0A5679"/><stop offset="1" stop-color="#05304C"/></linearGradient>
      <linearGradient id="es-s4-dome" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFD0E8"/><stop offset="1" stop-color="#FF7FBF"/></linearGradient>
      <linearGradient id="es-s4-dome2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C6FFF5"/><stop offset="1" stop-color="#45D9C4"/></linearGradient>
    </defs>
    <rect width="360" height="200" fill="url(#es-s4-sea)"/>
    <g class="sc-rays" fill="#fff"><path d="M40 0 H70 L130 200 H70 Z" opacity=".07"/><path d="M150 0 H170 L210 200 H170 Z" opacity=".06"/><path d="M260 0 H296 L330 200 H260 Z" opacity=".07"/></g>
    <path d="M0 176 Q60 164 120 172 T240 170 T360 168 V200 H0 Z" fill="#E9CB8B"/>
    <g stroke="#3E9FB0" stroke-width="2">
      <rect x="128" y="104" width="104" height="72" fill="#E6FBFF"/>
      <rect x="112" y="122" width="20" height="54" fill="#D2F3FA"/><rect x="228" y="122" width="20" height="54" fill="#D2F3FA"/>
      <path d="M140 104 C140 74 180 52 180 34 C180 52 220 74 220 104 Z" fill="url(#es-s4-dome)"/>
      <path d="M108 124 C108 108 122 98 122 88 C122 98 136 108 136 124 Z" fill="url(#es-s4-dome2)"/>
      <path d="M224 124 C224 108 238 98 238 88 C238 98 252 108 252 124 Z" fill="url(#es-s4-dome2)"/>
    </g>
    <circle class="sc-glow" cx="180" cy="28" r="5" fill="#FFF3B0"/>
    <path d="M166 176 V150 A14 14 0 0 1 194 150 V176 Z" fill="#1C7C93" stroke="#3E9FB0" stroke-width="2"/>
    <g fill="#BDEFF7"><circle cx="152" cy="128" r="6"/><circle cx="208" cy="128" r="6"/><circle cx="180" cy="122" r="7"/></g>
    <path d="M180 66 m-6 6 a6 6 0 0 1 12 0 l-6 8 z" fill="#FFF3B0" opacity=".8"/>
    <g class="sc-sway" fill="none" stroke-linecap="round"><path d="M30 196 C20 170 44 160 32 130 C24 112 40 100 34 84" stroke="#2FCB86" stroke-width="7"/><path d="M52 196 C46 178 62 168 54 150" stroke="#45D9C4" stroke-width="6"/></g>
    <g class="sc-sway d2" fill="none" stroke-linecap="round"><path d="M318 196 C330 172 308 160 322 134 C330 118 316 106 324 90" stroke="#2FCB86" stroke-width="7"/><path d="M300 196 C306 180 292 170 300 152" stroke="#FF8CC6" stroke-width="6"/></g>
    <g class="sc-swim"><path d="M60 64 C70 54 88 54 96 64 C88 74 70 74 60 64 Z M96 64 L106 56 V72 Z" fill="#FFC21A"/><circle cx="68" cy="62" r="2" fill="#05304C"/></g>
    <g class="sc-swim d2"><path d="M300 84 C290 76 276 76 270 84 C276 92 290 92 300 84 Z M270 84 L262 78 V90 Z" fill="#FF8CC6"/><circle cx="294" cy="82" r="1.8" fill="#05304C"/></g>
    <g class="sc-bubbles" fill="none" stroke="#E9FFFB" stroke-width="1.5" opacity=".8">${[[90, 180, 4], [96, 160, 3], [250, 176, 5], [262, 150, 3], [200, 186, 3], [120, 150, 2.5], [330, 150, 4]].map(([x, y, r], i) => `<circle style="--d:${i * .6}s" cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`,
  mond: () => `
    <defs>
      <linearGradient id="es-s5-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#04081F"/><stop offset="1" stop-color="#1D2A63"/></linearGradient>
      <linearGradient id="es-s5-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#CBD0E3"/><stop offset="1" stop-color="#8E94B3"/></linearGradient>
      <radialGradient id="es-s5-dome" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#E9F7FF" stop-opacity=".95"/><stop offset="1" stop-color="#7FD6FF" stop-opacity=".55"/></radialGradient>
    </defs>
    <rect width="360" height="200" fill="url(#es-s5-sky)"/>
    ${dotsField([[14, 18, 1.2], [44, 50, .9], [80, 22, 1.4], [118, 60, 1], [150, 16, 1.1], [196, 40, 1.3], [232, 14, .9], [250, 70, 1], [340, 92, 1.2], [20, 96, 1], [100, 100, .8], [170, 84, 1], [330, 20, 1]], '#FFFFFF')}
    <g class="sc-spin"><circle cx="292" cy="46" r="24" fill="#3FA7FF"/><path d="M276 36 C284 30 292 38 288 46 C284 52 276 50 274 44 Z M296 54 C304 50 312 54 310 62 C304 66 296 62 296 54 Z M300 28 C306 28 310 34 306 38 C300 38 298 32 300 28 Z" fill="#2FCB86"/><circle cx="292" cy="46" r="24" fill="none" stroke="#BFE6FF" stroke-width="3" opacity=".6"/></g>
    <path d="M0 150 Q70 128 150 142 T300 136 T360 140 V200 H0 Z" fill="url(#es-s5-ground)"/>
    <g fill="#9EA4C2"><ellipse cx="60" cy="172" rx="24" ry="7"/><ellipse cx="200" cy="184" rx="30" ry="8"/><ellipse cx="320" cy="168" rx="18" ry="5"/><ellipse cx="128" cy="160" rx="12" ry="4"/></g>
    <g fill="#B5BAD2"><ellipse cx="60" cy="170" rx="20" ry="5"/><ellipse cx="200" cy="182" rx="25" ry="6"/></g>
    <rect x="70" y="128" width="40" height="22" rx="8" fill="#E8ECF8" stroke="#6E7BB0" stroke-width="2"/>
    <path d="M100 150 A42 42 0 0 1 184 150 Z" fill="url(#es-s5-dome)" stroke="#6E7BB0" stroke-width="2"/>
    <path d="M142 108 V150 M114 124 Q142 116 170 124 M104 140 Q142 132 180 140" fill="none" stroke="#6E7BB0" stroke-width="1.5" opacity=".7"/>
    <rect x="80" y="134" width="8" height="8" rx="2" fill="#FFC94D"/><rect x="94" y="134" width="8" height="8" rx="2" fill="#FFC94D"/>
    <path d="M182 150 V100 M182 100 L170 92 M182 100 L194 92" stroke="#E8ECF8" stroke-width="3" stroke-linecap="round"/>
    <circle class="sc-blink" cx="182" cy="98" r="4" fill="#FF6B5E"/>
    <g class="sc-hover">
      <path d="M262 150 H302 L296 142 H268 Z" fill="#6E7BB0"/>
      <path d="M282 56 C296 70 300 96 296 128 H268 C264 96 268 70 282 56 Z" fill="#F4F6FF" stroke="#6E7BB0" stroke-width="2"/>
      <path d="M268 112 L256 134 L268 130 Z M296 112 L308 134 L296 130 Z" fill="#FF6B5E"/>
      <circle cx="282" cy="92" r="8" fill="#7FD6FF" stroke="#6E7BB0" stroke-width="2.5"/>
      <path d="M274 128 H290 L286 140 H278 Z" fill="#B5BAD2"/>
    </g>`,
  spuk: () => `
    <defs>
      <linearGradient id="es-s6-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0E0719"/><stop offset=".7" stop-color="#2E1A49"/><stop offset="1" stop-color="#3D2460"/></linearGradient>
      <radialGradient id="es-s6-moon" cx=".5" cy=".5" r=".5"><stop offset=".6" stop-color="#FBF3CF"/><stop offset=".75" stop-color="#FBF3CF" stop-opacity=".25"/><stop offset="1" stop-color="#FBF3CF" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="360" height="200" fill="url(#es-s6-sky)"/>
    <circle cx="268" cy="54" r="46" fill="url(#es-s6-moon)"/>
    <g class="sc-bats" fill="#0B0614"><path d="M90 40 q6 -6 10 0 q4 -6 10 0 q-6 -2 -10 5 q-4 -7 -10 -5 z"/><path d="M220 30 q5 -5 8 0 q3 -5 8 0 q-5 -1.5 -8 4 q-3 -5.5 -8 -4 z"/><path d="M300 92 q5 -5 8 0 q3 -5 8 0 q-5 -1.5 -8 4 q-3 -5.5 -8 -4 z"/></g>
    <path d="M30 200 V150 Q34 120 26 98 M30 150 Q48 128 62 126 M28 120 Q12 110 6 92 M44 134 Q56 112 52 96" fill="none" stroke="#0B0614" stroke-width="6" stroke-linecap="round"/>
    <g fill="#120A20">
      <path d="M100 200 V112 L118 90 L136 112 V200 Z"/>
      <path d="M128 200 V120 H236 V200 Z"/>
      <path d="M124 122 L182 74 L240 122 Z"/>
      <path d="M226 200 V96 L246 64 L266 96 V200 Z"/>
      <rect x="174" y="62" width="10" height="20"/>
    </g>
    <g class="sc-flicker">
      <rect x="112" y="122" width="12" height="16" rx="6" fill="#FFD36E"/>
      <rect x="148" y="134" width="14" height="18" rx="3" fill="#B6F36B"/><rect x="200" y="134" width="14" height="18" rx="3" fill="#FFD36E"/>
      <rect x="240" y="104" width="12" height="16" rx="6" fill="#B6F36B"/><circle cx="182" cy="104" r="7" fill="#FFD36E"/>
    </g>
    <path d="M172 200 V172 A10 10 0 0 1 192 172 V200 Z" fill="#2B1840"/>
    <g class="sc-ghost"><path d="M300 150 V128 A16 16 0 0 1 332 128 V150 L327 145 L322 150 L316 145 L311 150 L305 145 Z" fill="#F3ECFF" opacity=".92"/><circle cx="310" cy="130" r="2.6" fill="#170D29"/><circle cx="322" cy="130" r="2.6" fill="#170D29"/><ellipse cx="316" cy="138" rx="2.6" ry="3.2" fill="#170D29"/></g>
    <g>${[[70, 186, 15], [262, 190, 11], [292, 192, 9]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * .8}" fill="#FF9E3D" stroke="#C96A14" stroke-width="2"/><path d="M${x} ${y - r * .8} q2 -6 6 -7" stroke="#2FCB86" stroke-width="3" fill="none"/><path class="sc-flicker" d="M${x - r * .45} ${y - 2} l3 -4 l3 4 Z M${x + r * .15} ${y - 2} l3 -4 l3 4 Z M${x - r * .4} ${y + 4} q${r * .4} ${r * .35} ${r * .8} 0" fill="#FFE27A" stroke="#FFE27A" stroke-width="1.4"/>`).join('')}</g>
    <path d="M0 196 H360" stroke="#120A20" stroke-width="8"/>
    <g fill="#120A20">${Array.from({ length: 9 }, (_, i) => `<path d="M${i * 40 + 6} 196 V176 l4 -6 l4 6 V196 Z"/>`).join('')}</g>`,
  pirat: () => `
    <defs>
      <linearGradient id="es-s7-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2B2D6E"/><stop offset=".55" stop-color="#C2557A"/><stop offset="1" stop-color="#FFB86B"/></linearGradient>
      <linearGradient id="es-s7-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1673A3"/><stop offset="1" stop-color="#0A2A4A"/></linearGradient>
    </defs>
    <rect width="360" height="200" fill="url(#es-s7-sky)"/>
    ${dotsField([[30, 20, 1], [90, 12, 1.2], [150, 30, .9], [220, 16, 1], [330, 26, 1.1]], '#FFE9F2')}
    <circle cx="262" cy="140" r="30" fill="#FFD36E"/>
    <circle cx="262" cy="140" r="40" fill="#FFD36E" opacity=".25"/>
    <g class="sc-gulls" fill="none" stroke="#3B1D4F" stroke-width="2" stroke-linecap="round"><path d="M70 50 q6 -6 12 0 q6 -6 12 0"/><path d="M110 70 q4 -4 8 0 q4 -4 8 0"/></g>
    <path d="M0 150 Q30 140 60 150 V200 H0 Z" fill="#E8C27A"/>
    <path d="M24 148 C22 120 26 104 34 92" stroke="#7A4A25" stroke-width="5" fill="none" stroke-linecap="round"/>
    <g fill="#2FCB86"><path d="M34 92 C20 84 8 88 2 96 C14 92 24 94 34 92 Z"/><path d="M34 92 C40 78 54 76 62 82 C52 82 42 86 34 92 Z"/><path d="M34 92 C30 78 34 68 42 62 C40 72 38 82 34 92 Z"/><path d="M34 92 C48 90 58 98 60 108 C52 98 44 94 34 92 Z"/></g>
    <rect y="146" width="360" height="54" fill="url(#es-s7-sea)"/>
    <g class="sc-ship">
      <path d="M118 150 H262 L248 176 H134 Z" fill="#7A4A25" stroke="#4E2B12" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M124 160 H256" stroke="#FFC94D" stroke-width="3"/>
      <g fill="#2B1709"><circle cx="150" cy="168" r="3"/><circle cx="172" cy="168" r="3"/><circle cx="194" cy="168" r="3"/><circle cx="216" cy="168" r="3"/></g>
      <path d="M170 150 V40 M218 150 V58" stroke="#4E2B12" stroke-width="4"/>
      <path d="M142 56 Q170 66 198 56 L196 106 Q170 114 144 106 Z" fill="#FFF3D6" stroke="#D9C39A" stroke-width="2"/>
      <path d="M146 112 Q170 120 194 112 L192 142 Q170 148 148 142 Z" fill="#FFF3D6" stroke="#D9C39A" stroke-width="2"/>
      <path d="M200 70 Q218 78 236 70 L234 112 Q218 118 202 112 Z" fill="#FFF3D6" stroke="#D9C39A" stroke-width="2"/>
      <path class="sc-flag" d="M170 40 H196 V58 H170 Z" fill="#1B1B2E"/>
      <path d="M177 54 L176 45 L180 48 H186 L190 45 L189 54 Q183 58 177 54 Z" fill="#fff"/>
    </g>
    <g class="sc-waves" fill="none" stroke="#7FD6FF" stroke-width="2.5" stroke-linecap="round" opacity=".7"><path d="M0 182 q15 -6 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0"/><path d="M-20 194 q15 -6 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0" opacity=".6"/></g>`,
};

export function scene(id, cls = '') {
  const f = SCENES[id] || SCENES.schloss;
  return `<svg class="scene sc-${id} ${cls}" viewBox="0 0 360 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${f()}</svg>`;
}

// ---------------------------------------------------------------------
// Figuren für die Aufstellung (viewBox 100×110): Farbe, Accessoire, Punkte
// ---------------------------------------------------------------------
const INK = '#3A1030';
const FIG = {
  lebkuchen: {
    body: (c) => `<path d="M50 46 C40 46 34 49 31 53 L15 58 C7 61 8 72 16 71 L30 67 L30 79 L22 97 C19 105 29 108 33 102 L50 85 L67 102 C71 108 81 105 78 97 L70 79 L70 67 L84 71 C92 72 93 61 85 58 L69 53 C66 49 60 46 50 46 Z" fill="${c}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="50" cy="30" r="18" fill="${c}" stroke="${INK}" stroke-width="2.5"/>
      <path d="M18 64 l3 -3 l3 3 l3 -3 M76 61 l3 3 l3 -3 l3 3 M26 96 l3 -3 l3 3 M68 93 l3 3 l3 -3" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="43" cy="28" r="2.8" fill="${INK}"/><circle cx="57" cy="28" r="2.8" fill="${INK}"/>
      <path d="M43 36 Q50 42 57 36" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
      <circle cx="38" cy="34" r="3" fill="#fff" opacity=".45"/><circle cx="62" cy="34" r="3" fill="#fff" opacity=".45"/>`,
    dots: [[50, 58], [50, 68], [50, 78]],
    dot: (x, y) => `<circle cx="${x}" cy="${y}" r="3.6" fill="#fff" stroke="${INK}" stroke-width="1.6"/>`,
    acc: {
      muetze: `<path d="M32 22 C36 4 58 -2 76 8 L66 14 C60 10 52 10 46 12 Z" fill="#5E2350" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M31 22 Q50 12 69 20 L68 26 Q50 18 32 28 Z" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="78" cy="8" r="5.5" fill="#fff" stroke="${INK}" stroke-width="2"/>`,
      fliege: `<path d="M50 49 L38 42 V56 Z M50 49 L62 42 V56 Z" fill="#5E2350" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><circle cx="50" cy="49" r="3.4" fill="#fff" stroke="${INK}" stroke-width="1.6"/>`,
      schal: `<path d="M33 44 Q50 54 67 44 L69 51 Q50 61 31 51 Z" fill="#fff" stroke="${INK}" stroke-width="2"/><path d="M38 47 V54 M46 50 V57 M54 50 V57 M62 47 V54" stroke="#5E2350" stroke-width="3"/><path d="M60 52 L66 70 L58 70 L54 54 Z" fill="#fff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
    },
  },
  fisch: {
    body: (c) => `<path d="M20 60 L4 44 V76 Z" fill="${c}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M40 38 Q52 22 66 36 Z" fill="${c}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      <ellipse cx="52" cy="60" rx="36" ry="25" fill="${c}" stroke="${INK}" stroke-width="2.5"/>
      <path d="M40 78 Q46 90 54 82" fill="${c}" stroke="${INK}" stroke-width="2.5"/>
      <path d="M32 50 q5 6 0 12 M40 46 q6 8 0 18" fill="none" stroke="${INK}" stroke-width="1.6" opacity=".3"/>
      <circle cx="72" cy="54" r="7.5" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="74" cy="55" r="3.6" fill="${INK}"/><circle cx="75.5" cy="53.5" r="1.2" fill="#fff"/>
      <path d="M80 68 Q84 70 87 66" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="94" cy="44" r="2.6" fill="none" stroke="#fff" stroke-width="1.4"/><circle cx="96" cy="34" r="1.8" fill="none" stroke="#fff" stroke-width="1.2"/>`,
    dots: [[46, 66], [56, 72], [36, 70]],
    dot: (x, y) => `<circle cx="${x}" cy="${y}" r="4" fill="#fff" opacity=".9" stroke="${INK}" stroke-width="1.4"/>`,
    acc: {
      krone: `<path d="M58 36 L56 22 L63 28 L69 18 L75 28 L82 22 L80 36 Z" fill="#E6EDF5" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><circle cx="69" cy="31" r="2.6" fill="#FF4F5E"/>`,
      brille: `<path d="M22 50 Q50 42 88 52" fill="none" stroke="#5E2350" stroke-width="3.5"/><rect x="62" y="44" width="21" height="18" rx="7" fill="rgba(255,255,255,.45)" stroke="#5E2350" stroke-width="3.5"/>`,
      schleife: `<path d="M50 34 L40 26 V42 Z M50 34 L60 26 V42 Z" fill="#fff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><circle cx="50" cy="34" r="3.4" fill="#5E2350"/>`,
    },
  },
  geist: {
    body: (c) => `<path d="M18 100 V52 A32 32 0 0 1 82 52 V100 L74 92 L66 100 L58 92 L50 100 L42 92 L34 100 L26 92 Z" fill="${c}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M26 54 A24 24 0 0 1 44 30" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".55"/>
      <ellipse cx="40" cy="54" rx="5" ry="7" fill="${INK}"/><ellipse cx="60" cy="54" rx="5" ry="7" fill="${INK}"/>
      <circle cx="41.5" cy="51.5" r="1.6" fill="#fff"/><circle cx="61.5" cy="51.5" r="1.6" fill="#fff"/>
      <ellipse cx="50" cy="68" rx="4" ry="5" fill="${INK}"/>
      <ellipse cx="32" cy="64" rx="4.5" ry="2.8" fill="#fff" opacity=".45"/><ellipse cx="68" cy="64" rx="4.5" ry="2.8" fill="#fff" opacity=".45"/>`,
    dots: [[34, 82], [64, 80], [48, 86]],
    dot: (x, y) => `<circle cx="${x}" cy="${y}" r="4.2" fill="#fff" opacity=".85" stroke="${INK}" stroke-width="1.4"/>`,
    acc: {
      zylinder: `<rect x="34" y="4" width="32" height="20" rx="3" fill="#1B1B2E" stroke="${INK}" stroke-width="2"/><rect x="26" y="22" width="48" height="6" rx="3" fill="#1B1B2E" stroke="${INK}" stroke-width="2"/><rect x="34" y="16" width="32" height="5" fill="#9B6BFF"/>`,
      kette: `<path d="M22 70 Q50 84 80 72" fill="none" stroke="#8E8AA6" stroke-width="2.4" stroke-dasharray="5 3"/><circle cx="80" cy="74" r="5" fill="none" stroke="#8E8AA6" stroke-width="3"/><path d="M84 78 L94 92" stroke="#8E8AA6" stroke-width="3"/><circle cx="96" cy="96" r="6" fill="#8E8AA6"/>`,
      monokel: `<circle cx="60" cy="54" r="10" fill="rgba(255,255,255,.35)" stroke="#5E2350" stroke-width="3"/><path d="M69 59 Q76 72 72 84" fill="none" stroke="#5E2350" stroke-width="1.8"/>`,
    },
  },
  katze: {
    body: (c) => `<path d="M76 92 C96 90 98 66 86 62" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round"/><path d="M76 92 C96 90 98 66 86 62" fill="none" stroke="${c}" stroke-width="6.5" stroke-linecap="round"/>
      <ellipse cx="50" cy="80" rx="28" ry="24" fill="${c}" stroke="${INK}" stroke-width="2.5"/>
      <path d="M26 26 L28 6 L42 18 Z M74 26 L72 6 L58 18 Z" fill="${c}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M30 20 L30 12 L37 18 Z M70 20 L70 12 L63 18 Z" fill="#FFB8DB"/>
      <ellipse cx="50" cy="36" rx="28" ry="23" fill="${c}" stroke="${INK}" stroke-width="2.5"/>
      <path d="M38 36 Q42 31 46 36 M54 36 Q58 31 62 36" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
      <path d="M47 42 H53 L50 46 Z" fill="#FF6FB1"/><path d="M45 48 Q47.5 51 50 48 Q52.5 51 55 48" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
      <path d="M30 42 L18 40 M30 46 L19 49 M70 42 L82 40 M70 46 L81 49" stroke="${INK}" stroke-width="1.4" opacity=".6"/>
      <path d="M40 98 v-8 M60 98 v-8" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity=".5"/>`,
    dots: [[40, 76], [58, 72], [50, 88]],
    dot: (x, y) => `<circle cx="${x}" cy="${y}" r="4.6" fill="${INK}" opacity=".55"/>`,
    acc: {
      klappe: `<path d="M24 26 L76 46" stroke="${INK}" stroke-width="2.4"/><ellipse cx="42" cy="35" rx="8" ry="7" fill="${INK}"/>`,
      tuch: `<path d="M24 26 Q50 2 76 26 Q50 18 24 26 Z" fill="#E2453C" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><circle cx="40" cy="16" r="1.8" fill="#fff"/><circle cx="52" cy="12" r="1.8" fill="#fff"/><circle cx="62" cy="17" r="1.8" fill="#fff"/><path d="M74 24 L86 18 L84 30 Z" fill="#E2453C" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
      ring: `<circle cx="74" cy="30" r="6" fill="none" stroke="#DADDE8" stroke-width="3"/><circle cx="74" cy="30" r="6" fill="none" stroke="${INK}" stroke-width="1" opacity=".5"/>`,
    },
  },
};

export function figure(kind, p, cls = '') {
  const F = FIG[kind] || FIG.geist;
  const c = hex(p.c);
  const dots = F.dots.slice(0, p.d).map(([x, y]) => F.dot(x, y)).join('');
  return `<svg class="fig fig-${kind} ${cls}" viewBox="0 0 100 110" aria-hidden="true">${F.body(c)}${dots}${F.acc[p.a] || ''}</svg>`;
}

// Silhouette für den Steckbrief
export function silhouette(kind) {
  const F = FIG[kind] || FIG.geist;
  return `<svg class="fig sil" viewBox="0 0 100 110" aria-hidden="true">${F.body('#00000022').replace(/stroke="#3A1030"/g, 'stroke="currentColor"')}</svg>`;
}

// ---------------------------------------------------------------------
// Kleine Bauteile
// ---------------------------------------------------------------------
export function gem(color, cls = '') {
  const c = hex(color);
  return `<svg class="gem ${cls}" viewBox="0 0 60 60" aria-hidden="true">
    <path d="M14 8 H46 L58 24 L30 56 L2 24 Z" fill="${c}" stroke="rgba(0,0,0,.35)" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M2 24 H58 M20 8 L16 24 L30 56 M40 8 L44 24 L30 56" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="2"/>
    <path d="M16 12 L22 12 L18 22 L8 22 Z" fill="#fff" opacity=".7"/></svg>`;
}

export function crystal(color, cls = '') {
  const c = hex(color);
  return `<svg class="crys ${cls}" viewBox="0 0 60 90" aria-hidden="true">
    <path d="M30 2 L50 24 L44 80 L30 88 L16 80 L10 24 Z" fill="${c}" stroke="rgba(0,0,0,.3)" stroke-width="2" stroke-linejoin="round"/>
    <path d="M30 2 L30 88 M10 24 L30 34 L50 24" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="2"/>
    <path d="M20 24 L26 30 L22 66 L16 62 Z" fill="#fff" opacity=".45"/></svg>`;
}

export function candle(lit) {
  return `<svg class="candle ${lit ? 'lit' : ''}" viewBox="0 0 40 70" aria-hidden="true">
    ${lit ? '<ellipse class="cd-glow" cx="20" cy="18" rx="16" ry="18" fill="#FFD36E" opacity=".35"/><path class="cd-flame" d="M20 4 C26 14 28 20 20 28 C12 20 14 14 20 4 Z" fill="#FFC21A"/><path d="M20 14 C23 19 23 22 20 26 C17 22 17 19 20 14 Z" fill="#FFF3B0"/>' : '<path class="cd-smoke" d="M20 26 C14 20 26 14 20 6" fill="none" stroke="#B9B2C9" stroke-width="2" stroke-linecap="round" opacity=".7"/>'}
    <path d="M20 26 V32" stroke="#3A1030" stroke-width="2"/>
    <rect x="11" y="32" width="18" height="30" rx="3" fill="#FFF7EC" stroke="#3A1030" stroke-width="2"/>
    <path d="M11 38 Q16 42 18 37 Q22 44 25 38 Q27 41 29 39" fill="#FFE6C9" stroke="none"/>
    <rect x="6" y="60" width="28" height="7" rx="3.5" fill="#C9A86B" stroke="#3A1030" stroke-width="2"/></svg>`;
}
