// Erzeugt die App-Symbole (PNG) aus dem Puzzle-Herz. Aufruf: node tests/make-icons.mjs
import { chromium } from './helpers.mjs';
import { writeFileSync } from 'node:fs';
import { HEART } from '../js/art/heart.js';

const heart = (scale, cx, cy) => `
  <g transform="translate(${cx} ${cy}) scale(${scale}) translate(-120 -113)">
    <path d="${HEART.left}" fill="#fff" stroke="#fff" stroke-width="22" stroke-linejoin="round"/>
    <path d="${HEART.right}" fill="#fff" stroke="#fff" stroke-width="22" stroke-linejoin="round"/>
    <path d="${HEART.left}" fill="url(#gj)"/>
    <path d="${HEART.right}" fill="url(#gv)"/>
    <ellipse cx="62" cy="50" rx="26" ry="13" fill="#fff" opacity=".55" transform="rotate(-32 62 50)"/>
    <path d="M86 70 l3 -9 l3 9 l9 3 l-9 3 l-3 9 l-3 -9 l-9 -3 z" fill="#fff"/>
    <path d="M196 92 l2.2 -7 l2.2 7 l7 2.2 l-7 2.2 l-2.2 7 l-2.2 -7 l-7 -2.2 z" fill="#7DF3FF"/>
  </g>`;
const defs = `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE9F5"/><stop offset=".55" stop-color="#F6DDFF"/><stop offset="1" stop-color="#DCCBFF"/></linearGradient>
  <linearGradient id="gj" x1="0" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="#FFB3D9"/><stop offset=".45" stop-color="#FF6FB1"/><stop offset="1" stop-color="#E23C8C"/></linearGradient>
  <linearGradient id="gv" x1="1" y1="0" x2=".1" y2="1"><stop offset="0" stop-color="#B996FF"/><stop offset=".5" stop-color="#8253FF"/><stop offset="1" stop-color="#4E22C9"/></linearGradient>
  <filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#7A2A6A" flood-opacity=".28"/></filter>
</defs>`;
const sparkles = `<g fill="#fff"><path d="M86 96 l7 -22 l7 22 l22 7 l-22 7 l-7 22 l-7 -22 l-22 -7z" opacity=".9"/><path d="M418 392 l5 -15 l5 15 l15 5 l-15 5 l-5 15 l-5 -15 l-15 -5z" opacity=".85"/><circle cx="420" cy="110" r="9" opacity=".8"/><circle cx="96" cy="410" r="6" opacity=".7"/></g>`;
const full = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}<rect width="512" height="512" fill="url(#bg)"/>${sparkles}<g filter="url(#sh)">${heart(scale, 256, 268)}</g></svg>`;
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -12 264 244">${defs}<path d="${HEART.left}" fill="url(#gj)" stroke="#fff" stroke-width="10" stroke-linejoin="round"/><path d="${HEART.right}" fill="url(#gv)" stroke="#fff" stroke-width="10" stroke-linejoin="round"/></svg>`;

writeFileSync('assets/icons/icon.svg', favicon);
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, scale] of [['icon-512.png', 512, 1.55], ['icon-192.png', 192, 1.55], ['icon-180.png', 180, 1.55], ['icon-maskable-512.png', 512, 1.2]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${full(scale).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `assets/icons/${name}`, omitBackground: false });
}
await browser.close();
console.log('ok');
