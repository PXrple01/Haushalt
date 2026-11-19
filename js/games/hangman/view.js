// Galgenmännchen – Oberfläche: Einstellungen, Wort verstecken, Raten mit gezeichnetem Galgen.
import { h, esc, centerOf } from '../../core/dom.js';
import { icon } from '../../art/icons.js';
import { me, on } from '../../core/store.js';
import { nameOf, other, cleanWord, LETTERS } from '../../core/util.js';
import { handoff, sheet, toast, announce } from '../../core/ui.js';
import { motionOK, currentTheme } from '../../core/theme.js';
import { burst, trail, shake } from '../../core/fx.js';
import { sfx, haptic } from '../../core/sound.js';
import { nav } from '../../core/router.js';
import { createSession, addEvent, getSession } from '../../core/sync.js';
import { netState } from '../../core/net.js';
import { reduce, LEVELS, PARTS, partsShown, isLetter, enc } from './logic.js';
import { WORD_CATS, WORD_LEVELS, wordItems } from '../../data/words.js';
import { shell, whoSeg, radioCards, secretPicker, resultCard, finale, markCelebrated, reactionBar, onReactions, peekButton, waitCard, youOr } from '../common.js';

const RULES = [
  'Eine Person versteckt ein Wort, die andere rät Buchstabe für Buchstabe.',
  'Jeder falsche Buchstabe zeichnet ein Stück vom Galgenmännchen.',
  'Wird das Wort erraten, gewinnt die ratende Person. Ist das Männchen fertig, gewinnt, wer das Wort versteckt hat.',
  '„Ganzes Wort lösen“ rät alles auf einmal – ein falscher Versuch zählt als Fehler.',
  'Ä, Ö, Ü und ß sind eigene Buchstaben.',
];

// Teile des Galgens in Zeichen-Reihenfolge (viewBox 0 0 200 210)
const PART_D = [
  'M14 198 Q100 186 186 198',          // Hügel
  'M50 196 L50 20',                    // Pfahl
  'M40 22 L150 22',                    // Balken
  'M50 62 L90 22',                     // Stütze
  'M138 22 L138 46',                   // Seil
  'M138 46 a16 16 0 1 1 -0.01 0',      // Kopf
  'M138 78 L138 130',                  // Körper
  'M138 94 L114 117',                  // Arm links
  'M138 94 L162 117',                  // Arm rechts
  'M138 130 L119 167',                 // Bein links
  'M138 130 L157 167',                 // Bein rechts
];
const FIG_FROM = 5; // ab Teil 6 gehört alles zur Figur

function gallowsSVG(shown, cls = '') {
  const part = (d, i) => `<path class="part${i < shown ? ' on' : ''}" data-i="${i}" d="${d}" pathLength="1"/>`;
  return `<svg class="gallows ${cls}" viewBox="0 0 200 210" role="img" aria-label="Galgen">
    <g class="ghost" aria-hidden="true">${PART_D.map((d) => `<path d="${d}"/>`).join('')}</g>
    <g class="scaf">${PART_D.slice(0, FIG_FROM).map(part).join('')}</g>
    <g class="fig">${PART_D.slice(FIG_FROM).map((d, i) => part(d, i + FIG_FROM)).join('')}
      <g class="face">
        <g class="f f-ok"><circle cx="132.5" cy="59" r="2.2"/><circle cx="143.5" cy="59" r="2.2"/><path d="M132 67 Q138 71.5 144 67"/></g>
        <g class="f f-worry"><circle cx="132.5" cy="59.5" r="2.2"/><circle cx="143.5" cy="59.5" r="2.2"/><path d="M132.5 69 L143.5 68"/><path d="M129 54.5 l6 1.6 M147 54.5 l-6 1.6"/></g>
        <g class="f f-scared"><circle cx="132.5" cy="59" r="3.4"/><circle cx="143.5" cy="59" r="3.4"/><ellipse cx="138" cy="70" rx="2.6" ry="3.2"/><path class="sweat" d="M152 52 q3 5 0 7.5 q-3 -2.5 0 -7.5z"/></g>
        <g class="f f-dead"><path d="M129.5 55.5 l6 6 m0 -6 l-6 6 M140.5 55.5 l6 6 m0 -6 l-6 6"/><path d="M131.5 70 q3.25 -3 6.5 0 t6.5 0"/></g>
        <g class="f f-happy"><path d="M129.5 60.5 q3 -4.5 6 0 M140.5 60.5 q3 -4.5 6 0"/><path d="M131 65.5 Q138 74 145 65.5"/></g>
        <g class="f-blush"><ellipse cx="127.5" cy="66" rx="3.4" ry="2"/><ellipse cx="148.5" cy="66" rx="3.4" ry="2"/></g>
      </g>
    </g>
    <circle class="pen" r="3.6" cx="0" cy="0"/>
  </svg>`;
}

