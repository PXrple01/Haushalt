// Zwei simulierte Handys spielen Herzchen versenken im Fern-Modus. Aufruf: node tests/fern-herzchen.mjs [bilder-ordner]
import { chromium, openPage } from './helpers.mjs';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || 'test-bilder';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
const prefs = { mode: 'remote', code: 'schifftest1' };
const A = await openPage(browser, { context: ctx, ns: 'a', query: 'net=local', store: { me: 'jos', prefs } });
const B = await openPage(browser, { context: ctx, ns: 'b', query: 'net=local', store: { me: 'joh', prefs } });
const a = A.page, b = B.page; const W = (ms) => a.waitForTimeout(ms);
await a.click('.wer-name.jos'); await b.click('.wer-name.joh'); await W(2500);
await a.click('[data-game="ships"]'); await W(700); await a.click('[data-a="start"]'); await W(900);
await b.click('.invite .btn.primary'); await W(800);
await a.click('[data-a="rand"]'); await a.click('.place .btn.primary'); await W(600);
await b.click('[data-a="rand"]'); await b.click('.place .btn.primary'); await W(1200);
const state = async (pg, ns) => pg.evaluate(async (ns) => { const { reduce, cellsOf } = await import('/js/games/ships/logic.js'); const ss = JSON.parse(localStorage.getItem(`kk-${ns}:sessions`)); const s = Object.values(ss).sort((x, y) => y.updated - x.updated)[0]; const r = reduce(s.meta, s.evs); return { phase: r.phase, turn: r.turn, shots: r.shots, sunk: r.sunk, occ: { jos: r.fleets.jos.flatMap((pc) => cellsOf(pc)), joh: r.fleets.joh.flatMap((pc) => cellsOf(pc)) }, winner: r.winner }; }, ns);
let s = await state(a, 'a');
console.log('Phase:', s.phase, 'Zug:', s.turn);
for (let i = 0; i < 60 && s.phase === 'play'; i++) {
  const pg = s.turn === 'jos' ? a : b;
  const foe = s.turn === 'jos' ? s.occ.joh : s.occ.jos;
  const done = new Set(s.shots[s.turn].map((q) => `${q.x},${q.y}`));
  let target = foe.find(([x, y]) => !done.has(`${x},${y}`));
  if (i % 3 === 0) { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (!done.has(`${x},${y}`) && !foe.some(([fx, fy]) => fx === x && fy === y)) { target = [x, y]; y = 9; break; } }
  await pg.bringToFront();
  await pg.click(`.sea.target .sc[data-x="${target[0]}"][data-y="${target[1]}"]`);
  await W(1300);
  if (i === 1) { await a.screenshot({ path: `${OUT}/s-remote-A.png` }); await b.screenshot({ path: `${OUT}/s-remote-B.png` }); }
  s = await state(a, 'a');
}
const sb = await state(b, 'b');
console.log('Ende A:', s.phase, s.winner, '| B:', sb.phase, sb.winner, '| gleich:', JSON.stringify(s.shots) === JSON.stringify(sb.shots));
await W(2500);
console.log('A:', (await a.textContent('.result').catch(() => '-')).replace(/\s+/g, ' ').trim().slice(0, 60), '| B:', (await b.textContent('.result').catch(() => '-')).replace(/\s+/g, ' ').trim().slice(0, 60));
console.log('ERR A', JSON.stringify(A.errors), 'ERR B', JSON.stringify(B.errors));
await browser.close();
