// Gemeinsame Oberfläche für Rundenspiele (Pantomime, Kritzelspiel): Einstellungen, Punkte-Leiste, Ring-Timer,
// 3-2-1-Countdown, Vorhang-/Blätter-Übergang, Rundenergebnis mit fliegenden Sternen.
import { h, esc, centerOf } from '../core/dom.js';
import { icon } from '../art/icons.js';
import { miniHalf } from '../art/heart.js';
import { me } from '../core/store.js';
import { nameOf, other, sleep } from '../core/util.js';
import { segmented } from '../core/ui.js';
import { motionOK, currentTheme } from '../core/theme.js';
import { burst, ring, confetti } from '../core/fx.js';
import { sfx, haptic } from '../core/sound.js';
import { nav } from '../core/router.js';
import { createSession } from '../core/sync.js';
import { termCats } from '../data/terms.js';
import { shell, whoSeg, resolveWho, partnerNote } from './common.js';

// ---------- Einstellungen ----------
export function roundsSetup({ root, game, rules, hero, intro }) {
  const p = me.get();
  const { body, mode, cleanup } = shell({ root, game, rules });
  const conf = { first: p, n: 3, dur: game === 'draw' ? 90 : 60, cats: ['all'], level: 'mittel' };
  body.innerHTML = `
    <div class="setup stack">
      <div class="r-hero">${hero || ''}</div>
      <p class="lead measure">${intro}</p>
      <section class="setup-sec stack"><h2 class="setup-h">Wer fängt an?</h2><div data-slot="first"></div></section>
      <section class="setup-sec stack"><h2 class="setup-h">Runden pro Person</h2><div data-slot="n"></div></section>
      <section class="setup-sec stack"><h2 class="setup-h">Zeit pro Begriff</h2><div data-slot="dur"></div></section>
      <section class="setup-sec stack"><h2 class="setup-h">Kategorien</h2><div class="chips" data-slot="cats" role="group" aria-label="Kategorien"></div></section>
      <section class="setup-sec stack"><h2 class="setup-h">Schwierigkeit</h2><div data-slot="level"></div></section>
      ${partnerNote(mode)}
      <button class="btn primary big block" type="button" data-a="start">${icon('sparkle')}<span>Los geht’s</span></button>
    </div>`;
  const $ = (s) => body.querySelector(s);
  $('[data-slot="first"]').append(whoSeg({ label: 'Wer fängt an?', value: conf.first, random: true, onChange: (v) => { conf.first = v; } }));
  $('[data-slot="n"]').append(segmented({ label: 'Runden pro Person', value: 3, options: [3, 5, 7].map((n) => ({ value: n, label: String(n) })), onChange: (v) => { conf.n = v; } }));
  $('[data-slot="dur"]').append(segmented({ label: 'Zeit pro Begriff', value: conf.dur, options: [60, 90, 120].map((n) => ({ value: n, label: `${n} s` })), onChange: (v) => { conf.dur = v; } }));
  $('[data-slot="level"]').append(segmented({ label: 'Schwierigkeit', value: 'mittel', options: [{ value: 'leicht', label: 'Leicht' }, { value: 'mittel', label: 'Mittel' }, { value: 'schwer', label: 'Schwer' }, { value: 'alle', label: 'Bunt' }], onChange: (v) => { conf.level = v; } }));
  const catsEl = $('[data-slot="cats"]');
  catsEl.innerHTML = termCats(game).map((c) => `<button class="chip" type="button" data-cat="${c.id}" aria-pressed="${c.id === 'all'}">${esc(c.label)}</button>`).join('');
  catsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    const id = b.dataset.cat;
    if (id === 'all') conf.cats = ['all'];
    else {
      const set = new Set(conf.cats.filter((c) => c !== 'all'));
      set.has(id) ? set.delete(id) : set.add(id);
      conf.cats = set.size ? [...set] : ['all'];
    }
    catsEl.querySelectorAll('[data-cat]').forEach((c) => c.setAttribute('aria-pressed', String(conf.cats.includes(c.dataset.cat))));
    sfx.tap();
  });
  $('[data-a="start"]').addEventListener('click', () => {
    sfx.pop(); haptic(12);
    const id = createSession(game, mode, { ...conf, first: resolveWho(conf.first) });
    nav('#/spiel/' + id, { replace: true });
  });
  return { cleanup, mode };
}

