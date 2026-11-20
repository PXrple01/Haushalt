// Krimi für zwei – reine Spiellogik. Immer mit zwei Handys. Jeder hat seine eigene Akte, die Uhr teilen sich beide.
// Ereignisse: setup {diff, spuren} · ready · go {room} · search {room, spot} · talk {who} · ask {who, topic}
//             show {who, clue} · prints {who} · leave · radio {clue} · safe {code} · cipher {key} · rub · fp {who}
//             pin {clue, x, y} · unpin {clue} · pmove {clue, x, y} · thread {a, b} · unthread {a, b} · hint {n}
//             aset {q, v} · sign {v} · unsign · abort
// Der Spielstand enthält einen „feed“: ein Eintrag pro Handlung bzw. Ereignis der Nacht (für Animationen und Hinweise).
import { nameOf, other } from '../../core/util.js';
import { CASE } from './fall.js';

export { CASE };
const C = CASE;
export const PIDS = ['jos', 'joh'];
export const COST = { floor: 2, room: 1, talk: 5, prints: 3, radio: 10, hint: 10, safe: 5, cipher: 5, rub: 5, fp: 5 };
export const RADIO_DELAY = 30;
export const SLOW = 1.5; // wer nicht Spezialist ist, braucht 50 % länger
export const MAX_THREADS = 40;

// ---------- kleine Helfer ----------
export const fmtClock = (m) => {
  const x = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};
export const has = (st, p, id) => !!st.files[p]?.[id];
export const teamHas = (st, id) => has(st, 'jos', id) || has(st, 'joh', id);
export const roomOf = (id) => C.rooms[id] || null;
export const spotOf = (room, spot) => roomOf(room)?.spots.find((s) => s.id === spot) || null;
export const personOf = (id) => C.people[id] || null;
export const placeOf = (who) => personOf(who)?.where || C.meet;
export const alive = (st, who) => !personOf(who)?.gone || !test(personOf(who).gone, st);
export const roleOf = (st, p) => (st.roles.spuren === p ? 'spuren' : 'verhoer');

// Bedingung prüfen (p = handelnde Person, who = Verdächtiger im Gespräch)
export function test(w, st, ctx = {}) {
  if (!w) return true;
  const { p, who } = ctx;
  if (w.after != null && !(st.clock >= w.after)) return false;
  if (w.before != null && !(st.clock < w.before)) return false;
  if (w.f && !st.flags[w.f]) return false;
  if (w.f2 && !st.flags[w.f2]) return false;
  if (w.nf && st.flags[w.nf]) return false;
  if (w.nf2 && st.flags[w.nf2]) return false;
  if (w.has && !(p && has(st, p, w.has))) return false;
  if (w.nhas && p && has(st, p, w.nhas)) return false;
  if (w.hasAny && !(p && w.hasAny.some((c) => has(st, p, c)))) return false;
  if (w.teamHas && !teamHas(st, w.teamHas)) return false;
  if (w.teamNot && teamHas(st, w.teamNot)) return false;
  if (w.teamNot2 && teamHas(st, w.teamNot2)) return false;
  if (w.teamAny && !w.teamAny.some((c) => teamHas(st, c))) return false;
  if (w.teamAny2 && !w.teamAny2.some((c) => teamHas(st, c))) return false;
  if (w.teamNotAny && w.teamNotAny.some((c) => teamHas(st, c))) return false;
  if (w.split && !(p && st.with[other(p)] === w.split)) return false;
  if (w.together && !(p && who && st.with[p] === who && st.with[other(p)] === who)) return false;
  return true;
}

// Zeitkosten: Spezialisten sind schneller
export function costFor(st, p, kind, base) {
  if (kind === 'search') return st.roles.spuren === p ? base : Math.round(base * SLOW);
  if (kind === 'talk') return st.roles.verhoer === p ? base : Math.round(base * SLOW);
  return base;
}
export function moveCost(st, p, room) {
  const a = roomOf(st.pos[p]), b = roomOf(room);
  if (!a || !b) return COST.room;
  return a.floor === b.floor ? COST.room : COST.floor;
}

