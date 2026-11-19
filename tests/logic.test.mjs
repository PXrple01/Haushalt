// Prüft die reine Spiellogik (ohne Browser). Aufruf: node tests/logic.test.mjs
import assert from 'node:assert/strict';
import * as HM from '../js/games/hangman/logic.js';
import * as WA from '../js/games/whoami/logic.js';
import * as NU from '../js/games/number/logic.js';
import * as SH from '../js/games/ships/logic.js';
import * as MI from '../js/games/mime/logic.js';
import * as ES from '../js/games/escape/logic.js';
import { PUZZLES, hintsFor, wireAnswer } from '../js/games/escape/puzzles.js';
import { THEMES } from '../js/games/escape/themes.js';
import { SYMBOLS, COLORS } from '../js/games/escape/symbols.js';
import { makeRng } from '../js/games/escape/rng.js';
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

test('Herzchen versenken: Flotte prüfen, zufällig verteilen', () => {
  for (let i = 0; i < 50; i++) assert.ok(SH.validFleet(SH.randomFleet()));
  const f = SH.randomFleet();
  const bad = f.map((x) => ({ ...x }));
  bad[1] = { ...bad[0], id: bad[1].id };
  assert.equal(SH.validFleet(bad), false);
  assert.equal(SH.fits({ id: 'einhorn', x: 6, y: 0, dir: 'h' }), false);
  assert.equal(SH.fits({ id: 'einhorn', x: 4, y: 0, dir: 'h' }), true);
});

test('Herzchen versenken: Treffer = nochmal, versenken, Bombe, Sieg', () => {
  const m = meta('ships');
  const fj = [{ id: 'einhorn', x: 0, y: 0, dir: 'h' }, { id: 'wolke', x: 0, y: 2, dir: 'h' }, { id: 'katze', x: 0, y: 4, dir: 'h' }, { id: 'herz', x: 0, y: 6, dir: 'h' }, { id: 'stern', x: 6, y: 6, dir: 'v' }];
  const fh = [{ id: 'einhorn', x: 7, y: 0, dir: 'v' }, { id: 'wolke', x: 0, y: 7, dir: 'h' }, { id: 'katze', x: 3, y: 3, dir: 'v' }, { id: 'herz', x: 5, y: 0, dir: 'h' }, { id: 'stern', x: 0, y: 0, dir: 'v' }];
  const evs = [ev('jos', 'setup', { first: 'jos' }), ev('jos', 'fleet', { p: 'jos', f: enc(JSON.stringify(fj), m.id) }), ev('jos', 'fleet', { p: 'joh', f: enc(JSON.stringify(fh), m.id) })];
  let st = SH.reduce(m, evs);
  assert.equal(st.phase, 'play'); assert.equal(st.turn, 'jos');
  evs.push(ev('jos', 'shot', { x: 4, y: 4 }));               // daneben
  st = SH.reduce(m, evs); assert.equal(st.turn, 'joh');
  evs.push(ev('jos', 'shot', { x: 0, y: 6 }));               // Johann trifft Herz
  st = SH.reduce(m, evs); assert.equal(st.turn, 'joh'); assert.equal(st.hitsBy.joh, 1);
  evs.push(ev('jos', 'shot', { x: 1, y: 6 }));               // versenkt
  st = SH.reduce(m, evs); assert.deepEqual(st.sunk.joh, ['herz']); assert.equal(st.last.sunk[0], 'herz');
  evs.push(ev('jos', 'shot', { x: 1, y: 6 }));               // schon beschossen → ignoriert
  st = SH.reduce(m, evs); assert.equal(st.shots.joh.length, 2);
  evs.push(ev('jos', 'shot', { x: 5, y: 1, bomb: true }));   // Bombe: 3×3 – trifft nichts
  st = SH.reduce(m, evs); assert.equal(st.bombUsed.joh, true); assert.equal(st.shots.joh.length, 11); assert.equal(st.turn, 'jos');
  // Baby versenkt alles
  for (const pc of fh) for (const [x, y] of SH.cellsOf(pc)) evs.push(ev('jos', 'shot', { x, y }));
  st = SH.reduce(m, evs);
  assert.equal(st.phase, 'end'); assert.equal(st.winner, 'jos'); assert.equal(st.sunk.jos.length, 5);
});

test('Pantomime: Punkte nach Tempo, Ende nach allen Runden', () => {
  const m = meta('mime');
  const evs = [ev('jos', 'setup', { first: 'jos', n: 3, dur: 60 })];
  for (let r = 0; r < 6; r++) {
    evs.push(ev('jos', 'term', { r, w: enc('Kuss', m.id), cat: 'Wir zwei' }), ev('jos', 'go', { r }));
    evs.push(r === 2 ? ev('jos', 'miss', { r }) : ev('jos', 'got', { r, ms: r === 0 ? 10000 : 50000 }));
  }
  const st = MI.reduce(m, evs);
  assert.equal(st.phase, 'end');
  // Baby stellt Runden 0,2,4 dar: 3 + 0 + 1 = 4, rät richtig in 1,3,5: +3 → 7
  // Johann stellt 1,3,5 dar: 1 + 1 + 1 = 3, rät richtig in 0 und 4: +2 → 5
  assert.deepEqual(st.score, { jos: 7, joh: 5 }); assert.equal(st.winner, 'jos');
});

