// Zahl erraten (1–100) – reine Spiellogik.
// Jeder denkt sich eine Zahl. Abwechselnd genau eine Frage pro Zug (oder ein direkter Tipp, den die App prüft).
// Wer seine Zahl mit weniger Fragen findet, gewinnt.
// Ereignisse: setup {first} · secret {p, n} · ask {q, card} · answer {a, card} · guess {n} · giveup {p} · abort
import { nameOf, other } from '../../core/util.js';
import { dec } from '../secret.js';

export const MIN = 1, MAX = 100;

export function reduce(meta, evs) {
  const st = {
    game: 'number', id: meta.id, mode: meta.mode, phase: 'setup',
    first: 'jos', turn: 'jos',
    secrets: { jos: null, joh: null },   // secrets[p] = p's eigene Zahl (der andere rät sie)
    counts: { jos: 0, joh: 0 },
    done: { jos: null, joh: null },
    log: [], pending: null,
    winner: null, aborted: false, endedAt: 0, last: null,
  };
  const nextTurn = (p) => { const o = other(p); st.turn = st.done[o] ? p : o; };
  const finishIfDone = (e) => {
    if (st.done.jos && st.done.joh) {
      st.phase = 'end'; st.endedAt = e.t;
      const a = st.done.jos.gaveUp ? Infinity : st.done.jos.at;
      const b = st.done.joh.gaveUp ? Infinity : st.done.joh.at;
      st.winner = a < b ? 'jos' : b < a ? 'joh' : 'draw';
    }
  };
  // „Rückgängig“ (nur Nebeneinander): ein undo-Ereignis hebt ein früheres Ereignis auf
  const undone = new Set(meta.mode === 'couch' ? evs.filter((e) => e.ty === 'undo' && e.d?.id).map((e) => e.d.id) : []);
  for (const e of evs) {
    const d = e.d || {};
    if (e.ty === 'undo' || undone.has(e.id)) continue;
    if (st.phase === 'end') break;
    switch (e.ty) {
      case 'setup':
        st.first = st.turn = d.first === 'joh' ? 'joh' : 'jos';
        break;
      case 'secret': {
        if (st.phase !== 'setup') break;
        const p = meta.mode === 'remote' ? e.by : (d.p === 'joh' ? 'joh' : 'jos');
        const n = parseInt(dec(d.n, meta.id), 10);
        if (!(n >= MIN && n <= MAX)) break;
        st.secrets[p] = n;
        if (st.secrets.jos != null && st.secrets.joh != null) { st.phase = 'play'; st.turn = st.first; }
        break;
      }
      case 'ask': {
        if (st.phase !== 'play' || st.pending || (meta.mode === 'remote' && e.by !== st.turn)) break;
        const q = String(d.q || '').trim().slice(0, 160);
        if (!q) break;
        st.pending = { by: st.turn, q, card: d.card || null, t: e.t };
        st.last = { kind: 'ask', by: st.turn, id: e.id };
        break;
      }
      case 'answer': {
        if (st.phase !== 'play') break;
        if (!['ja', 'nein', 'weissnicht'].includes(d.a)) break;
        const asker = st.turn;
        if (meta.mode === 'remote' && (!st.pending || e.by === asker)) break;
        st.counts[asker]++;
        st.log.push({ by: asker, q: st.pending?.q || String(d.q || '').slice(0, 160), card: st.pending?.card || d.card || null, a: d.a, n: st.counts[asker], t: e.t });
        st.pending = null;
        st.last = { kind: 'answer', by: asker, a: d.a, card: st.log.at(-1).card, id: e.id };
        nextTurn(asker);
        break;
      }
      case 'guess': {
        if (st.phase !== 'play' || st.pending || (meta.mode === 'remote' && e.by !== st.turn)) break;
        const p = st.turn;
        const n = parseInt(d.n, 10);
        if (!(n >= MIN && n <= MAX)) break;
        st.counts[p]++;
        const ok = n === st.secrets[other(p)];
        st.log.push({ by: p, guess: n, ok, a: ok ? 'ja' : 'nein', n: st.counts[p], t: e.t });
        st.last = { kind: 'guess', by: p, guess: n, ok, id: e.id };
        if (ok) { st.done[p] = { solved: true, at: st.counts[p] }; nextTurn(p); finishIfDone(e); }
        else nextTurn(p);
        break;
      }
      case 'giveup': {
        const p = meta.mode === 'couch' && (d.p === 'jos' || d.p === 'joh') ? d.p : e.by;
        if (st.phase !== 'play' || st.done[p]) break;
        st.done[p] = { solved: false, at: st.counts[p], gaveUp: true };
        if (st.pending?.by === p) st.pending = null;
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
    if (st.mode === 'remote') return st.secrets[p] == null ? 'Zahl aussuchen' : null;
    return 'Zahlen aussuchen';
  }
  if (st.phase !== 'play') return null;
  if (st.mode === 'remote') {
    if (st.pending && st.pending.by !== p) return 'Antworten';
    if (st.turn === p && !st.pending) return 'Fragen';
    return null;
  }
  return 'Weiterspielen';
}

export function label(st) {
  if (st.phase === 'setup') return 'Zahlen werden ausgesucht';
  if (st.phase === 'play') return `${nameOf(st.turn)} fragt – Frage ${st.counts[st.turn] + 1}`;
  if (st.aborted) return 'Beendet';
  return st.winner === 'draw' ? 'Unentschieden' : `${nameOf(st.winner)} hat gewonnen`;
}
