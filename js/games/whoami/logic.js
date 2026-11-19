// Wer bin ich? – reine Spiellogik.
// Jeder bekommt vom anderen eine Figur. Abwechselnd Ja/Nein-Fragen: bei „Ja“/„Vielleicht“ weiterfragen, bei „Nein“ ist der andere dran.
// Wer mit weniger Fragen errät, gewinnt. Aufgeben ist möglich.
// Ereignisse: setup {first} · char {for, name, cat} · ask {q} · answer {a} · solve {g} · judge {ok} · giveup · abort
import { nameMatch, nameOf, other } from '../../core/util.js';
import { dec } from '../secret.js';

export const ANSWERS = {
  ja: { label: 'Ja', icon: 'check', cls: 'good' },
  nein: { label: 'Nein', icon: 'cross', cls: 'bad' },
  vielleicht: { label: 'Vielleicht', icon: 'maybe', cls: 'maybe' },
};

export function reduce(meta, evs) {
  const st = {
    game: 'whoami', id: meta.id, mode: meta.mode, phase: 'setup',
    first: 'jos', turn: 'jos',
    chars: { jos: null, joh: null },      // chars[p] = Figur, die p erraten muss
    counts: { jos: 0, joh: 0 },
    done: { jos: null, joh: null },       // { solved, at, gaveUp }
    log: [], pending: null, pendingSolve: null,
    winner: null, aborted: false, endedAt: 0, last: null,
  };
  const nextTurn = (p) => {
    const o = other(p);
    st.turn = st.done[o] ? p : o;
  };
  const finishIfDone = (e) => {
    if (st.done.jos && st.done.joh) {
      st.phase = 'end'; st.endedAt = e.t;
      const sj = st.done.jos.gaveUp ? Infinity : st.done.jos.at;
      const sh = st.done.joh.gaveUp ? Infinity : st.done.joh.at;
      st.winner = sj < sh ? 'jos' : sh < sj ? 'joh' : 'draw';
    }
  };
  for (const e of evs) {
    const d = e.d || {};
    if (st.phase === 'end') break;
    switch (e.ty) {
      case 'setup':
        st.first = st.turn = d.first === 'joh' ? 'joh' : 'jos';
        break;
      case 'char': {
        if (st.phase !== 'setup') break;
        const p = d.for === 'joh' ? 'joh' : 'jos';
        if (e.by !== other(p) && meta.mode === 'remote') break; // im Fern-Modus wählt der andere
        const name = dec(d.name, meta.id).trim().slice(0, 60);
        if (!name) break;
        st.chars[p] = { name, cat: String(d.cat || '').slice(0, 40), by: other(p) };
        if (st.chars.jos && st.chars.joh) { st.phase = 'play'; st.turn = st.first; }
        break;
      }
      case 'ask': {
        if (st.phase !== 'play' || (meta.mode === 'remote' && e.by !== st.turn) || st.pending || st.pendingSolve) break;
        const q = String(d.q || '').trim().slice(0, 160);
        if (!q) break;
        st.pending = { by: e.by, q, t: e.t };
        st.last = { kind: 'ask', by: e.by, id: e.id };
        break;
      }
      case 'answer': {
        if (st.phase !== 'play') break;
        const a = d.a;
        if (!['ja', 'nein', 'vielleicht', 'richtig'].includes(a)) break;
        const asker = st.turn;
        if (meta.mode === 'remote' && (!st.pending || e.by === asker)) break; // im Fern-Modus antwortet der andere auf eine Frage
        st.counts[asker]++;
        const entry = { by: asker, q: st.pending?.q || '', a, n: st.counts[asker], t: e.t };
        st.log.push(entry);
        st.pending = null;
        st.last = { kind: 'answer', by: asker, a, id: e.id };
        if (a === 'richtig') {
          st.done[asker] = { solved: true, at: st.counts[asker] };
          nextTurn(asker);
          finishIfDone(e);
        } else if (a === 'nein') nextTurn(asker);
        break;
      }
      case 'solve': {
        if (st.phase !== 'play' || (meta.mode === 'remote' && e.by !== st.turn) || st.pending || st.pendingSolve) break;
        const p = meta.mode === 'remote' ? e.by : st.turn;
        const g = String(d.g || '').trim().slice(0, 60);
        if (!g) break;
        const m = nameMatch(g, st.chars[p]?.name);
        if (m === 'exact') {
          st.counts[p]++;
          st.log.push({ by: p, q: `Bin ich ${g}?`, a: 'richtig', n: st.counts[p], t: e.t, solve: true });
          st.done[p] = { solved: true, at: st.counts[p] };
          st.last = { kind: 'solved', by: p, id: e.id };
          nextTurn(p);
          finishIfDone(e);
        } else {
          st.pendingSolve = { by: p, g, close: m === 'close', t: e.t };
          st.last = { kind: 'solve', by: p, id: e.id };
        }
        break;
      }
      case 'judge': {
        if (st.phase !== 'play' || !st.pendingSolve || (meta.mode === 'remote' && e.by === st.pendingSolve.by)) break;
        const p = st.pendingSolve.by;
        st.counts[p]++;
        const ok = !!d.ok;
        st.log.push({ by: p, q: `Bin ich ${st.pendingSolve.g}?`, a: ok ? 'richtig' : 'nein', n: st.counts[p], t: e.t, solve: true });
        st.pendingSolve = null;
        st.last = { kind: ok ? 'solved' : 'judge', by: p, ok, id: e.id };
        if (ok) { st.done[p] = { solved: true, at: st.counts[p] }; nextTurn(p); finishIfDone(e); }
        else nextTurn(p);
        break;
      }
      case 'giveup': {
        const p = meta.mode === 'couch' && (d.p === 'jos' || d.p === 'joh') ? d.p : e.by;
        if (st.phase !== 'play' || st.done[p]) break;
        st.done[p] = { solved: false, at: st.counts[p], gaveUp: true };
        st.pending = null; st.pendingSolve = null;
        st.last = { kind: 'giveup', by: p, id: e.id };
        if (st.turn === p) nextTurn(p);
        finishIfDone(e);
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
    if (st.mode === 'remote') return st.chars[other(p)] ? null : 'Figur aussuchen';
    return 'Figuren aussuchen';
  }
  if (st.phase !== 'play') return null;
  if (st.mode === 'remote') {
    if (st.pendingSolve && st.pendingSolve.by !== p) return 'Tipp prüfen';
    if (st.pending && st.pending.by !== p) return 'Antworten';
    if (st.turn === p && !st.pending && !st.pendingSolve) return 'Fragen';
    return null;
  }
  return 'Weiterspielen';
}

export function label(st) {
  if (st.phase === 'setup') return 'Figuren werden ausgesucht';
  if (st.phase === 'play') return `${nameOf(st.turn)} fragt – Frage ${st.counts[st.turn] + 1}`;
  if (st.aborted) return 'Beendet';
  return st.winner === 'draw' ? 'Unentschieden' : `${nameOf(st.winner)} hat gewonnen`;
}
