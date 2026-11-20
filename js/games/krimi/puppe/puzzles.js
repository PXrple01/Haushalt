// Krimi Fall 2 – die fünf Zwei-Handy-Rätsel. Jedes Rätsel: gen(rng, diff) → spec · init(spec) → state ·
// apply(spec, state, d, role, ctx) → { state, solved?, hurt?: { role, l, why }, info? } · hint(spec, state, n) · auto (Lösungsweg für Tests)
// Rollen: das erste Element in SCENES[...].roles gehört „first“, das zweite „other“.

const LIMBS = ['lh', 'rh', 'lf', 'rf'];
export const LIMB_NAME = { lh: 'linke Hand', rh: 'rechte Hand', lf: 'linker Fuß', rf: 'rechter Fuß' };
export const COLORS = [
  { id: 'rot', name: 'Rot', hex: '#d22b2b' },
  { id: 'blau', name: 'Blau', hex: '#2f6fd8' },
  { id: 'gelb', name: 'Gelb', hex: '#e8b923' },
  { id: 'gruen', name: 'Grün', hex: '#2fa35a' },
];
export const LEVEL_NAME = ['unten', 'Mitte', 'oben'];

// =====================================================================
// 1) Die Marionette
// =====================================================================
const marionette = {
  gen(rng, diff) {
    const hard = diff === 'hart';
    const map = rng.shuffle(LIMBS); // map[farbe] = Glied
    const order = rng.shuffle([0, 1, 2, 3]); // Reihenfolge der Fäden am Spielkreuz
    let target;
    do { target = LIMBS.map(() => rng.int(0, 2)); } while (target.every((v) => v === 0) || target.filter((v) => v === target[0]).length === 4);
    const danger = [];
    const nd = hard ? 3 : 2;
    let guard = 0;
    while (danger.length < nd && guard++ < 200) {
      const li = rng.int(0, 3), lv = rng.int(1, 2);
      if (target[li] === lv || danger.some((x) => x.li === li)) continue;
      danger.push({ li, lv });
    }
    return { map, order, target, danger, nail: hard ? 150 : 210, nail2: hard ? 110 : 150 };
  },
  init: () => ({ lv: [0, 0, 0, 0], grabs: 0, cuts: 0, deadline: 0 }),
  // Haltung aus den Fadenständen: Glied → Stufe
  posture(spec, st) {
    const out = [0, 0, 0, 0];
    spec.map.forEach((limb, c) => { out[LIMBS.indexOf(limb)] = st.lv[c]; });
    return out;
  },
  apply(spec, st, d, role, ctx) {
    const s = { ...st, lv: [...st.lv] };
    if (d.k === 'set' && role === 'spieler') {
      const c = d.c | 0, v = d.v | 0;
      if (c < 0 || c > 3 || v < 0 || v > 2 || s.lv[c] === v) return { state: st };
      s.lv[c] = v;
      const pos = marionette.posture(spec, s);
      if (spec.danger.some((x) => pos[x.li] === x.lv)) {
        s.lv = [0, 0, 0, 0]; s.cuts++;
        return { state: s, hurt: { role: 'puppe', l: .5, why: 'sichel' } };
      }
      return { state: s };
    }
    if (d.k === 'grab' && role === 'puppe') {
      const pos = marionette.posture(spec, s);
      if (pos.every((v, i) => v === spec.target[i])) return { state: s, solved: true };
      s.grabs++;
      s.deadline -= 20e3;
      return { state: s, info: 'leer' };
    }
    if (d.k === 'nails' && s.deadline && ctx.t >= s.deadline - 3e3) {
      s.deadline = ctx.t + spec.nail2 * 1e3;
      s.lv = [0, 0, 0, 0];
      return { state: s, hurt: { role: 'puppe', l: 1, why: 'naegel' } };
    }
    return { state: st };
  },
  start(spec, st, t) { return { ...st, deadline: t + spec.nail * 1e3 }; },
  hint(spec, st, n) {
    if (n === 1) return 'Die Skizze ist von vorne gezeichnet – wie ein Spiegelbild. Was auf dem Bild links ist, ist für {puppe} rechts.';
    const li = spec.target.findIndex((v, i) => marionette.posture(spec, st)[i] !== v);
    const k = li < 0 ? 0 : li;
    const c = spec.map.indexOf(LIMBS[k]);
    return `Der Faden an {puppe}s ${LIMB_NAME[LIMBS[k]]} ist ${COLORS[c].name.toLowerCase()} – er muss nach ${LEVEL_NAME[spec.target[k]] === 'Mitte' ? 'in die Mitte' : LEVEL_NAME[spec.target[k]]}.`;
  },
  auto(spec) {
    const steps = [];
    spec.target.forEach((v, li) => { const c = spec.map.indexOf(LIMBS[li]); if (v) steps.push({ role: 'spieler', d: { k: 'set', c, v } }); });
    steps.push({ role: 'puppe', d: { k: 'grab' } });
    return steps;
  },
};

