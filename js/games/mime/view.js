// Pantomime – Oberfläche. Vorhang-Übergänge, Begriffskarte, 3-2-1, Bühne mit Spotlight und Ring-Timer.
import { h, esc, centerOf } from '../../core/dom.js';
import { icon } from '../../art/icons.js';
import { me, on } from '../../core/store.js';
import { nameOf, other } from '../../core/util.js';
import { handoff, confirmBox, announce, toast } from '../../core/ui.js';
import { motionOK } from '../../core/theme.js';
import { burst, stamp, shake } from '../../core/fx.js';
import { sfx, haptic } from '../../core/sound.js';
import { nav } from '../../core/router.js';
import { createSession, addEvent, getSession } from '../../core/sync.js';
import { reduce } from './logic.js';
import { actorOf } from '../rounds.js';
import { enc } from '../secret.js';
import { pickTerm } from '../../data/terms.js';
import { shell, resultCard, finale, markCelebrated, peekButton, waitCard } from '../common.js';
import { roundsSetup, scoreBar, ringTimer, countdown, transition, roundResultCard, flyStars } from '../rounds-ui.js';

const RULES = [
  'Abwechselnd stellt einer einen Begriff dar – ohne Worte, ohne Geräusche, ohne Zeigen auf Dinge im Raum.',
  'Der andere rät laut. Wer darstellt, tippt auf „Erraten!“, sobald es stimmt.',
  'Je schneller erraten, desto mehr Sterne: 3 im ersten Drittel der Zeit, dann 2, dann 1. Wer rät, bekommt 1 Stern.',
  'Weit weg klappt es mit Videoanruf: Der Begriff steht nur auf dem Handy von dem, der darstellt.',
];
const STAGE = `<div class="stage-hero" aria-hidden="true">
  <div class="sh-back"><span class="sh-spot"></span></div>
  <div class="sh-title">Pantomime</div>
  <div class="sh-cur l"></div><div class="sh-cur r"></div><div class="sh-val"></div>
</div>`;

export function setup(root) {
  const { cleanup } = roundsSetup({
    root, game: 'mime', rules: RULES, hero: STAGE,
    intro: 'Einer stellt dar, der andere rät laut. Wer darstellt, sieht den Begriff – und dann heißt es: Bühne frei!',
  });
  return cleanup;
}

