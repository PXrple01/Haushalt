// Duell-Bilanz: Liste der beendeten Partien. Im Fern-Modus führen beide Geräte ihre Listen zusammen.
import { get, set, emit } from './store.js';

// Eintrag: { id, game, winner: 'jos' | 'joh' | 'draw', ts, mode }
export function records() {
  const resetAt = get('statsReset', 0);
  return (get('stats', []) || []).filter((r) => r.ts >= resetAt);
}

export function addRecord(r) {
  const list = get('stats', []) || [];
  if (list.some((x) => x.id === r.id)) return false;
  list.push(r);
  set('stats', list.slice(-600));
  emit('stats');
  return true;
}

// Zusammenführen (Vereinigung über die ID) – auch der Zeitpunkt des letzten Zurücksetzens wird abgeglichen
export function mergeRecords(remote = [], remoteResetAt = 0) {
  let changed = false;
  if (remoteResetAt > get('statsReset', 0)) { set('statsReset', remoteResetAt); changed = true; }
  const list = get('stats', []) || [];
  const ids = new Set(list.map((r) => r.id));
  for (const r of remote) {
    if (r && r.id && !ids.has(r.id) && ['jos', 'joh', 'draw'].includes(r.winner)) { list.push(r); ids.add(r.id); changed = true; }
  }
  if (changed) { list.sort((a, b) => a.ts - b.ts); set('stats', list.slice(-600)); emit('stats'); }
  return changed;
}

export function statsPayload() {
  return { records: records().slice(-200), resetAt: get('statsReset', 0) };
}

export function tally() {
  const t = { jos: 0, joh: 0, draw: 0, games: {} };
  for (const r of records()) {
    t[r.winner]++;
    const g = (t.games[r.game] ||= { jos: 0, joh: 0, draw: 0 });
    g[r.winner]++;
  }
  return t;
}

export function resetStats() {
  set('statsReset', Date.now());
  emit('stats');
}
