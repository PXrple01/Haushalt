// Escape-Abenteuer – die 7 Rätsel-Arten als reine Logik (ohne Oberfläche, in Node testbar).
// Jede Art: gen(rng, {diff, skin, symbols}) → spec · init(spec) → Raum-Zustand · apply(spec, state, act) → { state, solved, mistake, bump }
//           hints(spec, skin, state) → drei Tipps · solution(spec) → Aktionen, die das Rätsel lösen (für Tests)
// Rollen: „Hände“ bedienen das Gerät, „Wissen“ hat Buch, Karte oder Regeln.
import { symName, colName } from './symbols.js';

const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);
export const lvl = (diff) => (diff === 'knifflig' ? 2 : diff === 'gemuetlich' ? 0 : 1);

// ---------------------------------------------------------------------
// 1) Symbol-Schloss: Farbsteine am Schloss → Tabelle im Buch → Symbole einstellen
// ---------------------------------------------------------------------
export const LOCK_COLS = ['rosa', 'blau', 'gold', 'gruen', 'lila', 'weiss'];
const lock = {
  gen(rng, { diff, symbols }) {
    const n = lvl(diff) === 2 ? 4 : 3;
    const syms = rng.sample(symbols, 6);
    const tableA = Object.fromEntries(rng.shuffle(syms).map((s, i) => [LOCK_COLS[i], s]));
    const twist = lvl(diff) === 2;
    const tableB = twist ? Object.fromEntries(rng.shuffle(syms).map((s, i) => [LOCK_COLS[i], s])) : null;
    const lit = twist ? rng.chance(.5) : true;
    const gems = rng.sample(LOCK_COLS, n);
    const table = lit ? tableA : tableB;
    return { n, syms, gems, tableA, tableB, twist, lit, solution: gems.map((c) => table[c]) };
  },
  init: () => ({ tries: 0 }),
  apply(spec, st, a) {
    if (a.k !== 'open') return { state: st };
    const ok = same(a.code, spec.solution);
    return { state: { ...st, tries: st.tries + 1 }, solved: ok, mistake: !ok };
  },
  hints: (spec, skin) => [
    `Die Hände sagen die Farben der ${skin.gems} an – von links nach rechts. Das Wissen schaut nach, welches Symbol zu jeder Farbe gehört.`,
    spec.twist ? `Es gibt zwei Tabellen! Welche gilt, hängt davon ab, ob ${skin.indicator} ${skin.on}.` : 'Reihenfolge beachten: erster Stein = erstes Symbol, zweiter Stein = zweites Symbol …',
    `Das erste Symbol ist: ${symName(spec.solution[0])}.`,
  ],
  solution: (spec) => [{ k: 'open', code: spec.solution }],
};

