// Live-Verbindung für „Weit weg“: zwei Handys im selben Raum (Supabase Realtime: Broadcast + Presence).
// Es wird nichts in einer Datenbank gespeichert – nur Nachrichten zwischen den Geräten.
// Raumname = SHA-256 des gemeinsamen Codes. Test-Modus: ?net=local (BroadcastChannel zwischen Tabs).
import { prefs, me, emit, on, get, set } from './store.js';
import { sha256hex, uid } from './util.js';

// Öffentliche Zugangsdaten der Watchlist-Cloud (der Schlüssel ist bewusst öffentlich, er erlaubt nur Live-Kanäle)
const CLOUD = { url: 'https://inqhfkoxmftyellmrxop.supabase.co', key: 'sb_publishable_Vet09NDckUvBVAZmyJ0CbQ_GhQn3fvX' };
const LOCAL = new URLSearchParams(location.search).get('net') === 'local';

// Eindeutige Geräte-ID (unterscheidet zwei Geräte, selbst wenn beide dieselbe Person gewählt haben)
let DEV = get('dev', null);
if (!DEV) { DEV = uid(8); set('dev', DEV); }
export const deviceId = DEV;

const state = {
  status: 'off',   // off | connecting | online | error | offline
  partner: null,   // { p, at, dev } – das andere Gerät, wenn online
  dupe: false,     // auf dem anderen Gerät ist dieselbe Person gewählt
  error: '',
};
export const netState = () => ({ ...state, partner: state.partner && { ...state.partner } });

let transport = null;
let connKey = '';
let myAt = 'lobby';
const handlers = new Map();

function setState(patch) {
  Object.assign(state, patch);
  emit('net', netState());
}

// Eingehende Nachrichten nach Typ abonnieren
export function onMsg(type, fn) {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type).add(fn);
  return () => handlers.get(type)?.delete(fn);
}

function receive(msg) {
  if (!msg || typeof msg !== 'object' || msg.dev === DEV) return;
  const set_ = handlers.get(msg.t);
  if (set_) for (const fn of set_) { try { fn(msg); } catch (e) { console.error(e); } }
}

// Nachricht an das andere Gerät
export function send(type, data) {
  if (!transport || state.status !== 'online') return false;
  try { transport.send({ t: type, d: data, from: me.get(), dev: DEV, ts: Date.now() }); return true; } catch { return false; }
}

// Wo bin ich gerade? (Lobby, Spiel …) – sieht das andere Gerät
export function setWhere(at) {
  myAt = at;
  transport?.track(meta());
}
const meta = () => ({ p: me.get(), at: myAt, dev: DEV, ts: Date.now() });

function presence(list) {
  const others = list.filter((m) => m && m.dev !== DEV);
  others.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const partner = others.find((m) => m.p && m.p !== me.get()) || null;
  const dupe = others.some((m) => m.p === me.get());
  const had = state.partner?.dev;
  setState({ partner, dupe });
  if (partner && partner.dev !== had) emit('partner-join', partner);
  if (!partner && had) emit('partner-leave');
}

// ---------- Supabase ----------
async function supabaseTransport(room) {
  const { RealtimeClient } = await import('../../vendor/realtime.js');
  const client = new RealtimeClient(CLOUD.url.replace(/^http/, 'ws') + '/realtime/v1', {
    params: { apikey: CLOUD.key },
    accessToken: async () => CLOUD.key,
    heartbeatIntervalMs: 20000,
  });
  const ch = client.channel(room, { config: { broadcast: { self: false, ack: false }, presence: { key: DEV } } });
  ch.on('broadcast', { event: 'm' }, ({ payload }) => receive(payload));
  ch.on('presence', { event: 'sync' }, () => {
    const st = ch.presenceState();
    presence(Object.values(st).flat());
  });
  ch.subscribe((status, err) => {
    if (status === 'SUBSCRIBED') {
      setState({ status: 'online', error: '' });
      ch.track(meta());
      emit('net-online');
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      setState({ status: navigator.onLine === false ? 'offline' : 'error', error: err?.message || status, partner: null });
    } else if (status === 'CLOSED') {
      if (transport) setState({ status: 'connecting', partner: null });
    }
  });
  return {
    send: (msg) => ch.send({ type: 'broadcast', event: 'm', payload: msg }),
    track: (m) => { if (state.status === 'online') ch.track(m); },
    close: () => { try { client.removeChannel(ch); client.disconnect(); } catch { /* egal */ } },
  };
}

