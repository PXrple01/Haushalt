// Partien als Ereignis-Protokoll. Der Spielstand wird immer aus den Ereignissen berechnet (reduce in den Spielen).
// Ereignisse tragen eine Lamport-Uhr (n) → beide Geräte sortieren gleich (n, by, id) und kommen zum selben Ergebnis.
// Weit weg: neue Ereignisse gehen sofort ans andere Gerät; beim (Wieder-)Verbinden gleichen beide ab („hello“/„sync“).
import { get, set, emit, on, me } from './store.js';
import { uid } from './util.js';
import { send, onMsg } from './net.js';
import { mergeRecords, statsPayload } from './stats.js';

const KEY = 'sessions';
let db = get(KEY, {}) || {};
let clock = get('clock', 0) || 0;
const MAX_SESSIONS = 30;

const cmp = (a, b) => a.n - b.n || (a.by < b.by ? -1 : a.by > b.by ? 1 : 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function save() {
  const ids = Object.keys(db);
  if (ids.length > MAX_SESSIONS) {
    ids.sort((a, b) => (db[a].updated || 0) - (db[b].updated || 0))
      .slice(0, ids.length - MAX_SESSIONS)
      .forEach((id) => delete db[id]);
  }
  set(KEY, db);
  set('clock', clock);
}

const PIDS = ['jos', 'joh'];
const GAMES = ['hangman', 'whoami', 'number', 'mime', 'draw', 'ships', 'escape'];
function validEvent(e) {
  return e && typeof e.id === 'string' && e.id.length <= 24 && Number.isFinite(e.n) && PIDS.includes(e.by)
    && typeof e.ty === 'string' && e.ty.length <= 24 && e.d && typeof e.d === 'object' && JSON.stringify(e.d).length < 4000;
}
function validMeta(m) {
  return m && typeof m.id === 'string' && /^[a-z0-9]{6,16}$/.test(m.id) && GAMES.includes(m.game) && ['couch', 'remote'].includes(m.mode) && PIDS.includes(m.by);
}

export const getSession = (id) => db[id] || null;
export const eventsOf = (id) => (db[id]?.evs || []).slice();
export function allSessions() {
  return Object.values(db).sort((a, b) => (b.updated || 0) - (a.updated || 0));
}

// Neue Partie anlegen; das erste Ereignis „setup“ enthält die Einstellungen
export function createSession(game, mode, setup = {}) {
  const id = uid(10);
  const meta = { id, game, mode, by: me.get(), created: Date.now() };
  db[id] = { meta, evs: [], updated: Date.now() };
  addEvent(id, 'setup', setup);
  return id;
}

// Eigenes Ereignis hinzufügen (und im Fern-Modus sofort verschicken)
export function addEvent(id, ty, d = {}) {
  const s = db[id];
  if (!s) return null;
  const ev = { id: uid(10), n: ++clock, by: me.get(), t: Date.now(), ty, d };
  s.evs.push(ev);
  s.evs.sort(cmp);
  s.updated = Date.now();
  save();
  if (s.meta.mode === 'remote') send('ev', { meta: s.meta, evs: [ev] });
  emit('session', { id, ev, local: true });
  return ev;
}

// Fremde Ereignisse übernehmen (Vereinigung über die ID)
export function merge(meta, evs) {
  if (!validMeta(meta) || !Array.isArray(evs)) return 0;
  let s = db[meta.id];
  const isNew = !s;
  if (!s) s = { meta: { id: meta.id, game: meta.game, mode: meta.mode, by: meta.by, created: meta.created || Date.now() }, evs: [], updated: Date.now() };
  const have = new Set(s.evs.map((e) => e.id));
  let added = 0;
  for (const e of evs) {
    if (!validEvent(e) || have.has(e.id)) continue;
    s.evs.push({ id: e.id, n: e.n, by: e.by, t: e.t || Date.now(), ty: e.ty, d: e.d });
    have.add(e.id);
    clock = Math.max(clock, e.n);
    added++;
  }
  if (!added) return 0;
  db[meta.id] = s;
  s.evs.sort(cmp);
  s.updated = Date.now();
  save();
  emit('session', { id: meta.id, local: false, isNew });
  if (isNew && meta.by !== me.get()) emit('invite', s.meta);
  return added;
}

// ---------- Abgleich über das Netz ----------
const recentRemote = () => Object.values(db).filter((s) => s.meta.mode === 'remote' && Date.now() - (s.updated || 0) < 3 * 864e5);

function hello(reply = false) {
  const s = {};
  for (const x of recentRemote()) s[x.meta.id] = x.evs.length;
  send('hello', { s, stats: statsPayload(), reply });
}

onMsg('ev', (m) => merge(m.d?.meta, m.d?.evs));
onMsg('sync', (m) => merge(m.d?.meta, m.d?.evs));
onMsg('hello', (m) => {
  const d = m.d || {};
  if (d.stats) mergeRecords(d.stats.records || [], d.stats.resetAt || 0);
  const theirs = d.s || {};
  for (const x of recentRemote()) {
    if ((theirs[x.meta.id] ?? -1) < x.evs.length) send('sync', { meta: x.meta, evs: x.evs });
  }
  if (!d.reply) hello(true);
});
// Kurzlebige Nachrichten (Reaktionen, „tippt …“, Anstupsen) direkt weiterreichen
onMsg('fx', (m) => emit('fx', { ...(m.d || {}), from: m.from }));
export function sendFx(d) { return send('fx', d); }

on('net-online', () => hello(false));
on('partner-join', () => hello(false));
// Nach einem Ergebnis die Bilanz abgleichen
on('stats', () => { /* wird beim nächsten hello mitgeschickt */ });
export const syncNow = () => hello(false);
