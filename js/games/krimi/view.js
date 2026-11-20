// Krimi für zwei – Oberfläche: Fall-Auswahl, Intro im Sturm, Karte (Grundriss), Akte, Ermittlungstafel mit roten Fäden,
// Verhöre, gemeinsame Anklageschrift, Ereignisse der Nacht, Auflösung mit Rekonstruktion.
import { h, esc } from '../../core/dom.js';
import { miniHalf } from '../../art/heart.js';
import { me, prefs, get, set, on } from '../../core/store.js';
import { nameOf, other, sleep } from '../../core/util.js';
import { sheet, toast, confirmBox, announce } from '../../core/ui.js';
import { motionOK } from '../../core/theme.js';
import { burst, flash, stamp } from '../../core/fx.js';
import { sfx, haptic } from '../../core/sound.js';
import { nav } from '../../core/router.js';
import { netState } from '../../core/net.js';
import { createSession, addEvent, getSession } from '../../core/sync.js';
import { shell, whoSeg, resolveWho, radioCards, partnerNote } from '../common.js';
import {
  CASE, reduce, fmtClock, has, test, canEnter, moveCost, spotInfo, variantOf, topicsFor, showEntry, visibleQuestions,
  pinsLeft, hintsLeft, pendingRadio, formComplete, costFor, COST, placeOf, alive, personOf, roomOf, spotOf, titleOf, roleOf,
} from './logic.js';
import { portrait, clueIcon, kIcon, planSVG, fingerprint, splat, hotelScene, watchArt, roomCenter } from './art.js';
import { openCipher, openSafe, openRub, openFp, openChess } from './tools.js';
import { play2, TITLE as P2TITLE, TAG as P2TAG, DIFFS as P2DIFFS } from './puppe/view.js';
import { theaterScene } from './puppe/art.js';

const PUPPE = { TITLE: P2TITLE, TAG: P2TAG, DIFFS: P2DIFFS };

const C = CASE;
const RECKEY = 'krimiRecords';
const anrede = (p) => (p === 'jos' ? 'Frau Kommissarin' : 'Herr Kommissar');
const fill = (s, p) => String(s ?? '').replaceAll('{K}', anrede(p));
const floorOf = (room) => roomOf(room)?.floor || 'eg';
const PLAN = { rooms: C.rooms, halls: C.halls, stairs: C.stairs };
const initial = (p) => (nameOf(p)[0] || '?').toUpperCase();
const isPeopleQ = (q) => q.opts.every((o) => C.people[o.id]);
const hashOf = (s) => { let x = 0; for (const ch of s) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return x; };
const TABS = [
  { id: 'map', ic: 'map', label: 'Karte' },
  { id: 'file', ic: 'folder', label: 'Akte' },
  { id: 'board', ic: 'board', label: 'Tafel' },
  { id: 'talk', ic: 'people', label: 'Verhöre' },
  { id: 'accuse', ic: 'gavel', label: 'Anklage' },
];
const KIND_ORDER = ['spur', 'dok', 'aussage', 'funk', 'erk', 'fp', 'ding'];

// Buchstaben einzeln (für Titel-Animation)
const letters = (text) => esc(text).split(' ').map((w, wi) => `<span class="w">${[...w].map((ch, i) => `<span class="l" style="--i:${wi * 4 + i}">${ch}</span>`).join('')}</span>`).join(' ');

function codeLink(linkEl) {
  const render = () => {
    const code = prefs.get('code');
    if (!code) {
      linkEl.innerHTML = `<div class="panel link-card kr-link">
        <label class="label" for="kr-code">Erst verbinden: euer gemeinsamer Code</label>
        <div class="row"><input id="kr-code" class="field grow" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="40" placeholder="z. B. einhorn42">
        <button class="btn primary" type="button" data-a="code">Verbinden</button></div>
        <p class="hint">Gebt auf beiden Handys denselben Code ein – ein Wort, das nur ihr kennt.</p></div>`;
      return;
    }
    linkEl.innerHTML = partnerNote('remote');
  };
  const save = () => {
    const v = (linkEl.querySelector('#kr-code')?.value || '').trim();
    if (v.length < 4) { toast('Der Code braucht mindestens 4 Zeichen.', { icon: 'info' }); return; }
    prefs.set('code', v);
    prefs.set('mode', 'remote');
    sfx.good();
    render();
  };
  linkEl.addEventListener('click', (e) => { if (e.target.closest('[data-a="code"]')) save(); });
  linkEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'kr-code') save(); });
  render();
  return render;
}

// =====================================================================
// Einstellungen
// =====================================================================
export function setup(root) {
  const { el, body, cleanup } = shell({ root, game: 'krimi', rules: C.rules, mode: 'remote' });
  el.classList.add('kr-setup-screen');
  if (prefs.get('code') && prefs.get('mode') !== 'remote') prefs.set('mode', 'remote');
  let cas = get('krimiCase', 'edelweiss') === 'puppe' ? 'puppe' : 'edelweiss';
  let diff = 'normal';
  let who = me.get();
  const recs = get(RECKEY, {}) || {};
  const CASES = {
    edelweiss: { art: () => hotelScene({ seed: 'setup' }), tag: `${C.tag} · ${C.date}`, title: C.title, time: '1–2 Stunden', kind: 'Ermittlung',
      blurb: 'Ein eingeschneites Berghotel. Ein Toter im Weinkeller, die Kehle durchtrennt. Acht Verdächtige, sieben Stunden bis zum Morgengrauen – und jeder von euch sieht andere Spuren.' },
    puppe: { art: () => theaterScene({ seed: 'setup' }), tag: PUPPE.TAG, title: PUPPE.TITLE, time: '45–60 Minuten', kind: 'Escape-Krimi',
      blurb: 'Krampusnacht in Wien. Ihr wacht getrennt in einem ausgebrannten Puppentheater auf. Ein Kasperl fragt »Seid ihr alle da?« – und dann beginnt sein Stück. Fallen, Rätsel, Blut und eine Wahrheit, die schlimmer ist als jede Falle.' },
  };
  const FEATS = {
    edelweiss: [
      ['clock', 'Eine lange Nacht', 'Eure gemeinsame Uhr läuft von 23 bis 6 Uhr. Jede Handlung kostet Zeit.'],
      ['folder', 'Getrennte Akten', 'Was du findest, sieht nur dein Handy. Redet miteinander!'],
      ['board', 'Eine Ermittlungstafel', 'Begrenzte Nadeln, rote Fäden – und plötzliche Erkenntnisse.'],
      ['gavel', 'Gemeinsame Anklage', '13 Fragen. Eingereicht wird erst, wenn ihr beide unterschreibt.'],
    ],
    puppe: [
      ['people', 'Fünf neue Zwei-Handy-Rätsel', 'Lebende Marionette, Blutspur, Blindekuh auf der Drehbühne, Schattentheater, Drehorgel gegen das Krokodil.'],
      ['drops', 'Blut statt Leben', 'Fehler kosten Blut. Wer wenig hat, sieht verschwommen. Ihr könnt euch Blut spenden.'],
      ['thread', 'Entscheidungen über Leben und Tod', 'Schneidet ihr den Faden durch – oder haltet ihr ihn mit euren Händen fest?'],
      ['gavel', 'Tribunal und mehrere Enden', 'Wer hat das Feuer gelegt? Die Antwort entscheidet, wie das Stück endet.'],
    ],
  };
  const recLine = (id) => {
    const r = recs[id];
    if (!r) return '';
    return id === 'puppe' ? `${'★'.repeat(r.stars || 0) || '–'} · ${esc(r.ending || '')}` : `${esc(r.rank)} · ${r.total} Punkte`;
  };
  body.innerHTML = `
    <div class="kr-setup stack">
      <h2 class="kr-pickh">${letters('Wählt euren Fall')}</h2>
      <div class="kr-cases" role="radiogroup" aria-label="Fall">${['edelweiss', 'puppe'].map((id, i) => `
        <button class="kr-case kr-casebtn${id === 'puppe' ? ' k2-casecard' : ''}" type="button" role="radio" data-case="${id}" style="--i:${i}">
          <span class="kr-case-art">${CASES[id].art()}<span class="kr-case-shade"></span>
            <span class="kr-warn">Blutig · ab 16</span>
            <span class="kr-case-text"><span class="kr-tag">${esc(CASES[id].tag)}</span><span class="kr-title">${letters(CASES[id].title)}</span></span></span>
          <span class="kr-case-meta"><b>${esc(CASES[id].kind)}</b><i>${esc(CASES[id].time)}</i>${recs[id] ? `<em>${recLine(id)}</em>` : ''}</span>
        </button>`).join('')}</div>
      <div data-slot="detail"></div>
      <div data-slot="link"></div>
      <button class="btn primary big block kr-start" type="button">${clueIcon('search')}<span>Ermittlung beginnen</span></button>
    </div>`;
  const detail = body.querySelector('[data-slot="detail"]');
  const renderDetail = () => {
    body.querySelectorAll('.kr-casebtn').forEach((b) => { b.setAttribute('aria-checked', String(b.dataset.case === cas)); b.classList.toggle('on', b.dataset.case === cas); });
    const c = CASES[cas];
    diff = 'normal';
    detail.innerHTML = `
      <article class="kr-case kr-case-detail">
        <p class="kr-case-blurb">${esc(c.blurb)}</p>
        <ul class="kr-feats">${FEATS[cas].map(([ic, t, x], i) => `<li style="--i:${i}">${clueIcon(ic)}<span><b>${esc(t)}</b>${esc(x)}</span></li>`).join('')}</ul>
      </article>
      <section class="stack kr-sec"><h3 class="setup-h">Schwierigkeit</h3><div data-slot="diff"></div></section>
      <section class="stack kr-sec"><h3 class="setup-h">${cas === 'puppe' ? 'Wer wacht in den Fäden auf?' : 'Wer übernimmt die Spurensicherung?'}</h3><div data-slot="role"></div>
        <p class="hint">${cas === 'puppe' ? 'Diese Person hängt in der ersten Szene als Marionette – und ist danach öfter in Gefahr. Die Rollen wechseln jede Szene.' : 'Die Spurensicherung durchsucht schneller, der andere verhört schneller. Machen könnt ihr beide alles.'}</p></section>`;
    const D = cas === 'puppe' ? PUPPE.DIFFS : C.diffs;
    detail.querySelector('[data-slot="diff"]').append(radioCards({
      label: 'Schwierigkeit', value: diff,
      options: Object.values(D).map((d) => ({ value: d.id, title: d.title, sub: d.sub })),
      onChange: (v) => { diff = v; },
    }));
    detail.querySelector('[data-slot="role"]').append(whoSeg({ label: cas === 'puppe' ? 'Marionette' : 'Spurensicherung', value: who, random: true, onChange: (v) => { who = v; } }));
    body.querySelector('.kr-start span').textContent = cas === 'puppe' ? 'Das Stück beginnt' : 'Ermittlung beginnen';
    if (motionOK()) detail.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' });
  };
  body.querySelector('.kr-cases').addEventListener('click', (e) => {
    const b = e.target.closest('[data-case]');
    if (!b || b.dataset.case === cas) return;
    cas = b.dataset.case;
    set('krimiCase', cas);
    sfx.pop(); haptic(10);
    renderDetail();
  });
  renderDetail();
  const linkEl = body.querySelector('[data-slot="link"]');
  const renderLink = codeLink(linkEl);
  const offNet = on('net', () => { if (prefs.get('code')) renderLink(); });
  body.querySelector('.kr-start').addEventListener('click', () => {
    if (!prefs.get('code')) {
      toast('Gebt zuerst euren gemeinsamen Code ein.', { icon: 'link' });
      linkEl.querySelector('#kr-code')?.focus();
      return;
    }
    if (prefs.get('mode') !== 'remote') prefs.set('mode', 'remote');
    sfx.thunder(); haptic([20, 40, 60]);
    const id = cas === 'puppe'
      ? createSession('krimi', 'remote', { case: 'puppe', diff, first: resolveWho(who), seed: Math.random().toString(36).slice(2, 10) })
      : createSession('krimi', 'remote', { diff, spuren: resolveWho(who) });
    nav('#/spiel/' + id, { replace: true });
  });
  return () => { cleanup(); offNet(); };
}

