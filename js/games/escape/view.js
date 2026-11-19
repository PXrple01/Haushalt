// Escape-Abenteuer – Oberfläche: Geschichten-Auswahl, Intro mit Schreibmaschine, Räume mit Rollen (Hände/Wissen),
// Zeit, Tipps, Tür-Übergänge, „Raum geschafft!“, Zeit-um, Finale mit Sternen und Rekorden.
import { h, esc } from '../../core/dom.js';
import { icon } from '../../art/icons.js';
import { miniHalf } from '../../art/heart.js';
import { me, prefs, get, set, on } from '../../core/store.js';
import { nameOf, other, uid, sleep } from '../../core/util.js';
import { sheet, toast, confirmBox, announce } from '../../core/ui.js';
import { motionOK } from '../../core/theme.js';
import { burst, ring, celebrate, stamp, flash } from '../../core/fx.js';
import { sfx, haptic } from '../../core/sound.js';
import { nav } from '../../core/router.js';
import { netState } from '../../core/net.js';
import { createSession, addEvent, getSession } from '../../core/sync.js';
import { shell, whoSeg, resolveWho, radioCards, partnerNote, resultCard } from '../common.js';
import { reduce, handsOf, DIFFS, MAX_HINTS, PEN, elapsed, remaining, timeUp, starsOf } from './logic.js';
import { THEMES, themeById } from './themes.js';
import { hintsFor } from './puzzles.js';
import { symbol } from './symbols.js';
import { scene } from './art.js';
import { mountPuzzle, roleLine, HAND_ICON, BOOK_ICON } from './rooms.js';

const RULES = [
  'Ihr spielt zusammen – mit zwei Handys. Verbindet sie über euren gemeinsamen Code (Weit weg).',
  'Jede Geschichte hat vier Räume. In jedem Raum ist einer an den <b>Händen</b> (sieht das Rätsel und bedient es), der andere hat das <b>Wissen</b> (Buch, Karte oder Regeln).',
  'Redet miteinander! Nur wer beschreibt, was er sieht, kommt weiter. Nach jedem Raum tauscht ihr die Rollen.',
  'Normal: 25 Minuten, Knifflig: 15 Minuten (schwerere Rätsel), Gemütlich: ohne Zeit. Fehler kosten 20 Sekunden, ein Tipp 1 Minute.',
  'Ist die Zeit um, könnt ihr ohne Zeit weiterspielen. Die Rätsel sind jedes Mal neu gemischt.',
];
const RKEY = 'escapeRecords';
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8l3.1 6.6 7.1.8-5.3 4.9 1.5 7.1L12 17.6l-6.4 3.6 1.5-7.1L1.8 9.2l7.1-.8z"/></svg>';
const GLASS = '<svg class="es-glass" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h12M6 22h12M7 2c0 5 4 6 5 10-1 4-5 5-5 10M17 2c0 5-4 6-5 10 1 4 5 5 5 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path class="es-sand" d="M9 7h6l-3 4z M8.5 20h7l-3.5-4z" fill="currentColor"/></svg>';

