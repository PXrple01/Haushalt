// Gemeinsame Logik für Rundenspiele (Pantomime, Kritzelspiel): abwechselnd darstellen/zeichnen, der andere rät.
// Ereignisse: setup {first, n, dur, cats, level} · term {r, w, cat} · go {r} · got {r, ms} · miss {r}
//             guess {r, g} (Weit weg, Kritzelspiel) · stroke {r, …} · undo {r} · clear {r} · abort
// Punkte: Darsteller 3/2/1 je nach Tempo (erstes/zweites/letztes Drittel der Zeit), Rater 1.
import { nameMatch, nameOf, other } from '../core/util.js';
import { dec } from './secret.js';

export const DURS = [60, 90, 120];
export const ROUND_COUNTS = [3, 5, 7];

export const actorOf = (st, r) => (r % 2 === 0 ? st.first : other(st.first));

export function pointsFor(ms, dur) {
  const f = ms / (dur * 1000);
  return f <= 1 / 3 ? 3 : f <= 2 / 3 ? 2 : 1;
}

export function reduceRounds(meta, evs) {
  const st = {
    game: meta.game, id: meta.id, mode: meta.mode, phase: 'play',
    first: 'jos', n: 3, dur: 90, cats: ['all'], level: 'mittel',
    r: 0, total: 6, rounds: [], score: { jos: 0, joh: 0 },
    winner: null, aborted: false, endedAt: 0, last: null,
  };
  const cur = () => st.rounds[st.r];
  const finishRound = (e, got, ms) => {
    const R = cur();
    R.status = 'done'; R.got = got; R.endT = e.t;
    if (got) {
      R.ms = Math.max(0, Math.min(st.dur * 1000, ms));
      R.pts = { [R.actor]: pointsFor(R.ms, st.dur), [other(R.actor)]: 1 };
      st.score[R.actor] += R.pts[R.actor];
      st.score[other(R.actor)] += 1;
    } else R.pts = { [R.actor]: 0, [other(R.actor)]: 0 };
    st.last = { kind: got ? 'got' : 'miss', r: st.r, id: e.id };
    st.r++;
    if (st.r >= st.total) {
      st.phase = 'end'; st.endedAt = e.t;
      st.winner = st.score.jos > st.score.joh ? 'jos' : st.score.joh > st.score.jos ? 'joh' : 'draw';
    }
  };
  for (const e of evs) {
    const d = e.d || {};
    if (st.phase === 'end') break;
    if (e.ty === 'setup') {
      st.first = d.first === 'joh' ? 'joh' : 'jos';
      st.n = [3, 5, 7].includes(d.n) ? d.n : 3;
      st.dur = [60, 90, 120].includes(d.dur) ? d.dur : 90;
      st.cats = Array.isArray(d.cats) && d.cats.length ? d.cats.slice(0, 12).map(String) : ['all'];
      st.level = ['leicht', 'mittel', 'schwer', 'alle'].includes(d.level) ? d.level : 'mittel';
      st.total = st.n * 2;
      continue;
    }
    if (e.ty === 'abort') { st.phase = 'end'; st.aborted = true; st.abortBy = e.by; st.endedAt = e.t; break; }
    if (d.r !== st.r) continue; // nur die aktuelle Runde
    const R = cur();
    const actor = actorOf(st, st.r);
    const isActor = meta.mode !== 'remote' || e.by === actor;
    switch (e.ty) {
      case 'term': {
        if (!isActor || (R && R.status !== 'ready')) break;
        const term = dec(d.w, meta.id).trim().slice(0, 60);
        if (!term) break;
        st.rounds[st.r] = { actor, term, cat: String(d.cat || '').slice(0, 40), status: 'ready', strokes: [], guesses: [], rerolls: (R?.rerolls ?? -1) + 1 };
        break;
      }
      case 'go':
        if (!isActor || !R || R.status !== 'ready') break;
        R.status = 'live'; R.startT = e.t;
        st.last = { kind: 'go', r: st.r, id: e.id };
        break;
      case 'got':
        if (!R || R.status !== 'live') break;
        finishRound(e, true, Number.isFinite(d.ms) ? d.ms : e.t - R.startT);
        break;
      case 'miss':
        if (!R || R.status !== 'live') break;
        finishRound(e, false, 0);
        break;
      case 'guess': {
        if (!R || R.status !== 'live' || (meta.mode === 'remote' && e.by === actor)) break;
        const g = String(d.g || '').trim().slice(0, 60);
        if (!g) break;
        const ok = nameMatch(g, R.term) !== 'no';
        R.guesses.push({ g, ok, t: e.t });
        st.last = { kind: 'guess', r: st.r, ok, g, id: e.id };
        if (ok) finishRound(e, true, e.t - R.startT);
        break;
      }
      case 'stroke':
        if (!R || R.status !== 'live' || !isActor || !Array.isArray(d.p)) break;
        R.strokes.push({ c: String(d.c || '#000').slice(0, 9), s: Math.max(1, Math.min(60, +d.s || 8)), p: d.p.slice(0, 600).map((v) => Math.max(0, Math.min(1000, Math.round(+v) || 0))), id: e.id });
        break;
      case 'undo':
        if (!R || R.status !== 'live' || !isActor) break;
        R.strokes.pop();
        break;
      case 'clear':
        if (!R || R.status !== 'live' || !isActor) break;
        R.strokes = [];
        break;
    }
  }
  return st;
}

export function roundTodo(st, p, verb) {
  if (st.phase !== 'play') return null;
  if (st.mode !== 'remote') return 'Weiterspielen';
  const R = st.rounds[st.r];
  const actor = actorOf(st, st.r);
  if (actor === p && (!R || R.status === 'ready')) return verb;
  if (actor !== p && R?.status === 'live') return 'Raten';
  return null;
}

export function roundLabel(st, verbPhrase) {
  if (st.phase === 'play') return `Runde ${st.r + 1} von ${st.total} – ${nameOf(actorOf(st, st.r))} ${verbPhrase}`;
  if (st.aborted) return 'Beendet';
  return st.winner === 'draw' ? 'Unentschieden' : `${nameOf(st.winner)} hat gewonnen`;
}
