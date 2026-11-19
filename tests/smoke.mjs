// Rundgang durch alle Bildschirme: beide Themes, mehrere Breiten, optional „Bewegung reduzieren“.
// Prüft: keine Fehler in der Konsole, kein seitliches Scrollen. Aufruf: node tests/smoke.mjs [ordner-für-screenshots]
import { chromium, openPage, noHScroll } from './helpers.mjs';

const OUT = process.argv[2] || '';
const browser = await chromium.launch();
const problems = [];
let shots = 0;

async function check(page, errors, label) {
  if (!(await noHScroll(page))) problems.push(`${label}: seitliches Scrollen`);
  if (errors.length) { problems.push(`${label}: ${errors.join(' | ')}`); errors.length = 0; }
  if (OUT) { await page.screenshot({ path: `${OUT}/smoke-${label}.png` }); shots++; }
}

async function tour({ p, w, h, reduced = false }) {
  const tag = `${p}-${w}${reduced ? '-ruhig' : ''}`;
  const { page, errors, ctx } = await openPage(browser, { w, h, reduced, store: { me: p }, wait: reduced ? 300 : 3200 });
  const W = (ms) => page.waitForTimeout(reduced ? Math.min(ms, 250) : ms);
  await check(page, errors, `${tag}-wer`);
  await page.click(`.wer-name.${p}`); await W(1800);
  await check(page, errors, `${tag}-lobby`);
  await page.click('[data-a="settings"]'); await W(700);
  await check(page, errors, `${tag}-einstellungen`);
  await page.keyboard.press('Escape'); await W(400);
  // Galgenmännchen
  await page.click('[data-game="hangman"]'); await W(700);
  await check(page, errors, `${tag}-hm-setup`);
  await page.click('[data-a="start"]'); await W(700);
  await check(page, errors, `${tag}-handoff`);
  await page.click('.handoff .btn'); await W(600);
  await check(page, errors, `${tag}-hm-wort`);
  await page.click('.hm-word .btn.primary'); await W(600);
  await page.click('.handoff .btn'); await W(700);
  await page.click('.key[data-l="E"]'); await W(500);
  await page.click('.key[data-l="Q"]'); await W(1200);
  await check(page, errors, `${tag}-hm-brett`);
  await page.click('[data-a="back"]'); await W(900);
  await check(page, errors, `${tag}-lobby-mit-partie`);
  // Wer bin ich?
  await page.click('[data-game="whoami"]'); await W(700);
  await page.click('[data-a="start"]'); await W(700);
  await page.click('.handoff .btn'); await W(600);
  await check(page, errors, `${tag}-wa-figur`);
  await page.click('.wa-pick .btn.primary'); await W(600);
  await page.click('.handoff .btn'); await W(600);
  await page.click('.wa-pick .btn.primary'); await W(600);
  await page.click('.handoff .btn'); await W(800);
  await check(page, errors, `${tag}-wa-brett`);
  await page.click('[data-a="back"]'); await W(900);
  // Zahl erraten
  await page.click('[data-game="number"]'); await W(700);
  await page.click('[data-a="start"]'); await W(700);
  await page.click('.handoff .btn'); await W(600);
  await page.click('.np-key[data-k="rand"]');
  await check(page, errors, `${tag}-nu-zahl`);
  await page.click('.numpad .btn.primary'); await W(600);
  await page.click('.handoff .btn'); await W(600);
  await page.click('.np-key[data-k="rand"]'); await page.click('.numpad .btn.primary'); await W(600);
  await page.click('.handoff .btn'); await W(800);
  await check(page, errors, `${tag}-nu-brett`);
  await ctx.close();
}

for (const p of ['jos', 'joh']) {
  for (const [w, h] of [[340, 700], [390, 844], [1280, 800]]) await tour({ p, w, h });
}
await tour({ p: 'jos', w: 390, h: 844, reduced: true });
await browser.close();
console.log(problems.length ? `PROBLEME (${problems.length}):\n- ${problems.join('\n- ')}` : `Alles in Ordnung${OUT ? ` (${shots} Screenshots)` : ''}.`);
process.exit(problems.length ? 1 : 0);