const fmt = (ms, up = true) => {
  const s = Math.max(0, up ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const starsHTML = (n, cls = '') => `<span class="es-starrow ${cls}" role="img" aria-label="${n} von 3 Sternen">${[1, 2, 3].map((i) => `<span class="es-star ${i <= n ? 'on' : ''}" style="--i:${i}">${STAR}</span>`).join('')}</span>`;

// Farben einer Geschichte auf ein Element legen
function paint(el, th) {
  const P = th.pal;
  el.style.setProperty('--es-bg1', P.bg1); el.style.setProperty('--es-bg2', P.bg2);
  el.style.setProperty('--es-acc', P.acc); el.style.setProperty('--es-acc2', P.acc2);
  el.style.setProperty('--es-ink', P.ink); el.style.setProperty('--es-glow', P.glow);
  el.dataset.esDark = P.dark ? '1' : '0';
  el.dataset.esTheme = th.id;
}

// ---------- Rekorde (lokal) ----------
const records = () => get(RKEY, {}) || {};
function saveRecord(themeId, rec) {
  const all = records();
  const old = all[themeId];
  const better = !old || rec.stars > old.stars || (rec.stars === old.stars && rec.ms < old.ms);
  if (old?.sid === rec.sid) return false;
  if (better) { all[themeId] = rec; set(RKEY, all); }
  return better && !!old;
}

// Buchstaben einzeln (für Titel-Animation), Wörter bleiben zusammen
const letters = (text) => esc(text).split(' ').map((w, wi) => `<span class="w">${[...w].map((ch, i) => `<span class="l" style="--i:${wi * 4 + i}">${ch}</span>`).join('')}</span>`).join(' ');

// =====================================================================
// Einstellungen: Geschichte wählen
// =====================================================================
export function setup(root) {
  const { el, body, cleanup } = shell({ root, game: 'escape', rules: RULES, mode: 'remote' });
  el.classList.add('es-setup-screen');
  if (prefs.get('code') && prefs.get('mode') !== 'remote') prefs.set('mode', 'remote');
  const recs = records();
  body.innerHTML = `
    <div class="es-setup stack">
      <div class="es-pick-head">
        <h2 class="es-ph-title">${letters('Wählt euer Abenteuer')}</h2>
        <p class="es-ph-sub">Zwei Handys, ein Ziel: raus hier! Jeder sieht etwas anderes – nur wenn ihr redet, kommt ihr weiter.</p>
      </div>
      <ol class="es-how">
        <li style="--i:0"><span class="es-how-ic">${HAND_ICON}</span><b>Hände</b><span>bedienen Schlösser, Kessel &amp; Co.</span></li>
        <li style="--i:1"><span class="es-how-ic">${BOOK_ICON}</span><b>Wissen</b><span>hat Bücher, Karten und Regeln.</span></li>
        <li style="--i:2"><span class="es-how-ic">${icon('swap')}</span><b>Tauschen</b><span>In jedem Raum wechselt ihr.</span></li>
      </ol>
      <div data-slot="link"></div>
      <div class="es-themes">${THEMES.map((th, i) => {
        const r = recs[th.id];
        return `<button class="es-tcard" type="button" data-theme="${th.id}" style="--i:${i}">
          <span class="es-tc-art">${scene(th.id)}</span>
          <span class="es-tc-body">
            <span class="es-tc-tag">${esc(th.tag)}</span>
            <span class="es-tc-title">${esc(th.title)}</span>
            <span class="es-tc-blurb">${esc(th.blurb)}</span>
            ${r ? `<span class="es-tc-rec">${starsHTML(r.stars, 'small')}<small>Rekord ${fmt(r.ms, false)} · ${esc(DIFFS[r.diff]?.title || '')}</small></span>` : '<span class="es-tc-rec new">Noch nicht gespielt</span>'}
          </span>
        </button>`;
      }).join('')}</div>
    </div>`;
  body.querySelectorAll('.es-tcard').forEach((b) => paint(b, themeById(b.dataset.theme)));

  const linkEl = body.querySelector('[data-slot="link"]');
  function renderLink() {
    const code = prefs.get('code');
    if (!code) {
      linkEl.innerHTML = `<div class="panel link-card es-link">
        <label class="label" for="es-code">Erst verbinden: euer gemeinsamer Code</label>
        <div class="row"><input id="es-code" class="field grow" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="40" placeholder="z. B. einhorn42">
        <button class="btn primary" type="button" data-a="code">${icon('link')}<span>Verbinden</span></button></div>
        <p class="hint">Gebt auf beiden Handys denselben Code ein – ein Wort, das nur ihr kennt.</p></div>`;
      return;
    }
    linkEl.innerHTML = partnerNote('remote');
  }
  function saveCode() {
    const v = (linkEl.querySelector('#es-code')?.value || '').trim();
    if (v.length < 4) { toast('Der Code braucht mindestens 4 Zeichen.', { icon: 'info' }); return; }
    prefs.set('code', v);
    prefs.set('mode', 'remote');
    sfx.good();
    renderLink();
  }
  linkEl.addEventListener('click', (e) => { if (e.target.closest('[data-a="code"]')) saveCode(); });
  linkEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'es-code') saveCode(); });
  renderLink();
  const offNet = on('net', () => { if (prefs.get('code')) renderLink(); });

  body.querySelector('.es-themes').addEventListener('click', (e) => {
    const b = e.target.closest('.es-tcard');
    if (!b) return;
    sfx.pop(); haptic(10);
    b.classList.remove('press'); void b.offsetWidth; b.classList.add('press');
    openTheme(themeById(b.dataset.theme));
  });

  function openTheme(th) {
    let diff = 'normal';
    let first = me.get();
    const box = h('div', { class: 'es-detail' });
    paint(box, th);
    box.innerHTML = `
      <div class="es-dh">${scene(th.id)}<div class="es-dh-shade"></div><div class="es-dh-text"><span class="es-tc-tag">${esc(th.tag)}</span><h3>${esc(th.title)}</h3></div></div>
      <p class="es-dblurb">${esc(th.blurb)}</p>
      <ol class="es-drooms">${th.rooms.map((r, i) => `<li style="--i:${i}"><span class="es-dr-ic">${symbol(r.icon, 'currentColor')}</span><span><small>Raum ${i + 1}</small>${esc(r.name)}</span></li>`).join('')}</ol>
      <section class="stack es-dsec"><h4 class="setup-h">Schwierigkeit</h4><div data-slot="diff"></div></section>
      <section class="stack es-dsec"><h4 class="setup-h">Wer ist im ersten Raum an den Händen?</h4><div data-slot="first"></div></section>
      <div data-slot="note">${prefs.get('code') ? partnerNote('remote') : ''}</div>
      <button class="btn primary big block es-start" type="button">${icon('sparkle')}<span>Abenteuer starten</span></button>`;
    box.querySelector('[data-slot="diff"]').append(radioCards({
      label: 'Schwierigkeit', value: diff,
      options: Object.values(DIFFS).map((d) => ({ value: d.id, title: d.title, sub: d.sub })),
      onChange: (v) => { diff = v; },
    }));
    box.querySelector('[data-slot="first"]').append(whoSeg({ label: 'Wer ist zuerst an den Händen?', value: first, random: true, onChange: (v) => { first = v; } }));
    const sh = sheet({ body: box, cls: 'es-sheet', label: th.title });
    box.querySelector('.es-start').addEventListener('click', () => {
      if (!prefs.get('code')) {
        sh.close(true);
        toast('Gebt zuerst euren gemeinsamen Code ein.', { icon: 'link' });
        linkEl.querySelector('#es-code')?.focus();
        return;
      }
      if (prefs.get('mode') !== 'remote') prefs.set('mode', 'remote');
      sfx.pop(); haptic(15);
      const id = createSession('escape', 'remote', { theme: th.id, diff, seed: uid(8), first: resolveWho(first) });
      sh.close(true);
      nav('#/spiel/' + id, { replace: true });
    });
  }
  return () => { cleanup(); offNet(); };
}

