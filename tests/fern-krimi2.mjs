// Zwei simulierte Handys spielen Krimi Fall 2 „Seid ihr alle da?“ komplett über die Oberfläche (die Drehorgel per Ereignis).
// Aufruf: node tests/fern-krimi2.mjs [bilder-ordner]   (Umgebung: RUHIG=1, BREITE/HOEHE)
import { chromium, openPage, noHScroll } from './helpers.mjs';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || 'test-bilder';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: +(process.env.BREITE || 390), height: +(process.env.HOEHE || 844) }, hasTouch: false, reducedMotion: process.env.RUHIG ? 'reduce' : 'no-preference' });
const prefs = { mode: 'remote', code: 'krimi2test-' + Date.now() };
const A = await openPage(browser, { context: ctx, ns: 'a', query: 'net=local', store: { me: 'jos', prefs } });
const B = await openPage(browser, { context: ctx, ns: 'b', query: 'net=local', store: { me: 'joh', prefs } });
const a = A.page, b = B.page;
const W = (ms) => a.waitForTimeout(ms);
const shot = async (pg, name) => { await pg.screenshot({ path: `${OUT}/k2-${name}.png` }); };
const fails = [];
const check = (ok, msg) => { if (!ok) { fails.push(msg); console.log('✗', msg); } else console.log('✓', msg); };
const state = async (pg, ns) => pg.evaluate(async (ns) => {
  const L = await import('/js/games/krimi/logic.js');
  const ss = JSON.parse(localStorage.getItem(`kk-${ns}:sessions`));
  const s = Object.values(ss).sort((x, y) => y.updated - x.updated)[0];
  const r = L.reduce(s.meta, s.evs);
  return { phase: r.phase, scene: r.scene, sub: r.sub, specs: r.specs, ps: r.ps, blood: r.blood, guests: r.guests, trib: r.trib, fin: r.fin, ending: r.ending, result: r.result, docs: r.docs, first: r.first, votes: r.votes, timeUp: r.timeUp };
}, ns);
const emit = async (pg, ty, d) => pg.evaluate(async ([ty, d]) => {
  const S = await import('/js/core/sync.js');
  const ns = new URLSearchParams(location.search).get('ns');
  const ss = JSON.parse(localStorage.getItem(`kk-${ns}:sessions`));
  const s = Object.values(ss).sort((x, y) => y.updated - x.updated)[0];
  S.addEvent(s.meta.id, ty, d);
}, [ty, d]);
const closeSheets = async (pg) => { for (let i = 0; i < 3; i++) { if (await pg.locator('.sheet-wrap').count()) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(300); } } };
const next = async () => { for (const pg of [a, b]) { await closeSheets(pg); await pg.locator('.k2-stagebox [data-a="next"]').last().click(); await pg.waitForTimeout(300); } await W(2600); };

await a.click('.wer-name.jos'); await b.click('.wer-name.joh'); await W(2200);
await a.click('[data-game="krimi"]'); await W(1200);
await a.click('.kr-casebtn[data-case="puppe"]'); await W(700);
await shot(a, '00-auswahl');
check(await noHScroll(a), 'Fall-Auswahl ohne seitliches Scrollen');
await a.click('.kr-start'); await W(1400);
await b.click('.invite .btn.primary'); await W(1600);
await shot(a, '01-begruessung');
await a.click('.k2-ja-btn'); await W(300);
await b.bringToFront(); await b.click('.k2-ja-btn'); await W(3200);
let s = await state(a, 'a');
check(s.phase === 'play' && s.scene === 0, 'Stück beginnt mit der Marionette');
const who = (role) => ({ puppe: 'first', spieler: 'other', oben: 'first', unten: 'other', blind: 'first', bruecke: 'other', lampe: 'first', leinwand: 'other', bahn: 'first', orgel: 'other' }[role] === 'first' ? (s.first === 'jos' ? a : b) : (s.first === 'jos' ? b : a));
const nsOf = (pg) => (pg === a ? 'a' : 'b');
await a.bringToFront(); await W(300);
await shot(who('puppe'), '02-marionette-puppe');
await shot(who('spieler'), '03-marionette-spielkreuz');

