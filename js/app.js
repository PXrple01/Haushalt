import { store, uid, COLORS, mergeData } from './store.js';
import * as M from './money.js';
import { donut, bars, animateCharts } from './charts.js';

const { fmt } = M;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const D = () => store.data;
const S = () => store.data.settings;
const now = () => Date.now();

const ui = { tab: 'start', person: 'all', range: 'month', offset: 0, listOffset: 0, listCat: '', search: '' };

// ======================================================= Hilfen
const cats = type => D().categories.filter(c => c.type === type);
const catById = id => D().categories.find(c => c.id === id) || { id, emoji: '❓', name: 'Unbekannt', color: '#94A3B8', type: 'expense' };
const profile = p => S().profiles[p] || { name: p, emoji: '🙂' };
const curPeriod = (off = 0) => M.monthPeriod(new Date(), S().monthStartDay, off);

function personOk(t, person = ui.person) {
  if (person === 'all') return true;
  if (person === 'shared') return !!t.shared;
  return t.person === person;
}
function txIn(p, person = ui.person) {
  return D().transactions.filter(t => M.inRange(t.date, p) && personOk(t, person));
}
const sum = (list, type) => list.reduce((s, t) => s + (!type || t.type === type ? t.amount : 0), 0);
function savedIn(p, person = ui.person) {
  if (person === 'me' || person === 'partner') return 0; // Sparziele sind gemeinsam
  return D().goals.reduce((s, g) => s + g.moves.filter(m => M.inRange(m.date, p)).reduce((a, m) => a + m.amount, 0), 0);
}
function byCategory(list) {
  const m = new Map();
  for (const t of list) if (t.type === 'expense') m.set(t.categoryId, (m.get(t.categoryId) || 0) + t.amount);
  return [...m.entries()].map(([id, value]) => ({ ...catById(id), id, value })).sort((a, b) => b.value - a.value);
}
const isFixed = t => !!t.recurringId || !!catById(t.categoryId).fixed;
const personWord = () => ({ all: 'Ihr habt', me: 'Du hast', partner: `${profile('partner').name} hat`, shared: 'Ihr habt gemeinsam' })[ui.person];
function save() { store.save(); }
function haptic() { try { navigator.vibrate?.(8); } catch {} }

// ======================================================= Toast
let toastTimer;
function toast(msg, action, onAction, ms = 3500) {
  const el = $('#toast');
  el.querySelector('span').textContent = msg;
  const b = el.querySelector('button');
  b.textContent = action || '';
  b.classList.toggle('hidden', !action);
  b.onclick = () => { el.classList.remove('in'); onAction?.(); };
  el.classList.add('in');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('in'), ms);
}

