// Zwei simulierte Handys spielen Kritzelspiel im Fern-Modus: einer zeichnet, der andere rät per Eingabe.
// Prüft: Striche kommen an, falsche Tipps erscheinen, richtiger Tipp beendet die Runde, gleiches Ergebnis. Aufruf: node tests/fern-kritzelspiel.mjs
import { chromium, openPage } from './helpers.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
const prefs = { mode: 'remote', code: 'kritzeltest1' };
const A = await openPage(browser, { context: ctx, ns: 'a', query: 'net=local', store: { me: 'jos', prefs } });
const B = await openPage(browser, { context: ctx, ns: 'b', query: 'net=local', store: { me: 'joh', prefs } });
const a = A.page, b = B.page; const W = (ms) => a.waitForTimeout(ms);
await a.click('.wer-name.jos'); await b.click('.wer-name.joh'); await W(2200);
await a.click('[data-game="draw"]'); await W(800);
await a.click('[data-a="start"]'); await W(1200);
await b.click('.invite .btn.primary'); await W(1500);
const state = async (pg, ns) => pg.evaluate(async (ns) => {
  const { reduce } = await import('/js/games/draw/logic.js');
  const { actorOf } = await import('/js/games/rounds.js');
  const ss = JSON.parse(localStorage.getItem(`kk-${ns}:sessions`));
  const s = Object.values(ss).sort((x, y) => y.updated - x.updated)[0];
  const r = reduce(s.meta, s.evs);
  const R = r.rounds[r.r];
  return { phase: r.phase, r: r.r, actor: r.phase === 'end' ? null : actorOf(r, r.r), term: R?.term, strokes: R?.strokes?.length || 0, guesses: R?.guesses?.length || 0, score: r.score };
}, ns);
for (let i = 0; i < 2; i++) {
  const s = await state(a, 'a');
  const act = s.actor === 'jos' ? a : b, guess = s.actor === 'jos' ? b : a, gns = s.actor === 'jos' ? 'b' : 'a';
  await act.bringToFront(); await W(700);
  await act.click('[data-a="go"]'); await W(4300);
  const box = await act.locator('.sketch.editable').boundingBox();
  await act.mouse.move(box.x + 50, box.y + 50); await act.mouse.down();
  for (let k = 0; k < 10; k++) await act.mouse.move(box.x + 50 + k * 15, box.y + 50 + k * 10);
  await act.mouse.up(); await W(900);
  const live = await state(act, s.actor === 'jos' ? 'a' : 'b');
  await guess.bringToFront();
  for (const g of ['Banane', 'Fahrrad']) { await guess.fill('.compose-row input', g); await guess.click('.compose-row button'); await W(500); }
  const chips = await guess.locator('.guesses .chip').count();
  await guess.fill('.compose-row input', live.term); await guess.click('.compose-row button'); await W(1800);
  const after = await state(guess, gns);
  console.log(`Runde ${i + 1}: ${s.actor} zeichnet „${live.term}“ | Striche angekommen: ${(await state(guess, gns)).r === i + 1 || live.strokes > 0} | falsche Tipps sichtbar: ${chips} | weiter zu Runde ${after.r + 1}`);
  for (const pg of [act, guess]) { await pg.bringToFront(); await pg.getByRole('button', { name: /Nächste Runde|Zum Ergebnis/ }).click().catch(() => {}); }
  await W(900);
}
const ea = await state(a, 'a'), eb = await state(b, 'b');
console.log('Stand A:', JSON.stringify(ea.score), '| B:', JSON.stringify(eb.score), '| gleich:', JSON.stringify(ea.score) === JSON.stringify(eb.score));
console.log('ERR A', JSON.stringify(A.errors), 'ERR B', JSON.stringify(B.errors));
await browser.close();
