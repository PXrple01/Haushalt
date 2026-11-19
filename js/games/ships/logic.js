// Herzchen versenken – reine Spiellogik.
// 8×8-Meer, fünf Figuren. Abwechselnd schießen, bei Treffer nochmal. Einmal pro Spiel ein Spezialschuss (3×3).
// Ereignisse: setup {first} · fleet {p, f} (verschleiert) · shot {x, y, bomb} · abort
import { nameOf, other } from '../../core/util.js';
import { dec } from '../secret.js';

export const N = 8;
export const FLEET = [
  { id: 'einhorn', len: 4, name: 'Einhorn' },
  { id: 'wolke', len: 3, name: 'Wolke' },
  { id: 'katze', len: 3, name: 'Katze' },
  { id: 'herz', len: 2, name: 'Herzchen' },
  { id: 'stern', len: 2, name: 'Sternschnuppe' },
];
export const pieceInfo = (id) => FLEET.find((f) => f.id === id);
export const TOTAL_CELLS = FLEET.reduce((a, f) => a + f.len, 0);

export function cellsOf(pc) {
  const f = pieceInfo(pc.id);
  return Array.from({ length: f.len }, (_, i) => (pc.dir === 'v' ? [pc.x, pc.y + i] : [pc.x + i, pc.y]));
}
const key = (x, y) => y * N + x;

// Passt eine Figur (ohne Überlappung mit den anderen)?
export function fits(pc, others = []) {
  const cells = cellsOf(pc);
  if (cells.some(([x, y]) => x < 0 || y < 0 || x >= N || y >= N)) return false;
  const taken = new Set(others.filter((o) => o.id !== pc.id).flatMap((o) => cellsOf(o).map(([x, y]) => key(x, y))));
  return cells.every(([x, y]) => !taken.has(key(x, y)));
}

export function validFleet(f) {
  if (!Array.isArray(f) || f.length !== FLEET.length) return false;
  const ids = new Set(f.map((p) => p.id));
  if (ids.size !== FLEET.length || FLEET.some((x) => !ids.has(x.id))) return false;
  if (f.some((p) => !['h', 'v'].includes(p.dir) || !Number.isInteger(p.x) || !Number.isInteger(p.y))) return false;
  return f.every((p, i) => fits(p, f.slice(0, i)));
}

export function randomFleet(rng = Math.random) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const out = [];
    let ok = true;
    for (const f of FLEET) {
      let placed = false;
      for (let t = 0; t < 100 && !placed; t++) {
        const dir = rng() < .5 ? 'h' : 'v';
        const pc = { id: f.id, dir, x: Math.floor(rng() * (dir === 'h' ? N - f.len + 1 : N)), y: Math.floor(rng() * (dir === 'v' ? N - f.len + 1 : N)) };
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
    first: 'jos', turn: 'jos',
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
        break;
      case 'fleet': {
        if (st.phase !== 'setup') break;
        const p = meta.mode === 'remote' ? e.by : (d.p === 'joh' ? 'joh' : 'jos');
        let f = null;
        try { f = JSON.parse(dec(d.f, meta.id)); } catch { f = null; }
        if (!validFleet(f)) break;
        st.fleets[p] = f.map((x) => ({ id: x.id, x: x.x, y: x.y, dir: x.dir }));
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
        if (st.sunk[p].length === FLEET.length) { st.phase = 'end'; st.winner = p; st.endedAt = e.t; break; }
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