test('Escape: Geschichten vollständig (4 Räume, Symbole, Zutaten, Dinge)', () => {
  assert.equal(THEMES.length, 7);
  const kinds = {};
  for (const th of THEMES) {
    assert.equal(th.rooms.length, 4, th.id);
    assert.ok(th.symbols.length >= 6 && th.symbols.every((x) => SYMBOLS[x]), th.id);
    assert.ok(th.intro.length && th.outro.length && th.lose, th.id);
    for (const rm of th.rooms) {
      kinds[rm.kind] = (kinds[rm.kind] || 0) + 1;
      assert.ok(SYMBOLS[rm.icon], `${th.id}: Symbol ${rm.icon}`);
      for (const x of [...(rm.skin.ingredients || []), ...(rm.skin.objects || [])]) assert.ok(SYMBOLS[x.sym] && COLORS[x.col], `${th.id}: ${x.id}`);
    }
  }
  assert.deepEqual(Object.values(kinds), [4, 4, 4, 4, 4, 4, 4]);
});

test('Escape: Rätsel sind gleich auf beiden Handys und immer lösbar', () => {
  const skinOf = (kind) => THEMES.flatMap((t) => t.rooms).find((r) => r.kind === kind).skin;
  for (const [kind, P] of Object.entries(PUZZLES)) {
    for (const diff of ['gemuetlich', 'normal', 'knifflig']) {
      for (let i = 0; i < 60; i++) {
        const o = { diff, skin: skinOf(kind), symbols: THEMES[i % 7].symbols };
        const sp = P.gen(makeRng(`t${i}${kind}${diff}`), o);
        assert.deepEqual(sp, P.gen(makeRng(`t${i}${kind}${diff}`), o));
        let st = P.init(sp), solved = false;
        for (const a of P.solution(sp)) { const r = P.apply(sp, st, a); st = r.state; assert.ok(!r.mistake, kind); solved ||= !!r.solved; }
        assert.ok(solved, `${kind} ${diff} ${i}`);
        for (const hnt of hintsFor(kind, sp, o.skin, P.init(sp))) assert.ok(!/undefined|\{|\}/.test(hnt), hnt);
      }
    }
  }
  assert.deepEqual(wireAnswer(['rosa', 'blau', 'blau', 'gruen'], 10), { idx: 1, rule: 0 });
});

test('Escape: Rollen, Fehler, Tipps (einmal), Pause zwischen Räumen, Sieg', () => {
  const m = meta('escape', 'remote');
  const evs = [ev('jos', 'setup', { theme: 'lebkuchen', diff: 'normal', seed: 'abc', first: 'joh' }), ev('jos', 'ready'), ev('joh', 'ready')];
  let st = ES.reduce(m, evs);
  assert.equal(st.phase, 'room'); assert.equal(ES.handsOf(st), 'joh'); assert.equal(st.limit, 25 * 60e3);
  const rm = st.rooms[0];
  evs.push(ev('jos', 'act', { r: 0, k: 'open', code: rm.spec.code })); // falsche Person → zählt nicht
  evs.push(ev('joh', 'act', { r: 0, k: 'open', code: '0000' }));
  evs.push(ev('jos', 'hint', { r: 0, n: 1 }), ev('joh', 'hint', { r: 0, n: 1 })); // gleichzeitig → nur ein Tipp
  st = ES.reduce(m, evs);
  assert.equal(st.phase, 'room'); assert.equal(st.mistakes, 1); assert.equal(st.hints, 1);
  assert.equal(st.penaltyMs, 20e3 + 60e3);
  evs.push(ev('joh', 'act', { r: 0, k: 'open', code: rm.spec.code }));
  st = ES.reduce(m, evs);
  assert.equal(st.phase, 'cleared');
  const frozen = ES.elapsed(st, st.pauseSince + 999999);
  assert.equal(frozen, ES.elapsed(st, st.pauseSince + 5)); // Zeit steht zwischen den Räumen
  evs.push(ev('jos', 'next', { r: 0 }), ev('joh', 'next', { r: 0 }));
  st = ES.reduce(m, evs);
  assert.equal(st.room, 1); assert.equal(ES.handsOf(st), 'jos');
  for (let r = 1; r < 4; r++) {
    const x = st.rooms[r];
    for (const a of PUZZLES[x.kind].solution(x.spec)) evs.push(ev(ES.handsOf(st), 'act', { r, ...a }));
    if (r < 3) evs.push(ev('joh', 'next', { r }));
    st = ES.reduce(m, evs);
  }
  assert.equal(st.phase, 'end'); assert.ok(st.won); assert.ok(ES.starsOf(st) >= 1);
  assert.ok(ES.label(st).startsWith('Geschafft'));
});

test('Escape: Zeit um → ohne Zeit weiter (1 Stern) / Aufgeben', () => {
  const m = meta('escape', 'remote');
  const evs = [ev('jos', 'setup', { theme: 'mond', diff: 'knifflig', seed: 'q', first: 'jos' }), ev('jos', 'ready'), ev('joh', 'ready')];
  let st = ES.reduce(m, evs);
  assert.ok(!ES.timeUp(st, st.startT + 14 * 60e3));
  assert.ok(ES.timeUp(st, st.startT + 15 * 60e3 + 1));
  evs.push(ev('joh', 'cont'));
  st = ES.reduce(m, evs);
  assert.ok(st.overtime); assert.ok(!ES.timeUp(st, st.startT + 99 * 60e3));
  evs.push(ev('jos', 'giveup'));
  st = ES.reduce(m, evs);
  assert.equal(st.phase, 'end'); assert.ok(st.gaveUp); assert.equal(ES.starsOf(st), 0);
});

console.log(`\n${ok} Prüfungen bestanden.`);
