// Zwei simulierte Handys spielen „Krimi für zwei“: Start, Karte, Durchsuchen, Akte, Tafel mit Faden, Verhöre (Bluff),
// Werkzeuge, Ereignisse der Nacht, gemeinsame Anklage, Auflösung. Macht Bildschirmfotos.
// Aufruf: node tests/fern-krimi.mjs [bilder-ordner]   (Umgebung: RUHIG=1 für weniger Bewegung, BREITE/HOEHE)
import { chromium, openPage, noHScroll } from './helpers.mjs';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || 'test-bilder';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: +(process.env.BREITE || 390), height: +(process.env.HOEHE || 844) }, hasTouch: true, reducedMotion: process.env.RUHIG ? 'reduce' : 'no-preference' });
const prefs = { mode: 'remote', code: 'krimitest-' + Date.now() };
const A = await openPage(browser, { context: ctx, ns: 'a', query: 'net=local', store: { me: 'jos', prefs } });
const B = await openPage(browser, { context: ctx, ns: 'b', query: 'net=local', store: { me: 'joh', prefs } });
const a = A.page, b = B.page;
const W = (ms) => a.waitForTimeout(ms);
const shot = async (pg, name) => { await pg.screenshot({ path: `${OUT}/krimi-${name}.png` }); };
const fails = [];
const check = (ok, msg) => { if (!ok) { fails.push(msg); console.log('✗', msg); } else console.log('✓', msg); };
const state = async (pg, ns) => pg.evaluate(async (ns) => {
  const L = await import('/js/games/krimi/logic.js');
  const ss = JSON.parse(localStorage.getItem(`kk-${ns}:sessions`));
  const s = Object.values(ss).sort((x, y) => y.updated - x.updated)[0];
  const r = L.reduce(s.meta, s.evs);
  return { phase: r.phase, clock: r.clock, pos: r.pos, with: r.with, files: { jos: r.order.jos, joh: r.order.joh }, flags: r.flags, pins: Object.keys(r.pins), threads: r.threads, erk: r.erk, formV: r.formV, sign: r.sign, result: r.result, n: s.evs.length, sid: s.meta.id };
}, ns);
// Ereignisse direkt einspielen (für schnelles Vorspulen)
const emit = async (pg, ty, d) => pg.evaluate(async ([ty, d]) => {
  const S = await import('/js/core/sync.js');
  const ns = new URLSearchParams(location.search).get('ns');
  const ss = JSON.parse(localStorage.getItem(`kk-${ns}:sessions`));
  const s = Object.values(ss).sort((x, y) => y.updated - x.updated)[0];
  S.addEvent(s.meta.id, ty, d);
}, [ty, d]);
const closeSheets = async (pg) => { for (let i = 0; i < 3; i++) { if (await pg.locator('.sheet-wrap').count()) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(350); } } };
const dismissNews = async (pg) => { for (let i = 0; i < 6; i++) { const n = pg.locator('.kr-news .btn.primary'); if (await n.count()) { await n.first().click(); await pg.waitForTimeout(450); } else break; } };

await a.click('.wer-name.jos'); await b.click('.wer-name.joh'); await W(2200);
check(await a.locator('.toy.krimi').count() === 1, 'Lobby-Karte vorhanden');
await shot(a, '00-lobby');
await a.click('[data-game="krimi"]'); await W(1400);
await shot(a, '01-setup');
check(await noHScroll(a), 'Einstellungen ohne seitliches Scrollen');
await a.click('.kr-start'); await W(1400);
await b.click('.invite .btn.primary'); await W(1600);
await shot(a, '02-intro');
await a.click('.kr-go'); await W(400);
await b.bringToFront(); await b.click('.kr-go'); await W(2600);
let s = await state(a, 'a');
check(s.phase === 'play', 'Ermittlung läuft: ' + s.phase);
await a.bringToFront(); await W(400);
await shot(a, '03-karte');
check(await noHScroll(a), 'Karte ohne seitliches Scrollen');

// --- Jos: in den Weinkeller, Leiche untersuchen ---
await a.click('.kr-floors [data-floor="ug"]'); await W(300);
await a.click('.kr-room[data-room="weinkeller"]'); await W(300);
await shot(a, '04-raum-vorschau');
await a.click('[data-a="go"][data-room="weinkeller"]'); await W(900);
await a.click('[data-a="spot"][data-spot="leiche"]'); await W(1400);
await shot(a, '05-fund-leiche');
check(await a.locator('.kr-find').count() === 1, 'Fund-Blatt erscheint');
await a.click('.kr-find [data-x="ok"]'); await W(900);
await a.click('[data-a="spot"][data-spot="unter"]'); await W(1200);
await a.click('.kr-find [data-x="ok"]'); await W(600);
await a.click('[data-a="spot"][data-spot="scherben"]'); await W(1200);
await a.click('.kr-find [data-x="ok"]'); await W(600);
await a.click('[data-a="spot"][data-spot="regal"]'); await W(1200);
await a.click('.kr-find [data-x="ok"]'); await W(600);
s = await state(a, 'a');
check(s.files.jos.includes('uhr') && s.files.jos.includes('kerze'), 'Spuren in Jos’ Akte');
check(!s.files.joh.includes('uhr'), 'Johann sieht sie nicht');