// ---------------------------------------------------------------------
// 2) Zauberfäden: Regelbuch für 4/5/6 Fäden (nummeriert) → den richtigen durchschneiden
// ---------------------------------------------------------------------
export const WIRE_COLS = ['rosa', 'blau', 'gold', 'gruen', 'weiss'];
const cnt = (w, c) => w.filter((x) => x === c).length;
export const WIRE_RULES = {
  4: [
    { t: 'Kein Gold dabei?', then: 'Nummer 2', f: (w) => (!w.includes('gold') ? 1 : -1) },
    { t: 'Ist Nummer 4 weiß?', then: 'Nummer 4', f: (w) => (w[3] === 'weiss' ? 3 : -1) },
    { t: 'Mehr als einmal Blau dabei?', then: 'das Blau mit der höchsten Nummer', f: (w) => (cnt(w, 'blau') > 1 ? w.lastIndexOf('blau') : -1) },
    { t: 'Sonst:', then: 'Nummer 1', f: () => 0 },
  ],
  5: [
    { t: 'Ist Nummer 5 grün und die {plate} ungerade?', then: 'Nummer 4', f: (w, n) => (w[4] === 'gruen' && n % 2 ? 3 : -1) },
    { t: 'Genau einmal Rosa und mehr als einmal Weiß?', then: 'Nummer 1', f: (w) => (cnt(w, 'rosa') === 1 && cnt(w, 'weiss') > 1 ? 0 : -1) },
    { t: 'Kein Blau dabei?', then: 'Nummer 2', f: (w) => (!w.includes('blau') ? 1 : -1) },
    { t: 'Sonst:', then: 'Nummer 3', f: () => 2 },
  ],
  6: [
    { t: 'Kein Gold dabei und die {plate} ungerade?', then: 'Nummer 3', f: (w, n) => (!w.includes('gold') && n % 2 ? 2 : -1) },
    { t: 'Genau einmal Gold und mehr als einmal Weiß?', then: 'Nummer 4', f: (w) => (cnt(w, 'gold') === 1 && cnt(w, 'weiss') > 1 ? 3 : -1) },
    { t: 'Kein Rosa dabei?', then: 'Nummer 6', f: (w) => (!w.includes('rosa') ? 5 : -1) },
    { t: 'Sonst:', then: 'Nummer 4', f: () => 3 },
  ],
};
export function wireAnswer(w, n) {
  for (const [i, r] of WIRE_RULES[w.length].entries()) { const x = r.f(w, n); if (x >= 0) return { idx: x, rule: i }; }
  return { idx: 0, rule: 3 };
}
const wires = {
  gen(rng, { diff }) {
    const k = [4, 5, 6][lvl(diff)];
    let w, n, ans;
    for (let t = 0; t < 30; t++) {
      w = Array.from({ length: k }, () => rng.pick(WIRE_COLS));
      n = rng.int(11, 98);
      ans = wireAnswer(w, n);
      if (ans.rule < 3 || rng.chance(.25)) break; // meist eine der spannenderen Regeln
    }
    return { k, wires: w, plate: n, answer: ans.idx, rule: ans.rule };
  },
  init: () => ({ cut: [] }),
  apply(spec, st, a) {
    if (a.k !== 'cut' || !(a.i >= 0 && a.i < spec.k) || st.cut.includes(a.i)) return { state: st };
    const state = { ...st, cut: [...st.cut, a.i] };
    return a.i === spec.answer ? { state, solved: true } : { state, mistake: true };
  },
  hints: (spec, skin) => [
    `Die Hände zählen die ${skin.threads} und sagen ihre Farben an. Für jede Anzahl gibt es eigene Regeln.`,
    'Die Regeln von oben nach unten prüfen. Die erste, die passt, gilt – alle anderen nicht mehr.',
    `Durchschneiden müsst ihr Nummer ${spec.answer + 1}.`,
  ],
  solution: (spec) => [{ k: 'cut', i: spec.answer }],
};

// ---------------------------------------------------------------------
// 3) Nebel-Labyrinth: Karte (Wände) vs. Nebel (nur eigene Position)
// ---------------------------------------------------------------------
const W_N = 1, W_E = 2, W_S = 4, W_W = 8;
export const DIRS = { n: [0, -1, W_N, W_S], e: [1, 0, W_E, W_W], s: [0, 1, W_S, W_N], w: [-1, 0, W_W, W_E] };
function genMaze(rng, size) {
  const walls = new Array(size * size).fill(15);
  const seen = new Array(size * size).fill(false);
  const start = [rng.int(0, size - 1), rng.int(0, size - 1)];
  const stack = [start];
  seen[start[1] * size + start[0]] = true;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const opts = Object.entries(DIRS).filter(([, [dx, dy]]) => {
      const nx = x + dx, ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < size && ny < size && !seen[ny * size + nx];
    });
    if (!opts.length) { stack.pop(); continue; }
    const [, [dx, dy, bit, back]] = rng.pick(opts);
    const nx = x + dx, ny = y + dy;
    walls[y * size + x] &= ~bit;
    walls[ny * size + nx] &= ~back;
    seen[ny * size + nx] = true;
    stack.push([nx, ny]);
  }
  return walls;
}
export function mazePath(spec, from, to) {
  const { size, walls } = spec;
  const prev = new Map([[from.join(), null]]);
  const q = [from];
  while (q.length) {
    const [x, y] = q.shift();
    if (x === to[0] && y === to[1]) break;
    for (const [d, [dx, dy, bit]] of Object.entries(DIRS)) {
      if (walls[y * size + x] & bit) continue;
      const n = [x + dx, y + dy];
      if (!prev.has(n.join())) { prev.set(n.join(), [[x, y], d]); q.push(n); }
    }
  }
  const out = [];
  let cur = to.join();
  while (prev.get(cur)) { const [p, d] = prev.get(cur); out.unshift(d); cur = p.join(); }
  return out;
}
export const DIR_WORD = { n: 'hoch', e: 'rechts', s: 'runter', w: 'links' };
const maze = {
  gen(rng, { diff }) {
    const size = [5, 6, 7][lvl(diff)];
    const walls = genMaze(rng, size);
    const spec = { size, walls };
    // Start in einer Ecke, Ziel = am weitesten entfernter Punkt
    const start = rng.pick([[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]]);
    let best = start, bestLen = -1;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const len = mazePath(spec, start, [x, y]).length;
      if (len > bestLen) { bestLen = len; best = [x, y]; }
    }
    return { ...spec, start, goal: best, len: bestLen };
  },
  init: (spec) => ({ pos: spec.start.slice(), trail: [spec.start.join()], bumps: 0, wallsSeen: [] }),
  apply(spec, st, a) {
    if (a.k !== 'move' || !DIRS[a.d]) return { state: st };
    const [x, y] = st.pos;
    const [dx, dy, bit] = DIRS[a.d];
    if (spec.walls[y * spec.size + x] & bit) {
      const key = `${x},${y},${a.d}`;
      return { state: { ...st, bumps: st.bumps + 1, wallsSeen: st.wallsSeen.includes(key) ? st.wallsSeen : [...st.wallsSeen, key].slice(-60) }, bump: true };
    }
    const pos = [x + dx, y + dy];
    const state = { ...st, pos, trail: [...st.trail, pos.join()].slice(-300) };
    return { state, solved: pos[0] === spec.goal[0] && pos[1] === spec.goal[1] };
  },
  hints: (spec, skin, st) => [
    'Das Wissen sagt Schritt für Schritt an – zum Beispiel „zwei nach rechts, dann einmal hoch“.',
    `Auf der ${skin.map} sieht man, wo ihr gerade steht und wo ${skin.goal} ist. Gegen eine Wand laufen kostet 5 Sekunden.`,
    `Von dort, wo ihr gerade steht: ${mazePath(spec, (st && st.pos) || spec.start, spec.goal).slice(0, 4).map((d) => DIR_WORD[d]).join(', ')} …`,
  ],
  solution: (spec) => mazePath(spec, spec.start, spec.goal).map((d) => ({ k: 'move', d })),
};

