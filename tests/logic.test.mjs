// Prüft die reine Spiellogik (ohne Browser). Aufruf: node tests/logic.test.mjs
import assert from 'node:assert/strict';
import * as HM from '../js/games/hangman/logic.js';
import * as WA from '../js/games/whoami/logic.js';
import * as NU from '../js/games/number/logic.js';
import * as SH from '../js/games/ships/logic.js';
import * as MI from '../js/games/mime/logic.js';
import * as ES from '../js/games/escape/logic.js';
import * as KR from '../js/games/krimi/logic.js';
import { PUZZLES, hintsFor, wireAnswer } from '../js/games/escape/puzzles.js';
import { THEMES } from '../js/games/escape/themes.js';
import { SYMBOLS, COLORS } from '../js/games/escape/symbols.js';
import { makeRng } from '../js/games/escape/rng.js';
import { enc } from '../js/games/secret.js';
import { cleanWord, nameMatch } from '../js/core/util.js';
import { WORDS, WORD_CATS, wordItems } from '../js/data/words.js';
import { CHARS, CHAR_CATS, QUICK_QUESTIONS } from '../js/data/characters.js';
import { termItems, termCats } from '../js/data/terms.js';
import { CARDS } from '../js/data/questions.js';

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

test('Herzchen versenken kurvig: Ausrichtungen, Zufallsflotte, Treffer und Sieg', () => {
  assert.equal(SH.orientsOf('einhorn').length, 2);
  assert.equal(SH.orientsOf('schlange').length, 4);
  assert.equal(SH.orientsOf('raupe').length, 8);
  assert.equal(SH.orientsOf('regenbogen').length, 4);
  // alte Partien (dir) bleiben gültig
  assert.deepEqual(SH.cellsOf({ id: 'einhorn', x: 1, y: 2, dir: 'v' }), [[1, 2], [1, 3], [1, 4], [1, 5]]);
  // Bogen ∩ in Grundlage: Ecke unten Mitte bleibt frei
  const bogen = SH.cellsOf({ id: 'regenbogen', x: 0, y: 0, o: 0 }).map((c) => c.join(','));
  assert.ok(bogen.includes('0,1') && bogen.includes('2,1') && !bogen.includes('1,1'));
  for (let i = 0; i < 200; i++) assert.ok(SH.validFleet(SH.randomFleet(Math.random, 'kurvig'), 'kurvig'));
  assert.equal(SH.validFleet(SH.randomFleet(Math.random, 'kurvig'), 'klassisch'), false);
  const m = meta('ships');
  const fj = SH.randomFleet(Math.random, 'kurvig'), fh = SH.randomFleet(Math.random, 'kurvig');
  const evs = [ev('jos', 'setup', { first: 'jos', fleet: 'kurvig' }), ev('jos', 'fleet', { p: 'jos', f: enc(JSON.stringify(fj), m.id) }), ev('jos', 'fleet', { p: 'joh', f: enc(JSON.stringify(fh), m.id) })];
  let st = SH.reduce(m, evs);
  assert.equal(st.phase, 'play'); assert.equal(st.fleetKind, 'kurvig');
  for (const pc of fh) for (const [x, y] of SH.cellsOf(pc)) evs.push(ev('jos', 'shot', { x, y }));
  st = SH.reduce(m, evs);
  assert.equal(st.phase, 'end'); assert.equal(st.winner, 'jos'); assert.equal(st.sunk.jos.length, 5); assert.equal(st.hitsBy.jos, 19);
});