// --- 1) Marionette: erst eine Sichel, dann richtig ---
const LIMBS = ['lh', 'rh', 'lf', 'rf'];
let sp = s.specs[0];
const bad = sp.danger[0];
await who('spieler').click(`.k2-string button[data-c="${sp.map.indexOf(LIMBS[bad.li])}"][data-v="${bad.lv}"]`); await W(700);
await shot(who('puppe'), '04-sichel');
s = await state(a, 'a');
check(s.blood[s.first] === 4.5, 'Sichel kostet Blut');
await W(2200);
for (let li = 0; li < 4; li++) if (sp.target[li]) { await who('spieler').click(`.k2-string button[data-c="${sp.map.indexOf(LIMBS[li])}"][data-v="${sp.target[li]}"]`); await W(250); }
await who('puppe').click('[data-a="grab"]'); await W(1600);
s = await state(a, 'a');
check(s.sub === 'done', 'Marionette gelöst');
await shot(who('puppe'), '05-geschafft');
await next();

// --- 2) Blutspur ---
s = await state(a, 'a');
check(s.scene === 1, 'Szene 2: Blutspur');
sp = s.specs[1];
for (let i = 0; i < 3; i++) { await who('oben').locator(`.k2-drop[data-drop="${i}"]`).click({ force: true }); await W(200); }
await shot(who('oben'), '06-blutspur-oben');
await shot(who('unten'), '07-blutspur-unten');
const wrong = [...Array(36).keys()].find((c) => c !== sp.origin && !Object.values(sp.marks).some(([x, y]) => y * 6 + x === c));
await who('unten').locator(`.k2-plank[data-c="${wrong}"]`).click({ force: true }); await W(200);
await who('unten').click('[data-a="pry"]'); await W(2600);
await who('unten').locator(`.k2-plank[data-c="${sp.origin}"]`).click({ force: true }); await W(200);
await who('unten').click('[data-a="pry"]'); await W(1600);
s = await state(a, 'a');
check(s.sub === 'done' && s.blood[s.first === 'jos' ? 'joh' : 'jos'] === 4.5, 'Blutspur gelöst, Falle hat gebissen');
await next();

// --- Enthüllung ---
s = await state(a, 'a');
check(s.scene === 2, 'Das Publikum');
await shot(a, '08-publikum');
await next();

// --- 3) Drehbühne ---
s = await state(a, 'a');
check(s.scene === 3, 'Szene 3: Drehbühne');
await shot(who('bruecke'), '09-buehne-oben');
const path = await a.evaluate(async (spec) => { const { PUZ } = await import('/js/games/krimi/puppe/puzzles.js'); return PUZ.drehbuehne.solve(spec, PUZ.drehbuehne.init(spec)); }, s.specs[3]);
await who('blind').click('.k2-pad [data-k="feel"]'); await W(300);
for (const k of path) { await who('blind').click(`.k2-pad [data-k="${k}"]`); await W(220); }
await W(1200);
await shot(who('blind'), '10-buehne-sack');
s = await state(a, 'a');
check(s.sub === 'done', 'Drehbühne geschafft (' + path.length + ' Züge)');
await next();

// --- Faden 1: halten ---
s = await state(a, 'a');
check(s.scene === 4, 'Erster Faden');
await shot(a, '11-faden');
await a.click('.k2-vbtn[data-v="hold"]'); await W(300); await b.click('.k2-vbtn[data-v="hold"]'); await W(1500);
s = await state(a, 'a');
check(s.guests.haslinger === 'alive' && s.blood.jos <= 4.5, 'Faden gehalten: Haslinger lebt, Hände bluten');
await shot(b, '12-faden-gehalten');
await next();

// --- 4) Schattentheater ---
s = await state(a, 'a');
check(s.scene === 5, 'Szene 4: Schattentheater');
sp = s.specs[5];
await shot(who('lampe'), '13-schatten-lampe');
for (let i = 0; i < sp.want.length; i++) for (let k = 0; k < sp.want[i]; k++) { await who('lampe').click(`.k2-cardbtn[data-i="${i}"]`); await W(200); }
await W(600);
await shot(who('leinwand'), '14-schatten-leinwand');
for (let i = 0; i < 4; i++) for (let k = 0; k < +sp.code[i]; k++) await who('leinwand').click(`.k2-lock .kr-wheel[data-i="${i}"] .kr-wb.up`);
await who('leinwand').click('[data-a="open"]'); await W(1600);
s = await state(a, 'a');
check(s.sub === 'done', 'Schattentheater gelöst (Code ' + sp.code + ')');
await next();