// ======================================================= Sheets (von unten)
const sheets = [];
function openSheet(html, mount) {
  const bd = document.createElement('div'); bd.className = 'backdrop';
  const sh = document.createElement('div'); sh.className = 'sheet'; sh.setAttribute('role', 'dialog');
  sh.innerHTML = `<div class="grab"></div>` + html;
  document.body.append(bd, sh);
  const obj = { bd, sh, close: () => closeSheet(obj) };
  sheets.push(obj);
  bd.onclick = obj.close;
  $$('[data-close]', sh).forEach(b => b.onclick = obj.close);
  // nach unten wischen am Griff schließt
  let y0 = null;
  sh.addEventListener('touchstart', e => { y0 = sh.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
  sh.addEventListener('touchend', e => { if (y0 !== null && e.changedTouches[0].clientY - y0 > 110 && e.target.closest('.grab, .sheet-h')) obj.close(); y0 = null; });
  requestAnimationFrame(() => { bd.classList.add('in'); sh.classList.add('in'); });
  mount?.(sh, obj);
  return obj;
}
function closeSheet(obj) {
  const i = sheets.indexOf(obj); if (i < 0) return;
  sheets.splice(i, 1);
  obj.bd.classList.remove('in'); obj.sh.classList.remove('in');
  setTimeout(() => { obj.bd.remove(); obj.sh.remove(); }, 320);
  obj.onClose?.();
}
const sheetHead = title => `<div class="sheet-h"><h2>${title}</h2><button class="x" data-close aria-label="Schließen">✕</button></div>`;

function confirmSheet({ title, text, ok = 'OK', danger = false, cancel = 'Abbrechen', extra }) {
  return new Promise(res => {
    let done = false;
    const s = openSheet(`${sheetHead(title)}<p class="muted" style="margin:0 4px 18px">${text}</p>
      ${extra ? `<button class="btn soft" data-r="extra" style="margin-bottom:10px">${extra}</button>` : ''}
      <button class="btn ${danger ? 'danger' : 'primary'}" data-r="ok">${ok}</button>
      <button class="btn soft" data-r="no" style="margin-top:10px">${cancel}</button>`, (sh, o) => {
      $$('[data-r]', sh).forEach(b => b.onclick = () => { done = true; res(b.dataset.r === 'no' ? false : b.dataset.r); o.close(); });
    });
    s.onClose = () => { if (!done) res(false); };
  });
}

// ======================================================= Feste Buchungen automatisch anlegen
function runRecurring() {
  const today = M.todayISO();
  const [ty, tm] = today.split('-').map(Number);
  let added = 0;
  for (const r of D().recurring) {
    if (!r.active) continue;
    r.booked ||= [];
    let [y, m] = r.start.split('-').map(Number);
    while (y < ty || (y === ty && m <= tm)) {
      const key = `${y}-${M.pad(m)}`;
      const date = `${key}-${M.pad(Math.min(r.day, M.daysIn(y, m - 1)))}`;
      if (date <= today && !r.booked.includes(key)) {
        D().transactions.push({ id: uid(), type: r.type, amount: r.amount, categoryId: r.categoryId, date, note: r.note,
          person: r.person, shared: r.shared, recurringId: r.id, updatedAt: now() });
        r.booked.push(key); added++;
      }
      if (++m > 12) { m = 1; y++; }
    }
  }
  if (added) save();
  return added;
}

// ======================================================= Router
const views = { start: viewStart, buchungen: viewList, auswertung: viewAnalysis, ziele: viewGoals, einstellungen: viewSettings };
function route() {
  const tab = (location.hash || '#start').slice(1);
  const changed = tab !== ui.tab;
  [...sheets].forEach(o => o.close());
  ui.tab = views[tab] ? tab : 'start';
  $$('#tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === ui.tab));
  $('#fab').classList.toggle('hidden', !['start', 'buchungen', 'auswertung'].includes(ui.tab));
  render();
  if (changed) window.scrollTo(0, 0);
}
function render() {
  const v = $('#view');
  v.style.animation = 'none'; v.offsetHeight; v.style.animation = '';
  v.innerHTML = views[ui.tab]();
  bindView(v);
  animateCharts(v);
  requestAnimationFrame(() => $$('.progress > i[data-w]', v).forEach(i => i.style.width = i.dataset.w));
}
function bindView(v) {
  $$('[data-person]', v).forEach(b => b.onclick = () => { ui.person = b.dataset.person; render(); });
  $$('[data-tx]', v).forEach(b => { if (!b.closest('.swipe')) b.onclick = () => openTxSheet(D().transactions.find(t => t.id === b.dataset.tx)); });
  $$('.swipe', v).forEach(bindSwipe);
  $$('[data-act]', v).forEach(b => b.onclick = e => { e.stopPropagation(); actions[b.dataset.act]?.(b.dataset, b); });
  $$('.arc[data-id]', v).forEach(a => a.onclick = e => { e.stopPropagation(); a.closest('[data-donut]')?.dataset.donut === 'cat' && openCategoryDrill(a.dataset.id); a.closest('[data-donut]')?.dataset.donut === 'fixed' && openFixedDrill(a.dataset.id); a.closest('[data-donut]')?.dataset.donut === 'preview' && (location.hash = '#auswertung'); });
}

const personSeg = (withShared = true) => `<div class="seg">
  ${[['all', 'Alle'], ['me', profile('me').name], ['partner', profile('partner').name], ...(withShared ? [['shared', 'Gemeinsam']] : [])]
    .map(([k, l]) => `<button data-person="${k}" class="${ui.person === k ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`;

function progressColor(pct) { return pct >= 100 ? 'p-red' : pct >= 80 ? 'p-yellow' : 'p-green'; }
function progressBar(pct, cls) { return `<div class="progress"><i class="${cls || progressColor(pct)}" data-w="${Math.min(100, Math.max(pct, 0))}%"></i></div>`; }

function txRow(t, swipe = true) {
  const c = catById(t.categoryId);
  const sign = t.type === 'income' ? '+' : '−';
  const tags = [c.name, profile(t.person).name, t.shared ? '👫 gemeinsam' : '', t.recurringId ? '🔁 fest' : ''].filter(Boolean).join(' · ');
  const row = `<button class="item" data-tx="${t.id}">
    <div class="ico" style="background:${c.color}22">${esc(c.emoji)}</div>
    <div class="txt"><div class="t1">${esc(t.note || c.name)}</div><div class="t2">${esc(tags)}</div></div>
    <div class="amt ${t.type === 'income' ? 'green' : 'red'}">${sign}${fmt(t.amount)}</div></button>`;
  return swipe ? `<div class="swipe"><button class="del" data-del="${t.id}">Löschen</button>${row}</div>` : row;
}

// ======================================================= Wischen zum Löschen
let openSwipe = null;
function bindSwipe(w) {
  const it = $('.item', w); let x0, y0, dx = 0, mode = null, base = 0;
  const set = x => it.style.transform = x ? `translateX(${x}px)` : '';
  const close = () => { set(0); base = 0; if (openSwipe === w) openSwipe = null; };
  w._close = close;
  it.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; mode = null; dx = 0; }, { passive: true });
  it.addEventListener('touchmove', e => {
    const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
    if (mode === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) mode = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
    if (mode !== 'x') return;
    e.preventDefault(); it.classList.add('drag');
    dx = mx; set(Math.min(0, Math.max(-140, base + dx)));
  }, { passive: false });
  it.addEventListener('touchend', () => {
    it.classList.remove('drag');
    if (mode !== 'x') return;
    if (base + dx < -48) { if (openSwipe && openSwipe !== w) openSwipe._close(); base = -96; set(-96); openSwipe = w; haptic(); }
    else close();
    it._justSwiped = true; setTimeout(() => it._justSwiped = false, 50);
  });
  it.onclick = () => {
    if (it._justSwiped) return;
    if (base) return close();
    if (openSwipe) openSwipe._close();
    openTxSheet(D().transactions.find(t => t.id === it.dataset.tx));
  };
  $('.del', w).onclick = () => deleteTx(it.dataset.tx);
}
function deleteTx(id) {
  const i = D().transactions.findIndex(t => t.id === id); if (i < 0) return;
  const [t] = D().transactions.splice(i, 1); save(); render(); haptic();
  toast(`Buchung gelöscht`, 'Rückgängig', () => { D().transactions.push(t); save(); render(); });
}

// ======================================================= START
function viewStart() {
  const p = curPeriod();
  const list = txIn(p);
  const inc = sum(list, 'income'), out = sum(list, 'expense'), saved = savedIn(p);
  const left = inc - out - saved;
  const budget = S().monthlyBudget;
  const hasAny = D().transactions.length > 0;
  const catsData = byCategory(list);

  // Warnungen
  const warns = [];
  if (budget > 0 && ui.person === 'all') {
    const pct = out / budget * 100;
    if (pct >= 100) warns.push(['bad', '🚨', `Monatsbudget überschritten – ${fmt(out - budget)} drüber.`]);
    else if (pct >= 80) warns.push(['warn', '⚠️', `Schon ${Math.round(pct)} % vom Monatsbudget ausgegeben.`]);
  }
  if (ui.person === 'all') for (const c of cats('expense')) if (c.budget > 0) {
    const s = catsData.find(x => x.id === c.id)?.value || 0, pct = s / c.budget * 100;
    if (pct >= 100) warns.push(['bad', c.emoji, `${c.name}: Budget überschritten (${fmt(s)} von ${fmt(c.budget)}).`]);
    else if (pct >= 80) warns.push(['warn', c.emoji, `${c.name}: ${Math.round(pct)} % vom Budget verbraucht.`]);
  }

  const recent = [...list].sort((a, b) => b.date.localeCompare(a.date) || (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 5);

  return `
  <div class="row between"><h1 class="page-title">Hallo ${esc(profile(S().devicePerson).emoji)}</h1><span class="muted small">${esc(p.label)}</span></div>
  ${personSeg()}
  <div class="card hero">
    <div class="hero-label">Das hast du diesen Monat noch übrig</div>
    <div class="hero-num ${left < 0 ? 'red' : left > 0 ? 'green' : ''}">${fmt(left)}</div>
    <div class="hero-hint">${left < 0 ? 'Du hast mehr ausgegeben als eingenommen 😬' : inc === 0 ? 'Trag zuerst ein, was reinkommt (z. B. Taschengeld)' : `von ${fmt(inc)} Einnahmen`}</div>
    ${budget > 0 ? `<div style="margin-top:18px;text-align:left">
      <div class="row between small"><b>Monatsbudget</b><span class="muted">${fmt(out)} von ${fmt(budget)}</span></div>
      ${progressBar(out / budget * 100)}
      <div class="small muted">${out <= budget ? `Noch ${fmt(budget - out)} im Budget` : `${fmt(out - budget)} über dem Budget`}</div></div>`
      : `<button class="btn soft sm" style="margin-top:16px" data-act="budget">🎯 Monatsbudget festlegen</button>`}
  </div>
  ${warns.map(([k, e, t]) => `<div class="banner ${k}"><span>${e}</span><span>${esc(t)}</span></div>`).join('')}
  <div class="grid2" style="margin-bottom:12px">
    <div class="stat stat-in"><div class="lbl">⬆️ Einnahmen</div><div class="num">${fmt(inc)}</div></div>
    <div class="stat stat-out"><div class="lbl">⬇️ Ausgaben</div><div class="num">${fmt(out)}</div></div>
  </div>
  ${saved ? `<div class="stat stat-save" style="margin-bottom:12px"><div class="lbl">🐷 Diesen Monat gespart</div><div class="num">${fmt(saved)}</div></div>` : ''}
  ${!hasAny ? `<div class="card"><div class="empty"><div class="big">👋</div><b>Willkommen!</b>
      Tippe unten rechts auf <b style="display:inline">+</b>, um deine erste Ausgabe oder Einnahme einzutragen.
      <div style="margin-top:16px"><button class="btn soft sm" data-act="demo">👀 Mit Beispieldaten ausprobieren</button></div></div></div>` : ''}
  <div class="card tap" data-act="goAna">
    <div class="card-title">Wohin geht mein Geld? <span class="link">Mehr ›</span></div>
    ${catsData.length ? `<div class="mini-donut" data-donut="preview">
        ${donut(catsData, { center: fmt(out), size: 120, width: 15 })}
        <div class="legend-mini">${catsData.slice(0, 4).map(c => `<div><span class="row" style="gap:6px;min-width:0"><span class="dot" style="background:${c.color}"></span>${esc(c.emoji)} <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</span></span><b>${Math.round(c.value / out * 100)}%</b></div>`).join('')}</div>
      </div>` : `<div class="mini-donut">${donut(SAMPLE, { center: '?', size: 110, width: 15, muted: true })}<div class="legend-mini muted">Noch keine Ausgaben diesen Monat. Sobald du etwas einträgst, siehst du hier, wofür dein Geld draufgeht.</div></div>`}
  </div>
  <div class="card-title" style="margin:20px 6px 10px">Letzte Buchungen ${recent.length ? '<a class="link" href="#buchungen">Alle ›</a>' : ''}</div>
  ${recent.length ? `<div class="list">${recent.map(t => txRow(t)).join('')}</div>`
    : `<div class="card empty"><div class="big">🧾</div><b>Noch nichts eingetragen</b>Zum Beispiel: 🚌 Busfahrkarte 50 € oder 💶 Taschengeld 80 €.</div>`}
  `;
}
const SAMPLE = [
  { id: 's1', value: 40, color: '#6366F1', emoji: '🏠', name: 'Miete & Wohnen' },
  { id: 's2', value: 22, color: '#F59E0B', emoji: '🛒', name: 'Essen & Einkauf' },
  { id: 's3', value: 15, color: '#EC4899', emoji: '🎮', name: 'Freizeit & Zocken' },
  { id: 's4', value: 12, color: '#8B5CF6', emoji: '🔁', name: 'Abos' },
  { id: 's5', value: 11, color: '#06B6D4', emoji: '🚌', name: 'Bus & Fahrkarte' },
];

// ======================================================= BUCHUNGEN
function viewList() {
  const p = curPeriod(ui.listOffset);
  const q = ui.search.trim().toLowerCase();
  let list = txIn(p).filter(t => !ui.listCat || t.categoryId === ui.listCat);
  if (q) list = list.filter(t => {
    const c = catById(t.categoryId);
    return [t.note, c.name, profile(t.person).name, M.fmt(t.amount)].join(' ').toLowerCase().includes(q);
  });
  list.sort((a, b) => b.date.localeCompare(a.date) || (b.updatedAt || 0) - (a.updatedAt || 0));
  const groups = new Map();
  for (const t of list) { if (!groups.has(t.date)) groups.set(t.date, []); groups.get(t.date).push(t); }
  const usedCats = [...new Set(txIn(p).map(t => t.categoryId))].map(catById);

  return `
  <h1 class="page-title">Buchungen</h1>
  ${personSeg()}
  <div class="navper"><button data-act="listPrev" aria-label="Vorheriger Monat">‹</button><b>${esc(p.label)}</b><button data-act="listNext" aria-label="Nächster Monat" ${ui.listOffset >= 0 ? 'disabled style="opacity:.3"' : ''}>›</button></div>
  <input class="input" id="search" type="search" placeholder="🔎 Suchen (z. B. Netflix)" value="${esc(ui.search)}" style="margin-bottom:12px">
  <div class="chips">
    <button class="chip ${!ui.listCat ? 'on' : ''}" data-act="listCat" data-id="">Alle</button>
    ${usedCats.map(c => `<button class="chip ${ui.listCat === c.id ? 'on' : ''}" data-act="listCat" data-id="${c.id}">${esc(c.emoji)} ${esc(c.name)}</button>`).join('')}
  </div>
  <div class="grid2" style="margin-bottom:6px">
    <div class="stat stat-in"><div class="lbl">Einnahmen</div><div class="num">${fmt(sum(list, 'income'))}</div></div>
    <div class="stat stat-out"><div class="lbl">Ausgaben</div><div class="num">${fmt(sum(list, 'expense'))}</div></div>
  </div>
  <button class="btn soft sm" data-act="recurring" style="margin:10px 0 0">🔁 Feste Kosten & Einnahmen</button>
  ${list.length ? [...groups].map(([d, ts]) => `<div class="group-h">${M.dayLabel(d)}</div><div class="list">${ts.map(t => txRow(t)).join('')}</div>`).join('')
      + `<p class="hint">Tipp: Nach links wischen zum Löschen, tippen zum Bearbeiten.</p>`
    : `<div class="card empty" style="margin-top:14px"><div class="big">${q || ui.listCat ? '🔍' : '🗓️'}</div><b>${q || ui.listCat ? 'Nichts gefunden' : 'Keine Buchungen in diesem Monat'}</b>${q || ui.listCat ? 'Versuch einen anderen Suchbegriff oder Filter.' : 'Tippe auf +, um etwas einzutragen.'}</div>`}
  `;
}

// ======================================================= AUSWERTUNG
function rangePeriod(off = ui.offset) {
  const d = new Date();
  if (ui.range === 'week') return M.weekPeriod(d, off);
  if (ui.range === 'year') return M.yearPeriod(d, off);
  return curPeriod(off);
}
function viewAnalysis() {
  const p = rangePeriod();
  const list = txIn(p);
  const data = byCategory(list);
  const out = sum(list, 'expense'), inc = sum(list, 'income');
  const empty = data.length === 0;

  const segs = empty ? SAMPLE : data;
  const total = empty ? 100 : out;
  const legend = segs.map(c => `
    <button class="item" ${empty ? '' : `data-act="drill" data-id="${c.id}"`}>
      <div class="ico" style="background:${c.color}22">${esc(c.emoji)}</div>
      <div class="txt"><div class="t1">${esc(c.name)}</div>
        <div class="barline"><i style="width:${(c.value / segs[0].value * 100).toFixed(1)}%;background:${c.color}"></i></div></div>
      <div><div class="amt">${empty ? '–' : fmt(c.value)}</div><div class="pct">${Math.round(c.value / total * 100)} %</div></div>
    </button>`).join('');

  // feste vs. freie
  const fixed = list.filter(t => t.type === 'expense' && isFixed(t)).reduce((s, t) => s + t.amount, 0);
  const free = out - fixed;

  // 6 Monate
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const mp = curPeriod(-i + (ui.range === 'month' ? ui.offset : 0));
    const l = txIn(mp);
    months.push({ label: mp.short, a: sum(l, 'income'), b: sum(l, 'expense'), current: i === 0 });
  }

  return `
  <h1 class="page-title">Auswertung</h1>
  <div class="seg big">${[['week', 'Woche'], ['month', 'Monat'], ['year', 'Jahr']].map(([k, l]) => `<button data-act="range" data-r="${k}" class="${ui.range === k ? 'on' : ''}">${l}</button>`).join('')}</div>
  ${personSeg()}
  <div class="navper"><button data-act="prev" aria-label="Zurück">‹</button><b>${esc(p.label)}</b><button data-act="next" aria-label="Weiter" ${ui.offset >= 0 ? 'disabled style="opacity:.3"' : ''}>›</button></div>

  <div class="card" data-donut="cat">
    <div class="card-title">Wohin geht mein Geld?</div>
    ${donut(segs, { center: empty ? 'Beispiel' : fmt(out), sub: empty ? '' : 'ausgegeben', size: 240, width: 14, muted: empty })}
    ${empty ? `<p class="sample-note">✨ So sieht es aus, sobald du Ausgaben einträgst.</p>` : `<p class="hint">Tippe auf ein Stück oder eine Zeile für Details.</p>`}
  </div>
  <div class="list legend">${legend}</div>

  ${!empty ? `<div class="card"><div class="card-title">💬 Kurz gesagt</div>${insights(p, list, data, inc, out)}</div>` : ''}

  <div class="card" data-donut="fixed">
    <div class="card-title">Feste Kosten vs. freie Ausgaben</div>
    ${out ? `<div class="mini-donut">
      ${donut([{ id: 'fixed', value: fixed, color: '#6366F1', label: 'Feste Kosten' }, { id: 'free', value: free, color: '#F59E0B', label: 'Freie Ausgaben' }].filter(x => x.value > 0), { center: Math.round(fixed / out * 100) + ' %', sub: 'fest', size: 130, width: 16 })}
      <div class="legend-mini">
        <div data-act="fixedDrill" data-id="fixed"><span class="row" style="gap:6px"><span class="dot" style="background:#6366F1"></span>🔒 Feste Kosten</span><b>${fmt(fixed)}</b></div>
        <div class="small muted" style="display:block;padding:0 0 8px 16px">Miete, Abos, Fahrkarte – kommt jeden Monat</div>
        <div data-act="fixedDrill" data-id="free"><span class="row" style="gap:6px"><span class="dot" style="background:#F59E0B"></span>🎈 Freie Ausgaben</span><b>${fmt(free)}</b></div>
        <div class="small muted" style="display:block;padding:0 0 0 16px">Essen, Freizeit, Kleidung …</div>
      </div></div>` : `<div class="empty" style="padding:10px">Noch keine Ausgaben in diesem Zeitraum.</div>`}
  </div>

  <div class="card">
    <div class="card-title">Einnahmen & Ausgaben – 6 Monate</div>
    ${bars(months, { fmt })}
    <div class="row" style="justify-content:center;gap:18px;margin-top:8px;font-size:14px">
      <span class="row" style="gap:6px"><span class="dot" style="background:var(--green)"></span>Einnahmen</span>
      <span class="row" style="gap:6px"><span class="dot" style="background:var(--red)"></span>Ausgaben</span></div>
  </div>`;
}

function insights(p, list, data, inc, out) {
  const prevP = rangePeriod(ui.offset - 1);
  const prev = byCategory(txIn(prevP));
  const prevOut = sum(txIn(prevP), 'expense');
  const unit = { week: ['diese Woche', 'letzte Woche'], month: ['diesen Monat', 'letzten Monat'], year: ['dieses Jahr', 'letztes Jahr'] }[ui.range];
  const [curW, prevW] = ui.offset === 0 ? unit : [`im Zeitraum ${p.label}`, 'im Zeitraum davor'];
  const who = personWord();
  const cmp = (a, b) => {
    if (!b) return `${prevW} noch gar nichts`;
    const d = a - b;
    if (Math.abs(d) < 100) return `ungefähr so viel wie ${prevW}`;
    return d > 0 ? `${fmt(d)} mehr als ${prevW}` : `${fmt(-d)} weniger als ${prevW}`;
  };
  const lines = [];
  lines.push(['💸', `${who} ${curW} insgesamt <b>${fmt(out)}</b> ausgegeben – ${cmp(out, prevOut)}.`]);
  for (const c of data.slice(0, 3)) {
    const pv = prev.find(x => x.id === c.id)?.value || 0;
    lines.push([c.emoji, `${who} ${curW} <b>${fmt(c.value)}</b> für ${esc(c.name)} ausgegeben, ${cmp(c.value, pv)}.`]);
  }
  if (inc > 0) {
    const diff = inc - out;
    lines.push(diff >= 0 ? ['👍', `Ihr habt <b>${fmt(diff)}</b> mehr eingenommen als ausgegeben. Super zum Sparen!`]
      : ['😬', `Es wurde <b>${fmt(-diff)}</b> mehr ausgegeben als eingenommen.`]);
  }
  if (ui.person === 'all') {
    const me = sum(list.filter(t => t.person === 'me'), 'expense'), pa = sum(list.filter(t => t.person === 'partner'), 'expense');
    if (me && pa) lines.push(['👫', `${esc(profile('me').name)}: ${fmt(me)} · ${esc(profile('partner').name)}: ${fmt(pa)}.`]);
  }
  return lines.map(([e, t]) => `<div class="insight"><span class="e">${esc(e)}</span><span>${t}</span></div>`).join('');
}

function openCategoryDrill(id) {
  const p = rangePeriod();
  const c = catById(id);
  const list = txIn(p).filter(t => t.categoryId === id).sort((a, b) => b.date.localeCompare(a.date));
  drillSheet(`${c.emoji} ${c.name}`, p.label, list);
}
function openFixedDrill(kind) {
  const p = rangePeriod();
  const list = txIn(p).filter(t => t.type === 'expense' && (kind === 'fixed') === isFixed(t)).sort((a, b) => b.date.localeCompare(a.date));
  drillSheet(kind === 'fixed' ? '🔒 Feste Kosten' : '🎈 Freie Ausgaben', p.label, list);
}
function drillSheet(title, label, list) {
  openSheet(`${sheetHead(esc(title))}
    <div class="stat stat-out" style="margin-bottom:12px"><div class="lbl">${esc(label)}</div><div class="num">${fmt(sum(list))}</div></div>
    ${list.length ? `<div class="list">${list.map(t => txRow(t, false)).join('')}</div>` : '<div class="empty">Keine Buchungen.</div>'}`, (sh, o) => {
    $$('[data-tx]', sh).forEach(b => b.onclick = () => { o.close(); openTxSheet(D().transactions.find(t => t.id === b.dataset.tx)); });
  });
}

// ======================================================= SPARZIELE
const goalSaved = g => g.moves.reduce((s, m) => s + m.amount, 0);
function addMonths(n) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + n); return M.monthYear(d); }
function monthsUntil(dateISO) {
  const t = M.fromISO(dateISO), n = new Date();
  return (t.getFullYear() - n.getFullYear()) * 12 + (t.getMonth() - n.getMonth());
}
function planText(g, rate) {
  const left = g.target - goalSaved(g);
  if (left <= 0) return '🎉 Ziel erreicht! Glückwunsch!';
  if (!rate || rate <= 0) return 'Gib ein, wie viel du jeden Monat sparen willst.';
  const n = Math.ceil(left / rate);
  return `Wenn du jeden Monat <b>${fmt(rate)}</b> sparst, schaffst du es im <b>${addMonths(n)}</b>${n > 1 ? ` (in ${n} Monaten)` : ''}.`;
}
function neededPerMonth(g) {
  if (!g.deadline) return 0;
  const left = g.target - goalSaved(g); if (left <= 0) return 0;
  return Math.ceil(left / Math.max(1, monthsUntil(g.deadline)));
}
function viewGoals() {
  const goals = D().goals;
  const total = goals.reduce((s, g) => s + goalSaved(g), 0);
  return `
  <h1 class="page-title">Sparziele</h1>
  ${goals.length ? `<div class="stat stat-save" style="margin-bottom:12px"><div class="lbl">🐷 Insgesamt gespart</div><div class="num">${fmt(total)}</div></div>` : ''}
  ${goals.map(g => {
    const s = goalSaved(g), pct = g.target ? s / g.target * 100 : 0, left = g.target - s;
    const need = neededPerMonth(g);
    return `<div class="card tap" data-act="goal" data-id="${g.id}">
      <div class="goal-head"><div class="goal-emoji">${esc(g.emoji)}</div>
        <div style="flex:1;min-width:0"><div class="goal-name">${esc(g.name)}</div>
        <div class="small muted">${g.deadline ? `bis ${M.monthYear(M.fromISO(g.deadline))}` : 'ohne Datum'}</div></div>
        <div class="blue" style="font-weight:800;font-size:22px">${Math.floor(pct)} %</div></div>
      ${progressBar(pct, 'p-blue')}
      <div class="goal-nums"><span><b>${fmt(s)}</b> <span class="muted">von ${fmt(g.target)}</span></span>
        <span class="muted">${left > 0 ? `Noch ${fmt(left)} bis zum Ziel` : '🎉 Geschafft!'}</span></div>
      ${need ? `<div class="small" style="margin-top:8px">📅 Dafür jeden Monat <b>${fmt(need)}</b> zur Seite legen.</div>` : ''}
      <div class="grid2" style="margin-top:14px">
        <button class="btn blue sm" data-act="move" data-id="${g.id}" data-dir="1">＋ Einzahlen</button>
        <button class="btn soft sm" data-act="move" data-id="${g.id}" data-dir="-1">－ Auszahlen</button></div>
    </div>`;
  }).join('')}
  ${!goals.length ? `<div class="card"><div class="empty"><div class="big">🏡</div><b>Worauf spart ihr?</b>Zum Beispiel auf die Kaution für eure erste Wohnung.</div>
      <div class="card" style="background:var(--card2);box-shadow:none;opacity:.8">
        <div class="goal-head"><div class="goal-emoji">🔑</div><div style="flex:1"><div class="goal-name">Wohnung – Kaution</div><div class="small muted">Beispiel</div></div><b class="blue">30 %</b></div>
        <div class="progress"><i class="p-blue" style="width:30%"></i></div>
        <div class="goal-nums"><span><b>450 €</b> <span class="muted">von 1.500 €</span></span><span class="muted">Noch 1.050 €</span></div></div>
      <button class="btn primary" data-act="goalExample">🔑 Dieses Ziel anlegen</button></div>` : ''}
  <button class="btn ${goals.length ? 'soft' : 'soft'}" data-act="newGoal" style="margin-top:6px">＋ Neues Sparziel</button>
  `;
}
function goalForm(g) {
  const isNew = !g;
  g ||= { id: uid(), name: '', emoji: '🏡', target: 0, deadline: '', plan: 0, moves: [] };
  openSheet(`${sheetHead(isNew ? 'Neues Sparziel' : 'Ziel bearbeiten')}
    <label class="field"><span>Name & Emoji</span><div class="row">
      <input class="input emoji-input" id="gE" value="${esc(g.emoji)}" maxlength="4">
      <input class="input" id="gN" placeholder="z. B. Wohnung – Kaution" value="${esc(g.name)}"></div>
      <div class="emoji-pick">${['🏡', '🔑', '🛋️', '✈️', '🚗', '💻', '📱', '🎮', '🎓', '💍', '🐶', '🎉'].map(e => `<button data-e="${e}">${e}</button>`).join('')}</div></label>
    <label class="field"><span>Zielbetrag</span><input class="input big" id="gT" inputmode="decimal" placeholder="0 €" value="${g.target ? (g.target / 100).toString().replace('.', ',') : ''}"></label>
    <label class="field"><span>Bis wann? (optional)</span><input class="input" id="gD" type="date" value="${esc(g.deadline || '')}"></label>
    <button class="btn primary" id="gSave">Speichern</button>
    ${!isNew ? `<button class="btn red" id="gDel" style="margin-top:10px">Ziel löschen</button>` : ''}`, (sh, o) => {
    $$('[data-e]', sh).forEach(b => b.onclick = e => { e.preventDefault(); $('#gE', sh).value = b.dataset.e; });
    $('#gSave', sh).onclick = () => {
      const target = M.parseCents($('#gT', sh).value);
      const name = $('#gN', sh).value.trim();
      if (!name) return $('#gN', sh).focus();
      if (!(target > 0)) return $('#gT', sh).focus();
      Object.assign(g, { name, emoji: $('#gE', sh).value.trim() || '🎯', target, deadline: $('#gD', sh).value, updatedAt: now() });
      if (isNew) D().goals.push(g);
      save(); o.close(); render(); toast(isNew ? 'Sparziel angelegt 🎯' : 'Gespeichert');
    };
    $('#gDel', sh)?.addEventListener('click', async () => {
      if (await confirmSheet({ title: 'Ziel löschen?', text: `„${esc(g.name)}“ und alle Einzahlungen werden gelöscht.`, ok: 'Löschen', danger: true })) {
        D().goals = D().goals.filter(x => x.id !== g.id); save(); sheets.forEach(s => s.close()); render();
      }
    });
  });
}
function goalDetail(g) {
  const avg = (() => { // Durchschnitt pro Monat seit erster Einzahlung
    if (!g.moves.length) return 0;
    const first = g.moves.map(m => m.date).sort()[0];
    return Math.round(goalSaved(g) / Math.max(1, monthsUntil(M.todayISO()) - monthsUntil(first) + 1));
  })();
  const rate0 = g.plan || neededPerMonth(g) || Math.max(avg, 0) || 5000;
  openSheet(`${sheetHead(`${esc(g.emoji)} ${esc(g.name)}`)}
    <div class="card">
      <div class="card-title">🧮 Sparrechner</div>
      <label class="field"><span>So viel sparen wir jeden Monat</span><input class="input big" id="rate" inputmode="decimal" value="${(rate0 / 100).toString().replace('.', ',')}"></label>
      <input type="range" id="rateR" min="0" max="${Math.max(50000, rate0 * 2)}" step="500" value="${rate0}" style="width:100%;accent-color:var(--blue);height:44px">
      <p id="planOut" style="margin:8px 0 0;font-size:17px">${planText(g, rate0)}</p>
      ${g.deadline ? `<p class="small muted" style="margin:10px 0 0">Für ${M.monthYear(M.fromISO(g.deadline))} braucht ihr ${fmt(neededPerMonth(g))} pro Monat.</p>` : ''}
    </div>
    <div class="grid2" style="margin-bottom:12px">
      <button class="btn blue" data-m="1">＋ Einzahlen</button><button class="btn soft" data-m="-1">－ Auszahlen</button></div>
    <div class="card-title" style="margin:16px 6px 8px">Verlauf</div>
    ${g.moves.length ? `<div class="list">${[...g.moves].sort((a, b) => b.date.localeCompare(a.date)).map(m => `
      <div class="item"><div class="ico" style="background:var(--blue-bg)">${m.amount > 0 ? '🐷' : '↩️'}</div>
        <div class="txt"><div class="t1">${m.amount > 0 ? 'Eingezahlt' : 'Ausgezahlt'}</div><div class="t2">${M.dayLabel(m.date)}</div></div>
        <div class="amt ${m.amount > 0 ? 'blue' : 'red'}">${fmt(m.amount, { sign: true })}</div>
        <button class="x" data-rm="${m.id}" aria-label="Entfernen">🗑</button></div>`).join('')}</div>`
      : '<div class="empty">Noch keine Einzahlungen.</div>'}
    <button class="btn soft" id="gEdit" style="margin-top:6px">✏️ Ziel bearbeiten</button>`, (sh, o) => {
    const upd = v => { $('#planOut', sh).innerHTML = planText(g, v); g.plan = v; save(); };
    $('#rate', sh).oninput = e => { const v = M.parseCents(e.target.value) || 0; $('#rateR', sh).value = v; upd(v); };
    $('#rateR', sh).oninput = e => { const v = +e.target.value; $('#rate', sh).value = (v / 100).toString().replace('.', ','); upd(v); };
    $$('[data-m]', sh).forEach(b => b.onclick = () => { o.close(); moveSheet(g, +b.dataset.m); });
    $$('[data-rm]', sh).forEach(b => b.onclick = () => { g.moves = g.moves.filter(m => m.id !== b.dataset.rm); g.updatedAt = now(); save(); o.close(); render(); goalDetail(g); });
    $('#gEdit', sh).onclick = () => goalForm(g);
    o.onClose = () => render();
  });
}
function moveSheet(g, dir) {
  const keypad = makeKeypad();
  openSheet(`${sheetHead(dir > 0 ? `${esc(g.emoji)} Einzahlen` : `${esc(g.emoji)} Auszahlen`)}
    <div class="amount ${dir > 0 ? '' : 'out'}" id="amt" style="${dir > 0 ? 'color:var(--blue)' : ''}">${M.keypadDisplay('')}</div>
    ${keypad.html}
    <p class="hint">${dir > 0 ? 'Das Geld wird bei „übrig“ abgezogen und landet im Sparziel.' : 'Das Geld kommt aus dem Sparziel zurück.'}</p>
    <button class="btn ${dir > 0 ? 'primary' : 'red'}" id="ok">${dir > 0 ? 'Einzahlen' : 'Auszahlen'}</button>`, (sh, o) => {
    keypad.bind(sh, $('#amt', sh));
    $('#ok', sh).onclick = () => {
      const c = keypad.cents();
      if (!c) return shake($('#amt', sh));
      if (dir < 0 && c > goalSaved(g)) { shake($('#amt', sh)); return toast(`Im Ziel sind nur ${fmt(goalSaved(g))}.`); }
      g.moves.push({ id: uid(), amount: c * dir, date: M.todayISO(), updatedAt: now() }); g.updatedAt = now();
      save(); o.close(); render(); haptic();
      const left = g.target - goalSaved(g);
      toast(left <= 0 ? '🎉 Ziel erreicht!' : dir > 0 ? `${fmt(c)} gespart – noch ${fmt(left)} 💪` : `${fmt(c)} ausgezahlt`);
    };
  });
}

