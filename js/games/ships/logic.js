// Herzchen versenken – reine Spiellogik.
// 8×8-Meer. Zwei Flotten: „Klassisch“ (gerade Figuren) und „Kurvig“ (Regenbogen-Bogen, Seeschlange in S-Form, Raupe in L-Form).
// Abwechselnd schießen, bei Treffer nochmal. Einmal pro Spiel ein Spezialschuss (3×3).
// Ereignisse: setup {first, fleet} · fleet {p, f} (verschleiert) · shot {x, y, bomb} · abort
// Eine Figur auf dem Meer: { id, x, y, o } – (x, y) = linke obere Ecke, o = Ausrichtung (Index in orientsOf(id)).
// Ältere Partien speichern { dir: 'h' | 'v' } – wird als o = 0 / 1 gelesen.
import { nameOf, other } from '../../core/util.js';
import { dec } from '../secret.js';

export const N = 8;

// Grundform jeder Figur (Felder in der Grundausrichtung)
const SHAPES = {
  einhorn: [[0, 0], [1, 0], [2, 0], [3, 0]],
  wolke: [[0, 0], [1, 0], [2, 0]],
  katze: [[0, 0], [1, 0], [2, 0]],
  herz: [[0, 0], [1, 0]],
  stern: [[0, 0], [1, 0]],
  regenbogen: [[0, 1], [0, 0], [1, 0], [2, 0], [2, 1]], // Bogen ∩
  schlange: [[0, 0], [1, 0], [1, 1], [2, 1]],           // S-Kurve
  raupe: [[0, 0], [1, 0], [2, 0], [2, 1]],              // L-Form
};
export const PIECES = {
  einhorn: { id: 'einhorn', name: 'Einhorn' },
  wolke: { id: 'wolke', name: 'Wolke' },
  katze: { id: 'katze', name: 'Katze' },
  herz: { id: 'herz', name: 'Herzchen' },
  stern: { id: 'stern', name: 'Sternschnuppe' },
  regenbogen: { id: 'regenbogen', name: 'Regenbogen', curvy: true },
  schlange: { id: 'schlange', name: 'Seeschlange', curvy: true },
  raupe: { id: 'raupe', name: 'Raupe', curvy: true },
};
for (const id of Object.keys(PIECES)) {
  PIECES[id].len = SHAPES[id].length;
  PIECES[id].bw = Math.max(...SHAPES[id].map((c) => c[0])) + 1;
  PIECES[id].bh = Math.max(...SHAPES[id].map((c) => c[1])) + 1;
}

export const FLEETS = {
  klassisch: { id: 'klassisch', title: 'Klassisch', sub: 'Gerade Figuren', ids: ['einhorn', 'wolke', 'katze', 'herz', 'stern'] },
  kurvig: { id: 'kurvig', title: 'Kurvig', sub: 'Mit Bogen, S und L – kniffliger', ids: ['regenbogen', 'schlange', 'raupe', 'einhorn', 'herz'] },
};
export const fleetOf = (kind) => FLEETS[kind] || FLEETS.klassisch;
export const fleetPieces = (kind) => fleetOf(kind).ids.map((id) => PIECES[id]);
export const pieceInfo = (id) => PIECES[id];
// Für ältere Aufrufer: die klassische Flotte
export const FLEET = fleetPieces('klassisch');

