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
  let mk = theme === 'lila' ? 'kuro' : 'kiki';
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
    <button class="toy escape" type="button" data-game="escape" style="--i:3">
      <span class="t-text">
        <span class="t-badge">Neu – zu zweit mit zwei Handys</span>
        <span class="t-title">${GAMES.escape.title}</span>
        <span class="t-sub">7 Geschichten. Befreit euch gemeinsam – jeder sieht etwas anderes.</span>
      </span>
      <svg class="t-art door" viewBox="0 0 120 150" aria-hidden="true">
        <defs><radialGradient id="kh-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="var(--door-glow)"/><stop offset="1" stop-color="var(--door-glow)" stop-opacity="0"/></radialGradient></defs>
        <path class="d-frame" d="M8 150 V62 A52 52 0 0 1 112 62 V150 Z"/>
        <path class="d-door" d="M18 150 V64 A42 42 0 0 1 102 64 V150 Z"/>
        <path class="d-line" d="M60 22 V150 M30 84 H50 M70 84 H90 M30 120 H50 M70 120 H90"/>
        <circle class="d-glowc" cx="60" cy="100" r="34" fill="url(#kh-glow)"/>
        <path class="d-hole" d="M60 90 a8 8 0 0 1 4.5 14.6 L67 118 H53 l2.5 -13.4 A8 8 0 0 1 60 90 z"/>
        <path class="d-spark s1" d="M100 18 l2.4 -7 2.4 7 7 2.4 -7 2.4 -2.4 7 -2.4 -7 -7 -2.4 z"/>
        <path class="d-spark s2" d="M14 36 l1.8 -5 1.8 5 5 1.8 -5 1.8 -1.8 5 -1.8 -5 -5 -1.8 z"/>
      </svg>
    </button>
    <button class="toy krimi" type="button" data-game="krimi" style="--i:3">
      <span class="t-text">
        <span class="t-badge">Neu – zwei Fälle für zwei Handys</span>
        <span class="t-title">${GAMES.krimi.title}</span>
        <span class="t-sub">»Blutnacht im Hotel Edelweiß« und »Seid ihr alle da?«. Schwer, blutig, ab 16.</span>
      </span>
      <svg class="t-art lens" viewBox="0 0 120 130" aria-hidden="true">
        <g class="k-drops"><circle cx="30" cy="102" r="7"/><circle cx="46" cy="114" r="3.4"/><circle cx="18" cy="118" r="2.6"/><circle cx="58" cy="100" r="2"/></g>
        <path class="k-print" d="M70 30a14 14 0 0 1 28 0v12M76 30a8 8 0 0 1 16 0v18M84 30v22M64 42v-10a20 20 0 0 1 40 0v6"/>
        <circle class="k-glass" cx="52" cy="58" r="30"/><circle class="k-shine" cx="52" cy="58" r="22"/>
        <path class="k-handle" d="M74 80l26 26"/>
      </svg>
    </button>
    <div class="toys" style="--i:4">
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
      <button class="toy draw" type="button" data-game="draw">
        <svg class="t-art" viewBox="0 0 100 70" aria-hidden="true">
          <path class="dd" d="M30 36 C18 22 32 8 44 22 C54 8 70 20 58 36 L44 52 Z"/>
          <path class="dd2" d="M66 52 c6 -10 14 -10 18 -2 c3 6 -4 10 -7 4 M12 60 q14 -8 26 0 t26 0"/>
        </svg>
        <span class="t-title">${GAMES.draw.title}</span><span class="t-sub">Einer kritzelt, einer rät.</span>
      </button>
      <button class="toy mime" type="button" data-game="mime">
        <svg class="t-art" viewBox="0 0 100 80" aria-hidden="true">
          <path class="sp" d="M50 6 L82 80 H18 Z"/>
          <path class="cu" d="M0 0 H34 C31 26 26 52 14 80 H0 Z M100 0 H66 C69 26 74 52 86 80 H100 Z"/>
          <path class="va" d="M0 0 H100 V9 Q87.5 17 75 9 Q62.5 17 50 9 Q37.5 17 25 9 Q12.5 17 0 9 Z"/>
          <g class="fig"><circle cx="50" cy="40" r="6"/><path d="M50 46 V62 M50 50 L40 42 M50 50 L60 44 M50 62 L43 74 M50 62 L57 74"/></g>
        </svg>
        <span class="t-title">${GAMES.mime.title}</span><span class="t-sub">Darstellen ohne Worte.</span>
      </button>
      <button class="toy ships" type="button" data-game="ships">
        <span class="t-text"><span class="t-title">${GAMES.ships.title}</span><span class="t-sub">Versteckt Einhörner, Wolken und Katzen – und findet die des anderen.</span></span>
        <span class="mini-sea" aria-hidden="true">${Array.from({ length: 24 }, (_, i) => `<i class="${[3, 4, 13].includes(i) ? 'hit' : [7, 10, 17, 20].includes(i) ? 'miss' : ''}"></i>`).join('')}</span>
      </button>
    </div>
    <section class="panel score" style="--i:5" aria-label="Duell-Bilanz" data-slot="score"></section>`;
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
  let masc = s.querySelector('.hello .masc');
  let bubbleT;
  // Design gewechselt → passendes Maskottchen (Kiki ↔ Kuro)
  function swapMascot(t) {
    mk = t === 'lila' ? 'kuro' : 'kiki';
    const fresh = document.createRange().createContextualFragment(mascot(mk, 'happy')).firstElementChild;
    masc.replaceWith(fresh);
    masc = fresh;
    masc.addEventListener('click', poke);
    setTimeout(() => setMood(masc, 'idle'), 1200);
  }
  masc.addEventListener('click', poke);
  function poke() {
    const r = masc.getBoundingClientRect();
    setMood(masc, 'cheer', 1400);
    burst(r.left + r.width / 2, r.top + r.height * .3, { count: 16, emoji: true });
    sfx.sparkle(); haptic(10);
    s.querySelector('.hello .bubble')?.remove();
    const b = h('div', { class: 'bubble', role: 'status' }, pick(LINES[mk]).replace('{n}', nameOf(p)));
    s.querySelector('.hello').append(b);
    clearTimeout(bubbleT);
    bubbleT = setTimeout(() => b.remove(), 2600);
  }

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
    on('theme', swapMascot),
    on('stats', renderScore),
    on('session', renderResume),
    on('prefs', ({ k }) => {
      if (k === 'code' || k === 'mode') { seg.setValue(prefs.get('mode')); renderMode(); }
      if (k === 'nicks') nav('#/lobby', { replace: true, vt: false });
    }),
  ];
  return () => { offs.forEach((f) => f()); clearTimeout(bubbleT); };
}
