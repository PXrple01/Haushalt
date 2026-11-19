// Speicher im Browser (localStorage) + kleiner Ereignis-Bus.
// Mit ?ns=a in der Adresse bekommt ein Tab einen eigenen Speicherbereich (nur für Tests mit zwei „Geräten“).

const params = new URLSearchParams(location.search);
export const NS = (params.get('ns') || '').replace(/[^a-z0-9]/gi, '').slice(0, 12);
const P = 'kk' + (NS ? '-' + NS : '') + ':';
const mem = new Map(); // falls localStorage gesperrt ist (z. B. privater Modus)

export function get(key, fallback = null) {
  try {
    const v = localStorage.getItem(P + key);
    return v == null ? (mem.has(key) ? mem.get(key) : fallback) : JSON.parse(v);
  } catch {
    return mem.has(key) ? mem.get(key) : fallback;
  }
}
export function set(key, value) {
  mem.set(key, value);
  try { localStorage.setItem(P + key, JSON.stringify(value)); } catch { /* voll oder gesperrt */ }
}
export function del(key) {
  mem.delete(key);
  try { localStorage.removeItem(P + key); } catch { /* egal */ }
}

// ---------- Ereignis-Bus ----------
const bus = new EventTarget();
export function on(type, fn) {
  const h = (e) => fn(e.detail);
  bus.addEventListener(type, h);
  return () => bus.removeEventListener(type, h);
}
export function emit(type, detail) { bus.dispatchEvent(new CustomEvent(type, { detail })); }

// ---------- Einstellungen ----------
const DEF = {
  sound: true,        // Töne
  haptics: true,      // Vibration (Android)
  motion: 'auto',     // auto | full | reduced
  mode: 'couch',      // couch = Nebeneinander, remote = Weit weg
  code: '',           // gemeinsamer Code für Weit weg
  themeFor: { jos: 'baby', joh: 'lila' },
  nicks: { jos: 'Baby', joh: 'Johann' }, // Anzeigenamen in der App
};
export const prefs = {
  all() {
    const p = get('prefs', {}) || {};
    return { ...DEF, ...p, themeFor: { ...DEF.themeFor, ...(p.themeFor || {}) }, nicks: { ...DEF.nicks, ...(p.nicks || {}) } };
  },
  get(k) { return this.all()[k]; },
  set(k, v) {
    const p = this.all();
    p[k] = v;
    set('prefs', p);
    emit('prefs', { k, v });
  },
};

// Wer sitzt an diesem Gerät? (wird bei jedem Start auf „Wer spielt?“ gewählt)
export const me = {
  get: () => get('me', null),
  set: (p) => { set('me', p); emit('me', p); },
};
