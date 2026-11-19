// Gemeinsame Bausteine der Spiele: Rahmen mit Kopfzeile, Personen-Wahl, Auswahlkarten, „Eigenes oder Pool“,
// Zug-Anzeige, Antwortknöpfe, Verlauf, Ergebnis-Karte, Reaktionen (Weit weg), Spicken, Warte-Karte.
import { h, esc, centerOf } from '../core/dom.js';
import { icon } from '../art/icons.js';
import { mascot } from '../art/mascots.js';
import { miniHalf } from '../art/heart.js';
import { me, on, prefs } from '../core/store.js';
import { nameOf, other, pick, rnd } from '../core/util.js';
import { segmented, sheet, confirmBox, toast } from '../core/ui.js';
import { currentTheme, motionOK } from '../core/theme.js';
import { burst, celebrate, stamp } from '../core/fx.js';
import { sfx, haptic } from '../core/sound.js';
import { nav } from '../core/router.js';
import { addEvent, getSession, sendFx } from '../core/sync.js';
import { netState } from '../core/net.js';
import { GAMES } from './info.js';

export const modeOf = (sid) => (sid ? getSession(sid)?.meta.mode : prefs.get('mode')) || 'couch';

// ---------- Rahmen ----------
export function shell({ root, game, sid, rules = [] }) {
  const mode = modeOf(sid);
  const s = h('section', { class: `screen game g-${game}`, dataset: { mode } });
  s.innerHTML = `
    <header class="g-top">
      <button class="iconbtn" type="button" data-a="back" aria-label="Zur Lobby">${icon('back')}</button>
      <div class="g-head"><h1 class="g-title">${esc(GAMES[game].title)}</h1><p class="g-sub" data-slot="sub"></p></div>
      <button class="iconbtn" type="button" data-a="menu" aria-label="Regeln und Menü">${icon('question')}</button>
    </header>
    <div class="g-body"></div>`;
  root.append(s);
  const sub = s.querySelector('[data-slot="sub"]');
  const renderSub = () => {
    if (mode !== 'remote') { sub.innerHTML = `${icon('sofa')}<span>Nebeneinander</span>`; return; }
    const n = netState();
    const on_ = n.status === 'online' && n.partner;
    sub.innerHTML = `<span class="dot ${on_ ? 'on' : n.status === 'online' || n.status === 'connecting' ? 'wait' : 'off'}"></span><span>${on_ ? `${nameOf(other(me.get()))} ist da` : n.status === 'online' ? `${nameOf(other(me.get()))} ist nicht online` : n.status === 'connecting' ? 'Verbinde …' : 'Offline'}</span>`;
  };
  renderSub();
  const off = on('net', renderSub);
  s.querySelector('[data-a="back"]').addEventListener('click', () => { sfx.tap(); nav('#/lobby'); });
  s.querySelector('[data-a="menu"]').addEventListener('click', () => openMenu({ game, sid, rules }));
  return { el: s, body: s.querySelector('.g-body'), mode, cleanup: off };
}

function openMenu({ game, sid, rules }) {
  const body = h('div', { class: 'stack', style: { '--gap': '14px' } });
  body.innerHTML = `<ul class="rules">${rules.map((r) => `<li>${r}</li>`).join('')}</ul>`;
  const running = sid && getSession(sid);
  if (running) {
    const end = h('button', { class: 'btn quiet block', type: 'button' }, 'Partie beenden');
    end.insertAdjacentHTML('afterbegin', icon('flag'));
    end.addEventListener('click', async () => {
      sh.close(true);
      const ok = await confirmBox({ title: 'Partie beenden?', text: 'Sie zählt dann nicht für die Duell-Bilanz.', ok: 'Beenden', danger: true });
      if (ok) { addEvent(sid, 'abort', {}); nav('#/lobby'); }
    });
    body.append(end);
  }
  const sh = sheet({ title: `So geht ${GAMES[game].title}`, body });
}

// ---------- Personen-Wahl ----------
export function whoSeg({ label, value, random = false, onChange }) {
  const options = [{ value: 'jos', label: nameOf('jos') }, { value: 'joh', label: nameOf('joh') }];
  if (random) options.push({ value: 'rand', label: 'Zufall', icon: 'dice' });
  return segmented({ label, value, options, onChange, cls: 'who-seg' });
}
export const resolveWho = (v) => (v === 'rand' ? (Math.random() < .5 ? 'jos' : 'joh') : v);

