// Zahl erraten (1–100) – Oberfläche: geheime Zahl, Zahlen-Brett zum Durchstreichen, Fragen-Ideen, Tipps.
import { h, esc, centerOf } from '../../core/dom.js';
import { icon } from '../../art/icons.js';
import { me, on, get, set } from '../../core/store.js';
import { nameOf, other, rint } from '../../core/util.js';
import { handoff, sheet, toast, announce, confirmBox } from '../../core/ui.js';
import { motionOK } from '../../core/theme.js';
import { burst } from '../../core/fx.js';
import { sfx, haptic } from '../../core/sound.js';
import { nav } from '../../core/router.js';
import { createSession, addEvent, getSession, sendFx } from '../../core/sync.js';
import { reduce, MIN, MAX } from './logic.js';
import { enc } from '../secret.js';
import { CARDS, cardById, excludedBy } from '../../data/questions.js';
import { shell, partnerNote, whoSeg, resolveWho, turnBanner, answerRow, logView, resultCard, finale, markCelebrated, waitCard, onReactions } from '../common.js';

const RULES = [
  'Jeder denkt sich eine Zahl von 1 bis 100 aus.',
  'Abwechselnd stellt ihr genau eine Ja/Nein-Frage – gern um die Ecke gedacht, z. B. „Wäre das mein Alter, dürfte ich Alkohol kaufen?“',
  'Ein direkter Tipp („Ist es 42?“) zählt auch als Frage. Ob er stimmt, prüft die App.',
  'Auf deinem Zahlen-Brett streichst du aus, was nicht mehr passt – antippen oder darüberwischen.',
  'Wer die Zahl des anderen mit weniger Fragen findet, gewinnt.',
];
const ANS = [
  { value: 'ja', label: 'Ja', icon: 'check', cls: 'good' },
  { value: 'nein', label: 'Nein', icon: 'cross', cls: 'bad' },
  { value: 'weissnicht', label: 'Weiß nicht', icon: 'maybe', cls: 'maybe' },
];
const A_TXT = { ja: 'Ja', nein: 'Nein', weissnicht: 'Weiß nicht' };

// ======================================================================
export function setup(root) {
  const p = me.get();
  const { body, mode, cleanup } = shell({ root, game: 'number', rules: RULES });
  let first = p;
  body.innerHTML = `
    <div class="setup stack">
      <div class="balls-hero" aria-hidden="true"><span class="ball jos">42</span><span class="ball q">?</span><span class="ball joh">7</span></div>
      <p class="lead measure">${mode === 'remote'
        ? 'Jeder wählt auf seinem Handy eine Zahl von 1 bis 100. Fragen tippt ihr oder schickt eine Ideen-Karte.'
        : 'Jeder wählt heimlich eine Zahl von 1 bis 100. Dann fragt ihr abwechselnd laut – das Handy zählt mit.'}</p>
      <section class="setup-sec stack"><h2 class="setup-h">Wer fragt zuerst?</h2><div data-slot="first"></div></section>
      ${partnerNote(mode)}
      <button class="btn primary big block" type="button" data-a="start">${icon('sparkle')}<span>Los geht’s</span></button>
    </div>`;
  body.querySelector('[data-slot="first"]').append(whoSeg({ label: 'Wer fragt zuerst?', value: first, random: true, onChange: (v) => { first = v; } }));
  body.querySelector('[data-a="start"]').addEventListener('click', () => {
    sfx.pop(); haptic(12);
    const id = createSession('number', mode, { first: resolveWho(first) });
    nav('#/spiel/' + id, { replace: true });
  });
  return cleanup;
}

