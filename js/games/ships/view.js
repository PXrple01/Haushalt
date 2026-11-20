// Herzchen versenken – Oberfläche: Figuren ziehen/drehen, Schüsse im Bogen, Treffer, Spritzer, Versenkt-Animationen, Bombe.
import { h, esc, centerOf } from '../../core/dom.js';
import { icon } from '../../art/icons.js';
import { me, on, get, set } from '../../core/store.js';
import { nameOf, other, sleep } from '../../core/util.js';
import { handoff, toast, announce } from '../../core/ui.js';
import { motionOK, currentTheme } from '../../core/theme.js';
import { burst, ring, flash, stamp, shake, trail } from '../../core/fx.js';
import { sfx, haptic } from '../../core/sound.js';
import { nav } from '../../core/router.js';
import { createSession, addEvent, getSession } from '../../core/sync.js';
import { reduce, N, FLEETS, fleetPieces, pieceInfo, orientsOf, orientOf, cellsOf, fits, randomFleet, bombCells } from './logic.js';
import { enc } from '../secret.js';
import { pieceSVG } from './art.js';
import { shell, partnerNote, whoSeg, resolveWho, radioCards, turnBanner, resultCard, finale, markCelebrated, waitCard } from '../common.js';

const RULES = [
  'Jeder versteckt fünf Figuren in seinem Meer. Klassisch: Einhorn (4 Felder), Wolke (3), Katze (3), Herzchen (2) und Sternschnuppe (2).',
  'Kurvig (kniffliger): Regenbogen als Bogen (5 Felder), Seeschlange in S-Form (4), Raupe in L-Form (4), Einhorn (4) und Herzchen (2). Nach dem ersten Treffer weißt du nicht, wohin die Figur weiterläuft!',
  'Zum Platzieren ziehen, zum Drehen antippen (kurvige Figuren werden dabei auch gespiegelt) – oder einfach „Zufällig“.',
  'Abwechselnd schießt ihr aufs Meer des anderen. Bei einem Treffer darfst du nochmal.',
  'Einmal pro Spiel gibt es den Spezialschuss: Er trifft ein ganzes 3×3-Feld.',
  'Wer zuerst alle Figuren des anderen findet, gewinnt.',
];
const bombName = () => (currentTheme() === 'lila' ? 'Sternschnuppen-Bombe' : 'Einhorn-Bombe');
const SUNK_LINE = {
  einhorn: 'Das Einhorn galoppiert davon!', wolke: 'Die Wolke regnet sich aus!', katze: 'Die Katze rollt sich ein – Zzz …',
  herz: 'Herzchen gefunden!', stern: 'Die Sternschnuppe saust davon!',
  regenbogen: 'Regenbogen gefunden – du hast einen Wunsch frei!', schlange: 'Die Seeschlange taucht ab – blubb!', raupe: 'Aus der Raupe wird ein Schmetterling!',
};

// ======================================================================
export function setup(root) {
  const p = me.get();
  const { body, mode, cleanup } = shell({ root, game: 'ships', rules: RULES });
  let first = p;
  let fleet = FLEETS[get('shipsFleet', 'kurvig')] ? get('shipsFleet', 'kurvig') : 'kurvig';
  body.innerHTML = `
    <div class="setup stack">
      <div class="ships-hero" aria-hidden="true"><div class="sh-water"></div>${['einhorn', 'schlange', 'herz'].map((id, i) => `<div class="sh-bob b${i}">${pieceSVG(id)}</div>`).join('')}</div>
      <p class="lead measure">Versteckt eure Figuren und findet die des anderen. Bei Treffer darfst du nochmal!</p>
      <section class="setup-sec stack"><h2 class="setup-h">Welche Figuren?</h2><div data-slot="fleet" class="ships-setup-cards"></div></section>
      <section class="setup-sec stack"><h2 class="setup-h">Wer schießt zuerst?</h2><div data-slot="first"></div></section>
      ${partnerNote(mode)}
      <button class="btn primary big block" type="button" data-a="start">${icon('sparkle')}<span>Los geht’s</span></button>
    </div>`;
  const fleetArt = (kind) => `<span class="fleet-art">${fleetPieces(kind).map((f) => `<span class="fa" style="--bw:${f.bw};--bh:${f.bh}">${pieceSVG(f.id)}</span>`).join('')}</span>`;
  body.querySelector('[data-slot="fleet"]').append(radioCards({
    label: 'Welche Figuren?', value: fleet,
    options: Object.values(FLEETS).map((f) => ({ value: f.id, title: f.title, sub: f.sub, art: fleetArt(f.id) })),
    onChange: (v) => { fleet = v; set('shipsFleet', v); },
  }));
  body.querySelector('[data-slot="first"]').append(whoSeg({ label: 'Wer schießt zuerst?', value: first, random: true, onChange: (v) => { first = v; } }));
  body.querySelector('[data-a="start"]').addEventListener('click', () => {
    sfx.pop(); haptic(12);
    const id = createSession('ships', mode, { first: resolveWho(first), fleet });
    nav('#/spiel/' + id, { replace: true });
  });
  return cleanup;
}

