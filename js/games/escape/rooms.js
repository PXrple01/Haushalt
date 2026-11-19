// Escape-Abenteuer – die Rätsel-Oberflächen. Jede Art hat zwei Ansichten:
// „Hände“ (bedienen: Schloss, Fäden, Labyrinth, Kristalle, Kessel, Tresor, Aufstellung) und „Wissen“ (Buch, Karte, Regeln).
// mountPuzzle(c) → { update(rs, last, fresh), destroy() }
//   c = { el, kind, spec, skin, role: 'hands'|'book', rs, act(payload), partner, r, th }
import { h, esc, centerOf } from '../../core/dom.js';
import { icon } from '../../art/icons.js';
import { symbol, symName, colName, COLORS } from './symbols.js';
import { PUZZLES, WIRE_RULES, DIRS, LOCK_COLS, ECHO_COLS } from './puzzles.js';
import { figure, silhouette, gem, crystal, candle } from './art.js';
import { sfx, haptic } from '../../core/sound.js';
import { burst, ring, shake, stamp } from '../../core/fx.js';
import { motionOK } from '../../core/theme.js';

const hex = (c) => COLORS[c]?.hex || c;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const lc = (c) => colName(c).toLowerCase();
const after = (ms, fn) => setTimeout(fn, motionOK() ? ms : 0);

export const BOOK_ICON = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v15H5.5C4.7 19 4 18.3 4 17.5Z M13 4h5.5c.8 0 1.5.7 1.5 1.5v12c0 .8-.7 1.5-1.5 1.5H13Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M6.5 8h2M6.5 11h2M15.5 8h2M15.5 11h2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
export const HAND_ICON = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11 M11 10.5V4a1.5 1.5 0 0 1 3 0v6.5 M14 10.5V5.5a1.5 1.5 0 0 1 3 0V13 M8 12l-1.6-1.8a1.6 1.6 0 0 0-2.4 2.1L7.5 17c1.3 1.9 3 3 5.3 3h.7c2.8 0 4.5-2.2 4.5-5v-3.5a1.5 1.5 0 0 1 3 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function page(title, note, inner = '') {
  return `<div class="bk-page"><div class="bk-head">${BOOK_ICON}<h3 class="bk-title">${esc(title)}</h3></div>${note ? `<p class="bk-note">${note}</p>` : ''}${inner}</div>`;
}
const B = (s) => `<b>${esc(s)}</b>`;

// =====================================================================
// 1) Symbol-Schloss
// =====================================================================
function lockHands(c) {
  const { spec, skin } = c;
  const idx = spec.gems.map(() => 0);
  const box = h('div', { class: 'pz lk-hands' });
  box.innerHTML = `
    <div class="lk-device">
      <div class="lk-shackle" aria-hidden="true"></div>
      <div class="lk-body">
        <div class="lk-top">
          <div class="lk-gems" role="img" aria-label="Steine: ${spec.gems.map(lc).join(', ')}">${spec.gems.map((g, i) => `<span class="lk-gem" style="--i:${i}">${gem(g)}</span>`).join('')}</div>
          ${spec.twist ? `<div class="lk-lamp" role="img" aria-label="${esc(cap(skin.indicator))} ${esc(spec.lit ? skin.on : skin.off)}">${candle(spec.lit)}</div>` : ''}
        </div>
        <div class="lk-dials">${spec.gems.map((_, i) => `
          <div class="lk-dial" data-i="${i}">
            <button class="lk-arr up" type="button" aria-label="Rad ${i + 1}: vorheriges Symbol">${icon('back')}</button>
            <div class="lk-win" role="button" tabindex="0" aria-live="polite"><div class="lk-strip"></div></div>
            <button class="lk-arr down" type="button" aria-label="Rad ${i + 1}: nächstes Symbol">${icon('back')}</button>
          </div>`).join('')}</div>
      </div>
    </div>
    <button class="btn primary big block lk-open" type="button">${icon('lock')}<span>Öffnen</span></button>`;
  const dials = [...box.querySelectorAll('.lk-dial')];
  const N = spec.syms.length;
  function draw(i, dir = 0) {
    const strip = dials[i].querySelector('.lk-strip');
    const at = (k) => spec.syms[(idx[i] + k + N) % N];
    strip.innerHTML = `<span class="lk-s prev">${symbol(at(-1), 'currentColor')}</span><span class="lk-s cur">${symbol(at(0), 'currentColor')}</span><span class="lk-s next">${symbol(at(1), 'currentColor')}</span>`;
    dials[i].querySelector('.lk-win').setAttribute('aria-label', `Rad ${i + 1}: ${symName(at(0))}`);
    if (dir && motionOK()) strip.animate([{ transform: `translateY(${dir * 33.3}%)` }, { transform: 'translateY(0)' }], { duration: 260, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  }
  function step(i, d) { idx[i] = (idx[i] + d + N) % N; draw(i, d); sfx.flip(); haptic(6); }
  dials.forEach((d, i) => {
    draw(i);
    d.querySelector('.up').addEventListener('click', () => step(i, -1));
    d.querySelector('.down').addEventListener('click', () => step(i, 1));
    const win = d.querySelector('.lk-win');
    let y0 = null;
    win.addEventListener('pointerdown', (e) => { y0 = e.clientY; win.setPointerCapture?.(e.pointerId); });
    win.addEventListener('pointerup', (e) => {
      if (y0 == null) return;
      const dy = e.clientY - y0; y0 = null;
      step(i, Math.abs(dy) > 14 ? (dy < 0 ? 1 : -1) : 1);
    });
    win.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') { e.preventDefault(); step(i, -1); }
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); step(i, 1); }
    });
  });
  const btn = box.querySelector('.lk-open');
  btn.addEventListener('click', () => {
    btn.disabled = true;
    sfx.click(); haptic(12);
    c.act({ k: 'open', code: idx.map((i) => spec.syms[i]) });
    setTimeout(() => { btn.disabled = false; }, 700);
  });
  c.el.append(box);
  return {
    update(rs, last, fresh) {
      if (!fresh) return;
      const dev = box.querySelector('.lk-device');
      if (last.kind === 'mistake') {
        shake(dev, 10);
        dev.classList.remove('wrong'); void dev.offsetWidth; dev.classList.add('wrong');
      } else if (last.kind === 'solved') {
        dev.classList.add('open');
        btn.disabled = true;
      }
    },
  };
}
function table(t) {
  return `<ul class="bk-table">${LOCK_COLS.map((col) => `<li><span class="bk-gem">${gem(col)}</span><span class="bk-col">${esc(colName(col))}</span><span class="bk-arrow" aria-hidden="true">→</span><span class="bk-sym">${symbol(t[col], 'currentColor')}</span><span class="bk-symname">${esc(symName(t[col]))}</span></li>`).join('')}</ul>`;
}
function lockBook(c) {
  const { spec, skin } = c;
  const box = h('div', { class: 'pz book lk-book' });
  const inner = spec.twist
    ? `<h4 class="bk-sub">${candle(true)}<span>${esc(cap(skin.indicator))} ${esc(skin.on)}:</span></h4>${table(spec.tableA)}
       <h4 class="bk-sub">${candle(false)}<span>${esc(cap(skin.indicator))} ${esc(skin.off)}:</span></h4>${table(spec.tableB)}`
    : table(spec.tableA);
  box.innerHTML = page(skin.book, `Frag ${esc(c.partner)} nach den Farben der ${esc(skin.gems)} – von links nach rechts${spec.twist ? ` – und ob ${esc(skin.indicator)} ${esc(skin.on)}` : ''}. Dann sag, welche Symbole eingestellt werden.`, inner);
  c.el.append(box);
  return {};
}