// Kleiner Galgen für die Schwierigkeits-Karten (vorgezeichnete Teile kräftig, Rest gestrichelt)
const miniGallows = (pre) => `<svg class="mini-gal" viewBox="0 0 200 210" aria-hidden="true">${PART_D.map((d, i) => `<path class="${i < pre ? 'pre' : 'todo'}" d="${d}"/>`).join('')}</svg>`;

// ======================================================================
// Einstellungen
// ======================================================================
export function setup(root) {
  const p = me.get();
  const { body, mode, cleanup } = shell({ root, game: 'hangman', rules: RULES });
  let setter = p, lives = 11;
  body.innerHTML = `
    <div class="setup stack">
      <section class="setup-sec stack"><h2 class="setup-h">Wer versteckt das Wort?</h2><div data-slot="who"></div><p class="hint" data-slot="who-hint"></p></section>
      <section class="setup-sec stack"><h2 class="setup-h">Wie viele Fehler sind erlaubt?</h2><div data-slot="lives"></div></section>
      <div data-slot="note"></div>
      <button class="btn primary big block" type="button" data-a="start">${icon('sparkle')}<span>Los geht’s</span></button>
    </div>`;
  const whoHint = body.querySelector('[data-slot="who-hint"]');
  const renderHint = () => {
    const g = other(setter);
    whoHint.textContent = mode === 'remote'
      ? (setter === p ? `Du versteckst das Wort auf deinem Handy, ${nameOf(g)} rät auf ${g === 'jos' ? 'ihrem' : 'seinem'}.` : `${nameOf(setter)} versteckt das Wort, du rätst.`)
      : `${nameOf(g)} rät – bis dahin nicht hinschauen!`;
  };
  body.querySelector('[data-slot="who"]').append(whoSeg({ label: 'Wer versteckt das Wort?', value: setter, onChange: (v) => { setter = v; renderHint(); } }));
  body.querySelector('[data-slot="lives"]').append(radioCards({
    label: 'Fehler', value: lives,
    options: LEVELS.map((l) => ({ value: l.lives, title: l.label, sub: `${l.lives} Fehler – ${l.lives === 11 ? 'der Galgen wird mitgebaut' : l.lives === 8 ? 'das Gerüst steht schon' : 'nur noch die Figur'}`, art: miniGallows(PARTS - l.lives) })),
    onChange: (v) => { lives = v; },
  }));
  renderHint();
  if (mode === 'remote') {
    const n = netState();
    if (!(n.status === 'online' && n.partner)) {
      body.querySelector('[data-slot="note"]').innerHTML = `<p class="note">${icon('info')}<span>${nameOf(other(p))} ist gerade nicht online. Die Einladung kommt an, sobald ${other(p) === 'jos' ? 'sie' : 'er'} die Kicherkiste öffnet.</span></p>`;
    }
  }
  body.querySelector('[data-a="start"]').addEventListener('click', () => {
    sfx.pop(); haptic(12);
    const id = createSession('hangman', mode, { setter, lives });
    nav('#/spiel/' + id, { replace: true });
  });
  return cleanup;
}