// --- Akte + Spur-Blatt + Anpinnen + Funk ---
await a.click('.kr-tab[data-tab="file"]'); await W(700);
await shot(a, '06-akte');
await a.click('.kr-cardbtn[data-clue="uhr"]'); await W(900);
await shot(a, '07-spur-uhr');
await a.click('.kr-clue-acts [data-x="pin"]'); await W(800);
await a.click('.kr-cardbtn[data-clue="scherben"]'); await W(800);
await a.click('.kr-clue-acts [data-x="radio"]'); await W(700);
await closeSheets(a);

// --- Johann: Kaminzimmer, Verhöre ---
await b.bringToFront(); await W(300);
await b.click('.kr-tab[data-tab="talk"]'); await W(700);
await shot(b, '08-verdaechtige');
await b.click('.kr-sus[data-who="wendt"]'); await W(1600);
await shot(b, '09-verhoer-wendt');
await b.click('[data-a="leave"]'); await W(600);
// Bluff: Johann bei Lukas, Jos bei Viktoria
await b.click('.kr-sus[data-who="lukas"]'); await W(1300);
await a.bringToFront();
await a.click('.kr-tab[data-tab="talk"]'); await W(600);
await a.click('.kr-sus[data-who="viktoria"]'); await W(1500);
check(await a.locator('.kr-topic.bluff').count() === 1, 'Bluff-Frage erscheint bei getrennten Verhören');
await shot(a, '10-bluff');
await a.click('.kr-topic.bluff'); await W(2200);
s = await state(a, 'a');
check(s.files.jos.includes('a_viktoria_wahr'), 'Bluff wirkt: Viktoria gesteht die Affäre');
await shot(a, '11-gestaendnis');
// Beweis vorhalten
await a.click('[data-a="show"]'); await W(700);
await shot(a, '12-vorhalten');
await a.click('.kr-picker [data-clue="uhr"]'); await W(1500);
await a.click('[data-a="leave"]'); await W(500);

// --- Tafel: Johann hängt Wendts Aussage an, Faden ---
await b.bringToFront();
await b.click('[data-a="leave"]'); await W(400);
await b.click('.kr-sus[data-who="wendt"]'); await W(900);
await b.click('[data-a="leave"]'); await W(300);
await emit(b, 'pin', { clue: 'a_wendt_alibi', x: .8, y: .55 }); await W(500);
await a.bringToFront();
await a.click('.kr-tab[data-tab="map"]'); await W(300);
await a.click('.kr-floors [data-floor="eg"]'); await W(300);
await a.click('.kr-room[data-room="bibliothek"]'); await W(300);
await a.click('[data-a="go"][data-room="bibliothek"]'); await W(900);
await a.click('[data-a="spot"][data-spot="schach"]'); await W(1300);
await a.click('.kr-find [data-x="ok"]'); await W(600);
await emit(a, 'pin', { clue: 'schachprotokoll', x: .1, y: .5 }); await W(500);
await a.click('.kr-tab[data-tab="board"]'); await W(900);
await shot(a, '13-tafel');
// Faden: Protokoll antippen → „Roten Faden ziehen“ → Wendts Aussage antippen
await a.click('.kr-pin[data-clue="schachprotokoll"]'); await W(700);
await a.click('.kr-pinmenu [data-x="thread"]'); await W(600);
await a.click('.kr-pin[data-clue="a_wendt_alibi"]', { force: true }); await W(2000);
s = await state(a, 'a');
check(s.erk.includes('c_luecke'), 'Roter Faden ergibt Erkenntnis');
await shot(a, '14-erkenntnis');
await closeSheets(a); await W(400);
await shot(a, '15-tafel-faden');
// Ziehen einer Nadel
const pin = a.locator('.kr-pin[data-clue="uhr"]');
const bb = await pin.boundingBox();
await a.mouse.move(bb.x + 40, bb.y + 30); await a.mouse.down(); await a.mouse.move(bb.x + 120, bb.y + 160, { steps: 8 }); await a.mouse.up(); await W(600);
s = await state(a, 'a');

