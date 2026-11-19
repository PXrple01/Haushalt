// Galgenmännchen – reine Spiellogik (ohne Oberfläche).
// Ereignisse: setup {setter, guesser, lives} · word {w, hint, cat} · guess {l} · solve {w} · abort
import { LETTERS, cleanWord, nameOf } from '../../core/util.js';
import { enc, dec } from '../secret.js';

export const PARTS = 11; // Hügel, Pfahl, Balken, Stütze, Seil, Kopf, Körper, 2 Arme, 2 Beine
export const LEVELS = [
  { lives: 11, label: 'Entspannt', sub: '11 Fehler – der Galgen wird mitgebaut' },
  { lives: 8, label: 'Mittel', sub: '8 Fehler' },
  { lives: 6, label: 'Knifflig', sub: '6 Fehler – nur noch die Figur' },
];

export const isLetter = (c) => LETTERS.includes(c);

export function reduce(meta, evs) {
  const st = {
    game: 'hangman', id: meta.id, mode: meta.mode, phase: 'setup',
    setter: null, guesser: null, lives: 11, word: '', hint: '', cat: '',
    guessed: [], wrong: [], solves: [], misses: 0, last: null,
    status: 'playing', winner: null, aborted: false, endedAt: 0,
  };
  for (const e of evs) {
    const d = e.d || {};
    if (st.phase === 'end') break;
    switch (e.ty) {
      case 'setup':
        if (st.setter) break;
        st.setter = d.setter === 'joh' ? 'joh' : 'jos';
        st.guesser = st.setter === 'jos' ? 'joh' : 'jos';
        st.lives = [11, 8, 6].includes(d.lives) ? d.lives : 11;
        break;
      case 'word': {
        if (st.phase !== 'setup' || (meta.mode === 'remote' && e.by !== st.setter)) break;
        const w = cleanWord(dec(d.w, meta.id)).word;
        if (!w || ![...w].some(isLetter)) break;
        st.word = w;
        st.hint = String(d.hint || '').slice(0, 60);
        st.cat = String(d.cat || '').slice(0, 40);
        st.phase = 'play';
        break;
      }
      case 'guess': {
        if (st.phase !== 'play' || (meta.mode === 'remote' && e.by !== st.guesser)) break;
        const l = String(d.l || '');
        if (!isLetter(l) || st.guessed.includes(l)) break;
        st.guessed.push(l);
        const hit = st.word.includes(l);
        if (!hit) { st.wrong.push(l); st.misses++; }
        st.last = { kind: 'guess', l, hit, n: e.n, id: e.id };
        check(st, e);
        break;
      }
      case 'solve': {
        if (st.phase !== 'play' || (meta.mode === 'remote' && e.by !== st.guesser)) break;
        const g = cleanWord(String(d.w || '')).word;
        const ok = letters(g) === letters(st.word);
        st.solves.push({ w: g, ok });
        if (!ok) st.misses++;
        st.last = { kind: 'solve', w: g, hit: ok, n: e.n, id: e.id };
        if (ok) { st.status = 'won'; st.winner = st.guesser; st.phase = 'end'; st.endedAt = e.t; }
        else check(st, e);
        break;
      }
      case 'abort':
        st.phase = 'end'; st.aborted = true; st.abortBy = e.by; st.endedAt = e.t;
        break;
    }
  }
  return st;
}

const letters = (w) => [...w].filter(isLetter).join('');

function check(st, e) {
  const allFound = [...st.word].every((c) => !isLetter(c) || st.guessed.includes(c));
  if (allFound) { st.status = 'won'; st.winner = st.guesser; st.phase = 'end'; st.endedAt = e.t; return; }
  if (st.misses >= st.lives) { st.status = 'lost'; st.winner = st.setter; st.phase = 'end'; st.endedAt = e.t; }
}

// Wie viele Teile sind bei n Fehlern gezeichnet?
export const partsShown = (st) => Math.min(PARTS, PARTS - st.lives + st.misses);

// Was muss Person p jetzt tun? (für Lobby/Einladungen)
export function todo(st, p) {
  if (st.phase === 'setup') return p === st.setter ? 'Wort verstecken' : null;
  if (st.phase === 'play') return p === st.guesser ? 'Raten' : null;
  return null;
}
export function label(st) {
  if (st.phase === 'setup') return `${nameOf(st.setter)} versteckt ein Wort`;
  if (st.phase === 'play') return `${nameOf(st.guesser)} rät – ${st.lives - st.misses} Versuche übrig`;
  return st.aborted ? 'Beendet' : `${nameOf(st.winner)} hat gewonnen`;
}

export { enc, dec };