// Darf p diesen Raum betreten? → { ok, msg, unlock }
export function canEnter(st, p, room) {
  const r = roomOf(room);
  if (!r) return { ok: false, msg: 'Diesen Raum gibt es nicht.' };
  const lock = r.lock;
  if (!lock || st.open[room]) return { ok: true };
  if (lock === 'schluessel') {
    return has(st, p, 'schluessel') ? { ok: true, unlock: true } : { ok: false, msg: 'Abgesperrt. Nur Falkner hatte einen Schlüssel zu seinem Büro – vielleicht trägt er ihn noch bei sich.', key: 'schluessel' };
  }
  if (lock === 'master') {
    return has(st, p, 'generalschluessel') || has(st, p, 'generalschluessel2') ? { ok: true, unlock: true } : { ok: false, msg: 'Abgesperrt. Ihr braucht einen Generalschlüssel – die Hausdame hat einen.', key: 'master' };
  }
  if (lock.after != null) return st.clock >= lock.after ? { ok: true } : { ok: false, msg: lock.msg };
  return { ok: true };
}

// Fundstelle: Variante (je nach Uhrzeit/Ereignis) – Index -1 = Grundfassung
export function variantOf(st, p, sp) {
  const vs = sp.v || [];
  for (let i = 0; i < vs.length; i++) if (test(vs[i].w, st, { p })) return { i, g: vs[i].g, x: vs[i].x || sp.x, set: vs[i].set };
  return { i: -1, g: sp.g || [], x: sp.x };
}
export function spotInfo(st, p, room, sp) {
  const ok = test(sp.w, st, { p });
  return {
    ok, msg: ok ? '' : sp.lockMsg || 'Noch nicht möglich.',
    cost: costFor(st, p, 'search', sp.c),
    mine: st.searched[p][`${room}.${sp.id}`]?.at ?? null,
    mineVi: st.searched[p][`${room}.${sp.id}`]?.vi ?? null,
    theirs: st.searched[other(p)][`${room}.${sp.id}`]?.at ?? null,
    fresh: variantOf(st, p, sp).i,
  };
}

// Fragen, die p der Person stellen kann
export function topicsFor(st, p, who) {
  const pe = personOf(who);
  if (!pe) return [];
  const asked = new Set((st.talks[p][who] || []).filter((e) => e.k === 'ask').map((e) => e.id));
  return pe.topics.filter((t) => test(t.w, st, { p, who })).map((t) => ({ ...t, asked: asked.has(t.id) }));
}
// Reaktion auf einen vorgehaltenen Beweis → { i (Eintrag) | -1, ni (Nein-Satz) }
export function showEntry(st, p, who, clue) {
  const pe = personOf(who);
  const list = pe?.show || [];
  for (let i = 0; i < list.length; i++) if (list[i].c.includes(clue) && test(list[i].w, st, { p, who })) return { i };
  let hsh = 0;
  for (const ch of clue + who) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
  return { i: -1, ni: hsh % (pe?.nope.length || 1) };
}
export const shownBefore = (st, p, who, clue) => (st.talks[p][who] || []).some((e) => e.k === 'show' && e.id === clue);

export const visibleQuestions = (st) => C.questions.filter((q) => test(q.w, st));
export const pinsLeft = (st) => st.pinsMax - Object.keys(st.pins).length;
export const hintsLeft = (st) => st.hintsMax - st.hintsUsed;
export const pendingRadio = (st, p) => st.radio.filter((r) => r.by === p && !r.done);
export const formComplete = (st) => visibleQuestions(st).every((q) => (q.multi ? Array.isArray(st.form[q.id]) && st.form[q.id].length > 0 : !!st.form[q.id]));