// =====================================================================
// Spiel
// =====================================================================
export function play(root, sid) {
  const s0 = getSession(sid)?.evs.find((e) => e.ty === 'setup');
  if (s0?.d?.case === 'puppe') return play2(root, sid);
  const p = me.get();
  const q = other(p);
  const { el, body, cleanup: shellOff } = shell({ root, game: 'krimi', sid, rules: C.rules });
  el.classList.add('kr-play');
  const back = h('div', { class: 'kr-backdrop', 'aria-hidden': 'true' });
  back.innerHTML = '<i class="kr-grain"></i><i class="kr-vignette"></i>';
  el.prepend(back);
  const compute = () => { const s = getSession(sid); return reduce(s.meta, s.evs); };
  let st = compute();
  const LKEY = 'kr_' + sid;
  const stored = get(LKEY, null);
  const local = Object.assign({ tab: 'map', floor: null, sel: null, kind: 'all', seen: {}, talkSeen: {} }, stored || {});
  if (!stored) for (const id of st.order[p]) local.seen[id] = 1;
  const saveLocal = () => set(LKEY, local);
  let feedN = st.feed.length;
  let mode = '';
  let alive_ = true;
  let view = null, pane = null;
  let clueSh = null;
  let tool = null;
  let tickerMsg = '';
  let drag = null, deferBoard = false;
  let threadFrom = null;
  let typer = null;
  const offs = [];
  const isMine = (f) => f.by === p;

  // ---------- Steuerung ----------
  function update() {
    if (!alive_) return;
    st = compute();
    const fresh = st.feed.slice(feedN);
    feedN = st.feed.length;
    const want = st.phase === 'end' ? 'end' : st.phase === 'intro' || st.phase === 'setup' ? 'intro' : 'play';
    if (want !== mode) {
      const prev = mode;
      mode = want;
      if (want === 'intro') mountIntro();
      else if (want === 'play') mountPlay(prev === 'intro');
      else mountEnd(prev === 'play');
      if (want === 'play' && prev) handleFeed(fresh);
      return;
    }
    if (mode === 'intro') updateIntro();
    else if (mode === 'play') { renderPlay(); handleFeed(fresh); }
  }

  // ---------- Intro ----------
  function mountIntro() {
    const mine = roleOf(st, p);
    view = h('div', { class: 'kr-intro' });
    view.innerHTML = `
      <div class="kr-hero">${hotelScene({ seed: sid })}<div class="kr-hero-shade"></div>
        <span class="kr-warn">Blutig · ab 16</span>
        <div class="kr-hero-text"><span class="kr-tag">${esc(C.tag)} · ${esc(C.date)}</span><h2 class="kr-title">${letters(C.title)}</h2></div>
      </div>
      <div class="kr-story" role="button" tabindex="0" aria-label="Geschichte (antippen zum Überspringen)">${C.intro.map((t, i) => `<p class="kr-para" data-i="${i}">${esc(t)}</p>`).join('')}</div>
      <div class="kr-roles">
        <div class="kr-role ${mine === 'spuren' ? 'mine' : ''}">${clueIcon('search')}<b>Spurensicherung</b><span>${esc(titleOf(st.roles.spuren))}<br><small>durchsucht schneller</small></span></div>
        <div class="kr-role ${mine === 'verhoer' ? 'mine' : ''}">${clueIcon('ear')}<b>Verhöre</b><span>${esc(titleOf(st.roles.verhoer))}<br><small>fragt schneller</small></span></div>
      </div>
      <ul class="kr-brief">
        <li>${clueIcon('folder')}<span>Jeder hat eine <b>eigene Akte</b>. Erzählt euch, was ihr findet – oder hängt es an die <b>Tafel</b>.</span></li>
        <li>${clueIcon('clock')}<span>Die Uhr gehört euch beiden: <b>${fmtClock(st.start)} bis 06:00</b>. Jede Handlung kostet Minuten – auch die deines Partners.</span></li>
        <li>${clueIcon('people')}<span>Die Verdächtigen warten im <b>Kaminzimmer</b>, der Nachtportier in seiner Loge.</span></li>
        <li>${clueIcon('gavel')}<span>Am Ende unterschreibt ihr <b>gemeinsam</b> eine Anklageschrift.</span></li>
      </ul>
      <div class="kr-ready"><div class="kr-ready-row"></div>
        <button class="btn primary big block kr-go" type="button">${clueIcon('search')}<span>Ermittlung aufnehmen</span></button></div>`;
    body.replaceChildren(view);
    view.querySelector('.kr-go').addEventListener('click', () => {
      sfx.pop(); haptic(15);
      typer?.finish();
      addEvent(sid, 'ready', {});
    });
    const story = view.querySelector('.kr-story');
    typer = typewriter([...story.querySelectorAll('.kr-para')]);
    story.addEventListener('click', () => typer.finish());
    story.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); typer.finish(); } });
    updateIntro();
  }
  function updateIntro() {
    if (!view?.classList.contains('kr-intro')) return;
    const row = view.querySelector('.kr-ready-row');
    row.innerHTML = ['jos', 'joh'].map((x) => `<span class="kr-rd ${x} ${st.ready[x] ? 'on' : ''}">${miniHalf(x)}<b>${esc(titleOf(x))}</b><i>${st.ready[x] ? 'bereit' : 'liest noch …'}</i></span>`).join('');
    const go = view.querySelector('.kr-go');
    if (st.ready[p]) {
      go.disabled = true;
      go.querySelector('span').textContent = st.ready[q] ? 'Los geht’s!' : `Warte auf ${nameOf(q)} …`;
    }
  }
  function typewriter(paras) {
    const texts = paras.map((x) => x.textContent);
    let stop = false;
    const finish = () => { stop = true; paras.forEach((x, i) => { x.textContent = texts[i]; x.classList.add('shown'); }); };
    if (!motionOK()) { finish(); return { finish }; }
    paras.forEach((x) => { x.textContent = ''; });
    (async () => {
      await sleep(700);
      for (let i = 0; i < paras.length && !stop; i++) {
        const x = paras[i];
        x.classList.add('shown', 'typing');
        const t = texts[i];
        let n = 0;
        while (n < t.length && !stop) {
          n = Math.min(t.length, n + 2);
          x.textContent = t.slice(0, n);
          if (n % 6 === 0) sfx.key();
          await sleep(22);
        }
        x.classList.remove('typing');
        if (!stop) await sleep(320);
      }
    })();
    return { finish };
  }

  // ---------- Spiel-Gerüst ----------
  function mountPlay(fromIntro) {
    typer?.finish();
    view = h('div', { class: 'kr-view' });
    view.innerHTML = `
      <div class="kr-hud" role="group" aria-label="Uhr und Tipps">
        <div class="kr-clock" role="timer" aria-label="Uhrzeit im Spiel"><span class="kr-time tnum"></span><small>Uhr</small></div>
        <div class="kr-night"><div class="kr-night-bar"><i></i></div><div class="kr-night-lab"><span>${fmtClock(st.start)}</span><span class="kr-left"></span><span>06:00</span></div></div>
        <button class="kr-hintbtn" type="button" data-a="hint" aria-label="Tipp holen">${clueIcon('bulb')}<span>Tipp</span><b class="tnum"></b></button>
      </div>
      <div class="kr-ticker" aria-live="polite"><span></span></div>
      <div class="kr-pane"></div>
      <nav class="kr-tabs" role="tablist" aria-label="Bereiche">${TABS.map((t) => `<button class="kr-tab" type="button" role="tab" data-tab="${t.id}">${clueIcon(t.ic)}<span>${t.label}</span><b class="kr-badge" hidden></b></button>`).join('')}</nav>`;
    body.replaceChildren(view);
    pane = view.querySelector('.kr-pane');
    view.querySelector('.kr-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      switchTab(b.dataset.tab);
    });
    view.querySelector('[data-a="hint"]').addEventListener('click', askHint);
    pane.addEventListener('click', onPaneClick);
    pane.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.kr-room[data-room]')) { e.preventDefault(); selectRoom(e.target.closest('.kr-room').dataset.room); }
    });
    pane.addEventListener('pointerdown', boardDown);
    pane.addEventListener('pointermove', boardMove);
    pane.addEventListener('pointerup', boardUp);
    pane.addEventListener('pointercancel', () => { if (drag) { drag.pin.classList.remove('drag'); drag = null; } });
    // Laufband: letzte Handlung des Partners
    const lastP = [...st.feed].reverse().find((f) => f.by === q && describe(f));
    if (lastP) tickerMsg = describe(lastP);
    renderPlay();
    if (fromIntro && motionOK()) startFx();
  }
  async function startFx() {
    const t = h('div', { class: 'kr-trans', 'aria-hidden': 'true' });
    t.innerHTML = `<div class="kr-trans-in"><span class="kr-trans-k">${esc(C.date)}</span><b class="tnum">${fmtClock(st.start)}</b><span>Die Ermittlung beginnt.</span></div>`;
    document.body.append(t);
    sfx.thunder();
    flash('#cfe0ff', .35);
    await sleep(1700);
    t.classList.add('out');
    await sleep(500);
    t.remove();
  }

  function switchTab(tab) {
    if (local.tab === tab) { pane.scrollIntoView?.({ block: 'start' }); return; }
    local.tab = tab;
    threadFrom = null;
    saveLocal();
    sfx.tap(); haptic(6);
    renderPlay(true);
    window.scrollTo({ top: 0 });
  }

  function renderPlay(tabChanged = false) {
    if (!view?.classList.contains('kr-view')) return;
    renderHud();
    view.querySelectorAll('.kr-tab').forEach((b) => {
      const on_ = b.dataset.tab === local.tab;
      b.setAttribute('aria-selected', String(on_));
      b.classList.toggle('on', on_);
    });
    const unseen = st.order[p].filter((id) => !local.seen[id]).length;
    setBadge('file', unseen);
    setBadge('accuse', st.phase === 'accuse' || (st.sign[q] && st.sign[q] === st.formV && !st.sign[p]) ? '!' : 0);
    setBadge('talk', st.with[p] ? '•' : 0);
    view.classList.toggle('dawn', st.phase === 'accuse');
    if (drag && local.tab === 'board') { deferBoard = true; return; }
    const keep = tabChanged ? 0 : window.scrollY;
    pane.dataset.tab = local.tab;
    if (local.tab === 'map') renderMap();
    else if (local.tab === 'file') renderFile();
    else if (local.tab === 'board') renderBoard();
    else if (local.tab === 'talk') renderTalk();
    else renderAccuse();
    if (tabChanged && motionOK()) pane.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' });
    else if (!tabChanged) window.scrollTo(0, keep);
    clueSh?.refresh?.();
  }
  function setBadge(tab, n) {
    const b = view.querySelector(`[data-tab="${tab}"] .kr-badge`);
    if (!b) return;
    b.hidden = !n;
    b.textContent = n ? String(n) : '';
  }
  let lastClock = null;
  function renderHud() {
    const t = view.querySelector('.kr-time');
    const txt = fmtClock(st.clock);
    if (t.textContent !== txt) {
      t.textContent = txt;
      if (lastClock != null && motionOK()) t.animate([{ transform: 'translateY(-35%)', opacity: .2 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      lastClock = st.clock;
    }
    const total = st.end - st.start;
    const done = Math.min(1, Math.max(0, (st.clock - st.start) / total));
    view.querySelector('.kr-night-bar i').style.width = (done * 100).toFixed(1) + '%';
    const left = Math.max(0, st.end - st.clock);
    view.querySelector('.kr-left').textContent = st.phase === 'accuse' ? 'Morgengrauen' : `noch ${Math.floor(left / 60)} Std. ${String(left % 60).padStart(2, '0')} Min.`;
    view.querySelector('.kr-night').classList.toggle('late', left <= 60);
    const hb = view.querySelector('.kr-hintbtn');
    hb.querySelector('b').textContent = hintsLeft(st);
    hb.disabled = st.phase !== 'play' || hintsLeft(st) <= 0;
    view.querySelector('.kr-ticker span').textContent = tickerMsg || (st.phase === 'accuse' ? 'Die Nacht ist vorbei. Reicht eure Anklage ein!' : `${titleOf(q)} ist ${roomOf(st.pos[q])?.name ? 'hier: ' + roomOf(st.pos[q]).name : 'unterwegs'}.`);
  }
  function costFx(f) {
    if (!f.cost || !motionOK()) return;
    const clock = view?.querySelector('.kr-clock');
    if (!clock) return;
    const chip = h('span', { class: `kr-costfx ${f.by === p ? 'me' : 'them'}` }, `−${f.cost} Min`);
    clock.append(chip);
    setTimeout(() => chip.remove(), 1500);
  }

  // ---------- Klicks im Inhaltsbereich ----------
  function onPaneClick(e) {
    const a = e.target.closest('[data-a]');
    const room = e.target.closest('.kr-room[data-room]');
    if (!a && room) { selectRoom(room.dataset.room); return; }
    if (!a) return;
    const act = a.dataset.a;
    if (act === 'floor') { local.floor = a.dataset.floor; local.sel = null; saveLocal(); sfx.tap(); renderPlay(); return; }
    if (act === 'go') { goTo(a.dataset.room); return; }
    if (act === 'spot') { a.disabled = true; sfx.tap(); haptic(8); addEvent(sid, 'search', { room: st.pos[p], spot: a.dataset.spot }); return; }
    if (act === 'totalk') { switchTab('talk'); return; }
    if (act === 'emil') { switchTab('talk'); startTalk('emil'); return; }
    if (act === 'clue') { openClue(a.dataset.clue); return; }
    if (act === 'kind') { local.kind = a.dataset.kind; saveLocal(); sfx.tap(); renderPlay(); return; }
    if (act === 'sus') { startTalk(a.dataset.who); return; }
    if (act === 'topic') { a.disabled = true; sfx.tap(); addEvent(sid, 'ask', { who: st.with[p], topic: a.dataset.topic }); return; }
    if (act === 'show') { openShowPicker(st.with[p]); return; }
    if (act === 'prints') { a.disabled = true; sfx.click(); addEvent(sid, 'prints', { who: st.with[p] }); return; }
    if (act === 'leave') { sfx.door(); addEvent(sid, 'leave', {}); return; }
    if (act === 'addpin') { openPinPicker(); return; }
    if (act === 'cancel-thread') { threadFrom = null; renderPlay(); return; }
    if (act === 'opt') { pickOpt(a); return; }
    if (act === 'sign') { sign(); return; }
    if (act === 'unsign') { sfx.tap(); addEvent(sid, 'unsign', {}); return; }
    if (act === 'tab') { switchTab(a.dataset.tab); return; }
  }
  function selectRoom(id) {
    local.sel = id;
    local.floor = floorOf(id);
    saveLocal();
    sfx.tap(); haptic(5);
    renderPlay();
    pane.querySelector('.kr-roomcard')?.scrollIntoView?.({ block: 'nearest', behavior: motionOK() ? 'smooth' : 'auto' });
  }
  function goTo(room) {
    const can = canEnter(st, p, room);
    if (!can.ok) { toast(can.msg, { icon: 'lock' }); sfx.bad(); return; }
    if (can.unlock) sfx.unlock(); else sfx.door();
    haptic(10);
    local.sel = room;
    local.floor = floorOf(room);
    saveLocal();
    addEvent(sid, 'go', { room });
  }

  // =====================================================================
  // Karte
  // =====================================================================
  function renderMap() {
    const floor = local.floor || floorOf(st.pos[p]);
    const sel = local.sel && roomOf(local.sel)?.floor === floor ? local.sel : (floorOf(st.pos[p]) === floor ? st.pos[p] : null);
    const bodies = ['weinkeller'];
    if (st.flags.emilFound) bodies.push('spa');
    const people = { [C.meet]: C.order.filter((w) => placeOf(w) === C.meet && alive(st, w)).length };
    if (alive(st, 'emil')) people.portiersloge = 1;
    const plan = planSVG({
      ...PLAN, floor, sel, me: p, pos: st.pos, body: bodies, people, initial,
      locked: (id) => !st.open[id] && !!roomOf(id).lock && !canEnter(st, p, id).ok,
      dots: (id) => roomOf(id).spots.map((sp) => ({ mine: st.searched[p][`${id}.${sp.id}`], theirs: st.searched[q][`${id}.${sp.id}`] })),
    });
    pane.innerHTML = `
      <div class="kr-floors" role="tablist" aria-label="Stockwerk">${C.floors.map((f) => {
        const here = ['jos', 'joh'].filter((x) => floorOf(st.pos[x]) === f.id);
        return `<button type="button" role="tab" data-a="floor" data-floor="${f.id}" aria-selected="${f.id === floor}" class="${f.id === floor ? 'on' : ''}"><span>${f.name}</span>${here.map((x) => `<i class="kr-fdot ${x}"></i>`).join('')}</button>`;
      }).join('')}</div>
      <div class="kr-planwrap">${plan}</div>
      <div class="kr-legend"><span><i class="kr-ldot mine"></i>von dir durchsucht</span><span><i class="kr-ldot theirs"></i>von ${esc(nameOf(q))}</span></div>
      ${sel ? roomCard(sel) : `<p class="kr-pick">Tippe auf einen Raum.</p>`}`;
  }
  function roomCard(id) {
    const r = roomOf(id);
    const here = st.pos[p] === id;
    const partnerHere = st.pos[q] === id;
    const can = canEnter(st, p, id);
    const spots = r.spots.map((sp) => {
      const info = spotInfo(st, p, id, sp);
      const doneSame = info.mine != null && info.mineVi === info.fresh;
      const dis = !here || !info.ok || doneSame || st.phase !== 'play';
      const marks = `${info.mine != null ? `<span class="kr-mk mine">${clueIcon('search')}${fmtClock(info.mine)}</span>` : ''}${info.theirs != null ? `<span class="kr-mk theirs">${esc(initial(q))} ${fmtClock(info.theirs)}</span>` : ''}`;
      return `<li><button class="kr-spot${doneSame ? ' done' : ''}${!info.ok ? ' blocked' : ''}" type="button" data-a="spot" data-spot="${sp.id}" ${dis ? 'disabled' : ''}>
        <span class="kr-spot-ic">${clueIcon(!info.ok ? 'lock' : doneSame ? 'search' : 'search')}</span>
        <span class="kr-spot-n">${esc(sp.n)}${!info.ok && here ? `<small>${esc(info.msg)}</small>` : doneSame ? '<small>Durchsucht – mehr gibt es hier nicht.</small>' : info.mine != null ? '<small>Etwas hat sich verändert – nochmal nachsehen?</small>' : ''}</span>
        <span class="kr-spot-c tnum">${doneSame ? '✓' : `${info.cost} Min`}</span>
        ${marks ? `<span class="kr-spot-m">${marks}</span>` : ''}</button></li>`;
    }).join('');
    let action = '';
    if (!here) {
      action = can.ok
        ? `<button class="btn primary block" type="button" data-a="go" data-room="${id}" ${st.phase !== 'play' ? 'disabled' : ''}>${clueIcon('walk')}<span>${can.unlock ? 'Aufsperren & hineingehen' : 'Hierher gehen'} (${moveCost(st, p, id)} Min)</span></button>`
        : `<p class="kr-locked">${clueIcon('lock')}<span>${esc(can.msg)}</span></p>`;
    }
    const meet = r.meet ? `<button class="btn block" type="button" data-a="totalk">${clueIcon('people')}<span>Zu den Verhören</span></button>` : '';
    const emil = r.emil && alive(st, 'emil') ? `<button class="btn block" type="button" data-a="emil">${clueIcon('ear')}<span>Mit Emil sprechen</span></button>` : '';
    return `<article class="kr-roomcard${here ? ' here' : ''}">
      <header><h3>${esc(r.name)}</h3><span class="kr-floortag">${esc(C.floors.find((f) => f.id === r.floor).name)}</span></header>
      <p class="kr-room-d">${esc(r.d)}</p>
      <p class="kr-room-who">${here ? `<span class="kr-who me">${miniHalf(p)}Du bist hier</span>` : ''}${partnerHere ? `<span class="kr-who them">${miniHalf(q)}${esc(nameOf(q))} ist hier</span>` : ''}</p>
      ${action}
      ${r.spots.length ? `<ul class="kr-spots${here ? '' : ' preview'}">${spots}</ul>` : ''}
      ${here ? meet + emil : ''}
    </article>`;
  }

  // =====================================================================
  // Akte
  // =====================================================================
  function renderFile() {
    const ids = [...st.order[p]].reverse();
    const counts = {};
    for (const id of ids) counts[C.clues[id].k] = (counts[C.clues[id].k] || 0) + 1;
    const kinds = KIND_ORDER.filter((k) => counts[k]);
    if (local.kind !== 'all' && !counts[local.kind]) local.kind = 'all';
    const list = ids.filter((id) => local.kind === 'all' || C.clues[id].k === local.kind);
    const pend = pendingRadio(st, p);
    pane.innerHTML = `
      <div class="kr-filehead"><h3>Deine Akte</h3><span class="tnum">${ids.length} Einträge</span></div>
      ${ids.length ? `<div class="chips scroll kr-kinds" role="group" aria-label="Filter">
        <button class="chip" type="button" data-a="kind" data-kind="all" aria-pressed="${local.kind === 'all'}">Alle ${ids.length}</button>
        ${kinds.map((k) => `<button class="chip" type="button" data-a="kind" data-kind="${k}" aria-pressed="${local.kind === k}">${esc(C.kinds[k].many)} ${counts[k]}</button>`).join('')}</div>` : ''}
      ${pend.length ? `<p class="kr-pending">${clueIcon('radio')}<span>Funk unterwegs: ${pend.map((r) => `${esc(C.clues[r.clue].t)} – Antwort ca. ${fmtClock(r.due)}`).join(' · ')}</span></p>` : ''}
      ${list.length ? `<ol class="kr-cards">${list.map((id, i) => cardHTML(id, i)).join('')}</ol>`
        : `<div class="kr-empty">${clueIcon('folder')}<p>Noch leer. Durchsuche Räume und verhöre die Verdächtigen – alles, was du findest, landet hier. Nur auf <b>deinem</b> Handy.</p></div>`}`;
  }
  function cardHTML(id, i = 0) {
    const c = C.clues[id];
    const f = st.files[p][id];
    const tags = [];
    if (!local.seen[id]) tags.push('<i class="kr-t new">neu</i>');
    if (st.pins[id]) tags.push(`<i class="kr-t pin">${clueIcon('pin')}</i>`);
    if (st.radio.some((r) => r.by === p && r.clue === id && !r.done)) tags.push(`<i class="kr-t radio">${clueIcon('radio')}</i>`);
    return `<li style="--i:${Math.min(i, 12)}"><button class="kr-cardbtn k-${c.k}" type="button" data-a="clue" data-clue="${id}">
      <span class="kr-cb-ic">${c.k === 'aussage' ? portrait(c.who) : clueIcon(c.ic || kIcon(c.k))}</span>
      <span class="kr-cb-body"><span class="kr-cb-t">${esc(c.t)}</span><span class="kr-cb-k">${esc(C.kinds[c.k].label)}${f ? ` · ${fmtClock(f.at)}` : ''}</span></span>
      <span class="kr-cb-tags">${tags.join('')}</span></button></li>`;
  }
  function markSeen(id) {
    if (local.seen[id]) return;
    local.seen[id] = 1;
    saveLocal();
  }
  function clueArt(id) {
    const c = C.clues[id];
    if (c.k === 'aussage') return `<div class="kr-art-portrait">${portrait(c.who)}</div>`;
    if (c.k === 'fp') return `<div class="kr-art-fp">${fingerprint(personOf(c.who).fpc, { seed: c.who })}</div>`;
    if (id === 'wachsabdruck') return `<div class="kr-art-fp wax">${fingerprint(personOf('wendt').fpc, { seed: 'wendt', partial: true, rot: 24, ink: '#6f4b16', bg: '#ecd9a6' })}</div>`;
    if (id === 'uhr') return `<div class="kr-art-watch">${watchArt()}</div>`;
    if (id === 'leiche' || id === 'leiche2') return `<div class="kr-art-bag blood">${splat(id, { cls: 'kr-bag-splat' })}${clueIcon('body')}</div>`;
    return `<div class="kr-art-bag k-${c.k}">${clueIcon(c.ic || kIcon(c.k))}<span class="kr-bag-tag">${esc(C.kinds[c.k].label)}</span></div>`;
  }

  function openClue(id, o = {}) {
    const c = C.clues[id];
    if (!c) return;
    const mine = has(st, p, id);
    if (mine) markSeen(id);
    const box = h('div', { class: `kr-clue k-${c.k}` });
    const f = st.files[p][id];
    box.innerHTML = `
      <div class="kr-clue-art">${clueArt(id)}</div>
      <p class="kr-clue-kind">${esc(C.kinds[c.k].label)}${f ? ` · gefunden um ${fmtClock(f.at)}` : ''}</p>
      <h3 class="kr-clue-t">${esc(c.t)}</h3>
      <p class="kr-clue-x">${esc(fill(c.x, p))}</p>
      <div class="kr-clue-acts"></div>`;
    const acts = box.querySelector('.kr-clue-acts');
    const refresh = () => {
      if (!acts.isConnected) return;
      const out = [];
      const pin = st.pins[id];
      if (mine || has(st, p, id)) {
        if (pin) out.push(`<p class="kr-ok">${clueIcon('pin')}<span>Hängt an der Tafel${pin.by !== p ? ` (von ${esc(nameOf(pin.by))})` : ''}.</span></p>`);
        else if (pinsLeft(st) > 0 && st.phase !== 'end') out.push(`<button class="btn block" type="button" data-x="pin">${clueIcon('pin')}<span>An die Tafel pinnen (noch ${pinsLeft(st)} Nadeln)</span></button>`);
        else out.push(`<p class="kr-note">${clueIcon('pin')}<span>Keine Nadel frei – nehmt erst eine Spur von der Tafel.</span></p>`);
        if (c.r) {
          const pend = st.radio.find((r) => r.by === p && r.clue === id && !r.done);
          if (has(st, p, c.r)) out.push(`<button class="btn block" type="button" data-x="reply">${clueIcon('radio')}<span>Antwort von Dr. Kranz lesen</span></button>`);
          else if (pend) out.push(`<p class="kr-note">${clueIcon('radio')}<span>Funk ist raus – Antwort gegen ${fmtClock(pend.due)} Uhr.</span></p>`);
          else if (st.phase === 'play') out.push(`<button class="btn block" type="button" data-x="radio">${clueIcon('radio')}<span>An die Gerichtsmedizin funken (${COST.radio} Min)</span></button>`);
        }
        if (c.tool === 'cipher') out.push(`<button class="btn primary block" type="button" data-x="cipher">${clueIcon('diary')}<span>${has(st, p, 'tagebuch_klar') ? 'Entschlüsselt lesen' : 'Entschlüsseln'}</span></button>`);
        if (c.tool === 'safe') out.push(has(st, p, 'testament') ? `<p class="kr-ok">${clueIcon('safe')}<span>Geöffnet.</span></p>` : `<button class="btn primary block" type="button" data-x="safe">${clueIcon('safe')}<span>${st.pos[p] === C.safe.room ? 'Zahlenräder drehen' : 'Nur im Büro zu öffnen'}</span></button>`);
        if (c.tool === 'rub') out.push(`<button class="btn primary block" type="button" data-x="rub">${clueIcon('pad')}<span>${has(st, p, 'erpressung') ? 'Durchdruck ansehen' : 'Mit Bleistift schraffieren'}</span></button>`);
        if (c.tool === 'fp' || (c.k === 'fp' && has(st, p, 'wachsabdruck'))) out.push(`<button class="btn primary block" type="button" data-x="fp">${clueIcon('print')}<span>Abdrücke vergleichen</span></button>`);
        if (c.tool === 'chess') out.push(`<button class="btn primary block" type="button" data-x="chess">${clueIcon('chess')}<span>Protokoll ansehen</span></button>`);
      } else if (pin) {
        out.push(`<p class="kr-note">${clueIcon('pin')}<span>Von ${esc(nameOf(pin.by))} an die Tafel gehängt. Nicht in deiner Akte.</span></p>`);
      }
      acts.innerHTML = out.join('');
    };
    acts.addEventListener('click', (e) => {
      const x = e.target.closest('[data-x]')?.dataset.x;
      if (!x) return;
      if (x === 'pin') { pinClue(id); sh.close(); return; }
      if (x === 'reply') { openClue(c.r); return; }
      if (x === 'radio') { sfx.static(); haptic(10); addEvent(sid, 'radio', { clue: id }); return; }
      if (x === 'cipher') { tool = openCipher({ solved: has(st, p, 'tagebuch_klar'), onSolve: (key) => addEvent(sid, 'cipher', { key }) }); return; }
      if (x === 'safe') { tool = openSafe({ here: st.pos[p] === C.safe.room, onTry: (code) => addEvent(sid, 'safe', { code }) }); return; }
      if (x === 'rub') { tool = openRub({ solved: has(st, p, 'erpressung'), onDone: () => addEvent(sid, 'rub', {}) }); return; }
      if (x === 'fp') { openFpTool(); return; }
      if (x === 'chess') { tool = openChess(); }
    });
    refresh();
    const sh = sheet({ body: box, cls: 'kr-sheet kr-clue-sheet', label: c.t, onClose: () => { if (clueSh?.box === box) clueSh = null; } });
    clueSh = { box, refresh, id };
    if (motionOK()) box.querySelector('.kr-clue-art')?.animate([{ transform: 'rotate(-6deg) scale(.86)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    if (!o.quiet) sfx.flip();
    if (local.tab === 'file') renderPlay();
  }
  function openFpTool() {
    const cards = C.order.filter((w) => has(st, p, 'fp_' + w)).map((w) => ({ who: w, name: personOf(w).name }));
    tool = openFp({ cards, spec: (w) => personOf(w).fpc, hasSpur: has(st, p, 'wachsabdruck'), solved: has(st, p, 'fp_treffer'), onConfirm: (who) => addEvent(sid, 'fp', { who }) });
  }

  // =====================================================================
  // Tafel
  // =====================================================================
  function freeSpot() {
    const pins = Object.values(st.pins);
    let best = { x: .5, y: .5 }, bestD = -1;
    for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < 3; gx++) {
      const x = gx / 2, y = gy / 6;
      const d = pins.length ? Math.min(...pins.map((pp) => Math.hypot((pp.x - x) * 1.4, pp.y - y))) : 1 - Math.abs(y - .3);
      if (d > bestD) { bestD = d; best = { x, y }; }
    }
    return { x: Math.min(1, Math.max(0, best.x + (Math.random() - .5) * .08)), y: Math.min(1, Math.max(0, best.y + (Math.random() - .5) * .05)) };
  }
  function pinClue(id) {
    if (st.pins[id]) return;
    if (pinsLeft(st) <= 0) { toast('Keine Nadeln mehr frei.', { icon: 'info' }); return; }
    const pos = freeSpot();
    sfx.pop(); haptic(10);
    addEvent(sid, 'pin', { clue: id, x: pos.x, y: pos.y });
    toast(`»${C.clues[id].t}« hängt jetzt an der Tafel.`, { icon: 'check', action: { label: 'Zur Tafel', run: () => switchTab('board') } });
  }
  function renderBoard() {
    const pins = Object.entries(st.pins);
    pane.innerHTML = `
      <div class="kr-boardhead"><div><h3>Ermittlungstafel</h3><p>Für euch beide. Ziehen zum Verschieben, antippen für Faden & mehr.</p></div>
        <span class="kr-pincount tnum" title="Freie Nadeln">${clueIcon('pin')}${pinsLeft(st)}/${st.pinsMax}</span></div>
      ${threadFrom ? `<button class="kr-threadbar" type="button" data-a="cancel-thread">${clueIcon('thread')}<span>Roter Faden von »${esc(C.clues[threadFrom].t)}« – tippe die zweite Spur an. <u>Abbrechen</u></span></button>` : ''}
      <div class="kr-board${threadFrom ? ' threading' : ''}">
        <svg class="kr-threads" aria-hidden="true"></svg>
        <div class="kr-victim">${portrait('konrad', { dead: true })}<span>Konrad Falkner<br><small>† 21:52?</small></span></div>
        ${pins.map(([id, pin]) => pinHTML(id, pin)).join('')}
        ${pins.length ? '' : '<p class="kr-board-empty">Noch leer. Öffne eine Spur in deiner Akte und pinne sie an – dann kann dein Partner sie auch lesen.</p>'}
      </div>
      <button class="btn block" type="button" data-a="addpin" ${pinsLeft(st) <= 0 ? 'disabled' : ''}>${clueIcon('pin')}<span>Spur aus meiner Akte anpinnen</span></button>
      ${st.erk.length ? `<section class="kr-erks"><h4>${clueIcon('bulb')}Erkenntnisse</h4><ol>${st.erk.map((id, i) => `<li style="--i:${i}"><button type="button" data-a="clue" data-clue="${id}">${clueIcon('bulb')}<span>${esc(C.clues[id].t)}</span></button></li>`).join('')}</ol></section>` : '<p class="kr-erk-hint">Tipp: Zwei Spuren, die zusammengehören, mit einem roten Faden verbinden – dann kommt euch vielleicht eine Erkenntnis.</p>'}`;
    requestAnimationFrame(() => drawThreads());
  }
  function pinHTML(id, pin) {
    const c = C.clues[id];
    const rot = (hashOf(id) % 9) - 4;
    const mine = has(st, p, id);
    return `<button class="kr-pin k-${c.k} by-${pin.by}${threadFrom === id ? ' from' : ''}${mine ? '' : ' foreign'}" type="button" data-clue="${id}" style="--x:${pin.x};--y:${pin.y};--r:${rot}deg" aria-label="${esc(c.t)}">
      <i class="kr-pushpin"></i>
      <span class="kr-pin-ic">${c.k === 'aussage' ? portrait(c.who) : clueIcon(c.ic || kIcon(c.k))}</span>
      <span class="kr-pin-t">${esc(c.t)}</span>
      <span class="kr-pin-k">${esc(C.kinds[c.k].label)}</span></button>`;
  }
  function pinCenter(board, el_) {
    const W = board.clientWidth, H = board.clientHeight;
    const x = +el_.style.getPropertyValue('--x'), y = +el_.style.getPropertyValue('--y');
    const pw = el_.offsetWidth, ph = el_.offsetHeight;
    return [x * (W - pw) + pw / 2, y * (H - ph) + 9];
  }
  function drawThreads() {
    const board = pane?.querySelector('.kr-board');
    if (!board) return;
    const svg = board.querySelector('.kr-threads');
    const W = board.clientWidth, H = board.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const pos = {};
    board.querySelectorAll('.kr-pin').forEach((el_) => { pos[el_.dataset.clue] = pinCenter(board, el_); });
    svg.innerHTML = st.threads.filter(([a, b]) => pos[a] && pos[b]).map(([a, b]) => {
      const [x1, y1] = pos[a], [x2, y2] = pos[b];
      const sag = Math.min(60, Math.hypot(x2 - x1, y2 - y1) * .18);
      const erk = C.combos.some((cb) => st.erk.includes(cb.g) && ((cb.a.includes(a) && cb.b.includes(b)) || (cb.a.includes(b) && cb.b.includes(a))));
      return `<path class="kr-thread${erk ? ' erk' : ''}" d="M${x1} ${y1}Q${(x1 + x2) / 2} ${(y1 + y2) / 2 + sag} ${x2} ${y2}"/>`;
    }).join('');
  }
  function boardDown(e) {
    const pin = e.target.closest('.kr-pin');
    if (!pin || local.tab !== 'board') return;
    const board = pin.closest('.kr-board');
    const r = board.getBoundingClientRect();
    drag = { pin, id: pin.dataset.clue, x0: e.clientX, y0: e.clientY, moved: false, r, w: pin.offsetWidth, h: pin.offsetHeight, ox: e.clientX - pin.getBoundingClientRect().left, oy: e.clientY - pin.getBoundingClientRect().top };
    pin.setPointerCapture?.(e.pointerId);
  }
  function boardMove(e) {
    if (!drag) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved && Math.hypot(dx, dy) < 7) return;
    if (!drag.moved) { drag.moved = true; drag.pin.classList.add('drag'); sfx.tap(); }
    const x = Math.min(1, Math.max(0, (e.clientX - drag.r.left - drag.ox) / Math.max(1, drag.r.width - drag.w)));
    const y = Math.min(1, Math.max(0, (e.clientY - drag.r.top - drag.oy) / Math.max(1, drag.r.height - drag.h)));
    drag.pin.style.setProperty('--x', x.toFixed(3));
    drag.pin.style.setProperty('--y', y.toFixed(3));
    drag.nx = x; drag.ny = y;
    drawThreads();
  }
  function boardUp() {
    if (!drag) return;
    const d = drag;
    drag = null;
    d.pin.classList.remove('drag');
    if (d.moved) {
      addEvent(sid, 'pmove', { clue: d.id, x: d.nx, y: d.ny });
      if (deferBoard) { deferBoard = false; renderPlay(); }
      return;
    }
    if (threadFrom && threadFrom !== d.id) {
      const a = threadFrom;
      threadFrom = null;
      sfx.draw(); haptic(12);
      addEvent(sid, 'thread', { a, b: d.id });
      return;
    }
    if (threadFrom === d.id) { threadFrom = null; renderPlay(); return; }
    openPinMenu(d.id);
  }
  function openPinMenu(id) {
    const c = C.clues[id];
    const linked = st.threads.filter(([a, b]) => a === id || b === id);
    const box = h('div', { class: 'kr-pinmenu stack' });
    box.innerHTML = `<p class="kr-pm-k">${esc(C.kinds[c.k].label)} · angepinnt von ${esc(nameOf(st.pins[id]?.by))}</p>
      <button class="btn primary block" type="button" data-x="read">${clueIcon('search')}<span>Lesen</span></button>
      <button class="btn block" type="button" data-x="thread">${clueIcon('thread')}<span>Roten Faden ziehen</span></button>
      ${linked.length ? `<button class="btn block" type="button" data-x="cut">${clueIcon('thread')}<span>Fäden lösen (${linked.length})</span></button>` : ''}
      <button class="btn quiet block" type="button" data-x="unpin">${clueIcon('pin')}<span>Von der Tafel nehmen</span></button>`;
    const sh = sheet({ title: c.t, body: box, cls: 'kr-sheet' });
    box.addEventListener('click', (e) => {
      const x = e.target.closest('[data-x]')?.dataset.x;
      if (!x) return;
      sh.close(true);
      if (x === 'read') openClue(id);
      else if (x === 'thread') { threadFrom = id; sfx.tap(); renderPlay(); }
      else if (x === 'cut') { for (const [a, b] of linked) addEvent(sid, 'unthread', { a, b }); sfx.tap(); }
      else if (x === 'unpin') { sfx.whoosh(); addEvent(sid, 'unpin', { clue: id }); }
    });
  }
  function openPinPicker() {
    const ids = [...st.order[p]].reverse().filter((id) => !st.pins[id]);
    const box = h('div', { class: 'kr-picker stack' });
    box.innerHTML = ids.length ? `<p class="soft small">Noch ${pinsLeft(st)} Nadeln frei. Was an der Tafel hängt, kann ${esc(nameOf(q))} lesen.</p><ol class="kr-cards small">${ids.map((id) => cardHTML(id)).join('')}</ol>` : '<p class="soft">Alles aus deiner Akte hängt schon an der Tafel – oder die Akte ist noch leer.</p>';
    const sh = sheet({ title: 'Spur anpinnen', body: box, cls: 'kr-sheet' });
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-clue]');
      if (!b) return;
      sh.close(true);
      pinClue(b.dataset.clue);
    });
  }

  // =====================================================================
  // Verhöre
  // =====================================================================
  function startTalk(who) {
    const pe = personOf(who);
    if (!alive(st, who)) { toast(`${pe.short} kann nicht mehr reden.`, { icon: 'info' }); return; }
    const place = placeOf(who);
    if (st.pos[p] !== place) {
      const can = canEnter(st, p, place);
      if (!can.ok) { toast(can.msg, { icon: 'lock' }); return; }
      addEvent(sid, 'go', { room: place });
    }
    sfx.door(); haptic(8);
    addEvent(sid, 'talk', { who });
  }
  function renderTalk() {
    const who = st.with[p];
    if (!who) { renderSuspects(); return; }
    const pe = personOf(who);
    const log = st.talks[p][who] || [];
    const together = st.with[q] === who;
    const split = st.with[q] && st.with[q] !== who ? st.with[q] : null;
    const items = [];
    for (const e of log) {
      if (e.k === 'intro') items.push({ q: null, a: pe.intro.a, g: pe.intro.g });
      else if (e.k === 'ask') { const t = pe.topics.find((x) => x.id === e.id); items.push({ q: t?.q, a: t?.a, g: t?.g, bluff: t?.bluff, together: t?.together }); }
      else if (e.k === 'show') { const en = e.i >= 0 ? pe.show[e.i] : null; items.push({ q: `Du hältst ${pe.short} vor: »${C.clues[e.id].t}«`, a: en ? en.a : pe.nope[e.ni || 0], g: en?.g, show: true, nope: !en }); }
      else if (e.k === 'prints') items.push({ q: 'Du nimmst die Fingerabdrücke ab.', a: 'Stempelkissen, Hotelbriefpapier, ein sauberer Abdruck des rechten Daumens.', g: ['fp_' + who] });
    }
    const special = (t) => (t.bluff || t.together ? 1 : 0);
    const topics = topicsFor(st, p, who).filter((t) => !t.asked).sort((x, y) => special(y) - special(x));
    const tc = costFor(st, p, 'talk', COST.talk);
    const key = `${who}:${log.length}`;
    const freshAnswer = local.talkSeen[who] !== log.length;
    pane.innerHTML = `
      <div class="kr-int">
        <header class="kr-int-head">
          <span class="kr-int-img">${portrait(who)}</span>
          <div class="kr-int-id"><h3>${esc(pe.name)}</h3><p>${esc(pe.role)} · ${pe.age}</p>
            ${together ? `<p class="kr-int-flag duo">${clueIcon('people')}<span>Kreuzverhör: Ihr seid beide hier.</span></p>` : ''}
            ${split ? `<p class="kr-int-flag split">${clueIcon('ear')}<span>${esc(nameOf(q))} verhört gerade ${esc(personOf(split).short)}.</span></p>` : ''}</div>
          <button class="iconbtn kr-leave" type="button" data-a="leave" aria-label="Gespräch beenden">${clueIcon('walk')}</button>
        </header>
        <ol class="kr-transcript">${items.map((it, i) => `<li class="kr-ex${it.nope ? ' nope' : ''}${i === items.length - 1 ? ' last' : ''}">
          ${it.q ? `<p class="kr-q${it.bluff ? ' bluff' : ''}${it.together ? ' duo' : ''}">${esc(it.q)}</p>` : ''}
          <p class="kr-a">${esc(fill(it.a, p))}</p>
          ${it.g?.length ? `<p class="kr-gain">${clueIcon('folder')}<span>${it.g.filter((g) => C.clues[g]).map((g) => `<button type="button" data-a="clue" data-clue="${g}">${esc(C.clues[g].t)}</button>`).join('')}</span></p>` : ''}</li>`).join('')}</ol>
        ${st.phase === 'play' ? `<div class="kr-int-acts">
          <button class="btn primary" type="button" data-a="show">${clueIcon('search')}<span>Beweis vorhalten</span><small class="tnum">${tc} Min</small></button>
          ${has(st, p, 'fp_' + who) ? '' : `<button class="btn" type="button" data-a="prints">${clueIcon('print')}<span>Fingerabdrücke</span><small class="tnum">${costFor(st, p, 'search', COST.prints)} Min</small></button>`}
        </div>
        <p class="kr-topics-h">Fragen</p>
        <div class="kr-topics">${topics.map((t) => `<button class="kr-topic${t.bluff ? ' bluff' : ''}${t.together ? ' duo' : ''}" type="button" data-a="topic" data-topic="${t.id}">
            ${t.bluff || t.together ? `<em>${t.bluff ? 'Bluff – nur jetzt möglich' : 'Nur zu zweit'}</em>` : ''}<span>${esc(t.q)}</span><small class="tnum">${tc} Min</small></button>`).join('') || '<p class="kr-notopics">Keine offenen Fragen mehr – aber Beweise vorhalten geht immer.</p>'}</div>` : '<p class="kr-notopics">Die Nacht ist vorbei – keine Verhöre mehr.</p>'}
      </div>`;
    if (freshAnswer) {
      local.talkSeen[who] = log.length;
      saveLocal();
      const last = pane.querySelector('.kr-ex.last');
      if (last && motionOK() && log.length) {
        last.scrollIntoView({ block: 'nearest' });
        const a = last.querySelector('.kr-a');
        const txt = a.textContent;
        a.textContent = '';
        a.classList.add('typing');
        let n = 0;
        const myKey = key;
        const step = () => {
          if (!alive_ || !a.isConnected || pane.dataset.tab !== 'talk' || `${st.with[p]}:${(st.talks[p][st.with[p]] || []).length}` !== myKey) { a.textContent = txt; a.classList.remove('typing'); return; }
          n = Math.min(txt.length, n + 3);
          a.textContent = txt.slice(0, n);
          if (n % 9 === 0) sfx.key();
          if (n < txt.length) setTimeout(step, 16); else a.classList.remove('typing');
        };
        step();
      }
    }
  }
  function renderSuspects() {
    const tc = costFor(st, p, 'talk', COST.talk);
    pane.innerHTML = `
      <div class="kr-talkhead"><h3>Verhöre</h3><p>Die Verdächtigen warten im Kaminzimmer, Emil in seiner Loge. Das erste Gespräch kostet ${tc} Minuten, jede Frage auch.</p></div>
      <div class="kr-sus-grid">${C.order.map((w, i) => {
        const pe = personOf(w);
        const dead = !alive(st, w);
        const met = !!st.met[p][w];
        const partner = st.with[q] === w;
        return `<button class="kr-sus${dead ? ' dead' : ''}${met ? ' met' : ''}" type="button" data-a="sus" data-who="${w}" style="--i:${i}" ${dead || st.phase !== 'play' ? 'disabled' : ''}>
          <span class="kr-sus-img">${portrait(w, { dead })}</span>
          <span class="kr-sus-n">${esc(pe.short)}</span><span class="kr-sus-r">${esc(pe.role)}</span>
          <span class="kr-sus-s">${dead ? 'tot' : partner ? `${esc(nameOf(q))} verhört gerade` : met ? 'schon befragt' : placeOf(w) === C.meet ? 'Kaminzimmer' : 'in seiner Loge'}</span></button>`;
      }).join('')}</div>
      <p class="kr-tipline">${clueIcon('bulb')}<span>Verhört ihr zwei Personen gleichzeitig getrennt – oder eine zu zweit –, öffnen sich manchmal neue Wege.</span></p>`;
  }
  function openShowPicker(who) {
    if (!who) return;
    const pe = personOf(who);
    const log = st.talks[p][who] || [];
    const ids = [...st.order[p]].reverse().filter((id) => C.clues[id].k !== 'fp');
    const box = h('div', { class: 'kr-picker stack' });
    box.innerHTML = ids.length ? `<p class="soft small">Was hältst du ${esc(pe.short)} vor? Ein falscher Beweis kostet trotzdem Zeit.</p>
      <ol class="kr-cards small">${ids.map((id) => {
        const r = showEntry(st, p, who, id);
        const done = log.some((e) => e.k === 'show' && e.id === id && e.i === r.i);
        return `<li><button class="kr-cardbtn k-${C.clues[id].k}${done ? ' done' : ''}" type="button" data-clue="${id}" ${done ? 'disabled' : ''}>
          <span class="kr-cb-ic">${C.clues[id].k === 'aussage' ? portrait(C.clues[id].who) : clueIcon(C.clues[id].ic || kIcon(C.clues[id].k))}</span>
          <span class="kr-cb-body"><span class="kr-cb-t">${esc(C.clues[id].t)}</span><span class="kr-cb-k">${done ? 'schon vorgehalten' : esc(C.kinds[C.clues[id].k].label)}</span></span></button></li>`;
      }).join('')}</ol>` : '<p class="soft">Deine Akte ist noch leer.</p>';
    const sh = sheet({ title: `${pe.short} vorhalten`, body: box, cls: 'kr-sheet' });
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-clue]');
      if (!b || b.disabled) return;
      sh.close(true);
      sfx.stamp(); haptic(14);
      addEvent(sid, 'show', { who, clue: b.dataset.clue });
    });
  }

  // =====================================================================
  // Anklage
  // =====================================================================
  function renderAccuse() {
    const qs = visibleQuestions(st);
    const lastBy = {};
    for (const f of st.feed) if (f.k === 'aset') lastBy[f.q] = f.by;
    const max = qs.reduce((s, x) => s + x.pts, 0);
    const complete = formComplete(st);
    const signedMe = st.sign[p] && st.sign[p] === st.formV;
    const signedThem = st.sign[q] && st.sign[q] === st.formV;
    pane.innerHTML = `
      <div class="kr-acc">
        <header class="kr-acc-head"><span class="kr-acc-seal">${clueIcon('gavel')}</span><div><h3>Anklageschrift</h3><p>Staatsanwaltschaft Innsbruck · Fall Falkner</p></div></header>
        ${st.phase === 'accuse' ? '<p class="kr-acc-dawn">06:00 – die Nacht ist vorbei, der Schneepflug ist oben. Reicht jetzt eure Anklage ein!</p>' : `<p class="kr-acc-info">Ihr füllt <b>dasselbe Blatt</b> aus – Änderungen sieht ${esc(nameOf(q))} sofort. Eingereicht ist es erst mit <b>beiden Unterschriften</b>. Wer früher fertig ist, bekommt einen Zeitbonus.</p>`}
        <ol class="kr-qs">${qs.map((qq, i) => questionHTML(qq, i, lastBy[qq.id])).join('')}</ol>
        <div class="kr-signs">${['jos', 'joh'].map((x) => {
          const sgn = st.sign[x] && st.sign[x] === st.formV;
          return `<div class="kr-sign ${x}${sgn ? ' on' : ''}"><span class="kr-sign-line">${sgn ? `<b>${esc(nameOf(x))}</b>` : ''}</span><small>${esc(titleOf(x))}</small></div>`;
        }).join('')}</div>
        ${signedMe
          ? `<button class="btn block" type="button" data-a="unsign">${clueIcon('sign2')}<span>Unterschrift zurückziehen</span></button>`
          : `<button class="btn primary big block" type="button" data-a="sign" ${complete ? '' : 'disabled'}>${clueIcon('sign2')}<span>${signedThem ? `Gegenzeichnen – ${esc(nameOf(q))} hat schon unterschrieben` : 'Unterschreiben'}</span></button>`}
        <p class="kr-acc-note">${complete ? '' : 'Erst alle Fragen beantworten. '}Jede Änderung löscht beide Unterschriften. ${max} Punkte möglich – dazu Bonus für einen geretteten Zeugen und übrige Zeit, Abzug für Tipps.</p>
      </div>`;
  }
  function questionHTML(qq, i, by) {
    const v = st.form[qq.id];
    const people = isPeopleQ(qq);
    const opts = qq.opts.map((o) => {
      const sel = qq.multi ? Array.isArray(v) && v.includes(o.id) : v === o.id;
      if (people) return `<button class="kr-opt person${sel ? ' on' : ''}" type="button" data-a="opt" data-q="${qq.id}" data-v="${o.id}" aria-pressed="${sel}">${portrait(o.id, { dead: o.id === 'emil' && !alive(st, 'emil') })}<span>${esc(personOf(o.id).short)}</span></button>`;
      return `<button class="kr-opt${sel ? ' on' : ''}" type="button" data-a="opt" data-q="${qq.id}" data-v="${o.id}" aria-pressed="${sel}"><i class="kr-box${qq.multi ? ' multi' : ''}"></i><span>${esc(o.t)}</span></button>`;
    }).join('');
    return `<li class="kr-qi${qq.big ? ' big' : ''}" data-q="${qq.id}"><p class="kr-q-t"><b class="tnum">${i + 1}</b><span>${esc(qq.q)}</span><em class="tnum">${qq.pts} P.</em></p>
      <div class="kr-opts${people ? ' people' : ''}">${opts}</div>
      ${by ? `<p class="kr-q-by">${miniHalf(by)}zuletzt geändert von ${esc(nameOf(by))}</p>` : ''}</li>`;
  }
  function pickOpt(b) {
    const qq = C.questions.find((x) => x.id === b.dataset.q);
    if (!qq || (st.phase !== 'play' && st.phase !== 'accuse')) return;
    let v = b.dataset.v;
    if (qq.multi) {
      const cur = Array.isArray(st.form[qq.id]) ? st.form[qq.id] : [];
      v = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    } else if (st.form[qq.id] === v) return;
    sfx.tap(); haptic(6);
    addEvent(sid, 'aset', { q: qq.id, v });
  }
  async function sign() {
    if (!formComplete(st)) return;
    const qs = visibleQuestions(st);
    const ok = await confirmBox({
      title: 'Anklage unterschreiben?',
      text: `Ihr klagt ${personOf(st.form.taeter)?.name || '?'} an. ${st.sign[q] === st.formV ? 'Mit deiner Unterschrift ist die Anklage eingereicht.' : `Eingereicht ist sie, sobald auch ${nameOf(q)} unterschreibt.`} (${qs.length} Fragen beantwortet)`,
      ok: 'Unterschreiben',
    });
    if (!ok || !alive_) return;
    sfx.stamp(); haptic([20, 30, 40]);
    addEvent(sid, 'sign', { v: st.formV });
  }

  // =====================================================================
  // Tipps
  // =====================================================================
  async function askHint() {
    if (st.phase !== 'play' || hintsLeft(st) <= 0) return;
    const ok = await confirmBox({ title: 'Tipp von Inspektor Hofer?', text: `Kostet ${COST.hint} Minuten und 3 Punkte. Ihr habt noch ${hintsLeft(st)}.`, ok: 'Tipp holen' });
    if (!ok || !alive_) return;
    sfx.static();
    addEvent(sid, 'hint', { n: st.hintsUsed + 1 });
  }
  function showHint(f) {
    const hnt = C.hints.find((x) => x.id === f.id);
    if (!hnt) return;
    const box = h('div', { class: 'kr-hint stack' });
    box.innerHTML = `<p class="kr-hint-k">${clueIcon('radio')}<span>Funk · ${fmtClock(f.at)} · angefordert von ${esc(nameOf(f.by))}</span></p><p class="kr-hint-x">»${esc(hnt.x)}«</p><p class="soft small">– Inspektor Hofer</p>`;
    sheet({ title: 'Tipp', body: box, cls: 'kr-sheet' });
    sfx.static();
  }

  // =====================================================================
  // Funde, Ereignisse, Partner
  // =====================================================================
  function describe(f) {
    const n = nameOf(f.by);
    switch (f.k) {
      case 'go': return `${n} geht: ${roomOf(f.room)?.name}`;
      case 'search': return `${n} durchsucht ${roomOf(f.room)?.name}: ${spotOf(f.room, f.spot)?.n}`;
      case 'talk': return `${n} verhört ${personOf(f.who)?.short}`;
      case 'ask': return `${n} befragt ${personOf(f.who)?.short}`;
      case 'show': return `${n} hält ${personOf(f.who)?.short} einen Beweis vor`;
      case 'prints': return `${n} nimmt ${personOf(f.who)?.short} die Fingerabdrücke ab`;
      case 'radio': return `${n} funkt die Gerichtsmedizin an`;
      case 'safe': return `${n} dreht am Tresor`;
      case 'cipher': return `${n} hat das Tagebuch entschlüsselt`;
      case 'rub': return `${n} schraffiert einen Notizblock`;
      case 'fp': return `${n} vergleicht Fingerabdrücke`;
      case 'pin': return `${n} hängt »${C.clues[f.clue]?.t}« an die Tafel`;
      case 'thread': return `${n} spannt einen roten Faden`;
      case 'hint': return `${n} holt einen Tipp`;
      case 'aset': return `${n} ändert die Anklageschrift`;
      case 'sign': return `${n} hat die Anklage unterschrieben`;
      default: return '';
    }
  }
  function handleFeed(list) {
    for (const f of list) {
      if (f.cost) costFx(f);
      if (f.by && f.by === q) {
        const d = describe(f);
        if (d) { tickerMsg = d; flashTicker(); }
        if (f.k === 'pin') toast(`${nameOf(q)} hat »${C.clues[f.clue].t}« an die Tafel gehängt.`, { icon: 'info', action: { label: 'Ansehen', run: () => switchTab('board') } });
        if (f.k === 'sign') { toast(`${nameOf(q)} hat die Anklage unterschrieben.`, { icon: 'check', action: { label: 'Ansehen', run: () => switchTab('accuse') } }); sfx.stamp(); }
        if (f.k === 'aset' && local.tab === 'accuse') highlightQ(f.q);
      }
      if (f.k === 'reject' && isMine(f)) { toast(f.why, { icon: 'info' }); sfx.bad(); }
      if (f.k === 'search' && isMine(f)) showFind(f);
      if ((f.k === 'safe' || f.k === 'fp') && isMine(f)) { tool?.result?.(f.ok); if (f.ok) showFind(f); }
      if ((f.k === 'cipher' || f.k === 'rub') && isMine(f)) showFind(f);
      if ((f.k === 'talk' || f.k === 'ask' || f.k === 'show' || f.k === 'prints') && isMine(f)) {
        if (f.set === 'emilSaved') setTimeout(() => { stamp('Zeuge gerettet!', innerWidth / 2, innerHeight * .3, { color: '#c9a24d' }); sfx.good(); }, 600);
        if (f.g?.length) gainFx(f.g);
        if (f.bluff && f.g?.length) setTimeout(() => stamp('Bluff!', innerWidth / 2, innerHeight * .32, { color: '#c1121f' }), 350);
      }
      if (f.k === 'radio' && isMine(f)) toast(`Funkspruch raus. Dr. Kranz antwortet gegen ${fmtClock(f.due)} Uhr.`, { icon: 'send' });
      if (f.k === 'reply' && f.to === p) {
        sfx.static(); haptic([20, 40, 20]);
        toast(`Funkspruch von Dr. Kranz: ${C.clues[f.clue].t}`, { icon: 'info', action: { label: 'Lesen', run: () => openClue(f.clue) } });
      }
      if (f.k === 'erk') erkFx(f);
      if (f.k === 'hint') {
        if (f.by === p) showHint(f);
        else { sfx.static(); toast(`${nameOf(q)} hat einen Tipp geholt.`, { icon: 'bulb', ms: 5000, action: { label: 'Lesen', run: () => showHint(f) } }); }
      }
      if (f.k === 'news' && (!f.to || f.to === p)) newsFor(f);
      if (f.k === 'dawn') queueNews({ kick: '06:00', title: 'Morgengrauen', x: 'Draußen färbt sich der Grat rot. Ein Motor brummt die Kehren herauf: Der Schneepflug ist da – und mit ihm Inspektor Hofer. Keine Ermittlungen mehr. Reicht eure Anklage ein.', after: () => switchTab('accuse'), sound: 'thunder' });
    }
  }
  function flashTicker() {
    const t = view?.querySelector('.kr-ticker');
    if (!t) return;
    t.querySelector('span').textContent = tickerMsg;
    if (motionOK()) t.animate([{ backgroundColor: 'rgba(201,162,77,.35)' }, { backgroundColor: 'rgba(201,162,77,0)' }], { duration: 900 });
  }
  function highlightQ(id) {
    const li = pane.querySelector(`.kr-qi[data-q="${id}"]`);
    if (li && motionOK()) li.animate([{ boxShadow: '0 0 0 3px rgba(201,162,77,.9)' }, { boxShadow: '0 0 0 0 rgba(201,162,77,0)' }], { duration: 1200 });
  }
  function gainFx(ids) {
    const tab = view?.querySelector('[data-tab="file"]');
    if (!tab || !motionOK()) return;
    const tr = tab.getBoundingClientRect();
    ids.slice(0, 3).forEach((id, i) => {
      const fly = h('div', { class: 'kr-fly', 'aria-hidden': 'true' });
      fly.innerHTML = `${clueIcon(C.clues[id].ic || kIcon(C.clues[id].k))}<span>${esc(C.clues[id].t)}</span>`;
      document.body.append(fly);
      const sx = innerWidth / 2, sy = innerHeight * .45;
      const a = fly.animate([
        { transform: `translate(${sx}px, ${sy}px) translate(-50%,-50%) scale(.6)`, opacity: 0 },
        { transform: `translate(${sx}px, ${sy - 30}px) translate(-50%,-50%) scale(1)`, opacity: 1, offset: .25 },
        { transform: `translate(${tr.left + tr.width / 2}px, ${tr.top + tr.height / 2}px) translate(-50%,-50%) scale(.3)`, opacity: .2 },
      ], { duration: 1100, delay: i * 160, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'backwards' });
      a.onfinish = () => { fly.remove(); tab.animate?.([{ transform: 'scale(1.18)' }, { transform: 'none' }], { duration: 260 }); };
    });
  }
  function erkFx(f) {
    sfx.sparkle(); setTimeout(() => sfx.good(), 200);
    haptic([20, 40, 20, 40, 60]);
    if (motionOK()) {
      stamp('Erkenntnis!', innerWidth / 2, innerHeight * .34, { color: '#c9a24d' });
      burst(innerWidth / 2, innerHeight * .36, { count: 26, colors: ['#c9a24d', '#f3e3b0', '#fff'], shapes: ['sparkle', 'star'], speed: [120, 320] });
    }
    if (f.by === p) setTimeout(() => { if (alive_) openClue(f.clue, { quiet: true }); }, motionOK() ? 900 : 0);
    else toast(`Erkenntnis an der Tafel: ${C.clues[f.clue].t}`, { icon: 'bulb', ms: 5000, action: { label: 'Lesen', run: () => openClue(f.clue) } });
  }
  function showFind(f) {
    let kick = '', text = '', ids = f.g || [], all = f.all || f.g || [];
    if (f.k === 'search') {
      const r = roomOf(f.room), sp = spotOf(f.room, f.spot);
      const v = f.vi >= 0 ? sp.v[f.vi] : null;
      kick = `${r.name} · ${sp.n}`;
      text = (v && v.x) || sp.x;
    } else if (f.k === 'safe') { kick = 'Wandtresor'; text = 'Ein Klicken, ein schweres Seufzen der Tür. Der Tresor ist offen.'; }
    else if (f.k === 'cipher') { kick = 'Tagebuch'; text = 'Buchstabe für Buchstabe wird aus dem Kauderwelsch Falkners Handschrift.'; }
    else if (f.k === 'rub') { kick = 'Notizblock'; text = 'Unter dem Grafit tauchen weiße Linien auf. Emils Schrift.'; }
    else if (f.k === 'fp') { kick = 'Fingerabdrücke'; text = 'Schleife, Narbe, Inselchen – die Linien decken sich.'; }
    const blood = f.blood || ids.includes('leiche2') || ids.includes('leiche');
    const box = h('div', { class: `kr-find${blood ? ' blood' : ''}` });
    box.innerHTML = `
      ${blood ? splat(f.ev || 'f', { cls: 'kr-find-splat' }) : ''}
      <p class="kr-find-k">${clueIcon('search')}<span>${esc(kick)}</span></p>
      <p class="kr-find-x">${esc(text)}</p>
      ${all.length ? `<ol class="kr-cards">${all.map((id, i) => {
        const fresh = ids.includes(id);
        return `<li style="--i:${i}"><button class="kr-cardbtn k-${C.clues[id].k} kr-found" type="button" data-clue="${id}">
          <span class="kr-cb-ic">${clueIcon(C.clues[id].ic || kIcon(C.clues[id].k))}</span>
          <span class="kr-cb-body"><span class="kr-cb-t">${esc(C.clues[id].t)}</span><span class="kr-cb-k">${fresh ? 'neu in deiner Akte' : 'hattest du schon'}</span></span>
          ${fresh ? '<span class="kr-cb-tags"><i class="kr-t new">neu</i></span>' : ''}</button></li>`;
      }).join('')}</ol>` : '<p class="kr-find-none">Nichts Auffälliges.</p>'}
      <button class="btn primary block" type="button" data-x="ok">${all.length ? 'In die Akte' : 'Weiter'}</button>`;
    const sh = sheet({ body: box, cls: 'kr-sheet kr-find-sheet', label: kick });
    for (const id of ids) markSeen(id);
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-clue]');
      if (b) { sh.close(true); openClue(b.dataset.clue); return; }
      if (e.target.closest('[data-x="ok"]')) { sh.close(); if (ids.length) gainFx(ids); }
    });
    if (blood) { sfx.heart(); setTimeout(() => sfx.heart(), 700); haptic([40, 80, 40]); if (motionOK()) flash('#8a0f14', .35); }
    else if (ids.length) { sfx.good(); haptic([10, 20]); }
    else sfx.tap();
    renderPlay();
  }
  // Ereignisse der Nacht: große Einblendungen nacheinander
  const newsQ = [];
  let newsBusy = false;
  function newsFor(f) {
    let n = null;
    if (f.id === 'mord2.saved') n = { ...C.mord2.saved, kick: '01:00' };
    else if (f.id === 'mord2.waited') n = { ...C.mord2.waited };
    else if (f.id === 'found2') n = { ...C.found2, kick: fmtClock(f.at) };
    else { const e = C.events.find((x) => x.id === f.id); if (e) n = { ...e, kick: fmtClock(e.at) }; }
    if (!n) return;
    if (n.kind === 'tick') { tickerMsg = `${n.title}: ${n.x}`; flashTicker(); sfx.tick(); return; }
    if (f.id === 'mord2.saved' && f.g?.length) n.after = () => gainFx(f.g);
    if (f.id === 'sturm') n.sound = 'whoosh';
    queueNews(n);
  }
  function queueNews(n) {
    newsQ.push(n);
    if (!newsBusy) nextNews();
  }
  function nextNews() {
    const n = newsQ.shift();
    if (!n || !alive_) { newsBusy = false; return; }
    newsBusy = true;
    const ov = h('div', { class: `kr-news${n.blood ? ' blood' : ''}`, role: 'alertdialog', 'aria-modal': 'true', 'aria-label': n.title });
    ov.innerHTML = `${n.blood ? splat(n.title, { cls: 'kr-news-splat' }) + '<div class="kr-drip"><i></i><i></i><i></i><i></i><i></i></div>' : ''}
      <div class="kr-news-card"><p class="kr-news-k tnum">${esc(n.kick || '')}</p><h2 class="kr-news-t">${esc(n.title)}</h2><p class="kr-news-x">${esc(n.x)}</p>
      <button class="btn primary block" type="button">Weiter</button></div>`;
    document.body.append(ov);
    announce(`${n.title}. ${n.x}`);
    if (n.blood) { sfx.heart(); setTimeout(() => sfx.boom(), 300); setTimeout(() => sfx.heart(), 900); haptic([60, 80, 60, 80, 120]); if (motionOK()) flash('#7a0a0f', .55); }
    else if (n.sound === 'thunder') sfx.thunder();
    else if (n.sound === 'whoosh') sfx.whoosh();
    else sfx.static();
    const btn = ov.querySelector('button');
    setTimeout(() => btn.focus(), 80);
    btn.addEventListener('click', () => {
      sfx.tap();
      ov.classList.add('out');
      setTimeout(() => { ov.remove(); n.after?.(); nextNews(); }, motionOK() ? 320 : 0);
    });
  }

  // =====================================================================
  // Auflösung
  // =====================================================================
  function saveRecord(res) {
    const all = get(RECKEY, {}) || {};
    const old = all[C.id];
    if (old?.sid === sid) return;
    if (!old || res.total > old.total) { all[C.id] = { total: res.total, rank: res.rank.title, sid, at: Date.now() }; set(RECKEY, all); }
  }
  async function mountEnd(animated) {
    typer?.finish();
    document.querySelectorAll('.kr-news').forEach((n) => n.remove());
    newsQ.length = 0; newsBusy = false;
    if (st.aborted) {
      view = h('div', { class: 'kr-end aborted' });
      view.innerHTML = `<h2 class="kr-end-rank">Ermittlung abgebrochen</h2><p class="kr-end-rx">${esc(nameOf(st.abortBy))} hat die Ermittlung beendet. Der Mörder schläft heute Nacht ruhig.</p>
        <div class="kr-end-acts"><button class="btn primary big block" type="button" data-a="again">${clueIcon('search')}<span>Neu ermitteln</span></button><button class="btn block" type="button" data-a="home">Zur Lobby</button></div>`;
      body.replaceChildren(view);
      view.addEventListener('click', endClick);
      return;
    }
    const res = st.result;
    saveRecord(res);
    if (animated && motionOK()) {
      const t = h('div', { class: 'kr-trans', 'aria-hidden': 'true' });
      t.innerHTML = '<div class="kr-trans-in"><span class="kr-trans-k">06:04 · Inspektor Hofer liest</span><b>Die Anklage</b><span>…</span></div>';
      document.body.append(t);
      sfx.door();
      await sleep(1500);
      t.classList.add('out');
      await sleep(400);
      t.remove();
      if (!alive_) return;
    }
    const acc = res.accused;
    const epi = res.culprit
      ? [...C.epilog.right, st.flags.emilDead ? C.epilog.emilDead : st.flags.emilSaved ? C.epilog.emilSaved : '', C.epilog.end].filter(Boolean)
      : [C.epilog.wrong[acc] || '', C.epilog.wrongEnd].filter(Boolean);
    const qs = C.questions;
    view = h('div', { class: `kr-end ${res.culprit ? 'won' : 'lost'}` });
    view.innerHTML = `
      <div class="kr-verdict">
        <div class="kr-v-photo">${portrait(acc || 'konrad')}</div>
        <div class="kr-v-stamp">${res.culprit ? 'SCHULDIG' : 'FALSCH'}</div>
      </div>
      <p class="kr-end-kick">${res.culprit ? 'Fall gelöst' : 'Falsche Fährte'} · ${esc(personOf(acc)?.name || '')} angeklagt</p>
      <h2 class="kr-end-rank">${esc(res.rank.title)}</h2>
      <p class="kr-end-rx">${esc(res.rank.x)}</p>
      <div class="kr-score"><b class="tnum" data-to="${res.total}">${res.total}</b><span>Punkte</span></div>
      <table class="kr-score-tab"><tbody>
        ${res.rows.map((r) => { const qq = qs.find((x) => x.id === r.id); return `<tr class="${r.ok ? 'ok' : 'no'}"><td>${r.ok ? '✓' : '✗'}</td><td>${esc(qq.q)}<small>${esc(answerText(qq, r.v))}${r.ok ? '' : ` · richtig: ${esc(answerText(qq, qq.ok))}`}</small></td><td class="tnum">${r.pts}/${r.max}</td></tr>`; }).join('')}
        <tr class="bonus"><td>+</td><td>Zeuge Emil gerettet</td><td class="tnum">${res.emil}</td></tr>
        <tr class="bonus"><td>+</td><td>Übrige Zeit (${fmtClock(st.clock)} Uhr eingereicht)</td><td class="tnum">${res.time}</td></tr>
        <tr class="bonus"><td>−</td><td>Tipps (${st.hintsUsed})</td><td class="tnum">${res.hints}</td></tr>
      </tbody></table>
      <section class="kr-epi">${epi.map((t, i) => `<p style="--i:${i}">${esc(t)}</p>`).join('')}</section>
      <section class="kr-recon"><h3>Was wirklich geschah</h3>
        <div class="kr-rc-stage"><div class="kr-rc-plan"></div><div class="kr-rc-mark"></div></div>
        <p class="kr-rc-t tnum"></p><p class="kr-rc-x"></p>
        <div class="kr-rc-ctrl"><button class="iconbtn" type="button" data-a="rc-prev" aria-label="Zurück">‹</button><button class="btn small" type="button" data-a="rc-play">Abspielen</button><button class="iconbtn" type="button" data-a="rc-next" aria-label="Weiter">›</button></div>
        <div class="kr-rc-dots"></div>
      </section>
      <dl class="kr-stats">
        <div><dt>Spuren ${esc(nameOf('jos'))}</dt><dd class="tnum">${st.order.jos.length}</dd></div>
        <div><dt>Spuren ${esc(nameOf('joh'))}</dt><dd class="tnum">${st.order.joh.length}</dd></div>
        <div><dt>Erkenntnisse</dt><dd class="tnum">${st.erk.length}/${C.combos.length}</dd></div>
        <div><dt>Tipps</dt><dd class="tnum">${st.hintsUsed}</dd></div>
      </dl>
      <div class="kr-end-acts">
        <button class="btn primary big block" type="button" data-a="again">${clueIcon('search')}<span>Nochmal ermitteln</span></button>
        <button class="btn block" type="button" data-a="home">Zur Lobby</button>
      </div>`;
    body.replaceChildren(view);
    view.addEventListener('click', endClick);
    recon(view.querySelector('.kr-recon'));
    if (animated && motionOK()) {
      setTimeout(() => { if (!alive_) return; sfx.stamp(); haptic([30, 40, 80]); }, 650);
      if (res.culprit) setTimeout(() => { if (!alive_) return; sfx.win(); burst(innerWidth / 2, innerHeight * .3, { count: 34, colors: ['#c9a24d', '#f3e3b0', '#fff'], shapes: ['star', 'sparkle'] }); }, 1100);
      else setTimeout(() => { if (alive_) sfx.lose(); }, 1100);
      const b = view.querySelector('.kr-score b');
      const to = res.total;
      const t0 = performance.now() + 900;
      b.textContent = '0';
      const step = (t) => {
        const k = Math.max(0, Math.min(1, (t - t0) / 1100));
        b.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
        if (k < 1 && alive_) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    } else view.classList.add('still');
  }
  function answerText(qq, v) {
    if (v == null || (Array.isArray(v) && !v.length)) return '–';
    const name = (id) => qq.opts.find((o) => o.id === id)?.t || id;
    return Array.isArray(v) ? v.map(name).join(', ') : name(v);
  }
  let rcTimer = null;
  function recon(sec) {
    const steps = C.recon.filter((r) => test(r.w, st));
    let i = 0;
    const dots = sec.querySelector('.kr-rc-dots');
    dots.innerHTML = steps.map((s, k) => `<i class="${s.blood ? 'b' : ''}" data-k="${k}"></i>`).join('');
    const draw = () => {
      const s = steps[i];
      const r = C.rooms[s.room];
      sec.querySelector('.kr-rc-plan').innerHTML = planSVG({ ...PLAN, floor: r.floor, sel: s.room, pos: {}, body: [] });
      const [cx, cy] = roomCenter(r);
      const mk = sec.querySelector('.kr-rc-mark');
      mk.style.left = cx + '%';
      mk.style.top = (cy / 70 * 100) + '%';
      mk.className = `kr-rc-mark${s.blood ? ' blood' : ''}`;
      mk.innerHTML = s.who ? portrait(s.who) : '<i></i>';
      sec.querySelector('.kr-rc-t').textContent = `${s.t} · ${r.name}`;
      sec.querySelector('.kr-rc-x').textContent = s.x;
      dots.querySelectorAll('i').forEach((d, k) => d.classList.toggle('on', k === i));
      if (motionOK()) {
        mk.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' });
        sec.querySelector('.kr-rc-x').animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 320 });
      }
      if (s.blood) sfx.heart(); else sfx.tick();
    };
    sec.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      const dot = e.target.closest('[data-k]');
      if (dot) { i = +dot.dataset.k; stop(); draw(); return; }
      if (a === 'rc-prev') { i = (i - 1 + steps.length) % steps.length; stop(); draw(); }
      if (a === 'rc-next') { i = (i + 1) % steps.length; stop(); draw(); }
      if (a === 'rc-play') {
        if (rcTimer) { stop(); return; }
        sec.querySelector('[data-a="rc-play"]').textContent = 'Anhalten';
        rcTimer = setInterval(() => { if (!alive_) return stop(); i = (i + 1) % steps.length; draw(); if (i === steps.length - 1) stop(); }, 3400);
      }
    });
    const stop = () => { clearInterval(rcTimer); rcTimer = null; const b = sec.querySelector('[data-a="rc-play"]'); if (b) b.textContent = 'Abspielen'; };
    draw();
  }
  function endClick(e) {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'again') { sfx.pop(); nav('#/neu/krimi'); }
    else if (a === 'home') nav('#/lobby');
  }

  // ---------- Verbindung ----------
  offs.push(on('session', ({ id }) => { if (id === sid) update(); }));
  offs.push(on('net', () => { view?.classList.toggle('alone', !(netState().status === 'online' && netState().partner)); }));
  const onResize = () => { if (local.tab === 'board') drawThreads(); };
  window.addEventListener('resize', onResize);
  update();
  return () => {
    alive_ = false;
    typer?.finish();
    clearInterval(rcTimer);
    window.removeEventListener('resize', onResize);
    document.querySelectorAll('.kr-news, .kr-fly, .kr-trans').forEach((n) => n.remove());
    offs.forEach((f) => f());
    shellOff();
  };
}