// ======================================================= Zahlentastatur
function makeKeypad(initial = '') {
  let s = initial;
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'];
  return {
    html: `<div class="keypad">${keys.map(k => `<button data-k="${k}" aria-label="${k === '⌫' ? 'Löschen' : k}">${k}</button>`).join('')}</div>`,
    cents: () => M.parseCents(s),
    bind(root, display, onChange) {
      const show = () => { display.textContent = M.keypadDisplay(s); onChange?.(); };
      $$('[data-k]', root).forEach(b => b.onclick = () => {
        const k = b.dataset.k; haptic();
        if (k === '⌫') s = s.slice(0, -1);
        else if (k === ',') { if (!s.includes(',')) s = (s || '0') + ','; }
        else {
          if (s.includes(',') && s.split(',')[1].length >= 2) return shake(display);
          if (!s.includes(',') && s.replace(/^0+/, '').length >= 6) return shake(display);
          s = s === '0' ? k : s + k;
        }
        show();
      });
      show();
    },
  };
}
function shake(el) { el.classList.remove('shake'); el.offsetWidth; el.classList.add('shake'); haptic(); }
const centsToInput = c => { const e = Math.floor(c / 100), f = c % 100; return f ? `${e},${M.pad(f)}`.replace(/0$/, '') : String(e); };