// ---------------------------------------------------------------------
// 4) Kristall-Echo: Hände sehen die Lichtfolge (Farben), Wissen hat die Legende → Symbole in Reihenfolge
// ---------------------------------------------------------------------
export const ECHO_COLS = ['rosa', 'blau', 'gold', 'gruen', 'lila'];
const echo = {
  gen(rng, { diff, symbols }) {
    const L = [4, 5, 6][lvl(diff)];
    const syms = rng.sample(symbols, 5);
    const legend = Object.fromEntries(ECHO_COLS.map((c, i) => [c, syms[i]]));
    const seqs = [];
    for (let a = 0; a < 8; a++) {
      const s = [];
      while (s.length < L) { const c = rng.pick(ECHO_COLS); if (c !== s[s.length - 1]) s.push(c); }
      seqs.push(s);
    }
    return { L, syms, legend, buttons: rng.shuffle(syms), seqs };
  },
  init: () => ({ attempt: 0 }),
  seqOf: (spec, st) => spec.seqs[(st?.attempt || 0) % spec.seqs.length],
  apply(spec, st, a) {
    if (a.k !== 'enter') return { state: st };
    const want = echo.seqOf(spec, st).map((c) => spec.legend[c]);
    if (same(a.seq, want)) return { state: st, solved: true };
    return { state: { ...st, attempt: st.attempt + 1 }, mistake: true };
  },
  hints: (spec, skin, st) => [
    `Die Hände sagen die Farben der ${skin.lights} der Reihe nach an. Das Wissen übersetzt jede Farbe in ein Symbol.`,
    'Die Reihenfolge zählt! Nach einem Fehler leuchtet eine neue Folge.',
    `Bei der jetzigen Folge ist das erste Symbol: ${symName(spec.legend[echo.seqOf(spec, st)[0]])}.`,
  ],
  solution: (spec) => [{ k: 'enter', seq: spec.seqs[0].map((c) => spec.legend[c]) }],
};

