// Hintergrund-Szenen für #scene: Baby (Himmel, Wolken, Regenbogen, Glitzer, Herzchen) und Lila (Nacht, Nebel, Sterne, Mond).
import { rnd, rint, pick } from './util.js';

const CLOUD = (face) => `<svg viewBox="0 0 200 110" aria-hidden="true">
  <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#fff"/><stop offset="1" stop-color="#F2E8FF"/></linearGradient></defs>
  <path d="M38 96 A26 26 0 0 1 34 46 A34 34 0 0 1 96 28 A38 38 0 0 1 162 46 A26 26 0 0 1 170 96 Z" fill="url(#cg)"/>
  ${face ? `<g><ellipse cx="86" cy="70" rx="3.6" ry="4.6" fill="#5E2350"/><ellipse cx="114" cy="70" rx="3.6" ry="4.6" fill="#5E2350"/>
  <path d="M95 77 Q100 82 105 77" fill="none" stroke="#5E2350" stroke-width="2.6" stroke-linecap="round"/>
  <ellipse cx="76" cy="79" rx="7" ry="4" fill="#FF9DCB" opacity=".6"/><ellipse cx="124" cy="79" rx="7" ry="4" fill="#FF9DCB" opacity=".6"/></g>` : ''}
</svg>`;

const RAINBOW = `<svg class="rainbow amb" viewBox="0 0 360 180" aria-hidden="true">
  ${['#FFB3D9', '#FFCFA8', '#FFF1A8', '#B8F2D8', '#AEE0FF', '#CDB8FF']
    .map((c, i) => `<path d="M${20 + i * 14} 180 A${160 - i * 14} ${160 - i * 14} 0 0 1 ${340 - i * 14} 180" fill="none" stroke="${c}" stroke-width="14"/>`)
    .join('')}
</svg>`;

const HEART = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 21l-1.4-1.3C5.6 15.2 2.5 12.4 2.5 8.9 2.5 6.1 4.7 4 7.4 4c1.6 0 3.4.8 4.6 2.1C13.2 4.8 15 4 16.6 4c2.7 0 4.9 2.1 4.9 4.9 0 3.5-3.1 6.3-8.1 10.8z"/></svg>';
const BUBBLE = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8.5" cy="8.5" r="2.4" fill="#fff" opacity=".8"/></svg>';
const STAR = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z"/></svg>';

function babyScene() {
  const clouds = [
    { w: 210, y: '7%', t: 95, dl: -20, o: .95, face: true },
    { w: 130, y: '24%', t: 70, dl: -55, o: .85 },
    { w: 260, y: '58%', t: 120, dl: -80, o: .7 },
    { w: 150, y: '78%', t: 85, dl: -10, o: .8, face: true },
  ];
  const statics = [
    { w: 170, x: '-6%', y: '14%' },
    { w: 120, x: '70%', y: '70%' },
  ];
  let html = '<div class="sc sc-baby"><div class="sky"></div><div class="dots"></div>' + RAINBOW;
  for (const s of statics) html += `<div class="cloud static" style="--w:${s.w}px;--x:${s.x};--y:${s.y};--o:.9">${CLOUD(false)}</div>`;
  for (const c of clouds) html += `<div class="cloud amb" style="--w:${c.w}px;--y:${c.y};--t:${c.t}s;--dl:${c.dl}s;--o:${c.o}">${CLOUD(c.face)}</div>`;
  const sparkCols = ['#fff', '#fff', '#FFE27A', '#FFB3D9', '#C9B2FF', '#AEE0FF'];
  for (let i = 0; i < 16; i++) {
    html += `<i class="spark amb" style="--x:${rnd(3, 95).toFixed(1)}%;--y:${rnd(3, 92).toFixed(1)}%;--s:${rint(9, 18)}px;--t:${rnd(2.4, 4.6).toFixed(2)}s;--dl:${(-rnd(0, 4)).toFixed(2)}s;--c:${pick(sparkCols)}"></i>`;
  }
  const floatCols = ['#FF9DCB', '#FFB3D9', '#C9B2FF', '#AEE0FF', '#FFC2A8'];
  for (let i = 0; i < 9; i++) {
    const shape = i % 3 === 2 ? BUBBLE : HEART;
    html += `<i class="float amb" style="--x:${rnd(4, 94).toFixed(1)}%;--s:${rint(14, 26)}px;--t:${rnd(16, 26).toFixed(1)}s;--dl:${(-rnd(0, 24)).toFixed(1)}s;--c:${pick(floatCols)}">${shape}</i>`;
  }
  return html + '</div>';
}

function starShadows(count, w, h, colors) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(`${rint(0, w)}px ${rint(0, h)}px ${pick(colors)}`);
  return out.join(',');
}

function lilaScene() {
  const w = Math.max(window.innerWidth, 400), h = Math.max(window.innerHeight, 700);
  const area = (w * h) / 100000;
  let html = '<div class="sc sc-lila"><div class="night"></div>';
  html += '<div class="nebula amb" style="--x:-30vmax;--y:-20vmax;--w:80vmax;--c:rgba(124,77,255,.55);--o:.55;--t:52s;--dx:10vw;--dy:6vh"></div>';
  html += '<div class="nebula amb" style="--x:40vw;--y:45vh;--w:70vmax;--c:rgba(255,79,176,.35);--o:.45;--t:44s;--dx:-12vw;--dy:-8vh"></div>';
  html += '<div class="nebula amb" style="--x:55vw;--y:-25vmax;--w:55vmax;--c:rgba(46,201,255,.28);--o:.5;--t:60s;--dx:-6vw;--dy:10vh"></div>';
  html += `<div class="stars" style="box-shadow:${starShadows(Math.round(70 * area), w, h, ['#ffffffaa', '#d9c4ffaa', '#ffffff66'])}"></div>`;
  html += `<div class="stars amb" style="--t:4.5s;box-shadow:${starShadows(Math.round(30 * area), w, h, ['#ffffff', '#cfe9ff', '#e9d8ff'])}"></div>`;
  html += `<div class="stars s2 amb" style="--t:6.5s;box-shadow:${starShadows(Math.round(12 * area), w, h, ['#ffffff', '#9ff0ff', '#ffd9f0'])}"></div>`;
  const cols = ['#fff', '#9FF0FF', '#D19BFF', '#fff'];
  for (let i = 0; i < 10; i++) {
    html += `<i class="spark amb" style="--x:${rnd(3, 95).toFixed(1)}%;--y:${rnd(3, 92).toFixed(1)}%;--s:${rint(8, 15)}px;--t:${rnd(3, 6).toFixed(2)}s;--dl:${(-rnd(0, 5)).toFixed(2)}s;--c:${pick(cols)}"></i>`;
  }
  html += '<div class="tone"></div><div class="moon"></div>';
  html += '<i class="shoot amb" style="--dl:2s"></i><i class="shoot amb" style="--dl:7.5s;left:85%;top:22%"></i>';
  return html + '</div>';
}

let current = null;
export function buildScene(kind) {
  const root = document.getElementById('scene');
  if (!root || current === kind) return;
  current = kind;
  if (kind === 'duo') root.innerHTML = `<div class="sc sc-duo">${lilaScene()}${babyScene()}</div>`;
  else root.innerHTML = kind === 'lila' ? lilaScene() : babyScene();
}
export const sceneKind = () => current;

export const ICONS = { HEART, STAR, BUBBLE };

// Animationen pausieren, wenn der Tab im Hintergrund ist (Akku schonen)
document.addEventListener('visibilitychange', () => {
  document.documentElement.classList.toggle('paused', document.hidden);
});