// ======================================================================
// Partie
// ======================================================================
export function play(root, sid) {
  const p = me.get();
  const { el, body, mode, cleanup: shellOff } = shell({ root, game: 'hangman', sid, rules: RULES });
  const remote = mode === 'remote';
  const compute = () => { const s = getSession(sid); return reduce(s.meta, s.evs); };
  let st = compute();
  let view = '';
  let busy = false;          // Übergabe-Bildschirm offen
  let board = null;          // Elemente des Spielbretts
  const offs = [];

  const iGuess = () => !remote || st.guesser === p;
  const iSet = () => !remote || st.setter === p;

  // ---------- Wort verstecken ----------
  function renderWord() {
    view = 'word';
    const g = st.guesser;
    const box = h('div', { class: 'hm-word stack' });
    box.innerHTML = `<div class="phase-head"><h2>${remote ? 'Denk dir ein Wort aus' : `${esc(nameOf(st.setter))}, denk dir ein Wort aus`}</h2>
      <p class="soft">${esc(nameOf(g))} rät es gleich. Ein Wort oder ein kurzer Satz, bis 30 Zeichen.</p></div>`;
    const hintField = h('div', { class: 'stack hm-hint', style: { '--gap': '6px' } });
    hintField.innerHTML = `<label class="label" for="hm-hint">Hinweis für ${esc(nameOf(g))} <span class="soft">(optional)</span></label>
      <input id="hm-hint" class="field" maxlength="40" autocomplete="off" placeholder="z. B. Tier, Essen, etwas von uns …">`;
    const hintInput = hintField.querySelector('input');
    let hintTouched = false;
    hintInput.addEventListener('input', () => { hintTouched = true; });
    const picker = secretPicker({
      ownLabel: 'Eigenes Wort', placeholder: 'Dein Wort', maxLength: 30,
      pool: { cats: WORD_CATS, levels: WORD_LEVELS, items: (c, l) => wordItems(c, l).map((w) => ({ text: w.text, cat: w.cat })), rerollLabel: 'Anderes Wort' },
      validate: (v) => {
        const c = cleanWord(v);
        if (c.bad.length) return { ok: false, msg: `Nur Buchstaben, Leerzeichen und Bindestrich – nicht: ${c.bad.join(' ')}` };
        if (c.letters < 2) return { ok: false, msg: 'Mindestens 2 Buchstaben.' };
        return { ok: true, msg: `${c.letters} Buchstaben` };
      },
      preview: (v, elp) => { elp.innerHTML = tilesHTML(cleanWord(v).word, { blank: true, small: true }); },
      extra: hintField,
      poolNote: 'Die Kategorie wird als Hinweis vorgeschlagen.',
    });
    picker.addEventListener('change', () => {
      const v = picker.value();
      if (!hintTouched) hintInput.value = v.source === 'pool' ? v.cat : '';
    });
    picker.dispatchEvent(new Event('change'));
    const go = h('button', { class: 'btn primary big block', type: 'button' });
    go.innerHTML = `${icon('lock')}<span>Wort verstecken</span>`;
    go.addEventListener('click', () => {
      const v = picker.value();
      if (!v.ok) { toast(v.msg || 'Bitte ein Wort wählen.', { icon: 'info' }); picker.focusOwn?.(); return; }
      const word = cleanWord(v.text).word;
      sfx.pop(); haptic(14);
      addEvent(sid, 'word', { w: enc(word, sid), hint: hintInput.value.trim(), cat: v.cat || '' });
    });
    box.append(picker, go);
    body.replaceChildren(box);
  }

  function renderWait(title, sub) {
    view = 'wait';
    body.replaceChildren(waitCard(title, sub));
  }

  // ---------- Spielbrett ----------
  function renderBoard() {
    view = 'board';
    const shown = partsShown(st);
    const box = h('div', { class: 'hm-board' });
    const hint = st.hint ? `<span class="hm-hint-chip">${icon('bulb')}<span>${esc(st.hint)}</span></span>` : '';
    box.innerHTML = `
      <div class="hm-stage">
        ${gallowsSVG(shown, shown > FIG_FROM + 1 ? 'swing' : '')}
        <div class="hm-lives" aria-live="off"></div>
      </div>
      <div class="hm-play">
        <div class="hm-meta">${hint}<span class="hm-role">${esc(remote ? (st.guesser === p ? `Wort von ${nameOf(st.setter)}` : `${nameOf(st.guesser)} rät dein Wort`) : `${nameOf(st.guesser)} rät`)}</span></div>
        <div class="tiles" aria-live="polite"></div>
        <div class="hm-bottom"></div>
      </div>`;
    body.replaceChildren(box);
    board = {
      box, svg: box.querySelector('.gallows'), lives: box.querySelector('.hm-lives'),
      tiles: box.querySelector('.tiles'), bottom: box.querySelector('.hm-bottom'),
    };
    board.pen = board.svg.querySelector('.pen');
    renderLives(false);
    renderTiles();
    setFace();
    renderBottom();
    fitTiles();
  }

  function renderLives() {
    const left = Math.max(0, st.lives - st.misses);
    const lila = currentTheme() === 'lila';
    const ico = lila ? 'star' : 'heart';
    board.lives.setAttribute('aria-label', `Noch ${left} von ${st.lives} Versuchen`);
    board.lives.innerHTML = Array.from({ length: st.lives }, (_, i) =>
      `<span class="life${i >= left ? ' lost' : ''}">${icon(ico, 'fill')}</span>`).join('');
  }

  function tilesHTML(word, { blank = false, small = false, reveal = false } = {}) {
    const words = word.split(' ');
    const max = Math.max(1, ...words.map((w) => w.length));
    let i = 0;
    return `<div class="tiles-in${small ? ' small' : ''}" style="--n:${max}">${words.map((w) => `<span class="w">${[...w].map((c) => {
      const idx = i++;
      if (!isLetter(c)) return `<span class="tile sep">${esc(c)}</span>`;
      const on = !blank && (st.guessed.includes(c) || reveal);
      return `<span class="tile${on ? ' on' : ''}" data-i="${idx}" data-l="${esc(c)}"><span class="tile-in"><span class="t-front"></span><span class="t-back">${esc(c)}</span></span></span>`;
    }).join('')}</span>`).join('<span class="w-gap"></span>')}</div>`;
  }

  function renderTiles() {
    board.tiles.innerHTML = tilesHTML(st.word);
    if (st.phase === 'end' && st.status === 'lost') revealRest(false);
    updateTilesLabel();
  }
  function updateTilesLabel() {
    const shownWord = [...st.word].map((c) => (!isLetter(c) ? (c === ' ' ? ' / ' : c) : st.guessed.includes(c) || st.phase === 'end' ? c : '_')).join(' ');
    board.tiles.setAttribute('aria-label', `Wort: ${shownWord}`);
  }
  function fitTiles() {
    const inner = board?.tiles.querySelector('.tiles-in');
    if (!inner) return;
    const n = +inner.style.getPropertyValue('--n') || 6;
    const w = board.tiles.clientWidth || 320;
    const size = Math.max(22, Math.min(46, Math.floor((w - (n - 1) * 6) / n)));
    inner.style.setProperty('--t', size + 'px');
  }

  function setFace() {
    const svg = board.svg;
    const left = st.lives - st.misses;
    const mood = st.phase === 'end' ? (st.status === 'won' ? 'happy' : 'dead') : left <= 1 ? 'scared' : left <= 3 ? 'worry' : 'ok';
    svg.dataset.face = mood;
    svg.classList.toggle('has-head', partsShown(st) > FIG_FROM);
  }

  function renderBottom() {
    const b = board.bottom;
    if (st.phase === 'end') { renderResult(); return; }
    if (iGuess()) {
      const kb = h('div', { class: 'kb', role: 'group', 'aria-label': 'Buchstaben raten' });
      const rows = ['QWERTZUIOPÜ', 'ASDFGHJKLÖÄ', 'YXCVBNMß'];
      kb.innerHTML = rows.map((r) => `<div class="kb-row">${[...r].map((l) => {
        const cls = st.guessed.includes(l) ? (st.word.includes(l) ? ' hit' : ' miss') : '';
        return `<button class="key${cls}" type="button" data-l="${l}" aria-label="${l}"${cls ? ' aria-disabled="true"' : ''}>${l}</button>`;
      }).join('')}</div>`).join('');
      kb.addEventListener('click', (e) => { const k = e.target.closest('.key'); if (k) guess(k.dataset.l); });
      const solve = h('button', { class: 'btn block hm-solve', type: 'button' });
      solve.innerHTML = `${icon('wand')}<span>Ganzes Wort lösen</span>`;
      solve.addEventListener('click', openSolve);
      b.replaceChildren(kb, solve);
    } else {
      // Fern-Modus, Wortgeber schaut zu
      const watch = h('div', { class: 'hm-watch stack' });
      watch.innerHTML = `<p class="soft center">${esc(nameOf(st.guesser))} rät gerade. Schick ${st.guesser === 'jos' ? 'ihr' : 'ihm'} eine Reaktion:</p>`;
      watch.append(reactionBar(sid));
      const row = h('div', { class: 'row center' });
      row.append(peekButton({ label: 'Mein Wort ansehen', reveal: () => st.word }));
      watch.append(row);
      b.replaceChildren(watch);
    }
  }

  function renderResult() {
    const won = st.status === 'won';
    let title, lines, sad = false;
    if (st.aborted) { title = 'Partie beendet'; lines = [`${esc(nameOf(st.abortBy))} hat die Partie beendet.`]; }
    else if (won) {
      title = remote && st.guesser === p ? 'Geschafft!' : `${nameOf(st.guesser)} hat es erraten!`;
      sad = remote && st.setter === p;
      lines = [st.misses ? `Mit ${st.misses} ${st.misses === 1 ? 'Fehler' : 'Fehlern'} gelöst.` : 'Ganz ohne Fehler – Wahnsinn!', `${esc(nameOf(st.guesser))} holt sich den Punkt.`];
    } else {
      title = !remote ? `${nameOf(st.setter)} gewinnt!` : st.setter === p ? 'Gewonnen!' : 'Oh nein!';
      sad = remote && st.guesser === p;
      lines = [`Das Wort war <b>${esc(st.word)}</b>.`, `${esc(nameOf(st.setter))} holt sich den Punkt.`];
    }
    if (!st.aborted) lines.push(`<small>Bei der Revanche versteckt ${esc(nameOf(st.guesser))} das Wort.</small>`);
    const card = resultCard({
      winner: st.winner, title, lines, aborted: st.aborted, sad,
      rematchLabel: 'Revanche',
      onRematch: () => {
        const id = createSession('hangman', mode, { setter: st.guesser, lives: st.lives });
        nav('#/spiel/' + id, { replace: true });
      },
    });
    board.bottom.replaceChildren(card);
    if (motionOK()) card.animate([{ transform: 'translateY(40px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  }

  // ---------- Aktionen ----------
  function guess(l) {
    if (st.phase !== 'play' || !iGuess() || busy || st.guessed.includes(l)) return;
    addEvent(sid, 'guess', { l });
  }
  function openSolve() {
    const f = h('div', { class: 'stack' });
    f.innerHTML = `<input class="field big center" maxlength="30" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Das Wort …" aria-label="Lösungswort">
      <p class="hint">Achtung: Ein falscher Versuch zählt als Fehler.</p>`;
    const inp = f.querySelector('input');
    const go = h('button', { class: 'btn primary big block', type: 'button' });
    go.innerHTML = `${icon('check')}<span>Lösen</span>`;
    f.append(go);
    const sh = sheet({ title: 'Ganzes Wort lösen', body: f });
    setTimeout(() => inp.focus(), 80);
    const submit = () => {
      const c = cleanWord(inp.value);
      if (c.letters < 1) { inp.focus(); return; }
      sh.close(true);
      addEvent(sid, 'solve', { w: c.word });
    };
    go.addEventListener('click', submit);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  }
  const onKey = (e) => {
    if (view !== 'board' || st.phase !== 'play' || !iGuess() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('.sheet-wrap, .dialog-wrap, .handoff')) return;
    const k = e.key.length === 1 ? (e.key === 'ß' ? 'ß' : e.key.toUpperCase()) : '';
    if (LETTERS.includes(k)) { e.preventDefault(); guess(k); }
  };
  document.addEventListener('keydown', onKey);

  // ---------- Animationen bei neuen Ereignissen ----------
  async function drawPart(i) {
    const path = board.svg.querySelector(`.part[data-i="${i}"]`);
    if (!path || path.classList.contains('on')) return;
    if (!motionOK()) { path.classList.add('on'); return; }
    const len = path.getTotalLength();
    const dur = Math.max(360, Math.min(700, len * 4));
    const pen = board.pen;
    const lila = currentTheme() === 'lila';
    sfx.draw();
    path.classList.add('drawing');
    await new Promise((resolve) => {
      const t0 = performance.now();
      let frame = 0;
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        const e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        path.style.strokeDashoffset = String(1 - e);
        const pt = path.getPointAtLength(e * len);
        pen.setAttribute('cx', pt.x); pen.setAttribute('cy', pt.y);
        pen.style.opacity = k < 1 ? '1' : '0';
        if (frame++ % 3 === 0) {
          const m = board.svg.getScreenCTM();
          if (m) trail(m.a * pt.x + m.e, m.d * pt.y + m.f, { count: 1, size: [4, 8], shapes: ['sparkle'], colors: lila ? ['#47E5FF', '#D19BFF', '#fff'] : ['#FF8CC6', '#FFE58F', '#fff'], glow: lila });
        }
        if (k < 1) requestAnimationFrame(tick);
        else { path.classList.remove('drawing'); path.classList.add('on'); path.style.strokeDashoffset = ''; resolve(); }
      };
      requestAnimationFrame(tick);
    });
  }

  function flipTiles(letter) {
    const tiles = [...board.tiles.querySelectorAll(`.tile[data-l="${CSS.escape(letter)}"]`)];
    tiles.forEach((t, j) => {
      setTimeout(() => {
        t.classList.add('on');
        if (motionOK()) {
          const c = centerOf(t);
          burst(c.x, c.y, { count: 7, speed: [60, 180], size: [5, 10], gravity: 200, shapes: ['sparkle', 'star'] });
        }
      }, j * 110);
    });
    return tiles.length;
  }

  function revealRest(animate = true) {
    const tiles = [...board.tiles.querySelectorAll('.tile:not(.on):not(.sep)')];
    tiles.forEach((t, j) => {
      const go = () => { t.classList.add('on', 'missed'); };
      if (animate && motionOK()) setTimeout(go, 500 + j * 90); else go();
    });
  }

  function breakLife() {
    const left = Math.max(0, st.lives - st.misses);
    const lifeEls = [...board.lives.querySelectorAll('.life')];
    lifeEls.forEach((l, i) => {
      const shouldLose = i >= left;
      if (shouldLose && !l.classList.contains('lost')) {
        if (motionOK()) {
          const c = centerOf(l);
          l.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.6) rotate(-14deg)', offset: .35 }, { transform: 'scale(.9) rotate(8deg)' }], { duration: 420, easing: 'ease-out' });
          burst(c.x, c.y, { count: 6, speed: [80, 200], size: [4, 8], gravity: 600, shapes: currentTheme() === 'lila' ? ['star'] : ['heart'], colors: currentTheme() === 'lila' ? ['#FFD36E', '#fff'] : ['#FF5FA8', '#FFB3D9'] });
          setTimeout(() => l.classList.add('lost'), 260);
        } else l.classList.add('lost');
      }
    });
    board.lives.setAttribute('aria-label', `Noch ${left} von ${st.lives} Versuchen`);
  }

  async function update(prev, cur) {
    // Phasenwechsel
    if (cur.phase === 'setup') {
      if (remote && cur.setter !== p) { if (view !== 'wait') renderWait(`${nameOf(cur.setter)} versteckt gerade ein Wort`, 'Gleich geht’s los. Nicht schummeln! 🤫'); }
      else if (view !== 'word') renderWord();
      return;
    }
    if (prev.phase === 'setup' && cur.phase !== 'setup') {
      if (!remote) {
        busy = true;
        await handoff({ to: cur.guesser, title: `Gib das Handy an ${nameOf(cur.guesser)}`, text: `Das Wort ist versteckt. ${nameOf(cur.guesser)} rät jetzt.`, kicker: 'Wort ist versteckt' });
        busy = false;
      } else if (cur.setter === p) {
        toast(`Dein Wort ist versteckt. ${nameOf(cur.guesser)} kann loslegen!`, { icon: 'lock' });
      } else {
        sfx.join();
      }
      renderBoard();
      return;
    }
    if (view !== 'board' || !board) { renderBoard(); return; }

    // Neue Buchstaben
    const newOnes = cur.guessed.filter((l) => !prev.guessed.includes(l));
    for (const l of newOnes) {
      const key = board.bottom.querySelector(`.key[data-l="${CSS.escape(l)}"]`);
      const hit = cur.word.includes(l);
      if (key) {
        key.classList.add(hit ? 'hit' : 'miss');
        key.setAttribute('aria-disabled', 'true');
        if (motionOK()) key.animate(hit ? [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }] : [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 320, easing: 'ease-out' });
      }
      if (hit) {
        const n = flipTiles(l);
        sfx.good(); haptic(10);
        announce(`${l} ist richtig${n > 1 ? ` – ${n} mal` : ''}.`);
      } else {
        sfx.bad(); haptic([20, 30, 20]);
        shake(board.tiles, 5);
        announce(`${l} ist falsch. Noch ${cur.lives - cur.misses} Versuche.`);
      }
    }
    // Falscher Lösungsversuch
    if (cur.solves.length > prev.solves.length) {
      const last = cur.solves.at(-1);
      if (!last.ok) {
        sfx.bad(); haptic([20, 30, 20]); shake(board.tiles, 7);
        toast(`„${last.w}“ war es leider nicht.`, { icon: 'cross' });
      }
    }
    // Teile nachzeichnen
    const before = partsShown(prev), now = partsShown(cur);
    if (now > before) {
      breakLife();
      sfx.crack();
      for (let i = before; i < now; i++) await drawPart(i);
      if (now > FIG_FROM + 1) board.svg.classList.add('swing');
    }
    setFace();
    updateTilesLabel();

    // Ende
    if (cur.phase === 'end' && prev.phase !== 'end') {
      if (cur.status === 'won') {
        board.tiles.querySelectorAll('.tile:not(.sep)').forEach((t) => t.classList.add('on'));
        if (motionOK()) board.tiles.querySelectorAll('.tile').forEach((t, i) => t.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-14px)' }, { transform: 'translateY(0)' }], { duration: 520, delay: 400 + i * 60, easing: 'cubic-bezier(.34,1.56,.64,1)' }));
        board.svg.classList.remove('swing');
        board.svg.classList.add('free');
      } else if (cur.status === 'lost') {
        revealRest(true);
      }
      setTimeout(() => {
        if (!cur.aborted) finale(sid, { winner: cur.winner, iWon: cur.winner === p, couch: !remote });
        renderResult();
      }, cur.aborted ? 0 : 900);
      if (cur.aborted && cur.abortBy !== p) toast(`${nameOf(cur.abortBy)} hat die Partie beendet.`, { icon: 'flag' });
    }
  }

  // ---------- Start ----------
  async function start() {
    if (st.phase === 'end') { markCelebrated(sid); renderBoard(); return; }
    if (st.phase === 'setup') {
      if (remote && st.setter !== p) { renderWait(`${nameOf(st.setter)} versteckt gerade ein Wort`, 'Gleich geht’s los. Nicht schummeln! 🤫'); return; }
      if (!remote) {
        busy = true;
        body.replaceChildren(waitCard('Einen Moment …'));
        await handoff({ to: st.setter, title: `${nameOf(st.setter)} versteckt ein Wort`, text: `${nameOf(st.guesser)}, nicht hinschauen!`, kicker: 'Galgenmännchen', button: `Ich bin ${nameOf(st.setter)} – los!` });
        busy = false;
        st = compute();
        shown = st;
        if (st.phase !== 'setup') { renderBoard(); return; }
      }
      renderWord();
      return;
    }
    renderBoard();
  }

  // Updates nacheinander abarbeiten; verglichen wird immer mit dem zuletzt angezeigten Stand
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
  offs.push(on('session', (d) => {
    if (d.id !== sid) return;
    st = compute();
    schedule();
  }));
  start();
  offs.push(onReactions(sid, (d) => { if (d.kind === 'react') sfx.pop(); }));
  const onResize = () => fitTiles();
  window.addEventListener('resize', onResize);

  return () => {
    shellOff();
    offs.forEach((f) => f());
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
  };
}