// =====================================================================
// 2) Zauberfäden
// =====================================================================
function wiresHands(c) {
  const { spec, skin } = c;
  const W = 320, top = 26, gap = 44, H = top + spec.k * gap + 6;
  let sel = -1;
  const box = h('div', { class: 'pz wr-hands' });
  const ys = Array.from({ length: spec.k }, (_, i) => top + i * gap + 16);
  const wave = (y, i) => {
    const a = 14 * (i % 2 ? 1 : -1);
    return [`M34 ${y} C70 ${y + a} 120 ${y - a} 160 ${y}`, `M160 ${y} C200 ${y + a} 250 ${y - a} 286 ${y}`];
  };
  box.innerHTML = `
    <div class="wr-device">
      <div class="wr-plate"><span>${esc(skin.plate)}</span><b class="tnum">${spec.plate}</b></div>
      <svg class="wr-svg" viewBox="0 0 ${W} ${H}" role="group" aria-label="${esc(skin.threads)}">
        <rect x="10" y="${top - 8}" width="20" height="${spec.k * gap}" rx="8" class="wr-term"/>
        <rect x="${W - 30}" y="${top - 8}" width="20" height="${spec.k * gap}" rx="8" class="wr-term"/>
        ${spec.wires.map((col, i) => {
          const [l, r] = wave(ys[i], i);
          return `<g class="wr" data-i="${i}" role="button" tabindex="0" aria-label="Nummer ${i + 1}: ${esc(colName(col))}" style="--wc:${hex(col)}">
            <path class="wr-hit" d="${l.replace('M34', 'M24')} ${r.slice(r.indexOf('C'))}"/>
            <g class="wr-half l"><path class="wr-o" d="${l}"/><path class="wr-c" d="${l}"/></g>
            <g class="wr-half r"><path class="wr-o" d="${r}"/><path class="wr-c" d="${r}"/></g>
            <circle class="wr-dot" cx="20" cy="${ys[i]}" r="7"/><circle class="wr-dot" cx="${W - 20}" cy="${ys[i]}" r="7"/>
            <text class="wr-num" x="20" y="${ys[i] + 4.5}" text-anchor="middle">${i + 1}</text>
          </g>`;
        }).join('')}
      </svg>
    </div>
    <button class="btn primary big block wr-cut" type="button" disabled>${icon('cross')}<span>Zum Schneiden antippen</span></button>`;
  const btn = box.querySelector('.wr-cut');
  const gs = [...box.querySelectorAll('.wr')];
  let cut = [];
  function select(i) {
    if (cut.includes(i)) return;
    sel = i;
    gs.forEach((g, j) => g.classList.toggle('sel', j === i));
    btn.disabled = false;
    btn.querySelector('span').textContent = `Nummer ${i + 1} durchschneiden`;
    sfx.tap(); haptic(8);
  }
  gs.forEach((g, i) => {
    g.addEventListener('click', () => select(i));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); } });
  });
  btn.addEventListener('click', () => {
    if (sel < 0) return;
    btn.disabled = true;
    const g = gs[sel];
    const r = g.querySelector('.wr-c').getBoundingClientRect();
    sfx.crack(); haptic([10, 30, 10]);
    burst(r.right, r.top + r.height / 2, { count: 14, colors: ['#FFF3B0', '#FFC21A', '#fff'], shapes: ['sparkle', 'star'], speed: [120, 300] });
    c.act({ k: 'cut', i: sel });
    sel = -1;
  });
  function apply(rs) {
    cut = rs.cut || [];
    gs.forEach((g, i) => { g.classList.toggle('cut', cut.includes(i)); if (cut.includes(i)) g.classList.remove('sel'); });
    btn.querySelector('span').textContent = 'Zum Schneiden antippen';
  }
  c.el.append(box);
  apply(c.rs);
  return {
    update(rs, last, fresh) {
      apply(rs);
      if (!fresh) return;
      const dev = box.querySelector('.wr-device');
      if (last.kind === 'mistake') { dev.classList.remove('alarm'); void dev.offsetWidth; dev.classList.add('alarm'); shake(dev, 9); }
      if (last.kind === 'solved') dev.classList.add('done');
    },
  };
}
function wiresBook(c) {
  const { skin } = c;
  const box = h('div', { class: 'pz book wr-book' });
  const secs = [4, 5, 6].map((k) => `<section class="wr-sec"><h4 class="bk-sub"><span class="wr-k tnum">${k}</span><span>Bei ${k} ${esc(skin.threads)}</span></h4>
    <ol class="wr-rules">${WIRE_RULES[k].map((r) => `<li><span class="wr-if">${esc(r.t.replace('{plate}', skin.plate))}</span><span class="wr-then">${icon('cross')}Schneide ${esc(r.then)}</span></li>`).join('')}</ol></section>`).join('');
  box.innerHTML = page(skin.book, `Frag ${esc(c.partner)}: Wie viele ${esc(skin.threads)}? Welche Farbe hat Nummer 1, 2, 3 …? Und wie lautet die ${esc(skin.plate)}? Die erste passende Regel gilt.`, secs);
  c.el.append(box);
  return {};
}