test('Pools: groß, gültig, ohne Dopplungen', () => {
  assert.ok(WORDS.length > 3500, `Wörter: ${WORDS.length}`);
  for (const w of WORDS) { const c = cleanWord(w.text); assert.ok(!c.bad.length && c.letters >= 3, `ungültiges Wort: ${w.text}`); }
  assert.equal(new Set(WORDS.map((w) => w.text.toLowerCase())).size, WORDS.length);
  for (const c of WORD_CATS.filter((x) => x.id !== 'all')) assert.ok(wordItems(c.id).length >= 50, `zu wenig Wörter in ${c.id}`);
  assert.ok(CHARS.length > 2000, `Figuren: ${CHARS.length}`);
  assert.equal(new Set(CHARS.map((c) => c.text.toLowerCase())).size, CHARS.length);
  for (const c of CHAR_CATS.filter((x) => x.id !== 'all')) assert.ok(CHARS.filter((x) => x.cat === c.id).length >= 50, `zu wenig Figuren in ${c.id}`);
  assert.ok(QUICK_QUESTIONS.length >= 60);
  for (const g of ['mime', 'draw']) {
    const all = termItems(g);
    assert.ok(all.length > 1000, `${g}: ${all.length}`);
    assert.equal(new Set(all.map((x) => x.text.toLowerCase())).size, all.length);
    assert.ok(all.every((x) => x.text && !/[!~]/.test(x.text) && ['leicht', 'mittel', 'schwer'].includes(x.level)));
    for (const c of termCats(g).filter((x) => x.id !== 'all')) assert.ok(termItems(g, [c.id]).length >= 20, `${g}/${c.id}`);
  }
  assert.ok(CARDS.length >= 150);
  assert.equal(new Set(CARDS.map((c) => c.id)).size, CARDS.length);
  for (const c of CARDS.filter((x) => x.test)) {
    let yes = 0;
    for (let n = 1; n <= 100; n++) { const r = c.test(n); assert.equal(typeof r, 'boolean', c.id); if (r) yes++; }
    assert.ok(yes > 0 && yes < 100, `Karte ${c.id} streicht nichts`);
  }
});

// ---------------- Krimi für zwei ----------------
test('Krimi: alle Verweise im Fall sind gültig und jede Spur ist erreichbar', () => {
  const C = KR.CASE;
  const known = (id, where) => assert.ok(C.clues[id], `unbekannte Spur ${id} (${where})`);
  const reach = new Set();
  for (const [rid, r] of Object.entries(C.rooms)) {
    assert.ok(C.floors.some((f) => f.id === r.floor), rid);
    for (const sp of r.spots) {
      (sp.g || []).forEach((g) => { known(g, rid); reach.add(g); });
      (sp.v || []).forEach((v) => v.g.forEach((g) => { known(g, rid); reach.add(g); }));
    }
  }
  const cond = (w, where) => {
    if (!w) return;
    for (const k of ['has', 'nhas', 'teamHas', 'teamNot', 'teamNot2']) if (w[k]) known(w[k], where);
    for (const k of ['hasAny', 'teamAny', 'teamAny2', 'teamNotAny']) (w[k] || []).forEach((x) => known(x, where));
  };
  for (const [pid, pe] of Object.entries(C.people)) {
    assert.ok(C.clues['fp_' + pid], 'Fingerabdruck ' + pid);
    reach.add('fp_' + pid);
    pe.intro.g.forEach((g) => { known(g, pid); reach.add(g); });
    for (const t of pe.topics) { (t.g || []).forEach((g) => { known(g, pid); reach.add(g); }); cond(t.w, pid); }
    for (const sh of pe.show) { sh.c.forEach((g) => known(g, pid)); (sh.g || []).forEach((g) => { known(g, pid); reach.add(g); }); cond(sh.w, pid); }
  }
  for (const [id, c] of Object.entries(C.clues)) { if (c.r) { known(c.r, id); reach.add(c.r); } assert.ok(C.kinds[c.k], id); }
  for (const cb of C.combos) { cb.a.concat(cb.b, [cb.g]).forEach((x) => known(x, 'Erkenntnis')); reach.add(cb.g); }
  for (const h of C.hints) cond(h.w, 'Tipp ' + h.id);
  for (const r of C.recon) assert.ok(C.rooms[r.room], r.room);
  ['tagebuch_klar', 'testament', 'foto_et', 'erpressung', 'fp_treffer', 'a_emil_aussage', 'a_emil_erpressung', 'dienstbuch_seite'].forEach((x) => reach.add(x));
  for (const id of Object.keys(C.clues)) assert.ok(reach.has(id), 'nicht erreichbar: ' + id);
  for (const q of C.questions) assert.ok(q.multi ? q.ok.every((x) => q.opts.some((o) => o.id === x)) : q.opts.some((o) => o.id === q.ok), q.id);
  assert.ok(Object.keys(C.clues).length > 150);
});