// ---------- Meer (Spielfeld) ----------
function makeSea(kind) {
  const el = h('div', { class: `sea ${kind}` });
  el.innerHTML = `<div class="sea-grid" role="grid">${Array.from({ length: N * N }, (_, i) => `<button class="sc" type="button" data-x="${i % N}" data-y="${Math.floor(i / N)}" aria-label="Feld ${String.fromCharCode(65 + (i % N))}${Math.floor(i / N) + 1}" tabindex="-1"><i></i></button>`).join('')}</div><div class="sea-pieces"></div>`;
  const ro = new ResizeObserver(() => el.style.setProperty('--cell', `${el.clientWidth / N}px`));
  ro.observe(el);
  el.style.setProperty('--cell', `${(el.clientWidth || 320) / N}px`);
  el.cell = (x, y) => el.querySelector(`.sc[data-x="${x}"][data-y="${y}"]`);
  el.cellSize = () => el.clientWidth / N;
  el.destroy = () => ro.disconnect();
  return el;
}
function pieceEl(pc, cls = '') {
  const f = pieceInfo(pc.id);
  const o = orientOf(pc);
  const d = h('div', { class: `piece ${cls}`, dataset: { id: pc.id } });
  const vars = { '--x': pc.x, '--y': pc.y, '--w': o.w, '--h': o.h, '--bw': f.bw, '--bh': f.bh, '--rot': `${o.rot}deg`, '--flip': o.flip };
  for (const [k, v] of Object.entries(vars)) d.style.setProperty(k, v);
  // Liegeplatz: jedes belegte Feld einzeln (bei kurvigen Figuren bleiben die Ecken frei)
  d.innerHTML = `<div class="pi-foot">${o.cells.map(([cx, cy]) => `<i style="--cx:${cx};--cy:${cy}"></i>`).join('')}</div><div class="pi-in">${pieceSVG(pc.id)}</div>`;
  return d;
}

