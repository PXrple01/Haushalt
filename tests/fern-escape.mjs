// Zwei simulierte Handys spielen ein Escape-Abenteuer komplett durch – alle Rätsel werden über die Oberfläche gelöst.
// Aufruf: node tests/fern-escape.mjs [bilder-ordner] [geschichte] [stufe]
import { chromium, openPage, noHScroll } from './helpers.mjs';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || 'test-bilder';
const THEME = process.argv[3] || 'schloss';
const DIFF = process.argv[4] || 'normal';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: +(process.env.BREITE || 390), height: +(process.env.HOEHE || 844) }, hasTouch: true, reducedMotion: process.env.RUHIG ? 'reduce' : 'no-preference' });
const prefs = { mode: 'remote', code: 'escapetest-' + THEME };
const A = await openPage(browser, { context: ctx, ns: 'a', query: 'net=local', store: { me: 'jos', prefs } });
const B = await openPage(browser, { context: ctx, ns: 'b', query: 'net=local', store: { me: 'joh', prefs } });
const a = A.page, b = B.page; const W = (ms) => a.waitForTimeout(ms);
const pageOf = { jos: a, joh: b };
const nsOf = { jos: 'a', joh: 'b' };
await a.click('.wer-name.jos'); await b.click('.wer-name.joh'); await W(2200);
await a.click('[data-game="escape"]'); await W(1200);
await a.click(`.es-tcard[data-theme="${THEME}"]`); await W(700);
await a.click(`.es-detail .rcard[data-value="${DIFF}"]`);
await a.click('.es-start'); await W(1200);
await b.click('.invite .btn.primary'); await W(1200);

const state = async (pg, ns) => pg.evaluate(async (ns) => {
  const L = await import('/js/games/escape/logic.js');
  const P = await import('/js/games/escape/puzzles.js');
  const ss = JSON.parse(localStorage.getItem(`kk-${ns}:sessions`));
  const s = Object.values(ss).sort((x, y) => y.updated - x.updated)[0];
  const r = L.reduce(s.meta, s.evs);
  const rm = r.rooms[r.room];
  const sol = rm ? P.PUZZLES[rm.kind].solution(rm.spec) : null;
  const echoSeq = rm && rm.kind === 'echo' ? P.PUZZLES.echo.seqOf(rm.spec, r.rs[r.room]).map((c) => rm.spec.legend[c]) : null;
  return { phase: r.phase, room: r.room, hands: rm ? L.handsOf(r) : null, kind: rm?.kind, spec: rm?.spec, rs: r.rs[r.room], sol, echoSeq, mistakes: r.mistakes, hints: r.hints, hintsUsed: r.hintsUsed, won: r.won, n: s.evs.length, penalty: r.penaltyMs };
}, ns);

await a.click('.es-go'); await W(300); await b.bringToFront(); await b.click('.es-go'); await W(3400);
let s = await state(a, 'a');
console.log('Start:', s.phase, 'Raum', s.room, s.kind, 'Hände:', s.hands);

