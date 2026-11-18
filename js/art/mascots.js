// Maskottchen: Kiki (Einhorn, Baby-Theme) und Kuro (Katze, Lila-Theme).
// Stimmungen über data-mood: idle | happy | shock | sad | hide (Augen zuhalten) | cheer
// Die Gesichtsteile sind Gruppen, CSS (screens.css) blendet je nach Stimmung um.

const PLUM = '#5E2350';

function kiki(uid) {
  return `
  <defs>
    <linearGradient id="${uid}-horn" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFF4B8"/><stop offset=".55" stop-color="#FFD966"/><stop offset="1" stop-color="#FFB547"/>
    </linearGradient>
    <linearGradient id="${uid}-body" x1="0" y1="0" x2="1" y2="1">
      <stop offset=".45" stop-color="#FFFFFF"/><stop offset="1" stop-color="#EEE3FF"/>
    </linearGradient>
  </defs>
  <g class="m-tail">
    <circle cx="150" cy="156" r="13" fill="#FFA6D2" stroke="#F07DB9" stroke-width="2.5"/>
    <circle cx="160" cy="140" r="11" fill="#C9B2FF" stroke="#A88BF0" stroke-width="2.5"/>
    <circle cx="164" cy="124" r="9" fill="#9FDCFF" stroke="#72C2F0" stroke-width="2.5"/>
    <circle cx="160" cy="110" r="7" fill="#A8F0D0" stroke="#74D9AE" stroke-width="2.5"/>
  </g>
  <ellipse cx="100" cy="160" rx="44" ry="33" fill="url(#${uid}-body)" stroke="${PLUM}" stroke-width="3"/>
  <g class="m-legs">
    <rect x="73" y="166" width="21" height="28" rx="10.5" fill="#fff" stroke="${PLUM}" stroke-width="3"/>
    <rect x="106" y="166" width="21" height="28" rx="10.5" fill="#fff" stroke="${PLUM}" stroke-width="3"/>
    <path d="M74.5 184h18v1.5a7.5 7.5 0 0 1-7.5 7.5h-3a7.5 7.5 0 0 1-7.5-7.5z" fill="#FFB8DB"/>
    <path d="M107.5 184h18v1.5a7.5 7.5 0 0 1-7.5 7.5h-3a7.5 7.5 0 0 1-7.5-7.5z" fill="#FFB8DB"/>
  </g>
  <g class="m-mane-back">
    <circle cx="62" cy="62" r="16" fill="#FFA6D2" stroke="#F07DB9" stroke-width="2.5"/>
    <circle cx="48" cy="82" r="15" fill="#C9B2FF" stroke="#A88BF0" stroke-width="2.5"/>
    <circle cx="44" cy="104" r="14" fill="#9FDCFF" stroke="#72C2F0" stroke-width="2.5"/>
    <circle cx="50" cy="124" r="12" fill="#A8F0D0" stroke="#74D9AE" stroke-width="2.5"/>
    <circle cx="62" cy="140" r="10" fill="#FFE58F" stroke="#F2C94C" stroke-width="2.5"/>
  </g>
  <g class="m-ears">
    <path d="M60 64 L54 24 L88 46 Z" fill="#fff" stroke="${PLUM}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M63 54 L60 34 L78 46 Z" fill="#FFC2E0"/>
    <path d="M140 64 L146 24 L112 46 Z" fill="#fff" stroke="${PLUM}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M137 54 L140 34 L122 46 Z" fill="#FFC2E0"/>
  </g>
  <ellipse cx="100" cy="94" rx="56" ry="49" fill="#fff" stroke="${PLUM}" stroke-width="3"/>
  <path class="m-horn" d="M89.5 50 L100 6 L110.5 50 Z" fill="url(#${uid}-horn)" stroke="${PLUM}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M92.5 40.5 L106.5 35.5 M94.8 30.5 L104.6 27 M97 20.5 L102.6 18.6" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".9"/>
  <g class="m-mane-front">
    <circle cx="84" cy="50" r="13" fill="#FFA6D2" stroke="#F07DB9" stroke-width="2.5"/>
    <circle cx="71" cy="57" r="11" fill="#C9B2FF" stroke="#A88BF0" stroke-width="2.5"/>
    <circle cx="117" cy="51" r="10" fill="#A8F0D0" stroke="#74D9AE" stroke-width="2.5"/>
    <circle cx="128" cy="57" r="8" fill="#9FDCFF" stroke="#72C2F0" stroke-width="2.5"/>
  </g>
  <g class="m-cheeks">
    <ellipse cx="62" cy="114" rx="10" ry="6" fill="#FF8CC6" opacity=".5"/>
    <ellipse cx="138" cy="114" rx="10" ry="6" fill="#FF8CC6" opacity=".5"/>
  </g>
  <g class="e-open">
    <ellipse cx="78" cy="97" rx="8.5" ry="11" fill="#3A1030"/>
    <ellipse cx="122" cy="97" rx="8.5" ry="11" fill="#3A1030"/>
    <circle cx="81.2" cy="92" r="3.4" fill="#fff"/><circle cx="125.2" cy="92" r="3.4" fill="#fff"/>
    <circle cx="75.6" cy="101.5" r="1.7" fill="#fff"/><circle cx="119.6" cy="101.5" r="1.7" fill="#fff"/>
    <path d="M70.5 89 L65 85 M73 86 L69.5 80.5 M129.5 89 L135 85 M127 86 L130.5 80.5" stroke="#3A1030" stroke-width="2.6" stroke-linecap="round"/>
  </g>
  <g class="e-happy" fill="none" stroke="#3A1030" stroke-width="4.2" stroke-linecap="round">
    <path d="M69 99 Q78 86 87 99"/><path d="M113 99 Q122 86 131 99"/>
  </g>
  <g class="e-shock">
    <circle cx="78" cy="96" r="11" fill="#fff" stroke="#3A1030" stroke-width="3"/><circle cx="78" cy="97" r="4" fill="#3A1030"/>
    <circle cx="122" cy="96" r="11" fill="#fff" stroke="#3A1030" stroke-width="3"/><circle cx="122" cy="97" r="4" fill="#3A1030"/>
  </g>
  <g class="e-sad" fill="none" stroke="#3A1030" stroke-width="4" stroke-linecap="round">
    <path d="M69 94 Q78 103 87 94"/><path d="M113 94 Q122 103 131 94"/>
    <path d="M128 104 q5 9 0 13 q-5 -4 0 -13z" fill="#9FDCFF" stroke="none"/>
  </g>
  <path class="mo-smile" d="M91 113 Q95.5 118.5 100 113 Q104.5 118.5 109 113" fill="none" stroke="#3A1030" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <g class="mo-open"><path d="M90 112 Q100 130 110 112 Z" fill="#B3185E" stroke="#3A1030" stroke-width="2.6" stroke-linejoin="round"/><path d="M95 120 Q100 116 105 120 Q102 125 100 125 Q98 125 95 120z" fill="#FF8CC6"/></g>
  <ellipse class="mo-o" cx="100" cy="118" rx="5" ry="6.5" fill="#3A1030"/>
  <path class="mo-sad" d="M92 120 Q100 112 108 120" fill="none" stroke="#3A1030" stroke-width="3" stroke-linecap="round"/>
  <g class="m-paws">
    <path d="M58 168 Q50 132 76 104" fill="none" stroke="${PLUM}" stroke-width="24" stroke-linecap="round"/>
    <path d="M58 168 Q50 132 76 104" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round"/>
    <path d="M142 168 Q150 132 124 104" fill="none" stroke="${PLUM}" stroke-width="24" stroke-linecap="round"/>
    <path d="M142 168 Q150 132 124 104" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round"/>
    <ellipse cx="80" cy="98" rx="17" ry="14" fill="#fff" stroke="${PLUM}" stroke-width="3"/>
    <ellipse cx="120" cy="98" rx="17" ry="14" fill="#fff" stroke="${PLUM}" stroke-width="3"/>
    <path d="M65 92 a16 13 0 0 1 30 0" fill="#FFB8DB"/><path d="M105 92 a16 13 0 0 1 30 0" fill="#FFB8DB"/>
  </g>
  <path class="m-spark" d="M150 18 l3 -10 l3 10 l10 3 l-10 3 l-3 10 l-3 -10 l-10 -3 z" fill="#FFE27A" stroke="#F2B53C" stroke-width="1.5" stroke-linejoin="round"/>`;
}