// ======================================================================
export function play(root, sid) {
  const p = me.get();
  const { body, mode, cleanup: shellOff } = shell({ root, game: 'ships', sid, rules: RULES });
  const remote = mode === 'remote';
  const compute = () => { const s = getSession(sid); return reduce(s.meta, s.evs); };
  let st = compute();
  let view = '';
  let busy = false;
  let seas = [];
  const offs = [];

  function clearSeas() { seas.forEach((s) => s.destroy?.()); seas = []; }
  function setBody(node) { clearSeas(); body.replaceChildren(node); }

  // ====================================================================
  // Platzieren
  // ====================================================================
  function renderPlace(owner) {
    view = 'place:' + owner;
    const placed = new Map();
    const box = h('div', { class: 'place stack' });
    box.innerHTML = `<div class="phase-head"><h2>${remote ? 'Versteck deine Figuren' : `${esc(nameOf(owner))}, versteck deine Figuren`}</h2>
      <p class="soft">Ziehen zum Platzieren, antippen zum Drehen${st.fleetKind === 'kurvig' ? ' und Spiegeln' : ''}.</p></div>`;
    const sea = makeSea('mine placing');
    const tray = h('div', { class: 'tray', 'aria-label': 'Figuren zum Platzieren' });
    const tools = h('div', { class: 'row place-tools' });
    tools.innerHTML = `<button class="btn grow" type="button" data-a="rand">${icon('dice')}<span>Zufällig</span></button><button class="btn quiet" type="button" data-a="clear">${icon('undo')}<span>Alle zurück</span></button>`;
    const done = h('button', { class: 'btn primary big block', type: 'button', disabled: true });
    done.innerHTML = `${icon('lock')}<span>Fertig!</span>`;
    box.append(sea, tray, tools, done);
    setBody(box);
    seas.push(sea); // erst nach setBody merken – setBody räumt alte Meere (samt Größen-Beobachter) weg
    sea.style.setProperty('--cell', `${sea.clientWidth / N}px`);
    const piecesLayer = sea.querySelector('.sea-pieces');

    const kind = st.fleetKind;
    const FL = fleetPieces(kind);
    const list = () => [...placed.entries()].map(([id, v]) => ({ id, ...v }));
    function renderAll(animIds = []) {
      piecesLayer.replaceChildren(...[...placed.entries()].map(([id, v], i) => {
        const el = pieceEl({ id, ...v }, 'own');
        if (animIds.includes(id) && motionOK()) {
          el.animate([{ transform: 'translateY(-120px) scale(.5) rotate(-12deg)', opacity: 0 }, { transform: 'translateY(6px) scale(1.04)', opacity: 1, offset: .7 }, { transform: 'none' }], { duration: 560, delay: i * 90, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'backwards' });
        }
        el.addEventListener('pointerdown', (e) => startDrag(e, id, true));
        return el;
      }));
      tray.replaceChildren(...FL.filter((f) => !placed.has(f.id)).map((f) => {
        const t = h('div', { class: `tray-piece${f.curvy ? ' curvy' : ''}`, dataset: { id: f.id }, style: { '--bw': f.bw, '--bh': f.bh }, role: 'button', tabindex: '0', 'aria-label': `${f.name} (${f.len} Felder) platzieren` });
        t.innerHTML = `<span class="tp-art">${pieceSVG(f.id)}</span><span class="tp-name">${f.name} – ${f.len}</span>`;
        t.addEventListener('pointerdown', (e) => startDrag(e, f.id, false));
        t.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          const all = list();
          for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
            const pc = { id: f.id, x, y, o: 0 };
            if (fits(pc, all)) { placed.set(f.id, { x, y, o: 0 }); renderAll([f.id]); check(); return; }
          }
        });
        return t;
      }));
      if (!tray.children.length) tray.insertAdjacentHTML('beforeend', '<p class="tray-done">Alle Figuren sind versteckt!</p>');
    }
    const check = () => { done.disabled = placed.size !== FL.length; };

    // ---- Ziehen ----
    function startDrag(e, id, fromBoard) {
      if (e.button > 0) return;
      e.preventDefault();
      const cell = sea.cellSize();
      const prev = fromBoard ? { ...placed.get(id) } : null;
      const o = prev ? prev.o : 0;
      const ori = orientsOf(id)[o];
      // Greifpunkt: welches Feld der Figur hält der Finger? (Ablage: anteilig über die Größe der Vorschau)
      const src = fromBoard ? e.currentTarget : (e.currentTarget.querySelector('.tp-art') || e.currentTarget);
      const srcRect = src.getBoundingClientRect();
      const fx = Math.max(0, Math.min(.999, (e.clientX - srcRect.left) / srcRect.width));
      const fy = Math.max(0, Math.min(.999, (e.clientY - srcRect.top) / srcRect.height));
      let gx = Math.floor(fx * ori.w), gy = Math.floor(fy * ori.h);
      // Liegt der Greifpunkt auf einem leeren Eckfeld, das nächste belegte Feld nehmen
      if (!ori.cells.some(([cx, cy]) => cx === gx && cy === gy)) {
        const near = ori.cells.slice().sort((a, b) => Math.hypot(a[0] - gx, a[1] - gy) - Math.hypot(b[0] - gx, b[1] - gy))[0];
        [gx, gy] = near;
      }
      if (fromBoard) { placed.delete(id); renderAll(); }
      const ghost = pieceEl({ id, x: 0, y: 0, o }, 'ghost');
      ghost.style.setProperty('--cell', `${cell}px`);
      document.body.append(ghost);
      const t0 = performance.now(), x0 = e.clientX, y0 = e.clientY;
      let target = null, moved = false;
      const hl = (cells, ok) => {
        sea.querySelectorAll('.sc.ok, .sc.bad').forEach((c) => c.classList.remove('ok', 'bad'));
        for (const [cx, cy] of cells) sea.cell(cx, cy)?.classList.add(ok ? 'ok' : 'bad');
      };
      const move = (ev) => {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6) moved = true;
        const left = ev.clientX - (gx + .5) * cell;
        const top = ev.clientY - (gy + .5) * cell;
        ghost.style.left = left + 'px'; ghost.style.top = top + 'px';
        const r = sea.getBoundingClientRect();
        const tx = Math.round((left - r.left) / cell), ty = Math.round((top - r.top) / cell);
        const pc = { id, x: tx, y: ty, o };
        const inside = ev.clientX > r.left - cell && ev.clientX < r.right + cell && ev.clientY > r.top - cell && ev.clientY < r.bottom + cell;
        const all = list();
        if (inside) {
          const ok = fits(pc, all);
          target = ok ? pc : null;
          hl(cellsOf(pc).filter(([cx, cy]) => cx >= 0 && cy >= 0 && cx < N && cy < N), ok);
        } else { target = null; hl([], true); }
      };
      const up = (ev) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        hl([], true);
        const tap = !moved && performance.now() - t0 < 350;
        const all = list();
        if (tap && prev) {
          // Antippen = nächste Ausrichtung (drehen, bei kurvigen Figuren auch spiegeln); notfalls etwas verschieben, damit sie aufs Meer passt
          ghost.remove();
          const turned = turn(id, prev, all);
          if (turned) { placed.set(id, turned); sfx.flip(); haptic(8); renderAll(); spinIn(id); }
          else { placed.set(id, prev); renderAll(); shake(piecesLayer.querySelector(`.piece[data-id="${id}"]`), 6); sfx.bad(); toast('Hier ist kein Platz zum Drehen.', { key: 'game', icon: 'info' }); }
          check();
          return;
        }
        if (target) {
          placed.set(id, { x: target.x, y: target.y, o: target.o });
          ghost.remove();
          renderAll();
          const el = piecesLayer.querySelector(`.piece[data-id="${id}"]`);
          if (motionOK() && el) el.animate([{ transform: 'scale(1.12)' }, { transform: 'scale(.96)' }, { transform: 'none' }], { duration: 360, easing: 'cubic-bezier(.34,1.56,.64,1)' });
          sfx.pop(); haptic(10);
          const c = centerOf(el || sea);
          burst(c.x, c.y, { count: 8, speed: [60, 160], size: [4, 8], gravity: 200 });
        } else {
          ghost.remove();
          if (prev) placed.set(id, prev);
          renderAll();
          if (moved) { sfx.bad(); }
        }
        check();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
      move(e);
    }
    // Nächste passende Ausrichtung suchen (gleiche Ecke, sonst leicht verschoben)
    function turn(id, prev, all) {
      const n = orientsOf(id).length;
      for (let k = 1; k < n; k++) {
        const o = (prev.o + k) % n;
        const { w, h: hh } = orientsOf(id)[o];
        const bx = Math.min(prev.x, N - w), by = Math.min(prev.y, N - hh);
        for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [1, 0], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
          const pc = { id, x: bx + dx, y: by + dy, o };
          if (fits(pc, all)) return { x: pc.x, y: pc.y, o };
        }
      }
      return null;
    }
    function spinIn(id) {
      const el = piecesLayer.querySelector(`.piece[data-id="${id}"] .pi-in`);
      if (el && motionOK()) el.animate([{ rotate: '-90deg', scale: '.8' }, { rotate: '0deg', scale: '1' }], { duration: 380, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    }

    tools.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'rand') {
        const f = randomFleet(Math.random, kind);
        placed.clear();
        f.forEach((pc) => placed.set(pc.id, { x: pc.x, y: pc.y, o: pc.o }));
        renderAll(f.map((x) => x.id));
        sfx.sparkle(); haptic(12); check();
      } else if (a === 'clear') { placed.clear(); renderAll(); check(); sfx.tap(); }
    });
    done.addEventListener('click', () => {
      if (placed.size !== FL.length) return;
      const fleet = [...placed.entries()].map(([id, v]) => ({ id, x: v.x, y: v.y, o: v.o }));
      sfx.pop(); haptic(14);
      addEvent(sid, 'fleet', { p: owner, f: enc(JSON.stringify(fleet), sid) });
    });
    renderAll();
    check();
  }

  // ====================================================================
  // Schlacht
  // ====================================================================
  let el = {};
  const shooterNow = () => (remote ? p : st.turn);
  function renderBattle() {
    view = 'battle';
    const box = h('div', { class: 'battle stack' });
    const banner = turnBanner();
    const status = h('div', { class: 'fleet-status' });
    const target = makeSea('target');
    const bomb = h('button', { class: 'btn bomb-btn', type: 'button', 'aria-pressed': 'false' });
    box.append(banner, status, target, bomb);
    let mine = null;
    if (remote) {
      mine = makeSea('mine small');
      const lab = h('p', { class: 'sea-label' }, 'Dein Meer');
      box.append(lab, mine);
    }
    setBody(box);
    seas.push(target);
    if (mine) seas.push(mine);
    el = { box, banner, status, target, mine, bomb };
    target.addEventListener('click', (e) => {
      const c = e.target.closest('.sc');
      if (c) fire(+c.dataset.x, +c.dataset.y);
    });
    bomb.addEventListener('click', () => {
      const armed = bomb.getAttribute('aria-pressed') !== 'true';
      bomb.setAttribute('aria-pressed', String(armed));
      target.classList.toggle('armed', armed);
      sfx.tap(); haptic(10);
      if (armed) toast(`${bombName()} bereit – tippe aufs Ziel!`, { key: 'game', icon: 'sparkle' });
    });
    // 3×3-Vorschau beim Zielen mit der Bombe
    target.addEventListener('pointerover', (e) => {
      if (!target.classList.contains('armed')) return;
      const c = e.target.closest('.sc');
      target.querySelectorAll('.sc.aim').forEach((x) => x.classList.remove('aim'));
      if (c) for (const [x, y] of bombCells(+c.dataset.x, +c.dataset.y)) target.cell(x, y)?.classList.add('aim');
    });
    paintBattle();
  }

  function paintSea(sea, shots, fleet, { reveal = false, own = false } = {}) {
    const map = new Map(shots.map((s) => [`${s.x},${s.y}`, s]));
    sea.querySelectorAll('.sc').forEach((c) => {
      const s = map.get(`${c.dataset.x},${c.dataset.y}`);
      c.classList.toggle('hit', !!s?.hit);
      c.classList.toggle('miss', !!s && !s.hit);
      c.disabled = !!s;
    });
    const sunkIds = new Set(fleet.filter((pc) => cellsOf(pc).every(([x, y]) => map.get(`${x},${y}`)?.hit)).map((pc) => pc.id));
    const layer = sea.querySelector('.sea-pieces');
    layer.replaceChildren(...fleet.filter((pc) => own || reveal || sunkIds.has(pc.id)).map((pc) => pieceEl(pc, `${own ? 'own' : ''} ${sunkIds.has(pc.id) ? 'sunk' : ''} ${reveal && !sunkIds.has(pc.id) && !own ? 'ghosted' : ''}`)));
    return sunkIds;
  }

  function paintBattle() {
    const s = shooterNow();
    const foe = other(s);
    const myTurn = st.phase === 'play' && (remote ? st.turn === p : true);
    el.banner.set(st.turn, remote ? (st.turn === p ? 'Du bist dran!' : `${nameOf(st.turn)} zielt …`) : `${nameOf(st.turn)} ist dran`, st.phase === 'play' ? (remote ? (st.turn === p ? 'Tippe aufs Meer von ' + nameOf(foe) : 'Gleich trifft es dein Meer') : `Schießt aufs Meer von ${nameOf(other(st.turn))}`) : '');
    const target = el.target;
    target.dataset.owner = foe;
    paintSea(target, st.shots[s], st.fleets[foe], { reveal: st.phase === 'end' });
    target.classList.toggle('locked', !myTurn || st.phase !== 'play');
    target.setAttribute('aria-label', `Meer von ${nameOf(foe)}`);
    if (el.mine) paintSea(el.mine, st.shots[foe], st.fleets[p], { own: true });
    // Figurenstatus des Gegners
    el.status.innerHTML = `<span class="fs-lab">${esc(remote ? `Figuren von ${nameOf(foe)}` : `Figuren von ${nameOf(foe)}`)}</span>` + fleetPieces(st.fleetKind).map((f) => `<span class="fs${st.sunk[s].includes(f.id) ? ' gone' : ''}" title="${f.name}" style="--bh:${f.bh}">${pieceSVG(f.id)}</span>`).join('');
    const canBomb = !st.bombUsed[s] && myTurn;
    el.bomb.hidden = st.phase !== 'play';
    el.bomb.disabled = !canBomb;
    el.bomb.innerHTML = `${icon('sparkle')}<span>${st.bombUsed[s] ? `${bombName()} verbraucht` : `${bombName()} (1×)`}</span>`;
    if (!canBomb) { el.bomb.setAttribute('aria-pressed', 'false'); target.classList.remove('armed'); }
    if (remote) el.box.classList.toggle('watching', st.turn !== p && st.phase === 'play');
  }

  function fire(x, y) {
    if (busy || st.phase !== 'play') return;
    if (remote && st.turn !== p) { toast(`${nameOf(st.turn)} ist dran.`, { key: 'game', icon: 'info' }); return; }
    const armed = el.bomb.getAttribute('aria-pressed') === 'true';
    const s = shooterNow();
    if (!armed && st.shots[s].some((q) => q.x === x && q.y === y)) return;
    el.bomb.setAttribute('aria-pressed', 'false');
    el.target.classList.remove('armed');
    el.target.querySelectorAll('.sc.aim').forEach((c) => c.classList.remove('aim'));
    addEvent(sid, 'shot', { x, y, bomb: armed });
  }

  // ---------- Animationen eines Schusses ----------
  async function animateShot(cur, prev) {
    const L = cur.last;
    if (!L || L.kind !== 'shot') return;
    const shooter = L.by;
    // Welches Meer zeigt den Einschlag?
    const sea = remote ? (shooter === p ? el.target : el.mine) : el.target;
    if (!sea) return;
    const lila = currentTheme() === 'lila';
    const tgt = sea.cell(L.aim.x, L.aim.y);
    if (motionOK() && tgt) {
      // Geschoss im Bogen
      const to = centerOf(tgt);
      const from = { x: innerWidth / 2, y: innerHeight + 30 };
      const proj = h('div', { class: `proj${L.bomb ? ' big' : ''}`, 'aria-hidden': 'true' });
      proj.innerHTML = L.bomb ? (lila ? '☄️' : '🦄') : icon(lila ? 'star' : 'heart', 'fill');
      proj.style.left = from.x + 'px'; proj.style.top = from.y + 'px';
      document.body.append(proj);
      const dx = to.x - from.x, dy = to.y - from.y;
      const peak = Math.min(-80, dy * .35) - 120;
      sfx.whoosh();
      const a = proj.animate([
        { transform: 'translate(-50%,-50%) scale(.6) rotate(0deg)' },
        { transform: `translate(calc(-50% + ${dx * .5}px), calc(-50% + ${dy * .5 + peak}px)) scale(1.25) rotate(200deg)`, offset: .5 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.8) rotate(360deg)` },
      ], { duration: L.bomb ? 700 : 520, easing: 'cubic-bezier(.4,0,.3,1)' });
      const tick = setInterval(() => { const r = proj.getBoundingClientRect(); trail(r.left + r.width / 2, r.top + r.height / 2, { count: 1, colors: lila ? ['#47E5FF', '#fff', '#D19BFF'] : ['#FF8CC6', '#fff', '#FFE58F'], glow: lila }); }, 40);
      await a.finished.catch(() => {});
      clearInterval(tick);
      proj.remove();
    }
    if (L.bomb) {
      const c = tgt ? centerOf(tgt) : centerOf(sea);
      flash(lila ? '#47E5FF' : '#FFFFFF', .5);
      ring(c.x, c.y, { color: lila ? '#47E5FF' : '#FF8CC6', r0: 10, r1: sea.cellSize() * 3, width: 10, ttl: .8 });
      ring(c.x, c.y, { color: '#fff', r0: 10, r1: sea.cellSize() * 2.2, width: 6, ttl: .6 });
      sfx.boom(); haptic([40, 30, 80]);
      shake(sea, 10);
    }
    // Einschläge nacheinander
    for (const [i, r] of L.results.entries()) {
      const c = sea.cell(r.x, r.y);
      if (!c) continue;
      const pos = centerOf(c);
      if (r.hit) {
        c.classList.add('hit', 'boom');
        burst(pos.x, pos.y, { count: L.bomb ? 10 : 22, speed: [120, 340], colors: lila ? ['#FF6FB5', '#FFD36E', '#fff'] : ['#FF5FA8', '#FFE27A', '#fff'], shapes: ['star', 'sparkle'], glow: lila });
        if (!L.bomb) { sfx.good(); haptic([20, 30, 20]); shake(sea, 4); }
      } else {
        c.classList.add('miss', 'splash');
        burst(pos.x, pos.y, { count: L.bomb ? 6 : 16, speed: [80, 260], angle: -Math.PI / 2, spread: 1.1, gravity: 900, colors: lila ? ['#47E5FF', '#9FF0FF', '#fff'] : ['#6EC3F5', '#BFE8FF', '#fff'], shapes: ['circle'], twinkle: false, size: [4, 9] });
        ring(pos.x, pos.y, { color: lila ? '#47E5FF' : '#6EC3F5', r0: 4, r1: sea.cellSize() * .9, width: 3, ttl: .6 });
        if (!L.bomb) sfx.splash();
      }
      c.disabled = true;
      if (L.bomb) await sleep(70);
      else if (i === 0) await sleep(10);
    }
    if (L.bomb) { const hits = L.results.filter((r) => r.hit).length; if (hits) sfx.good(); else sfx.splash(); }
    announce(L.results.some((r) => r.hit) ? 'Treffer!' : 'Daneben.');
    // Versenkt?
    for (const id of L.sunk) await sunkFx(sea, shooter, id);
  }

  async function sunkFx(sea, shooter, id) {
    const victim = other(shooter);
    const pc = st.fleets[victim].find((x) => x.id === id);
    if (!pc) return;
    const layer = sea.querySelector('.sea-pieces');
    let pel = layer.querySelector(`.piece[data-id="${id}"]`);
    if (!pel) { pel = pieceEl(pc, 'sunk'); layer.append(pel); } else pel.classList.add('sunk');
    pel.classList.add('sink-' + id);
    const c = centerOf(pel);
    const lila = currentTheme() === 'lila';
    sfx.sparkle(); haptic([30, 40, 60]);
    if (motionOK()) {
      pel.animate([{ transform: 'scale(.3) rotate(-20deg)', opacity: 0 }, { transform: 'scale(1.18) rotate(4deg)', opacity: 1, offset: .55 }, { transform: 'none', opacity: 1 }], { duration: 700, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      if (id === 'einhorn') { burst(c.x, c.y, { count: 40, colors: ['#FF8CC6', '#FFCFA8', '#FFF1A8', '#B8F2D8', '#AEE0FF', '#CDB8FF'], speed: [220, 520], shapes: ['heart', 'star', 'sparkle'], emoji: ['🌈', '🦄'], emojiRate: .12 }); ring(c.x, c.y, { color: '#FFB3D9', r1: 220, width: 10 }); }
      else if (id === 'wolke') { for (let i = 0; i < 26; i++) setTimeout(() => burst(c.x + (Math.random() - .5) * pel.offsetWidth * .8, c.y + 6, { count: 1, angle: Math.PI / 2, spread: .1, speed: [180, 260], gravity: 900, colors: ['#6EC3F5', '#9FDCFF'], shapes: ['circle'], twinkle: false, size: [4, 7] }), i * 45); }
      else if (id === 'katze') { stamp('Zzz', c.x + 30, c.y - 30, { cls: lila ? 'manga' : '', ms: 1400, rot: -10 }); burst(c.x, c.y, { count: 16, shapes: ['star', 'sparkle'], speed: [80, 220] }); }
      else if (id === 'herz') { burst(c.x, c.y, { count: 28, shapes: ['heart'], colors: ['#FF5FA8', '#B79CFF', '#fff'], speed: [180, 420] }); }
      else if (id === 'stern') { for (let i = 0; i < 18; i++) setTimeout(() => trail(c.x + i * 18, c.y - i * 14, { count: 3, shapes: ['star', 'sparkle'], colors: ['#FFE27A', '#fff', '#FFB3D9'], glow: true }), i * 30); }
      else if (id === 'regenbogen') { burst(c.x, c.y, { count: 46, colors: ['#FF6B8B', '#FFA45C', '#FFD54D', '#7BE08F', '#5CC8FF', '#9B7BFF'], speed: [200, 520], shapes: ['star', 'sparkle', 'heart'], emoji: ['🌈', '✨'], emojiRate: .12 }); ring(c.x, c.y, { color: '#FFD54D', r1: 230, width: 10 }); ring(c.x, c.y, { color: '#5CC8FF', r1: 170, width: 7 }); }
      else if (id === 'schlange') { for (let i = 0; i < 22; i++) setTimeout(() => burst(c.x + (Math.random() - .5) * pel.offsetWidth * .7, c.y + (Math.random() - .5) * pel.offsetHeight * .5, { count: 1, angle: -Math.PI / 2, spread: .25, speed: [90, 180], gravity: -120, colors: ['#BFE8FF', '#fff', '#3FD0B4'], shapes: ['circle'], twinkle: false, size: [5, 11] }), i * 40); stamp('Blubb!', c.x + 20, c.y - 20, { cls: lila ? 'manga' : '', ms: 1100, rot: 8 }); }
      else if (id === 'raupe') { burst(c.x, c.y, { count: 18, emoji: ['🦋'], emojiRate: .5, speed: [160, 380], shapes: ['heart', 'sparkle'], colors: ['#B6F07E', '#FFB3D9', '#FFE27A'] }); }
    }
    stamp(`${pieceInfo(id).name} versenkt!`, c.x, c.y - 40, { cls: lila ? 'manga' : '', ms: 1200, rot: -6 });
    toast(SUNK_LINE[id], { key: 'game', icon: 'sparkle' });
    await sleep(motionOK() ? 900 : 0);
  }

  // ---------- Ende ----------
  function renderEnd() {
    if (view !== 'battle') renderBattle();
    paintBattle();
    const w = st.winner;
    const card = resultCard({
      winner: w, aborted: st.aborted,
      title: st.aborted ? 'Partie beendet' : remote ? (w === p ? 'Gewonnen!' : `${nameOf(w)} gewinnt!`) : `${nameOf(w)} gewinnt!`,
      sad: remote && w !== p,
      lines: st.aborted ? [`${esc(nameOf(st.abortBy))} hat die Partie beendet.`] : [`${esc(nameOf(w))} hat alle Figuren gefunden – mit ${st.shots[w].length} Schüssen.`],
      rematchLabel: 'Nochmal spielen',
      onRematch: () => { const id = createSession('ships', mode, { first: other(st.first), fleet: st.fleetKind }); nav('#/spiel/' + id, { replace: true }); },
    });
    el.box.append(card);
  }

  // ====================================================================
  async function decideSetup() {
    if (remote) {
      if (!st.fleets[p]) { if (view !== 'place:' + p) renderPlace(p); }
      else if (view !== 'wait') { view = 'wait'; setBody(waitCard(`${nameOf(other(p))} versteckt noch Figuren`, 'Gleich geht die Suche los!')); }
      return;
    }
    const owner = !st.fleets.jos ? 'jos' : 'joh';
    if (view === 'place:' + owner) return;
    busy = true;
    setBody(waitCard('Einen Moment …'));
    await handoff({ to: owner, kicker: 'Herzchen versenken', title: `${nameOf(owner)} versteckt Figuren`, text: `${nameOf(other(owner))}, nicht hinschauen!`, button: `Ich bin ${nameOf(owner)} – los!` });
    busy = false;
    st = compute(); shown = st;
    if (st.phase === 'setup') renderPlace(!st.fleets.jos ? 'jos' : 'joh');
    else renderBattle();
  }

  async function update(prev, cur) {
    if (cur.phase === 'setup') { decideSetup(); return; }
    if (prev.phase === 'setup') {
      if (!remote) {
        busy = true;
        await handoff({ to: cur.first, kicker: 'Alles versteckt', title: `${nameOf(cur.first)} schießt zuerst`, text: 'Legt das Handy zwischen euch – das Meer zeigt nur, was schon beschossen wurde.', button: 'Los geht’s' });
        busy = false;
      } else sfx.join();
      renderBattle();
      return;
    }
    if (view !== 'battle') renderBattle();
    // Schuss animieren (auf dem Meer, wie es VOR dem Zugwechsel aussah)
    const shotNow = cur.last?.kind === 'shot' && cur.last.id !== prev.last?.id;
    if (shotNow) {
      busy = true;
      const L = cur.last;
      if (!remote && L.by !== shooterOfView) { shooterOfView = L.by; paintFor(prev, L.by); }
      await animateShot(cur, prev);
      busy = false;
    }
    if (cur.phase === 'end' && prev.phase !== 'end') {
      if (!cur.aborted) {
        await sleep(400);
        finale(sid, { winner: cur.winner, iWon: cur.winner === p, couch: !remote });
      } else if (cur.abortBy !== p) toast(`${nameOf(cur.abortBy)} hat die Partie beendet.`, { key: 'game', icon: 'flag' });
      shooterOfView = null;
      renderEnd();
      return;
    }
    // Zugwechsel: im Couch-Modus Meer umdrehen
    if (!remote && cur.turn !== prev.turn) {
      await sleep(motionOK() ? 600 : 0);
      if (motionOK()) {
        const a = el.target.animate([{ transform: 'rotateY(0)' }, { transform: 'rotateY(90deg)' }], { duration: 260, easing: 'ease-in' });
        await a.finished.catch(() => {});
      }
      shooterOfView = cur.turn;
      paintBattle();
      if (motionOK()) el.target.animate([{ transform: 'rotateY(-90deg)' }, { transform: 'rotateY(0)' }], { duration: 300, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      sfx.flip();
      toast(`${nameOf(cur.turn)} ist dran!`, { key: 'turn', icon: 'sparkle' });
      return;
    }
    if (remote && cur.turn !== prev.turn && cur.turn === p) { sfx.join(); haptic(15); }
    shooterOfView = remote ? p : cur.turn;
    paintBattle();
  }
  let shooterOfView = null;
  // Für die Schuss-Animation im Couch-Modus das Meer des Schützen zeigen (Stand vor dem Schuss)
  function paintFor(prevSt, shooter) {
    const save = st;
    st = { ...prevSt, turn: shooter };
    paintBattle();
    st = save;
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
      if (shown !== st) schedule();
    });
  };
  offs.push(on('session', (d) => { if (d.id !== sid) return; st = compute(); schedule(); }));

  if (st.phase === 'end') { markCelebrated(sid); renderEnd(); }
  else if (st.phase === 'setup') decideSetup();
  else renderBattle();

  return () => { shellOff(); offs.forEach((f) => f()); clearSeas(); };
}
