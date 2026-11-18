// Bedien-Bausteine: Meldungen, Blatt (Sheet), Bestätigen-Dialog, Übergabe-Bildschirm, Segment-Umschalter, Ansagen.
import { h, esc } from './dom.js';
import { icon } from '../art/icons.js';
import { mascot, setMood } from '../art/mascots.js';
import { nameOf, PLAYERS } from './util.js';
import { sfx, haptic } from './sound.js';
import { motionOK } from './theme.js';

const layer = () => document.getElementById('layer');

// ---------- Ansage für Screenreader ----------
export function announce(text) {
  const sr = document.getElementById('sr');
  if (!sr) return;
  sr.textContent = '';
  setTimeout(() => { sr.textContent = text; }, 30);
}

// ---------- Meldung ----------
export function toast(text, o = {}) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const t = h('div', { class: 'toast', role: 'status' });
  t.innerHTML = `${o.icon ? icon(o.icon) : ''}<span>${esc(text)}</span>`;
  if (o.action) {
    const b = h('button', { type: 'button' }, o.action.label);
    b.addEventListener('click', () => { o.action.run(); close(); });
    t.append(b);
  }
  box.prepend(t);
  while (box.children.length > 3) box.lastElementChild.remove();
  let gone = false;
  function close() {
    if (gone) return;
    gone = true;
    t.classList.add('out');
    setTimeout(() => t.remove(), 260);
  }
  setTimeout(close, o.ms ?? 2800);
  t.addEventListener('click', (e) => { if (e.target === t) close(); });
  return close;
}

// ---------- Blatt (Bottom Sheet) ----------
// sheet({ title, body: Node|string, onClose }) → { el, close }
let sheetOpen = null;
export function sheet({ title, body, cls = '', onClose, label } = {}) {
  if (sheetOpen) sheetOpen.close(true);
  const wrap = h('div', { class: 'sheet-wrap', role: 'dialog', 'aria-modal': 'true', 'aria-label': label || title || 'Fenster' });
  const back = h('div', { class: 'sheet-backdrop' });
  const box = h('div', { class: 'sheet ' + cls });
  const handle = h('div', { class: 'sheet-handle', 'aria-hidden': 'true' });
  box.append(handle);
  if (title) box.append(h('h2', {}, title));
  if (typeof body === 'string') box.insertAdjacentHTML('beforeend', body);
  else if (body) box.append(body);
  wrap.append(back, box);
  layer().append(wrap);
  const prevFocus = document.activeElement;

  let closed = false;
  function close(instant) {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    if (sheetOpen === api) sheetOpen = null;
    const end = () => { wrap.remove(); onClose?.(); prevFocus?.focus?.({ preventScroll: true }); };
    if (instant || !motionOK()) return end();
    wrap.classList.add('closing'); box.classList.add('closing');
    setTimeout(end, 250);
  }
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  back.addEventListener('click', () => close());

  // Mit dem Finger nach unten wegziehen
  let y0 = null, dy = 0, t0 = 0;
  box.addEventListener('pointerdown', (e) => {
    if (box.scrollTop > 0 || e.target.closest('input,textarea,button,a,.chips,.no-drag')) return;
    y0 = e.clientY; dy = 0; t0 = performance.now();
  });
  function move(e) {
    if (y0 == null) return;
    dy = Math.max(0, e.clientY - y0);
    if (dy > 4) box.style.transform = `translateY(${dy}px)`;
  }
  window.addEventListener('pointermove', move, { passive: true });
  function up() {
    if (y0 == null) return;
    const v = dy / Math.max(1, performance.now() - t0);
    y0 = null;
    if (dy > 110 || v > .9) close();
    else if (dy > 0) { box.style.transition = 'transform .3s cubic-bezier(.34,1.56,.64,1)'; box.style.transform = ''; setTimeout(() => { box.style.transition = ''; }, 320); }
  }
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);

  const api = { el: box, wrap, close };
  sheetOpen = api;
  setTimeout(() => (box.querySelector('[autofocus]') || box).focus?.({ preventScroll: true }), 60);
  box.tabIndex = -1;
  return api;
}
export const closeSheet = () => sheetOpen?.close();

