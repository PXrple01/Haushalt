// Zwei simulierte Handys spielen Pantomime im Fern-Modus (3 Runden pro Person).
// Prüft: Begriff nur beim Darsteller, Timer + Punkte bei beiden, gleiches Ergebnis. Aufruf: node tests/fern-pantomime.mjs
import { chromium, openPage } from './helpers.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
const prefs = { mode: 'remote', code: 'pantotest1' };
const A = await openPage(browser, { context: ctx, ns: 'a', query: 'net=local', store: { me: 'jos', prefs } });
const B = await openPage(browser, { context: ctx, ns: 'b', query: 'net=local', store: { me: 'joh', prefs } });
const a = A.page, b = B.page; const W = (ms) => a.waitForTimeout(ms);
await a.click('.wer-name.jos'); await b.click('.wer-name.joh'); await W(2200);
await a.click('[data-game="mime"]'); await W(800);
await a.click('[data-a="start"]'); await W(1200);
await b.click('.invite .btn.primary'); await W(1500);
const state = async (pg, ns) => pg.evaluate(async (ns) => {
  const { reduce } = await import('/js/games/mime/logic.js');
  const { actorOf } = await import('/js/games/rounds.js');
  const ss = JSON.parse(localStorage.getItem(`kk-${ns}:sessions`));
  const s = Object.values(ss).sort((x, y) => y.updated - x.updated)[0];
  const r = reduce(s.meta, s.evs);
  return { phase: r.phase, r: r.r, actor: r.phase === 'end' ? null : actorOf(r, r.r), score: r.score, winner: r.winner };
}, ns);
let leaks = 0;
for (let i = 0; i < 6; i++) {
  const s = await state(a, 'a');
  if (s.phase === 'end') break;
  const act = s.actor === 'jos' ? a : b, other = s.actor === 'jos' ? b : a;
  await act.bringToFront(); await W(600);
  const term = (await act.textContent('.tc-text').catch(() => '')).trim();
  if (term && (await other.textContent('.g-body')).includes(term)) leaks++;
  await act.click('[data-a="go"]'); await W(4300);
  const timerOther = await other.locator('.ring-timer, .rtimer, [class*="timer"]').count();
  await act.getByRole('button', { name: 'Erraten!' }).click(); await W(1800);
  for (const pg of [act, other]) { await pg.bringToFront(); await pg.getByRole('button', { name: /Nächste Runde|Zum Ergebnis/ }).click().catch(() => {}); }
  await W(900);
  console.log(`Runde ${i + 1}: ${s.actor} stellt dar „${term}“ | Timer beim Rater: ${timerOther > 0}`);
}
await W(1200);
const ea = await state(a, 'a'), eb = await state(b, 'b');
console.log('Ende A:', ea.phase, JSON.stringify(ea.score), ea.winner, '| B:', eb.phase, JSON.stringify(eb.score), eb.winner, '| Begriff verraten:', leaks);
console.log('A:', (await a.textContent('.result').catch(() => '-')).replace(/\s+/g, ' ').trim().slice(0, 70));
console.log('ERR A', JSON.stringify(A.errors), 'ERR B', JSON.stringify(B.errors));
await browser.close();