// =====================================================================
// 3) Nebel-Labyrinth
// =====================================================================
function mazeSVG(spec, { full }) {
  const S = spec.size, u = 100 / S;
  let walls = '';
  if (full) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const w = spec.walls[y * S + x];
      if (w & 1) walls += `M${x * u} ${y * u}H${(x + 1) * u}`;
      if (w & 8) walls += `M${x * u} ${y * u}V${(y + 1) * u}`;
      if (y === S - 1 && w & 4) walls += `M${x * u} ${(y + 1) * u}H${(x + 1) * u}`;
      if (x === S - 1 && w & 2) walls += `M${(x + 1) * u} ${y * u}V${(y + 1) * u}`;
    }
  }
  return { u, walls };
}
function mazeHands(c) {
  const { spec, skin } = c;
  const S = spec.size, u = 100 / S;
  const box = h('div', { class: 'pz mz-hands' });
  box.innerHTML = `
    <div class="mz-board fog" style="--n:${S}" role="img" aria-label="${esc(skin.fog)} – du siehst nur, wo du bist">
      <svg class="mz-svg" viewBox="-2 -2 104 104">
        <g class="mz-cells">${Array.from({ length: S * S }, (_, i) => `<rect class="mz-cell" data-k="${i % S},${Math.floor(i / S)}" x="${(i % S) * u + .6}" y="${Math.floor(i / S) * u + .6}" width="${u - 1.2}" height="${u - 1.2}" rx="${u * .22}"/>`).join('')}</g>
        <circle class="mz-goal" cx="${(spec.goal[0] + .5) * u}" cy="${(spec.goal[1] + .5) * u}" r="${u * .34}"/>
        <path class="mz-bumps" d=""/>
      </svg>
      <div class="mz-me" aria-hidden="true"><i></i></div>
      <div class="mz-mist" aria-hidden="true"></div>
    </div>
    <div class="mz-pad" role="group" aria-label="Richtung">
      <button class="mz-btn w" type="button" data-d="w" aria-label="Links">${icon('back')}</button>
      <button class="mz-btn n" type="button" data-d="n" aria-label="Hoch">${icon('back')}</button>
      <button class="mz-btn s" type="button" data-d="s" aria-label="Runter">${icon('back')}</button>
      <button class="mz-btn e" type="button" data-d="e" aria-label="Rechts">${icon('back')}</button>
    </div>`;
  const board = box.querySelector('.mz-board');
  const meEl = box.querySelector('.mz-me');
  const move = (d) => { c.act({ k: 'move', d }); sfx.tap(); haptic(6); };
  box.querySelector('.mz-pad').addEventListener('click', (e) => { const b = e.target.closest('[data-d]'); if (b) move(b.dataset.d); });
  let p0 = null;
  board.addEventListener('pointerdown', (e) => { p0 = [e.clientX, e.clientY]; });
  board.addEventListener('pointerup', (e) => {
    if (!p0) return;
    const dx = e.clientX - p0[0], dy = e.clientY - p0[1]; p0 = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : (dy > 0 ? 's' : 'n'));
  });
  const onKey = (e) => {
    const d = { ArrowUp: 'n', ArrowDown: 's', ArrowLeft: 'w', ArrowRight: 'e' }[e.key];
    if (d && !e.target.closest('input,textarea')) { e.preventDefault(); move(d); }
  };
  document.addEventListener('keydown', onKey);
  function apply(rs) {
    const seen = new Set(rs.trail);
    box.querySelectorAll('.mz-cell').forEach((r) => {
      r.classList.toggle('seen', seen.has(r.dataset.k));
      r.classList.toggle('here', r.dataset.k === rs.pos.join());
    });
    meEl.style.setProperty('--x', rs.pos[0]); meEl.style.setProperty('--y', rs.pos[1]);
    let d = '';
    for (const k of rs.wallsSeen || []) {
      const [x, y, dir] = k.split(','); const X = +x * u, Y = +y * u;
      if (dir === 'n') d += `M${X} ${Y}H${X + u}`;
      if (dir === 's') d += `M${X} ${Y + u}H${X + u}`;
      if (dir === 'w') d += `M${X} ${Y}V${Y + u}`;
      if (dir === 'e') d += `M${X + u} ${Y}V${Y + u}`;
    }
    box.querySelector('.mz-bumps').setAttribute('d', d);
  }
  c.el.append(box);
  apply(c.rs);
  return {
    update(rs, last, fresh) {
      apply(rs);
      if (!fresh) return;
      if (last.kind === 'bump') {
        sfx.bad();
        const [dx, dy] = DIRS[last.d] || [0, 0];
        if (motionOK()) meEl.querySelector('i').animate([{ transform: 'translate(0,0)' }, { transform: `translate(${dx * 28}%, ${dy * 28}%) scale(.86,1.1)` }, { transform: 'translate(0,0)' }], { duration: 260, easing: 'ease-out' });
        haptic([20, 30, 20]);
      } else if (last.kind === 'act') sfx.flip();
      else if (last.kind === 'solved') { board.classList.add('done'); }
    },
    destroy() { document.removeEventListener('keydown', onKey); },
  };
}
function mazeBook(c) {
  const { spec, skin } = c;
  const S = spec.size;
  const { u, walls } = mazeSVG(spec, { full: true });
  const box = h('div', { class: 'pz book mz-book' });
  box.innerHTML = page(skin.map, `${B(c.partner)} steckt im ${esc(skin.fog)} und sieht nichts. Lotse ${esc(c.partner)} mit „hoch“, „runter“, „links“, „rechts“ ${esc(skin.goalTo)}.`, `
    <div class="mz-map" style="--n:${S}">
      <svg viewBox="-3 -3 106 106" role="img" aria-label="${esc(skin.map)}">
        <rect x="0" y="0" width="100" height="100" rx="3" class="mz-floor"/>
        <path class="mz-trail" d=""/>
        <g class="mz-start"><circle cx="${(spec.start[0] + .5) * u}" cy="${(spec.start[1] + .5) * u}" r="${u * .2}"/></g>
        <g class="mz-goalmark" transform="translate(${(spec.goal[0] + .5) * u} ${(spec.goal[1] + .5) * u})"><circle r="${u * .38}"/><path d="M0 ${-u * .26} L${u * .07} ${-u * .07} L${u * .26} 0 L${u * .07} ${u * .07} L0 ${u * .26} L${-u * .07} ${u * .07} L${-u * .26} 0 L${-u * .07} ${-u * .07} Z"/></g>
        <path class="mz-walls" d="${walls}"/>
        <g class="mz-pos"><circle class="mz-pulse" r="${u * .3}"/><circle r="${u * .26}"/></g>
      </svg>
    </div>
    <p class="mz-legend"><span class="lg me"></span>${esc(c.partner)} <span class="lg goal"></span>${esc(cap(skin.goal.replace(/^(der|die|das) /, '')))}</p>`);
  const pos = box.querySelector('.mz-pos');
  const trail = box.querySelector('.mz-trail');
  function apply(rs) {
    pos.style.transform = `translate(${(rs.pos[0] + .5) * u}px, ${(rs.pos[1] + .5) * u}px)`;
    trail.setAttribute('d', rs.trail.map((k, i) => { const [x, y] = k.split(',').map(Number); return `${i ? 'L' : 'M'}${(x + .5) * u} ${(y + .5) * u}`; }).join(''));
  }
  c.el.append(box);
  apply(c.rs);
  return {
    update(rs, last, fresh) {
      apply(rs);
      if (fresh && last.kind === 'bump') { box.querySelector('.mz-map').classList.remove('bonk'); void box.offsetWidth; box.querySelector('.mz-map').classList.add('bonk'); }
    },
  };
}

