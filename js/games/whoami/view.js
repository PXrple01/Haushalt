// Wer bin ich? – Oberfläche.
// Nebeneinander: Figuren mit Sichtschutz aussuchen, danach wird gesprochen – das Handy zählt, hat Antwort-Knöpfe und einen Merkzettel.
// Weit weg: Figur auf dem eigenen Handy aussuchen, Fragen als Chat (mit Schnellfragen), Antworten per Knopf.
import { h, esc, centerOf } from '../../core/dom.js';
import { icon } from '../../art/icons.js';
import { me, on, get, set } from '../../core/store.js';
import { nameOf, other } from '../../core/util.js';
import { handoff, sheet, toast, announce, confirmBox } from '../../core/ui.js';
import { motionOK } from '../../core/theme.js';
import { burst } from '../../core/fx.js';
import { sfx, haptic } from '../../core/sound.js';
import { nav } from '../../core/router.js';
import { createSession, addEvent, getSession, sendFx } from '../../core/sync.js';
import { reduce } from './logic.js';
import { enc } from '../secret.js';
import { CHAR_CATS, CHAR_LEVELS, charItems, QUICK_QUESTIONS, NOTE_CHIPS } from '../../data/characters.js';
import { shell, partnerNote, whoSeg, resolveWho, secretPicker, turnBanner, answerRow, logView, resultCard, finale, markCelebrated, peekButton, waitCard, onReactions } from '../common.js';

const RULES = [
  'Jeder denkt sich für den anderen eine Figur aus – echte Person, Film-, Anime- oder Märchenfigur.',
  'Abwechselnd stellt ihr Ja/Nein-Fragen, um herauszufinden, wer ihr seid.',
  'Bei „Ja“ oder „Vielleicht“ darfst du weiterfragen, bei „Nein“ ist der andere dran.',
  'Wer seine Figur mit weniger Fragen errät, gewinnt. Der Tipp „Bin ich …?“ zählt auch als Frage.',
];
const ANS = [
  { value: 'ja', label: 'Ja', icon: 'check', cls: 'good' },
  { value: 'nein', label: 'Nein', icon: 'cross', cls: 'bad' },
  { value: 'vielleicht', label: 'Vielleicht', icon: 'maybe', cls: 'maybe' },
  { value: 'richtig', label: 'Erraten!', icon: 'sparkle', cls: 'win' },
];
const A_TXT = { ja: 'Ja', nein: 'Nein', vielleicht: 'Vielleicht', richtig: 'Richtig erraten!' };

// ======================================================================
export function setup(root) {
  const p = me.get();
  const { body, mode, cleanup } = shell({ root, game: 'whoami', rules: RULES });
  let first = p;
  body.innerHTML = `
    <div class="setup stack">
      <div class="postit-hero" aria-hidden="true"><div class="postit jos tilt-l"><span class="pi-val">Wer bin ich?</span></div><div class="postit joh tilt-r"><span class="pi-val">???</span></div></div>
      <p class="lead measure">${mode === 'remote'
        ? 'Jeder sucht auf seinem Handy eine Figur für den anderen aus. Fragen tippt ihr, Antworten gibt’s per Knopf.'
        : 'Jeder denkt sich für den anderen eine Figur aus. Dann fragt ihr laut – das Handy zählt mit.'}</p>
      <section class="setup-sec stack"><h2 class="setup-h">Wer fragt zuerst?</h2><div data-slot="first"></div></section>
      ${partnerNote(mode)}
      <button class="btn primary big block" type="button" data-a="start">${icon('sparkle')}<span>Los geht’s</span></button>
    </div>`;
  body.querySelector('[data-slot="first"]').append(whoSeg({ label: 'Wer fragt zuerst?', value: first, random: true, onChange: (v) => { first = v; } }));
  body.querySelector('[data-a="start"]').addEventListener('click', () => {
    sfx.pop(); haptic(12);
    const id = createSession('whoami', mode, { first: resolveWho(first) });
    nav('#/spiel/' + id, { replace: true });
  });
  return cleanup;
}