// ---------- Ausrichtungen: Drehen (90°-Schritte) und Spiegeln ----------
// Jede Ausrichtung: Felder (ab 0,0), Breite/Höhe, und wie die Grafik gedreht/gespiegelt wird (rot in Grad, flip ±1).
const ORIENTS = {};
function orientsFor(id) {
  if (ORIENTS[id]) return ORIENTS[id];
  const base = SHAPES[id];
  const out = [];
  const seen = new Set();
  for (const flip of [1, -1]) {
    for (let k = 0; k < 4; k++) {
      // erst spiegeln (x → −x), dann k-mal um 90° im Uhrzeigersinn drehen: (x, y) → (−y, x)
      let cells = base.map(([x, y]) => [x * flip, y]);
      for (let i = 0; i < k; i++) cells = cells.map(([x, y]) => [-y, x]);
      const mx = Math.min(...cells.map((c) => c[0])), my = Math.min(...cells.map((c) => c[1]));
      cells = cells.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
      const sig = cells.map((c) => c.join(',')).join(' ');
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push({ cells, w: Math.max(...cells.map((c) => c[0])) + 1, h: Math.max(...cells.map((c) => c[1])) + 1, rot: k * 90, flip });
    }
  }
  ORIENTS[id] = out;
  return out;
}
export const orientsOf = (id) => orientsFor(id);
// Ausrichtung einer gelegten Figur (auch alte Partien mit dir)
export function orientOf(pc) {
  const list = orientsFor(pc.id);
  const o = Number.isInteger(pc.o) ? pc.o : pc.dir === 'v' ? 1 : 0;
  return list[((o % list.length) + list.length) % list.length];
}
const oIndex = (pc) => (Number.isInteger(pc.o) ? pc.o : pc.dir === 'v' ? 1 : 0);

export function cellsOf(pc) {
  return orientOf(pc).cells.map(([x, y]) => [pc.x + x, pc.y + y]);
}
const key = (x, y) => y * N + x;

// Passt eine Figur (ohne Überlappung mit den anderen)?
export function fits(pc, others = []) {
  const cells = cellsOf(pc);
  if (cells.some(([x, y]) => x < 0 || y < 0 || x >= N || y >= N)) return false;
  const taken = new Set(others.filter((o) => o.id !== pc.id).flatMap((o) => cellsOf(o).map(([x, y]) => key(x, y))));
  return cells.every(([x, y]) => !taken.has(key(x, y)));
}

export function validFleet(f, kind = 'klassisch') {
  const ids = fleetOf(kind).ids;
  if (!Array.isArray(f) || f.length !== ids.length) return false;
  const have = new Set(f.map((p) => p?.id));
  if (have.size !== ids.length || ids.some((id) => !have.has(id))) return false;
  for (const p of f) {
    if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) return false;
    if (p.o != null ? !(Number.isInteger(p.o) && p.o >= 0 && p.o < orientsFor(p.id).length) : !['h', 'v'].includes(p.dir)) return false;
  }
  return f.every((p, i) => fits(p, f.slice(0, i)));
}

// Zufällige Flotte (rng = Zufallsfunktion 0..1)
export function randomFleet(rng = Math.random, kind = 'klassisch') {
  for (let attempt = 0; attempt < 300; attempt++) {
    const out = [];
    let ok = true;
    for (const id of fleetOf(kind).ids) {
      let placed = false;
      const list = orientsFor(id);
      for (let t = 0; t < 120 && !placed; t++) {
        const o = Math.floor(rng() * list.length);
        const { w, h } = list[o];
        const pc = { id, o, x: Math.floor(rng() * (N - w + 1)), y: Math.floor(rng() * (N - h + 1)) };
        if (fits(pc, out)) { out.push(pc); placed = true; }
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) return out;
  }
  return null;
}

// Felder eines Spezialschusses (3×3 um x,y, am Rand abgeschnitten)
export function bombCells(x, y) {
  const out = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const cx = x + dx, cy = y + dy;
    if (cx >= 0 && cy >= 0 && cx < N && cy < N) out.push([cx, cy]);
  }
  return out;
}