// ---------- Lokal (Tests, zwei Tabs im selben Browser) ----------
function localTransport(room) {
  const bc = new BroadcastChannel('kk-local-' + room);
  const peers = new Map();
  const post = (m) => bc.postMessage(m);
  const sync = () => {
    const now = Date.now();
    for (const [k, v] of peers) if (now - v.seen > 6000) peers.delete(k);
    presence([...peers.values()].map((v) => v.meta));
  };
  bc.onmessage = (e) => {
    const m = e.data;
    if (m.kind === 'pres') {
      if (m.leave) peers.delete(m.meta.dev);
      else peers.set(m.meta.dev, { meta: m.meta, seen: Date.now() });
      if (m.ask) post({ kind: 'pres', meta: meta() });
      sync();
    } else if (m.kind === 'msg') receive(m.msg);
  };
  const beat = setInterval(() => { post({ kind: 'pres', meta: meta() }); sync(); }, 2000);
  setTimeout(() => { setState({ status: 'online', error: '' }); post({ kind: 'pres', meta: meta(), ask: true }); emit('net-online'); }, 60);
  return {
    send: (msg) => post({ kind: 'msg', msg }),
    track: (m) => post({ kind: 'pres', meta: m }),
    close: () => { clearInterval(beat); post({ kind: 'pres', leave: true, meta: meta() }); bc.close(); },
  };
}

// ---------- Verbinden / Trennen ----------
export async function connect() {
  const code = (prefs.get('code') || '').trim().toLowerCase();
  const who = me.get();
  if (prefs.get('mode') !== 'remote' || !code || !who) { disconnect(); return; }
  const key = `${code}|${who}`;
  if (transport && connKey === key && state.status !== 'error') return;
  disconnect(true);
  connKey = key;
  setState({ status: navigator.onLine === false ? 'offline' : 'connecting', error: '', partner: null, dupe: false });
  try {
    const room = 'kk-' + (await sha256hex('kicherkiste:' + code)).slice(0, 32);
    if (connKey !== key) return;
    const t = LOCAL ? localTransport(room) : await supabaseTransport(room);
    if (connKey !== key) { t.close(); return; }
    transport = t;
  } catch (e) {
    console.error(e);
    setState({ status: 'error', error: e.message || 'Verbindung fehlgeschlagen' });
  }
}

export function disconnect(silent) {
  if (transport) { try { transport.close(); } catch { /* egal */ } }
  transport = null;
  connKey = '';
  if (!silent) setState({ status: 'off', partner: null, dupe: false, error: '' });
}

export function reconnect() {
  disconnect(true);
  connect();
}

// Automatisch: bei Moduswechsel, neuem Code, Personenwechsel, zurück in die App, Netz wieder da
on('prefs', ({ k }) => { if (k === 'mode' || k === 'code') connect(); });
on('me', () => { if (transport) reconnect(); else connect(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (prefs.get('mode') === 'remote' && (state.status !== 'online' || !transport)) reconnect();
  else transport?.track(meta());
});
window.addEventListener('online', () => { if (prefs.get('mode') === 'remote') reconnect(); });
window.addEventListener('offline', () => { if (transport) setState({ status: 'offline', partner: null }); });
window.addEventListener('pagehide', () => { if (LOCAL && transport) transport.close(); });
