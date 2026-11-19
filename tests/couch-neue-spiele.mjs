// Ein Handy (Nebeneinander): Kritzelspiel, Pantomime und Herzchen versenken durchspielen – mit Neuladen mitten im Spiel.
// Prüft: keine Fehler, kein Querscrollen, Spielstand nach Neuladen erhalten. Aufruf: node tests/couch-neue-spiele.mjs [bilder] [breite]
import { chromium, openPage, noHScroll } from './helpers.mjs';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || 'test-bilder';
const WIDTH = +(process.argv[3] || 390);
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const { page, errors } = await openPage(browser, { w: WIDTH, h: 844, store: { me: 'jos', prefs: { mode: 'couch' } } });
const W = (ms) => page.waitForTimeout(ms);
const problems = [];
const check = async (label) => {
  if (!(await noHScroll(page))) problems.push(`${label}: Querscrollen`);
  if (errors.length) { problems.push(`${label}: ${errors.join(' | ')}`); errors.length = 0; }
};
const stateOf = (game) => page.evaluate(async (game) => {
  const L = await import(`/js/games/${game}/logic.js`);
  const ss = JSON.parse(localStorage.getItem('kk:sessions'));
  const s = Object.values(ss).filter((x) => x.meta.game === game).sort((a, b) => b.updated - a.updated)[0];
  const r = L.reduce(s.meta, s.evs);
  return { phase: r.phase, r: r.r, score: r.score, n: s.evs.length, turn: r.turn, winner: r.winner };
}, game);
const clickIf = async (sel) => { if (await page.locator(sel).count()) { await page.click(sel); return true; } return false; };
// Warten, bis entweder die Übergabe oder das Ziel da ist; Übergabe wegklicken
async function reach(target) {
  for (let t = 0; t < 40; t++) {
    if (await page.locator('.handoff .btn').count()) { await page.click('.handoff .btn'); await W(700); continue; }
    if (await page.locator(target).count()) return true;
    await W(250);
  }
  throw new Error('nicht erreicht: ' + target);
}

await page.click('.wer-name.jos'); await W(1600);

// ---------- Kritzelspiel: 2 Runden, Neuladen, Abbrechen ----------
await page.click('[data-game="draw"]'); await W(900);
await page.click('[data-a="start"]'); await W(900);
for (let i = 0; i < 2; i++) {
  await reach('[data-a="go"]');
  await page.click('[data-a="go"]'); await W(4300);
  const box = await page.locator('.sketch.editable').boundingBox();
  for (let s = 0; s < 3; s++) {
    await page.mouse.move(box.x + 40 + s * 60, box.y + 60);
    await page.mouse.down();
    for (let k = 0; k < 8; k++) await page.mouse.move(box.x + 40 + s * 60 + k * 8, box.y + 60 + k * 14 + s * 10);
    await page.mouse.up(); await W(120);
  }
  await page.click('[data-t="undo"]'); await W(300);
  if (i === 0) await page.screenshot({ path: `${OUT}/c-draw-live.png` });
  await page.getByRole('button', { name: 'Erraten!' }).click(); await W(1600);
  await check(`Kritzelspiel Runde ${i + 1}`);
  await page.getByRole('button', { name: /Nächste Runde|Zum Ergebnis/ }).click(); await W(900);
}
let s = await stateOf('draw');
await page.reload(); await W(1500);
await check('Kritzelspiel nach Neuladen');
const s2 = await stateOf('draw');
console.log('Kritzelspiel:', s.phase, 'Runde', s.r, JSON.stringify(s.score), '| nach Neuladen gleich:', JSON.stringify(s) === JSON.stringify(s2), '| sichtbar:', (await page.textContent('.g-body')).replace(/\s+/g, ' ').trim().slice(0, 60));
await page.click('.g-top [data-a="menu"]'); await W(500); await page.click('.sheet .btn.quiet'); await W(400); await page.click('.dialog .btn.primary'); await W(1200);

// ---------- Pantomime: alle 6 Runden ----------
await page.click('[data-game="mime"]'); await W(900);
await page.click('[data-a="start"]'); await W(900);
for (let i = 0; i < 6; i++) {
  await reach('[data-a="go"]');
  if (i === 1) await page.click('[data-a="reroll"]'), await W(500);
  await page.click('[data-a="go"]'); await W(4300);
  if (i === 2) { await page.reload(); await W(1800); await check('Pantomime nach Neuladen (live)'); }
  if (i === 3) { await page.getByRole('button', { name: 'Aufgeben' }).click(); await W(300); await page.click('.dialog .btn.primary'); }
  else await page.getByRole('button', { name: 'Erraten!' }).click();
  await W(1600);
  await check(`Pantomime Runde ${i + 1}`);
  await page.getByRole('button', { name: /Nächste Runde|Zum Ergebnis/ }).click(); await W(900);
}
s = await stateOf('mime');
console.log('Pantomime:', s.phase, JSON.stringify(s.score), '| Ergebnis:', (await page.textContent('.result').catch(() => '-')).replace(/\s+/g, ' ').trim().slice(0, 60));
await page.screenshot({ path: `${OUT}/c-mime-end.png` });
await page.click('.result .btn:not(.primary)'); await W(1200);

// ---------- Herzchen versenken: verstecken, 12 Schüsse, Neuladen ----------
await page.click('[data-game="ships"]'); await W(900);
await page.click('[data-a="start"]'); await W(900);
for (let k = 0; k < 2; k++) {
  await reach('[data-a="rand"]');
  await page.click('[data-a="rand"]'); await W(700);
  await page.click('.place .btn.primary'); await W(1200);
}
await clickIf('.handoff .btn'); await W(1200);
await check('Herzchen Start');
for (let i = 0; i < 12; i++) {
  s = await stateOf('ships');
  if (s.phase !== 'play') break;
  const free = await page.locator('.sea.target .sc:not(.hit):not(.miss):not([disabled])').count();
  if (!free) { await clickIf('.handoff .btn'); await W(900); continue; }
  await page.locator('.sea.target .sc:not(.hit):not(.miss):not([disabled])').nth((i * 7) % free).click();
  await W(1500);
  await clickIf('.handoff .btn'); await W(500);
  if (i === 6) { await page.reload(); await W(1800); await check('Herzchen nach Neuladen'); }
}
await page.screenshot({ path: `${OUT}/c-ships.png` });
s = await stateOf('ships');
console.log('Herzchen:', s.phase, 'am Zug', s.turn, 'Ereignisse', s.n);
await check('Herzchen Ende');
console.log(problems.length ? `PROBLEME:\n- ${problems.join('\n- ')}` : 'Keine Fehler gefunden.');
await browser.close();
