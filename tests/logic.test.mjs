// Prüft die reine Spiellogik (ohne Browser). Aufruf: node tests/logic.test.mjs
import assert from 'node:assert/strict';
import * as HM from '../js/games/hangman/logic.js';
import * as WA from '../js/games/whoami/logic.js';
import * as NU from '../js/games/number/logic.js';
import { enc } from '../js/games/secret.js';
import { cleanWord, nameMatch } from '../js/core/util.js';

let n = 0;
const ev = (by, ty, d = {}) => ({ id: 'e' + (++n), n, by, t: n, ty, d });
const meta = (game, mode = 'couch') => ({ id: 'testsession1', game, mode, by: 'jos' });
let ok = 0;
const test = (name, fn) => { fn(); ok++; console.log('✓', name); };

test('Wörter säubern (Umlaute, ß, Akzente, Leerzeichen)', () => {
  assert.equal(cleanWord('  Straße ').word, 'STRAßE');
  assert.equal(cleanWord('Crème brûlée').word, 'CREME BRULEE');
  assert.equal(cleanWord('Über-Ei').word, 'ÜBER-EI');
  assert.deepEqual(cleanWord('R2D2').bad, ['2']);
  assert.equal(cleanWord('Äpfel').letters, 5);
});

test('Namen vergleichen', () => {
  assert.equal(nameMatch('pikachu', 'Pikachu'), 'exact');
  assert.equal(nameMatch('Pikatchu', 'Pikachu'), 'close');
  assert.equal(nameMatch('Elsa', 'Die Eiskönigin Elsa'), 'close');
  assert.equal(nameMatch('Mario', 'Pikachu'), 'no');
  assert.equal(nameMatch('Thor', 'Thor'), 'exact');
});

test('Galgenmännchen: Gewinn', () => {
  const m = meta('hangman');
  const evs = [ev('jos', 'setup', { setter: 'jos', lives: 11 }), ev('jos', 'word', { w: enc('Kiwi', m.id), hint: 'Obst' })];
  let st = HM.reduce(m, evs);
  assert.equal(st.phase, 'play'); assert.equal(st.word, 'KIWI'); assert.equal(st.guesser, 'joh');
  evs.push(ev('jos', 'guess', { l: 'K' }), ev('jos', 'guess', { l: 'X' }), ev('jos', 'guess', { l: 'I' }));
  st = HM.reduce(m, evs);
  assert.equal(st.misses, 1); assert.equal(st.phase, 'play');
  evs.push(ev('jos', 'guess', { l: 'W' }));
  st = HM.reduce(m, evs);
  assert.equal(st.phase, 'end'); assert.equal(st.winner, 'joh');
});

test('Galgenmännchen: Verlust und doppelte Buchstaben', () => {
  const m = meta('hangman');
  const evs = [ev('jos', 'setup', { setter: 'joh', lives: 6 }), ev('joh', 'word', { w: enc('Mond', m.id) })];
  for (const l of 'ABCEFG') evs.push(ev('jos', 'guess', { l }));
  evs.push(ev('jos', 'guess', { l: 'A' }));
  const st = HM.reduce(m, evs);
  assert.equal(st.misses, 6); assert.equal(st.phase, 'end'); assert.equal(st.winner, 'joh');
  assert.equal(HM.partsShown(st), 11);
});

test('Galgenmännchen: Wort lösen (falsch = Fehler, richtig = Sieg)', () => {
  const m = meta('hangman');
  const evs = [ev('jos', 'setup', { setter: 'jos', lives: 8 }), ev('jos', 'word', { w: enc('Grüße', m.id) })];
  evs.push(ev('joh', 'solve', { w: 'Grusse' }));
  let st = HM.reduce(m, evs);
  assert.equal(st.misses, 1); assert.equal(HM.partsShown(st), 4);
  evs.push(ev('joh', 'solve', { w: 'grüße' }));
  st = HM.reduce(m, evs);
  assert.equal(st.winner, 'joh');
});

test('Galgenmännchen Fern-Modus: nur der Rater darf raten', () => {
  const m = meta('hangman', 'remote');
  const evs = [ev('jos', 'setup', { setter: 'jos', lives: 11 }), ev('jos', 'word', { w: enc('Hase', m.id) }), ev('jos', 'guess', { l: 'H' }), ev('joh', 'guess', { l: 'A' })];
  const st = HM.reduce(m, evs);
  assert.deepEqual(st.guessed, ['A']);
});

test('Wer bin ich? Couch: Zugwechsel bei Nein, Ende, Gewinner', () => {
  const m = meta('whoami');
  const evs = [ev('jos', 'setup', { first: 'jos' }),
    ev('jos', 'char', { for: 'joh', name: enc('Pikachu', m.id) }),
    ev('jos', 'char', { for: 'jos', name: enc('Elsa', m.id) })];
  let st = WA.reduce(m, evs);
  assert.equal(st.phase, 'play'); assert.equal(st.turn, 'jos');
  evs.push(ev('jos', 'answer', { a: 'ja' }), ev('jos', 'answer', { a: 'nein' }));
  st = WA.reduce(m, evs);
  assert.equal(st.turn, 'joh'); assert.equal(st.counts.jos, 2);
  evs.push(ev('jos', 'answer', { a: 'richtig' }));
  st = WA.reduce(m, evs);
  assert.deepEqual(st.done.joh, { solved: true, at: 1 }); assert.equal(st.turn, 'jos');
  evs.push(ev('jos', 'answer', { a: 'vielleicht' }), ev('jos', 'answer', { a: 'richtig' }));
  st = WA.reduce(m, evs);
  assert.equal(st.phase, 'end'); assert.equal(st.winner, 'joh');
});