// ======================================================================
export function play(root, sid) {
  const p = me.get();
  const { body, mode, cleanup: shellOff } = shell({ root, game: 'whoami', sid, rules: RULES });
  const remote = mode === 'remote';
  const compute = () => { const s = getSession(sid); return reduce(s.meta, s.evs); };
  let st = compute();
  let view = '';
  let busy = false;
  let partnerTyping = 0;
  const offs = [];

  // ---------- Figur aussuchen ----------
  function renderPick(forP) {
    view = 'pick:' + forP;
    const by = other(forP);
    const box = h('div', { class: 'stack wa-pick' });
    box.innerHTML = `<div class="phase-head"><h2>${remote ? `Such eine Figur für ${esc(nameOf(forP))} aus` : `${esc(nameOf(by))}, such eine Figur für ${esc(nameOf(forP))} aus`}</h2>
      <p class="soft">${esc(nameOf(forP))} muss später herausfinden, wer ${forP === 'jos' ? 'sie' : 'er'} ist.</p></div>`;
    const reveal = h('label', { class: 'switch' });
    reveal.innerHTML = `${icon('bulb')}<span>Kategorie als Tipp verraten</span><input type="checkbox"><span class="track"></span>`;
    const picker = secretPicker({
      ownLabel: 'Eigene Figur', placeholder: 'z. B. Pikachu', maxLength: 40,
      pool: { cats: CHAR_CATS, levels: CHAR_LEVELS, items: (c, l) => charItems(c, l).map((x) => ({ text: x.text, cat: x.cat })), rerollLabel: 'Andere Figur' },
      validate: (v) => (v.trim().length >= 2 ? { ok: true, msg: '' } : { ok: false, msg: 'Mindestens 2 Zeichen.' }),
      extra: reveal,
    });
    const go = h('button', { class: 'btn primary big block', type: 'button' });
    go.innerHTML = `${icon('lock')}<span>Figur festlegen</span>`;
    go.addEventListener('click', () => {
      const v = picker.value();
      if (!v.ok) { toast(v.msg || 'Bitte eine Figur wählen.', { key: 'game', icon: 'info' }); picker.focusOwn?.(); return; }
      sfx.pop(); haptic(14);
      const showCat = reveal.querySelector('input').checked;
      addEvent(sid, 'char', { for: forP, name: enc(v.text.trim(), sid), cat: showCat ? v.cat : '' });
    });
    box.append(picker, go);
    body.replaceChildren(box);
  }

  // ---------- Post-its ----------
  function postitsHTML() {
    const one = (q) => {
      const known = st.done[q]?.solved || st.phase === 'end' || (remote && q !== p);
      const c = st.chars[q];
      const val = known && c ? c.name : '???';
      const active = st.phase === 'play' && st.turn === q && !st.done[q];
      const label = remote ? (q === p ? 'Du bist …' : `${nameOf(q)} ist …`) : `${nameOf(q)} ist …`;
      const tip = c?.cat && !known ? `<span class="pi-tip">${icon('bulb')}${esc(c.cat)}</span>` : '';
      return `<div class="postit ${q}${active ? ' active' : ''}${known ? ' known' : ''}" data-p="${q}">
        <span class="pi-who">${esc(label)}</span><span class="pi-val">${esc(val)}</span>${tip}
        <span class="pi-count">${st.counts[q]} ${st.counts[q] === 1 ? 'Frage' : 'Fragen'}${st.done[q]?.gaveUp ? ' – aufgegeben' : st.done[q] ? ' – erraten!' : ''}</span></div>`;
    };
    const order = remote ? [p, other(p)] : ['jos', 'joh'];
    return `<div class="postits">${order.map(one).join('')}</div>`;
  }

  // ---------- Spielbrett ----------
  let el = {};
  function renderBoard() {
    view = 'board';
    const box = h('div', { class: 'stack wa-board', style: { '--gap': '14px' } });
    box.innerHTML = `${postitsHTML()}<div data-slot="turn"></div><div data-slot="main" class="stack" style="--gap:12px"></div><div data-slot="log"></div>`;
    body.replaceChildren(box);
    el = { box, turn: turnBanner(), main: box.querySelector('[data-slot="main"]'), log: box.querySelector('[data-slot="log"]') };
    box.querySelector('[data-slot="turn"]').append(el.turn);
    refresh();
  }

  function refresh() {
    if (view !== 'board') return;
    el.box.querySelector('.postits').outerHTML = postitsHTML();
    if (st.phase === 'end') { renderEnd(); return; }
    const asker = st.turn;
    const sub = st.done[other(asker)] ? `${nameOf(other(asker))} hat es schon – nur noch ${nameOf(asker)} fragt` : 'Bei Ja darfst du weiterfragen';
    el.turn.set(asker, remote && asker === p ? 'Du fragst' : `${nameOf(asker)} fragt`, `Frage ${st.counts[asker] + 1} – ${sub}`);
    if (remote) renderRemoteMain(); else renderCouchMain();
    renderLog();
  }

  // Nebeneinander: Antwort-Knöpfe + Merkzettel + Spicken/Aufgeben
  function renderCouchMain() {
    const asker = st.turn, answerer = other(asker);
    const wrap = h('div', { class: 'stack', style: { '--gap': '12px' } });
    wrap.innerHTML = `<p class="ans-label">Stell deine Frage laut. Antwort von ${esc(nameOf(answerer))}:</p>`;
    wrap.append(answerRow({ options: ANS, onPick: (a) => answer(a) }));
    wrap.append(notesBox(asker));
    const tools = h('div', { class: 'row wrap center wa-tools' });
    tools.append(peekButton({ label: `${nameOf(asker)}s Figur`, warn: `${nameOf(asker)}, nicht hinschauen!`, reveal: () => st.chars[asker]?.name || '' }));
    const give = h('button', { class: 'btn small quiet', type: 'button' });
    give.innerHTML = `${icon('flag')}<span>${esc(nameOf(asker))} gibt auf</span>`;
    give.addEventListener('click', async () => {
      const ok = await confirmBox({ title: `${nameOf(asker)} gibt auf?`, text: 'Dann zählt die Runde als verloren – außer ihr gebt beide auf.', ok: 'Aufgeben', danger: true });
      if (ok) addEvent(sid, 'giveup', { p: asker });
    });
    tools.append(give);
    wrap.append(tools);
    el.main.replaceChildren(wrap);
  }

  async function answer(a) {
    const asker = st.turn;
    if (a === 'richtig') {
      const ok = await confirmBox({ title: `Hat ${nameOf(asker)} es erraten?`, text: `${nameOf(asker)} ist ${st.chars[asker]?.name}.`, ok: 'Ja, erraten!' });
      if (!ok) return;
    }
    const ev = addEvent(sid, 'answer', { a });
    if (!remote && ev && a !== 'richtig') {
      toast(`${A_TXT[a]}${a === 'nein' ? ` – jetzt fragt ${nameOf(other(asker))}` : ''}`, { key: 'game', icon: a === 'ja' ? 'check' : a === 'nein' ? 'cross' : 'maybe', ms: 3500, action: { label: 'Rückgängig', run: () => addEvent(sid, 'undo', { id: ev.id }) } });
    }
  }

  // Merkzettel (nur auf diesem Gerät): antippen = ✓, nochmal = ✗, nochmal = leer
  function notesBox(q) {
    const key = `notes:${sid}:${q}`;
    const notes = get(key, {}) || {};
    const box = h('details', { class: 'notes' });
    box.innerHTML = `<summary>${icon('pencil')}<span>Merkzettel für ${esc(nameOf(q))}</span></summary>
      <div class="chips">${NOTE_CHIPS.map((c) => `<button class="chip note-chip" type="button" data-n="${esc(c)}" data-s="${notes[c] || 0}">${esc(c)}</button>`).join('')}</div>`;
    if (Object.keys(notes).length) box.open = true;
    box.addEventListener('click', (e) => {
      const b = e.target.closest('.note-chip');
      if (!b) return;
      const n = b.dataset.n;
      const next = { 0: 1, 1: -1, '-1': 0 }[b.dataset.s] ?? 0;
      b.dataset.s = next;
      if (next) notes[n] = next; else delete notes[n];
      set(key, notes);
      sfx.tap(); haptic(6);
    });
    return box;
  }

  // Weit weg: je nach Lage Frage stellen, warten, antworten oder Tipp prüfen
  function renderRemoteMain() {
    const asker = st.turn;
    const box = h('div', { class: 'stack', style: { '--gap': '12px' } });
    if (st.pendingSolve && st.pendingSolve.by !== p) {
      const ps = st.pendingSolve;
      box.innerHTML = `<div class="q-card"><span class="q-from">${esc(nameOf(ps.by))} tippt:</span><span class="q-text">„${esc(ps.g)}“</span>
        <span class="soft small">Richtig wäre: <b>${esc(st.chars[ps.by]?.name || '')}</b>${ps.close ? ' – sieht fast gleich aus' : ''}</span></div>`;
      box.append(answerRow({ options: [{ value: 'ok', label: 'Stimmt!', icon: 'check', cls: 'good' }, { value: 'no', label: 'Falsch', icon: 'cross', cls: 'bad' }], onPick: (v) => addEvent(sid, 'judge', { ok: v === 'ok' }) }));
    } else if (st.pending && st.pending.by !== p) {
      box.innerHTML = `<div class="q-card"><span class="q-from">${esc(nameOf(st.pending.by))} fragt:</span><span class="q-text">${esc(st.pending.q)}</span>
        <span class="soft small">${esc(nameOf(st.pending.by))} ist <b>${esc(st.chars[st.pending.by]?.name || '')}</b></span></div>`;
      box.append(answerRow({ options: ANS, onPick: (a) => answer(a) }));
    } else if (asker === p && !st.done[p]) {
      if (st.pendingSolve) box.append(waitCard(`${nameOf(other(p))} prüft deinen Tipp`, `„${st.pendingSolve.g}“`));
      else if (st.pending) box.append(waitCard(`Warte auf ${nameOf(other(p))}s Antwort`, st.pending.q));
      else box.append(composer());
    } else {
      const typing = Date.now() - partnerTyping < 3500;
      box.append(waitCard(typing ? `${nameOf(asker)} tippt` : `${nameOf(asker)} überlegt sich eine Frage`, st.done[p] ? 'Du hast deine Figur schon erraten – jetzt nur noch antworten.' : ''));
    }
    el.main.replaceChildren(box);
  }

  function composer() {
    const c = h('div', { class: 'composer stack', style: { '--gap': '10px' } });
    c.innerHTML = `<form class="row compose-row" autocomplete="off">
        <input class="field grow" maxlength="160" placeholder="Stell eine Ja/Nein-Frage …" aria-label="Deine Frage" enterkeyhint="send">
        <button class="btn primary square" type="submit" aria-label="Frage senden">${icon('send')}</button></form>
      <div class="chips scroll quick">${QUICK_QUESTIONS.map((q) => `<button class="chip" type="button" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <button class="btn block" type="button" data-a="solve">${icon('wand')}<span>Ich weiß es – lösen</span></button>
      <button class="btn small quiet" type="button" data-a="giveup">${icon('flag')}<span>Aufgeben</span></button>`;
    const input = c.querySelector('input');
    let lastTyping = 0;
    input.addEventListener('input', () => {
      if (Date.now() - lastTyping > 2000) { lastTyping = Date.now(); sendFx({ kind: 'typing', sid }); }
    });
    c.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (q.length < 3) { input.focus(); return; }
      ask(q);
    });
    c.addEventListener('click', async (e) => {
      const qb = e.target.closest('[data-q]');
      if (qb) { ask(qb.dataset.q); return; }
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'solve') openSolve();
      else if (a === 'giveup') {
        const ok = await confirmBox({ title: 'Aufgeben?', text: 'Dann zählt die Runde als verloren – außer ihr gebt beide auf.', ok: 'Aufgeben', danger: true });
        if (ok) addEvent(sid, 'giveup', {});
      }
    });
    return c;
  }
  function ask(q) { sfx.send(); haptic(8); addEvent(sid, 'ask', { q: q.endsWith('?') ? q : q + '?' }); }

  function openSolve() {
    const f = h('div', { class: 'stack' });
    f.innerHTML = `<input class="field big center" maxlength="60" autocomplete="off" placeholder="Ich bin …" aria-label="Wer bist du?">
      <p class="hint">Zählt als Frage. Passt es nicht genau, entscheidet ${esc(nameOf(other(p)))}.</p>`;
    const inp = f.querySelector('input');
    const go = h('button', { class: 'btn primary big block', type: 'button' });
    go.innerHTML = `${icon('check')}<span>Tipp abgeben</span>`;
    f.append(go);
    const sh = sheet({ title: 'Wer bist du?', body: f });
    setTimeout(() => inp.focus(), 80);
    const submit = () => {
      const g = inp.value.trim();
      if (g.length < 1) { inp.focus(); return; }
      sh.close(true);
      addEvent(sid, 'solve', { g });
    };
    go.addEventListener('click', submit);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  }

  function renderLog() {
    if (!remote) {
      // Kompakt: farbige Punkte je Person
      const pip = (e) => `<i class="pip ${e.a}" title="${esc(A_TXT[e.a] || e.a)}"></i>`;
      const row = (q) => `<div class="tally ${q}"><span class="t-name">${esc(nameOf(q))}</span><span class="pips">${st.log.filter((e) => e.by === q).map(pip).join('') || '<span class="soft small">noch keine Frage</span>'}</span></div>`;
      el.log.innerHTML = `<div class="tallies">${row('jos')}${row('joh')}</div>`;
      return;
    }
    const entries = st.log.slice();
    el.log.replaceChildren(logView(entries.reverse(), { mine: p, empty: 'Noch keine Fragen – leg los!' }));
  }

  // ---------- Ende ----------
  function renderEnd() {
    el.turn.remove?.();
    el.main.replaceChildren();
    const w = st.winner;
    const line = (q) => `${esc(nameOf(q))} war <b>${esc(st.chars[q]?.name || '?')}</b> – ${st.done[q]?.gaveUp ? 'aufgegeben' : `${st.counts[q]} ${st.counts[q] === 1 ? 'Frage' : 'Fragen'}`}`;
    let title;
    if (st.aborted) title = 'Partie beendet';
    else if (w === 'draw') title = 'Unentschieden!';
    else title = remote ? (w === p ? 'Gewonnen!' : `${nameOf(w)} gewinnt!`) : `${nameOf(w)} gewinnt!`;
    const card = resultCard({
      winner: w, title, aborted: st.aborted, sad: remote && w !== p && w !== 'draw',
      lines: st.aborted ? [`${esc(nameOf(st.abortBy))} hat die Partie beendet.`] : [line('jos'), line('joh')],
      rematchLabel: 'Nochmal spielen',
      onRematch: () => { const id = createSession('whoami', mode, { first: other(st.first) }); nav('#/spiel/' + id, { replace: true }); },
    });
    el.main.append(card);
  }

  // ---------- Updates ----------
  function celebrateSolve(q) {
    const pi = el.box?.querySelector(`.postit[data-p="${q}"]`);
    if (pi && motionOK()) {
      pi.animate([{ transform: 'rotateY(90deg) scale(.9)' }, { transform: 'rotateY(0) scale(1.06)' }, { transform: 'none' }], { duration: 700, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      const c = centerOf(pi);
      burst(c.x, c.y, { count: 30, emoji: true, speed: [180, 480] });
    }
    sfx.win(); haptic([20, 40, 60]);
    announce(`${nameOf(q)} hat es erraten: ${st.chars[q]?.name}.`);
  }

  async function update(prev, cur) {
    if (cur.phase === 'setup') { decideSetup(); return; }
    if (prev.phase === 'setup' && cur.phase === 'play') {
      if (!remote) {
        busy = true;
        await handoff({ to: cur.first, kicker: 'Alles bereit', title: `${nameOf(cur.first)} fragt zuerst`, text: 'Legt das Handy zwischen euch und stellt eure Fragen laut.', button: 'Los geht’s' });
        busy = false;
      } else sfx.join();
      renderBoard();
      return;
    }
    if (view !== 'board') { renderBoard(); return; }
    refresh();
    // Neue Antworten
    if (cur.log.length > prev.log.length) {
      const e = cur.log.at(-1);
      if (e.a === 'richtig') celebrateSolve(e.by);
      else if (e.a === 'ja') sfx.good();
      else if (e.a === 'nein') { sfx.bad(); }
      else sfx.flip();
      if (remote && e.by === p && e.a !== 'richtig') announce(`${nameOf(other(p))} sagt: ${A_TXT[e.a]}`);
    }
    if (remote && cur.pending && !prev.pending && cur.pending.by !== p) { sfx.join(); haptic(15); }
    if (remote && cur.pendingSolve && !prev.pendingSolve && cur.pendingSolve.by !== p) { sfx.join(); haptic([15, 30, 15]); }
    if (cur.turn !== prev.turn && cur.phase === 'play' && remote && cur.turn === p) { toast('Du bist dran!', { key: 'game', icon: 'sparkle' }); }
    if (cur.phase === 'end' && prev.phase !== 'end') {
      if (!cur.aborted) setTimeout(() => finale(sid, { winner: cur.winner, iWon: cur.winner === p, couch: !remote }), 600);
      else if (cur.abortBy !== p) toast(`${nameOf(cur.abortBy)} hat die Partie beendet.`, { key: 'game', icon: 'flag' });
    }
  }

  async function decideSetup() {
    if (remote) {
      const forP = other(p);
      if (!st.chars[forP]) { if (view !== 'pick:' + forP) renderPick(forP); }
      else if (view !== 'wait') { view = 'wait'; body.replaceChildren(waitCard(`${nameOf(forP)} sucht noch eine Figur für dich aus`, 'Gleich geht’s los!')); }
      return;
    }
    // Nebeneinander: erst Baby für Johann, dann Johann für Baby
    const forP = !st.chars.joh ? 'joh' : 'jos';
    if (view === 'pick:' + forP) return;
    const by = other(forP);
    busy = true;
    body.replaceChildren(waitCard('Einen Moment …'));
    await handoff({ to: by, kicker: 'Wer bin ich?', title: `${nameOf(by)} sucht eine Figur aus`, text: `${nameOf(forP)}, nicht hinschauen!`, button: `Ich bin ${nameOf(by)} – los!` });
    busy = false;
    st = compute(); shown = st;
    if (st.phase === 'setup') renderPick(!st.chars.joh ? 'joh' : 'jos');
    else renderBoard();
  }

  // Warteschlange wie beim Galgenmännchen
  let shown = st;
  let queue = Promise.resolve();
  const schedule = () => {
    queue = queue.then(async () => {
      if (busy) return;
      const prev = shown, cur = st;
      if (prev === cur) return;
      shown = cur;
      try { await update(prev, cur); } catch (e) { console.error(e); }
    });
  };
  offs.push(on('session', (d) => { if (d.id !== sid) return; st = compute(); schedule(); }));
  offs.push(onReactions(sid, (d) => {
    if (d.kind === 'typing' && view === 'board' && st.turn !== p) { partnerTyping = Date.now(); refresh(); setTimeout(() => { if (view === 'board') refresh(); }, 3700); }
  }));

  // Start
  if (st.phase === 'end') { markCelebrated(sid); renderBoard(); }
  else if (st.phase === 'setup') decideSetup();
  else renderBoard();

  return () => { shellOff(); offs.forEach((f) => f()); };
}
