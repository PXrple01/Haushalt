// Krimi Fall 2 „Seid ihr alle da?“ – Spiellogik. Immer zwei Handys, Echtzeit-Uhr (läuft nur während der Rätsel).
// Ereignisse: setup {case:'puppe', diff, first, seed} · ready (»Ja!«) · act {s, k, …} · next {s} · vote {s, v} · votetimeout {s}
//             pick {q, v} · seam · hold {on} · pullok · pullfail · hint {s, n} · donate · timeup · overtime · giveup · abort
import { nameOf, other } from '../../../core/util.js';
import { makeRng } from '../../escape/rng.js';
import { PUZ } from './puzzles.js';
import { SCENES, DIFFS, TRIBUNAL, DOCS, TITLE } from './story.js';

export { SCENES, DIFFS };
export const PIDS = ['jos', 'joh'];
export const START_BLOOD = 5;
export const PEN_DONATE = 30e3;
export const FADEN_MS = 40e3;
export const PULL_MS = 25e3;
const r1 = (x) => Math.round(x * 100) / 100;

// Rätsel aus Seed + Stufe erzeugen (auf beiden Handys gleich). Zwischengespeichert – der Spielstand wird oft neu berechnet.
const cache = new Map();
export function specsFor(seed, diff) {
  const key = `${seed}|${diff}`;
  if (cache.has(key)) return cache.get(key);
  const specs = SCENES.map((x) => (x.kind === 'puzzle' ? PUZ[x.id].gen(makeRng(`${seed}:puppe:${x.id}`), diff) : null));
  if (cache.size > 12) cache.clear();
  cache.set(key, specs);
  return specs;
}

// Wer spielt in Szene s welche Rolle?
export const rolesOf = (s) => SCENES[s]?.roles || null;
export const roleOf = (st, p, s = st.scene) => { const r = rolesOf(s); return r ? r[p === st.first ? 0 : 1] : null; };
export const whoHas = (st, role, s = st.scene) => { const r = rolesOf(s); return r ? (r[0] === role ? st.first : other(st.first)) : null; };
export const running = (st) => !!st.runT;
export function elapsed(st, now = Date.now()) {
  return st.usedMs + (st.runT ? Math.max(0, now - st.runT) : 0) + st.penaltyMs;
}
export const remaining = (st, now = Date.now()) => st.limit - elapsed(st, now);
export const timeUpNow = (st, now = Date.now()) => st.phase === 'play' && !st.timeUp && running(st) && remaining(st, now) <= 0;

