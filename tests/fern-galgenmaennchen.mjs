// Zwei simulierte Handys (?net=local) spielen Galgenmännchen im Fern-Modus. Aufruf: node tests/fern-galgenmaennchen.mjs [bilder-ordner]
import { chromium, openPage } from './helpers.mjs';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || 'test-bilder'; // Screenshots landen hier
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
const prefs = { mode: 'remote', code: 'testraum42' };
const A = await openPage(browser, { context: ctx, ns: 'a', query: 'net=local', store: { me: 'jos', prefs } });
const B = await openPage(browser, { context: ctx, ns: 'b', query: 'net=local', store: { me: 'joh', prefs } });
await A.page.click('.wer-name.jos'); await B.page.click('.wer-name.joh');
await A.page.waitForTimeout(2500);
await A.page.screenshot({ path: `${OUT}/r1-A-lobby.png` });
await B.page.screenshot({ path: `${OUT}/r1-B-lobby.png` });
console.log('A link:', await A.page.textContent('.link-card').catch(() => '-'));
console.log('B link:', await B.page.textContent('.link-card').catch(() => '-'));
// A startet Galgenmännchen, A versteckt
await A.page.click('[data-game="hangman"]'); await A.page.waitForTimeout(600);
await A.page.click('[data-a="start"]'); await A.page.waitForTimeout(800);
await B.page.waitForTimeout(800);
await B.page.screenshot({ path: `${OUT}/r1-B-invite.png` });
console.log('B invite sheet:', await B.page.isVisible('.invite'));
await B.page.click('.invite .btn.primary'); await B.page.waitForTimeout(800);
await B.page.screenshot({ path: `${OUT}/r1-B-wait.png` });
await A.page.click('.picker .seg-opt[data-value="own"]');
await A.page.fill('.picker-own input', 'Kuschelkissen');
await A.page.fill('#hm-hint', 'Zuhause');
await A.page.click('.hm-word .btn.primary'); await A.page.waitForTimeout(1000);
await A.page.screenshot({ path: `${OUT}/r1-A-watch.png` });
await B.page.screenshot({ path: `${OUT}/r1-B-board.png` });
for (const l of ['E', 'S', 'X']) { await B.page.click(`.key[data-l="${l}"]`); await B.page.waitForTimeout(900); }
await A.page.click('.react >> nth=4'); await B.page.waitForTimeout(400);
await B.page.screenshot({ path: `${OUT}/r1-B-react.png` });
// B neu laden mitten im Spiel
await B.page.reload(); await B.page.waitForTimeout(2500);
console.log('B nach Reload hash:', await B.page.evaluate(() => location.hash), 'keys hit:', await B.page.$$eval('.key.hit', (k) => k.map((x) => x.dataset.l).join('')));
for (const l of ['K', 'U', 'C', 'H', 'L', 'I', 'N']) { await B.page.click(`.key[data-l="${l}"]`); await B.page.waitForTimeout(450); }
await B.page.waitForTimeout(2500);
await A.page.screenshot({ path: `${OUT}/r1-A-end.png` });
await B.page.screenshot({ path: `${OUT}/r1-B-end.png` });
console.log('A result:', (await A.page.textContent('.result').catch(() => '-')).replace(/\s+/g, ' ').trim());
console.log('B result:', (await B.page.textContent('.result').catch(() => '-')).replace(/\s+/g, ' ').trim());
await A.page.click('.result .btn:not(.primary)', { timeout: 5000 }).catch(() => console.log('A: kein Ergebnis')); await B.page.click('.result .btn:not(.primary)');
await A.page.waitForTimeout(1200);
console.log('A score:', (await A.page.textContent('.score-main')).replace(/\s+/g, ' ').trim(), '| B score:', (await B.page.textContent('.score-main')).replace(/\s+/g, ' ').trim());
console.log('ERR A', JSON.stringify(A.errors), 'ERR B', JSON.stringify(B.errors));
await browser.close();