// ======================================================= Buchung hinzufügen / bearbeiten
function openTxSheet(tx) {
  const isNew = !tx;
  const t = tx ? { ...tx } : { type: 'expense', amount: 0, categoryId: '', date: M.todayISO(), note: '', person: S().devicePerson, shared: false };
  const keypad = makeKeypad(t.amount ? centsToInput(t.amount) : '');
  openSheet(`${sheetHead(isNew ? 'Neue Buchung' : 'Buchung bearbeiten')}
    <div class="seg type big"><button data-type="expense" class="out">⬇️ Ausgabe</button><button data-type="income" class="in">⬆️ Einnahme</button></div>
    <div class="amount" id="amt"></div>
    ${keypad.html}
    <div class="opts">
      <label class="opt" id="dateL">📅 <span id="dateT"></span><input type="date" id="date" value="${t.date}"></label>
      <button class="opt" id="who"></button>
      <button class="opt" id="shared">👫 Gemeinsam</button>
      <button class="opt" id="noteB">📝 Notiz</button>
    </div>
    <input class="input hidden" id="note" placeholder="Notiz, z. B. Netflix" value="${esc(t.note)}" style="margin-bottom:12px" maxlength="60">
    <p class="hint" id="catHint"></p>
    <div class="tiles" id="tiles"></div>
    ${!isNew ? `<div style="margin-top:16px"><button class="btn primary" id="saveB">Speichern</button>
      <button class="btn red" id="delB" style="margin-top:10px">🗑 Löschen</button></div>` : ''}
  `, (sh, o) => {
    const amtEl = $('#amt', sh);
    const paint = () => {
      $$('[data-type]', sh).forEach(b => b.classList.toggle('on', b.dataset.type === t.type));
      amtEl.className = 'amount ' + (t.type === 'income' ? 'in' : 'out');
      $('#dateT', sh).textContent = M.dayLabel(t.date);
      $('#who', sh).textContent = `${profile(t.person).emoji} ${profile(t.person).name}`;
      $('#shared', sh).classList.toggle('on', t.shared);
      $('#noteB', sh).classList.toggle('on', !!t.note);
      $('#catHint', sh).textContent = isNew ? 'Kategorie antippen – fertig! ✅' : 'Kategorie';
      $('#tiles', sh).innerHTML = cats(t.type).map(c => `<button class="tile ${c.id === t.categoryId ? 'sel' : ''}" data-cat="${c.id}" style="background:${c.color}1f">
        <span class="e">${esc(c.emoji)}</span><span class="n">${esc(c.name)}</span></button>`).join('')
        + `<button class="tile add" data-newcat><span class="e">＋</span><span class="n">Neue Kategorie</span></button>`;
      $$('[data-cat]', sh).forEach(b => b.onclick = () => { t.categoryId = b.dataset.cat; if (isNew) commit(); else paint(); });
      $('[data-newcat]', sh).onclick = () => categoryForm(null, t.type, c => { t.categoryId = c.id; paint(); });
    };
    keypad.bind(sh, amtEl);
    $$('[data-type]', sh).forEach(b => b.onclick = () => { t.type = b.dataset.type; if (catById(t.categoryId).type !== t.type) t.categoryId = ''; paint(); });
    $('#date', sh).onchange = e => { t.date = e.target.value || M.todayISO(); paint(); };
    $('#who', sh).onclick = () => { t.person = t.person === 'me' ? 'partner' : 'me'; paint(); };
    $('#shared', sh).onclick = () => { t.shared = !t.shared; paint(); };
    $('#noteB', sh).onclick = () => { const n = $('#note', sh); n.classList.toggle('hidden'); if (!n.classList.contains('hidden')) n.focus(); };
    if (t.note) $('#note', sh).classList.remove('hidden');
    $('#note', sh).oninput = e => { t.note = e.target.value; $('#noteB', sh).classList.toggle('on', !!t.note); };

    function commit() {
      t.amount = keypad.cents();
      if (!t.amount) { shake(amtEl); toast('Bitte zuerst einen Betrag eintippen'); return; }
      if (!t.categoryId) { toast('Bitte eine Kategorie wählen'); return; }
      const before = budgetState(t);
      t.note = t.note.trim(); t.updatedAt = now();
      if (isNew) { t.id = uid(); D().transactions.push(t); }
      else Object.assign(D().transactions.find(x => x.id === t.id), t);
      save(); o.close(); render(); haptic();
      const warn = budgetWarning(before, budgetState(t));
      toast(warn || `${t.type === 'income' ? '⬆️' : '⬇️'} ${fmt(t.amount)} ${catById(t.categoryId).emoji} gespeichert`,
        isNew && !warn ? 'Rückgängig' : '', () => { D().transactions = D().transactions.filter(x => x.id !== t.id); save(); render(); }, warn ? 5000 : 3500);
    }
    $('#saveB', sh)?.addEventListener('click', commit);
    $('#delB', sh)?.addEventListener('click', () => { o.close(); deleteTx(t.id); });
    paint();
  });
}
function budgetState(t) {
  const p = M.monthPeriod(M.fromISO(t.date), S().monthStartDay);
  const l = txIn(p, 'all');
  const c = catById(t.categoryId);
  return { total: sum(l, 'expense'), cat: l.filter(x => x.categoryId === c.id && x.type === 'expense').reduce((s, x) => s + x.amount, 0), c };
}
function budgetWarning(a, b) {
  const lvl = (v, max) => !max ? 0 : v >= max ? 2 : v >= max * .8 ? 1 : 0;
  const B = S().monthlyBudget;
  if (lvl(b.cat, b.c.budget) > lvl(a.cat, b.c.budget)) return lvl(b.cat, b.c.budget) === 2 ? `🚨 Budget für ${b.c.name} überschritten!` : `⚠️ 80 % vom Budget für ${b.c.name} erreicht`;
  if (lvl(b.total, B) > lvl(a.total, B)) return lvl(b.total, B) === 2 ? '🚨 Monatsbudget überschritten!' : '⚠️ 80 % vom Monatsbudget erreicht';
  return '';
}

