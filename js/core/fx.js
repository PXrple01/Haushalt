// Effekte: Partikel auf der Leinwand #fx (Herzen, Sterne, Glitzer, Konfetti, Emojis, Ringe, Speedlines),
// dazu Wackeln, Aufblitzen und Manga-Soundwörter. Alles wird bei „Bewegung reduzieren“ stark gedämpft.
import { motionOK, currentTheme } from './theme.js';
import { rnd, pick } from './util.js';

let canvas, ctx, W = 0, H = 0, DPR = 1;
const parts = [];
let raf = 0;

function ensure() {
  if (canvas) return true;
  canvas = document.getElementById('fx');
  if (!canvas) return false;
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  return true;
}
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

// Formen in Einheitsgröße (Mitte 0,0, Breite ≈ 1)
const SHAPES = {
  heart: new Path2D('M0 .38 L-.07 .31 C-.32 .09 -.48 -.06 -.48 -.25 -.48 -.4 -.36 -.5 -.22 -.5 -.13 -.5 -.05 -.46 0 -.39 .05 -.46 .13 -.5 .22 -.5 .36 -.5 .48 -.4 .48 -.25 .48 -.06 .32 .09 .07 .31 Z'),
  star: new Path2D('M0 -.5 L.118 -.162 L.476 -.155 L.19 .062 L.294 .405 L0 .2 L-.294 .405 L-.19 .062 L-.476 -.155 L-.118 -.162 Z'),
  sparkle: new Path2D('M0 -.5 C.04 -.12 .12 -.04 .5 0 C.12 .04 .04 .12 0 .5 C-.04 .12 -.12 .04 -.5 0 C-.12 -.04 -.04 -.12 0 -.5 Z'),
  rect: new Path2D('M-.5 -.22 H.5 V.22 H-.5 Z'),
  circle: (() => { const p = new Path2D(); p.arc(0, 0, .5, 0, Math.PI * 2); return p; })(),
};

export const PALETTE = {
  baby: { colors: ['#FF7AB8', '#FFB3D9', '#C9B2FF', '#9FDCFF', '#A8F0D0', '#FFE58F', '#FFFFFF'], shapes: ['heart', 'heart', 'sparkle', 'star', 'circle'], emoji: ['🦄', '🌈', '💖', '🎀'] },
  lila: { colors: ['#9B6BFF', '#D19BFF', '#47E5FF', '#FF6FB5', '#FFD36E', '#FFFFFF'], shapes: ['star', 'sparkle', 'rect', 'sparkle'], emoji: ['⭐', '✨', '💜'] },
};
const pal = () => PALETTE[currentTheme()] || PALETTE.baby;

function add(p) {
  if (parts.length > 520) parts.shift();
  parts.push(p);
  if (!raf) raf = requestAnimationFrame(loop);
}