const normKey = (s) => String(s || '').toUpperCase().replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS').replace(/[^A-Z]/g, '');
export const cipherKeyOk = (k) => normKey(k) === C.cipher.key;
export { normKey };

// Nächster Tipp (oder null)
export function nextHint(st) {
  return C.hints.find((h) => !st.hints.some((x) => x.id === h.id) && test(h.w, st)) || null;
}

// ---------- Spielstand berechnen ----------
export function reduce(meta, evs) {
  const st = {
    game: 'krimi', id: meta.id, mode: meta.mode, phase: 'setup', caseId: C.id,
    diff: 'normal', roles: { spuren: 'jos', verhoer: 'joh' },
    start: C.diffs.normal.start, clock: C.diffs.normal.start, end: C.end, pinsMax: 14, hintsMax: 6,
    ready: { jos: false, joh: false },
    pos: { jos: C.startRoom, joh: C.startRoom }, with: { jos: null, joh: null },
    files: { jos: {}, joh: {} }, order: { jos: [], joh: [] },
    searched: { jos: {}, joh: {} }, talks: { jos: {}, joh: {} }, met: { jos: {}, joh: {} },
    flags: {}, open: {}, fired: {}, radio: [],
    pins: {}, threads: [], erk: [],
    hintsUsed: 0, hints: [],
    form: {}, formV: 0, sign: { jos: 0, joh: 0 },
    feed: [], result: null, endedAt: 0, aborted: false, abortBy: null, startT: 0,
  };
  let cur = null; // aktuelles Ereignis (für feed)
  const feed = (o) => st.feed.push({ ev: cur?.id, at: st.clock, ...o });
  const reject = (p, why) => feed({ k: 'reject', by: p, why });
  const gain = (p, ids) => {
    const out = [];
    for (const id of ids || []) {
      if (!C.clues[id] || st.files[p][id]) continue;
      st.files[p][id] = { at: st.clock, n: st.order[p].length };
      st.order[p].push(id);
      out.push(id);
    }
    return out;
  };
  const setFlags = (list) => { for (const f of [].concat(list || [])) if (f) st.flags[f] = true; };

  // Uhr vorstellen: Ereignisse der Nacht und Funk-Antworten passieren auf die Minute genau
  function spend(min) {
    const to = st.clock + Math.max(0, Math.round(min));
    while (st.clock < to) {
      st.clock++;
      for (const e of C.events) if (e.at === st.clock && !st.fired[e.id]) fire(e);
      for (const r of st.radio) {
        if (r.done || r.due > st.clock) continue;
        r.done = true;
        const g = gain(r.by, [r.reply]);
        if (g.length) feed({ k: 'reply', to: r.by, clue: r.reply, src: r.clue });
      }
      if (st.clock >= st.end && st.phase === 'play') {
        st.phase = 'accuse';
        st.with = { jos: null, joh: null };
        feed({ k: 'dawn' });
        break;
      }
    }
  }
  function fire(e) {
    st.fired[e.id] = true;
    if (e.kind === 'special' && e.id === 'mord2') { mord2(); return; }
    if (!test(e.w, st)) return;
    setFlags(e.set);
    if (e.kind !== 'silent') feed({ k: 'news', id: e.id });
  }
  function mord2() {
    if (!st.flags.note) return;
    if (st.flags.emilSaved) { st.flags.falle = true; feed({ k: 'news', id: 'mord2.waited' }); return; }
    const present = PIDS.filter((q) => st.pos[q] === 'spa');
    if (present.length) {
      st.flags.emilSaved = true; st.flags.falle = true; st.flags.savedHere = true;
      for (const q of present) {
        const g = gain(q, ['a_emil_aussage', 'a_emil_erpressung', 'dienstbuch_seite']);
        feed({ k: 'news', id: 'mord2.saved', to: q, g });
      }
      return;
    }
    st.flags.emilDead = true;
    for (const q of PIDS) if (st.with[q] === 'emil') st.with[q] = null;
  }
  // Erkenntnisse: Faden zwischen zwei angepinnten Spuren aus a und b
  function checkCombos() {
    for (const cb of C.combos) {
      if (st.erk.includes(cb.g)) continue;
      const hit = st.threads.find(([x, y]) => (cb.a.includes(x) && cb.b.includes(y)) || (cb.a.includes(y) && cb.b.includes(x)));
      if (!hit) continue;
      st.erk.push(cb.g);
      gain('jos', [cb.g]); gain('joh', [cb.g]);
      feed({ k: 'erk', clue: cb.g, a: hit[0], b: hit[1], by: cur?.by });
    }
  }
  function finish(e) {
    st.phase = 'end';
    st.endedAt = e.t;
    st.result = scoreOf(st);
    feed({ k: 'end' });
  }

  for (const e of evs) {
    if (st.phase === 'end') break;
    cur = e;
    const d = e.d || {};
    const p = e.by;
    if (!PIDS.includes(p) && e.ty !== 'setup') continue;
    const playing = st.phase === 'play';
    switch (e.ty) {
      case 'setup': {
        if (st.phase !== 'setup') break;
        const df = C.diffs[d.diff] || C.diffs.normal;
        st.diff = df.id;
        st.start = st.clock = df.start;
        st.pinsMax = df.pins;
        st.hintsMax = df.hints;
        const sp = PIDS.includes(d.spuren) ? d.spuren : 'jos';
        st.roles = { spuren: sp, verhoer: other(sp) };
        st.phase = 'intro';
        break;
      }
      case 'ready': {
        if (st.phase !== 'intro') break;
        st.ready[p] = true;
        if (st.ready.jos && st.ready.joh) { st.phase = 'play'; st.startT = e.t; feed({ k: 'start' }); }
        break;
      }
      case 'go': {
        if (!playing) break;
        const room = String(d.room || '');
        if (!roomOf(room) || room === st.pos[p]) break;
        const can = canEnter(st, p, room);
        if (!can.ok) { reject(p, can.msg); break; }
        const cost = moveCost(st, p, room);
        if (can.unlock) st.open[room] = true;
        st.pos[p] = room;
        st.with[p] = null;
        feed({ k: 'go', by: p, room, unlocked: can.unlock ? room : null, cost });
        spend(cost);
        break;
      }
      case 'search': {
        if (!playing) break;
        const room = String(d.room || '');
        const sp = spotOf(room, d.spot);
        if (!sp || st.pos[p] !== room) { reject(p, 'Dafür musst du in diesem Raum sein.'); break; }
        if (!test(sp.w, st, { p })) { reject(p, sp.lockMsg || 'Noch nicht möglich.'); break; }
        const v = variantOf(st, p, sp);
        const key = `${room}.${sp.id}`;
        if (st.searched[p][key] && st.searched[p][key].vi === v.i) { reject(p, 'Hier hast du schon alles gefunden.'); break; }
        const cost = costFor(st, p, 'search', sp.c);
        const before = !!st.flags.emilFound;
        st.searched[p][key] = { at: st.clock, vi: v.i };
        const g = gain(p, v.g);
        setFlags(v.set);
        const found2 = !before && st.flags.emilFound;
        feed({ k: 'search', by: p, room, spot: sp.id, vi: v.i, all: v.g, g, cost, blood: found2 });
        if (found2) feed({ k: 'news', id: 'found2', to: other(p) });
        spend(cost);
        break;
      }
      case 'talk': {
        if (!playing) break;
        const who = String(d.who || '');
        const pe = personOf(who);
        if (!pe) break;
        if (!alive(st, who)) { reject(p, `${pe.short} kann nicht mehr reden.`); break; }
        if (st.pos[p] !== placeOf(who)) { reject(p, `${pe.short} ist nicht hier.`); break; }
        st.with[p] = who;
        if (st.met[p][who]) { feed({ k: 'talk', by: p, who, again: true }); break; }
        st.met[p][who] = true;
        const cost = costFor(st, p, 'talk', COST.talk);
        (st.talks[p][who] = st.talks[p][who] || []).push({ k: 'intro', at: st.clock });
        const g = gain(p, pe.intro.g);
        feed({ k: 'talk', by: p, who, g, cost });
        spend(cost);
        break;
      }
      case 'leave': {
        st.with[p] = null;
        break;
      }
      case 'ask': {
        if (!playing) break;
        const who = String(d.who || '');
        const pe = personOf(who);
        if (!pe || st.with[p] !== who || !st.met[p][who]) { reject(p, 'Das Gespräch ist vorbei.'); break; }
        const tp = pe.topics.find((t) => t.id === d.topic);
        if (!tp || !test(tp.w, st, { p, who })) { reject(p, 'Diese Frage passt gerade nicht.'); break; }
        if ((st.talks[p][who] || []).some((x) => x.k === 'ask' && x.id === tp.id)) break;
        const cost = costFor(st, p, 'talk', COST.talk);
        st.talks[p][who].push({ k: 'ask', id: tp.id, at: st.clock });
        const g = gain(p, tp.g);
        setFlags(tp.set);
        feed({ k: 'ask', by: p, who, topic: tp.id, g, cost, bluff: !!tp.bluff, together: !!tp.together });
        spend(cost);
        break;
      }
      case 'show': {
        if (!playing) break;
        const who = String(d.who || '');
        const clue = String(d.clue || '');
        const pe = personOf(who);
        if (!pe || st.with[p] !== who || !st.met[p][who]) { reject(p, 'Das Gespräch ist vorbei.'); break; }
        if (!has(st, p, clue)) break;
        const r = showEntry(st, p, who, clue);
        if ((st.talks[p][who] || []).some((x) => x.k === 'show' && x.id === clue && x.i === r.i)) { reject(p, 'Das hast du schon vorgehalten.'); break; }
        const cost = costFor(st, p, 'talk', COST.talk);
        st.talks[p][who].push({ k: 'show', id: clue, i: r.i, ni: r.ni, at: st.clock });
        const en = r.i >= 0 ? pe.show[r.i] : null;
        const g = gain(p, en?.g);
        if (en?.set) setFlags(en.set);
        feed({ k: 'show', by: p, who, clue, i: r.i, g, cost, set: en?.set || null });
        spend(cost);
        break;
      }
      case 'prints': {
        if (!playing) break;
        const who = String(d.who || '');
        if (!personOf(who) || st.with[p] !== who || !st.met[p][who]) break;
        if (has(st, p, 'fp_' + who)) break;
        const cost = costFor(st, p, 'search', COST.prints);
        st.talks[p][who].push({ k: 'prints', at: st.clock });
        const g = gain(p, ['fp_' + who]);
        feed({ k: 'prints', by: p, who, g, cost });
        spend(cost);
        break;
      }
      case 'radio': {
        if (!playing) break;
        const clue = String(d.clue || '');
        const reply = C.clues[clue]?.r;
        if (!reply || !has(st, p, clue)) break;
        if (has(st, p, reply) || st.radio.some((r) => r.by === p && r.clue === clue)) { reject(p, 'Dazu hast du schon gefunkt.'); break; }
        st.radio.push({ by: p, clue, reply, due: st.clock + RADIO_DELAY, done: false });
        feed({ k: 'radio', by: p, clue, cost: COST.radio, due: st.clock + RADIO_DELAY });
        spend(COST.radio);
        break;
      }
      case 'safe': {
        if (!playing) break;
        if (!has(st, p, 'tresor') || st.pos[p] !== C.safe.room) { reject(p, 'Der Tresor ist im Büro.'); break; }
        if (has(st, p, 'testament')) break;
        const ok = String(d.code || '') === C.safe.code;
        const g = ok ? gain(p, ['testament', 'foto_et']) : [];
        feed({ k: 'safe', by: p, ok, g, cost: COST.safe });
        spend(COST.safe);
        break;
      }
      case 'cipher': {
        if (!playing) break;
        if (!has(st, p, 'tagebuch') || has(st, p, 'tagebuch_klar') || !cipherKeyOk(d.key)) break;
        const g = gain(p, ['tagebuch_klar']);
        feed({ k: 'cipher', by: p, g, cost: COST.cipher });
        spend(COST.cipher);
        break;
      }
      case 'rub': {
        if (!playing) break;
        if (!has(st, p, 'durchdruck') || has(st, p, 'erpressung')) break;
        const g = gain(p, ['erpressung']);
        feed({ k: 'rub', by: p, g, cost: COST.rub });
        spend(COST.rub);
        break;
      }
      case 'fp': {
        if (!playing) break;
        const who = String(d.who || '');
        if (!personOf(who) || !has(st, p, 'wachsabdruck') || !has(st, p, 'fp_' + who) || has(st, p, 'fp_treffer')) break;
        const ok = who === 'wendt';
        const g = ok ? gain(p, ['fp_treffer']) : [];
        feed({ k: 'fp', by: p, who, ok, g, cost: COST.fp });
        spend(COST.fp);
        break;
      }
      case 'pin': {
        if (st.phase !== 'play' && st.phase !== 'accuse') break;
        const clue = String(d.clue || '');
        if (!has(st, p, clue) || st.pins[clue]) break;
        if (pinsLeft(st) <= 0) { reject(p, 'Keine Nadeln mehr frei. Nehmt erst eine Spur ab.'); break; }
        st.pins[clue] = { x: clamp01(d.x, .5), y: clamp01(d.y, .5), by: p, at: st.clock };
        feed({ k: 'pin', by: p, clue });
        checkCombos();
        break;
      }
      case 'unpin': {
        const clue = String(d.clue || '');
        if (!st.pins[clue]) break;
        delete st.pins[clue];
        st.threads = st.threads.filter(([a, b]) => a !== clue && b !== clue);
        feed({ k: 'unpin', by: p, clue });
        break;
      }
      case 'pmove': {
        const pin = st.pins[String(d.clue || '')];
        if (!pin) break;
        pin.x = clamp01(d.x, pin.x); pin.y = clamp01(d.y, pin.y);
        break;
      }
      case 'thread': {
        const a = String(d.a || ''), b = String(d.b || '');
        if (a === b || !st.pins[a] || !st.pins[b]) break;
        if (st.threads.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) break;
        if (st.threads.length >= MAX_THREADS) { reject(p, 'Die Tafel ist voller Fäden.'); break; }
        st.threads.push([a, b]);
        feed({ k: 'thread', by: p, a, b });
        checkCombos();
        break;
      }
      case 'unthread': {
        const a = String(d.a || ''), b = String(d.b || '');
        st.threads = st.threads.filter(([x, y]) => !((x === a && y === b) || (x === b && y === a)));
        break;
      }
      case 'hint': {
        if (!playing) break;
        if (st.hintsUsed >= st.hintsMax) break;
        if (Number.isInteger(d.n) && st.hintsUsed >= d.n) break; // beide gleichzeitig gedrückt → nur einmal
        const hnt = nextHint(st);
        if (!hnt) { reject(p, 'Gerade gibt es keinen neuen Tipp.'); break; }
        st.hintsUsed++;
        st.hints.push({ id: hnt.id, by: p, at: st.clock });
        feed({ k: 'hint', by: p, id: hnt.id, cost: COST.hint });
        spend(COST.hint);
        break;
      }
      case 'aset': {
        if (st.phase !== 'play' && st.phase !== 'accuse') break;
        const q = C.questions.find((x) => x.id === d.q);
        if (!q) break;
        const ids = q.opts.map((o) => o.id);
        let v = null;
        if (q.multi) v = Array.isArray(d.v) ? [...new Set(d.v.filter((x) => ids.includes(x)))].sort() : [];
        else v = ids.includes(d.v) ? d.v : null;
        st.form[q.id] = v;
        st.formV++;
        const hadSign = st.sign.jos || st.sign.joh;
        st.sign = { jos: 0, joh: 0 };
        feed({ k: 'aset', by: p, q: q.id, reset: !!hadSign });
        break;
      }
      case 'sign': {
        if (st.phase !== 'play' && st.phase !== 'accuse') break;
        if (d.v !== st.formV || !formComplete(st)) break;
        st.sign[p] = st.formV;
        feed({ k: 'sign', by: p });
        if (st.sign.jos === st.formV && st.sign.joh === st.formV) finish(e);
        break;
      }
      case 'unsign': {
        if (st.phase !== 'play' && st.phase !== 'accuse') break;
        st.sign[p] = 0;
        feed({ k: 'unsign', by: p });
        break;
      }
      case 'abort':
        if (st.phase === 'setup') break;
        st.phase = 'end'; st.aborted = true; st.abortBy = p; st.endedAt = e.t;
        feed({ k: 'abort', by: p });
        break;
    }
  }
  return st;
}
function clamp01(v, fb) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, Math.round(n * 1000) / 1000)) : fb;
}