function krimi(steps, diff = 'normal') {
  const m = meta('krimi', 'remote');
  const evs = [ev('jos', 'setup', { diff, spuren: 'jos' }), ev('jos', 'ready'), ev('joh', 'ready')];
  for (const s of steps) evs.push(ev(...s));
  return KR.reduce(m, evs);
}
test('Krimi: Uhr, getrennte Akten, Schlösser und Fachgebiete', () => {
  let st = krimi([]);
  assert.equal(st.phase, 'play');
  assert.equal(KR.fmtClock(st.clock), '23:00');
  st = krimi([['jos', 'go', { room: 'weinkeller' }], ['jos', 'search', { room: 'weinkeller', spot: 'leiche' }], ['joh', 'go', { room: 'buero' }]]);
  assert.equal(st.clock, 1380 + 2 + 15);
  assert.ok(KR.has(st, 'jos', 'schluessel') && !KR.has(st, 'joh', 'leiche'));
  assert.equal(st.pos.joh, 'rezeption', 'Büro ohne Schlüssel zu');
  st = krimi([['joh', 'go', { room: 'weinkeller' }], ['joh', 'search', { room: 'weinkeller', spot: 'leiche' }]]);
  assert.equal(st.clock, 1380 + 2 + 23, 'Verhör-Spezialist durchsucht langsamer');
  st = krimi([['jos', 'go', { room: 'weinkeller' }], ['jos', 'search', { room: 'weinkeller', spot: 'unter' }]]);
  assert.ok(!KR.has(st, 'jos', 'uhr'), 'erst die Leiche untersuchen');
  st = krimi([['jos', 'go', { room: 'weinkeller' }], ['jos', 'search', { room: 'weinkeller', spot: 'boden' }], ['jos', 'search', { room: 'weinkeller', spot: 'boden' }]]);
  assert.equal(st.clock, 1380 + 2 + 10, 'dieselbe Stelle nicht doppelt bezahlen');
  st = krimi([['jos', 'go', { room: 'weinkeller' }], ['jos', 'search', { room: 'weinkeller', spot: 'leiche' }], ['jos', 'go', { room: 'buero' }], ['jos', 'go', { room: 'rezeption' }], ['joh', 'go', { room: 'buero' }]]);
  assert.equal(st.pos.joh, 'buero', 'einmal aufgesperrt bleibt offen');
  st = krimi([['jos', 'go', { room: 'hinterhof' }]]);
  assert.equal(st.pos.jos, 'rezeption', 'Hinterhof erst nach dem Sturm');
});
test('Krimi: Emil retten – oder er stirbt um 1 Uhr', () => {
  let st = krimi([['joh', 'go', { room: 'personalgang' }], ['joh', 'search', { room: 'personalgang', spot: 'spiegel' }], ['joh', 'go', { room: 'portiersloge' }], ['joh', 'talk', { who: 'emil' }], ['joh', 'show', { who: 'emil', clue: 'spiegel' }]]);
  assert.ok(st.flags.emilSaved && KR.has(st, 'joh', 'a_emil_aussage'));
  // Warten: zwischen Keller und Erdgeschoss hin und her (je 2 Minuten)
  const wait = (min) => Array.from({ length: Math.ceil(min / 2) }, (_, i) => ['jos', 'go', { room: i % 2 ? 'rezeption' : 'heizraum' }]);
  st = krimi(wait(130));
  assert.ok(st.flags.emilDead && !st.flags.emilFound && st.flags.note);
  st = krimi([...wait(180), ['joh', 'go', { room: 'portiersloge' }], ['joh', 'talk', { who: 'emil' }]]);
  assert.ok(st.flags.emilFound, 'Greta findet ihn um 01:50');
  assert.equal(st.with.joh, null, 'mit Toten redet man nicht');
  st = krimi([['joh', 'go', { room: 'spa' }], ...wait(125)]);
  assert.ok(st.flags.emilSaved && st.flags.falle && KR.has(st, 'joh', 'a_emil_erpressung'), 'Anwesenheit im Spa rettet Emil');
});
test('Krimi: Bluff, Zange, Funk, Werkzeuge, Erkenntnisse', () => {
  let st = krimi([['jos', 'go', { room: 'kaminzimmer' }], ['joh', 'go', { room: 'kaminzimmer' }], ['jos', 'talk', { who: 'viktoria' }], ['joh', 'talk', { who: 'lukas' }], ['jos', 'ask', { who: 'viktoria', topic: 'bluff' }], ['joh', 'ask', { who: 'lukas', topic: 'bluff' }]]);
  assert.ok(KR.has(st, 'jos', 'a_viktoria_wahr') && KR.has(st, 'joh', 'a_lukas_wahr'));
  st = krimi([['jos', 'go', { room: 'kaminzimmer' }], ['jos', 'talk', { who: 'viktoria' }], ['jos', 'ask', { who: 'viktoria', topic: 'bluff' }]]);
  assert.ok(!KR.has(st, 'jos', 'a_viktoria_wahr'), 'Bluff nur, wenn der Partner Lukas verhört');
  st = krimi([['jos', 'go', { room: 'weinkeller' }], ['jos', 'search', { room: 'weinkeller', spot: 'scherben' }], ['jos', 'radio', { clue: 'scherben' }]]);
  assert.ok(!KR.has(st, 'jos', 'x_scherben'));
  st = krimi([['jos', 'go', { room: 'weinkeller' }], ['jos', 'search', { room: 'weinkeller', spot: 'scherben' }], ['jos', 'radio', { clue: 'scherben' }], ['jos', 'search', { room: 'weinkeller', spot: 'boden' }], ['jos', 'search', { room: 'weinkeller', spot: 'leiche' }], ['jos', 'search', { room: 'weinkeller', spot: 'wunde' }]]);
  assert.ok(KR.has(st, 'jos', 'x_scherben'), 'Funk-Antwort nach 30 Minuten');
  st = krimi([['jos', 'go', { room: 'weinkeller' }], ['jos', 'search', { room: 'weinkeller', spot: 'leiche' }], ['jos', 'go', { room: 'buero' }], ['jos', 'search', { room: 'buero', spot: 'schreibtisch' }], ['jos', 'search', { room: 'buero', spot: 'tresor' }], ['jos', 'safe', { code: '111111' }], ['jos', 'cipher', { key: 'Elisabeth' }], ['jos', 'cipher', { key: 'lisl' }], ['jos', 'safe', { code: '120304' }]]);
  assert.ok(KR.has(st, 'jos', 'tagebuch_klar') && KR.has(st, 'jos', 'testament') && KR.has(st, 'jos', 'foto_et'));
  st = krimi([['jos', 'go', { room: 'bibliothek' }], ['jos', 'search', { room: 'bibliothek', spot: 'schach' }], ['joh', 'go', { room: 'kaminzimmer' }], ['joh', 'talk', { who: 'wendt' }],
    ['jos', 'pin', { clue: 'schachprotokoll', x: .2, y: .2 }], ['joh', 'pin', { clue: 'a_wendt_alibi', x: .7, y: .3 }], ['joh', 'pin', { clue: 'leiche', x: .5, y: .5 }], ['jos', 'thread', { a: 'a_wendt_alibi', b: 'schachprotokoll' }]]);
  assert.ok(KR.has(st, 'jos', 'c_luecke') && KR.has(st, 'joh', 'c_luecke'), 'Erkenntnis für beide');
  assert.equal(Object.keys(st.pins).length, 2, 'nur eigene Spuren anpinnen');
});
test('Krimi: Anklage nur gemeinsam, Wertung und Ränge', () => {
  const answers = { taeter: 'wendt', waffe: 'skalpell', zeit: 'b', trick: 'kerze', motiv: 'rache', abdruck: 'wendt', versteck: 'schnee', emil_sah: 'wendt', luegner: ['lukas', 'viktoria'], vater: 'wendt', lawine: 'konrad', sophie: 'presse' };
  const steps = Object.entries(answers).map(([q, v]) => ['jos', 'aset', { q, v }]);
  let st = krimi(steps);
  const v = st.formV;
  st = krimi([...steps, ['jos', 'sign', { v }]]);
  assert.equal(st.phase, 'play', 'eine Unterschrift reicht nicht');
  st = krimi([...steps, ['jos', 'sign', { v }], ['joh', 'aset', { q: 'motiv', v: 'erbe' }], ['joh', 'sign', { v: v + 1 }]]);
  assert.equal(st.phase, 'play', 'Änderung löscht Unterschriften');
  st = krimi([...steps, ['jos', 'sign', { v }], ['joh', 'sign', { v }]]);
  assert.equal(st.phase, 'end');
  assert.equal(st.result.base, st.result.max);
  assert.equal(st.result.rank.id, 'meister');
  st = krimi([...steps, ['joh', 'aset', { q: 'taeter', v: 'marie' }], ['jos', 'sign', { v: v + 1 }], ['joh', 'sign', { v: v + 1 }]]);
  assert.equal(st.result.culprit, false);
  assert.equal(st.result.rank.id, 'falsch');
  assert.equal(KR.label(st), 'Falscher Täter');
});

console.log(`\n${ok} Prüfungen bestanden.`);