export function reduce(meta, evs) {
  const st = {
    game: 'krimi', caseId: 'puppe', id: meta.id, mode: meta.mode, phase: 'setup',
    diff: 'normal', first: 'jos', seed: '', limit: DIFFS.normal.limit,
    ready: { jos: false, joh: false },
    scene: 0, sub: 'play', sceneT: 0, specs: [], ps: [], nextReady: { jos: false, joh: false },
    blood: { jos: START_BLOOD, joh: START_BLOOD }, docs: { jos: [], joh: [] },
    guests: { haslinger: 'alive', gerda: 'alive', brandl: 'alive' }, spoke: {},
    votes: { jos: null, joh: null }, voteT: 0, fadenRes: null,
    trib: { q: 0, picks: { jos: null, joh: null }, wrong: 0, done: [] },
    fin: { step: 'twist', cutter: null, holds: { jos: false, joh: false }, pullT: 0, choice: null },
    hints: {}, hintLog: [],
    startT: 0, usedMs: 0, runT: 0, penaltyMs: 0, timeUp: false, overtime: 0,
    ending: null, endedAt: 0, aborted: false, abortBy: null, result: null,
    feed: [],
  };
  let cur = null;
  const feed = (o) => st.feed.push({ ev: cur?.id, t: cur?.t, ...o });
  const pause = (t) => { if (st.runT) { st.usedMs += Math.max(0, t - st.runT); st.runT = 0; } };
  const resume = (t) => { if (!st.runT && !st.timeUp) st.runT = t; };
  const end = (ending, t) => {
    pause(t);
    st.ending = ending;
    if (ending === 'applaus' || ending === 'wahrheit' || ending === 'zeit') {
      for (const g of Object.keys(st.guests)) if (st.guests[g] === 'alive') st.guests[g] = 'crushed';
    }
    st.phase = 'end';
    st.endedAt = t;
    st.result = resultOf(st);
    feed({ k: 'end', ending });
  };
  const hurt = (p, l, why, t) => {
    if (!p || st.phase === 'end') return;
    st.blood[p] = Math.max(0, r1(st.blood[p] - l));
    feed({ k: 'hurt', who: p, l, why });
    if (st.blood[p] <= 0) end('blut', t);
  };
  const enterScene = (s, t) => {
    st.scene = s;
    st.sceneT = t;
    st.sub = 'play';
    st.nextReady = { jos: false, joh: false };
    const sc = SCENES[s];
    if (sc.kind === 'puzzle') {
      const P = PUZ[sc.id];
      let ps = st.ps[s];
      if (P.start) ps = P.start(st.specs[s], ps, t);
      st.ps[s] = ps;
      resume(t);
    } else if (sc.kind === 'tribunal') resume(t);
    else pause(t);
    if (sc.kind === 'faden') { st.votes = { jos: null, joh: null }; st.voteT = t; st.fadenRes = null; st.sub = 'vote'; }
    if (sc.kind === 'reveal') st.sub = 'read';
    if (sc.kind === 'finale') { st.fin = { step: 'twist', cutter: null, holds: { jos: false, joh: false }, pullT: 0, choice: null }; st.votes = { jos: null, joh: null }; }
    feed({ k: 'scene', s });
  };
  const giveDocs = (s) => {
    for (const [who, doc] of SCENES[s].docs || []) {
      const p = who === 'first' ? st.first : other(st.first);
      if (!st.docs[p].includes(doc)) st.docs[p].push(doc);
    }
  };

  for (const e of evs) {
    if (st.phase === 'end') break;
    cur = e;
    const d = e.d || {};
    const p = e.by;
    if (e.ty !== 'setup' && !PIDS.includes(p)) continue;
    const sc = SCENES[st.scene];
    switch (e.ty) {
      case 'setup': {
        if (st.phase !== 'setup') break;
        st.diff = DIFFS[d.diff] ? d.diff : 'normal';
        st.limit = DIFFS[st.diff].limit;
        st.first = PIDS.includes(d.first) ? d.first : 'jos';
        st.seed = String(d.seed || meta.id).slice(0, 24);
        st.specs = specsFor(st.seed, st.diff);
        st.ps = st.specs.map((sp, i) => (sp ? PUZ[SCENES[i].id].init(sp) : null));
        st.phase = 'hello';
        break;
      }
      case 'ready': {
        if (st.phase !== 'hello') break;
        st.ready[p] = true;
        feed({ k: 'ja', by: p });
        if (st.ready.jos && st.ready.joh) { st.phase = 'play'; st.startT = e.t; enterScene(0, e.t); }
        break;
      }
      case 'act': {
        if (st.phase !== 'play' || st.timeUp || sc.kind !== 'puzzle' || st.sub !== 'play' || d.s !== st.scene) break;
        const role = roleOf(st, p);
        const res = PUZ[sc.id].apply(st.specs[st.scene], st.ps[st.scene], d, d.k === 'nails' ? 'any' : role, { t: e.t });
        if (res.state === st.ps[st.scene] && !res.solved && !res.hurt && !res.info) break;
        st.ps[st.scene] = res.state;
        feed({ k: 'act', s: st.scene, by: p, a: d.k, info: res.info || null });
        if (res.hurt) hurt(whoHas(st, res.hurt.role), res.hurt.l, res.hurt.why, e.t);
        if (st.phase === 'end') break;
        if (res.solved) {
          pause(e.t);
          st.sub = 'done';
          giveDocs(st.scene);
          // Jeder gelöste Akt-1-Faden trifft Haslingers Bein (nur Geschichte)
          feed({ k: 'solved', s: st.scene, by: p });
        }
        break;
      }
      case 'next': {
        if (st.phase !== 'play' || d.s !== st.scene) break;
        const okSub = (sc.kind === 'puzzle' && st.sub === 'done') || (sc.kind === 'reveal' && st.sub === 'read') || (sc.kind === 'faden' && st.sub === 'done');
        const finStep = sc.kind === 'finale' && (st.fin.step === 'twist' || st.fin.step === 'read');
        if (!okSub && !finStep) break;
        st.nextReady[p] = true;
        feed({ k: 'next', by: p, s: st.scene });
        if (!(st.nextReady.jos && st.nextReady.joh)) break;
        st.nextReady = { jos: false, joh: false };
        if (finStep) {
          if (st.fin.step === 'twist') st.fin.step = 'seam';
          else { st.fin.step = 'pull'; st.fin.pullT = e.t; }
          feed({ k: 'fin', step: st.fin.step });
          break;
        }
        if (st.scene + 1 < SCENES.length) enterScene(st.scene + 1, e.t);
        break;
      }
      case 'vote': {
        if (st.phase !== 'play' || d.s !== st.scene) break;
        if (sc.kind === 'faden' && st.sub === 'vote' && ['cut', 'hold'].includes(d.v)) {
          st.votes[p] = d.v;
          feed({ k: 'vote', by: p, v: d.v });
          if (st.votes.jos && st.votes.jos === st.votes.joh) resolveFaden(st.votes.jos, false, e.t);
        } else if (sc.kind === 'finale' && st.fin.step === 'letter' && ['lesen', 'reissen'].includes(d.v)) {
          st.votes[p] = d.v;
          feed({ k: 'vote', by: p, v: d.v });
          if (st.votes.jos && st.votes.jos === st.votes.joh) {
            st.fin.choice = st.votes.jos;
            if (st.fin.choice === 'lesen') { st.fin.step = 'read'; st.nextReady = { jos: false, joh: false }; feed({ k: 'fin', step: 'read' }); }
            else end('applaus', e.t);
          }
        }
        break;
      }
      case 'votetimeout': {
        if (st.phase !== 'play' || d.s !== st.scene || sc.kind !== 'faden' || st.sub !== 'vote') break;
        if (e.t < st.voteT + FADEN_MS - 2e3) break;
        resolveFaden('cut', true, e.t);
        break;
      }
      case 'pick': {
        if (st.phase !== 'play' || st.timeUp || sc.kind !== 'tribunal' || d.q !== st.trib.q) break;
        const qq = TRIBUNAL.questions[st.trib.q];
        if (!qq || !qq.opts.includes(d.v)) break;
        st.trib.picks[p] = d.v;
        feed({ k: 'pick', by: p, q: st.trib.q, v: d.v });
        const a = st.trib.picks.jos;
        if (!a || a !== st.trib.picks.joh) break;
        st.trib.picks = { jos: null, joh: null };
        if (a === qq.ok) {
          st.trib.done.push(qq.id);
          feed({ k: 'verdict', q: st.trib.q, v: a, ok: true });
          st.trib.q++;
          if (st.trib.q >= TRIBUNAL.questions.length) { pause(e.t); enterScene(st.scene + 1, e.t); }
        } else if (qq.want && a === qq.want) {
          feed({ k: 'verdict', q: st.trib.q, v: a, ok: false, want: true });
          end('applaus', e.t);
        } else {
          st.trib.wrong++;
          const l = a === 'anton' && qq.id === 'feuer' ? .5 : .25;
          feed({ k: 'verdict', q: st.trib.q, v: a, ok: false, rage: a === 'anton' && qq.id === 'feuer' });
          hurt('jos', l, 'urteil', e.t);
          if (st.phase !== 'end') hurt('joh', l, 'urteil', e.t);
        }
        break;
      }
      case 'seam': {
        if (st.phase !== 'play' || sc.kind !== 'finale' || st.fin.step !== 'seam') break;
        st.fin.cutter = p;
        st.fin.step = 'letter';
        st.votes = { jos: null, joh: null };
        if (!st.docs[p].includes('brief')) st.docs[p].push('brief');
        feed({ k: 'seam', by: p });
        break;
      }
      case 'hold': {
        if (st.phase !== 'play' || sc.kind !== 'finale' || st.fin.step !== 'pull') break;
        st.fin.holds[p] = !!d.on;
        feed({ k: 'hold', by: p, on: !!d.on });
        break;
      }
      case 'pullok': {
        if (st.phase !== 'play' || sc.kind !== 'finale' || st.fin.step !== 'pull') break;
        if (!(st.fin.holds.jos && st.fin.holds.joh)) break;
        st.fin.step = 'done';
        end('vorhang', e.t);
        break;
      }
      case 'pullfail': {
        if (st.phase !== 'play' || sc.kind !== 'finale' || st.fin.step !== 'pull') break;
        if (e.t < st.fin.pullT + PULL_MS - 2e3) break;
        st.fin.step = 'done';
        end('wahrheit', e.t);
        break;
      }
      case 'hint': {
        if (st.phase !== 'play' || st.timeUp || d.s !== st.scene) break;
        if (!(sc.kind === 'puzzle' && st.sub === 'play') && sc.kind !== 'tribunal') break;
        const used = st.hints[st.scene] || 0;
        if (used >= 2 || d.n !== used + 1) break;
        st.hints[st.scene] = used + 1;
        st.hintLog.push({ s: st.scene, n: used + 1, by: p });
        feed({ k: 'hint', s: st.scene, n: used + 1, by: p });
        hurt(p, .5, 'tipp', e.t);
        break;
      }
      case 'donate': {
        if (st.phase !== 'play') break;
        const q = other(p);
        if (st.blood[p] <= 1.5 || st.blood[q] >= START_BLOOD) break;
        st.blood[p] = r1(st.blood[p] - .5);
        st.blood[q] = r1(Math.min(START_BLOOD, st.blood[q] + .5));
        st.penaltyMs += PEN_DONATE;
        feed({ k: 'donate', by: p });
        break;
      }
      case 'timeup': {
        if (!timeUpNow(st, e.t + 3e3)) break;
        pause(e.t);
        st.usedMs = Math.max(st.usedMs, st.limit - st.penaltyMs);
        st.timeUp = true;
        feed({ k: 'timeup' });
        break;
      }
      case 'overtime': {
        if (st.phase !== 'play' || !st.timeUp) break;
        st.timeUp = false;
        st.overtime++;
        st.limit += 10 * 60e3;
        feed({ k: 'overtime', by: p });
        hurt('jos', 1, 'zeit', e.t);
        if (st.phase !== 'end') hurt('joh', 1, 'zeit', e.t);
        if (st.phase === 'end') break;
        const k = SCENES[st.scene].kind;
        if ((k === 'puzzle' && st.sub === 'play') || k === 'tribunal') resume(e.t);
        break;
      }
      case 'giveup':
        if (st.phase !== 'play' && st.phase !== 'hello') break;
        st.gaveUp = true;
        end('zeit', e.t);
        break;
      case 'abort':
        st.phase = 'end'; st.aborted = true; st.abortBy = p; st.endedAt = e.t; pause(e.t);
        feed({ k: 'abort', by: p });
        break;
    }
  }
  return st;

  function resolveFaden(v, forced, t) {
    const g = SCENES[st.scene].guest;
    st.fadenRes = { v, forced, g };
    st.sub = 'done';
    st.nextReady = { jos: false, joh: false };
    if (v === 'cut') st.guests[g] = 'dead';
    else st.spoke[g] = true;
    feed({ k: 'faden', g, v, forced });
    if (v === 'hold') { hurt('jos', .5, 'faden', t); if (st.phase !== 'end') hurt('joh', .5, 'faden', t); }
  }
}

