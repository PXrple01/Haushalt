// Lobby: Begrüßung mit Maskottchen, Modus-Schalter (Nebeneinander / Weit weg), Verbindung, Spiele, Duell-Bilanz.
import { h, esc } from '../core/dom.js';
import { icon } from '../art/icons.js';
import { logo, miniHalf, fullHeart } from '../art/heart.js';
import { mascot, setMood } from '../art/mascots.js';
import { me, prefs, on } from '../core/store.js';
import { nameOf, other, pick, rint } from '../core/util.js';
import { currentTheme } from '../core/theme.js';
import { buildScene } from '../core/scene.js';
import { segmented, toast } from '../core/ui.js';
import { burst } from '../core/fx.js';
import { sfx, haptic } from '../core/sound.js';
import { nav } from '../core/router.js';
import { connect, netState, setWhere, reconnect } from '../core/net.js';
import { sendFx } from '../core/sync.js';
import { tally } from '../core/stats.js';
import { GAMES, gameTitle } from '../games/info.js';
import { openSettings } from './settings.js';
import { resumeList } from './resume.js';

const LINES = {
  kiki: ['Kicher! Ich glaub an dich, {n}!', 'Psst … ich verrate nichts!', 'Regenbogen-Power! 🌈', 'Noch eine Runde? Bitte, bitte!', 'Heute gewinnst du, {n}!', 'Ich hab Glitzer im Bauch ✨'],
  kuro: ['Miau. Bereit fürs Duell, {n}?', 'Ich hab nichts gesehen. Ehrlich.', 'Konzentration … ゴゴゴ', 'Heute ist dein Tag, {n}!', 'Noch eine Runde?', 'Nachts sind alle Katzen lila.'],
};

function greeting() {
  const hr = new Date().getHours();
  if (hr >= 5 && hr < 11) return 'Guten Morgen! Was spielen wir?';
  if (hr >= 11 && hr < 17) return 'Was spielen wir heute?';
  if (hr >= 17 && hr < 22) return 'Gemütlicher Spieleabend?';
  return 'Noch eine Runde vor dem Schlafen?';
}

