// Escape-Abenteuer: Zeit läuft ab (Uhr vorgestellt) → „Ohne Zeit weiterspielen“ → später Aufgeben. Plus Lobby-Liste.
// Aufruf: node tests/fern-escape-zeit.mjs [bilder-ordner]
import { chromium, openPage } from './helpers.mjs';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || 'test-bilder';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
const prefs = { mode: 'remote', code: 'escapezeit1' };
const A = await openPage(browser, { context: ctx, ns: 'a', query: 'net=local', store: { me: 'jos', prefs } });
const B = await openPage(browser, { context: ctx, ns: 'b', query: 'net=local', store: { me: 'joh', prefs } });
const a = A.page, b = B.page; const W = (ms) => a.waitForTimeout(ms);
await a.click('.wer-name.jos'); await b.click('.wer-name.joh'); await W(2200);
await a.click('[data-game="escape"]'); await W(1000);
await a.click('.es-tcard[data-theme="spuk"]'); await W(600);
await a.click('.es-detail .rcard[data-value="knifflig"]');
await a.click('.es-start'); await W(1200);
await b.click('.invite .btn.primary'); await W(1000);
await a.click('.es-go'); await W(300); await b.bringToFront(); await b.click('.es-go'); await W(3400);
// Lobby-Liste auf B
await b.click('.g-top [data-a="back"]'); await W(900);
console.log('Lobby B:', (await b.textContent('.resume').catch(() => '-')).replace(/\s+/g, ' ').trim());
await b.click('.resume-item'); await W(1500);
// Uhr auf beiden Handys 16 Minuten vorstellen
for (const pg of [a, b]) await pg.evaluate(() => { const real = Date.now.bind(Date); Date.now = () => real() + 16 * 60e3; });
await W(1200);
const tuA = await a.locator('.es-timeup').count(), tuB = await b.locator('.es-timeup').count();
console.log('Zeit-um-Fenster A/B:', tuA, tuB);
await a.bringToFront(); await a.screenshot({ path: `${OUT}/z-zeitum.png` });
await a.click('.es-timeup [data-a="cont"]'); await W(1200);
console.log('nach Weiterspielen A/B:', await a.locator('.es-timeup').count(), await b.locator('.es-timeup').count(), '| Uhr A:', await a.textContent('.es-time'));
// Aufgeben über das Menü? Hier: Zeit-um ist weg, also Aufgeben über erneutes Abbrechen im Menü testen
await b.bringToFront();
await b.click('.g-top [data-a="menu"]'); await W(500);
await b.click('.sheet .btn.quiet'); await W(400);
await b.click('.dialog .btn.primary'); await W(1500);
await a.bringToFront(); await W(800);
console.log('A nach Beenden durch B:', (await a.textContent('.g-body')).replace(/\s+/g, ' ').trim().slice(0, 90));
await a.screenshot({ path: `${OUT}/z-beendet.png` });
console.log('ERR A', JSON.stringify(A.errors), 'ERR B', JSON.stringify(B.errors));

// Zweites Abenteuer: Zeit um → Aufgeben
const C = await openPage(browser, { context: ctx, ns: 'c', query: 'net=local', store: { me: 'jos', prefs: { mode: 'remote', code: 'escapezeit2' } } });
const D = await openPage(browser, { context: ctx, ns: 'd', query: 'net=local', store: { me: 'joh', prefs: { mode: 'remote', code: 'escapezeit2' } } });
const c = C.page, d = D.page;
await c.click('.wer-name.jos'); await d.click('.wer-name.joh'); await W(2200);
await c.click('[data-game="escape"]'); await W(1000);
await c.click('.es-tcard[data-theme="mond"]'); await W(600);
await c.click('.es-start'); await W(1200);
await d.click('.invite .btn.primary'); await W(1000);
await c.click('.es-go'); await W(300); await d.bringToFront(); await d.click('.es-go'); await W(3400);
for (const pg of [c, d]) await pg.evaluate(() => { const real = Date.now.bind(Date); Date.now = () => real() + 26 * 60e3; });
await W(1200);
await d.click('.es-timeup [data-a="give"]'); await W(400); await d.click('.dialog .btn.primary'); await W(2000);
await c.bringToFront(); await W(600);
console.log('C nach Aufgeben:', (await c.textContent('.es-end').catch(() => '-')).replace(/\s+/g, ' ').trim().slice(0, 100));
await c.screenshot({ path: `${OUT}/z-aufgegeben.png`, fullPage: true });
console.log('ERR C', JSON.stringify(C.errors), 'ERR D', JSON.stringify(D.errors));
await browser.close();