// =====================================================================
// Spiel
// =====================================================================
export function play(root, sid) {
  const p = me.get();
  const partner = other(p);
  const { el, body, cleanup: shellOff } = shell({ root, game: 'escape', sid, rules: RULES });
  const compute = () => { const s = getSession(sid); return reduce(s.meta, s.evs); };
  let st = compute();
  const th = themeById(st.theme) || THEMES[0];
  el.classList.add('es-play');
  paint(el, th);
  const back = h('div', { class: 'es-backdrop', 'aria-hidden': 'true' });
  back.innerHTML = scene(th.id);
  el.prepend(back);

  let curKey = '';
  let lastId = st.last?.id || null;
  let view = null;
  let puzzle = null;
  let clearedEl = null;
  let clearedT = 0;
  let timeupEl = null;
  let lastSec = -1;
  let busy = false, again = false;
  let alive = true;
  const offs = [];

  const keyOf = (s) => (s.phase === 'room' || s.phase === 'cleared' ? 'room:' + s.room : s.phase);
  const isHands = (r = st.room) => handsOf(st, r) === p;
  const act = (r) => (d) => addEvent(sid, 'act', { r, ...d });

  // ---------- Steuerung ----------
  async function render() {
    if (busy) { again = true; return; }
    busy = true;
    try {
      do {
        again = false;
        st = compute();
        const key = keyOf(st);
        const fresh = !!st.last && st.last.id !== lastId;
        const last = st.last;
        lastId = st.last?.id || null;
        if (key !== curKey) {
          const prev = curKey;
          curKey = key;
          await switchTo(key, prev, fresh ? last : null);
        } else {
          updateSame(fresh ? last : null);
        }
      } while (again && alive);
    } finally { busy = false; }
  }

  async function switchTo(key, prev, last) {
    if (key === 'end' && prev.startsWith('room:')) await finalSolve(last);
    destroyPuzzle();
    if (key === 'intro' || key === 'setup') { mountIntro(); return; }
    if (key.startsWith('room:')) {
      const r = st.room;
      const swap = () => mountRoom(prev !== '' && last);
      if (prev) await doors(`Raum ${r + 1} von ${st.rooms.length}`, st.rooms[r].name, swap);
      else swap();
      return;
    }
    if (key === 'end') {
      if (prev.startsWith('room:') && st.won && last) await winMoment();
      mountEnd(!!prev);
    }
  }
  // Letzter Raum gelöst: erst die Löse-Animation zeigen, dann das Finale
  async function finalSolve(last) {
    if (!puzzle || !last || last.kind !== 'solved') return;
    try { puzzle.update(st.rs[last.r], last, true); } catch (e) { console.error(e); }
    await sleep(motionOK() ? 1100 : 0);
  }

  function updateSame(last) {
    if (curKey === 'intro') { updateIntro(); return; }
    if (curKey.startsWith('room:')) {
      const r = st.room;
      puzzle?.update(st.rs[r], last || {}, !!last);
      updateHud();
      renderHints(last?.kind === 'hint');
      if (last && (last.kind === 'mistake' || last.kind === 'bump')) penaltyFx(last);
      if (st.phase === 'cleared' && !clearedEl && !clearedT) {
        if (last?.kind === 'solved' && motionOK()) clearedT = setTimeout(() => { clearedT = 0; if (st.phase === 'cleared' && curKey === 'room:' + st.room) showCleared(true); }, 1000);
        else showCleared(!!last);
      }
      syncTimeup();
    }
  }

  // ---------- Tür-Übergang ----------
  async function doors(kick, title, swap) {
    if (!motionOK()) { swap(); window.scrollTo(0, 0); return; }
    const d = h('div', { class: 'es-doors', 'aria-hidden': 'true' });
    paint(d, th);
    d.innerHTML = `<div class="es-door l"><i></i></div><div class="es-door r"><i></i></div><div class="es-door-title"><span>${esc(kick)}</span><b>${esc(title)}</b></div>`;
    document.body.append(d);
    sfx.door();
    await sleep(520);
    swap();
    window.scrollTo(0, 0);
    await sleep(900);
    d.classList.add('open');
    sfx.whoosh();
    await sleep(760);
    d.remove();
  }

  // ---------- Intro ----------
  let typer = null;
  function mountIntro() {
    const limit = DIFFS[st.diff].limit;
    const h0 = handsOf(st, 0);
    view = h('div', { class: 'es-introv' });
    view.innerHTML = `
      <div class="es-hero">${scene(th.id)}<div class="es-hero-shade"></div>
        <div class="es-hero-text"><span class="es-tc-tag">${esc(th.tag)} · ${esc(DIFFS[st.diff].title)}</span><h2 class="es-title">${letters(th.title)}</h2></div>
      </div>
      <div class="es-story" role="button" tabindex="0" aria-label="Geschichte (antippen zum Überspringen)">${th.intro.map((t, i) => `<p class="es-para" data-i="${i}">${esc(t)}</p>`).join('')}</div>
      <div class="es-roles">
        <h3 class="es-roles-h">So spielt ihr</h3>
        <div class="es-roles-row">
          <div class="es-rl hands"><span class="es-rl-ic">${HAND_ICON}</span><b>Hände</b><span>sehen das Rätsel und bedienen es.</span></div>
          <div class="es-rl book"><span class="es-rl-ic">${BOOK_ICON}</span><b>Wissen</b><span>haben Buch, Karte oder Regeln.</span></div>
        </div>
        <p class="es-roles-first">Raum 1: <b>${h0 === p ? 'Du bist' : `${esc(nameOf(h0))} ist`}</b> an den Händen. Danach wechselt ihr jeden Raum.</p>
        <p class="es-roles-time">${icon('info')}<span>${limit ? `Ihr habt ${limit / 60e3} Minuten. Fehler kosten 20 Sekunden, ein Tipp 1 Minute.` : 'Ohne Zeitdruck – lasst euch Zeit!'}</span></p>
      </div>
      <div class="es-ready">
        <div class="es-ready-row"></div>
        <button class="btn primary big block es-go" type="button">${icon('sparkle')}<span>Bereit!</span></button>
      </div>`;
    body.replaceChildren(view);
    view.querySelector('.es-go').addEventListener('click', () => {
      sfx.pop(); haptic(15);
      typer?.finish();
      addEvent(sid, 'ready', { p });
    });
    const story = view.querySelector('.es-story');
    typer = typewriter([...story.querySelectorAll('.es-para')]);
    story.addEventListener('click', () => typer.finish());
    story.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); typer.finish(); } });
    updateIntro();
  }
  function updateIntro() {
    if (!view) return;
    const row = view.querySelector('.es-ready-row');
    row.innerHTML = ['jos', 'joh'].map((q) => `<span class="es-rd ${q} ${st.ready[q] ? 'on' : ''}">${miniHalf(q)}<b>${esc(nameOf(q))}</b><i>${st.ready[q] ? `${icon('check')}bereit` : 'liest noch …'}</i></span>`).join('');
    const go = view.querySelector('.es-go');
    if (st.ready[p]) {
      go.disabled = true;
      go.querySelector('span').textContent = st.ready[partner] ? 'Los geht’s!' : `Warte auf ${nameOf(partner)} …`;
    }
  }
  function typewriter(paras) {
    const texts = paras.map((x) => x.textContent);
    let stop = false;
    const finish = () => { stop = true; paras.forEach((x, i) => { x.textContent = texts[i]; x.classList.add('shown'); }); };
    if (!motionOK()) { finish(); return { finish }; }
    paras.forEach((x) => { x.textContent = ''; });
    (async () => {
      await sleep(900);
      for (let i = 0; i < paras.length && !stop; i++) {
        const x = paras[i];
        x.classList.add('shown', 'typing');
        const t = texts[i];
        let n = 0;
        while (n < t.length && !stop) {
          n = Math.min(t.length, n + 2);
          x.textContent = t.slice(0, n);
          if (n % 6 === 0) sfx.key();
          await sleep(26);
        }
        x.classList.remove('typing');
        if (!stop) await sleep(380);
      }
    })();
    return { finish };
  }

  // ---------- Raum ----------
  function mountRoom(withFx) {
    destroyPuzzle();
    clearedEl = null;
    clearTimeout(clearedT); clearedT = 0;
    const r = st.room;
    const rm = st.rooms[r];
    const role = isHands(r) ? 'hands' : 'book';
    view = h('div', { class: `es-room role-${role} kind-${rm.kind}` });
    view.innerHTML = `
      <div class="es-hud">
        <ol class="es-track" aria-label="Räume">${st.rooms.map((x, i) => `<li class="${i < r ? 'done' : i === r ? 'now' : ''}" aria-label="Raum ${i + 1}: ${esc(x.name)}${i < r ? ' (geschafft)' : ''}"><span>${i < r ? icon('check') : symbol(x.icon, 'currentColor')}</span></li>`).join('')}</ol>
        <div class="es-timer" role="timer" aria-label="Zeit">${GLASS}<span class="es-time tnum">–:––</span></div>
        <button class="es-hintbtn" type="button" aria-label="Tipp holen">${icon('bulb')}<span>Tipp</span><b class="tnum"></b></button>
      </div>
      <div class="es-rolecard ${role}">
        <span class="es-role-ic">${role === 'hands' ? HAND_ICON : BOOK_ICON}</span>
        <span class="es-role-text"><b>${role === 'hands' ? 'Du bist an den Händen' : 'Du hast das Wissen'}</b><small>${esc(roleLine(rm.kind, role, rm.skin, nameOf(partner)))}</small></span>
      </div>
      <article class="es-roomcard">
        <span class="es-rc-ic" aria-hidden="true">${symbol(rm.icon, 'currentColor')}</span>
        <p class="es-rk">Raum ${r + 1} von ${st.rooms.length}</p>
        <h2 class="es-rn">${esc(rm.name)}</h2>
        <p class="es-rs">${esc(rm.story)}</p>
        <button class="es-more" type="button">Weiterlesen</button>
      </article>
      <div class="es-puzzle"></div>
      <section class="es-hints" aria-live="polite"></section>`;
    body.replaceChildren(view);
    view.querySelector('.es-hintbtn').addEventListener('click', askHint);
    // Geschichte auf drei Zeilen kürzen (antippen zum Aufklappen), damit das Rätsel schneller im Blick ist
    const card = view.querySelector('.es-roomcard');
    const rsEl = card.querySelector('.es-rs');
    card.classList.add('clamp');
    requestAnimationFrame(() => { if (rsEl.scrollHeight > rsEl.clientHeight + 2) card.classList.add('long'); });
    card.addEventListener('click', () => { if (card.classList.contains('long')) { card.classList.remove('clamp', 'long'); sfx.tap(); } });
    puzzle = mountPuzzle({ el: view.querySelector('.es-puzzle'), kind: rm.kind, spec: rm.spec, skin: rm.skin, role, rs: st.rs[r], act: act(r), partner: nameOf(partner), r, th });
    renderHints(false);
    updateHud();
    if (st.phase === 'cleared') showCleared(false);
    syncTimeup();
    announce(`Raum ${r + 1}: ${rm.name}. ${role === 'hands' ? 'Du bist an den Händen.' : 'Du hast das Wissen.'}`);
    if (withFx && motionOK()) {
      view.querySelectorAll('.es-hud, .es-rolecard, .es-roomcard, .es-puzzle').forEach((x, i) => x.animate([{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 120 + i * 90, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }));
    }
  }
  function destroyPuzzle() { try { puzzle?.destroy(); } catch (e) { console.error(e); } puzzle = null; }

  function updateHud() {
    if (!view?.classList.contains('es-room')) return;
    const used = st.hintsUsed[st.room] || 0;
    const hb = view.querySelector('.es-hintbtn');
    hb.querySelector('b').textContent = `${MAX_HINTS - used}`;
    hb.disabled = used >= MAX_HINTS || st.phase !== 'room';
    tick();
  }

  async function askHint() {
    const used = st.hintsUsed[st.room] || 0;
    if (used >= MAX_HINTS || st.phase !== 'room') return;
    sfx.tap();
    const costs = st.limit && !st.overtime;
    const ok = await confirmBox({
      title: `Tipp ${used + 1} von ${MAX_HINTS} holen?`,
      text: costs ? 'Er kostet euch 1 Minute. Beide sehen den Tipp.' : 'Ohne Zeitdruck kostet er nichts – aber vielleicht einen Stern. Beide sehen den Tipp.',
      ok: 'Tipp her!',
    });
    if (!ok || st.phase !== 'room' || (st.hintsUsed[st.room] || 0) !== used) return;
    addEvent(sid, 'hint', { r: st.room, n: used + 1 });
  }

  function renderHints(isNew) {
    const box = view?.querySelector('.es-hints');
    if (!box) return;
    const r = st.room, rm = st.rooms[r];
    const n = st.hintsUsed[r] || 0;
    if (!n) { box.replaceChildren(); return; }
    const list = hintsFor(rm.kind, rm.spec, rm.skin, st.rs[r]).slice(0, n);
    box.innerHTML = `<h3 class="es-hints-h">${icon('bulb')}<span>Tipps</span></h3><ol>${list.map((t, i) => `<li class="${isNew && i === n - 1 ? 'new' : ''}"><b>${i + 1}</b><span>${esc(t)}</span></li>`).join('')}</ol>`;
    if (isNew) {
      sfx.sparkle();
      const li = box.querySelector('li.new');
      li?.scrollIntoView({ behavior: motionOK() ? 'smooth' : 'auto', block: 'nearest' });
      if (st.limit && !st.overtime) floatPenalty(`−${PEN.hint / 60e3} min`);
    }
  }

  // ---------- Zeit ----------
  function tick() {
    const tEl = view?.querySelector('.es-time');
    if (!tEl) return;
    const timer = view.querySelector('.es-timer');
    const rem = remaining(st);
    if (rem == null || st.overtime) {
      tEl.textContent = fmt(elapsed(st), false);
      timer.classList.toggle('free', true);
      timer.classList.remove('low', 'crit');
    } else {
      tEl.textContent = fmt(rem);
      timer.classList.toggle('low', rem < 2 * 60e3);
      timer.classList.toggle('crit', rem < 30e3);
      const sec = Math.ceil(rem / 1000);
      if (rem > 0 && rem <= 10e3 && sec !== lastSec && st.phase === 'room') { sfx.tick(); }
      lastSec = sec;
    }
    timer.classList.toggle('paused', st.phase === 'cleared');
    syncTimeup();
  }
  const iv = setInterval(tick, 250);

  function floatPenalty(text) {
    const t = view?.querySelector('.es-timer');
    if (!t) return;
    const f = h('span', { class: 'es-pen', 'aria-hidden': 'true' }, text);
    t.append(f);
    setTimeout(() => f.remove(), 1400);
    t.classList.remove('hit'); void t.offsetWidth; t.classList.add('hit');
  }
  function penaltyFx(last) {
    const timed = st.limit && !st.overtime;
    if (last.kind === 'mistake') {
      sfx.bad(); haptic([25, 40, 25]);
      flash('rgba(255,60,90,.5)', .35);
      if (timed) floatPenalty(`−${PEN.mistake / 1000} s`);
      if (!isHands()) toast(`Hoppla – das war falsch${timed ? ' (−20 Sekunden)' : ''}.`, { icon: 'cross', key: 'es' });
    } else if (last.kind === 'bump' && timed) floatPenalty(`−${PEN.bump / 1000} s`);
  }

  function syncTimeup() {
    const up = timeUp(st);
    if (up && !timeupEl) showTimeup();
    if (!up && timeupEl) { timeupEl.remove(); timeupEl = null; }
  }
  function showTimeup() {
    timeupEl = h('div', { class: 'es-timeup', role: 'alertdialog', 'aria-label': 'Die Zeit ist um' });
    paint(timeupEl, th);
    timeupEl.innerHTML = `<div class="es-tu-card">
      <div class="es-tu-glass">${GLASS}</div>
      <h2>Die Zeit ist um!</h2>
      <p>Ihr könnt ohne Zeit weiterspielen – dann gibt es am Ende einen Stern. Oder ihr gebt auf.</p>
      <button class="btn primary big block" type="button" data-a="cont">${icon('next')}<span>Ohne Zeit weiter</span></button>
      <button class="btn quiet block" type="button" data-a="give">${icon('flag')}<span>Aufgeben</span></button></div>`;
    el.append(timeupEl);
    sfx.lose(); haptic([40, 60, 40]);
    timeupEl.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'cont') { sfx.pop(); addEvent(sid, 'cont', {}); }
      if (a === 'give') {
        const ok = await confirmBox({ title: 'Wirklich aufgeben?', text: 'Dann endet das Abenteuer für euch beide.', ok: 'Aufgeben', danger: true });
        if (ok) addEvent(sid, 'giveup', {});
      }
    });
  }

  // ---------- Raum geschafft ----------
  function showCleared(withFx) {
    if (!view || clearedEl) return;
    const r = st.room, rm = st.rooms[r];
    const nextHands = handsOf(st, r + 1);
    const took = st.solvedAt[r] && st.roomT ? st.solvedAt[r] - st.roomT : 0;
    clearedEl = h('div', { class: 'es-cleared', role: 'dialog', 'aria-label': 'Raum geschafft' });
    clearedEl.innerHTML = `<div class="es-cl-card">
      <div class="es-cl-badge">${symbol(rm.icon, 'currentColor')}<i></i></div>
      <p class="es-cl-kick">Raum ${r + 1} geschafft!</p>
      <h2 class="es-cl-title">${esc(rm.name)}</h2>
      <p class="es-cl-text">${esc(rm.done)}</p>
      ${took > 0 ? `<p class="es-cl-time">${GLASS}<span>${fmt(took, false)} in diesem Raum</span></p>` : ''}
      <div class="es-cl-next"><span class="es-cl-swap">${icon('swap')}</span><span>Rollentausch! Im nächsten Raum ${nextHands === p ? '<b>bist du</b>' : `<b>ist ${esc(nameOf(nextHands))}</b>`} an den Händen.</span></div>
      <button class="btn primary big block" type="button">${icon('next')}<span>Weiter zu Raum ${r + 2}</span></button></div>`;
    view.append(clearedEl);
    const btn = clearedEl.querySelector('button');
    btn.addEventListener('click', () => { btn.disabled = true; sfx.pop(); haptic(12); addEvent(sid, 'next', { r }); });
    if (withFx) {
      sfx.unlock(); setTimeout(() => sfx.win(), 180);
      haptic([20, 40, 20, 40, 60]);
      const c = { x: innerWidth / 2, y: innerHeight * .34 };
      burst(c.x, c.y, { count: 40, speed: [200, 560] });
      ring(c.x, c.y, { color: th.pal.glow, r1: 240, width: 8 });
    }
  }

  // ---------- Finale ----------
  async function winMoment() {
    if (!motionOK()) return;
    sfx.unlock();
    flash('#fff', .7);
    await sleep(240);
    celebrate();
    sfx.win();
    haptic([30, 50, 30, 50, 90]);
    await sleep(600);
  }

  function mountEnd(animated) {
    clearInterval(iv);
    timeupEl?.remove(); timeupEl = null;
    if (st.aborted) {
      body.replaceChildren(resultCard({ title: 'Abenteuer beendet', sad: true, lines: [`${esc(nameOf(st.abortBy))} hat das Abenteuer beendet.`], onRematch: () => nav('#/neu/escape'), rematchLabel: 'Neues Abenteuer' }));
      return;
    }
    const won = st.won;
    const stars = starsOf(st);
    const ms = elapsed(st);
    let isRecord = false;
    if (won) isRecord = saveRecord(th.id, { stars, ms, diff: st.diff, sid, at: Date.now() });
    view = h('div', { class: `es-end ${won ? 'won' : 'lost'}` });
    view.innerHTML = `
      <div class="es-end-hero">${scene(th.id)}<div class="es-end-glow"></div>${won ? '<div class="es-end-rays"></div>' : ''}</div>
      <p class="es-end-kick">${won ? 'Ihr seid frei!' : 'Diesmal nicht …'}</p>
      <h2 class="es-end-title">${letters(th.title)}</h2>
      ${won ? starsHTML(stars, 'big') : ''}
      ${isRecord ? `<p class="es-record">${icon('trophy')}<span>Neuer Rekord!</span></p>` : ''}
      <div class="es-story end">${(won ? th.outro : [th.lose]).map((t) => `<p class="es-para shown">${esc(t)}</p>`).join('')}</div>
      <dl class="es-stats">
        <div><dt>Zeit</dt><dd class="tnum">${fmt(ms, false)}</dd></div>
        <div><dt>Tipps</dt><dd class="tnum">${st.hints}</dd></div>
        <div><dt>Fehler</dt><dd class="tnum">${st.mistakes}</dd></div>
        <div><dt>Räume</dt><dd class="tnum">${st.solvedAt.filter(Boolean).length}/${st.rooms.length}</dd></div>
      </dl>
      ${won && st.overtime ? '<p class="soft small center">Mit Verlängerung geschafft – nächstes Mal knackt ihr die Zeit!</p>' : ''}
      <div class="es-end-acts">
        <button class="btn primary big block" type="button" data-a="again">${icon('refresh')}<span>Nochmal – neue Rätsel</span></button>
        <button class="btn block" type="button" data-a="other">${icon('sparkle')}<span>Andere Geschichte</span></button>
        <button class="btn quiet block" type="button" data-a="home">${icon('home')}<span>Zur Lobby</span></button>
      </div>`;
    body.replaceChildren(view);
    view.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'again') {
        sfx.pop();
        const id = createSession('escape', 'remote', { theme: th.id, diff: st.diff, seed: uid(8), first: other(st.first) });
        nav('#/spiel/' + id, { replace: true });
      } else if (a === 'other') nav('#/neu/escape');
      else if (a === 'home') nav('#/lobby');
    });
    if (!animated || !motionOK()) { view.classList.add('still'); return; }
    if (won) {
      view.querySelectorAll('.es-star.on').forEach((s, i) => setTimeout(() => {
        const r = s.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2, { count: 16, shapes: ['star', 'sparkle'], colors: ['#FFD36E', '#FFF3B0', '#fff'], speed: [120, 300] });
        sfx.note(76 + i * 4);
      }, 700 + i * 380));
      if (isRecord) setTimeout(() => stamp('Rekord!', innerWidth / 2, innerHeight * .3, { color: th.pal.acc }), 1900);
    } else sfx.lose();
  }

  // ---------- Fernverbindung ----------
  offs.push(on('session', ({ id }) => { if (id === sid) render(); }));
  offs.push(on('net', () => {
    if (!view?.classList.contains('es-room')) return;
    const n = netState();
    view.classList.toggle('alone', !(n.status === 'online' && n.partner));
  }));

  render();
  return () => {
    alive = false;
    clearInterval(iv);
    clearTimeout(clearedT);
    destroyPuzzle();
    typer?.finish();
    timeupEl?.remove();
    offs.forEach((f) => f());
    shellOff();
  };
}