// ---------------------------------------------------------------------
// 5) Trank-Kessel: Farbe im Kessel → Zutat laut Rezept → neue Farbe … bis Gold
// ---------------------------------------------------------------------
export const POT_COLS = ['rosa', 'blau', 'gruen', 'lila', 'orange', 'tuerkis', 'rot'];
const potion = {
  gen(rng, { diff, skin }) {
    const steps = [3, 4, 5][lvl(diff)];
    const cols = rng.sample(POT_COLS, steps + 2);
    const chain = cols.slice(0, steps); // Farben, die der Trank nacheinander hat
    const ings = rng.shuffle(skin.ingredients.map((x) => x.id));
    const recipe = chain.map((c, i) => ({ when: c, add: ings[i], then: chain[i + 1] || 'gold' }));
    // Täusch-Einträge: Farben, die nie vorkommen
    const spare = ings.slice(steps);
    const decoys = cols.slice(steps).map((c, j) => ({ when: c, add: spare[j % spare.length] || ings[j], then: rng.pick(chain) }));
    return { steps, chain, recipe, book: rng.shuffle([...recipe, ...decoys]), shelf: rng.shuffle(skin.ingredients.map((x) => x.id)) };
  },
  init: () => ({ step: 0, fails: 0 }),
  colorOf: (spec, st) => (st.step >= spec.steps ? 'gold' : spec.chain[st.step]),
  apply(spec, st, a) {
    if (a.k !== 'add') return { state: st };
    if (a.ing === spec.recipe[st.step]?.add) {
      const step = st.step + 1;
      return { state: { ...st, step }, solved: step >= spec.steps };
    }
    return { state: { ...st, step: 0, fails: st.fails + 1 }, mistake: true };
  },
  hints: (spec, skin) => [
    `Die Hände sagen die Farbe im ${skin.pot} an. Das Wissen schaut im Rezept nach, welche Zutat dann hinein muss.`,
    'Nach jeder Zutat ändert sich die Farbe – dann wieder nachschauen. Bei einem Fehler geht es von vorn los. Am Ende wird der Trank golden.',
    `Als Erstes muss hinein: ${(skin.ingredients.find((x) => x.id === spec.recipe[0].add) || {}).name || spec.recipe[0].add}.`,
  ],
  solution: (spec) => spec.recipe.map((r) => ({ k: 'add', ing: r.add })),
};

// ---------------------------------------------------------------------
// 6) Tresor-Rechnung: Hände zählen Dinge im Raum → Wissen rechnet mit den Formeln → Code
// ---------------------------------------------------------------------
const SAFE_EASY = [
  { t: (a) => `Anzahl ${a.pl}`, f: (c, a) => c[a.id] },
  { t: (a) => `Anzahl ${a.pl} plus 2`, f: (c, a) => c[a.id] + 2 },
  { t: (a) => `Anzahl ${a.pl} mal 2`, f: (c, a) => c[a.id] * 2 },
  { t: (a) => `Anzahl ${a.pl} minus 1`, f: (c, a) => c[a.id] - 1 },
  { t: (a, b) => `Anzahl ${a.pl} plus Anzahl ${b.pl}`, f: (c, a, b) => c[a.id] + c[b.id] },
];
const SAFE_HARD = [
  { t: (a, b) => `Anzahl ${a.pl} mal Anzahl ${b.pl}`, f: (c, a, b) => c[a.id] * c[b.id] },
  { t: (a, b) => `(Anzahl ${a.pl} plus Anzahl ${b.pl}) mal 2`, f: (c, a, b) => (c[a.id] + c[b.id]) * 2 },
  { t: () => 'Alle Dinge zusammen', f: (c) => Object.values(c).reduce((x, y) => x + y, 0) },
];
const safe = {
  gen(rng, { diff, skin }) {
    const L = lvl(diff);
    const len = L === 0 ? 3 : 4;
    const objs = rng.sample(skin.objects, 4);
    const counts = Object.fromEntries(objs.map((o) => [o.id, rng.int(1, L === 0 ? 6 : 8)]));
    const pool = L === 2 ? [...SAFE_EASY, ...SAFE_HARD, ...SAFE_HARD] : SAFE_EASY;
    const lines = [];
    for (let i = 0; i < len; i++) {
      const tpl = rng.pick(pool);
      const [a, b] = rng.sample(objs, 2);
      lines.push({ text: tpl.t(a, b), value: ((tpl.f(counts, a, b) % 10) + 10) % 10 });
    }
    // Dinge im Raum verteilen: Raster 8×6 mit etwas Wackeln, keine Überlappung
    const cells = rng.shuffle(Array.from({ length: 48 }, (_, i) => i));
    const place = [];
    let ci = 0;
    for (const o of objs) for (let k = 0; k < counts[o.id]; k++) {
      const c = cells[ci++];
      // Mittelpunkt in Prozent: Spalten 3–97 %, Zeilen 10–99 % (oben bleibt Platz für das Schild)
      place.push({ id: o.id, x: 3 + (c % 8) * 11.75 + 5.9 + rng.int(-2, 2), y: 10 + Math.floor(c / 8) * 14.8 + 7.4 + rng.int(-2, 2), r: rng.int(-20, 20), s: rng.int(85, 112) / 100 });
    }
    return { len, objs: objs.map((o) => o.id), counts, lines, code: lines.map((l) => l.value).join(''), place };
  },
  init: () => ({ tries: 0 }),
  apply(spec, st, a) {
    if (a.k !== 'open') return { state: st };
    const ok = String(a.code) === spec.code;
    return { state: { ...st, tries: st.tries + 1 }, solved: ok, mistake: !ok };
  },
  hints: () => [
    'Die Hände zählen die Dinge im Raum. Das Wissen fragt nach den Zahlen und rechnet die Formeln aus.',
    'Ist ein Ergebnis zweistellig, zählt nur die letzte Ziffer (aus 12 wird 2, aus 30 wird 0).',
    'Die erste Ziffer ist {code0}.',
  ],
  solution: (spec) => [{ k: 'open', code: spec.code }],
};

