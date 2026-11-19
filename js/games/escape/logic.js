// Escape-Abenteuer – reine Spiellogik. Zusammen statt gegeneinander, immer mit zwei Handys.
// Pro Raum ist einer an den „Händen“ (bedient), der andere hat das „Wissen“ (Buch, Karte, Regeln). Rollen wechseln jeden Raum.
// Ereignisse: setup {theme, diff, seed, first} · ready {p} · act {r, k, …} · hint {r} · next {r} · cont · giveup · abort
import { nameOf, other } from '../../core/util.js';
import { makeRng } from './rng.js';
import { PUZZLES } from './puzzles.js';
import { THEMES, themeById } from './themes.js';

export const DIFFS = {
  gemuetlich: { id: 'gemuetlich', title: 'Gemütlich', sub: 'Ohne Zeitdruck', limit: 0 },
  normal: { id: 'normal', title: 'Normal', sub: '25 Minuten', limit: 25 * 60e3 },
  knifflig: { id: 'knifflig', title: 'Knifflig', sub: '15 Minuten, schwerere Rätsel', limit: 15 * 60e3 },
};
export const PEN = { mistake: 20e3, bump: 5e3, hint: 60e3 };
export const MAX_HINTS = 3;

// Räume aus Geschichte + Stufe + Seed erzeugen (auf beiden Handys gleich). Wird zwischengespeichert.
const cache = new Map();
export function buildRooms(themeId, diff, seed) {
  const key = `${themeId}|${diff}|${seed}`;
  if (cache.has(key)) return cache.get(key);
  const th = themeById(themeId);
  if (!th) return [];
  const rooms = th.rooms.map((room, r) => {
    const rng = makeRng(`${seed}:${themeId}:${r}`);
    return { ...room, r, spec: PUZZLES[room.kind].gen(rng, { diff, skin: room.skin, symbols: th.symbols }) };
  });
  if (cache.size > 20) cache.clear();
  cache.set(key, rooms);
  return rooms;
}

// Wer ist in Raum r an den Händen?
export const handsOf = (st, r = st.room) => (r % 2 === 0 ? st.first : other(st.first));

export function reduce(meta, evs) {
  const st = {
    game: 'escape', id: meta.id, mode: meta.mode, phase: 'setup',
    theme: null, diff: 'normal', seed: '', first: 'jos', limit: 0,
    ready: { jos: false, joh: false },
    rooms: [], rs: [], room: 0,
    startT: 0, roomT: 0, pausedMs: 0, pauseSince: 0, penaltyMs: 0,
    hintsUsed: [0, 0, 0, 0], hints: 0, mistakes: 0, bumps: 0, solvedAt: [],
    overtime: false, won: false, gaveUp: false, aborted: false, endedAt: 0, last: null,
  };
  const remote = meta.mode === 'remote';
  for (const e of evs) {
    const d = e.d || {};
    if (st.phase === 'end') break;
    switch (e.ty) {
      case 'setup': {
        if (st.phase !== 'setup') break;
        const th = themeById(d.theme) || THEMES[0];
        st.theme = th.id;
        st.diff = DIFFS[d.diff] ? d.diff : 'normal';
        st.limit = DIFFS[st.diff].limit;
        st.seed = String(d.seed || meta.id).slice(0, 24);
        st.first = d.first === 'joh' ? 'joh' : 'jos';
        st.rooms = buildRooms(st.theme, st.diff, st.seed);
        st.rs = st.rooms.map((rm) => PUZZLES[rm.kind].init(rm.spec));
        st.phase = 'intro';
        break;
      }
      case 'ready': {
        if (st.phase !== 'intro') break;
        const p = remote ? e.by : (d.p === 'joh' ? 'joh' : 'jos');
        st.ready[p] = true;
        if (st.ready.jos && st.ready.joh) { st.phase = 'room'; st.startT = st.roomT = e.t; st.last = { kind: 'start', id: e.id }; }
        break;
      }
      case 'act': {
        if (st.phase !== 'room' || d.r !== st.room) break;
        if (remote && e.by !== handsOf(st)) break;
        const rm = st.rooms[st.room];
        const res = PUZZLES[rm.kind].apply(rm.spec, st.rs[st.room], d);
        st.rs[st.room] = res.state;
        if (res.mistake) {
          st.mistakes++;
          if (st.limit && !st.overtime) st.penaltyMs += PEN.mistake;
          st.last = { kind: 'mistake', r: st.room, by: e.by, id: e.id, k: d.k };
        } else if (res.bump) {
          st.bumps++;
          if (st.limit && !st.overtime) st.penaltyMs += PEN.bump;
          st.last = { kind: 'bump', r: st.room, by: e.by, id: e.id, d: d.d };
        } else {
          st.last = { kind: 'act', r: st.room, by: e.by, id: e.id, k: d.k };
        }
        if (res.solved) {
          st.solvedAt[st.room] = e.t;
          st.last = { kind: 'solved', r: st.room, by: e.by, id: e.id };
          if (st.room === st.rooms.length - 1) { st.phase = 'end'; st.won = true; st.endedAt = e.t; }
          else { st.phase = 'cleared'; st.pauseSince = e.t; }
        }
        break;
      }
      case 'hint': {
        if (st.phase !== 'room' || d.r !== st.room || st.hintsUsed[st.room] >= MAX_HINTS) break;
        st.hintsUsed[st.room]++;
        st.hints++;
        if (st.limit && !st.overtime) st.penaltyMs += PEN.hint;
        st.last = { kind: 'hint', r: st.room, by: e.by, id: e.id, n: st.hintsUsed[st.room] };
        break;
      }
      case 'next': {
        if (st.phase !== 'cleared' || d.r !== st.room) break;
        st.pausedMs += Math.max(0, e.t - st.pauseSince);
        st.pauseSince = 0;
        st.room++;
        st.roomT = e.t;
        st.phase = 'room';
        st.last = { kind: 'next', r: st.room, by: e.by, id: e.id };
        break;
      }
      case 'cont':
        if ((st.phase === 'room' || st.phase === 'cleared') && st.limit && !st.overtime) {
          st.overtime = true;
          st.overtimeAt = e.t;
          st.last = { kind: 'cont', by: e.by, id: e.id };
        }
        break;
      case 'giveup':
        if (st.phase === 'setup') break;
        st.phase = 'end'; st.gaveUp = true; st.endedAt = e.t; st.last = { kind: 'giveup', by: e.by, id: e.id };
        break;
      case 'abort':
        st.phase = 'end'; st.aborted = true; st.abortBy = e.by; st.endedAt = e.t;
        break;
    }
  }
  return st;
}