// ---------- Auswahlkarten (z. B. Schwierigkeit) ----------
export function radioCards({ label, options, value, onChange }) {
  const g = h('div', { class: 'rcards', role: 'radiogroup', 'aria-label': label });
  const set = (v) => {
    value = v;
    g.querySelectorAll('.rcard').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === String(v))));
  };
  for (const o of options) {
    const b = h('button', { class: 'rcard', type: 'button', role: 'radio', dataset: { value: String(o.value) } });
    b.innerHTML = `${o.art || ''}<span class="rc-title">${esc(o.title)}</span>${o.sub ? `<span class="rc-sub">${esc(o.sub)}</span>` : ''}`;
    b.addEventListener('click', () => { set(o.value); sfx.tap(); haptic(8); onChange?.(o.value); });
    g.append(b);
  }
  set(value);
  return g;
}

// ---------- „Eigenes“ oder „Aus dem Pool“ ----------
// pool: { cats: [{id,label}], items(catId, level) → [{text, cat}], levels?: [{id,label}] }
// validate(text) → { ok, msg } · preview(text, el) optional
export function secretPicker({ ownLabel, placeholder, pool, validate, preview, maxLength = 40, extra, poolNote }) {
  const box = h('div', { class: 'picker stack' });
  let tab = 'pool';
  let cat = pool.cats[0].id;
  let level = pool.levels?.[1]?.id || pool.levels?.[0]?.id || null;
  let current = null;
  const tabs = segmented({
    label: 'Woher?', value: tab,
    options: [{ value: 'pool', label: 'Aus dem Pool', icon: 'dice' }, { value: 'own', label: ownLabel, icon: 'pencil' }],
    onChange: (v) => { tab = v; render(); },
  });
  const own = h('div', { class: 'stack picker-own' });
  own.innerHTML = `<input class="field big center" maxlength="${maxLength}" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" placeholder="${esc(placeholder)}" aria-label="${esc(ownLabel)}">
    <div class="picker-preview" aria-hidden="true"></div><p class="hint" aria-live="polite"></p>`;
  const input = own.querySelector('input');
  const hint = own.querySelector('.hint');
  const prev = own.querySelector('.picker-preview');
  const poolEl = h('div', { class: 'stack picker-pool' });
  poolEl.innerHTML = `<div class="chips scroll" data-slot="cats" role="group" aria-label="Kategorie"></div>
    ${pool.levels ? '<div class="chips" data-slot="levels" role="group" aria-label="Schwierigkeit"></div>' : ''}
    <div class="pool-card" aria-live="polite"><span class="pc-cat"></span><span class="pc-text"></span></div>
    <button class="btn block" type="button" data-a="reroll">${icon('refresh')}<span>Anderes Wort</span></button>
    ${poolNote ? `<p class="hint">${poolNote}</p>` : ''}`;
  const catsEl = poolEl.querySelector('[data-slot="cats"]');
  catsEl.innerHTML = pool.cats.map((c) => `<button class="chip" type="button" data-cat="${c.id}" aria-pressed="${c.id === cat}">${esc(c.label)}</button>`).join('');
  const levelsEl = poolEl.querySelector('[data-slot="levels"]');
  if (levelsEl) levelsEl.innerHTML = pool.levels.map((l) => `<button class="chip" type="button" data-level="${l.id}" aria-pressed="${l.id === level}">${esc(l.label)}</button>`).join('');
  poolEl.querySelector('[data-a="reroll"] span').textContent = pool.rerollLabel || 'Was anderes';
  const card = poolEl.querySelector('.pool-card');

  function reroll(animate = true) {
    const list = pool.items(cat, level).filter((x) => x.text !== current?.text);
    current = list.length ? pick(list) : pool.items(cat, level)[0] || null;
    card.querySelector('.pc-cat').textContent = current ? (pool.cats.find((c) => c.id === current.cat)?.label || '') : '';
    card.querySelector('.pc-text').textContent = current ? current.text : '–';
    if (animate && motionOK()) card.animate([{ transform: 'rotateX(90deg)', opacity: .2 }, { transform: 'rotateX(0)', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    box.dispatchEvent(new Event('change'));
  }
  catsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    cat = b.dataset.cat;
    catsEl.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    sfx.tap(); reroll();
  });
  levelsEl?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-level]');
    if (!b) return;
    level = b.dataset.level;
    levelsEl.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    sfx.tap(); reroll();
  });
  poolEl.querySelector('[data-a="reroll"]').addEventListener('click', () => { sfx.flip(); haptic(6); reroll(); });
  input.addEventListener('input', () => { validateOwn(); box.dispatchEvent(new Event('change')); });

  function validateOwn() {
    const v = validate(input.value);
    hint.textContent = input.value ? v.msg || '' : '';
    hint.classList.toggle('bad', !!input.value && !v.ok);
    if (preview) preview(input.value, prev);
    return v;
  }
  function render() {
    poolEl.hidden = tab !== 'pool';
    own.hidden = tab !== 'own';
    if (tab === 'own') setTimeout(() => input.focus(), 60);
    box.dispatchEvent(new Event('change'));
  }
  box.append(tabs, poolEl, own);
  if (extra) box.append(extra);
  reroll(false);
  render();

  box.value = () => {
    if (tab === 'pool') return current ? { text: current.text, cat: pool.cats.find((c) => c.id === current.cat)?.label || '', source: 'pool', ok: true } : { ok: false };
    const v = validate(input.value);
    return { text: input.value.trim(), cat: '', source: 'own', ok: v.ok, msg: v.msg };
  };
  box.focusOwn = () => input.focus();
  return box;
}

