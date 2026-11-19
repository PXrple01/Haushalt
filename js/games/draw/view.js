// Kritzelspiel – Oberfläche: Begriff, Zeichenfläche mit Werkzeugen, Live-Striche (Weit weg), Raten, Zeitraffer, Kunstbuch.
import { h, esc, centerOf } from '../../core/dom.js';
import { icon } from '../../art/icons.js';
import { me, on, get, set } from '../../core/store.js';
import { nameOf, other } from '../../core/util.js';
import { handoff, confirmBox, announce, toast, sheet } from '../../core/ui.js';
import { motionOK } from '../../core/theme.js';
import { burst, shake } from '../../core/fx.js';
import { sfx, haptic } from '../../core/sound.js';
import { nav } from '../../core/router.js';
import { createSession, addEvent, getSession, sendFx } from '../../core/sync.js';
import { reduce } from './logic.js';
import { actorOf } from '../rounds.js';
import { enc } from '../secret.js';
import { pickTerm } from '../../data/terms.js';
import { shell, resultCard, finale, markCelebrated, peekButton, waitCard } from '../common.js';
import { roundsSetup, scoreBar, ringTimer, countdown, transition, roundResultCard, flyStars } from '../rounds-ui.js';
import { sketchCanvas, INKS, SIZES, thumb } from './canvas.js';

const RULES = [
  'Abwechselnd kritzelt einer einen Begriff, der andere rät.',
  'Keine Buchstaben oder Zahlen malen – nur Bilder!',
  'Nebeneinander rätst du laut, wer kritzelt tippt auf „Erraten!“. Weit weg tippst du deine Tipps ein und siehst die Striche live.',
  'Je schneller erraten, desto mehr Sterne: 3, 2 oder 1. Wer rät, bekommt 1 Stern. Weit weg gibt es mit der Zeit Buchstaben-Tipps.',
  'Alle Zeichnungen landen im Kunstbuch.',
];
const HERO = `<div class="sk-hero" aria-hidden="true">
  <div class="skh-rings"></div>
  <svg viewBox="0 0 300 140">
    <path class="skh-a" pathLength="1" d="M70 72 C52 50 74 30 92 50 C108 30 132 50 112 72 L92 94 Z"/>
    <path class="skh-b" pathLength="1" d="M160 92 c10 -26 34 -40 58 -26 c18 10 14 34 -6 36 c-16 2 -20 -16 -6 -20"/>
    <path class="skh-c" pathLength="1" d="M236 44 l6 -16 6 16 16 6 -16 6 -6 16 -6 -16 -16 -6 z"/>
    <path class="skh-d" pathLength="1" d="M40 118 q30 -14 60 0 t60 0 t60 0 t60 0"/>
  </svg>
  <div class="skh-title">Kritzelspiel</div>
</div>`;

// ---------- Kunstbuch (lokal) ----------
const BOOK = 'kunstbuch';
function saveArt(entry) {
  const list = get(BOOK, []) || [];
  if (list.some((x) => x.id === entry.id) || !entry.strokes?.length) return;
  list.push(entry);
  while (list.length > 36) list.shift();
  try { set(BOOK, list); } catch { /* Speicher voll */ }
}
export function openArtbook() {
  const list = (get(BOOK, []) || []).slice().reverse();
  const body = h('div', { class: 'artbook' });
  if (!list.length) body.innerHTML = '<p class="soft center">Noch leer – eure Kritzeleien landen hier.</p>';
  for (const a of list) {
    const b = h('button', { class: 'art', type: 'button' });
    b.append(thumb(a.strokes, 104));
    b.insertAdjacentHTML('beforeend', `<span class="art-t">${esc(a.term)}</span><span class="art-by">${esc(nameOf(a.by))}</span>`);
    b.addEventListener('click', () => showArt(a));
    body.append(b);
  }
  sheet({ title: 'Kunstbuch', body });
}
function showArt(a) {
  const box = h('div', { class: 'stack' });
  const c = sketchCanvas();
  box.append(c);
  box.insertAdjacentHTML('beforeend', `<p class="center"><b>${esc(a.term)}</b> – gekritzelt von ${esc(nameOf(a.by))}</p>`);
  const rp = h('button', { class: 'btn block', type: 'button' });
  rp.innerHTML = `${icon('refresh')}<span>Zeitraffer</span>`;
  rp.addEventListener('click', () => c.replay(a.strokes, 3600));
  box.append(rp);
  sheet({ title: a.term, body: box });
  setTimeout(() => c.replay(a.strokes, 3600), 450);
}