// ---------- Wertung ----------
export function resultOf(st) {
  const alive = Object.values(st.guests).filter((g) => g === 'alive').length;
  const minBlood = Math.min(st.blood.jos, st.blood.joh);
  let stars = 0;
  if (st.ending === 'vorhang') stars = Math.max(1, 3 - (alive < 2 ? 1 : 0) - (minBlood < 1.5 ? 1 : 0));
  else if (st.ending === 'wahrheit' || st.ending === 'applaus') stars = 1;
  return { ending: st.ending, stars, alive, minBlood, ms: elapsed(st, st.endedAt), hints: st.hintLog.length, wrong: st.trib.wrong, overtime: st.overtime };
}

export const docOf = (id) => DOCS[id];

// ---------- für Lobby und Hinweise ----------
export function todo(st, p) {
  if (st.phase === 'hello') return st.ready[p] ? null : '»Ja!« rufen';
  if (st.phase === 'play') return 'Weiterspielen';
  return null;
}
export function label(st) {
  if (st.phase === 'setup') return 'Wird vorbereitet';
  if (st.phase === 'hello') return `${TITLE} – gleich geht’s los`;
  if (st.phase === 'play') return `${TITLE} – ${SCENES[st.scene].title}`;
  if (st.aborted) return 'Beendet';
  return st.ending === 'vorhang' ? `Überlebt! ${'★'.repeat(st.result?.stars || 0)}` : st.ending === 'blut' ? 'Verblutet' : st.ending === 'zeit' ? 'Der Vorhang fiel' : 'Applaus für den Kasperl';
}
export function endLine(st) {
  if (st.aborted) return 'Das Stück wurde abgebrochen.';
  if (st.ending === 'vorhang') return `Ihr habt überlebt – und die Wahrheit gefunden! ${'★'.repeat(st.result?.stars || 0)}`;
  if (st.ending === 'blut') return 'Einer von euch ist verblutet.';
  if (st.ending === 'zeit') return 'Der Eiserne Vorhang ist gefallen.';
  return 'Der Kasperl hat sein Stück zu Ende gespielt.';
}
export const playerName = (p) => nameOf(p);