// =====================================================================
// 4) Kristall-Echo
// =====================================================================
const NOTE = { rosa: 72, blau: 74, gold: 76, gruen: 79, lila: 81 };
function echoHands(c) {
  const { spec, skin } = c;
  let entry = [];
  let playing = 0;
  let rs = c.rs;
  const box = h('div', { class: 'pz ec-hands' });
  box.innerHTML = `
    <div class="ec-stage">
      <div class="ec-crystals">${ECHO_COLS.map((col) => `<div class="ec-c" data-c="${col}" role="img" aria-label="${esc(colName(col))}">${crystal(col)}<i class="ec-glow" style="--g:${hex(col)}"></i></div>`).join('')}</div>
      <p class="ec-status" aria-live="polite"></p>
      <button class="btn small ec-replay" type="button">${icon('refresh')}<span>Nochmal leuchten</span></button>
    </div>
    <div class="ec-slots" aria-label="Eingabe">${Array.from({ length: spec.L }, () => '<span class="ec-slot"></span>').join('')}</div>
    <div class="ec-pad">${spec.buttons.map((s) => `<button class="ec-key" type="button" data-s="${s}" aria-label="${esc(symName(s))}">${symbol(s, 'currentColor')}</button>`).join('')}
      <button class="ec-key back" type="button" aria-label="Löschen">${icon('undo')}</button></div>`;
  const crys = Object.fromEntries([...box.querySelectorAll('.ec-c')].map((e) => [e.dataset.c, e]));
  const status = box.querySelector('.ec-status');
  const slots = [...box.querySelectorAll('.ec-slot')];
  async function playSeq() {
    const my = ++playing;
    const seq = PUZZLES.echo.seqOf(spec, rs);
    status.textContent = `Die ${skin.lights} leuchten …`;
    box.classList.add('playing');
    await new Promise((r) => setTimeout(r, 450));
    for (const col of seq) {
      if (my !== playing) return;
      const el = crys[col];
      el.classList.add('on');
      sfx.note?.(NOTE[col]);
      await new Promise((r) => setTimeout(r, 560));
      el.classList.remove('on');
      await new Promise((r) => setTimeout(r, 200));
    }
    if (my !== playing) return;
    box.classList.remove('playing');
    status.textContent = `${seq.length} Lichter. Sag ${c.partner} die Farben an!`;
  }
  function drawSlots(state = '') {
    slots.forEach((s, i) => {
      s.innerHTML = entry[i] ? symbol(entry[i], 'currentColor') : '';
      s.classList.toggle('full', !!entry[i]);
    });
    box.querySelector('.ec-slots').dataset.state = state;
  }
  box.querySelector('.ec-pad').addEventListener('click', (e) => {
    const b = e.target.closest('.ec-key');
    if (!b) return;
    if (b.classList.contains('back')) { entry.pop(); drawSlots(); sfx.tap(); return; }
    if (entry.length >= spec.L) return;
    entry.push(b.dataset.s);
    drawSlots();
    const slot = slots[entry.length - 1];
    if (motionOK()) slot.animate([{ transform: 'scale(.4)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
    sfx.note?.(70 + entry.length * 2); haptic(6);
    if (entry.length === spec.L) {
      const seq = entry.slice();
      setTimeout(() => c.act({ k: 'enter', seq }), 260);
    }
  });
  box.querySelector('.ec-replay').addEventListener('click', () => { sfx.tap(); playSeq(); });
  c.el.append(box);
  drawSlots();
  const startT = setTimeout(playSeq, motionOK() ? 2100 : 600); // erst wenn die Tür offen ist
  return {
    update(next, last, fresh) {
      rs = next;
      if (!fresh) return;
      if (last.kind === 'mistake') {
        drawSlots('bad');
        shake(box.querySelector('.ec-slots'), 9);
        setTimeout(() => { entry = []; drawSlots(); playSeq(); }, 1100);
        status.textContent = 'Falsch – eine neue Folge kommt!';
      } else if (last.kind === 'solved') {
        drawSlots('good');
        playing++;
        box.classList.add('done');
        Object.values(crys).forEach((e, i) => setTimeout(() => { e.classList.add('on'); sfx.note?.(72 + i * 3); }, i * 90));
      }
    },
    destroy() { playing++; clearTimeout(startT); },
  };
}
function echoBook(c) {
  const { spec, skin } = c;
  const box = h('div', { class: 'pz book ec-book' });
  box.innerHTML = page(skin.book, `${B(c.partner)} sieht, in welcher Reihenfolge die ${esc(skin.lights)} leuchten, und sagt dir die Farben. Du übersetzt sie in Symbole.`,
    `<ul class="bk-table ec-legend">${ECHO_COLS.map((col) => `<li><span class="bk-crys">${crystal(col)}</span><span class="bk-col">${esc(colName(col))}</span><span class="bk-arrow" aria-hidden="true">→</span><span class="bk-sym">${symbol(spec.legend[col], 'currentColor')}</span><span class="bk-symname">${esc(symName(spec.legend[col]))}</span></li>`).join('')}</ul>`);
  c.el.append(box);
  return {};
}

// =====================================================================
// 5) Trank-Kessel
// =====================================================================
function potionHands(c) {
  const { spec, skin } = c;
  const ingOf = (id) => skin.ingredients.find((x) => x.id === id);
  const box = h('div', { class: 'pz po-hands' });
  box.innerHTML = `
    <div class="po-scene">
      <div class="po-steam" aria-hidden="true"><i></i><i></i><i></i></div>
      <svg class="po-pot" viewBox="0 0 200 150" role="img" aria-label="${esc(skin.pot)}">
        <defs><clipPath id="po-clip-${c.r}"><ellipse cx="100" cy="46" rx="74" ry="16"/></clipPath></defs>
        <path d="M22 50 C22 120 52 142 100 142 C148 142 178 120 178 50 Z" class="po-body"/>
        <ellipse cx="100" cy="46" rx="80" ry="19" class="po-rim"/>
        <ellipse cx="100" cy="46" rx="74" ry="16" class="po-liquid"/>
        <g clip-path="url(#po-clip-${c.r})" class="po-bubbles"><circle cx="70" cy="50" r="6"/><circle cx="110" cy="44" r="4"/><circle cx="136" cy="50" r="5"/><circle cx="92" cy="54" r="3"/></g>
        <path d="M40 100 Q100 116 160 100" class="po-shine"/>
        <path d="M60 140 L52 150 M140 140 L148 150" class="po-feet"/>
      </svg>
      <div class="po-flame" aria-hidden="true"><i></i><i></i><i></i></div>
    </div>
    <p class="po-status" aria-live="polite"></p>
    <div class="po-shelf">${spec.shelf.map((id) => { const x = ingOf(id); return `<button class="po-ing" type="button" data-id="${id}">${symbol(x.sym, x.col)}<span>${esc(x.name)}</span></button>`; }).join('')}</div>`;
  const scene = box.querySelector('.po-scene');
  const status = box.querySelector('.po-status');
  const pot = box.querySelector('.po-pot');
  let busy = false;
  function apply(rs) {
    const col = PUZZLES.potion.colorOf(spec, rs);
    scene.style.setProperty('--liquid', col === 'gold' ? '#FFC21A' : hex(col));
    scene.classList.toggle('gold', col === 'gold');
    status.innerHTML = col === 'gold' ? 'Der Trank leuchtet golden!' : `Der Trank ist <b>${esc(lc(col))}</b>.`;
  }
  box.querySelector('.po-shelf').addEventListener('click', (e) => {
    const b = e.target.closest('.po-ing');
    if (!b || busy) return;
    busy = true;
    haptic(8); sfx.whoosh();
    const from = b.querySelector('svg').getBoundingClientRect();
    const to = pot.getBoundingClientRect();
    const fly = b.querySelector('svg').cloneNode(true);
    fly.classList.add('po-fly');
    Object.assign(fly.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px' });
    document.body.append(fly);
    const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height * .3 - (from.top + from.height / 2);
    const done = () => { fly.remove(); c.act({ k: 'add', ing: b.dataset.id }); setTimeout(() => { busy = false; }, 250); };
    if (!motionOK()) { done(); return; }
    fly.animate([
      { transform: 'translate(0,0) rotate(0) scale(1)' },
      { transform: `translate(${dx * .5}px, ${dy - 90}px) rotate(200deg) scale(1.2)`, offset: .5 },
      { transform: `translate(${dx}px, ${dy}px) rotate(380deg) scale(.4)`, opacity: .6 },
    ], { duration: 620, easing: 'cubic-bezier(.45,0,.55,1)' }).onfinish = done;
  });
  c.el.append(box);
  apply(c.rs);
  return {
    update(rs, last, fresh) {
      apply(rs);
      if (!fresh) return;
      const r = pot.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height * .3;
      if (last.kind === 'mistake') {
        sfx.boom?.(); haptic([30, 40, 30]);
        scene.classList.remove('puff'); void scene.offsetWidth; scene.classList.add('puff');
        burst(x, y, { count: 22, colors: ['#5B5470', '#8B8499', '#3A3348'], shapes: ['circle'], speed: [80, 260], glow: false });
        stamp('Puff!', x, y - 30, { color: '#5B5470' });
        status.textContent = 'Puff! Alles von vorn …';
        setTimeout(() => apply(rs), 900);
      } else if (last.kind === 'act' || last.kind === 'solved') {
        sfx.splash?.();
        ring(x, y, { color: getComputedStyle(scene).getPropertyValue('--liquid').trim() || '#fff', r1: 120, width: 6 });
        burst(x, y, { count: 14, colors: ['#fff', getComputedStyle(scene).getPropertyValue('--liquid').trim()], shapes: ['sparkle', 'circle'], speed: [80, 240] });
        if (last.kind === 'solved') { sfx.sparkle(); burst(x, y, { count: 36, colors: ['#FFC21A', '#FFF3B0', '#fff'], shapes: ['star', 'sparkle'], speed: [160, 420] }); }
      }
    },
  };
}
function potionBook(c) {
  const { spec, skin } = c;
  const ingOf = (id) => skin.ingredients.find((x) => x.id === id);
  const box = h('div', { class: 'pz book po-book' });
  box.innerHTML = page(skin.book, `${B(c.partner)} sagt dir, welche Farbe der Trank im ${esc(skin.pot)} hat. Dann sagst du, was hinein muss. Fertig ist er, wenn er golden leuchtet.`,
    `<ul class="po-recipe">${spec.book.map((e) => { const x = ingOf(e.add); return `<li><span class="po-drop" style="--c:${hex(e.when)}" aria-hidden="true"></span><span class="po-when">Ist der Trank <b>${esc(lc(e.when))}</b>:</span><span class="po-add">${symbol(x.sym, x.col)}<b>${esc(x.name)}</b></span></li>`; }).join('')}</ul>`);
  c.el.append(box);
  return {};
}

// =====================================================================
// 6) Tresor-Rechnung
// =====================================================================
function safeHands(c) {
  const { spec, skin } = c;
  const objOf = (id) => skin.objects.find((x) => x.id === id);
  let code = '';
  const box = h('div', { class: 'pz sf-hands' });
  box.innerHTML = `
    <div class="sf-room" role="img" aria-label="${esc(skin.scene || 'Raum')} mit vielen Dingen">
      <span class="sf-label">${esc(skin.scene || 'Raum')}</span>
      ${spec.place.map((o, i) => { const x = objOf(o.id); return `<span class="sf-obj" style="left:${o.x}%;top:${o.y}%;--r:${o.r}deg;--s:${o.s};--i:${i}">${symbol(x.sym, x.col)}</span>`; }).join('')}
    </div>
    <div class="sf-safe">
      <div class="sf-door">
        <div class="sf-display" aria-live="polite">${Array.from({ length: spec.len }, () => '<span class="sf-d"></span>').join('')}</div>
        <div class="sf-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="sf-k" type="button" data-n="${n}">${n}</button>`).join('')}
          <button class="sf-k fn" type="button" data-n="back" aria-label="Löschen">${icon('undo')}</button>
          <button class="sf-k" type="button" data-n="0">0</button>
          <button class="sf-k fn ok" type="button" data-n="ok" aria-label="Öffnen">${icon('check')}</button></div>
      </div>
    </div>`;
  const ds = [...box.querySelectorAll('.sf-d')];
  const draw = (state = '') => { ds.forEach((d, i) => { d.textContent = code[i] ?? ''; }); box.querySelector('.sf-display').dataset.state = state; };
  box.querySelector('.sf-room').addEventListener('click', (e) => {
    const o = e.target.closest('.sf-obj');
    if (o && motionOK()) o.animate([{ transform: 'translate(-50%,-50%) rotate(var(--r)) scale(var(--s))' }, { transform: 'translate(-50%,-62%) rotate(calc(var(--r) + 14deg)) scale(calc(var(--s) * 1.2))' }, { transform: 'translate(-50%,-50%) rotate(var(--r)) scale(var(--s))' }], { duration: 360, easing: 'ease-out' });
  });
  box.querySelector('.sf-keys').addEventListener('click', (e) => {
    const b = e.target.closest('.sf-k');
    if (!b) return;
    const n = b.dataset.n;
    if (n === 'back') { code = code.slice(0, -1); draw(); sfx.tap(); return; }
    if (n === 'ok') {
      if (code.length < spec.len) { shake(box.querySelector('.sf-display'), 5); return; }
      sfx.click(); haptic(12);
      c.act({ k: 'open', code });
      return;
    }
    if (code.length >= spec.len) return;
    code += n; draw(); sfx.tick(); haptic(5);
  });
  c.el.append(box);
  draw();
  return {
    update(rs, last, fresh) {
      if (!fresh) return;
      if (last.kind === 'mistake') {
        draw('bad'); shake(box.querySelector('.sf-door'), 8);
        setTimeout(() => { code = ''; draw(); }, 900);
      } else if (last.kind === 'solved') {
        draw('good');
        box.querySelector('.sf-safe').classList.add('open');
      }
    },
  };
}
function safeBook(c) {
  const { spec, skin } = c;
  const objOf = (id) => skin.objects.find((x) => x.id === id);
  const box = h('div', { class: 'pz book sf-book' });
  box.innerHTML = page(skin.book, `${B(c.partner)} sieht den Raum und kann die Dinge zählen. Frag nach den Zahlen und rechne. Bei zwei Ziffern zählt nur die letzte.`, `
    <div class="sf-legend">${spec.objs.map((id) => { const x = objOf(id); return `<span>${symbol(x.sym, x.col)}${esc(x.pl)}</span>`; }).join('')}</div>
    <ol class="sf-lines">${spec.lines.map((l, i) => `<li><span class="sf-n">${i + 1}. Ziffer</span><span class="sf-f">${esc(l.text)}</span><input class="sf-in tnum" inputmode="numeric" maxlength="2" autocomplete="off" aria-label="Notiz für Ziffer ${i + 1}"></li>`).join('')}</ol>`);
  c.el.append(box);
  return {};
}

// =====================================================================
// 7) Aufstellung
// =====================================================================
function lineupHands(c) {
  const { spec, skin } = c;
  let sel = -1;
  const struck = new Set();
  const box = h('div', { class: 'pz lu-hands' });
  box.innerHTML = `
    <div class="lu-stage">${spec.people.map((pp, i) => `<button class="lu-fig" type="button" data-i="${i}" aria-label="Figur ${i + 1}: ${esc(lc(pp.c))}, ${esc(skin.accessories.find((a) => a.id === pp.a)?.name || '')}, ${pp.d}">
      <span class="lu-in" style="--i:${i}">${figure(skin.figure, pp)}</span><span class="lu-n">${i + 1}</span></button>`).join('')}</div>
    <div class="row lu-acts">
      <button class="btn lu-strike" type="button" disabled>${icon('eyeoff')}<span>Streichen</span></button>
      <button class="btn primary lu-pick" type="button" disabled>${icon('target')}<span>Figur wählen</span></button>
    </div>`;
  const figs = [...box.querySelectorAll('.lu-fig')];
  const strikeBtn = box.querySelector('.lu-strike');
  const pickBtn = box.querySelector('.lu-pick');
  let wrong = [];
  function refresh() {
    figs.forEach((f, i) => {
      f.classList.toggle('sel', i === sel);
      f.classList.toggle('struck', struck.has(i));
      f.classList.toggle('wrong', wrong.includes(i));
      f.disabled = wrong.includes(i);
    });
    strikeBtn.disabled = pickBtn.disabled = sel < 0;
    strikeBtn.querySelector('span').textContent = struck.has(sel) ? 'Zurück' : 'Streichen';
    pickBtn.querySelector('span').textContent = sel < 0 ? 'Figur wählen' : `Nr. ${sel + 1} ist es!`;
  }
  box.querySelector('.lu-stage').addEventListener('click', (e) => {
    const f = e.target.closest('.lu-fig');
    if (!f || f.disabled) return;
    sel = +f.dataset.i === sel ? -1 : +f.dataset.i;
    sfx.tap(); haptic(6);
    refresh();
  });
  strikeBtn.addEventListener('click', () => {
    if (sel < 0) return;
    if (struck.has(sel)) struck.delete(sel); else struck.add(sel);
    sfx.flip(); sel = -1; refresh();
  });
  pickBtn.addEventListener('click', () => {
    if (sel < 0) return;
    sfx.click(); haptic(12);
    c.act({ k: 'pick', i: sel });
  });
  c.el.append(box);
  wrong = c.rs.wrong || [];
  refresh();
  return {
    update(rs, last, fresh) {
      wrong = rs.wrong || [];
      if (wrong.includes(sel)) sel = -1;
      refresh();
      if (!fresh) return;
      if (last.kind === 'mistake') {
        const f = figs[wrong[wrong.length - 1]];
        if (f) {
          const p = centerOf(f);
          burst(p.x, p.y, { count: 20, colors: ['#8B8499', '#C9C3D6', '#5B5470'], shapes: ['circle'], speed: [80, 240], glow: false });
          sfx.bad();
        }
      } else if (last.kind === 'solved') {
        const f = figs[spec.target];
        f.classList.add('found');
        const p = centerOf(f);
        burst(p.x, p.y, { count: 30, shapes: ['star', 'sparkle', 'heart'], speed: [140, 380] });
        ring(p.x, p.y, { color: '#FFF3B0', r1: 140 });
      }
    },
  };
}
function lineupBook(c) {
  const { spec, skin } = c;
  const box = h('div', { class: 'pz book lu-book' });
  box.innerHTML = page(skin.book, `${B(c.partner)} sieht sechs ${esc(skin.figures)}. Lies die Hinweise vor – ${esc(c.partner)} streicht weg, wer nicht passt. Tipp auf einen Hinweis zum Abhaken.`, `
    <div class="lu-poster">
      <div class="lu-sil">${silhouette(skin.figure)}<span>?</span></div>
      <p class="lu-wanted">Gesucht:<b>${esc(skin.target)}</b></p>
    </div>
    <ul class="lu-clues">${spec.clues.map((t) => `<li><button class="lu-clue" type="button" aria-pressed="false"><span class="lu-check">${icon('check')}</span><span>${esc(skin.target)} ${esc(t)}.</span></button></li>`).join('')}</ul>`);
  box.querySelector('.lu-clues').addEventListener('click', (e) => {
    const b = e.target.closest('.lu-clue');
    if (!b) return;
    b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
    sfx.tap();
  });
  c.el.append(box);
  return {};
}

// =====================================================================
const VIEWS = {
  lock: [lockHands, lockBook], wires: [wiresHands, wiresBook], maze: [mazeHands, mazeBook], echo: [echoHands, echoBook],
  potion: [potionHands, potionBook], safe: [safeHands, safeBook], lineup: [lineupHands, lineupBook],
};
export function mountPuzzle(c) {
  const [hands, book] = VIEWS[c.kind];
  const api = (c.role === 'hands' ? hands : book)(c) || {};
  return { update: api.update || (() => {}), destroy: api.destroy || (() => {}) };
}

// Kurztext: was die eigene Rolle in diesem Raum tun soll
export function roleLine(kind, role, skin, partner) {
  const L = {
    lock: [`Sag ${partner} die Farben der ${skin.gems}. Dann stell die Symbole ein und öffne.`, 'Frag nach den Farben und sag, welche Symbole eingestellt werden.'],
    wires: [`Beschreib ${partner} die ${skin.threads} und die ${skin.plate}. Dann schneid den richtigen durch.`, 'Frag nach Anzahl und Farben und finde die passende Regel.'],
    maze: [`Du steckst im ${skin.fog}. ${partner} lotst dich – wisch übers Feld oder tipp die Pfeile.`, `Lotse ${partner} ${skin.goalTo}.`],
    echo: [`Sag ${partner} die Farben der leuchtenden ${skin.lights} – und tipp die Symbole.`, 'Übersetze die Farben in Symbole.'],
    potion: [`Sag ${partner} die Farbe im ${skin.pot} und gib die Zutaten hinein.`, 'Sag, welche Zutat als Nächstes hinein muss.'],
    safe: [`Zähl die Dinge im Raum für ${partner} und tipp den Code ein.`, 'Frag nach den Zahlen und rechne die Ziffern aus.'],
    lineup: ['Streich weg, wer nicht passt, und tipp die richtige Figur an.', 'Lies die Hinweise vor, bis nur noch eine Figur übrig ist.'],
  };
  return L[kind][role === 'hands' ? 0 : 1];
}