export function reduce(meta, evs) {
  const st = {
    game: 'ships', id: meta.id, mode: meta.mode, phase: 'setup',
    first: 'jos', turn: 'jos', fleetKind: 'klassisch',
    fleets: { jos: null, joh: null },
    shots: { jos: [], joh: [] },        // shots[p] = Schüsse VON p (auf das Meer des anderen)
    bombUsed: { jos: false, joh: false },
    sunk: { jos: [], joh: [] },         // sunk[p] = Figuren-IDs des Gegners, die p versenkt hat
    hitsBy: { jos: 0, joh: 0 },
    winner: null, aborted: false, endedAt: 0, last: null,
  };
  const shotKey = { jos: new Set(), joh: new Set() };
  for (const e of evs) {
    const d = e.d || {};
    if (st.phase === 'end') break;
    switch (e.ty) {
      case 'setup':
        st.first = st.turn = d.first === 'joh' ? 'joh' : 'jos';
        st.fleetKind = FLEETS[d.fleet] ? d.fleet : 'klassisch';
        break;
      case 'fleet': {
        if (st.phase !== 'setup') break;
        const p = meta.mode === 'remote' ? e.by : (d.p === 'joh' ? 'joh' : 'jos');
        let f = null;
        try { f = JSON.parse(dec(d.f, meta.id)); } catch { f = null; }
        if (!validFleet(f, st.fleetKind)) break;
        st.fleets[p] = f.map((x) => ({ id: x.id, x: x.x, y: x.y, o: oIndex(x) }));
        if (st.fleets.jos && st.fleets.joh) { st.phase = 'play'; st.turn = st.first; }
        break;
      }
      case 'shot': {
        if (st.phase !== 'play') break;
        const p = meta.mode === 'remote' ? e.by : st.turn;
        if (p !== st.turn) break;
        const x = +d.x, y = +d.y;
        if (!(x >= 0 && y >= 0 && x < N && y < N)) break;
        const bomb = !!d.bomb && !st.bombUsed[p];
        const targets = (bomb ? bombCells(x, y) : [[x, y]]).filter(([cx, cy]) => !shotKey[p].has(key(cx, cy)));
        if (!targets.length) break;
        if (bomb) st.bombUsed[p] = true;
        const foe = st.fleets[other(p)];
        const occ = new Map();
        for (const pc of foe) for (const [cx, cy] of cellsOf(pc)) occ.set(key(cx, cy), pc.id);
        const results = [];
        for (const [cx, cy] of targets) {
          shotKey[p].add(key(cx, cy));
          const piece = occ.get(key(cx, cy)) || null;
          const r = { x: cx, y: cy, hit: !!piece, piece, bomb, n: e.n };
          st.shots[p].push(r);
          results.push(r);
          if (piece) st.hitsBy[p]++;
        }
        // Versenkte Figuren
        const newlySunk = [];
        for (const pc of foe) {
          if (st.sunk[p].includes(pc.id)) continue;
          if (cellsOf(pc).every(([cx, cy]) => shotKey[p].has(key(cx, cy)))) { st.sunk[p].push(pc.id); newlySunk.push(pc.id); }
        }
        const anyHit = results.some((r) => r.hit);
        st.last = { kind: 'shot', by: p, bomb, aim: { x, y }, results, sunk: newlySunk, id: e.id };
        if (st.sunk[p].length === foe.length) { st.phase = 'end'; st.winner = p; st.endedAt = e.t; break; }
        if (!anyHit) st.turn = other(p);
        break;
      }
      case 'abort':
        st.phase = 'end'; st.aborted = true; st.abortBy = e.by; st.endedAt = e.t;
        break;
    }
  }
  return st;
}

export function todo(st, p) {
  if (st.phase === 'setup') {
    if (st.mode === 'remote') return st.fleets[p] ? null : 'Figuren verstecken';
    return 'Figuren verstecken';
  }
  if (st.phase !== 'play') return null;
  if (st.mode === 'remote') return st.turn === p ? 'Schießen' : null;
  return 'Weiterspielen';
}

export function label(st) {
  if (st.phase === 'setup') return 'Figuren werden versteckt';
  if (st.phase === 'play') return `${nameOf(st.turn)} ist dran – ${st.sunk.jos.length}:${st.sunk.joh.length} versenkt`;
  if (st.aborted) return 'Beendet';
  return `${nameOf(st.winner)} hat gewonnen`;
}