// ---------- Punkte-Leiste ----------
export function scoreBar() {
  const el = h('div', { class: 'scorebar', role: 'status', 'aria-live': 'polite' });
  el.innerHTML = ['jos', 'joh'].map((q) => `<div class="sb ${q}" data-p="${q}"><span class="sb-half">${miniHalf(q)}</span><span class="sb-name">${esc(nameOf(q))}</span><b class="sb-pts tnum">0</b></div>`).join('<div class="sb-mid"></div>');
  const shown = { jos: 0, joh: 0 };
  el.set = (st, { animate = true } = {}) => {
    el.querySelector('.sb-mid').textContent = st.phase === 'end' ? 'Ende' : `Runde ${Math.min(st.r + 1, st.total)} von ${st.total}`;
    const actor = st.phase === 'play' ? (st.r % 2 === 0 ? st.first : other(st.first)) : null;
    for (const q of ['jos', 'joh']) {
      const chip = el.querySelector(`.sb.${q}`);
      chip.classList.toggle('active', q === actor);
      const b = chip.querySelector('.sb-pts');
      const to = st.score[q];
      if (to === shown[q]) { b.textContent = to; continue; }
      if (!animate || !motionOK()) { b.textContent = to; shown[q] = to; continue; }
      const from = shown[q];
      shown[q] = to;
      const t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / 600);
        b.textContent = Math.round(from + (to - from) * k);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      chip.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 520, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    }
  };
  return el;
}

// ---------- Ring-Timer ----------
export function ringTimer() {
  const el = h('div', { class: 'rtimer', role: 'timer', 'aria-live': 'off' });
  el.innerHTML = `<svg viewBox="0 0 200 200" aria-hidden="true">
      <circle class="rt-track" cx="100" cy="100" r="86"/>
      <circle class="rt-bar" cx="100" cy="100" r="86" pathLength="1" transform="rotate(-90 100 100)"/>
    </svg>
    <div class="rt-mid"><span class="rt-num tnum">0</span><span class="rt-lbl">Sekunden</span></div>`;
  const bar = el.querySelector('.rt-bar');
  const num = el.querySelector('.rt-num');
  let raf = 0, endAt = 0, total = 1, onEnd = null, lastSec = -1, running = false;
  function frame() {
    const left = Math.max(0, endAt - Date.now());
    bar.style.strokeDashoffset = String(1 - left / total);
    const sec = Math.ceil(left / 1000);
    if (sec !== lastSec) {
      lastSec = sec;
      num.textContent = sec;
      el.setAttribute('aria-label', `Noch ${sec} Sekunden`);
      if (sec <= 10 && sec > 0) {
        sfx.tick?.();
        if (motionOK()) num.animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      }
    }
    el.classList.toggle('low', sec <= 10);
    if (left <= 0) { running = false; onEnd?.(); return; }
    raf = requestAnimationFrame(frame);
  }
  el.start = (startT, durMs, cb) => { cancelAnimationFrame(raf); total = durMs; endAt = startT + durMs; onEnd = cb; running = true; lastSec = -1; frame(); };
  el.stop = () => { cancelAnimationFrame(raf); running = false; };
  el.isRunning = () => running;
  return el;
}

// ---------- 3-2-1 ----------
export function countdown() {
  return new Promise((resolve) => {
    if (!motionOK()) { resolve(); return; }
    const ov = h('div', { class: 'cd-ov', 'aria-hidden': 'true' });
    document.body.append(ov);
    const steps = ['3', '2', '1', 'Los!'];
    steps.forEach((s, i) => setTimeout(() => {
      ov.innerHTML = `<span class="cd-n${i === 3 ? ' go' : ''}">${s}</span>`;
      const n = ov.firstElementChild;
      n.animate([{ transform: 'scale(2.6)', opacity: 0, filter: 'blur(8px)' }, { transform: 'scale(1)', opacity: 1, filter: 'blur(0)', offset: .35 }, { transform: 'scale(.9)', opacity: 1, offset: .8 }, { transform: 'scale(.6)', opacity: 0 }], { duration: 700, easing: 'cubic-bezier(.22,1,.36,1)' });
      ring(innerWidth / 2, innerHeight / 2, { color: currentTheme() === 'lila' ? '#47E5FF' : '#FF8CC6', r0: 40, r1: 190, width: 6, ttl: .6 });
      if (i === 3) { sfx.good(); haptic(25); burst(innerWidth / 2, innerHeight / 2, { count: 24, speed: [200, 480] }); } else { sfx.click(); haptic(8); }
    }, i * 700));
    setTimeout(() => { ov.remove(); resolve(); }, steps.length * 700);
  });
}