// ======================================================= Kategorien
const EMOJIS = ['🍕', '☕', '🍔', '🥤', '🎬', '📚', '✂️', '💊', '🐱', '⚽', '🎵', '🚲', '⛽', '💡', '📱', '🧴', '🎓', '💼', '🏦', '🎁', '🧾', '🛍️', '🍺', '🧸'];
function categoryForm(c, type, onSaved) {
  const isNew = !c;
  c = c ? { ...c } : { id: uid(), type, emoji: '🍕', name: '', color: COLORS[D().categories.length % COLORS.length], budget: 0, fixed: false };
  openSheet(`${sheetHead(isNew ? 'Neue Kategorie' : 'Kategorie bearbeiten')}
    <label class="field"><span>Emoji & Name</span><div class="row">
      <input class="input emoji-input" id="cE" value="${esc(c.emoji)}" maxlength="4">
      <input class="input" id="cN" placeholder="z. B. Essen gehen" value="${esc(c.name)}" maxlength="24"></div>
      <div class="emoji-pick">${EMOJIS.map(e => `<button data-e="${e}">${e}</button>`).join('')}</div></label>
    <div class="field"><span>Farbe</span><div class="swatches">${COLORS.map(col => `<button class="swatch ${col === c.color ? 'sel' : ''}" data-col="${col}" style="background:${col}" aria-label="Farbe ${col}"></button>`).join('')}</div></div>
    ${c.type === 'expense' ? `
    <label class="field"><span>Budget pro Monat (optional)</span><input class="input" id="cB" inputmode="decimal" placeholder="z. B. 30" value="${c.budget ? centsToInput(c.budget) : ''}"></label>
    <div class="list"><button class="set-item" id="cF"><span class="lbl">🔒 Zählt als feste Kosten<br><span class="small muted">wie Miete oder Abos</span></span><span class="toggle ${c.fixed ? 'on' : ''}"></span></button></div>` : ''}
    <button class="btn primary" id="cS" style="margin-top:6px">Speichern</button>
    ${!isNew && !c.id.startsWith('sonst') ? `<button class="btn red" id="cD" style="margin-top:10px">Kategorie löschen</button>` : ''}`, (sh, o) => {
    $$('[data-e]', sh).forEach(b => b.onclick = () => { $('#cE', sh).value = b.dataset.e; });
    $$('[data-col]', sh).forEach(b => b.onclick = () => { c.color = b.dataset.col; $$('.swatch', sh).forEach(x => x.classList.toggle('sel', x === b)); });
    $('#cF', sh)?.addEventListener('click', e => { c.fixed = !c.fixed; e.currentTarget.querySelector('.toggle').classList.toggle('on', c.fixed); });
    $('#cS', sh).onclick = () => {
      c.name = $('#cN', sh).value.trim(); c.emoji = $('#cE', sh).value.trim() || '📦';
      if (!c.name) return $('#cN', sh).focus();
      if ($('#cB', sh)) c.budget = Math.max(0, M.parseCents($('#cB', sh).value) || 0);
      c.updatedAt = now();
      const i = D().categories.findIndex(x => x.id === c.id);
      if (i >= 0) D().categories[i] = c; else D().categories.push(c);
      save(); o.close(); onSaved?.(c); render();
    };
    $('#cD', sh)?.addEventListener('click', async () => {
      const n = D().transactions.filter(t => t.categoryId === c.id).length;
      const fallback = c.type === 'expense' ? 'sonst-a' : 'sonst-e';
      if (!await confirmSheet({ title: 'Kategorie löschen?', text: n ? `${n} Buchungen werden nach „Sonstiges“ verschoben.` : 'Die Kategorie wird entfernt.', ok: 'Löschen', danger: true })) return;
      D().transactions.forEach(t => { if (t.categoryId === c.id) t.categoryId = fallback; });
      D().recurring.forEach(r => { if (r.categoryId === c.id) r.categoryId = fallback; });
      D().categories = D().categories.filter(x => x.id !== c.id);
      save(); o.close(); onSaved?.(catById(fallback)); render();
    });
  });
}
function categoriesSheet() {
  let type = 'expense';
  openSheet(`${sheetHead('Kategorien')}<div class="seg type big"><button data-t="expense" class="out">Ausgaben</button><button data-t="income" class="in">Einnahmen</button></div><div id="cl"></div>`, sh => {
    const paint = () => {
      $$('[data-t]', sh).forEach(b => b.classList.toggle('on', b.dataset.t === type));
      $('#cl', sh).innerHTML = `<div class="list">${cats(type).map(c => `<button class="item" data-c="${c.id}">
        <div class="ico" style="background:${c.color}22">${esc(c.emoji)}</div>
        <div class="txt"><div class="t1">${esc(c.name)}</div><div class="t2">${[c.hint, c.fixed ? '🔒 fest' : '', c.budget ? `Budget ${fmt(c.budget)}` : ''].filter(Boolean).map(esc).join(' · ')}</div></div>
        <span class="dot" style="background:${c.color};width:14px;height:14px"></span><span class="chev">›</span></button>`).join('')}</div>
        <button class="btn soft" id="addC">＋ Neue Kategorie</button>`;
      $$('[data-c]', sh).forEach(b => b.onclick = () => categoryForm(catById(b.dataset.c), type, paint));
      $('#addC', sh).onclick = () => categoryForm(null, type, paint);
    };
    $$('[data-t]', sh).forEach(b => b.onclick = () => { type = b.dataset.t; paint(); });
    paint();
  });
}