function kuro(uid) {
  return `
  <defs>
    <radialGradient id="${uid}-eye" cx=".5" cy=".5" r=".6">
      <stop offset="0" stop-color="#E6FDFF"/><stop offset=".55" stop-color="#6FF3FF"/><stop offset="1" stop-color="#2BB8E6"/>
    </radialGradient>
    <filter id="${uid}-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g class="m-tail">
    <path d="M136 176 C178 176 186 136 160 116" fill="none" stroke="#7C4DFF" stroke-width="21" stroke-linecap="round"/>
    <path d="M136 176 C178 176 186 136 160 116" fill="none" stroke="#1E1140" stroke-width="15" stroke-linecap="round"/>
    <circle cx="160" cy="116" r="5" fill="#47E5FF" filter="url(#${uid}-glow)"/>
  </g>
  <ellipse cx="100" cy="160" rx="42" ry="33" fill="#1E1140" stroke="#7C4DFF" stroke-width="3"/>
  <path d="M136 146 Q144 160 136 178" fill="none" stroke="#47E5FF" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>
  <g class="m-legs">
    <ellipse cx="83" cy="189" rx="13" ry="8.5" fill="#1E1140" stroke="#7C4DFF" stroke-width="3"/>
    <ellipse cx="117" cy="189" rx="13" ry="8.5" fill="#1E1140" stroke="#7C4DFF" stroke-width="3"/>
  </g>
  <g class="m-ears">
    <path d="M55 82 L58 32 L92 58 Z" fill="#1E1140" stroke="#7C4DFF" stroke-width="3" stroke-linejoin="round"/>
    <path d="M62 70 L63 46 L80 59 Z" fill="#FF6FB5" opacity=".55"/>
    <path d="M145 82 L142 32 L108 58 Z" fill="#1E1140" stroke="#7C4DFF" stroke-width="3" stroke-linejoin="round"/>
    <path d="M138 70 L137 46 L120 59 Z" fill="#FF6FB5" opacity=".55"/>
  </g>
  <ellipse cx="100" cy="99" rx="55" ry="46" fill="#1E1140" stroke="#7C4DFF" stroke-width="3"/>
  <path d="M149 82 Q158 102 146 126" fill="none" stroke="#47E5FF" stroke-width="3" stroke-linecap="round" opacity=".85"/>
  <path d="M70 62 Q100 50 130 62" fill="none" stroke="#9B6BFF" stroke-width="2" stroke-linecap="round" opacity=".5"/>
  <g class="m-cheeks">
    <ellipse cx="62" cy="116" rx="9" ry="5" fill="#FF6FB5" opacity=".35"/>
    <ellipse cx="138" cy="116" rx="9" ry="5" fill="#FF6FB5" opacity=".35"/>
  </g>
  <g class="m-whisk" stroke="#B8A6E6" stroke-width="2" stroke-linecap="round" opacity=".75">
    <path d="M58 114 L34 109 M58 121 L36 124 M142 114 L166 109 M142 121 L164 124"/>
  </g>
  <g class="e-open" filter="url(#${uid}-glow)">
    <path d="M63 101 Q78 83 93 101 Q78 117 63 101 Z" fill="url(#${uid}-eye)"/>
    <path d="M107 101 Q122 83 137 101 Q122 117 107 101 Z" fill="url(#${uid}-eye)"/>
    <ellipse cx="78" cy="101" rx="2.8" ry="9.5" fill="#0B0520"/><ellipse cx="122" cy="101" rx="2.8" ry="9.5" fill="#0B0520"/>
    <circle cx="82.5" cy="96" r="2.2" fill="#fff"/><circle cx="126.5" cy="96" r="2.2" fill="#fff"/>
  </g>
  <g class="e-happy" fill="none" stroke="#6FF3FF" stroke-width="4.2" stroke-linecap="round" filter="url(#${uid}-glow)">
    <path d="M66 103 Q78 89 90 103"/><path d="M110 103 Q122 89 134 103"/>
  </g>
  <g class="e-shock" filter="url(#${uid}-glow)">
    <circle cx="78" cy="99" r="12" fill="url(#${uid}-eye)"/><circle cx="78" cy="99" r="3.5" fill="#0B0520"/>
    <circle cx="122" cy="99" r="12" fill="url(#${uid}-eye)"/><circle cx="122" cy="99" r="3.5" fill="#0B0520"/>
  </g>
  <g class="e-sad" fill="none" stroke="#6FF3FF" stroke-width="4" stroke-linecap="round" filter="url(#${uid}-glow)">
    <path d="M66 97 Q78 106 90 97"/><path d="M110 97 Q122 106 134 97"/>
    <path d="M131 108 q5 9 0 13 q-5 -4 0 -13z" fill="#6FF3FF" stroke="none"/>
  </g>
  <path d="M95.5 113 L104.5 113 L100 118.5 Z" fill="#FF6FB5"/>
  <path class="mo-smile" d="M91 122 Q95.5 127 100 122 Q104.5 127 109 122" fill="none" stroke="#D9CCFF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  <g class="mo-open"><path d="M91 121 Q100 136 109 121 Z" fill="#FF6FB5" stroke="#D9CCFF" stroke-width="2.2" stroke-linejoin="round"/></g>
  <ellipse class="mo-o" cx="100" cy="125" rx="4.5" ry="6" fill="#0B0520" stroke="#D9CCFF" stroke-width="2"/>
  <path class="mo-sad" d="M92 128 Q100 120 108 128" fill="none" stroke="#D9CCFF" stroke-width="2.6" stroke-linecap="round"/>
  <g class="m-collar">
    <path d="M66 140 Q100 156 134 140" fill="none" stroke="#FF6FB5" stroke-width="6" stroke-linecap="round"/>
    <path d="M100 145 l3.2 6.6 7.2 1 -5.2 5 1.3 7.2 -6.5 -3.4 -6.5 3.4 1.3 -7.2 -5.2 -5 7.2 -1 z" fill="#FFD36E"/>
  </g>
  <g class="m-paws">
    <path d="M60 170 Q50 134 76 106" fill="none" stroke="#7C4DFF" stroke-width="24" stroke-linecap="round"/>
    <path d="M60 170 Q50 134 76 106" fill="none" stroke="#1E1140" stroke-width="18" stroke-linecap="round"/>
    <path d="M140 170 Q150 134 124 106" fill="none" stroke="#7C4DFF" stroke-width="24" stroke-linecap="round"/>
    <path d="M140 170 Q150 134 124 106" fill="none" stroke="#1E1140" stroke-width="18" stroke-linecap="round"/>
    <ellipse cx="80" cy="100" rx="17" ry="14" fill="#1E1140" stroke="#7C4DFF" stroke-width="3"/>
    <ellipse cx="120" cy="100" rx="17" ry="14" fill="#1E1140" stroke="#7C4DFF" stroke-width="3"/>
    <circle cx="80" cy="103" r="5" fill="#FF6FB5" opacity=".8"/><circle cx="72" cy="94" r="2.6" fill="#FF6FB5" opacity=".8"/><circle cx="80" cy="91" r="2.6" fill="#FF6FB5" opacity=".8"/><circle cx="88" cy="94" r="2.6" fill="#FF6FB5" opacity=".8"/>
    <circle cx="120" cy="103" r="5" fill="#FF6FB5" opacity=".8"/><circle cx="112" cy="94" r="2.6" fill="#FF6FB5" opacity=".8"/><circle cx="120" cy="91" r="2.6" fill="#FF6FB5" opacity=".8"/><circle cx="128" cy="94" r="2.6" fill="#FF6FB5" opacity=".8"/>
  </g>
  <path class="m-spark" d="M156 26 l2.6 -9 l2.6 9 l9 2.6 l-9 2.6 l-2.6 9 l-2.6 -9 l-9 -2.6 z" fill="#47E5FF" filter="url(#${uid}-glow)"/>`;
}

let n = 0;
// kind: 'kiki' | 'kuro' (oder nach Theme: 'baby' → kiki, 'lila' → kuro)
export function mascot(kind, mood = 'idle', cls = '') {
  const k = kind === 'baby' ? 'kiki' : kind === 'lila' ? 'kuro' : kind;
  const id = `m${++n}`;
  const label = k === 'kiki' ? 'Kiki, das Einhorn' : 'Kuro, die Katze';
  return `<svg class="masc ${k} ${cls}" data-mood="${mood}" viewBox="0 0 200 200" role="img" aria-label="${label}">${k === 'kiki' ? kiki(id) : kuro(id)}</svg>`;
}

export function setMood(node, mood, ms = 0) {
  if (!node) return;
  node.dataset.mood = mood;
  if (ms) {
    clearTimeout(node._moodT);
    node._moodT = setTimeout(() => { node.dataset.mood = 'idle'; }, ms);
  }
}