// ---------- Übergang: Vorhang (Pantomime) oder Seite blättern (Kritzelspiel) ----------
export async function transition(kind, swap, { title, sub }) {
  if (!motionOK()) { swap(); return; }
  const ov = h('div', { class: `rt-ov ${kind}`, 'aria-hidden': 'true' });
  ov.innerHTML = kind === 'curtain'
    ? `<div class="ct ct-l"></div><div class="ct ct-r"></div><div class="ct-plaque"><b>${esc(title)}</b><small>${esc(sub)}</small></div>`
    : `<div class="pg"><div class="pg-face"><b>${esc(title)}</b><small>${esc(sub)}</small></div></div>`;
  document.body.append(ov);
  if (kind === 'curtain') {
    const [l, r, pl] = ov.children;
    const close = { duration: 620, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' };
    l.animate([{ transform: 'translateX(-102%)' }, { transform: 'translateX(0)' }], close);
    r.animate([{ transform: 'translateX(102%)' }, { transform: 'translateX(0)' }], close);
    sfx.whoosh();
    await sleep(560);
    pl.animate([{ transform: 'translate(-50%, -160%) rotate(-6deg)' }, { transform: 'translate(-50%, -50%) rotate(3deg)', offset: .7 }, { transform: 'translate(-50%, -50%) rotate(0)' }], { duration: 560, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'forwards' });
    swap();
    await sleep(1250);
    pl.animate([{ transform: 'translate(-50%, -50%)' }, { transform: 'translate(-50%, -170%)' }], { duration: 360, easing: 'ease-in', fill: 'forwards' });
    const open = { duration: 760, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' };
    l.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-102%) scaleX(.9)' }], open);
    r.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(102%) scaleX(.9)' }], open);
    await sleep(760);
  } else {
    const pg = ov.firstElementChild;
    pg.animate([{ transform: 'rotateY(-100deg)', opacity: .4 }, { transform: 'rotateY(0)', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' });
    sfx.flip();
    await sleep(520);
    swap();
    await sleep(1000);
    pg.animate([{ transform: 'rotateY(0)' }, { transform: 'rotateY(105deg)', opacity: .2 }], { duration: 560, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
    sfx.flip();
    await sleep(560);
  }
  ov.remove();
}

// ---------- Rundenergebnis ----------
export function roundResultCard({ R, actor, dur, stage }) {
  const el = h('div', { class: `rres ${R.got ? 'got' : 'miss'}` });
  const stars = R.got ? R.pts[actor] : 0;
  el.innerHTML = R.got
    ? `<p class="rres-kick">${esc(nameOf(other(actor)))} hat es erraten!</p>
       <h2 class="rres-title">${esc(R.term)}</h2>
       <p class="rres-time">in ${Math.max(1, Math.round(R.ms / 1000))} von ${dur} Sekunden</p>
       <div class="rres-stars" aria-label="${stars} Sterne">${[1, 2, 3].map((i) => `<span class="rs${i <= stars ? ' on' : ''}">${icon('star', 'fill')}</span>`).join('')}</div>
       <p class="rres-pts">+${stars} für ${esc(nameOf(actor))}, +1 für ${esc(nameOf(other(actor)))}</p>`
    : `<p class="rres-kick">Zeit um!</p>
       <h2 class="rres-title">${esc(R.term)}</h2>
       <p class="rres-time">Diesmal leider nicht – keine Punkte.</p>`;
  if (stage) el.dataset.stage = stage;
  return el;
}

// Sterne fliegen vom Ergebnis zur Punkte-Leiste
export function flyStars(fromEl, toEl, count) {
  if (!motionOK() || !fromEl || !toEl) return;
  const stars = [...fromEl.querySelectorAll('.rs.on')].slice(0, count);
  const to = centerOf(toEl);
  stars.forEach((s, i) => {
    const c = centerOf(s);
    const f = h('div', { class: 'fly-star', 'aria-hidden': 'true' });
    f.innerHTML = icon('star', 'fill');
    f.style.left = c.x + 'px'; f.style.top = c.y + 'px';
    document.body.append(f);
    const dx = to.x - c.x, dy = to.y - c.y;
    f.animate([
      { transform: 'translate(-50%,-50%) scale(1)' },
      { transform: `translate(calc(-50% + ${dx * .45}px), calc(-50% + ${dy * .45 - 70}px)) scale(1.4) rotate(160deg)`, offset: .5 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.5) rotate(360deg)`, opacity: .9 },
    ], { duration: 900, delay: 600 + i * 140, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'both' }).onfinish = () => {
      f.remove();
      burst(to.x, to.y, { count: 6, speed: [60, 160], size: [4, 8], gravity: 200 });
      sfx.sparkle();
    };
  });
}

// Große Feier am Ende
export function bigCelebrate() {
  confetti();
  sfx.win();
  haptic([30, 50, 30, 50, 80]);
}