// ======================================================= Feste Kosten & Einnahmen
function recurringSheet() {
  openSheet(`${sheetHead('🔁 Feste Kosten & Einnahmen')}
    <p class="muted small" style="margin:-4px 4px 14px">Wird jeden Monat automatisch am gewählten Tag eingetragen. Perfekt für Busfahrkarte, Handyvertrag, Taschengeld – und später die Miete.</p>
    <div id="rl"></div>
    <div class="grid2"><button class="btn red sm" data-new="expense">＋ Feste Kosten</button><button class="btn green sm" data-new="income">＋ Feste Einnahme</button></div>`, sh => {
    const paint = () => {
      const rs = D().recurring;
      const out = rs.filter(r => r.active && r.type === 'expense').reduce((s, r) => s + r.amount, 0);
      const inc = rs.filter(r => r.active && r.type === 'income').reduce((s, r) => s + r.amount, 0);
      $('#rl', sh).innerHTML = rs.length ? `
        <div class="grid2" style="margin-bottom:12px"><div class="stat stat-in"><div class="lbl">Jeden Monat rein</div><div class="num">${fmt(inc)}</div></div>
        <div class="stat stat-out"><div class="lbl">Jeden Monat raus</div><div class="num">${fmt(out)}</div></div></div>
        <div class="list">${rs.map(r => { const c = catById(r.categoryId); return `<button class="item" data-r="${r.id}" style="${r.active ? '' : 'opacity:.5'}">
          <div class="ico" style="background:${c.color}22">${esc(c.emoji)}</div>
          <div class="txt"><div class="t1">${esc(r.note || c.name)}</div><div class="t2">jeden ${r.day}. · ${esc(profile(r.person).name)}${r.shared ? ' · 👫' : ''}${r.active ? '' : ' · pausiert'}</div></div>
          <div class="amt ${r.type === 'income' ? 'green' : 'red'}">${r.type === 'income' ? '+' : '−'}${fmt(r.amount)}</div></button>`; }).join('')}</div>`
        : `<div class="card empty"><div class="big">🔁</div><b>Noch keine festen Posten</b>Beispiele: 🚌 Busfahrkarte 50 € · 🔁 Handyvertrag 10 € · 💶 Taschengeld 80 €</div>`;
      $$('[data-r]', sh).forEach(b => b.onclick = () => recurringForm(D().recurring.find(r => r.id === b.dataset.r), null, paint));
    };
    $$('[data-new]', sh).forEach(b => b.onclick = () => recurringForm(null, b.dataset.new, paint));
    paint();
  });
}
function recurringForm(r, type, onDone) {
  const isNew = !r;
  r = r ? { ...r } : { id: uid(), type, amount: 0, categoryId: type === 'expense' ? 'bus' : 'taschengeld', day: 1, person: S().devicePerson, shared: false, note: '', active: true, start: M.todayISO().slice(0, 7), booked: [] };
  openSheet(`${sheetHead(isNew ? (r.type === 'expense' ? 'Feste Kosten' : 'Feste Einnahme') : 'Fester Posten')}
    <label class="field"><span>Name</span><input class="input" id="rN" placeholder="${r.type === 'expense' ? 'z. B. Handyvertrag' : 'z. B. Taschengeld von Mama'}" value="${esc(r.note)}"></label>
    <label class="field"><span>Betrag pro Monat</span><input class="input big" id="rA" inputmode="decimal" placeholder="0 €" value="${r.amount ? centsToInput(r.amount) : ''}"></label>
    <div class="field"><span>Kategorie</span><div class="tiles">${cats(r.type).map(c => `<button class="tile ${c.id === r.categoryId ? 'sel' : ''}" data-cat="${c.id}" style="background:${c.color}1f"><span class="e">${esc(c.emoji)}</span><span class="n">${esc(c.name)}</span></button>`).join('')}</div></div>
    <label class="field"><span>Am wievielten im Monat?</span><select class="input" id="rD">${Array.from({ length: 31 }, (_, i) => `<option ${i + 1 === r.day ? 'selected' : ''} value="${i + 1}">am ${i + 1}.</option>`).join('')}</select></label>
    <div class="list">
      <button class="set-item" id="rP"><span class="lbl">Wer?</span><span class="val" id="rPv"></span></button>
      <button class="set-item" id="rS"><span class="lbl">👫 Gemeinsam</span><span class="toggle ${r.shared ? 'on' : ''}"></span></button>
      ${!isNew ? `<button class="set-item" id="rX"><span class="lbl">Aktiv</span><span class="toggle ${r.active ? 'on' : ''}"></span></button>` : ''}
    </div>
    <button class="btn primary" id="rSave">Speichern</button>
    ${!isNew ? `<button class="btn red" id="rDel" style="margin-top:10px">Löschen</button><p class="hint">Bereits eingetragene Buchungen bleiben erhalten.</p>` : ''}`, (sh, o) => {
    const pv = () => $('#rPv', sh).textContent = `${profile(r.person).emoji} ${profile(r.person).name}`; pv();
    $$('[data-cat]', sh).forEach(b => b.onclick = () => { r.categoryId = b.dataset.cat; $$('[data-cat]', sh).forEach(x => x.classList.toggle('sel', x === b)); });
    $('#rP', sh).onclick = () => { r.person = r.person === 'me' ? 'partner' : 'me'; pv(); };
    $('#rS', sh).onclick = e => { r.shared = !r.shared; e.currentTarget.querySelector('.toggle').classList.toggle('on', r.shared); };
    $('#rX', sh)?.addEventListener('click', e => { r.active = !r.active; e.currentTarget.querySelector('.toggle').classList.toggle('on', r.active); });
    $('#rSave', sh).onclick = () => {
      r.amount = M.parseCents($('#rA', sh).value);
      if (!(r.amount > 0)) return $('#rA', sh).focus();
      r.note = $('#rN', sh).value.trim(); r.day = +$('#rD', sh).value; r.updatedAt = now();
      const i = D().recurring.findIndex(x => x.id === r.id);
      if (i >= 0) D().recurring[i] = r; else D().recurring.push(r);
      save(); const n = runRecurring(); o.close(); onDone?.(); render();
      toast(n ? `Gespeichert – ${n} Buchung automatisch eingetragen` : `Gespeichert – wird ab dem ${r.day}. automatisch eingetragen`);
    };
    $('#rDel', sh)?.addEventListener('click', async () => {
      if (!await confirmSheet({ title: 'Festen Posten löschen?', text: 'Er wird ab jetzt nicht mehr automatisch eingetragen.', ok: 'Löschen', danger: true })) return;
      D().recurring = D().recurring.filter(x => x.id !== r.id); save(); o.close(); onDone?.(); render();
    });
  });
}