// ---------- Bestätigen-Dialog ----------
export function confirmBox({ title, text = '', ok = 'Ja', cancel = 'Abbrechen', danger = false } = {}) {
  return new Promise((resolve) => {
    const wrap = h('div', { class: 'dialog-wrap', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': title });
    const back = h('div', { class: 'sheet-backdrop' });
    const box = h('div', { class: 'dialog' });
    box.innerHTML = `<h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}`;
    const row = h('div', { class: 'row wrap' });
    const bNo = h('button', { class: 'btn', type: 'button' }, cancel);
    const bYes = h('button', { class: 'btn primary' + (danger ? ' danger' : ''), type: 'button' }, ok);
    row.append(bNo, bYes);
    box.append(row);
    wrap.append(back, box);
    layer().append(wrap);
    const done = (v) => { document.removeEventListener('keydown', onKey); wrap.remove(); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') done(false); };
    document.addEventListener('keydown', onKey);
    back.addEventListener('click', () => done(false));
    bNo.addEventListener('click', () => done(false));
    bYes.addEventListener('click', () => done(true));
    setTimeout(() => bYes.focus(), 50);
  });
}

// ---------- Übergabe-Bildschirm (Nebeneinander) ----------
// Deckt alles ab, bis die richtige Person „Ich bin … – los!“ tippt.
export function handoff({ to, title, text, button, kicker } = {}) {
  return new Promise((resolve) => {
    const p = PLAYERS[to] || PLAYERS.jos;
    const d = h('div', { class: `handoff ${to}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title || `Gib das Handy an ${p.name}` });
    d.innerHTML = `
      ${mascot(p.theme, 'hide', 'mascot')}
      <p class="h-kicker">${esc(kicker || 'Handy weitergeben')}</p>
      <h2 class="h-title">${esc(title || `Gib das Handy an ${p.name}`)}</h2>
      ${text ? `<p class="h-text">${esc(text)}</p>` : ''}`;
    const b = h('button', { class: 'btn primary big', type: 'button' }, button || `Ich bin ${nameOf(to)} – los!`);
    d.append(b);
    layer().append(d);
    sfx.whoosh();
    setTimeout(() => b.focus(), 80);
    b.addEventListener('click', () => {
      haptic(15);
      sfx.pop();
      const m = d.querySelector('.masc');
      setMood(m, 'happy');
      d.classList.add('out');
      setTimeout(() => { d.remove(); resolve(); }, motionOK() ? 340 : 0);
    });
  });
}

// ---------- Segment-Umschalter ----------
// segmented({ options: [{value, label, icon}], value, onChange, label })
export function segmented({ options, value, onChange, label, cls = '' }) {
  const wrap = h('div', { class: 'seg ' + cls, role: 'radiogroup', 'aria-label': label || '' });
  wrap.style.setProperty('--n', options.length);
  const thumb = h('span', { class: 'seg-thumb', 'aria-hidden': 'true' });
  wrap.append(thumb);
  const btns = options.map((o, i) => {
    const b = h('button', { class: 'seg-opt', type: 'button', role: 'radio', 'aria-checked': String(o.value === value), dataset: { value: o.value } });
    b.innerHTML = `${o.icon ? icon(o.icon) : ''}<span>${esc(o.label)}</span>`;
    b.addEventListener('click', () => set(o.value, true));
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
      set(options[j].value, true);
      btns[j].focus();
    });
    wrap.append(b);
    return b;
  });
  function set(v, user) {
    const i = Math.max(0, options.findIndex((o) => o.value === v));
    wrap.style.setProperty('--i', i);
    btns.forEach((b, j) => { b.setAttribute('aria-checked', String(j === i)); b.tabIndex = j === i ? 0 : -1; });
    if (user && v !== value) { value = v; sfx.tap(); haptic(8); onChange?.(v); }
    value = v;
  }
  set(value, false);
  wrap.setValue = (v) => set(v, false);
  return wrap;
}