// --- Faden 2: uneinig, dann schneiden ---
await a.click('.k2-vbtn[data-v="cut"]'); await W(300); await b.click('.k2-vbtn[data-v="hold"]'); await W(800);
await shot(b, '15-faden-uneinig');
await b.click('.k2-vbtn[data-v="cut"]'); await W(1800);
s = await state(a, 'a');
check(s.guests.gerda === 'dead', 'Faden durchgeschnitten');
await shot(a, '16-faden-geschnitten');
await next();

// --- 5) Krokodil (Kurbel per Ereignis) ---
s = await state(a, 'a');
check(s.scene === 7, 'Szene 5: Krokodil');
await W(1500);
const orgPg = who('orgel');
for (let i = 0; i < 20; i++) {
  const st2 = await state(orgPg, nsOf(orgPg));
  if (st2.sub !== 'play') break;
  await emit(orgPg, 'act', { s: 7, k: 'tick', g: 1, n: st2.ps[7].ticks });
  await W(120);
}
await W(800);
await shot(who('bahn'), '17-krokodil');
await shot(orgPg, '18-orgel');
s = await state(a, 'a');
check(s.sub === 'done', 'Krokodil gestoppt');
await next();

// --- Faden 3: halten ---
await a.click('.k2-vbtn[data-v="hold"]'); await W(300); await b.click('.k2-vbtn[data-v="hold"]'); await W(1500);
await shot(a, '19-brandl');
await next();

// --- Tribunal ---
s = await state(a, 'a');
check(s.scene === 9, 'Tribunal');
await shot(a, '20-tribunal');
for (const v of ['brandl', 'haslinger', 'gerda']) { await a.click(`.k2-opt[data-v="${v}"]`); await W(250); await b.click(`.k2-opt[data-v="${v}"]`); await W(1500); }
await a.click('.k2-opt[data-v="gerda"]'); await W(250); await b.click('.k2-opt[data-v="gerda"]'); await W(1500);
s = await state(a, 'a');
check(s.trib.wrong === 1 && s.trib.q === 3, 'Falsches Urteil kostet Blut, Frage bleibt');
await shot(b, '21-tribunal-feuer');
await a.click('.k2-opt[data-v="tobias"]'); await W(250); await b.click('.k2-opt[data-v="tobias"]'); await W(3000);
s = await state(a, 'a');
check(s.scene === 10, 'Die Wahrheit – Finale');
await shot(a, '22-finale');
await next();

// --- Naht aufschneiden ---
const chest = await a.locator('.k2-chestwrap svg').boundingBox();
const cx = chest.x + chest.width / 2;
await a.mouse.move(cx, chest.y + chest.height * .18); await a.mouse.down();
for (let k = 1; k <= 20; k++) { await a.mouse.move(cx, chest.y + chest.height * (.18 + k * .036)); await a.waitForTimeout(30); }
await a.mouse.up(); await W(1200);
s = await state(a, 'a');
check(s.fin.step === 'letter' && s.docs.jos.includes('brief'), 'Naht aufgeschnitten, Brief gefunden');
await shot(a, '23-brief');
await shot(b, '24-brief-partner');
await a.click('.k2-vbtn[data-v="lesen"]'); await W(300); await b.click('.k2-vbtn[data-v="lesen"]'); await W(1500);
await shot(a, '25-tobias');
await next();
await shot(a, '26-vorhang');
// Beide halten gedrückt
const hb1 = await a.locator('.k2-holdbtn').boundingBox();
const hb2 = await b.locator('.k2-holdbtn').boundingBox();
await a.mouse.move(hb1.x + hb1.width / 2, hb1.y + hb1.height / 2); await a.mouse.down();
await b.mouse.move(hb2.x + hb2.width / 2, hb2.y + hb2.height / 2); await b.mouse.down();
await W(4500);
await a.mouse.up(); await b.mouse.up();
await W(4500);
s = await state(a, 'a');
check(s.phase === 'end' && s.ending === 'vorhang', 'Ende: ' + s.ending + ' – ' + (s.result?.stars ?? '?') + ' Sterne');
await shot(a, '27-ende');
await b.bringToFront(); await W(800);
await shot(b, '28-ende-partner');

const errs = [...A.errors, ...B.errors].filter((e) => !/WebSocket|supabase|net::|Failed to load resource/i.test(e));
check(errs.length === 0, 'Keine Fehler in der Konsole' + (errs.length ? ': ' + errs.join(' | ') : ''));
await browser.close();
console.log(fails.length ? `\n${fails.length} Fehler` : '\nAlles gut.');
process.exit(fails.length ? 1 : 0);
