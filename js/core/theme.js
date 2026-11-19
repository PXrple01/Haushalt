// Theme (Baby/Lila) und „Bewegung reduzieren“ anwenden – mit kreisförmigem Übergang beim Wechsel.
import { prefs, me, on, emit } from './store.js';
import { buildScene } from './scene.js';

const root = document.documentElement;
const mq = window.matchMedia('(prefers-reduced-motion: reduce)');

export const currentTheme = () => root.dataset.theme || 'baby';
export const themeOf = (p) => prefs.get('themeFor')[p] || (p === 'joh' ? 'lila' : 'baby');

export function motionOK() {
  return root.dataset.motion !== 'reduced';
}

export function applyMotion() {
  const m = prefs.get('motion');
  root.dataset.motion = m === 'reduced' || (m === 'auto' && mq.matches) ? 'reduced' : 'full';
}
mq.addEventListener?.('change', applyMotion);

function setMeta(theme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'lila' ? '#160B33' : '#FFE4F2');
}

// Theme sofort setzen (ohne Übergang)
export function setTheme(theme) {
  const changed = root.dataset.theme !== theme;
  root.dataset.theme = theme;
  setMeta(theme);
  buildScene(theme);
  if (changed) emit('theme', theme);
}

// Theme mit kreisförmigem Übergang ab Punkt (x, y) wechseln
export async function switchTheme(theme, origin) {
  if (theme === currentTheme() && !origin?.force) { buildScene(theme); return; }
  const swap = () => setTheme(theme);
  if (!document.startViewTransition || !motionOK()) { swap(); return; }
  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight / 2;
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  root.classList.add('vt-theme');
  try {
    const t = document.startViewTransition(swap);
    await t.ready;
    const anim = root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 760, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' },
    );
    await anim.finished.catch(() => {});
    await t.finished.catch(() => {});
  } catch {
    swap();
  } finally {
    root.classList.remove('vt-theme');
  }
}

// Theme der Person an diesem Gerät
export function themeForMe() {
  const p = me.get();
  return p ? themeOf(p) : 'baby';
}

on('prefs', ({ k }) => { if (k === 'motion') applyMotion(); });