async function solve(pg, s, { wrongFirst = false } = {}) {
  const sp = s.spec;
  if (s.kind === 'lock') {
    for (let i = 0; i < sp.n; i++) {
      const want = sp.syms.indexOf(sp.solution[i]);
      for (let k = 0; k < want; k++) { await pg.click(`.lk-dial[data-i="${i}"] .lk-arr.down`); await pg.waitForTimeout(40); }
    }
    if (wrongFirst) { await pg.click(`.lk-dial[data-i="0"] .lk-arr.down`); await pg.click('.lk-open'); await pg.waitForTimeout(900); await pg.click(`.lk-dial[data-i="0"] .lk-arr.up`); await pg.waitForTimeout(800); }
    await pg.click('.lk-open');
  } else if (s.kind === 'wires') {
    if (wrongFirst) { const w = (sp.answer + 1) % sp.k; await pg.click(`.wr[data-i="${w}"] .wr-c`, { force: true }); await pg.click('.wr-cut'); await pg.waitForTimeout(900); }
    await pg.click(`.wr[data-i="${sp.answer}"] .wr-c`, { force: true }); await pg.click('.wr-cut');
  } else if (s.kind === 'maze') {
    const name = { n: 'n', e: 'e', s: 's', w: 'w' };
    if (wrongFirst) {
      // gegen eine Wand laufen
      const [x, y] = sp.start; const w = sp.walls[y * sp.size + x];
      const d = (w & 1) ? 'n' : (w & 2) ? 'e' : (w & 4) ? 's' : 'w';
      await pg.click(`.mz-btn.${d}`); await pg.waitForTimeout(400);
    }
    for (const a of s.sol) { await pg.click(`.mz-btn.${name[a.d]}`); await pg.waitForTimeout(110); }
  } else if (s.kind === 'echo') {
    let seq = s.echoSeq;
    if (wrongFirst) {
      const bad = [...seq]; bad[0] = sp.syms.find((x) => x !== seq[0]);
      for (const sy of bad) await pg.click(`.ec-key[data-s="${sy}"]`);
      await pg.waitForTimeout(1600);
      const s2 = await state(pg, pg === a ? 'a' : 'b'); seq = s2.echoSeq;
    }
    for (const sy of seq) { await pg.click(`.ec-key[data-s="${sy}"]`); await pg.waitForTimeout(60); }
  } else if (s.kind === 'potion') {
    if (wrongFirst) {
      const wrong = sp.shelf.find((x) => x !== sp.recipe[0].add);
      await pg.click(`.po-ing[data-id="${wrong}"]`); await pg.waitForTimeout(1200);
    }
    for (const a of s.sol) { await pg.click(`.po-ing[data-id="${a.ing}"]`); await pg.waitForTimeout(1000); }
  } else if (s.kind === 'safe') {
    if (wrongFirst) {
      const bad = sp.code.split('').map((d) => String((+d + 1) % 10)).join('');
      for (const d of bad) await pg.click(`.sf-k[data-n="${d}"]`);
      await pg.click('.sf-k[data-n="ok"]'); await pg.waitForTimeout(1200);
    }
    for (const d of sp.code) await pg.click(`.sf-k[data-n="${d}"]`);
    await pg.click('.sf-k[data-n="ok"]');
  } else if (s.kind === 'lineup') {
    if (wrongFirst) { const w = (sp.target + 1) % 6; await pg.click(`.lu-fig[data-i="${w}"]`); await pg.click('.lu-pick'); await pg.waitForTimeout(900); }
    await pg.click(`.lu-fig[data-i="${sp.target}"]`); await pg.click('.lu-pick');
  }
}

const seen = [];
for (let r = 0; r < 4; r++) {
  s = await state(a, 'a');
  if (s.phase !== 'room' || s.room !== r) { console.log('Unerwartet:', s.phase, s.room); break; }
  const hp = pageOf[s.hands], bp = pageOf[s.hands === 'jos' ? 'joh' : 'jos'];
  await hp.bringToFront(); await W(200);
  await hp.screenshot({ path: `${OUT}/x-${THEME}-${r}-${s.kind}-haende.png`, fullPage: true });
  await bp.bringToFront(); await W(200);
  await bp.screenshot({ path: `${OUT}/x-${THEME}-${r}-${s.kind}-wissen.png`, fullPage: true });
  const hs = await hp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  const bs = await bp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  if (r === 1) {
    // Tipp holen (vom Wissen-Handy)
    await bp.click('.es-hintbtn'); await W(300); await bp.click('.dialog .btn.primary'); await W(800);
    const tips = await hp.locator('.es-hints li').count();
    console.log('Tipp sichtbar auf Hände-Handy:', tips);
  }
  await hp.bringToFront();
  await solve(hp, s, { wrongFirst: r === 0 || r === 2 });
  await W(1800);
  const s2 = await state(b, 'b');
  console.log(`Raum ${r + 1} (${s.kind}) Hände=${s.hands} → ${s2.phase} | Fehler ${s2.mistakes} | Tipps ${s2.hints} | kein Querscrollen: ${hs && bs}`);
  seen.push(s.kind);
  if (r < 3) {
    await hp.screenshot({ path: `${OUT}/x-${THEME}-${r}-geschafft.png` });
    await bp.bringToFront(); await bp.click('.es-cleared .btn.primary'); await W(2600);
  }
}
await W(2500);
const ea = await state(a, 'a'), eb = await state(b, 'b');
console.log('Ende:', ea.phase, 'gewonnen', ea.won, '| B:', eb.phase, eb.won, '| Ereignisse', ea.n, eb.n);
await a.bringToFront(); await W(2200);
await a.screenshot({ path: `${OUT}/x-${THEME}-ende.png`, fullPage: true });
console.log('A Ende:', (await a.textContent('.es-end').catch(() => '-')).replace(/\s+/g, ' ').trim().slice(0, 120));
console.log('ERR A', JSON.stringify(A.errors), 'ERR B', JSON.stringify(B.errors));
await browser.close();