// =====================================================================
// 2) Die Blutspur – Ursprung der Tropfen finden
// =====================================================================
const LANDMARKS = ['stuhl', 'werkbank', 'ofen', 'abfluss', 'koepfe', 'kiste'];
export const LANDMARK_NAME = { stuhl: 'Stuhl', werkbank: 'Werkbank', ofen: 'Ofen', abfluss: 'Abfluss', koepfe: 'Puppenköpfe', kiste: 'Kiste' };
const LANDMARK_DAT = { stuhl: 'dem Stuhl', werkbank: 'der Werkbank', ofen: 'dem Ofen', abfluss: 'dem Abfluss', koepfe: 'den Puppenköpfen', kiste: 'der Kiste' };
const blutspur = {
  N: 6,
  gen(rng, diff) {
    const N = 6;
    const marks = { stuhl: [2 + rng.int(0, 1), 5] };
    const used = new Set([marks.stuhl[1] * N + marks.stuhl[0]]);
    for (const m of LANDMARKS.slice(1)) {
      let x, y;
      do { x = rng.int(0, N - 1); y = rng.int(0, N - 2); } while (used.has(y * N + x));
      marks[m] = [x, y];
      used.add(y * N + x);
    }
    let ox, oy;
    do { ox = rng.int(1, N - 2); oy = rng.int(1, N - 3); } while (used.has(oy * N + ox) || Math.abs(ox - marks.stuhl[0]) + Math.abs(oy - marks.stuhl[1]) < 2);
    // Tropfen rund um den Ursprung, Schwanz zeigt vom Ursprung weg
    const drops = [];
    const cx = ox + .5, cy = oy + .5;
    let guard = 0;
    const nDrops = diff === 'hart' ? 4 : 5;
    while (drops.length < nDrops && guard++ < 1500) {
      const a = rng() * Math.PI * 2;
      const r = 1.3 + rng() * 2.1;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (x < .35 || y < .35 || x > N - .35 || y > N - .35) continue;
      if (drops.some((dd) => { const da = Math.abs(((dd.a - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI); return da < .42 || Math.hypot(dd.x - x, dd.y - y) < .85; })) continue;
      const noise = (rng() - .5) * (diff === 'hart' ? .2 : .12);
      drops.push({ x, y, a: a + noise, s: .8 + rng() * .5 });
    }
    const rot = rng.pick(diff === 'hart' ? [1, 2, 3] : [1, 3]);
    return { N, marks, origin: oy * N + ox, drops, rot };
  },
  init: () => ({ tried: [] }),
  isMark(spec, c) { return Object.values(spec.marks).some(([x, y]) => y * spec.N + x === c); },
  apply(spec, st, d, role) {
    if (d.k !== 'plank' || role !== 'unten') return { state: st };
    const c = d.c | 0;
    if (c < 0 || c >= spec.N * spec.N || blutspur.isMark(spec, c) || st.tried.includes(c)) return { state: st };
    if (c === spec.origin) return { state: st, solved: true };
    return { state: { tried: [...st.tried, c] }, hurt: { role: 'unten', l: .5, why: 'falle' } };
  },
  hint(spec, st, n) {
    if (n === 1) return 'Verlängert mindestens drei Tropfen. Wo sich die Linien kreuzen, liegt der Ursprung – und der Schlüssel.';
    const ox = spec.origin % spec.N, oy = Math.floor(spec.origin / spec.N);
    let best = null;
    for (const [m, [x, y]] of Object.entries(spec.marks)) {
      const dd = Math.abs(x - ox) + Math.abs(y - oy);
      if (!best || dd < best.dd) best = { m, x, y, dd };
    }
    const dx = ox - best.x, dy = oy - best.y;
    const parts = [];
    if (dx) parts.push(`${Math.abs(dx)} ${Math.abs(dx) === 1 ? 'Brett' : 'Bretter'} ${dx > 0 ? 'rechts' : 'links'}`);
    if (dy) parts.push(`${Math.abs(dy)} ${Math.abs(dy) === 1 ? 'Brett' : 'Bretter'} ${dy > 0 ? 'näher zum Stuhl' : 'weiter weg vom Stuhl'}`);
    return `Aus {unten}s Sicht: Der Ursprung liegt ${parts.join(' und ')} von ${LANDMARK_DAT[best.m]} aus.`;
  },
  auto(spec) { return [{ role: 'unten', d: { k: 'plank', c: spec.origin } }]; },
};

// =====================================================================
// 3) Blindekuh auf der Drehbühne
// =====================================================================
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // 0 = vorwärts Richtung Ausgang (oben), im Uhrzeigersinn
const STAGE = 7, TC = 3; // Drehscheibe: Mitte (3,3), Radius 1
const onTurn = (x, y) => Math.abs(x - TC) <= 1 && Math.abs(y - TC) <= 1;
const rotCell = (x, y, k) => { let dx = x - TC, dy = y - TC; for (let i = 0; i < k; i++) [dx, dy] = [-dy, dx]; return [TC + dx, TC + dy]; };
const drehbuehne = {
  N: STAGE,
  gen(rng, diff) {
    const hard = diff === 'hart';
    const every = hard ? 3 : 4;
    for (let attempt = 0; attempt < 400; attempt++) {
      const start = [3, 6];
      const exit = [rng.int(1, 5), 0];
      const holes = new Set();
      const nOut = hard ? 11 : 9, nTurn = hard ? 3 : 2;
      let g = 0;
      while ([...holes].filter((k) => !onTurn(k % STAGE, Math.floor(k / STAGE))).length < nOut && g++ < 300) {
        const x = rng.int(0, STAGE - 1), y = rng.int(0, STAGE - 1);
        if (onTurn(x, y) || (x === start[0] && y === start[1]) || (x === exit[0] && y === exit[1]) || (y === 5 && x === 3)) continue;
        holes.add(y * STAGE + x);
      }
      g = 0;
      while ([...holes].filter((k) => onTurn(k % STAGE, Math.floor(k / STAGE))).length < nTurn && g++ < 300) {
        const x = rng.int(2, 4), y = rng.int(2, 4);
        if (x === TC && y === TC) continue;
        holes.add(y * STAGE + x);
      }
      const spec = { start, exit, holes: [...holes].sort((a, b) => a - b), every, feels: hard ? 2 : 4 };
      const path = drehbuehne.solve(spec, { x: start[0], y: start[1], f: 0, steps: 0 });
      if (path && path.filter((a) => a === 'step').length >= 8 && path.length <= 26) return spec;
    }
    // Rückfall (sollte nie nötig sein)
    return { start: [3, 6], exit: [3, 0], holes: [], every, feels: 4 };
  },
  init: (spec) => ({ x: spec.start[0], y: spec.start[1], f: 0, steps: 0, falls: 0, feels: 0, feel: null, bump: 0 }),
  // Loch an (x,y), wenn die Drehscheibe k-mal gedreht wurde?
  holeAt(spec, x, y, k) {
    if (!onTurn(x, y)) return spec.holes.includes(y * STAGE + x);
    const [bx, by] = rotCell(x, y, (4 - (k % 4)) % 4); // zurückdrehen auf die Grundstellung
    return spec.holes.includes(by * STAGE + bx);
  },
  turns: (spec, steps) => Math.floor(steps / spec.every),
  move(spec, s, a) {
    const n = { ...s, feel: null, bump: 0 };
    if (a === 'left') { n.f = (n.f + 3) % 4; return { s: n }; }
    if (a === 'right') { n.f = (n.f + 1) % 4; return { s: n }; }
    if (a === 'feel') {
      const [dx, dy] = DIRS[n.f];
      const x = n.x + dx, y = n.y + dy;
      n.feels++;
      n.feel = x < 0 || y < 0 || x >= STAGE || y >= STAGE ? 'wand' : drehbuehne.holeAt(spec, x, y, drehbuehne.turns(spec, n.steps)) ? 'loch' : 'frei';
      return { s: n };
    }
    if (a !== 'step') return { s: n };
    const [dx, dy] = DIRS[n.f];
    const x = n.x + dx, y = n.y + dy;
    if (x < 0 || y < 0 || x >= STAGE || y >= STAGE) { n.bump = 1; return { s: n, why: 'wand' }; }
    if (drehbuehne.holeAt(spec, x, y, drehbuehne.turns(spec, n.steps))) {
      return { s: { ...n, x: spec.start[0], y: spec.start[1], f: 0, steps: n.steps + 1, falls: n.falls + 1 }, fall: true };
    }
    n.x = x; n.y = y; n.steps++;
    if (x === spec.exit[0] && y === spec.exit[1]) return { s: n, out: true };
    if (n.steps % spec.every === 0 && onTurn(n.x, n.y)) {
      [n.x, n.y] = rotCell(n.x, n.y, 1);
      n.f = (n.f + 1) % 4;
      n.spun = (n.spun || 0) + 1;
    }
    return { s: n };
  },
  apply(spec, st, d, role) {
    if (role !== 'blind' || !['step', 'left', 'right', 'feel'].includes(d.k)) return { state: st };
    if (d.k === 'feel' && st.feels >= spec.feels) return { state: st };
    const r = drehbuehne.move(spec, st, d.k);
    if (r.out) return { state: r.s, solved: true };
    if (r.fall) return { state: r.s, hurt: { role: 'blind', l: .5, why: 'spiess' } };
    if (r.why === 'wand') return { state: r.s, info: 'wand' };
    return { state: r.s };
  },
  // Kürzester Weg (Breitensuche über Ort, Blickrichtung, Schritte modulo Drehzyklus)
  solve(spec, s0) {
    const cyc = spec.every * 4;
    const key = (s) => `${s.x},${s.y},${s.f},${s.steps % cyc}`;
    const q = [{ s: { x: s0.x, y: s0.y, f: s0.f, steps: s0.steps }, path: [] }];
    const seen = new Set([key(q[0].s)]);
    while (q.length) {
      const { s, path } = q.shift();
      if (path.length > 30) break;
      for (const a of ['step', 'left', 'right']) {
        const r = drehbuehne.move(spec, { ...s, feels: 0, falls: 0 }, a);
        if (r.fall || r.why === 'wand') continue;
        if (r.out) return [...path, a];
        const ns = { x: r.s.x, y: r.s.y, f: r.s.f, steps: r.s.steps };
        const k = key(ns);
        if (seen.has(k)) continue;
        seen.add(k);
        q.push({ s: ns, path: [...path, a] });
      }
    }
    return null;
  },
  hint(spec, st, n) {
    if (n === 1) return 'Richtungen immer aus {blind}s Sicht: »links« heißt {blind}s links. Und zählt mit: Alle paar Schritte dreht sich die Scheibe – samt {blind}.';
    const p = drehbuehne.solve(spec, st);
    const word = { step: 'Schritt', left: 'links drehen', right: 'rechts drehen' };
    return p ? `Die nächsten sicheren Züge für {blind}: ${p.slice(0, 4).map((a) => word[a]).join(', ')}.` : 'Erst einmal zurück zum Start …';
  },
  auto(spec) { return drehbuehne.solve(spec, drehbuehne.init(spec)).map((a) => ({ role: 'blind', d: { k: a } })); },
};

// =====================================================================
// 4) Das Schattentheater – Figuren drehen, bis die Schatten Ziffern ergeben
// =====================================================================
// Ziffern als Segmente (Sieben-Segment), 2×2 Felder im Quadrat 0..120
const SEG = { a: [[0, 0], [1, 0]], b: [[1, 0], [1, 1]], c: [[1, 1], [1, 2]], d: [[0, 2], [1, 2]], e: [[0, 1], [0, 2]], f: [[0, 0], [0, 1]], g: [[0, 1], [1, 1]] };
const DIGIT = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
const BOX = [[22, 14], [70, 14], [22, 66], [70, 66]]; // linke obere Ecke je Ziffer, 28 breit, 40 hoch
const rot90 = ([x, y], k) => { let dx = x - 60, dy = y - 60; for (let i = 0; i < k; i++) [dx, dy] = [-dy, dx]; return [60 + dx, 60 + dy]; };
const schatten = {
  gen(rng, diff) {
    const nCards = diff === 'hart' ? 4 : 3;
    const segCount = (c) => [...c].reduce((a, ch) => a + DIGIT[ch].length, 0);
    let code;
    do { code = Array.from({ length: 4 }, () => rng.int(0, 9)).join(''); } while (segCount(code) < nCards * 4);
    const segs = [];
    [...code].forEach((ch, i) => {
      const [bx, by] = BOX[i];
      for (const s of DIGIT[ch]) {
        const [[x1, y1], [x2, y2]] = SEG[s];
        segs.push([[bx + x1 * 28, by + y1 * 20], [bx + x2 * 28, by + y2 * 20]]);
      }
    });
    // Segmente reihum verteilen (gemischt), damit jede Figur genug Striche hat
    const cards = Array.from({ length: nCards }, () => []);
    rng.shuffle(segs).forEach((sg, i) => cards[i % nCards].push(sg));
    const want = cards.map(() => rng.int(0, 3));
    if (want.filter((w) => w === 0).length > 1) want[want.indexOf(0)] = 2;
    // Grundstellung = um -want gedreht (so ergibt want-faches Drehen die Ziffern)
    const base = cards.map((c, i) => c.map((seg) => seg.map((pt) => rot90(pt, (4 - want[i]) % 4))));
    return { code, base, want, n: nCards };
  },
  init: (spec) => ({ rot: spec.base.map(() => 0), tries: 0 }),
  lines(spec, st) { return spec.base.flatMap((c, i) => c.map((seg) => seg.map((pt) => rot90(pt, st.rot[i])))); },
  apply(spec, st, d, role) {
    if (d.k === 'rot' && role === 'lampe') {
      const i = d.c | 0;
      if (i < 0 || i >= spec.n) return { state: st };
      const rot = [...st.rot];
      rot[i] = (rot[i] + 1) % 4;
      return { state: { ...st, rot } };
    }
    if (d.k === 'code' && role === 'leinwand') {
      if (String(d.v) === spec.code) return { state: st, solved: true };
      return { state: { ...st, tries: st.tries + 1 }, hurt: { role: 'leinwand', l: .25, why: 'strom' } };
    }
    return { state: st };
  },
  hint(spec, st, n) {
    if (n === 1) return 'Dreht immer nur eine Figur und schaut, welche Striche auf der Leinwand wandern. Erst wenn alle stimmen, entstehen vier saubere Ziffern.';
    const i = spec.want.findIndex((w, k) => st.rot[k] !== w);
    if (i < 0) return 'Die Figuren stehen richtig. Lest die Ziffern von links oben nach rechts unten.';
    return `Figur ${i + 1} muss von ihrer jetzigen Lage noch ${((spec.want[i] - st.rot[i]) + 4) % 4}-mal gedreht werden.`;
  },
  auto(spec) {
    const out = [];
    spec.want.forEach((w, i) => { for (let k = 0; k < w; k++) out.push({ role: 'lampe', d: { k: 'rot', c: i } }); });
    out.push({ role: 'leinwand', d: { k: 'code', v: spec.code } });
    return out;
  },
};

// =====================================================================
// 5) Das Krokodil – Drehorgel im wandernden Takt
// =====================================================================
const orgel = {
  gen(rng, diff) {
    const hard = diff === 'hart';
    return { base: 1.05 + rng.int(0, 20) / 100, amp: .3 + rng.int(0, 15) / 100, period: 16 + rng.int(0, 8), phase: rng() * Math.PI * 2, width: hard ? .17 : .23, need: hard ? 18 : 15, croc: 10 };
  },
  init: () => ({ green: 0, croc: 0, ticks: 0, bites: 0 }),
  // Mitte der grünen Zone (Umdrehungen pro Sekunde) nach t Sekunden
  zone(spec, t) { return spec.base + spec.amp * Math.sin((2 * Math.PI * t) / spec.period + spec.phase); },
  apply(spec, st, d, role) {
    if (d.k !== 'tick' || role !== 'orgel' || (d.n | 0) !== st.ticks) return { state: st };
    const s = { ...st, ticks: st.ticks + 1 };
    if (d.g) s.green++;
    else s.croc++;
    if (s.green >= spec.need) return { state: s, solved: true };
    if (s.croc >= spec.croc) { s.croc = 4; s.bites++; return { state: s, hurt: { role: 'bahn', l: 1, why: 'biss' } }; }
    return { state: s };
  },
  hint(spec, st, n) {
    if (n === 1) return 'Die grüne Zone wandert langsam hin und her. {bahn}: sag früh Bescheid – nicht erst, wenn die Nadel schon draußen ist.';
    return `Gleichmäßig kurbeln. Die Mitte der Zone liegt bei etwa ${spec.base.toFixed(1).replace('.', ',')} Umdrehungen pro Sekunde – sie schwankt um ±${spec.amp.toFixed(1).replace('.', ',')}.`;
  },
  auto(spec) { return Array.from({ length: spec.need }, (_, i) => ({ role: 'orgel', d: { k: 'tick', g: 1, n: i } })); },
};

export const PUZ = { marionette, blutspur, drehbuehne, schatten, orgel };
export { onTurn, rotCell, STAGE, TC, DIRS };