export function setup(root) {
  const { cleanup } = roundsSetup({
    root, game: 'draw', rules: RULES, hero: HERO,
    intro: 'Einer kritzelt, der andere rät. Keine Buchstaben malen – nur Bilder!',
  });
  const btn = h('button', { class: 'btn block', type: 'button' });
  btn.innerHTML = `${icon('palette')}<span>Kunstbuch ansehen</span>`;
  btn.addEventListener('click', openArtbook);
  root.querySelector('.setup')?.append(btn);
  return cleanup;
}

// Lange Striche in Stücke teilen (jedes Ereignis bleibt klein)
function chunks(stroke) {
  const out = [];
  const p = stroke.p;
  const max = 560;
  if (p.length <= max) return [stroke];
  for (let i = 0; i < p.length; i += max - 2) out.push({ ...stroke, p: p.slice(i, i + max) });
  return out.filter((x) => x.p.length >= 2);
}

export function play(root, sid) {
  const p = me.get();
  const { body, mode, cleanup: shellOff } = shell({ root, game: 'draw', sid, rules: RULES });
  const remote = mode === 'remote';
  const compute = () => { const s = getSession(sid); return reduce(s.meta, s.evs); };
  let st = compute();
  const sb = scoreBar();
  const main = h('div', { class: 'r-main' });
  body.append(sb, main);
  sb.set(st, { animate: false });

  let view = '';
  let handed = -1;
  let pendingResult = null;
  let busy = false;
  let timer = null, canvas = null, hintT = 0, backupT = 0;
  const offs = [];
  let alive = true; // nach dem Verlassen keine Übergaben/Ereignisse mehr aus wartendem Code
  const iAct = (r = st.r) => !remote || actorOf(st, r) === p;

  function setView(v, node) {
    view = v;
    timer?.stop?.();
    canvas?.destroy?.();
    canvas = null;
    clearInterval(hintT);
    clearTimeout(backupT);
    main.replaceChildren(node);
  }

  function newTerm() {
    const used = st.rounds.map((x) => x?.term).filter(Boolean);
    const t = pickTerm('draw', st.cats, st.level, used);
    addEvent(sid, 'term', { r: st.r, w: enc(t.text, sid), cat: t.catLabel });
  }

  // ---------- Begriff ----------
  function renderPick() {
    const R = st.rounds[st.r];
    if (!R) { newTerm(); return; }
    const box = h('div', { class: 'pick stack' });
    box.innerHTML = `
      <p class="pick-kick">${remote ? 'Das kritzelst du' : `${esc(nameOf(actorOf(st, st.r)))}, das kritzelst du`}</p>
      <div class="term-card sketchy"><span class="tc-cat">${esc(R.cat)}</span><span class="tc-text">${esc(R.term)}</span></div>
      <div class="row center"><button class="btn small" type="button" data-a="reroll" ${R.rerolls >= 3 ? 'disabled' : ''}>${icon('refresh')}<span>Anderer Begriff${R.rerolls < 3 ? ` (${3 - R.rerolls})` : ''}</span></button></div>
      <p class="soft center small">Keine Buchstaben malen! Gleich läuft die Zeit.</p>
      <button class="btn primary big block" type="button" data-a="go">${icon('pencil')}<span>Los kritzeln!</span></button>`;
    setView('pick', box);
    const card = box.querySelector('.term-card');
    if (motionOK()) card.animate([{ transform: 'perspective(700px) rotateX(-90deg)', opacity: 0 }, { transform: 'perspective(700px) rotateX(8deg)', opacity: 1, offset: .7 }, { transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.22,1,.36,1)' });
    sfx.flip();
    box.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'reroll') newTerm();
      else if (a === 'go') {
        busy = true;
        main.replaceChildren();
        await countdown();
        busy = false;
        if (!alive) return;
        addEvent(sid, 'go', { r: st.r });
      }
    });
  }

  // Buchstaben-Tipp: „_ _ A _ _“, mit der Zeit mehr aufgedeckt
  function blanks(term, frac) {
    const letters = [...term].map((c, i) => ({ c, i })).filter((x) => /[\p{L}]/u.test(x.c));
    const order = letters.slice().sort((a, b) => ((a.i * 7919 + 13) % 97) - ((b.i * 7919 + 13) % 97));
    const n = frac >= .75 ? Math.max(1, Math.floor(letters.length * .5)) : frac >= .5 ? Math.max(1, Math.floor(letters.length * .25)) : 0;
    const show = new Set(order.slice(0, n).map((x) => x.i));
    return [...term].map((c, i) => (c === ' ' ? '<i class="bl-gap"></i>' : /[\p{L}]/u.test(c) ? `<b class="bl${show.has(i) ? ' on' : ''}">${show.has(i) ? esc(c.toUpperCase()) : ''}</b>` : `<b class="bl on">${esc(c)}</b>`)).join('');
  }

  // ---------- Zeichnen / Zuschauen ----------
  function renderLive() {
    const R = st.rounds[st.r];
    const actor = actorOf(st, st.r);
    const drawer = iAct();
    const box = h('div', { class: 'draw-live stack' });
    setView('live', box); // zuerst umschalten – danach Timer und Zeichenfläche neu anlegen
    const top = h('div', { class: 'dl-top' });
    timer = ringTimer();
    timer.classList.add('small');
    const info = h('div', { class: 'dl-info' });
    top.append(timer, info);
    box.append(top);
    canvas = sketchCanvas({
      editable: drawer,
      onStroke: (s) => { for (const c of chunks(s)) addEvent(sid, 'stroke', { r: st.r, c: c.c, s: c.s, p: c.p }); },
      onInk: remote ? (d) => sendFx({ kind: 'ink', sid, r: st.r, ...d }) : null,
    });
    box.append(canvas);
    requestAnimationFrame(() => canvas?.setStrokes(R.strokes));

    if (drawer) {
      info.innerHTML = `<b>${remote ? 'Du kritzelst' : `${esc(nameOf(actor))} kritzelt`}</b><span>${remote ? `${esc(nameOf(other(actor)))} sieht live zu und rät.` : `${esc(nameOf(other(actor)))} rät laut.`}</span>`;
      const tools = h('div', { class: 'tools', role: 'toolbar', 'aria-label': 'Zeichenwerkzeuge' });
      tools.innerHTML = `<div class="inks">${INKS.map((k, i) => `<button class="ink${i === 0 ? ' on' : ''}" type="button" data-ink="${k.c}" style="--ink:${k.c}" aria-label="${k.n}"></button>`).join('')}</div>
        <div class="row tool-row">
          ${SIZES.map((z, i) => `<button class="sz${i === 1 ? ' on' : ''}" type="button" data-size="${z.s}" aria-label="${z.n}"><i style="--d:${Math.round(z.s / 2.4) + 4}px"></i></button>`).join('')}
          <button class="tl" type="button" data-t="erase" aria-label="Radierer" aria-pressed="false"><svg viewBox="0 0 24 24" class="ic"><path d="M4 16l8.5-8.5a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L11 19H6.5z"/><path d="M9 11.5l5 5M11 19h9"/></svg></button>
          <button class="tl" type="button" data-t="undo" aria-label="Rückgängig">${icon('undo')}</button>
          <button class="tl" type="button" data-t="clear" aria-label="Alles löschen">${icon('trash')}</button>
        </div>`;
      tools.addEventListener('click', async (e) => {
        const ink = e.target.closest('[data-ink]');
        const sz = e.target.closest('[data-size]');
        const t = e.target.closest('[data-t]')?.dataset.t;
        if (ink) {
          tools.querySelectorAll('.ink').forEach((b) => b.classList.toggle('on', b === ink));
          tools.querySelector('[data-t="erase"]').setAttribute('aria-pressed', 'false');
          canvas.setTool({ c: ink.dataset.ink, erase: false }); sfx.tap();
        } else if (sz) {
          tools.querySelectorAll('.sz').forEach((b) => b.classList.toggle('on', b === sz));
          canvas.setTool({ s: +sz.dataset.size }); sfx.tap();
        } else if (t === 'erase') {
          const btn = tools.querySelector('[data-t="erase"]');
          const onNow = btn.getAttribute('aria-pressed') !== 'true';
          btn.setAttribute('aria-pressed', String(onNow));
          canvas.setTool({ erase: onNow }); sfx.tap();
        } else if (t === 'undo') { addEvent(sid, 'undo', { r: st.r }); sfx.flip(); }
        else if (t === 'clear') {
          const ok = await confirmBox({ title: 'Alles löschen?', text: 'Die ganze Zeichnung verschwindet.', ok: 'Löschen', danger: true });
          if (ok) addEvent(sid, 'clear', { r: st.r });
        }
      });
      box.append(tools);
      const got = h('button', { class: 'btn primary big block', type: 'button' });
      got.innerHTML = `${icon('sparkle')}<span>Erraten!</span>`;
      got.addEventListener('click', () => {
        const live = st.rounds[st.r];
        if (!live || live.status !== 'live') return;
        haptic([20, 30, 40]);
        addEvent(sid, 'got', { r: st.r, ms: Date.now() - live.startT });
      });
      const row = h('div', { class: 'row center wrap' });
      if (!remote) row.append(peekButton({ label: 'Begriff ansehen', warn: `Nur für ${nameOf(actor)}!`, reveal: () => R.term }));
      const skip = h('button', { class: 'btn small quiet', type: 'button' });
      skip.innerHTML = `${icon('flag')}<span>Aufgeben</span>`;
      skip.addEventListener('click', async () => {
        const ok = await confirmBox({ title: 'Begriff aufgeben?', text: 'Dann gibt es für diese Runde keine Punkte.', ok: 'Aufgeben' });
        if (ok && st.rounds[st.r]?.status === 'live') addEvent(sid, 'miss', { r: st.r });
      });
      row.append(skip);
      box.append(got, row);
    } else {
      // Weit weg: raten
      let lastLvl = -1;
      const updateInfo = () => {
        const live = st.rounds[st.r];
        if (!live || live.status !== 'live') return;
        const frac = (Date.now() - live.startT) / (st.dur * 1000);
        const lvl = frac >= .75 ? 2 : frac >= .5 ? 1 : 0;
        if (lvl === lastLvl) return;
        const before = new Set([...info.querySelectorAll('.bl')].map((b, i) => (b.classList.contains('on') ? i : -1)));
        info.innerHTML = `<b>${esc(nameOf(actor))} kritzelt</b><span class="blanks" aria-label="Tipp: ${live.term.length} Zeichen">${blanks(live.term, frac)}</span>`;
        if (lastLvl >= 0) info.querySelectorAll('.bl').forEach((b, i) => { if (b.classList.contains('on') && !before.has(i)) { b.classList.add('flip'); b.style.animationDelay = `${(i % 6) * 60}ms`; } });
        if (lastLvl >= 0 && lvl > lastLvl) sfx.sparkle();
        lastLvl = lvl;
      };
      updateInfo();
      hintT = setInterval(updateInfo, 1000);
      const form = h('form', { class: 'row compose-row', autocomplete: 'off' });
      form.innerHTML = `<input class="field grow" maxlength="60" placeholder="Was ist das?" aria-label="Dein Tipp" enterkeyhint="send">
        <button class="btn primary square" type="submit" aria-label="Tipp senden">${icon('send')}</button>`;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const inp = form.querySelector('input');
        const g = inp.value.trim();
        if (!g) return;
        inp.value = '';
        sfx.send();
        addEvent(sid, 'guess', { r: st.r, g });
      });
      box.append(form, h('div', { class: 'guesses chips', 'aria-live': 'polite' }));
      setTimeout(() => form.querySelector('input')?.focus(), 200);
    }
    if (drawer) box.append(h('div', { class: 'guesses chips', 'aria-live': 'polite' }));
    renderGuesses();
    timer.start(R.startT, st.dur * 1000, () => {
      const live = st.rounds[st.r];
      if (!live || live.status !== 'live') return;
      if (iAct()) addEvent(sid, 'miss', { r: st.r });
      else backupT = setTimeout(() => { if (st.rounds[st.r]?.status === 'live') addEvent(sid, 'miss', { r: st.r }); }, 4000);
    });
  }

  let guessCount = -1, guessR = -1;
  function renderGuesses() {
    const el = main.querySelector('.guesses');
    const R = st.rounds[st.r];
    if (!el || !R) return;
    if (st.r !== guessR) { guessR = st.r; guessCount = -1; }
    const wrong = R.guesses.filter((g) => !g.ok);
    el.innerHTML = wrong.slice(-8).map((g) => `<span class="chip wrong">${esc(g.g)}</span>`).join('');
    if (guessCount >= 0 && wrong.length > guessCount && motionOK()) {
      el.lastElementChild?.animate([{ transform: 'scale(.3) rotate(-8deg)', opacity: 0 }, { transform: 'scale(1.12) rotate(3deg)', opacity: 1, offset: .6 }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    }
    guessCount = wrong.length;
  }

  // ---------- Ergebnis ----------
  function renderResult(r) {
    const R = st.rounds[r];
    const actor = R.actor;
    saveArt({ id: `${sid}:${r}`, sid, r, term: R.term, by: actor, ts: Date.now(), strokes: R.strokes });
    const box = h('div', { class: 'result-stage stack' });
    const card = roundResultCard({ R, actor, dur: st.dur });
    const art = sketchCanvas();
    art.classList.add('res-art');
    const rp = h('button', { class: 'btn small', type: 'button' });
    rp.innerHTML = `${icon('refresh')}<span>Zeitraffer</span>`;
    rp.addEventListener('click', () => art.replay(R.strokes, 3600));
    const last = st.phase === 'end';
    const next = h('button', { class: 'btn primary big block', type: 'button' });
    next.innerHTML = `${icon(last ? 'trophy' : 'next')}<span>${last ? 'Zum Ergebnis' : 'Nächste Runde'}</span>`;
    next.addEventListener('click', () => { sfx.pop(); pendingResult = null; decide(); });
    const artRow = h('div', { class: 'stack center' }, art, rp);
    box.append(card, artRow, next);
    setView('result', box);
    canvas = art;
    if (R.strokes.length) setTimeout(() => art.replay(R.strokes, 2600), 350);
    if (motionOK()) card.animate([{ transform: 'translateY(30px) scale(.94)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    if (R.got) {
      sfx.win(); haptic([20, 40, 60]);
      const c = centerOf(card);
      burst(c.x, c.y - 30, { count: 34, emoji: true, speed: [220, 540] });
      flyStars(card, sb.querySelector(`.sb.${actor}`), R.pts[actor]);
      announce(`Erraten! ${R.term}.`);
    } else {
      sfx.buzz(); haptic([60, 40, 60]); shake(card, 10);
      announce(`Zeit um. Es war ${R.term}.`);
    }
    setTimeout(() => sb.set(st), 900);
  }

  function renderEnd() {
    const w = st.winner;
    const card = resultCard({
      winner: w, aborted: st.aborted,
      title: st.aborted ? 'Partie beendet' : w === 'draw' ? 'Unentschieden!' : `${nameOf(w)} gewinnt!`,
      sad: remote && w !== p && w !== 'draw',
      lines: st.aborted ? [`${esc(nameOf(st.abortBy))} hat die Partie beendet.`] : [`${esc(nameOf('jos'))}: <b>${st.score.jos}</b> Sterne – ${esc(nameOf('joh'))}: <b>${st.score.joh}</b> Sterne`],
      rematchLabel: 'Nochmal spielen',
      onRematch: () => { const id = createSession('draw', mode, { first: other(st.first), n: st.n, dur: st.dur, cats: st.cats, level: st.level }); nav('#/spiel/' + id, { replace: true }); },
    });
    const box = h('div', { class: 'stack' });
    box.append(card);
    const done = st.rounds.filter((R) => R?.strokes?.length);
    if (done.length) {
      const strip = h('div', { class: 'art-strip' });
      for (const R of done) {
        const f = h('figure', { class: 'art-mini' });
        f.append(thumb(R.strokes, 92));
        f.insertAdjacentHTML('beforeend', `<figcaption>${esc(R.term)}${R.got ? '' : ' ✗'}</figcaption>`);
        strip.append(f);
      }
      box.append(strip);
      const ab = h('button', { class: 'btn block', type: 'button' });
      ab.innerHTML = `${icon('palette')}<span>Kunstbuch ansehen</span>`;
      ab.addEventListener('click', openArtbook);
      box.append(ab);
    }
    setView('end', box);
    sb.set(st);
  }

  async function decide() {
    if (busy) return;
    if (pendingResult !== null) { if (view !== 'result') renderResult(pendingResult); return; }
    if (st.phase === 'end') { renderEnd(); return; }
    const R = st.rounds[st.r];
    const actor = actorOf(st, st.r);
    if (R?.status === 'live') { if (view !== 'live') renderLive(); return; }
    if (remote && actor !== p) {
      if (view !== 'wait') setView('wait', waitCard(`${nameOf(actor)} sucht sich etwas zum Kritzeln aus`, 'Gleich siehst du die Striche live!'));
      return;
    }
    if (!remote && handed !== st.r) {
      busy = true;
      await transition('page', () => main.replaceChildren(), { title: `Runde ${st.r + 1} von ${st.total}`, sub: `${nameOf(actor)} kritzelt` });
      if (!alive) return;
      await handoff({ to: actor, kicker: 'Kritzelspiel', title: `${nameOf(actor)} kritzelt`, text: `${nameOf(other(actor))}, nicht aufs Handy schauen!`, button: `Ich bin ${nameOf(actor)} – zeig mir den Begriff` });
      handed = st.r;
      busy = false;
      st = compute();
      decide();
      return;
    }
    if (view !== 'pick' || !main.querySelector('.term-card')) renderPick();
  }

  function update(prev) {
    sb.set(st, { animate: false });
    if (st.r > prev.r || (st.phase === 'end' && prev.phase !== 'end' && !st.aborted)) {
      const doneR = st.r > prev.r ? prev.r : st.r - 1;
      if (st.rounds[doneR]?.status === 'done') pendingResult = doneR;
    }
    if (st.phase === 'end' && prev.phase !== 'end') {
      if (st.aborted) { pendingResult = null; if (st.abortBy !== p) toast(`${nameOf(st.abortBy)} hat die Partie beendet.`, { key: 'game', icon: 'flag' }); }
      else setTimeout(() => { if (location.hash === '#/spiel/' + sid) finale(sid, { winner: st.winner, iWon: st.winner === p, couch: !remote }); }, 1800);
    }
    const R = st.rounds[st.r];
    if (view === 'pick' && R && prev.rounds[st.r] && R.term !== prev.rounds[st.r].term) { renderPick(); return; }
    if (R?.status === 'live' && view !== 'live') { pendingResult = null; renderLive(); return; }
    if (view === 'live' && R?.status === 'live') {
      if (canvas && canvas.strokes().length !== R.strokes.length) canvas.setStrokes(R.strokes);
      const pr = prev.rounds[st.r];
      if (pr && R.guesses.length > pr.guesses.length) {
        renderGuesses();
        const g = R.guesses.at(-1);
        if (!g.ok) { sfx.bad(); if (iAct()) toast(`${nameOf(other(R.actor))} tippt: „${g.g}“`, { key: 'game', icon: 'chat' }); else shake(main.querySelector('.compose-row'), 6); }
      }
      return;
    }
    decide();
  }

  offs.push(on('session', (d) => {
    if (d.id !== sid) return;
    const prev = st;
    st = compute();
    if (busy) return;
    update(prev);
  }));
  // Live-Striche vom anderen Handy
  offs.push(on('fx', (d) => {
    if (d.sid !== sid || d.kind !== 'ink' || view !== 'live' || iAct() || d.r !== st.r) return;
    canvas?.ink(d);
  }));

  if (st.phase === 'end') { markCelebrated(sid); renderEnd(); }
  else decide();

  return () => { alive = false; shellOff(); offs.forEach((f) => f()); timer?.stop?.(); canvas?.destroy?.(); clearInterval(hintT); clearTimeout(backupT); };
}