// Ziffernblock (geheime Zahl oder Tipp)
function numpad({ label, button, onDone, hideable = false }) {
  const box = h('div', { class: 'numpad stack' });
  let val = '';
  let hidden = false;
  box.innerHTML = `
    <div class="np-display" aria-live="polite"><span class="np-val">–</span>
      ${hideable ? `<button class="iconbtn np-eye" type="button" aria-label="Zahl verbergen">${icon('eye')}</button>` : ''}</div>
    <p class="hint np-hint">${esc(label)}</p>
    <div class="np-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="np-key" type="button" data-k="${n}">${n}</button>`).join('')}
      <button class="np-key fn" type="button" data-k="del" aria-label="Löschen">${icon('back')}</button>
      <button class="np-key" type="button" data-k="0">0</button>
      <button class="np-key fn" type="button" data-k="rand" aria-label="Zufallszahl">${icon('dice')}</button></div>`;
  const go = h('button', { class: 'btn primary big block', type: 'button', disabled: true });
  go.innerHTML = `${icon('check')}<span>${esc(button)}</span>`;
  box.append(go);
  const disp = box.querySelector('.np-val');
  const hint = box.querySelector('.np-hint');
  const show = () => {
    const n = parseInt(val || '0', 10);
    disp.textContent = val ? (hidden ? '•'.repeat(val.length) : val) : '–';
    const ok = n >= MIN && n <= MAX;
    go.disabled = !ok;
    hint.textContent = val && !ok ? 'Bitte eine Zahl von 1 bis 100.' : label;
    hint.classList.toggle('bad', !!val && !ok);
  };
  box.addEventListener('click', (e) => {
    const k = e.target.closest('[data-k]')?.dataset.k;
    if (k) {
      haptic(6); sfx.tap();
      if (k === 'del') val = val.slice(0, -1);
      else if (k === 'rand') { val = String(rint(MIN, MAX)); if (motionOK()) disp.animate([{ transform: 'rotateX(90deg)' }, { transform: 'none' }], { duration: 320, easing: 'ease-out' }); }
      else if (val.length < 3) val = (val + k).replace(/^0+/, '');
      show();
      return;
    }
    if (e.target.closest('.np-eye')) {
      hidden = !hidden;
      box.querySelector('.np-eye').innerHTML = icon(hidden ? 'eyeoff' : 'eye');
      show();
    }
  });
  go.addEventListener('click', () => { const n = parseInt(val, 10); if (n >= MIN && n <= MAX) onDone(n); });
  const onKey = (e) => {
    if (!box.isConnected) { document.removeEventListener('keydown', onKey); return; }
    if (/^[0-9]$/.test(e.key) && val.length < 3) { val = (val + e.key).replace(/^0+/, ''); show(); }
    else if (e.key === 'Backspace') { val = val.slice(0, -1); show(); }
    else if (e.key === 'Enter' && !go.disabled) go.click();
  };
  document.addEventListener('keydown', onKey);
  show();
  return box;
}

// ======================================================================
export function play(root, sid) {
  const p = me.get();
  const { body, mode, cleanup: shellOff } = shell({ root, game: 'number', sid, rules: RULES });
  const remote = mode === 'remote';
  const compute = () => { const s = getSession(sid); return reduce(s.meta, s.evs); };
  let st = compute();
  let view = '';
  let busy = false;
  let partnerTyping = 0;
  let lastAnswerEv = null;   // Nebeneinander: letzte Antwort (für „Rückgängig“)
  const animNext = {};       // Streich-Welle, sobald dieses Brett wieder gezeigt wird
  const offs = [];

  // ---------- Brett (nur auf diesem Gerät gespeichert) ----------
  const bkey = (q) => `board:${sid}:${q}`;
  const getBoard = (q) => new Set(get(bkey(q), []) || []);
  const saveBoard = (q, s) => set(bkey(q), [...s].sort((a, b) => a - b));
  const boardOwner = () => (remote ? p : st.turn);

  // ---------- Geheime Zahl ----------
  function renderSecret(q) {
    view = 'secret:' + q;
    const box = h('div', { class: 'stack' });
    box.innerHTML = `<div class="phase-head"><h2>${remote ? 'Deine geheime Zahl' : `${esc(nameOf(q))}, deine geheime Zahl`}</h2>
      <p class="soft">${esc(nameOf(other(q)))} versucht gleich, sie herauszufinden.</p></div>`;
    box.append(numpad({
      label: 'Eine Zahl von 1 bis 100', button: 'Zahl verstecken', hideable: true,
      onDone: (n) => { sfx.pop(); haptic(14); addEvent(sid, 'secret', { p: q, n: enc(String(n), sid) }); },
    }));
    body.replaceChildren(box);
  }

  async function decideSetup() {
    if (remote) {
      if (st.secrets[p] == null) { if (view !== 'secret:' + p) renderSecret(p); }
      else if (view !== 'wait') { view = 'wait'; body.replaceChildren(waitCard(`${nameOf(other(p))} sucht sich noch eine Zahl aus`, 'Gleich geht’s los!')); }
      return;
    }
    const q = st.secrets.jos == null ? 'jos' : 'joh';
    if (view === 'secret:' + q) return;
    busy = true;
    body.replaceChildren(waitCard('Einen Moment …'));
    await handoff({ to: q, kicker: 'Zahl erraten', title: `${nameOf(q)} wählt eine Zahl`, text: `${nameOf(other(q))}, nicht hinschauen!`, button: `Ich bin ${nameOf(q)} – los!` });
    busy = false;
    st = compute(); shown = st;
    if (st.phase === 'setup') renderSecret(st.secrets.jos == null ? 'jos' : 'joh');
    else renderBoard();
  }

  // ---------- Spielfeld ----------
  let el = {};
  function renderBoard() {
    view = 'board';
    const box = h('div', { class: 'stack nu-board', style: { '--gap': '14px' } });
    box.innerHTML = `${remote ? `<div class="my-secret"><span>Deine Zahl</span><b class="ball ${p}">${st.secrets[p] ?? '?'}</b></div>` : ''}
      <div data-slot="turn"></div><div class="grid-wrap"><div class="grid-head"><span data-slot="whose"></span><span class="grid-left" data-slot="left"></span></div><div class="ngrid" role="grid" aria-label="Zahlen-Brett"></div></div>
      <div data-slot="main" class="stack" style="--gap:12px"></div><div data-slot="log"></div>`;
    body.replaceChildren(box);
    el = { box, turn: turnBanner(), grid: box.querySelector('.ngrid'), main: box.querySelector('[data-slot="main"]'), log: box.querySelector('[data-slot="log"]'), whose: box.querySelector('[data-slot="whose"]'), left: box.querySelector('[data-slot="left"]') };
    box.querySelector('[data-slot="turn"]').append(el.turn);
    el.grid.innerHTML = Array.from({ length: 100 }, (_, i) => `<button class="nc" type="button" data-n="${i + 1}" aria-label="${i + 1}">${i + 1}</button>`).join('');
    setupGrid();
    refresh();
  }

  function paintGrid(animateSet) {
    const owner = boardOwner();
    if (!animateSet && animNext[owner]) { animateSet = animNext[owner]; delete animNext[owner]; }
    const crossed = getBoard(owner);
    const guessed = new Set(st.log.filter((e) => e.by === owner && e.guess != null).map((e) => e.guess));
    el.grid.querySelectorAll('.nc').forEach((c) => {
      const n = +c.dataset.n;
      const x = crossed.has(n) || guessed.has(n);
      if (animateSet?.has(n) && motionOK()) {
        const i = [...animateSet].indexOf(n);
        setTimeout(() => c.classList.add('x'), Math.min(900, i * 12));
      } else c.classList.toggle('x', x);
      c.classList.toggle('g', guessed.has(n));
      c.setAttribute('aria-pressed', String(x));
    });
    const left = 100 - new Set([...crossed, ...guessed]).size;
    el.left.textContent = `${left} ${left === 1 ? 'Zahl' : 'Zahlen'} möglich`;
    el.whose.textContent = remote ? `Dein Brett für ${nameOf(other(p))}s Zahl` : `${nameOf(owner)}s Brett`;
  }

  // Antippen oder darüberwischen
  function setupGrid() {
    let mode_ = null; // 'x' oder 'o'
    const touched = new Set();
    const apply = (c) => {
      if (!c || touched.has(c)) return;
      touched.add(c);
      const owner = boardOwner();
      const b = getBoard(owner);
      const n = +c.dataset.n;
      if (mode_ === 'x') b.add(n); else b.delete(n);
      saveBoard(owner, b);
      c.classList.toggle('x', mode_ === 'x');
      c.setAttribute('aria-pressed', String(mode_ === 'x'));
      haptic(4);
    };
    el.grid.addEventListener('pointerdown', (e) => {
      const c = e.target.closest('.nc');
      if (!c || c.classList.contains('g')) return;
      e.preventDefault();
      el.grid.setPointerCapture?.(e.pointerId);
      mode_ = c.classList.contains('x') ? 'o' : 'x';
      touched.clear();
      apply(c);
      sfx.tap();
    });
    el.grid.addEventListener('pointermove', (e) => {
      if (!mode_) return;
      const c = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.nc');
      if (c && !c.classList.contains('g') && el.grid.contains(c)) apply(c);
    });
    const end = () => { if (mode_) { mode_ = null; paintGrid(); } };
    el.grid.addEventListener('pointerup', end);
    el.grid.addEventListener('pointercancel', end);
    el.grid.addEventListener('keydown', (e) => {
      const c = e.target.closest('.nc');
      if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); mode_ = c.classList.contains('x') ? 'o' : 'x'; touched.clear(); apply(c); mode_ = null; paintGrid(); }
    });
  }

  function refresh() {
    if (view !== 'board') return;
    if (st.phase === 'end') { renderEnd(); return; }
    const asker = st.turn;
    const sub = st.done[other(asker)] ? `${nameOf(other(asker))} hat es schon – nur noch ${nameOf(asker)} fragt` : 'Eine Frage pro Zug';
    el.turn.set(asker, remote && asker === p ? 'Du fragst' : `${nameOf(asker)} fragt`, `Frage ${st.counts[asker] + 1} – ${sub}`);
    paintGrid();
    if (remote) renderRemoteMain(); else renderCouchMain();
    renderLog();
  }

  // Nebeneinander
  function renderCouchMain() {
    const asker = st.turn, answerer = other(asker);
    const wrap = h('div', { class: 'stack', style: { '--gap': '12px' } });
    const tools = h('div', { class: 'row nu-tools' });
    tools.innerHTML = `<button class="btn grow" type="button" data-a="ideas">${icon('bulb')}<span>Fragen-Ideen</span></button>
      <button class="btn grow" type="button" data-a="guess">${icon('target')}<span>Zahl tippen</span></button>`;
    wrap.append(tools);
    wrap.insertAdjacentHTML('beforeend', `<p class="ans-label">Frage laut gestellt? Antwort von ${esc(nameOf(answerer))}:</p>`);
    wrap.append(answerRow({ options: ANS, onPick: (a) => answer(a) }));
    const give = h('button', { class: 'btn small quiet', type: 'button' });
    give.innerHTML = `${icon('flag')}<span>${esc(nameOf(asker))} gibt auf</span>`;
    give.addEventListener('click', async () => {
      const ok = await confirmBox({ title: `${nameOf(asker)} gibt auf?`, text: 'Dann zählt die Runde als verloren – außer ihr gebt beide auf.', ok: 'Aufgeben', danger: true });
      if (ok) addEvent(sid, 'giveup', { p: asker });
    });
    const row = h('div', { class: 'row center' });
    row.append(give);
    wrap.append(row);
    tools.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'ideas') openIdeas();
      else if (a === 'guess') openGuess();
    });
    el.main.replaceChildren(wrap);
  }

  function answer(a, card = null) {
    if (!remote) lastAnswerEv = null;
    const ev = addEvent(sid, 'answer', card ? { a, card } : { a });
    if (!remote && ev) lastAnswerEv = ev.id;
  }

  // Fragen-Ideen (Kartenstapel)
  function openIdeas() {
    const list = h('div', { class: 'ideas' });
    list.innerHTML = CARDS.map((c) => `<button class="idea" type="button" data-id="${c.id}"><span class="i-e" aria-hidden="true">${c.e}</span><span class="i-q">${esc(c.q)}</span>${c.test ? `<span class="i-auto" title="Streicht danach automatisch">${icon('sparkle')}</span>` : ''}</button>`).join('');
    const intro = h('p', { class: 'soft small' }, remote ? 'Antippen schickt die Frage ab.' : 'Antippen, laut vorlesen, Antwort festhalten. Mit ✨ streicht die App danach automatisch.');
    const body_ = h('div', { class: 'stack' }, intro, list);
    const sh = sheet({ title: 'Fragen-Ideen', body: body_ });
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-id]');
      if (!b) return;
      const c = cardById(b.dataset.id);
      sh.close(true);
      if (remote) { sfx.send(); addEvent(sid, 'ask', { q: c.q, card: c.id }); return; }
      // Nebeneinander: Karte groß zeigen + Antwort festhalten
      const box = h('div', { class: 'stack' });
      box.innerHTML = `<div class="q-card big"><span class="q-emoji" aria-hidden="true">${c.e}</span><span class="q-text">${esc(c.q)}</span></div>
        <p class="ans-label">Antwort von ${esc(nameOf(other(st.turn)))}:</p>`;
      const sh2 = sheet({ title: `${nameOf(st.turn)} fragt`, body: box });
      box.append(answerRow({ options: ANS, onPick: (a) => { sh2.close(true); answer(a, c.id); } }));
    });
  }

  function openGuess() {
    const sh = sheet({
      title: `Tipp von ${remote ? 'dir' : nameOf(st.turn)}`,
      body: numpad({ label: 'Welche Zahl ist es?', button: 'Tipp abgeben', onDone: (n) => { sh.close(true); addEvent(sid, 'guess', { n }); } }),
    });
  }

  // Weit weg
  function renderRemoteMain() {
    const asker = st.turn;
    const box = h('div', { class: 'stack', style: { '--gap': '12px' } });
    if (st.pending && st.pending.by !== p) {
      const c = st.pending.card ? cardById(st.pending.card) : null;
      const truth = c?.test && st.secrets[p] != null ? (c.test(st.secrets[p]) ? 'Ja' : 'Nein') : '';
      box.innerHTML = `<div class="q-card">${c ? `<span class="q-emoji" aria-hidden="true">${c.e}</span>` : ''}<span class="q-from">${esc(nameOf(st.pending.by))} fragt:</span><span class="q-text">${esc(st.pending.q)}</span>
        ${truth ? `<span class="soft small">Für deine ${st.secrets[p]} wäre das: <b>${truth}</b></span>` : ''}</div>`;
      box.append(answerRow({ options: ANS, onPick: (a) => answer(a) }));
    } else if (asker === p && !st.done[p]) {
      if (st.pending) box.append(waitCard(`Warte auf ${nameOf(other(p))}s Antwort`, st.pending.q));
      else box.append(composer());
    } else {
      const typing = Date.now() - partnerTyping < 3500;
      box.append(waitCard(typing ? `${nameOf(asker)} tippt` : `${nameOf(asker)} überlegt sich eine Frage`, st.done[p] ? 'Du hast die Zahl schon gefunden – jetzt nur noch antworten.' : ''));
    }
    el.main.replaceChildren(box);
  }

  function composer() {
    const c = h('div', { class: 'composer stack', style: { '--gap': '10px' } });
    c.innerHTML = `<form class="row compose-row" autocomplete="off">
        <input class="field grow" maxlength="160" placeholder="Deine Ja/Nein-Frage …" aria-label="Deine Frage" enterkeyhint="send">
        <button class="btn primary square" type="submit" aria-label="Frage senden">${icon('send')}</button></form>
      <div class="row nu-tools"><button class="btn grow" type="button" data-a="ideas">${icon('bulb')}<span>Ideen</span></button>
        <button class="btn grow" type="button" data-a="guess">${icon('target')}<span>Zahl tippen</span></button></div>
      <button class="btn small quiet" type="button" data-a="giveup">${icon('flag')}<span>Aufgeben</span></button>`;
    const input = c.querySelector('input');
    let lastTyping = 0;
    input.addEventListener('input', () => { if (Date.now() - lastTyping > 2000) { lastTyping = Date.now(); sendFx({ kind: 'typing', sid }); } });
    c.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (q.length < 3) { input.focus(); return; }
      sfx.send(); haptic(8);
      addEvent(sid, 'ask', { q: q.endsWith('?') ? q : q + '?' });
    });
    c.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'ideas') openIdeas();
      else if (a === 'guess') openGuess();
      else if (a === 'giveup') {
        const ok = await confirmBox({ title: 'Aufgeben?', text: 'Dann zählt die Runde als verloren – außer ihr gebt beide auf.', ok: 'Aufgeben', danger: true });
        if (ok) addEvent(sid, 'giveup', {});
      }
    });
    return c;
  }

  function renderLog() {
    const entries = st.log.slice().reverse();
    if (!remote) {
      const pip = (e) => `<i class="pip ${e.guess != null ? (e.ok ? 'richtig' : 'tipp') : e.a}" title="${esc(e.guess != null ? `Tipp ${e.guess}` : A_TXT[e.a])}"></i>`;
      const row = (q) => `<div class="tally ${q}"><span class="t-name">${esc(nameOf(q))}</span><span class="pips">${st.log.filter((e) => e.by === q).map(pip).join('') || '<span class="soft small">noch keine Frage</span>'}</span></div>`;
      el.log.innerHTML = `<div class="tallies">${row('jos')}${row('joh')}</div>`;
      return;
    }
    el.log.replaceChildren(logView(entries, { mine: p, empty: 'Noch keine Fragen – leg los!' }));
  }

  // ---------- Ende ----------
  function renderEnd() {
    el.turn.remove?.();
    el.box.querySelector('.grid-wrap')?.remove();
    el.box.querySelector('.my-secret')?.remove();
    el.main.replaceChildren();
    const w = st.winner;
    let title;
    if (st.aborted) title = 'Partie beendet';
    else if (w === 'draw') title = 'Unentschieden!';
    else title = remote ? (w === p ? 'Gewonnen!' : `${nameOf(w)} gewinnt!`) : `${nameOf(w)} gewinnt!`;
    const balls = h('div', { class: 'balls-end' });
    balls.innerHTML = ['jos', 'joh'].map((q) => `<div class="be"><span class="ball ${q}">${st.secrets[q] ?? '?'}</span><span>${esc(nameOf(q))}s Zahl</span></div>`).join('');
    const line = (q) => `${esc(nameOf(q))}: ${st.done[q]?.gaveUp ? 'aufgegeben' : `${st.counts[q]} ${st.counts[q] === 1 ? 'Frage' : 'Fragen'}`}`;
    const card = resultCard({
      winner: w, title, aborted: st.aborted, sad: remote && w !== p && w !== 'draw',
      lines: st.aborted ? [`${esc(nameOf(st.abortBy))} hat die Partie beendet.`] : [line('jos'), line('joh')],
      rematchLabel: 'Nochmal spielen',
      onRematch: () => { const id = createSession('number', mode, { first: other(st.first) }); nav('#/spiel/' + id, { replace: true }); },
    });
    el.main.append(balls, card);
    if (motionOK()) balls.querySelectorAll('.ball').forEach((b, i) => b.animate([{ transform: 'translateX(-120px) rotate(-360deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 900, delay: i * 200, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'backwards' }));
  }

  // ---------- Updates ----------
  async function update(prev, cur) {
    if (cur.phase === 'setup') { decideSetup(); return; }
    if (prev.phase === 'setup' && cur.phase === 'play') {
      if (!remote) {
        busy = true;
        await handoff({ to: cur.first, kicker: 'Alles bereit', title: `${nameOf(cur.first)} fragt zuerst`, text: 'Legt das Handy zwischen euch. Fragen stellt ihr laut.', button: 'Los geht’s' });
        busy = false;
      } else sfx.join();
      renderBoard();
      return;
    }
    if (view !== 'board') { renderBoard(); return; }
    // Neue Einträge: Antworten mit Karte → automatisch streichen; Tipps
    const added = cur.log.slice(prev.log.length);
    refresh();
    for (const e of added) {
      if (e.guess != null) {
        if (e.ok) {
          sfx.win(); haptic([20, 40, 60]);
          const c = centerOf(el.box);
          burst(c.x, c.y / 1.4, { count: 30, emoji: true });
          announce(`${nameOf(e.by)} hat die ${e.guess} gefunden!`);
          if (!remote || e.by === p) toast(`Richtig! Es ist die ${e.guess}.`, { key: 'game', icon: 'sparkle' });
        } else {
          sfx.bad();
          toast(`Nein, nicht die ${e.guess}.`, { key: 'game', icon: 'cross' });
        }
        continue;
      }
      if (e.a === 'ja') sfx.good(); else if (e.a === 'nein') sfx.bad(); else sfx.flip();
      const mine = remote ? e.by === p : true;
      let fresh = [], before = null;
      if (mine && e.card) {
        const b = getBoard(e.by);
        fresh = excludedBy(e.card, e.a).filter((n) => !b.has(n));
        if (fresh.length) {
          before = new Set(b);
          fresh.forEach((n) => b.add(n));
          saveBoard(e.by, b);
          if (boardOwner() === e.by) paintGrid(new Set(fresh));
          else animNext[e.by] = new Set(fresh);
        }
      }
      const struck = fresh.length ? ` ${fresh.length} ${fresh.length === 1 ? 'Zahl' : 'Zahlen'} gestrichen ✨` : '';
      if (!remote && lastAnswerEv) {
        const evId = lastAnswerEv;
        lastAnswerEv = null;
        toast(`${A_TXT[e.a]} – jetzt fragt ${nameOf(cur.turn)}.${struck}`, {
          icon: e.a === 'ja' ? 'check' : e.a === 'nein' ? 'cross' : 'maybe', ms: 4000,
          action: { label: 'Rückgängig', run: () => { if (before) saveBoard(e.by, before); delete animNext[e.by]; addEvent(sid, 'undo', { id: evId }); } },
        });
      } else if (fresh.length) {
        toast(struck.trim(), { key: 'game', icon: 'sparkle', ms: 4000, action: { label: 'Rückgängig', run: () => { saveBoard(e.by, before); if (view === 'board') paintGrid(); } } });
      }
      if (remote && e.by === p) announce(`${nameOf(other(p))} sagt: ${A_TXT[e.a]}`);
    }
    if (remote && cur.pending && !prev.pending && cur.pending.by !== p) { sfx.join(); haptic(15); }
    if (cur.turn !== prev.turn && cur.phase === 'play' && remote && cur.turn === p) toast('Du bist dran!', { key: 'game', icon: 'sparkle' });
    if (cur.phase === 'end' && prev.phase !== 'end') {
      if (!cur.aborted) setTimeout(() => finale(sid, { winner: cur.winner, iWon: cur.winner === p, couch: !remote }), 600);
      else if (cur.abortBy !== p) toast(`${nameOf(cur.abortBy)} hat die Partie beendet.`, { key: 'game', icon: 'flag' });
    }
  }

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

  if (st.phase === 'end') { markCelebrated(sid); renderBoard(); }
  else if (st.phase === 'setup') decideSetup();
  else renderBoard();

  return () => { shellOff(); offs.forEach((f) => f()); };
}