export function mount(root) {
  const p = me.get();
  const partner = other(p);
  const theme = currentTheme();
  buildScene(theme);
  setWhere('lobby');
  connect();

  const s = h('section', { class: 'screen lobby stack' + (sessionStorage.getItem('kk-lobby-seen') ? '' : ' enter') });
  sessionStorage.setItem('kk-lobby-seen', '1');
  const mk = theme === 'lila' ? 'kuro' : 'kiki';
  const num = rint(1, 100);
  s.innerHTML = `
    <header class="lobby-top" style="--i:0">
      ${logo()}
      <button class="who-chip" type="button" data-a="who" aria-label="Person wechseln (jetzt: ${nameOf(p)})">${miniHalf(p)}<span>${nameOf(p)}</span></button>
      <button class="iconbtn" type="button" data-a="settings" aria-label="Einstellungen">${icon('gear')}</button>
    </header>
    <div class="hello" style="--i:1">
      <div class="hello-text"><h1>Hallo ${nameOf(p)}!</h1><p>${greeting()}</p></div>
      ${mascot(mk, 'idle')}
    </div>
    <div class="mode-box" style="--i:2">
      <div data-slot="seg"></div>
      <p class="mode-hint" data-slot="hint"></p>
      <div data-slot="link"></div>
    </div>
    <div data-slot="resume" style="--i:3"></div>
    <div class="toys" style="--i:3">
      <button class="toy hang" type="button" data-game="hangman">
        <svg class="t-art" viewBox="0 0 100 110" aria-hidden="true">
          <path d="M8 102 Q50 95 92 102"/><path d="M28 101 V10"/><path d="M28 10 H74"/><path d="M28 30 L47 10"/><path d="M74 10 V23"/>
          <circle cx="74" cy="33" r="10"/><path d="M74 43 V70"/><path d="M74 52 L62 63 M74 52 L86 63"/><path d="M74 70 L64 88 M74 70 L84 88"/>
        </svg>
        <span class="t-text"><span class="t-title">${GAMES.hangman.title}</span><span class="t-sub">${GAMES.hangman.sub}</span>
          <span class="t-blanks" aria-hidden="true"><i class="f"></i><i></i><i class="f"></i><i></i><i></i><i class="f"></i></span></span>
      </button>
      <button class="toy who" type="button" data-game="whoami">
        <svg class="t-art" viewBox="0 0 50 50" aria-hidden="true"><circle cx="25" cy="25" r="21" fill="none" stroke="currentColor" stroke-width="3" opacity=".6"/><text x="25" y="35" text-anchor="middle" font-family="Caveat" font-weight="700" font-size="30" fill="currentColor">?</text></svg>
        <span class="t-title">${GAMES.whoami.title}</span><span class="t-sub">Erratet, wer ihr seid.</span>
      </button>
      <button class="toy num" type="button" data-game="number">
        <span class="t-big" aria-hidden="true">${num}?</span>
        <span class="t-title">${GAMES.number.title}</span><span class="t-sub">Von 1 bis 100</span>
      </button>
    </div>
    <section class="panel score" style="--i:4" aria-label="Duell-Bilanz" data-slot="score"></section>`;
  root.append(s);

  // ---------- Modus ----------
  const seg = segmented({
    label: 'Spielmodus', cls: 'big', value: prefs.get('mode'),
    options: [{ value: 'couch', label: 'Nebeneinander', icon: 'sofa' }, { value: 'remote', label: 'Weit weg', icon: 'remote' }],
    onChange: (v) => { prefs.set('mode', v); renderMode(); },
  });
  s.querySelector('[data-slot="seg"]').append(seg);
  const hintEl = s.querySelector('[data-slot="hint"]');
  const linkEl = s.querySelector('[data-slot="link"]');

  function renderMode() {
    const remote = prefs.get('mode') === 'remote';
    hintEl.innerHTML = remote
      ? `${icon('remote')}<span>Jeder spielt am eigenen Handy – live verbunden.</span>`
      : `${icon('sofa')}<span>Ein Handy reicht. Fragen sagt ihr euch einfach laut.</span>`;
    renderLink();
  }

  function renderLink() {
    if (prefs.get('mode') !== 'remote') { linkEl.replaceChildren(); return; }
    const code = prefs.get('code');
    const n = netState();
    const box = h('div', { class: 'panel link-card' });
    if (!code) {
      box.innerHTML = `
        <label class="label" for="kk-code">Euer gemeinsamer Code</label>
        <div class="row"><input id="kk-code" class="field grow" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="40" placeholder="z. B. einhorn42">
        <button class="btn primary" type="button" data-a="code">${icon('link')}<span>Verbinden</span></button></div>
        <p class="hint">Gebt auf beiden Handys denselben Code ein – ein Wort, das nur ihr kennt.</p>`;
    } else {
      let dot = 'wait', text = 'Verbinde …', sub = '';
      if (n.status === 'online' && n.partner) {
        dot = 'on'; text = `${nameOf(partner)} ist online`;
        sub = n.partner.at?.startsWith('spiel:') ? `spielt gerade ${esc(gameTitle(n.partner.at.split(':')[2]))}` : 'ist in der Lobby';
      } else if (n.status === 'online') {
        text = `Warte auf ${nameOf(partner)} …`;
        sub = `Auf ${nameOf(partner)}s Handy die Kicherkiste öffnen und „Weit weg“ wählen.`;
      } else if (n.status === 'offline') { dot = 'off'; text = 'Kein Internet'; sub = 'Sobald das Netz zurück ist, verbinde ich neu.'; }
      else if (n.status === 'error') { dot = 'off'; text = 'Verbindung klappt gerade nicht'; sub = 'Prüft das Internet und versucht es nochmal.'; }
      box.innerHTML = `
        <div class="link-row"><span class="dot ${dot}"></span><span class="grow">${text}${sub ? `<small>${sub}</small>` : ''}</span>
          ${n.status === 'error' || n.status === 'offline' ? `<button class="btn small" type="button" data-a="retry">${icon('refresh')}<span>Nochmal</span></button>` : ''}
          ${n.status === 'online' && n.partner ? `<button class="btn small" type="button" data-a="poke" aria-label="${nameOf(partner)} anstupsen">${icon('poke')}<span>Anstupsen</span></button>` : ''}
        </div>
        ${n.dupe ? `<p class="note">${icon('info')}<span>Auf dem anderen Handy ist auch ${nameOf(p)} gewählt. Einer von euch tippt oben auf den Namen und wechselt.</span></p>` : ''}`;
    }
    linkEl.replaceChildren(box);
  }

  // ---------- Bilanz ----------
  const scoreEl = s.querySelector('[data-slot="score"]');
  function renderScore() {
    const t = tally();
    const total = t.jos + t.joh + t.draw;
    const per = Object.entries(t.games).map(([g, v]) => `<span>${esc(gameTitle(g))} ${v.jos}:${v.joh}</span>`).join('');
    scoreEl.innerHTML = `
      <div class="score-main">
        <div class="score-side jos"><b class="tnum">${t.jos}</b><span>${esc(nameOf('jos'))}</span></div>
        <div class="hrt">${fullHeart()}</div>
        <div class="score-side joh"><b class="tnum">${t.joh}</b><span>${esc(nameOf('joh'))}</span></div>
      </div>
      ${total ? `<div class="score-games">${per}${t.draw ? `<span>Unentschieden ${t.draw}</span>` : ''}</div>` : '<p class="score-empty">Noch keine Runde gespielt. Wer holt sich den ersten Punkt?</p>'}`;
  }

  // ---------- Laufende Partien ----------
  const resumeEl = s.querySelector('[data-slot="resume"]');
  const renderResume = () => resumeEl.replaceChildren(...resumeList());

  renderMode();
  renderScore();
  renderResume();

  // ---------- Aktionen ----------
  const masc = s.querySelector('.hello .masc');
  let bubbleT;
  masc.addEventListener('click', () => {
    const r = masc.getBoundingClientRect();
    setMood(masc, 'cheer', 1400);
    burst(r.left + r.width / 2, r.top + r.height * .3, { count: 16, emoji: true });
    sfx.sparkle(); haptic(10);
    s.querySelector('.hello .bubble')?.remove();
    const b = h('div', { class: 'bubble', role: 'status' }, pick(LINES[mk]).replace('{n}', nameOf(p)));
    s.querySelector('.hello').append(b);
    clearTimeout(bubbleT);
    bubbleT = setTimeout(() => b.remove(), 2600);
  });

  s.addEventListener('click', (e) => {
    const g = e.target.closest('[data-game]');
    if (g) {
      sfx.pop(); haptic(10);
      if (prefs.get('mode') === 'remote' && !prefs.get('code')) {
        toast('Gebt zuerst euren gemeinsamen Code ein.', { icon: 'link' });
        s.querySelector('#kk-code')?.focus();
        return;
      }
      nav('#/neu/' + g.dataset.game);
      return;
    }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'who') nav('#/wer');
    else if (a === 'settings') openSettings();
    else if (a === 'retry') reconnect();
    else if (a === 'poke') {
      if (sendFx({ kind: 'poke' })) { toast(`Du hast ${nameOf(partner)} angestupst.`, { icon: 'poke' }); haptic(15); setMood(masc, 'happy', 1200); }
    } else if (a === 'code') saveCode();
  });
  s.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'kk-code') saveCode(); });
  function saveCode() {
    const v = (s.querySelector('#kk-code')?.value || '').trim();
    if (v.length < 4) { toast('Der Code braucht mindestens 4 Zeichen.', { icon: 'info' }); return; }
    prefs.set('code', v);
    sfx.good();
    renderLink();
  }

  const offs = [
    on('net', renderLink),
    on('stats', renderScore),
    on('session', renderResume),
    on('prefs', ({ k }) => {
      if (k === 'code' || k === 'mode') { seg.setValue(prefs.get('mode')); renderMode(); }
      if (k === 'nicks') nav('#/lobby', { replace: true, vt: false });
    }),
  ];
  return () => { offs.forEach((f) => f()); clearTimeout(bubbleT); };
}