// Verbrauchte Zeit (inkl. Strafen) bis jetzt bzw. bis zum Ende
export function elapsed(st, now = Date.now()) {
  if (!st.startT) return 0;
  const until = st.pauseSince || (st.phase === 'end' ? st.endedAt : now);
  return Math.max(0, until - st.startT - st.pausedMs) + st.penaltyMs;
}
// Restzeit (null = ohne Zeitlimit)
export function remaining(st, now = Date.now()) {
  if (!st.limit) return null;
  return st.limit - elapsed(st, now);
}
export const timeUp = (st, now = Date.now()) => !!st.limit && !st.overtime && st.phase !== 'end' && st.startT > 0 && remaining(st, now) <= 0;

// Sterne nach dem Sieg
export function starsOf(st) {
  if (!st.won) return 0;
  if (st.limit) {
    if (st.overtime) return 1;
    const left = (st.limit - elapsed(st)) / st.limit;
    return left >= .4 ? 3 : left >= .15 ? 2 : 1;
  }
  const score = st.hints + st.mistakes / 3 + st.bumps / 12;
  return score <= 1.5 ? 3 : score <= 5 ? 2 : 1;
}

export function todo(st, p) {
  if (st.phase === 'intro') return st.ready[p] ? null : 'Abenteuer beginnen';
  if (st.phase === 'room' || st.phase === 'cleared') return 'Weiterrätseln';
  return null;
}

export function label(st) {
  const th = themeById(st.theme);
  if (st.phase === 'setup') return 'Wird vorbereitet';
  if (st.phase === 'intro') return `${th?.short || 'Abenteuer'} – gleich geht’s los`;
  if (st.phase === 'room' || st.phase === 'cleared') return `${th?.short || 'Abenteuer'} – Raum ${st.room + 1} von ${st.rooms.length}`;
  if (st.aborted) return 'Beendet';
  if (st.gaveUp) return 'Aufgegeben';
  return `Geschafft! ${'★'.repeat(starsOf(st))}`;
}

// Kurzer Satz für das Ende im Fern-Modus (Hinweis, wenn man woanders ist)
export function endLine(st) {
  if (st.won) return `Ihr habt es geschafft! ${'★'.repeat(starsOf(st))}`;
  if (st.gaveUp) return 'Ihr habt aufgegeben.';
  return 'Das Abenteuer wurde beendet.';
}

export const whoLabel = (p) => nameOf(p);