let last = 0;
function loop(t) {
  const dt = Math.min(0.034, last ? (t - last) / 1000 : 0.016);
  last = t;
  ctx.clearRect(0, 0, W, H);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.age += dt;
    if (p.age >= p.ttl) { parts.splice(i, 1); continue; }
    const k = p.age / p.ttl;
    if (p.type === 'ring') {
      const r = p.r0 + (p.r1 - p.r0) * (1 - Math.pow(1 - k, 3));
      ctx.globalAlpha = (1 - k) * p.alpha;
      ctx.strokeStyle = p.color; ctx.lineWidth = p.width * (1 - k * .6);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
      continue;
    }
    if (p.type === 'line') {
      const len = p.len * (k < .3 ? k / .3 : 1);
      ctx.globalAlpha = (k < .5 ? 1 : (1 - k) * 2) * p.alpha;
      ctx.strokeStyle = p.color; ctx.lineWidth = p.width; ctx.lineCap = 'round';
      const d0 = p.r, d1 = p.r - len;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(p.a) * d0, p.y + Math.sin(p.a) * d0);
      ctx.lineTo(p.x + Math.cos(p.a) * d1, p.y + Math.sin(p.a) * d1);
      ctx.stroke();
      continue;
    }
    p.vx += (p.ax || 0) * dt; p.vy += p.g * dt;
    p.vx *= Math.pow(p.drag, dt * 60); p.vy *= Math.pow(p.drag, dt * 60);
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    const fadeIn = Math.min(1, p.age / .08), fadeOut = k > .7 ? (1 - k) / .3 : 1;
    ctx.globalAlpha = Math.max(0, fadeIn * fadeOut * p.alpha);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    let s = p.size * (p.pop ? (k < .15 ? .4 + k / .15 * .6 : 1) : 1);
    if (p.twinkle) s *= .65 + .35 * Math.abs(Math.sin(p.age * 9 + p.seed));
    if (p.emoji) {
      ctx.font = `${Math.round(s)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.emoji, 0, 0);
    } else {
      const flutter = p.flutter ? Math.cos(p.age * p.flutter + p.seed) : 1;
      ctx.scale(s * flutter, s);
      ctx.fillStyle = p.color;
      if (p.glow) { ctx.shadowColor = p.color; ctx.shadowBlur = 12; }
      ctx.fill(SHAPES[p.shape] || SHAPES.circle);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  if (parts.length) raf = requestAnimationFrame(loop);
  else { raf = 0; last = 0; ctx.clearRect(0, 0, W, H); }
}

// Explosion an einer Stelle
export function burst(x, y, o = {}) {
  if (!ensure()) return;
  const P = pal();
  const calm = !motionOK();
  const count = calm ? Math.min(6, o.count ?? 24) : (o.count ?? 24);
  const colors = o.colors || P.colors;
  const shapes = o.shapes || P.shapes;
  const glow = o.glow ?? currentTheme() === 'lila';
  for (let i = 0; i < count; i++) {
    const a = (o.angle ?? -Math.PI / 2) + rnd(-1, 1) * (o.spread ?? Math.PI);
    const sp = rnd(o.speed?.[0] ?? 140, o.speed?.[1] ?? 420) * (calm ? .4 : 1);
    const useEmoji = o.emoji && Math.random() < (o.emojiRate ?? .18);
    add({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      g: o.gravity ?? 520, drag: o.drag ?? .955, ax: 0,
      rot: rnd(0, Math.PI * 2), vr: rnd(-6, 6),
      size: rnd(o.size?.[0] ?? 9, o.size?.[1] ?? 18) * (useEmoji ? 1.7 : 1),
      shape: pick(shapes), color: pick(colors),
      emoji: useEmoji ? pick(Array.isArray(o.emoji) ? o.emoji : P.emoji) : null,
      ttl: rnd(o.ttl?.[0] ?? .7, o.ttl?.[1] ?? 1.3), age: 0,
      alpha: o.alpha ?? 1, twinkle: o.twinkle ?? true, pop: true, glow,
      seed: rnd(0, 6), flutter: 0,
    });
  }
}

// Konfetti-Regen über den ganzen Bildschirm (Sieg)
export function confetti(o = {}) {
  if (!ensure() || !motionOK()) return;
  const P = pal();
  const n = o.count ?? 140;
  for (let i = 0; i < n; i++) {
    const fromSide = i % 2 ? -1 : 1;
    const useEmoji = Math.random() < (o.emojiRate ?? .1);
    add({
      x: fromSide < 0 ? rnd(-20, W * .25) : rnd(W * .75, W + 20), y: rnd(H * .55, H * .9),
      vx: -fromSide * rnd(80, 360), vy: -rnd(520, 980),
      g: 620, drag: .985, ax: 0,
      rot: rnd(0, 6), vr: rnd(-8, 8),
      size: useEmoji ? rnd(22, 32) : rnd(8, 15),
      shape: pick(o.shapes || [...P.shapes, 'rect', 'rect']), color: pick(o.colors || P.colors),
      emoji: useEmoji ? pick(P.emoji) : null,
      ttl: rnd(2.2, 3.4), age: 0, alpha: 1, twinkle: false, pop: false,
      glow: currentTheme() === 'lila', seed: rnd(0, 6), flutter: rnd(6, 12),
    });
  }
}

// Ein paar Partikel als Spur (z. B. hinter fliegenden Herzhälften)
export function trail(x, y, o = {}) {
  if (!ensure() || !motionOK()) return;
  for (let i = 0; i < (o.count ?? 2); i++) {
    add({
      x: x + rnd(-10, 10), y: y + rnd(-10, 10), vx: rnd(-40, 40), vy: rnd(-40, 30),
      g: o.gravity ?? 60, drag: .94, rot: rnd(0, 6), vr: rnd(-3, 3),
      size: rnd(o.size?.[0] ?? 6, o.size?.[1] ?? 12), shape: pick(o.shapes || ['sparkle', 'heart']),
      color: pick(o.colors || ['#fff']), ttl: rnd(.5, .9), age: 0, alpha: .95,
      twinkle: true, pop: true, glow: !!o.glow, seed: rnd(0, 6),
    });
  }
}

// Schockwellen-Ring
export function ring(x, y, o = {}) {
  if (!ensure() || !motionOK()) return;
  add({ type: 'ring', x, y, r0: o.r0 ?? 20, r1: o.r1 ?? 160, width: o.width ?? 6, color: o.color ?? '#fff', alpha: o.alpha ?? .9, ttl: o.ttl ?? .7, age: 0 });
}

// Manga-Speedlines (strahlen zur Mitte)
export function speedlines(x, y, o = {}) {
  if (!ensure() || !motionOK()) return;
  const R = Math.hypot(W, H);
  const n = o.count ?? 42;
  for (let i = 0; i < n; i++) {
    add({
      type: 'line', x, y, a: (i / n) * Math.PI * 2 + rnd(-.05, .05), r: R * .75,
      len: R * rnd(.25, .5), width: rnd(1.5, 4.5), color: o.color ?? '#fff', alpha: rnd(.4, .9), ttl: o.ttl ?? .55, age: 0,
    });
  }
}

// Element wackeln lassen (falsche Eingabe)
export function shake(node, strength = 8) {
  if (!node?.animate || !motionOK()) return;
  const s = strength;
  node.animate(
    [{ transform: 'translateX(0)' }, { transform: `translateX(${-s}px) rotate(-1deg)` }, { transform: `translateX(${s * .8}px) rotate(1deg)` },
      { transform: `translateX(${-s * .5}px)` }, { transform: `translateX(${s * .3}px)` }, { transform: 'translateX(0)' }],
    { duration: 420, easing: 'cubic-bezier(.36,.07,.19,.97)' },
  );
}

// Kurzes Aufblitzen des ganzen Bildschirms
export function flash(color = '#fff', strength = .55) {
  if (!motionOK()) return;
  const d = document.createElement('div');
  d.style.cssText = `position:fixed;inset:0;z-index:61;pointer-events:none;background:${color};opacity:0`;
  document.body.append(d);
  d.animate([{ opacity: 0 }, { opacity: strength, offset: .2 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' }).onfinish = () => d.remove();
}

// Manga-Soundwort / großer Stempel-Text, der kurz aufploppt
export function stamp(text, x, y, o = {}) {
  const d = document.createElement('div');
  d.className = 'fx-stamp ' + (o.cls || '');
  d.textContent = text;
  d.style.left = x + 'px'; d.style.top = y + 'px';
  if (o.color) d.style.color = o.color;
  document.body.append(d);
  const rot = o.rot ?? rnd(-14, 14);
  const a = d.animate(
    motionOK()
      ? [{ transform: `translate(-50%,-50%) scale(2.4) rotate(${rot}deg)`, opacity: 0 },
        { transform: `translate(-50%,-50%) scale(.92) rotate(${rot}deg)`, opacity: 1, offset: .18 },
        { transform: `translate(-50%,-50%) scale(1) rotate(${rot}deg)`, opacity: 1, offset: .7 },
        { transform: `translate(-50%,-60%) scale(1.04) rotate(${rot}deg)`, opacity: 0 }]
      : [{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: 'translate(-50%,-50%)', opacity: 0 }],
    { duration: o.ms ?? 1100, easing: 'cubic-bezier(.22,1,.36,1)' },
  );
  a.onfinish = () => d.remove();
}

// Sieg-Feier je nach Theme
export function celebrate(x = window.innerWidth / 2, y = window.innerHeight / 2.6) {
  const lila = currentTheme() === 'lila';
  confetti();
  burst(x, y, { count: 46, speed: [220, 620], emoji: !lila, emojiRate: .14, size: [10, 20] });
  ring(x, y, { color: lila ? '#47E5FF' : '#FFFFFF', r1: 220, width: 8 });
  if (lila) { speedlines(x, y, { color: '#D19BFF' }); stamp('ドン!!', x, y - 10, { cls: 'manga' }); }
}