// ======================================================= EINSTELLUNGEN
function viewSettings() {
  const s = S();
  const demo = D().transactions.some(t => t.demo);
  return `
  <h1 class="page-title">Einstellungen</h1>
  <div class="section-h">👫 Zu zweit</div>
  <div class="list">
    <button class="set-item" data-act="profile" data-p="me"><span style="font-size:24px">${esc(s.profiles.me.emoji)}</span><span class="lbl">${esc(s.profiles.me.name)}</span><span class="chev">›</span></button>
    <button class="set-item" data-act="profile" data-p="partner"><span style="font-size:24px">${esc(s.profiles.partner.emoji)}</span><span class="lbl">${esc(s.profiles.partner.name)}</span><span class="chev">›</span></button>
    <label class="set-item"><span class="lbl">📱 Wem gehört dieses Handy?</span>
      <select data-set="devicePerson"><option value="me" ${s.devicePerson === 'me' ? 'selected' : ''}>${esc(s.profiles.me.name)}</option><option value="partner" ${s.devicePerson === 'partner' ? 'selected' : ''}>${esc(s.profiles.partner.name)}</option></select></label>
  </div>
  <p class="small muted" style="margin:6px 8px 0">🔄 Sync zwischen euren Handys: Exportiere auf einem Handy die JSON-Datei und importiere sie auf dem anderen mit „Zusammenführen“. Ein automatischer Sync kann später ergänzt werden.</p>

  <div class="section-h">💰 Geld</div>
  <div class="list">
    <button class="set-item" data-act="budget"><span class="lbl">🎯 Monatsbudget</span><span class="val">${s.monthlyBudget ? fmt(s.monthlyBudget) : 'aus'}</span><span class="chev">›</span></button>
    <button class="set-item" data-act="cats"><span class="lbl">🏷️ Kategorien & Budgets</span><span class="chev">›</span></button>
    <button class="set-item" data-act="recurring"><span class="lbl">🔁 Feste Kosten & Einnahmen</span><span class="val">${D().recurring.length || ''}</span><span class="chev">›</span></button>
    <label class="set-item"><span class="lbl">💱 Währung</span><select data-set="currency">${['EUR', 'CHF', 'USD', 'GBP'].map(c => `<option ${s.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    <label class="set-item"><span class="lbl">📅 Monat beginnt am</span><select data-set="monthStartDay">${Array.from({ length: 28 }, (_, i) => `<option value="${i + 1}" ${s.monthStartDay === i + 1 ? 'selected' : ''}>${i + 1}.${i === 0 ? ' (normal)' : ''}</option>`).join('')}</select></label>
  </div>
  <p class="small muted" style="margin:6px 8px 0">Tipp: Stell den Monatsbeginn auf den Tag, an dem euer Taschengeld kommt.</p>

  <div class="section-h">🔒 Sicherheit</div>
  <div class="list"><button class="set-item" data-act="pin"><span class="lbl">PIN-Sperre</span><span class="toggle ${s.pin ? 'on' : ''}"></span></button></div>

  <div class="section-h">💾 Daten</div>
  <div class="list">
    <button class="set-item" data-act="exportJson"><span class="lbl">📤 Sicherung exportieren (JSON)</span><span class="chev">›</span></button>
    <button class="set-item" data-act="exportCsv"><span class="lbl">📊 Tabelle exportieren (CSV/Excel)</span><span class="chev">›</span></button>
    <label class="set-item"><span class="lbl">📥 Importieren (JSON oder CSV)</span><span class="chev">›</span><input type="file" id="importF" accept=".json,.csv,application/json,text/csv" hidden></label>
  </div>
  ${demo ? `<button class="btn soft" data-act="removeDemo" style="margin-top:12px">🧹 Beispieldaten entfernen</button>` : ''}
  <button class="btn red" data-act="wipe" style="margin-top:12px">Alle Daten löschen</button>
  <p class="hint" style="margin-top:20px">Haushaltsbuch · Deine Daten bleiben auf diesem Handy.</p>`;
}

function budgetSheet() {
  openSheet(`${sheetHead('🎯 Monatsbudget')}
    <p class="muted" style="margin:0 4px 14px">So viel wollt ihr pro Monat höchstens ausgeben. Bei 80 % und 100 % gibt es eine Warnung.</p>
    <input class="input big" id="bv" inputmode="decimal" placeholder="z. B. 300" value="${S().monthlyBudget ? centsToInput(S().monthlyBudget) : ''}">
    <p class="hint">Leer lassen = kein Budget</p>
    <button class="btn primary" id="bs">Speichern</button>
    <button class="btn soft" id="bc" style="margin-top:10px">🏷️ Budget pro Kategorie</button>`, (sh, o) => {
    $('#bs', sh).onclick = () => { S().monthlyBudget = Math.max(0, M.parseCents($('#bv', sh).value) || 0); save(); o.close(); render(); toast('Budget gespeichert'); };
    $('#bc', sh).onclick = () => { o.close(); categoriesSheet(); };
    setTimeout(() => $('#bv', sh).focus(), 350);
  });
}
function profileSheet(p) {
  const pr = S().profiles[p];
  openSheet(`${sheetHead('Profil')}
    <label class="field"><span>Emoji & Name</span><div class="row"><input class="input emoji-input" id="pE" value="${esc(pr.emoji)}" maxlength="4"><input class="input" id="pN" value="${esc(pr.name)}" maxlength="16"></div>
    <div class="emoji-pick">${['🙋', '🙋‍♂️', '💁‍♀️', '🧑', '👩', '👨', '🦊', '🐻', '🐼', '🌸', '⭐', '🔥'].map(e => `<button data-e="${e}">${e}</button>`).join('')}</div></label>
    <button class="btn primary" id="pS">Speichern</button>`, (sh, o) => {
    $$('[data-e]', sh).forEach(b => b.onclick = () => $('#pE', sh).value = b.dataset.e);
    $('#pS', sh).onclick = () => { pr.name = $('#pN', sh).value.trim() || pr.name; pr.emoji = $('#pE', sh).value.trim() || pr.emoji; save(); o.close(); render(); };
  });
}

// ---------- Export / Import
async function shareOrDownload(name, text, mime) {
  const blob = new Blob([text], { type: mime });
  const file = new File([blob], name, { type: mime });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
const stamp = () => M.todayISO();
function exportJson() { shareOrDownload(`haushaltsbuch-${stamp()}.json`, JSON.stringify(D(), null, 2), 'application/json'); }
const CSV_HEAD = ['Datum', 'Typ', 'Betrag', 'Kategorie', 'Emoji', 'Person', 'Gemeinsam', 'Notiz'];
function exportCsv() {
  const q = v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const rows = [...D().transactions].sort((a, b) => a.date.localeCompare(b.date)).map(t => {
    const c = catById(t.categoryId);
    const amt = (t.amount / 100).toFixed(2).replace('.', ',');
    return [t.date, t.type === 'income' ? 'Einnahme' : 'Ausgabe', amt, c.name, c.emoji, profile(t.person).name, t.shared ? 'ja' : 'nein', t.note].map(q).join(';');
  });
  shareOrDownload(`haushaltsbuch-${stamp()}.csv`, '﻿' + [CSV_HEAD.join(';'), ...rows].join('\r\n'), 'text/csv');
}
function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const sep = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; } else cell += ch; }
    else if (ch === '"') inQ = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}
async function importFile(file) {
  const text = await file.text();
  try {
    if (file.name.toLowerCase().endsWith('.csv') || !text.trim().startsWith('{')) return importCsv(text);
    const data = JSON.parse(text);
    if (!Array.isArray(data.transactions)) throw new Error();
    const r = await confirmSheet({ title: 'Sicherung importieren', text: `${data.transactions.length} Buchungen gefunden. <b>Zusammenführen</b> behält deine Daten und fügt die neuen hinzu (ideal fürs zweite Handy). <b>Ersetzen</b> überschreibt alles.`, ok: 'Zusammenführen', extra: 'Ersetzen' });
    if (!r) return;
    if (r === 'extra') store.replace(data); else { mergeData(D(), data); save(); }
    M.setCurrency(S().currency); runRecurring(); render(); toast('Import fertig ✅');
  } catch { toast('Die Datei konnte nicht gelesen werden 😕'); }
}
function importCsv(text) {
  const rows = parseCsv(text);
  const head = rows.shift().map(h => h.trim().toLowerCase());
  const col = n => head.indexOf(n.toLowerCase());
  let n = 0;
  for (const r of rows) {
    const date = (r[col('Datum')] || '').trim();
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : (() => { const m = date.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); return m ? `${m[3]}-${M.pad(m[2])}-${M.pad(m[1])}` : null; })();
    let amount = M.parseCents(r[col('Betrag')]);
    if (!iso || !amount || isNaN(amount)) continue;
    let type = /einnahme|income/i.test(r[col('Typ')] || '') ? 'income' : amount < 0 ? 'expense' : (col('Typ') >= 0 ? 'expense' : 'income');
    amount = Math.abs(amount);
    const cname = (r[col('Kategorie')] || 'Sonstiges').trim();
    let c = D().categories.find(x => x.type === type && x.name.toLowerCase() === cname.toLowerCase());
    if (!c) { c = { id: uid(), type, name: cname, emoji: (r[col('Emoji')] || '').trim() || '📦', color: COLORS[D().categories.length % COLORS.length], budget: 0 }; D().categories.push(c); }
    const pname = (r[col('Person')] || '').trim();
    const person = pname && pname === S().profiles.partner.name ? 'partner' : 'me';
    D().transactions.push({ id: uid(), type, amount, categoryId: c.id, date: iso, note: (r[col('Notiz')] || '').trim(), person, shared: /^(ja|yes|1|true)$/i.test((r[col('Gemeinsam')] || '').trim()), updatedAt: now() });
    n++;
  }
  save(); render(); toast(n ? `${n} Buchungen importiert ✅` : 'Keine passenden Zeilen gefunden 😕');
}

// ---------- Beispieldaten
function loadDemo() {
  const tx = [];
  const add = (mOff, day, type, cents, cat, note = '', person = 'me', shared = false) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + mOff);
    const date = M.iso(new Date(d.getFullYear(), d.getMonth(), Math.min(day, M.daysIn(d.getFullYear(), d.getMonth()))));
    if (date > M.todayISO()) return;
    tx.push({ id: uid(), type, amount: cents, categoryId: cat, date, note, person, shared, demo: true, updatedAt: now() });
  };
  for (let m = -5; m <= 0; m++) {
    const j = (m + 7) * 37 % 11; // kleine Schwankungen
    add(m, 1, 'income', 8000, 'taschengeld', 'Taschengeld', 'me');
    add(m, 1, 'income', 9000, 'taschengeld', 'Taschengeld', 'partner');
    add(m, 3, 'income', 12000, 'unterhalt', 'Unterhalt', 'partner');
    add(m, 1, 'expense', 4900, 'bus', 'Deutschlandticket', 'me');
    add(m, 2, 'expense', 999, 'abos', 'Handyvertrag', 'me');
    add(m, 2, 'expense', 1299, 'abos', 'Netflix', 'partner', true);
    add(m, 5, 'expense', 2350 + j * 120, 'essen', 'Wocheneinkauf', 'partner', true);
    add(m, 9, 'expense', 1400 + j * 200, 'freizeit', 'Kino', 'me', true);
    add(m, 12, 'expense', 870 + j * 50, 'essen', 'Döner', 'me');
    add(m, 15, 'expense', 3200 - j * 100, 'freizeit', 'Spiel gekauft', 'me');
    add(m, 18, 'expense', 1990, 'kleidung', 'T-Shirt', 'partner');
    add(m, 22, 'expense', 1500, 'geschenke', 'Geburtstag', 'partner');
    add(m, 25, 'expense', 650, 'sonst-a', 'Schulsachen', 'me');
  }
  D().transactions.push(...tx);
  if (!D().goals.length) D().goals.push({ id: uid(), name: 'Wohnung – Kaution', emoji: '🔑', target: 150000, deadline: '', plan: 5000, demo: true,
    moves: [{ id: uid(), amount: 30000, date: M.todayISO() }] });
  save(); render(); toast('Beispieldaten geladen – in den Einstellungen wieder entfernbar');
}

// ---------- PIN
async function hashPin(pin) {
  const data = new TextEncoder().encode('hb-salt:' + pin);
  if (crypto.subtle) { const h = await crypto.subtle.digest('SHA-256', data); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); }
  let h = 0; for (const b of data) h = (h * 31 + b) >>> 0; return 'x' + h;
}
function pinPad(title, sub, onDone) {
  const el = document.createElement('div'); el.className = 'lock';
  let pin = '';
  el.innerHTML = `<div style="font-size:52px">🔒</div><h2>${title}</h2><div class="muted">${sub}</div>
    <div class="pin-dots">${'<i></i>'.repeat(4)}</div>
    <div class="keypad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(k => k ? `<button data-k="${k}">${k}</button>` : '<span></span>').join('')}</div>`;
  const dots = () => $$('.pin-dots i', el).forEach((d, i) => d.classList.toggle('f', i < pin.length));
  $$('[data-k]', el).forEach(b => b.onclick = async () => {
    haptic();
    if (b.dataset.k === '⌫') pin = pin.slice(0, -1); else if (pin.length < 4) pin += b.dataset.k;
    dots();
    if (pin.length === 4) {
      const ok = await onDone(pin, el);
      if (ok) el.remove(); else { pin = ''; dots(); shake($('.pin-dots', el)); }
    }
  });
  document.body.append(el);
  return el;
}
function lockScreen() {
  if (!S().pin || $('.lock')) return;
  const el = pinPad('Haushaltsbuch', 'PIN eingeben', async p => (await hashPin(p)) === S().pin);
  if (!$('[data-cancel]', el)) {
    const forgot = document.createElement('button');
    forgot.className = 'muted small'; forgot.style.marginTop = '24px'; forgot.style.minHeight = '44px'; forgot.textContent = 'PIN vergessen?';
    forgot.onclick = () => toast('Ohne PIN kommst du nur durch Löschen der App-Daten (Safari-Einstellungen) wieder rein.', '', null, 6000);
    el.append(forgot);
  }
}
async function togglePin() {
  if (S().pin) {
    if (await confirmSheet({ title: 'PIN-Sperre ausschalten?', text: 'Die App öffnet sich dann ohne PIN.', ok: 'Ausschalten' })) { S().pin = null; save(); render(); }
    return;
  }
  let first = null;
  const el = pinPad('PIN festlegen', 'Wähle 4 Ziffern', async (p, el) => {
    if (!first) { first = p; $('.muted', el).textContent = 'Nochmal zur Bestätigung'; return false; }
    if (p !== first) { first = null; $('.muted', el).textContent = 'Stimmte nicht – nochmal neu'; return false; }
    S().pin = await hashPin(p); save(); render(); toast('PIN-Sperre ist an 🔒'); return true;
  });
  const c = document.createElement('button'); c.className = 'btn soft sm'; c.style.cssText = 'max-width:300px;margin-top:20px'; c.textContent = 'Abbrechen'; c.dataset.cancel = '1';
  c.onclick = () => el.remove(); el.append(c);
}

// ======================================================= Aktionen
const actions = {
  budget: budgetSheet,
  demo: loadDemo,
  goAna: () => location.hash = '#auswertung',
  listPrev: () => { ui.listOffset--; render(); },
  listNext: () => { if (ui.listOffset < 0) { ui.listOffset++; render(); } },
  listCat: d => { ui.listCat = d.id; render(); },
  recurring: recurringSheet,
  range: d => { ui.range = d.r; ui.offset = 0; render(); },
  prev: () => { ui.offset--; render(); },
  next: () => { if (ui.offset < 0) { ui.offset++; render(); } },
  drill: d => openCategoryDrill(d.id),
  fixedDrill: d => openFixedDrill(d.id),
  goal: d => goalDetail(D().goals.find(g => g.id === d.id)),
  move: d => moveSheet(D().goals.find(g => g.id === d.id), +d.dir),
  newGoal: () => goalForm(null),
  goalExample: () => { D().goals.push({ id: uid(), name: 'Wohnung – Kaution', emoji: '🔑', target: 150000, deadline: '', plan: 5000, moves: [], updatedAt: now() }); save(); render(); toast('Sparziel angelegt 🎯 – tippe zum Bearbeiten'); },
  profile: d => profileSheet(d.p),
  cats: categoriesSheet,
  pin: togglePin,
  exportJson, exportCsv,
  removeDemo: () => { D().transactions = D().transactions.filter(t => !t.demo); D().goals = D().goals.filter(g => !g.demo); save(); render(); toast('Beispieldaten entfernt'); },
  wipe: async () => {
    if (!await confirmSheet({ title: '⚠️ Alles löschen?', text: 'Alle Buchungen, Sparziele, Kategorien und Einstellungen werden <b>unwiderruflich</b> gelöscht. Tipp: Vorher eine Sicherung exportieren.', ok: 'Weiter', danger: true })) return;
    if (!await confirmSheet({ title: 'Wirklich sicher?', text: 'Das kann nicht rückgängig gemacht werden.', ok: 'Ja, alles löschen', danger: true })) return;
    store.reset(); M.setCurrency('EUR'); ui.person = 'all'; location.hash = '#start'; render(); toast('Alle Daten gelöscht');
  },
};

// Eingaben auf der Seite (Suche, Selects, Import)
document.addEventListener('input', e => {
  if (e.target.id === 'search') {
    ui.search = e.target.value;
    const pos = e.target.selectionStart; render();
    const s = $('#search'); s.focus(); s.setSelectionRange(pos, pos);
  }
});
document.addEventListener('change', e => {
  const k = e.target.dataset?.set;
  if (k) {
    S()[k] = k === 'monthStartDay' ? +e.target.value : e.target.value;
    if (k === 'currency') M.setCurrency(e.target.value);
    save(); render(); toast('Gespeichert');
  }
  if (e.target.id === 'importF' && e.target.files[0]) importFile(e.target.files[0]);
});

// ======================================================= Start
store.init();
M.setCurrency(S().currency);
const booked = runRecurring();
$('#fab').onclick = () => { haptic(); openTxSheet(null); };
window.addEventListener('hashchange', route);
route();
lockScreen();
if (booked) toast(`🔁 ${booked} feste Buchung${booked > 1 ? 'en' : ''} automatisch eingetragen`);
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = Date.now();
  else { if (Date.now() - hiddenAt > 60000) lockScreen(); if (runRecurring()) render(); }
});
