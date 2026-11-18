// Test-Helfer für Playwright (lokal: python3 -m http.server 5178 im Repo-Ordner).
// Nicht Teil der App – nur für automatische Prüfungen.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export const { chromium } = require('playwright');

export const BASE = process.env.KK_BASE || 'http://127.0.0.1:5178/index.html';

// Neue Seite mit gesetztem Speicher (Person, Theme, Bewegung)
export async function openPage(browser, o = {}) {
  const ctx = o.context || await browser.newContext({
    viewport: { width: o.w ?? 390, height: o.h ?? 844 },
    deviceScaleFactor: o.dpr ?? 1,
    hasTouch: o.touch ?? true,
    isMobile: o.mobile ?? false,
    reducedMotion: o.reduced ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const ns = o.ns ? `?ns=${o.ns}${o.query ? '&' + o.query : ''}` : (o.query ? '?' + o.query : '');
  const prefix = 'kk' + (o.ns ? '-' + o.ns : '') + ':';
  await page.addInitScript(([prefix, store]) => {
    if (sessionStorage.getItem('__kk_init')) return;
    sessionStorage.setItem('__kk_init', '1');
    for (const [k, v] of Object.entries(store)) localStorage.setItem(prefix + k, JSON.stringify(v));
  }, [prefix, o.store || {}]);
  await page.goto(BASE + ns + (o.hash || ''));
  await page.waitForTimeout(o.wait ?? 400);
  return { page, ctx, errors };
}

// Kein seitliches Scrollen?
export async function noHScroll(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}