// ---------- Wertung ----------
export function scoreOf(st) {
  const rows = visibleQuestions(st).map((q) => {
    const v = st.form[q.id];
    const ok = q.multi ? Array.isArray(v) && v.length === q.ok.length && q.ok.every((x) => v.includes(x)) : v === q.ok;
    return { id: q.id, ok, pts: ok ? q.pts : 0, max: q.pts, v };
  });
  const base = rows.reduce((s, r) => s + r.pts, 0);
  const max = rows.reduce((s, r) => s + r.max, 0);
  const B = C.bonus;
  const emil = st.flags.emilSaved ? B.emil : 0;
  const time = Math.min(B.timeMax, Math.floor(Math.max(0, st.end - st.clock) / 15) * B.perQuarter);
  const hints = -B.hint * st.hintsUsed;
  const total = Math.max(0, base + emil + time + hints);
  const culprit = st.form.taeter === 'wendt';
  const pct = max ? base / max : 0;
  const rank = culprit ? C.ranks.find((r) => pct >= r.min) : C.wrong;
  return { rows, base, max, emil, time, hints, total, culprit, pct, rank, accused: st.form.taeter || null };
}

// ---------- für Lobby und Hinweise ----------
export function todo(st, p) {
  if (st.phase === 'intro') return st.ready[p] ? null : 'Ermittlung beginnen';
  if (st.phase === 'play') return 'Weiterermitteln';
  if (st.phase === 'accuse') return st.sign[p] === st.formV && st.formV ? null : 'Anklage unterschreiben';
  return null;
}
export function label(st) {
  if (st.phase === 'setup') return 'Wird vorbereitet';
  if (st.phase === 'intro') return `${C.short} – gleich geht’s los`;
  if (st.phase === 'play') return `${C.short} – ${fmtClock(st.clock)} Uhr`;
  if (st.phase === 'accuse') return `${C.short} – Anklageschrift`;
  if (st.aborted) return 'Beendet';
  return st.result?.culprit ? `Gelöst: ${st.result.rank.title}` : 'Falscher Täter';
}
export function endLine(st) {
  if (st.aborted) return 'Die Ermittlung wurde beendet.';
  return st.result?.culprit ? `Fall gelöst – ${st.result.rank.title}!` : 'Ihr habt die falsche Person angeklagt …';
}
export const titleOf = (p) => `${p === 'jos' ? 'Kommissarin' : 'Kommissar'} ${nameOf(p)}`;