// ---------- Zug-Anzeige ----------
export function turnBanner() {
  const el = h('div', { class: 'turn', 'aria-live': 'polite' });
  let lastP = null;
  el.set = (p, title, sub = '') => {
    el.className = `turn ${p || ''}`;
    el.innerHTML = `<span class="turn-ava">${p ? miniHalf(p) : icon('sparkle')}</span><span class="turn-text"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>`;
    if (p !== lastP && lastP !== null && motionOK()) {
      el.animate([{ transform: 'rotateX(80deg)', opacity: 0 }, { transform: 'rotateX(0)', opacity: 1 }], { duration: 460, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    }
    lastP = p;
  };
  return el;
}

// ---------- Antwort-Knöpfe ----------
export function answerRow({ options, onPick }) {
  const row = h('div', { class: 'answers', role: 'group', 'aria-label': 'Antwort' });
  for (const o of options) {
    const b = h('button', { class: `ans ${o.cls || ''}`, type: 'button', dataset: { a: o.value } });
    b.innerHTML = `${icon(o.icon)}<span>${esc(o.label)}</span>`;
    b.addEventListener('click', () => {
      haptic(10);
      const c = centerOf(b);
      if (o.cls === 'win') burst(c.x, c.y, { count: 20, emoji: currentTheme() === 'baby' });
      onPick(o.value, b);
    });
    row.append(b);
  }
  return row;
}

export const ANS_STD = [
  { value: 'ja', label: 'Ja', icon: 'check', cls: 'good' },
  { value: 'nein', label: 'Nein', icon: 'cross', cls: 'bad' },
];

// ---------- Verlauf (Fragen + Antworten) ----------
const A_LABEL = { ja: 'Ja', nein: 'Nein', vielleicht: 'Vielleicht', weissnicht: 'Weiß nicht', richtig: 'Richtig!' };
const A_CLS = { ja: 'good', nein: 'bad', vielleicht: 'maybe', weissnicht: 'maybe', richtig: 'win' };
export function logView(entries, { mine, empty = 'Noch keine Fragen.' } = {}) {
  const ul = h('ol', { class: 'qlog' });
  if (!entries.length) { ul.innerHTML = `<li class="ql-empty">${esc(empty)}</li>`; return ul; }
  ul.innerHTML = entries.map((e) => {
    const side = mine ? (e.by === mine ? 'me' : 'them') : e.by;
    const q = e.guess != null ? `Ist es die ${e.guess}?` : (e.q || `Frage ${e.n}`);
    return `<li class="ql ${side} p-${e.by}"><span class="ql-q"><span class="ql-n">${esc(nameOf(e.by))}s ${e.n}. Frage</span>${esc(q)}</span><span class="ql-a ${A_CLS[e.a] || ''}">${esc(A_LABEL[e.a] || e.a)}</span></li>`;
  }).join('');
  return ul;
}

// ---------- Ergebnis ----------
export function resultCard({ winner, title, lines = [], rematchLabel = 'Nochmal spielen', onRematch, aborted, sad = false }) {
  const el = h('div', { class: `result ${winner || ''}`, role: 'status' });
  const theme = currentTheme();
  el.innerHTML = `
    ${aborted || sad ? '' : `<div class="res-crown">${icon('crown')}</div>`}
    ${mascot(theme, aborted || sad ? 'sad' : 'cheer', 'res-masc')}
    <h2 class="res-title">${esc(title)}</h2>
    ${lines.map((l) => `<p class="res-line">${l}</p>`).join('')}
    <div class="res-actions"></div>`;
  const acts = el.querySelector('.res-actions');
  if (onRematch) {
    const b = h('button', { class: 'btn primary big block', type: 'button' }, rematchLabel);
    b.insertAdjacentHTML('afterbegin', icon('swap'));
    b.addEventListener('click', () => { sfx.pop(); onRematch(); });
    acts.append(b);
  }
  const l = h('button', { class: 'btn block', type: 'button' }, 'Zur Lobby');
  l.insertAdjacentHTML('afterbegin', icon('home'));
  l.addEventListener('click', () => nav('#/lobby'));
  acts.append(l);
  return el;
}

// Feier oder Trost – einmal pro Partie (auch nach Neuladen nicht doppelt)
const celebrated = new Set();
export function finale(sid, { winner, iWon, couch }) {
  if (celebrated.has(sid)) return;
  celebrated.add(sid);
  if (winner === 'draw' || iWon || couch) {
    celebrate();
    sfx.win();
    haptic([30, 50, 30, 50, 80]);
  } else {
    sfx.lose();
    const lila = currentTheme() === 'lila';
    stamp(lila ? 'ガーン!' : 'Oh nein!', innerWidth / 2, innerHeight / 3, { cls: lila ? 'manga' : '' });
  }
}
export const markCelebrated = (sid) => celebrated.add(sid);

// ---------- Reaktionen (Weit weg) ----------
export const REACTIONS = ['😂', '😱', '🙈', '🤔', '💖', '🔥'];
export function reactionBar(sid) {
  const bar = h('div', { class: 'reacts', role: 'group', 'aria-label': 'Reaktion schicken' });
  for (const r of REACTIONS) {
    const b = h('button', { class: 'react', type: 'button', 'aria-label': `Reaktion ${r} schicken` }, r);
    b.addEventListener('click', () => {
      sendFx({ kind: 'react', sid, e: r });
      floatEmoji(r, b);
      haptic(8);
    });
    bar.append(b);
  }
  return bar;
}
export function floatEmoji(emoji, fromEl) {
  const c = fromEl ? centerOf(fromEl) : { x: innerWidth * rnd(.3, .7), y: innerHeight * .85 };
  const d = h('div', { class: 'float-emoji', 'aria-hidden': 'true' }, emoji);
  d.style.left = c.x + 'px'; d.style.top = c.y + 'px';
  document.body.append(d);
  const dx = rnd(-60, 60);
  const a = d.animate(motionOK()
    ? [{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 }, { transform: 'translate(-50%,-80%) scale(1.3)', opacity: 1, offset: .15 },
      { transform: `translate(calc(-50% + ${dx}px), -${Math.round(innerHeight * .45)}px) scale(1)`, opacity: 0 }]
    : [{ opacity: 1 }, { opacity: 0 }], { duration: 1800, easing: 'cubic-bezier(.22,1,.36,1)' });
  a.onfinish = () => d.remove();
}
export function onReactions(sid, fn) {
  return on('fx', (d) => {
    if (d.sid !== sid) return;
    if (d.kind === 'react' && typeof d.e === 'string' && REACTIONS.includes(d.e)) { floatEmoji(d.e); fn?.(d); }
    else if (d.kind === 'typing') fn?.(d);
  });
}

// ---------- Spicken: gedrückt halten ----------
export function peekButton({ label, reveal, warn }) {
  const b = h('button', { class: 'btn small peek', type: 'button', 'aria-label': `${label} (gedrückt halten)` });
  b.innerHTML = `${icon('eye')}<span>${esc(label)}</span>`;
  let ov = null;
  const show = (e) => {
    e?.preventDefault?.();
    if (ov) return;
    ov = h('div', { class: 'peek-ov', role: 'status' });
    ov.innerHTML = `${warn ? `<p class="peek-warn">${esc(warn)}</p>` : ''}<p class="peek-val">${esc(reveal())}</p><p class="peek-hint">Loslassen zum Verstecken</p>`;
    document.body.append(ov);
    haptic(8);
  };
  const hide = () => { ov?.remove(); ov = null; };
  b.addEventListener('pointerdown', show);
  b.addEventListener('pointerup', hide);
  b.addEventListener('pointerleave', hide);
  b.addEventListener('pointercancel', hide);
  b.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') show(e); });
  b.addEventListener('keyup', hide);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  return b;
}

// ---------- Warte-Karte ----------
export function waitCard(title, sub = '') {
  const el = h('div', { class: 'wait-card panel', role: 'status' });
  el.innerHTML = `${mascot(currentTheme(), 'idle', 'wait-masc')}<p class="wait-title">${esc(title)}<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span></p>${sub ? `<p class="soft small">${esc(sub)}</p>` : ''}`;
  return el;
}

// Rollen-Text: „du“ oder Name
export const youOr = (p) => (p === me.get() ? 'Du' : nameOf(p));