// ---------------------------------------------------------------------
// 7) Aufstellung: Steckbrief (Hinweise) → die richtige von sechs Figuren
// ---------------------------------------------------------------------
export const LCOLS = ['rosa', 'blau', 'gruen', 'gold'];
const NUM = ['', 'einen', 'zwei', 'drei'];
const lineup = {
  gen(rng, { diff, skin }) {
    const accs = skin.accessories.map((x) => x.id);
    const an = (id) => skin.accessories.find((x) => x.id === id);
    const D = skin.dots || { one: 'Punkt', many: 'Punkte' };
    const dots = (n) => (n === 1 ? `einen ${D.one}` : `${NUM[n]} ${D.many}`);
    const all = [];
    for (const c of LCOLS) for (const a of accs) for (let d = 1; d <= 3; d++) all.push({ c, a, d });
    const L = lvl(diff);
    const [minC, maxC] = [[2, 3], [3, 4], [3, 5]][L];
    let best = null;
    for (let attempt = 0; attempt < 120; attempt++) {
      const people = rng.sample(all, 6);
      const target = rng.int(0, 5);
      const T = people[target];
      const facts = [
        { t: `ist ${colName(T.c).toLowerCase()}`, ok: (p) => p.c === T.c, w: 1 },
        ...LCOLS.filter((c) => c !== T.c).map((c) => ({ t: `ist nicht ${colName(c).toLowerCase()}`, ok: (p) => p.c !== c, w: 2 })),
        { t: `trägt ${an(T.a).with}`, ok: (p) => p.a === T.a, w: 1 },
        ...accs.filter((a) => a !== T.a).map((a) => ({ t: `trägt ${an(a).without}`, ok: (p) => p.a !== a, w: 2 })),
        { t: `hat ${dots(T.d)}`, ok: (p) => p.d === T.d, w: 1 },
        ...[1, 2].filter((n) => T.d > n).map((n) => ({ t: `hat mehr als ${dots(n)}`, ok: (p) => p.d > n, w: 2 })),
        ...[2, 3].filter((n) => T.d < n).map((n) => ({ t: `hat weniger als ${dots(n)}`, ok: (p) => p.d < n, w: 2 })),
      ];
      // Gemütlich: klare Hinweise zuerst · Knifflig: erst die „nicht“-Hinweise (mehr Hinweise, mehr Denken)
      const order = rng.shuffle(facts).sort((x, y) => (L === 2 ? y.w - x.w : L === 0 ? x.w - y.w : 0));
      const clues = [];
      for (const f of order) {
        const left = people.filter((p) => clues.every((c) => c.ok(p)));
        if (left.length === 1) break;
        if (people.filter((p) => [...clues, f].every((c) => c.ok(p))).length < left.length) clues.push(f);
      }
      if (people.filter((p) => clues.every((c) => c.ok(p))).length !== 1) continue;
      const cand = { people, target, clues: clues.map((c) => c.t) };
      if (clues.length >= minC && clues.length <= maxC) return cand;
      if (!best || Math.abs(clues.length - minC) < Math.abs(best.clues.length - minC)) best = cand;
    }
    return best;
  },
  init: () => ({ wrong: [] }),
  apply(spec, st, a) {
    if (a.k !== 'pick' || !(a.i >= 0 && a.i < 6) || st.wrong.includes(a.i)) return { state: st };
    if (a.i === spec.target) return { state: st, solved: true };
    return { state: { ...st, wrong: [...st.wrong, a.i] }, mistake: true };
  },
  hints: (spec) => [
    'Das Wissen liest Hinweis für Hinweis vor. Die Hände streichen alle weg, die nicht passen.',
    '„nicht“ und „kein“ schließen aus. Wer am Ende übrig bleibt, ist es!',
    `Die gesuchte Figur ist ${colName(spec.people[spec.target].c).toLowerCase()}.`,
  ],
  solution: (spec) => [{ k: 'pick', i: spec.target }],
};

export const PUZZLES = { lock, wires, maze, echo, potion, safe, lineup };

// Tipp-Texte mit Platzhaltern füllen
export function hintsFor(kind, spec, skin, st) {
  return PUZZLES[kind].hints(spec, skin, st).map((t) => t.replace('{code0}', spec.code ? spec.code[0] : ''));
}