test('Wer bin ich? Fern: Frage → Antwort, Lösen mit Bestätigung', () => {
  const m = meta('whoami', 'remote');
  const evs = [ev('jos', 'setup', { first: 'joh' }),
    ev('jos', 'char', { for: 'joh', name: enc('Darth Vader', m.id) }),
    ev('joh', 'char', { for: 'jos', name: enc('Hermine Granger', m.id) })];
  evs.push(ev('jos', 'ask', { q: 'falscher Spieler' }));
  let st = WA.reduce(m, evs);
  assert.equal(st.pending, null);
  evs.push(ev('joh', 'ask', { q: 'Bin ich ein Mensch?' }), ev('jos', 'answer', { a: 'ja' }));
  st = WA.reduce(m, evs);
  assert.equal(st.counts.joh, 1); assert.equal(st.turn, 'joh');
  evs.push(ev('joh', 'solve', { g: 'Darth Wader' }));
  st = WA.reduce(m, evs);
  assert.equal(st.pendingSolve.close, true);
  evs.push(ev('jos', 'judge', { ok: true }));
  st = WA.reduce(m, evs);
  assert.deepEqual(st.done.joh, { solved: true, at: 2 }); assert.equal(st.turn, 'jos');
  evs.push(ev('jos', 'solve', { g: 'hermine granger' }));
  st = WA.reduce(m, evs);
  assert.equal(st.phase, 'end'); assert.equal(st.winner, 'jos');
});

test('Wer bin ich? Aufgeben verliert', () => {
  const m = meta('whoami');
  const evs = [ev('jos', 'setup', { first: 'jos' }), ev('jos', 'char', { for: 'joh', name: enc('A', m.id) }), ev('jos', 'char', { for: 'jos', name: enc('B', m.id) }),
    ev('jos', 'giveup', { p: 'jos' })];
  let st = WA.reduce(m, evs);
  assert.equal(st.turn, 'joh');
  for (let i = 0; i < 9; i++) evs.push(ev('jos', 'answer', { a: 'ja' }));
  evs.push(ev('jos', 'answer', { a: 'richtig' }));
  st = WA.reduce(m, evs);
  assert.equal(st.winner, 'joh');
});

test('Zahl erraten: abwechselnd, Tipp wird geprüft', () => {
  const m = meta('number');
  const evs = [ev('jos', 'setup', { first: 'jos' }), ev('jos', 'secret', { p: 'jos', n: enc('42', m.id) }), ev('jos', 'secret', { p: 'joh', n: enc('7', m.id) })];
  let st = NU.reduce(m, evs);
  assert.equal(st.phase, 'play');
  evs.push(ev('jos', 'answer', { a: 'nein', card: 'even' }));
  st = NU.reduce(m, evs);
  assert.equal(st.turn, 'joh'); assert.equal(st.log[0].card, 'even');
  evs.push(ev('jos', 'guess', { n: 41 }));
  st = NU.reduce(m, evs);
  assert.equal(st.log.at(-1).ok, false); assert.equal(st.turn, 'jos');
  evs.push(ev('jos', 'guess', { n: 7 }));
  st = NU.reduce(m, evs);
  assert.deepEqual(st.done.jos, { solved: true, at: 2 }); assert.equal(st.turn, 'joh');
  evs.push(ev('jos', 'guess', { n: 42 }));
  st = NU.reduce(m, evs);
  assert.equal(st.phase, 'end'); assert.equal(st.winner, 'draw');
});

test('Zahl erraten Fern: nur mit offener Frage antworten', () => {
  const m = meta('number', 'remote');
  const evs = [ev('jos', 'setup', { first: 'joh' }), ev('jos', 'secret', { n: enc('15', m.id) }), ev('joh', 'secret', { n: enc('99', m.id) })];
  evs.push(ev('jos', 'answer', { a: 'ja' }));
  let st = NU.reduce(m, evs);
  assert.equal(st.counts.joh, 0);
  evs.push(ev('joh', 'ask', { q: 'Ist sie gerade?', card: 'even' }), ev('jos', 'answer', { a: 'nein' }));
  st = NU.reduce(m, evs);
  assert.equal(st.counts.joh, 1); assert.equal(st.turn, 'jos'); assert.equal(st.log[0].card, 'even');
});

test('Rückgängig (Nebeneinander) hebt eine Antwort auf', () => {
  const m = meta('whoami');
  const evs = [ev('jos', 'setup', { first: 'jos' }), ev('jos', 'char', { for: 'joh', name: enc('A', m.id) }), ev('jos', 'char', { for: 'jos', name: enc('B', m.id) })];
  const wrong = ev('jos', 'answer', { a: 'nein' });
  evs.push(wrong);
  let st = WA.reduce(m, evs);
  assert.equal(st.turn, 'joh');
  evs.push(ev('jos', 'undo', { id: wrong.id }));
  st = WA.reduce(m, evs);
  assert.equal(st.turn, 'jos'); assert.equal(st.counts.jos, 0);
  const mr = meta('whoami', 'remote');
  assert.equal(WA.reduce(mr, [ev('jos', 'setup', { first: 'jos' }), ev('jos', 'undo', { id: 'x' })]).phase, 'setup');
});

console.log(`\n${ok} Prüfungen bestanden.`);