// --- Werkzeuge: Chiffre ---
await emit(a, 'go', { room: 'buero' }); await W(500);
s = await state(a, 'a');
check(s.pos.jos === 'buero', 'Büro mit Falkners Schlüssel offen');
await emit(a, 'search', { room: 'buero', spot: 'schreibtisch' }); await W(1200);
await closeSheets(a);
await a.click('.kr-tab[data-tab="file"]'); await W(500);
await a.click('.kr-cardbtn[data-clue="tagebuch"]'); await W(700);
await a.click('.kr-clue-acts [data-x="cipher"]'); await W(700);
await a.fill('.kr-cipher input', 'LIS'); await W(300);
await shot(a, '16-chiffre-falsch');
await a.fill('.kr-cipher input', 'Lisl'); await W(500);
await shot(a, '17-chiffre-richtig');
await a.click('.kr-cipher [data-a="ok"]'); await W(1300);
await closeSheets(a);
// Tresor
await emit(a, 'search', { room: 'buero', spot: 'tresor' }); await W(1000);
await closeSheets(a);
await a.click('.kr-cardbtn[data-clue="tresor"]'); await W(600);
await a.click('.kr-clue-acts [data-x="safe"]'); await W(600);
for (const [i, d] of [[0, 1], [1, 2], [2, 0], [3, 3], [4, 0], [5, 4]]) for (let k = 0; k < d; k++) await a.click(`.kr-wheel[data-i="${i}"] .kr-wb.up`);
await shot(a, '18-tresor');
await a.click('.kr-safe [data-a="try"]'); await W(2200);
s = await state(a, 'a');
check(s.files.jos.includes('testament'), 'Tresor geöffnet');
await closeSheets(a);

// --- Vorspulen bis nach 1 Uhr (Emil stirbt), Ereignis-Einblendung ---
for (let i = 0; i < 26; i++) await emit(b, 'go', { room: i % 2 ? 'rezeption' : 'heizraum' });
await W(800);
for (let i = 0; i < 32; i++) await emit(b, 'go', { room: i % 2 ? 'rezeption' : 'heizraum' });
await W(1500);
s = await state(a, 'a');
check(s.flags.emilDead && s.flags.emilFound, 'Zweiter Mord passiert und wird entdeckt');
await shot(a, '19-ereignis-blut');
await dismissNews(a); await dismissNews(b);
await shot(a, '20-nach-ereignis');

// --- Anklage gemeinsam ---
await a.click('.kr-tab[data-tab="accuse"]'); await W(700);
await shot(a, '21-anklage-leer');
const answers = { taeter: 'wendt', waffe: 'skalpell', zeit: 'b', trick: 'kerze', motiv: 'rache', abdruck: 'wendt', versteck: 'schnee', emil_wer: 'wendt', emil_warum: 'erpressung', luegner: ['viktoria', 'lukas'], vater: 'wendt', lawine: 'konrad', sophie: 'presse' };
let k = 0;
for (const [q, v] of Object.entries(answers)) {
  const pg = k++ % 2 ? b : a;
  for (const x of [].concat(v)) {
    await dismissNews(pg); await closeSheets(pg);
    await pg.click(`.kr-tab[data-tab="accuse"]`).catch(() => {});
    try { await pg.locator(`.kr-opt[data-q="${q}"][data-v="${x}"]`).click({ timeout: 5000 }); }
    catch (e) { await shot(pg, 'fehler-' + q); console.log('Fehler bei', q, x, [...A.errors, ...B.errors].slice(-5)); throw e; }
    await pg.waitForTimeout(120);
  }
}
await W(600);
await shot(a, '22-anklage-voll');
await a.click('[data-a="sign"]'); await W(500);
await a.click('.dialog .btn.primary'); await W(900);
await b.bringToFront(); await dismissNews(b);
await b.click('.kr-tab[data-tab="accuse"]'); await W(500);
await shot(b, '23-gegenzeichnen');
await b.click('[data-a="sign"]'); await W(500);
await b.click('.dialog .btn.primary'); await W(3800);
s = await state(b, 'b');
check(s.phase === 'end' && s.result.culprit, 'Anklage eingereicht, Täter richtig: ' + s.result?.total + ' Punkte, ' + s.result?.rank?.title);
await shot(b, '24-aufloesung');
await b.evaluate(() => window.scrollTo(0, 900)); await W(400);
await shot(b, '25-aufloesung-2');
await b.click('[data-a="rc-next"]'); await W(500);
await b.evaluate(() => document.querySelector('.kr-recon').scrollIntoView()); await W(500);
await shot(b, '26-rekonstruktion');
await a.bringToFront(); await W(3000);
await shot(a, '27-aufloesung-jos');

const errs = [...A.errors, ...B.errors].filter((e) => !/WebSocket|supabase|net::|Failed to load resource/i.test(e));
check(errs.length === 0, 'Keine Fehler in der Konsole' + (errs.length ? ': ' + errs.join(' | ') : ''));
await browser.close();
console.log(fails.length ? `\n${fails.length} Fehler` : '\nAlles gut.');
process.exit(fails.length ? 1 : 0);
