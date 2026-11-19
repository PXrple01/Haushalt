// „Wer spielt?“ – das Puzzle-Herz. Hälften fliegen herein, rasten ein, Herzschlag, teilen sich in zwei Knöpfe.
// Auswahl: die andere Hälfte fällt weg, die App öffnet sich kreisförmig aus dem Herz ins Theme der Person.
import { h, centerOf, done } from '../core/dom.js';
import { HEART, heartDefs, halfJos, halfJoh, logo } from '../art/heart.js';
import { buildScene } from '../core/scene.js';
import { me } from '../core/store.js';
import { themeOf, setTheme, motionOK } from '../core/theme.js';
import { burst, ring, trail, flash } from '../core/fx.js';
import { sfx, haptic } from '../core/sound.js';
import { nav } from '../core/router.js';
import { announce } from '../core/ui.js';

const SPLIT = { jos: 'translate(-12px, 0px) rotate(-4deg)', joh: 'translate(12px, 0px) rotate(4deg)' };

export function mount(root) {
  buildScene('duo');
  const s = h('section', { class: 'screen wer', 'aria-labelledby': 'wer-title' });
  const title = 'Wer spielt?';
  s.innerHTML = `
    <div class="wer-logo">${logo()}</div>
    <h1 class="wer-title" id="wer-title" aria-label="${title}">${[...title].map((c) => (c === ' ' ? '<span class="ch sp" aria-hidden="true"> </span>' : `<span class="ch" aria-hidden="true">${c}</span>`)).join('')}</h1>
    <div class="wer-stage">
      <div class="wer-glow"></div>
      <svg class="wer-heart" viewBox="${HEART.view}" aria-hidden="false">
        ${heartDefs('w')}
        <g class="half jos" role="button" tabindex="0" aria-label="Josefine spielt" data-p="jos">${halfJos('w')}</g>
        <g class="half joh" role="button" tabindex="0" aria-label="Johann spielt" data-p="joh">${halfJoh('w')}</g>
        <path class="seam" d="${HEART.seam}" pathLength="1"/>
      </svg>
    </div>
    <div class="wer-names">
      <button class="wer-name jos" type="button" data-p="jos"><span>Josefine</span></button>
      <button class="wer-name joh" type="button" data-p="joh"><span>Johann</span></button>
    </div>
    <p class="wer-hint">Tippe auf deine Hälfte</p>`;
  root.append(s);

  const svg = s.querySelector('.wer-heart');
  const hj = s.querySelector('.half.jos');
  const hv = s.querySelector('.half.joh');
  const seam = s.querySelector('.seam');
  const glow = s.querySelector('.wer-glow');
  const chars = [...s.querySelectorAll('.wer-title .ch')];
  const names = [...s.querySelectorAll('.wer-name span')];
  const hint = s.querySelector('.wer-hint');

  const anims = [];
  const timers = [];
  let idle = [];
  let picking = false;
  let introDone = false;
  const A = (node, kf, o) => { const a = node.animate(kf, { fill: 'both', ...o }); anims.push(a); return a; };
  const T = (fn, ms) => timers.push(setTimeout(fn, ms));

  function startIdle() {
    if (!motionOK()) return;
    idle = [
      hj.animate([{ transform: `${SPLIT.jos} translateY(-3px)` }, { transform: `${SPLIT.jos} translateY(3px)` }], { duration: 2600, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' }),
      hv.animate([{ transform: `${SPLIT.joh} translateY(3px)` }, { transform: `${SPLIT.joh} translateY(-3px)` }], { duration: 2600, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' }),
      glow.animate([{ opacity: .3, transform: 'scale(.96)' }, { opacity: .5, transform: 'scale(1.04)' }], { duration: 2600, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' }),
    ];
  }

  function finishIntro() {
    if (introDone) return;
    introDone = true;
    timers.forEach(clearTimeout);
    anims.forEach((a) => { try { a.finish(); } catch { /* schon fertig */ } });
    hj.style.transform = SPLIT.jos; hv.style.transform = SPLIT.joh;
    startIdle();
  }

  // ---------- Intro ----------
  if (!motionOK()) {
    hj.style.transform = SPLIT.jos; hv.style.transform = SPLIT.joh;
    hint.style.opacity = 1;
    introDone = true;
  } else {
    const flyIn = 900, snapAt = 1080;
    A(hj, [
      { transform: 'translate(-430px, -60px) rotate(-38deg) scale(.55)', opacity: 0 },
      { opacity: 1, offset: .15 },
      { transform: 'translate(-30px, 0px) rotate(-7deg) scale(1)', opacity: 1 },
    ], { duration: flyIn, easing: 'cubic-bezier(.16,1,.3,1)' });
    A(hv, [
      { transform: 'translate(430px, -60px) rotate(38deg) scale(.55)', opacity: 0 },
      { opacity: 1, offset: .15 },
      { transform: 'translate(30px, 0px) rotate(7deg) scale(1)', opacity: 1 },
    ], { duration: flyIn, easing: 'cubic-bezier(.16,1,.3,1)' });
    // Einrasten
    A(hj, [{ transform: 'translate(-30px, 0px) rotate(-7deg)' }, { transform: 'translate(0px, 0px) rotate(0deg)' }], { delay: flyIn, duration: snapAt - flyIn, easing: 'cubic-bezier(.55,0,.85,.25)', fill: 'forwards' });
    A(hv, [{ transform: 'translate(30px, 0px) rotate(7deg)' }, { transform: 'translate(0px, 0px) rotate(0deg)' }], { delay: flyIn, duration: snapAt - flyIn, easing: 'cubic-bezier(.55,0,.85,.25)', fill: 'forwards' });

    // Glitzerspur während des Flugs
    const t0 = performance.now();
    const trailTick = () => {
      if (introDone || performance.now() - t0 > snapAt) return;
      const a = centerOf(hj), b = centerOf(hv);
      trail(a.x - 20, a.y, { count: 2, colors: ['#FFFFFF', '#FFB3D9', '#FF7AB8'], shapes: ['heart', 'sparkle'] });
      trail(b.x + 20, b.y, { count: 2, colors: ['#FFFFFF', '#47E5FF', '#D19BFF'], shapes: ['star', 'sparkle'], glow: true });
      requestAnimationFrame(trailTick);
    };
    requestAnimationFrame(trailTick);

    // Klick! Naht leuchtet, Ring, Partikel, Herz federt
    T(() => {
      const c = centerOf(svg);
      sfx.click(); sfx.sparkle(); haptic([12, 40, 18]);
      flash('#ffffff', .35);
      ring(c.x, c.y, { color: '#ffffff', r0: 40, r1: Math.max(220, c.r.width), width: 8 });
      ring(c.x, c.y, { color: '#FF8CC6', r0: 30, r1: 170, width: 4, ttl: .9 });
      burst(c.x - 30, c.y, { count: 26, colors: ['#FF7AB8', '#FFB3D9', '#FFFFFF', '#FFE58F'], shapes: ['heart', 'heart', 'sparkle'], speed: [200, 520], angle: Math.PI, spread: 1.6 });
      burst(c.x + 30, c.y, { count: 26, colors: ['#8B5CFF', '#D19BFF', '#47E5FF', '#FFFFFF'], shapes: ['star', 'sparkle'], speed: [200, 520], angle: 0, spread: 1.6, glow: true });
      A(seam, [{ opacity: 0, strokeDasharray: '0 1' }, { opacity: 1, strokeDasharray: '1 0', offset: .45 }, { opacity: 0, strokeDasharray: '1 0' }], { duration: 650, easing: 'ease-out' });
      A(svg, [{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: .3 }, { transform: 'scale(.97)', offset: .65 }, { transform: 'scale(1)' }], { duration: 520, easing: 'ease-out' });
      A(glow, [{ opacity: 0 }, { opacity: 1, offset: .25 }, { opacity: .35 }], { duration: 900 });
    }, snapAt);

    // Herzschlag (lub-dub)
    T(() => {
      sfx.heart();
      A(svg, [
        { transform: 'scale(1)' }, { transform: 'scale(1.07)', offset: .14 }, { transform: 'scale(1)', offset: .3 },
        { transform: 'scale(1.045)', offset: .44 }, { transform: 'scale(1)', offset: .62 }, { transform: 'scale(1)' },
      ], { duration: 900, easing: 'ease-in-out' });
    }, snapAt + 520);

    // Titel: Buchstaben fallen herein
    chars.forEach((ch, i) => A(ch, [
      { transform: `translateY(-34px) rotate(${(i % 2 ? 1 : -1) * 18}deg) scale(.6)`, opacity: 0 },
      { transform: 'translateY(0) rotate(0) scale(1)', opacity: 1 },
    ], { delay: 1300 + i * 45, duration: 620, easing: 'cubic-bezier(.34,1.56,.64,1)' }));

    // Teilen in zwei Knöpfe
    A(hj, [{ transform: 'translate(0px, 0px) rotate(0deg)' }, { transform: SPLIT.jos }], { delay: 2150, duration: 520, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'forwards' });
    A(hv, [{ transform: 'translate(0px, 0px) rotate(0deg)' }, { transform: SPLIT.joh }], { delay: 2150, duration: 520, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'forwards' });
    names.forEach((n, i) => A(n, [{ transform: 'translateY(16px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { delay: 2280 + i * 120, duration: 520, easing: 'cubic-bezier(.34,1.56,.64,1)' }));
    A(hint, [{ opacity: 0 }, { opacity: 1 }], { delay: 2800, duration: 500 });
    T(() => { introDone = true; hj.style.transform = SPLIT.jos; hv.style.transform = SPLIT.joh; startIdle(); }, 2700);

    // Antippen überspringt das Intro
    s.addEventListener('pointerdown', () => { if (!introDone) finishIntro(); });
  }

  // ---------- Auswahl ----------
  async function choose(p) {
    if (picking) return;
    if (!introDone) { finishIntro(); }
    picking = true;
    idle.forEach((a) => a.cancel());
    const mine = p === 'jos' ? hj : hv;
    const other = p === 'jos' ? hv : hj;
    const c = centerOf(mine);
    sfx.pop(); haptic(20);
    announce(`${p === 'jos' ? 'Josefine' : 'Johann'} spielt.`);
    s.classList.add('picked');
    me.set(p);
    const theme = themeOf(p);

    if (motionOK()) {
      const sign = p === 'jos' ? -1 : 1;
      mine.animate([{ transform: SPLIT[p] }, { transform: `translate(${-sign * 8}px, -6px) rotate(0deg) scale(1.14)` }], { duration: 480, fill: 'forwards', easing: 'cubic-bezier(.34,1.56,.64,1)' });
      other.animate([{ transform: SPLIT[p === 'jos' ? 'joh' : 'jos'], opacity: 1 }, { transform: `translate(${-sign * 70}px, 280px) rotate(${-sign * 55}deg) scale(.8)`, opacity: 0 }], { duration: 640, fill: 'forwards', easing: 'cubic-bezier(.55,0,.85,.35)' });
      s.querySelectorAll('.wer-name').forEach((b) => {
        b.animate(b.dataset.p === p
          ? [{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }]
          : [{ opacity: 1 }, { opacity: 0, transform: 'translateY(14px)' }], { duration: 420, fill: 'forwards', easing: 'ease-out' });
      });
      burst(c.x, c.y, p === 'jos'
        ? { count: 34, colors: ['#FF7AB8', '#FFB3D9', '#FFFFFF', '#C9B2FF', '#FFE58F'], shapes: ['heart', 'sparkle', 'heart'], emoji: ['🦄', '🌈', '🎀'], emojiRate: .2, speed: [220, 560] }
        : { count: 34, colors: ['#8B5CFF', '#D19BFF', '#47E5FF', '#FFFFFF', '#FFD36E'], shapes: ['star', 'sparkle'], glow: true, speed: [220, 560] });
      ring(c.x, c.y, { color: p === 'jos' ? '#FF8CC6' : '#47E5FF', r1: 200 });
      sfx.sparkle();
      await new Promise((r) => setTimeout(r, 470));
    }

    // Kreis-Übergang: die Lobby öffnet sich aus dem Herz
    const root = document.documentElement;
    if (document.startViewTransition && motionOK()) {
      root.classList.add('vt-theme');
      try {
        const t = document.startViewTransition(async () => { setTheme(theme); await nav('#/lobby', { vt: false }); });
        await t.ready;
        const r = Math.hypot(Math.max(c.x, innerWidth - c.x), Math.max(c.y, innerHeight - c.y));
        await done(root.animate({ clipPath: [`circle(0px at ${c.x}px ${c.y}px)`, `circle(${r}px at ${c.x}px ${c.y}px)`] },
          { duration: 820, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' }));
        await t.finished.catch(() => {});
      } finally {
        root.classList.remove('vt-theme');
      }
    } else {
      setTheme(theme);
      nav('#/lobby', { vt: false });
    }
  }

  s.addEventListener('click', (e) => {
    const t = e.target.closest('[data-p]');
    if (t) choose(t.dataset.p);
  });
  s.addEventListener('keydown', (e) => {
    const t = e.target.closest('.half[data-p]');
    if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); choose(t.dataset.p); }
  });

  return () => {
    timers.forEach(clearTimeout);
    anims.forEach((a) => a.cancel());
    idle.forEach((a) => a.cancel());
  };
}