export function play(root, sid) {
  const p = me.get();
  const { body, mode, cleanup: shellOff } = shell({ root, game: 'mime', sid, rules: RULES });
  const remote = mode === 'remote';
  const compute = () => { const s = getSession(sid); return reduce(s.meta, s.evs); };
  let st = compute();
  const sb = scoreBar();
  const main = h('div', { class: 'r-main' });
  body.append(sb, main);
  sb.set(st, { animate: false });

  let view = '';
  let handed = -1;            // Nebeneinander: Übergabe für Runde r erledigt
  let pendingResult = null;   // Index der Runde, deren Ergebnis gerade gezeigt wird
  let busy = false;
  let timer = null;
  let backupT = 0;
  const offs = [];
  const iAct = (r = st.r) => !remote || actorOf(st, r) === p;

  function setView(v, node) {
    view = v;
    timer?.stop?.();
    clearTimeout(backupT);
    main.replaceChildren(node);
  }

  // ---------- Begriff ansehen ----------
  function ensureTerm() {
    const R = st.rounds[st.r];
    if (R) return;
    const used = st.rounds.map((x) => x?.term).filter(Boolean);
    const t = pickTerm('mime', st.cats, st.level, used);
    addEvent(sid, 'term', { r: st.r, w: enc(t.text, sid), cat: t.catLabel });
  }

  function renderPick() {
    const R = st.rounds[st.r];
    if (!R) { ensureTerm(); return; }
    const box = h('div', { class: 'pick stack' });
    box.innerHTML = `
      <p class="pick-kick">${remote ? 'Dein Begriff' : `${esc(nameOf(actorOf(st, st.r)))}, dein Begriff`}</p>
      <div class="term-card" aria-live="polite"><span class="tc-cat">${esc(R.cat)}</span><span class="tc-text">${esc(R.term)}</span></div>
      <div class="row center"><button class="btn small" type="button" data-a="reroll" ${R.rerolls >= 3 ? 'disabled' : ''}>${icon('refresh')}<span>Anderer Begriff${R.rerolls < 3 ? ` (${3 - R.rerolls})` : ''}</span></button></div>
      <p class="soft center small">Merk ihn dir – gleich wird er versteckt und die Zeit läuft.</p>
      <button class="btn primary big block" type="button" data-a="go">${icon('eyeoff')}<span>Verstecken & los!</span></button>`;
    setView('pick', box);
    const card = box.querySelector('.term-card');
    if (motionOK()) {
      card.animate([{ transform: 'perspective(700px) rotateY(95deg) scale(.8)', opacity: 0 }, { transform: 'perspective(700px) rotateY(-8deg) scale(1.02)', opacity: 1, offset: .7 }, { transform: 'none' }], { duration: 700, easing: 'cubic-bezier(.22,1,.36,1)' });
      const c = centerOf(card);
      setTimeout(() => burst(c.x, c.y, { count: 14, speed: [80, 220], size: [5, 10], gravity: 120, shapes: ['sparkle', 'star'] }), 420);
    }
    sfx.flip();
    box.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'reroll') {
        const used = st.rounds.map((x) => x?.term).filter(Boolean);
        const t = pickTerm('mime', st.cats, st.level, used);
        addEvent(sid, 'term', { r: st.r, w: enc(t.text, sid), cat: t.catLabel });
      } else if (a === 'go') {
        busy = true;
        main.replaceChildren();
        await countdown();
        busy = false;
        addEvent(sid, 'go', { r: st.r });
      }
    });
  }

  // ---------- Bühne (Zeit läuft) ----------
  function renderLive() {
    const R = st.rounds[st.r];
    const actor = actorOf(st, st.r);
    const box = h('div', { class: 'live stage' });
    box.innerHTML = `<div class="spot-a" aria-hidden="true"></div><div class="spot-b" aria-hidden="true"></div>`;
    timer = ringTimer();
    const info = h('p', { class: 'live-hint' });
    info.innerHTML = remote && actor !== p
      ? `<b>${esc(nameOf(actor))}</b> stellt dar – rate laut!<br><span class="soft small">${esc(nameOf(actor))} tippt auf „Erraten!“, wenn du richtig liegst.</span>`
      : `<b>${esc(nameOf(actor))}</b> stellt dar, <b>${esc(nameOf(other(actor)))}</b> rät laut.`;
    box.append(timer, info);
    if (iAct()) {
      const got = h('button', { class: 'btn primary big block', type: 'button' });
      got.innerHTML = `${icon('sparkle')}<span>Erraten!</span>`;
      got.addEventListener('click', () => {
        const live = st.rounds[st.r];
        if (!live || live.status !== 'live') return;
        haptic([20, 30, 40]);
        addEvent(sid, 'got', { r: st.r, ms: Date.now() - live.startT });
      });
      const row = h('div', { class: 'row center wrap live-tools' });
      if (!remote) row.append(peekButton({ label: 'Begriff ansehen', warn: `Nur für ${nameOf(actor)}!`, reveal: () => R.term }));
      const skip = h('button', { class: 'btn small quiet', type: 'button' });
      skip.innerHTML = `${icon('flag')}<span>Aufgeben</span>`;
      skip.addEventListener('click', async () => {
        const ok = await confirmBox({ title: 'Begriff aufgeben?', text: 'Dann gibt es für diese Runde keine Punkte.', ok: 'Aufgeben' });
        if (ok && st.rounds[st.r]?.status === 'live') addEvent(sid, 'miss', { r: st.r });
      });
      row.append(skip);
      box.append(got, row);
    }
    setView('live', box);
    timer.start(R.startT, st.dur * 1000, () => {
      const live = st.rounds[st.r];
      if (!live || live.status !== 'live') return;
      if (iAct()) addEvent(sid, 'miss', { r: st.r });
      else backupT = setTimeout(() => { if (st.rounds[st.r]?.status === 'live') addEvent(sid, 'miss', { r: st.r }); }, 4000);
    });
  }

  // ---------- Ergebnis einer Runde ----------
  function renderResult(r) {
    const R = st.rounds[r];
    const actor = R.actor;
    const box = h('div', { class: 'result-stage stack' });
    const card = roundResultCard({ R, actor, dur: st.dur });
    const last = st.phase === 'end';
    const next = h('button', { class: 'btn primary big block', type: 'button' });
    next.innerHTML = `${icon(last ? 'trophy' : 'next')}<span>${last ? 'Zum Ergebnis' : 'Nächste Runde'}</span>`;
    next.addEventListener('click', () => { sfx.pop(); pendingResult = null; decide(); });
    box.append(card, next);
    setView('result', box);
    if (motionOK()) card.animate([{ transform: 'translateY(30px) scale(.94)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    if (R.got) {
      sfx.win(); haptic([20, 40, 60]);
      const c = centerOf(card);
      burst(c.x, c.y - 40, { count: 36, emoji: true, speed: [220, 560] });
      flyStars(card, sb.querySelector(`.sb.${actor}`), R.pts[actor]);
      announce(`Erraten! ${R.term}. Plus ${R.pts[actor]} für ${nameOf(actor)}.`);
    } else {
      sfx.buzz(); haptic([60, 40, 60]);
      shake(card, 10);
      announce(`Zeit um. Es war ${R.term}.`);
    }
    setTimeout(() => sb.set(st), 900);
  }

  // ---------- Ende ----------
  function renderEnd() {
    const w = st.winner;
    const recap = st.rounds.filter(Boolean).map((R, i) => `<li class="${R.got ? 'ok' : 'no'}"><span>${i + 1}. ${esc(nameOf(R.actor))}: <b>${esc(R.term)}</b></span><span>${R.got ? `${Math.max(1, Math.round(R.ms / 1000))} s` : '–'}</span></li>`).join('');
    const card = resultCard({
      winner: w, aborted: st.aborted,
      title: st.aborted ? 'Partie beendet' : w === 'draw' ? 'Unentschieden!' : `${nameOf(w)} gewinnt!`,
      sad: remote && w !== p && w !== 'draw',
      lines: st.aborted ? [`${esc(nameOf(st.abortBy))} hat die Partie beendet.`] : [`${esc(nameOf('jos'))}: <b>${st.score.jos}</b> Sterne – ${esc(nameOf('joh'))}: <b>${st.score.joh}</b> Sterne`],
      rematchLabel: 'Nochmal spielen',
      onRematch: () => { const id = createSession('mime', mode, { first: other(st.first), n: st.n, dur: st.dur, cats: st.cats, level: st.level }); nav('#/spiel/' + id, { replace: true }); },
    });
    const box = h('div', { class: 'stack' });
    box.append(card);
    if (recap) box.insertAdjacentHTML('beforeend', `<ol class="recap">${recap}</ol>`);
    setView('end', box);
    sb.set(st);
  }

  // ---------- Was ist gerade dran? ----------
  async function decide() {
    if (busy) return;
    if (pendingResult !== null) { if (view !== 'result') renderResult(pendingResult); return; }
    if (st.phase === 'end') { renderEnd(); return; }
    const R = st.rounds[st.r];
    const actor = actorOf(st, st.r);
    if (R?.status === 'live') { if (view !== 'live') renderLive(); return; }
    if (remote && actor !== p) {
      if (view !== 'wait') setView('wait', waitCard(`${nameOf(actor)} sucht sich einen Begriff aus`, 'Am besten mit Videoanruf – gleich geht’s los!'));
      return;
    }
    if (!remote && handed !== st.r) {
      busy = true;
      await transition('curtain', () => main.replaceChildren(), { title: `Runde ${st.r + 1} von ${st.total}`, sub: `${nameOf(actor)} stellt dar` });
      await handoff({ to: actor, kicker: 'Pantomime', title: `${nameOf(actor)} stellt dar`, text: `${nameOf(other(actor))}, nicht aufs Handy schauen!`, button: `Ich bin ${nameOf(actor)} – zeig mir den Begriff` });
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
    // Runde fertig → Ergebnis zeigen
    if (st.r > prev.r || (st.phase === 'end' && prev.phase !== 'end' && !st.aborted)) {
      const doneR = st.r > prev.r ? prev.r : st.r - 1;
      if (st.rounds[doneR]?.status === 'done') pendingResult = doneR;
    }
    if (st.phase === 'end' && prev.phase !== 'end') {
      if (st.aborted) { pendingResult = null; if (st.abortBy !== p) toast(`${nameOf(st.abortBy)} hat die Partie beendet.`, { key: 'game', icon: 'flag' }); }
      else setTimeout(() => finale(sid, { winner: st.winner, iWon: st.winner === p, couch: !remote }), 1800);
    }
    const R = st.rounds[st.r];
    // Neuer Begriff (gewürfelt) → Karte neu
    if (view === 'pick' && R && prev.rounds[st.r] && R.term !== prev.rounds[st.r].term) { renderPick(); return; }
    // Andere Seite hat gestartet → Ergebnis überspringen und zur Bühne
    if (R?.status === 'live' && view !== 'live') { pendingResult = null; renderLive(); return; }
    decide();
  }

  offs.push(on('session', (d) => {
    if (d.id !== sid) return;
    const prev = st;
    st = compute();
    if (busy) return;
    update(prev);
  }));

  if (st.phase === 'end') { markCelebrated(sid); renderEnd(); }
  else decide();

  return () => { shellOff(); offs.forEach((f) => f()); timer?.stop?.(); clearTimeout(backupT); };
}
