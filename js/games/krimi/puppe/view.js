// Krimi Fall 2 „Seid ihr alle da?“ – Oberfläche: Begrüßung, Szenen mit Rollen, fünf Rätsel, Fäden, Tribunal,
// Finale (Naht, Brief, gemeinsam ziehen), Blut-Effekte, Vorhang-Übergänge, Ende.
import { h, esc } from '../../../core/dom.js';
import { miniHalf } from '../../../art/heart.js';
import { me, get, set, on } from '../../../core/store.js';
import { nameOf, other, sleep } from '../../../core/util.js';
import { sheet, toast, confirmBox, announce } from '../../../core/ui.js';
import { motionOK } from '../../../core/theme.js';
import { burst, flash, stamp, shake } from '../../../core/fx.js';
import { sfx, haptic } from '../../../core/sound.js';
import { nav } from '../../../core/router.js';
import { addEvent, getSession, sendFx, createSession } from '../../../core/sync.js';
import { netState } from '../../../core/net.js';
import { shell } from '../../common.js';
import { portrait } from '../art.js';
import { reduce } from '../logic.js';
import { SCENES, roleOf, whoHas, elapsed, remaining, timeUpNow, FADEN_MS, PULL_MS, START_BLOOD } from './logic.js';
import { PUZ, COLORS, LEVEL_NAME } from './puzzles.js';
import { TITLE, SUB, TAG, INTRO, WAKE, HELLO, OUCH, FADEN, FADEN_RULE, FADEN_TIMEOUT, DOCS, TRIBUNAL, FINALE, ENDINGS, GUEST_FATE, PEOPLE2, RULES2, DIFFS } from './story.js';
import { kasperl, theaterScene, puppetBody, puppetSketch, floorView, stageView, shadowCard, shadowScreen, organ, crocRail, gauge, seamChest } from './art.js';

const RECKEY = 'krimiRecords';
const anrede = (p) => (p === 'jos' ? 'Frau Kommissarin' : 'Herr Kommissar');
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const liters = (l) => `${(Math.round(l * 100) / 100).toLocaleString('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} L`;
const LIMBS = ['lh', 'rh', 'lf', 'rf'];
const PNAME = { brandl: 'Rudolf Brandl', haslinger: 'Erwin Haslinger', gerda: 'Gerda Pfeiffer', anton: 'Anton Weißhaupt (der Vater)', marianne: 'Marianne Weißhaupt (die Mutter)', tobias: 'Tobias Weißhaupt (10, der Sohn)' };

export function play2(root, sid) {
  const p = me.get();
  const q = other(p);
  const { el, body, cleanup: shellOff } = shell({ root, game: 'krimi', sid, rules: RULES2 });
  el.classList.add('kr-play', 'k2-play');
  const back = h('div', { class: 'kr-backdrop k2-backdrop', 'aria-hidden': 'true' });
  back.innerHTML = '<i class="kr-grain"></i><i class="k2-spotlight"></i><i class="kr-vignette"></i>';
  el.prepend(back);
  const compute = () => { const s = getSession(sid); return reduce(s.meta, s.evs); };
  let st = compute();
  const LKEY = 'k2_' + sid;
  const local = Object.assign({ seenDocs: [] }, get(LKEY, {}) || {});
  if (!get(LKEY, null)) { local.seenDocs = [...st.docs[p]]; set(LKEY, local); }
  const saveLocal = () => set(LKEY, local);
  let feedN = st.feed.length;
  let mode = '', sceneKey = '';
  let alive = true;
  let view = null, stageBox = null, scene = null;
  let tick = null;
  let typer = null;
  const sent = new Set(); // Zeitereignisse nur einmal schicken
  const offs = [];
  const fill = (s, roles) => {
    let out = String(s ?? '').replaceAll('{K}', anrede(p));
    if (roles) for (const r of roles) out = out.replaceAll(`{${r}}`, nameOf(whoHas(st, r)));
    out = out.replaceAll('{zeit}', `${Math.round(st.limit / 60e3)} Minuten`);
    return out;
  };
  const roles = () => SCENES[st.scene]?.roles || [];

  // ---------- Steuerung ----------
  function update() {
    if (!alive) return;
    const prev = st;
    st = compute();
    const fresh = st.feed.slice(feedN);
    feedN = st.feed.length;
    const want = st.phase === 'end' ? 'end' : st.phase === 'play' ? 'play' : 'hello';
    if (want !== mode) {
      const was = mode;
      mode = want;
      if (want === 'hello') mountHello();
      else if (want === 'play') mountPlay(was === 'hello');
      else mountEnd(was === 'play');
      return;
    }
    if (mode === 'hello') { updateHello(); return; }
    if (mode !== 'play') return;
    const key = `${st.scene}`;
    if (key !== sceneKey) { switchScene(prev); handleFeed(fresh, true); return; }
    renderHud();
    scene?.update?.(fresh);
    handleFeed(fresh, false);
  }

  // =====================================================================
  // Begrüßung: »Seid ihr alle da?«
  // =====================================================================
  function mountHello() {
    const mine = p === st.first ? 'first' : 'other';
    view = h('div', { class: 'k2-hello' });
    view.innerHTML = `
      <div class="k2-hero">${theaterScene({ seed: sid })}<div class="k2-hero-shade"></div>
        <span class="kr-warn">Blutig · ab 16</span>
        <div class="k2-hero-text"><span class="kr-tag">${esc(TAG)}</span><h2 class="kr-title">${esc(TITLE)}</h2><span class="k2-sub">${esc(SUB)}</span></div></div>
      <div class="kr-story k2-story" role="button" tabindex="0" aria-label="Geschichte (antippen zum Überspringen)">${[...INTRO, WAKE[mine], HELLO.ask].map((t, i) => `<p class="kr-para${i === INTRO.length + 1 ? ' k2-ask' : ''}">${esc(t)}</p>`).join('')}</div>
      <div class="k2-ja">
        <div class="k2-ja-k">${kasperl('talk')}</div>
        <div class="k2-ja-row"></div>
        <button class="btn primary big block k2-ja-btn" type="button"><span>»Ja!«</span></button>
      </div>`;
    body.replaceChildren(view);
    view.querySelector('.k2-ja-btn').addEventListener('click', () => {
      typer?.finish();
      sfx.pop(); haptic([20, 30, 20]);
      addEvent(sid, 'ready', {});
    });
    const story = view.querySelector('.k2-story');
    typer = typewriter([...story.querySelectorAll('.kr-para')]);
    story.addEventListener('click', () => typer.finish());
    musicBox();
    updateHello();
  }
  function updateHello() {
    if (!view?.classList.contains('k2-hello')) return;
    view.querySelector('.k2-ja-row').innerHTML = ['jos', 'joh'].map((x) => `<span class="kr-rd ${x} ${st.ready[x] ? 'on' : ''}">${miniHalf(x)}<b>${esc(nameOf(x))}</b><i>${st.ready[x] ? '»Ja!«' : '…'}</i></span>`).join('');
    const b = view.querySelector('.k2-ja-btn');
    if (st.ready[p]) { b.disabled = true; b.querySelector('span').textContent = st.ready[q] ? '»Ich hör euch!«' : `Warte auf ${nameOf(q)} …`; }
  }
  function typewriter(paras) {
    const texts = paras.map((x) => x.textContent);
    let stop = false;
    const finish = () => { stop = true; paras.forEach((x, i) => { x.textContent = texts[i]; x.classList.add('shown'); }); };
    if (!motionOK()) { finish(); return { finish }; }
    paras.forEach((x) => { x.textContent = ''; });
    (async () => {
      await sleep(600);
      for (let i = 0; i < paras.length && !stop; i++) {
        const x = paras[i];
        x.classList.add('shown', 'typing');
        let k = 0;
        while (k < texts[i].length && !stop) { k = Math.min(texts[i].length, k + 2); x.textContent = texts[i].slice(0, k); if (k % 6 === 0) sfx.key(); await sleep(20); }
        x.classList.remove('typing');
        if (!stop) await sleep(300);
      }
    })();
    return { finish };
  }
  // Spieluhr: eine kleine schiefe Melodie
  function musicBox() {
    if (!motionOK()) return;
    [79, 76, 79, 76, 74, 72, 71, 72].forEach((m, i) => setTimeout(() => { if (alive && mode === 'hello') sfx.note(m); }, 900 + i * 420));
  }

  // =====================================================================
  // Spiel-Gerüst
  // =====================================================================
  function mountPlay(fromHello) {
    typer?.finish();
    view = h('div', { class: 'k2-view' });
    view.innerHTML = `
      <div class="k2-hud" role="group" aria-label="Zeit und Blut">
        <div class="k2-timer" role="timer"><span class="k2-time tnum">–:––</span><small>bis der Vorhang fällt</small></div>
        <div class="k2-bloods">${['jos', 'joh'].map((x) => `<div class="k2-vial ${x}${x === p ? ' me' : ''}" data-p="${x}"><i><b></b></i><span><em>${x === p ? 'Du' : esc(nameOf(x))}</em><small class="tnum"></small></span></div>`).join('')}</div>
        <div class="k2-hudbtns">
          <button class="k2-hbtn" type="button" data-a="docs" aria-label="Mappe">${icoDocs()}<b class="k2-badge" hidden></b></button>
          <button class="k2-hbtn" type="button" data-a="hint" aria-label="Tipp vom Kasperl (kostet Blut)">${icoHint()}</button>
          <button class="k2-hbtn" type="button" data-a="donate" aria-label="Blut spenden">${icoDrop()}</button>
        </div>
      </div>
      <ol class="k2-dots" aria-label="Szenen">${SCENES.map((s, i) => `<li data-i="${i}" title="${esc(s.title)}"></li>`).join('')}</ol>
      <div class="k2-stagebox"></div>`;
    body.replaceChildren(view);
    stageBox = view.querySelector('.k2-stagebox');
    view.querySelector('.k2-hud').addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'docs') openDocs();
      if (a === 'hint') askHint();
      if (a === 'donate') donate();
    });
    sceneKey = '';
    switchScene(null, fromHello);
    clearInterval(tick);
    tick = setInterval(onTick, 250);
  }
  function renderHud() {
    if (!view?.classList.contains('k2-view')) return;
    const rem = remaining(st);
    const t = view.querySelector('.k2-time');
    t.textContent = st.timeUp ? '0:00' : mmss(rem);
    view.querySelector('.k2-timer').classList.toggle('paused', !st.runT);
    view.querySelector('.k2-timer').classList.toggle('late', rem < 5 * 60e3);
    for (const x of ['jos', 'joh']) {
      const v = view.querySelector(`.k2-vial[data-p="${x}"]`);
      const l = st.blood[x];
      v.querySelector('b').style.height = `${(l / START_BLOOD) * 100}%`;
      v.querySelector('small').textContent = liters(l);
      v.classList.toggle('low', l <= 2.5);
    }
    view.querySelectorAll('.k2-dots li').forEach((li, i) => { li.className = i < st.scene ? 'done' : i === st.scene ? 'now' : ''; });
    const newDocs = st.docs[p].filter((d) => !local.seenDocs.includes(d)).length;
    const bd = view.querySelector('.k2-badge');
    bd.hidden = !newDocs; bd.textContent = newDocs || '';
    const l = st.blood[p];
    el.dataset.blood = l <= 1 ? 'dying' : l <= 1.5 ? 'crit' : l <= 2.5 ? 'low' : 'ok';
    const sc = SCENES[st.scene];
    const hb = view.querySelector('[data-a="hint"]');
    hb.disabled = !(sc.kind === 'puzzle' && st.sub === 'play') && sc.kind !== 'tribunal';
    view.querySelector('[data-a="donate"]').disabled = st.blood[p] <= 1.5 || st.blood[q] >= START_BLOOD;
  }
  function onTick() {
    if (!alive || mode !== 'play') return;
    const now = Date.now();
    const t = view?.querySelector('.k2-time');
    if (t) t.textContent = st.timeUp ? '0:00' : mmss(remaining(st, now));
    if (timeUpNow(st, now) && !sent.has('timeup' + st.limit)) { sent.add('timeup' + st.limit); addEvent(sid, 'timeup', {}); }
    const sc = SCENES[st.scene];
    if (sc.kind === 'puzzle' && sc.id === 'marionette' && st.sub === 'play' && !st.timeUp) {
      const dl = st.ps[st.scene].deadline;
      if (dl && now >= dl && !sent.has('nails' + dl)) { sent.add('nails' + dl); addEvent(sid, 'act', { s: st.scene, k: 'nails' }); }
    }
    if (sc.kind === 'faden' && st.sub === 'vote' && now >= st.voteT + FADEN_MS && !sent.has('vt' + st.scene)) { sent.add('vt' + st.scene); addEvent(sid, 'votetimeout', { s: st.scene }); }
    if (sc.kind === 'finale' && st.fin.step === 'pull' && now >= st.fin.pullT + PULL_MS && !sent.has('pf')) { sent.add('pf'); addEvent(sid, 'pullfail', {}); }
    scene?.tick?.(now);
  }

  // ---------- Szenenwechsel mit Vorhang ----------
  async function switchScene(prev, animate = true) {
    sceneKey = `${st.scene}`;
    const sc = SCENES[st.scene];
    const build = () => {
      if (!alive) return;
      scene?.destroy?.();
      scene = null;
      stageBox.replaceChildren();
      if (sc.kind === 'puzzle') scene = mountPuzzle();
      else if (sc.kind === 'reveal') scene = mountReveal();
      else if (sc.kind === 'faden') scene = mountFaden();
      else if (sc.kind === 'tribunal') scene = mountTribunal();
      else scene = mountFinale();
      renderHud();
      scene?.update?.([]);
      window.scrollTo(0, 0);
    };
    if (!animate || !motionOK() || prev === undefined) { build(); return; }
    await curtain(`${sc.act}`, sc.title, build);
  }
  async function curtain(kick, title, swap) {
    const c = h('div', { class: 'k2-curtain-ov', 'aria-hidden': 'true' });
    c.innerHTML = `<i class="l"></i><i class="r"></i><div class="k2-ct"><span>${esc(kick)}</span><b>${esc(title)}</b></div>`;
    document.body.append(c);
    sfx.whoosh();
    await sleep(560);
    swap();
    await sleep(900);
    c.classList.add('open');
    await sleep(800);
    c.remove();
  }

  // ---------- Kasperl-Zeile ----------
  function kasperlRow(text, mood = 'talk') {
    return `<div class="k2-k"><div class="k2-k-pup">${kasperl(mood)}</div><p class="k2-bubble">${esc(text)}</p></div>`;
  }
  function roleCard(text, danger) {
    return `<div class="k2-role${danger ? ' danger' : ''}"><span class="k2-role-ic">${danger ? icoDrop() : icoEye()}</span><p>${esc(text)}</p></div>`;
  }
  function donePanel(s) {
    const sc = SCENES[s];
    const docs = (sc.docs || []).filter(([w]) => (w === 'first' ? st.first : other(st.first)) === p).map(([, d]) => d);
    return `<div class="k2-done">
      <p class="k2-done-x">${esc(fill(sc.done, sc.roles))}</p>
      ${sc.applause ? kasperlRow(sc.applause, 'grin') : ''}
      ${docs.length ? `<div class="k2-gotdocs">${docs.map((d) => `<button class="k2-doc" type="button" data-doc="${d}">${icoDocs()}<span><small>Neu in deiner Mappe</small>${esc(DOCS[d].t)}</span></button>`).join('')}</div>` : `<p class="k2-nodoc">${esc(nameOf(q))} hat etwas gefunden. Lass es dir vorlesen!</p>`}
      <button class="btn primary big block" type="button" data-a="next">Weiter</button>
      <p class="k2-wait" data-slot="wait"></p></div>`;
  }
  function bindDone(box) {
    box.addEventListener('click', (e) => {
      const d = e.target.closest('[data-doc]');
      if (d) { openDoc(d.dataset.doc); return; }
      const b = e.target.closest('[data-a="next"]');
      if (b) { b.disabled = true; sfx.pop(); addEvent(sid, 'next', { s: st.scene }); }
    });
  }
  function waitLine(box) {
    const w = box.querySelector('[data-slot="wait"]');
    if (!w) return;
    const meR = st.nextReady[p], themR = st.nextReady[q];
    w.textContent = meR && !themR ? `Warte auf ${nameOf(q)} …` : !meR && themR ? `${nameOf(q)} ist bereit.` : '';
    const b = box.querySelector('[data-a="next"]');
    if (b) b.disabled = !!meR;
  }

  // =====================================================================
  // Rätsel-Szenen
  // =====================================================================
  function mountPuzzle() {
    const s = st.scene;
    const sc = SCENES[s];
    const myRole = roleOf(st, p);
    const danger = sc.danger === myRole;
    const box = h('div', { class: `k2-scene k2-${sc.id} role-${myRole}` });
    box.innerHTML = `
      ${kasperlRow(fill(sc.kasperl, sc.roles))}
      ${roleCard(fill(sc.role[myRole], sc.roles), danger)}
      <div class="k2-puz"></div>
      <div class="k2-donebox"></div>`;
    stageBox.append(box);
    const puz = box.querySelector('.k2-puz');
    const doneBox = box.querySelector('.k2-donebox');
    bindDone(doneBox);
    const P = PUZ[sc.id];
    const spec = st.specs[s];
    const inner = ({ marionette: puzMarionette, blutspur: puzBlutspur, drehbuehne: puzDreh, schatten: puzSchatten, orgel: puzOrgel })[sc.id](puz, spec, myRole, P);
    let shownDone = false;
    return {
      update(fresh) {
        if (st.scene !== s) return;
        inner.update?.(fresh);
        if (st.sub === 'done') {
          if (!shownDone) {
            shownDone = true;
            puz.classList.add('solved');
            doneBox.innerHTML = donePanel(s);
            if (motionOK()) doneBox.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.22,1,.36,1)' });
            setTimeout(() => doneBox.scrollIntoView?.({ block: 'start', behavior: motionOK() ? 'smooth' : 'auto' }), 200);
          }
          waitLine(doneBox);
        }
      },
      tick: (now) => inner.tick?.(now),
      destroy: () => inner.destroy?.(),
    };
  }
  const act = (d) => addEvent(sid, 'act', { s: st.scene, ...d });
  const locked = () => st.sub !== 'play' || st.timeUp;

  // ---------- 1) Marionette ----------
  function puzMarionette(box, spec, role, P) {
    const colorsByLimb = LIMBS.map((limb) => COLORS[spec.map.indexOf(limb)].hex);
    if (role === 'puppe') {
      box.innerHTML = `<div class="k2-bodywrap"></div>
        <p class="k2-nail tnum" aria-live="polite"></p>
        <button class="btn primary big block" type="button" data-a="grab">Nach dem Schlüssel greifen</button>`;
      const wrap = box.querySelector('.k2-bodywrap');
      const draw = (hurt = false) => {
        const ps = st.ps[st.scene];
        const total = spec.nail * 1e3;
        const drop = ps.deadline ? Math.min(1, Math.max(0, 1 - (ps.deadline - Date.now()) / total)) : 0;
        wrap.innerHTML = puppetBody({ pos: P.posture(spec, ps), colors: colorsByLimb, danger: spec.danger, drop, hurt });
      };
      box.querySelector('[data-a="grab"]').addEventListener('click', (e) => { if (locked()) return; sfx.click(); haptic(10); act({ k: 'grab' }); e.currentTarget.blur(); });
      draw();
      let lastDraw = 0;
      return {
        update(fresh) { draw(fresh.some((f) => f.k === 'hurt' && f.who === p)); box.querySelector('[data-a="grab"]').disabled = locked(); },
        tick(now) {
          const ps = st.ps[st.scene];
          if (ps.deadline) box.querySelector('.k2-nail').textContent = `Das Seil sinkt: ${mmss(ps.deadline - now)}`;
          if (now - lastDraw > 1000) { lastDraw = now; draw(); }
        },
      };
    }
    // Spielkreuz
    box.innerHTML = `
      <div class="k2-cross" role="group" aria-label="Spielkreuz">${spec.order.map((c) => `
        <div class="k2-string" data-c="${c}" style="--c:${COLORS[c].hex}">
          <i class="k2-thread"></i>
          ${[2, 1, 0].map((v) => `<button type="button" data-c="${c}" data-v="${v}" aria-label="${COLORS[c].name} ${LEVEL_NAME[v]}">${LEVEL_NAME[v]}</button>`).join('')}
          <span class="k2-sname">${COLORS[c].name}</span></div>`).join('')}</div>
      <figure class="k2-sketchbox">${puppetSketch(spec.target)}<figcaption>Skizze auf der Werkbank</figcaption></figure>`;
    const draw = () => {
      const lv = st.ps[st.scene].lv;
      box.querySelectorAll('.k2-string').forEach((col) => {
        const c = +col.dataset.c;
        col.style.setProperty('--lv', lv[c]);
        col.querySelectorAll('button').forEach((b) => { b.setAttribute('aria-pressed', String(+b.dataset.v === lv[c])); b.disabled = locked(); });
      });
    };
    box.querySelector('.k2-cross').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]');
      if (!b || locked()) return;
      sfx.tap(); haptic(6);
      act({ k: 'set', c: +b.dataset.c, v: +b.dataset.v });
    });
    draw();
    return { update: draw };
  }

  // ---------- 2) Blutspur ----------
  function puzBlutspur(box, spec, role) {
    if (role === 'oben') {
      const lines = [];
      box.innerHTML = '<div class="k2-floorwrap no-drag"></div><p class="k2-mini">Tippe Tropfen an, um ihre Flugbahn zu verlängern. Die runde, dicke Seite zeigt zum Ursprung.</p>';
      const wrap = box.querySelector('.k2-floorwrap');
      const draw = () => { wrap.innerHTML = floorView(spec, { view: 'oben', lines }); };
      wrap.addEventListener('click', (e) => {
        const g = e.target.closest('[data-drop]');
        if (!g) return;
        const i = +g.dataset.drop;
        const k = lines.indexOf(i);
        if (k >= 0) lines.splice(k, 1); else lines.push(i);
        sfx.draw(); haptic(6);
        draw();
      });
      draw();
      return {};
    }
    let sel = null;
    box.innerHTML = `<div class="k2-floorwrap no-drag"></div>
      <button class="btn primary big block" type="button" data-a="pry" disabled>Brett aufstemmen</button>`;
    const wrap = box.querySelector('.k2-floorwrap');
    const btn = box.querySelector('[data-a="pry"]');
    const draw = () => { wrap.innerHTML = floorView(spec, { view: 'unten', tried: st.ps[st.scene].tried, sel }); btn.disabled = sel == null || locked(); };
    wrap.addEventListener('click', (e) => {
      const r = e.target.closest('[data-c]');
      if (!r || r.classList.contains('mark') || r.classList.contains('tried') || locked()) return;
      sel = +r.dataset.c;
      sfx.tap();
      draw();
    });
    btn.addEventListener('click', () => { if (sel == null) return; sfx.crack(); haptic(12); act({ k: 'plank', c: sel }); sel = null; draw(); });
    draw();
    return { update: draw };
  }

  // ---------- 3) Drehbühne ----------
  function puzDreh(box, spec, role, P) {
    const turns = () => P.turns(spec, st.ps[st.scene].steps);
    const toTurn = () => spec.every - (st.ps[st.scene].steps % spec.every);
    if (role === 'blind') {
      box.innerHTML = `<div class="k2-sack"><p class="k2-sack-x" aria-live="polite">Du siehst nichts. Unter deinen Füßen knarrt die Bühne.</p>
        <p class="k2-sack-n tnum"></p></div>
        <div class="k2-pad">
          <button type="button" data-k="left" aria-label="Nach links drehen">↶<small>links drehen</small></button>
          <button type="button" data-k="step" class="go" aria-label="Einen Schritt vorwärts">↑<small>Schritt</small></button>
          <button type="button" data-k="right" aria-label="Nach rechts drehen">↷<small>rechts drehen</small></button>
          <button type="button" data-k="feel" class="feel" aria-label="Mit dem Fuß tasten">🦶<small>tasten</small></button>
        </div>`;
      const msg = box.querySelector('.k2-sack-x');
      const info = () => {
        const ps = st.ps[st.scene];
        box.querySelector('.k2-sack-n').textContent = `Drehung in ${toTurn()} ${toTurn() === 1 ? 'Schritt' : 'Schritten'} · Tasten: noch ${spec.feels - ps.feels}`;
        box.querySelectorAll('.k2-pad button').forEach((b) => { b.disabled = locked() || (b.dataset.k === 'feel' && ps.feels >= spec.feels); });
      };
      box.querySelector('.k2-pad').addEventListener('click', (e) => {
        const b = e.target.closest('[data-k]');
        if (!b || locked()) return;
        sfx.tap(); haptic(8);
        act({ k: b.dataset.k });
      });
      info();
      let lastSteps = st.ps[st.scene].steps, lastSpun = st.ps[st.scene].spun || 0;
      return {
        update(fresh) {
          const ps = st.ps[st.scene];
          for (const f of fresh) {
            if (f.k === 'act' && f.by === p) {
              if (f.info === 'wand') msg.textContent = 'Du stößt gegen eine Wand.';
              else if (f.a === 'feel') msg.textContent = ps.feel === 'loch' ? 'Dein Fuß tastet ins Leere. Vor dir ist ein Loch!' : ps.feel === 'wand' ? 'Vor dir ist eine Wand.' : 'Der Boden vor dir ist fest.';
              else if (f.a === 'left') msg.textContent = 'Du drehst dich nach links.';
              else if (f.a === 'right') msg.textContent = 'Du drehst dich nach rechts.';
              else if (f.a === 'step') msg.textContent = 'Ein Schritt nach vorn.';
            }
          }
          if ((ps.spun || 0) > lastSpun) { msg.textContent = 'Der Boden dreht sich unter dir! Du wirst mitgedreht.'; sfx.door(); haptic([30, 30, 30]); if (motionOK()) box.querySelector('.k2-sack').animate([{ transform: 'rotate(0)' }, { transform: 'rotate(8deg)' }, { transform: 'rotate(0)' }], { duration: 700 }); }
          else if (ps.steps > lastSteps && turns() > P.turns(spec, lastSteps)) { msg.textContent += ' Irgendwo neben dir rumpelt die Drehscheibe.'; }
          lastSteps = ps.steps; lastSpun = ps.spun || 0;
          info();
        },
      };
    }
    box.innerHTML = `<div class="k2-stagewrap"></div><p class="k2-mini tnum" data-slot="n"></p>
      <p class="k2-mini">Rot = Falltür mit Spießen · Kreis = Drehscheibe · Pfeil = Blickrichtung von ${esc(nameOf(q))}</p>`;
    const wrap = box.querySelector('.k2-stagewrap');
    const draw = () => {
      wrap.innerHTML = stageView(spec, st.ps[st.scene], P.holeAt, turns());
      box.querySelector('[data-slot="n"]').textContent = `Die Drehscheibe dreht sich in ${toTurn()} ${toTurn() === 1 ? 'Schritt' : 'Schritten'} (im Uhrzeigersinn).`;
    };
    draw();
    return { update: draw };
  }

  // ---------- 4) Schattentheater ----------
  function puzSchatten(box, spec, role, P) {
    if (role === 'lampe') {
      box.innerHTML = `<div class="k2-cards">${spec.base.map((c, i) => `<button class="k2-cardbtn" type="button" data-i="${i}" aria-label="Figur ${i + 1} drehen"><span class="k2-cardrot"></span><small>Figur ${i + 1}</small></button>`).join('')}</div>
        <p class="k2-mini">Tippe eine Figur an, um sie eine Vierteldrehung weiterzudrehen. Du siehst sie von hinten.</p>`;
      const draw = () => {
        const rot = st.ps[st.scene].rot;
        box.querySelectorAll('.k2-cardbtn').forEach((b) => {
          const i = +b.dataset.i;
          const holder = b.querySelector('.k2-cardrot');
          if (!holder.firstChild) holder.innerHTML = shadowCard(spec.base[i], { mirror: true });
          holder.style.transform = `rotate(${-(rot[i] * 90)}deg)`; // von hinten gesehen dreht es sich andersherum
          b.disabled = locked();
        });
      };
      box.querySelector('.k2-cards').addEventListener('click', (e) => {
        const b = e.target.closest('[data-i]');
        if (!b || locked()) return;
        sfx.flip(); haptic(6);
        act({ k: 'rot', c: +b.dataset.i });
      });
      draw();
      return { update: draw };
    }
    const digits = [0, 0, 0, 0];
    box.innerHTML = `<div class="k2-screenwrap"></div>
      <div class="k2-lock" role="group" aria-label="Zahlenschloss">${digits.map((d, i) => `<div class="kr-wheel" data-i="${i}"><button type="button" class="kr-wb up" aria-label="Ziffer ${i + 1} hoch">▲</button><span class="kr-wd tnum">0</span><button type="button" class="kr-wb down" aria-label="Ziffer ${i + 1} runter">▼</button></div>`).join('')}</div>
      <button class="btn primary big block" type="button" data-a="open">Requisitenkammer öffnen</button>`;
    const wrap = box.querySelector('.k2-screenwrap');
    const draw = () => { wrap.innerHTML = shadowScreen(P.lines(spec, st.ps[st.scene])); box.querySelector('[data-a="open"]').disabled = locked(); };
    box.querySelector('.k2-lock').addEventListener('click', (e) => {
      const b = e.target.closest('.kr-wb');
      if (!b) return;
      const i = +b.closest('.kr-wheel').dataset.i;
      digits[i] = (digits[i] + (b.classList.contains('up') ? 1 : 9)) % 10;
      b.closest('.kr-wheel').querySelector('.kr-wd').textContent = digits[i];
      sfx.tick();
    });
    box.querySelector('[data-a="open"]').addEventListener('click', () => { if (locked()) return; sfx.click(); act({ k: 'code', v: digits.join('') }); });
    draw();
    return { update: draw };
  }

  // ---------- 5) Drehorgel und Krokodil ----------
  function puzOrgel(box, spec, role, P) {
    const tNow = () => (Date.now() - st.sceneT) / 1000;
    if (role === 'orgel') {
      box.innerHTML = `<div class="k2-organwrap no-drag">${organ(0)}</div>
        <p class="k2-mini">Fahre mit dem Finger im Kreis um die Kurbel. Gleichmäßig!</p>
        <div class="k2-gaugeb" hidden></div>`;
      const wrap = box.querySelector('.k2-organwrap');
      const crank = () => wrap.querySelector('.k2-crank');
      let ang = 0, last = null, tempo = 0, acc = 0, noteAcc = 0, noteI = 0;
      const MEL = [72, 76, 79, 76, 72, 74, 77, 74, 71, 74, 79, 77, 76, 72];
      const hist = [];
      const center = () => { const r = wrap.querySelector('svg').getBoundingClientRect(); return [r.left + r.width * (196 / 240), r.top + r.height * (112 / 200)]; };
      const onMove = (e) => {
        if (locked()) return;
        const [cx, cy] = center();
        const a = Math.atan2(e.clientY - cy, e.clientX - cx);
        if (last != null) {
          let da = a - last;
          if (da > Math.PI) da -= Math.PI * 2;
          if (da < -Math.PI) da += Math.PI * 2;
          if (da > 0) { acc += da; noteAcc += da; ang += (da * 180) / Math.PI; }
          if (noteAcc > Math.PI / 2) { noteAcc = 0; sfx.note(MEL[noteI++ % MEL.length]); }
          crank().style.transform = `rotate(${ang}deg)`;
        }
        last = a;
      };
      wrap.addEventListener('pointerdown', (e) => { wrap.setPointerCapture?.(e.pointerId); last = null; onMove(e); });
      wrap.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') onMove(e); });
      wrap.addEventListener('pointerup', () => { last = null; });
      // Tempo messen (Umdrehungen pro Sekunde, gleitend über ~1 s)
      const iv = setInterval(() => {
        hist.push(acc); acc = 0;
        if (hist.length > 5) hist.shift();
        tempo = hist.reduce((a, b) => a + b, 0) / (Math.PI * 2) / (hist.length * .2);
        if (!locked()) sendFx({ kind: 'k2crank', sid, v: Math.round(tempo * 100) / 100 });
      }, 200);
      let sec = 0;
      const iv2 = setInterval(() => {
        if (locked() || st.scene === undefined) return;
        const ps = st.ps[st.scene];
        if (!ps || sec !== ps.ticks) { sec = ps?.ticks ?? sec; }
        const z = P.zone(spec, tNow());
        const g = Math.abs(tempo - z) <= spec.width ? 1 : 0;
        if (!sent.has('tick' + ps.ticks)) { sent.add('tick' + ps.ticks); act({ k: 'tick', g, n: ps.ticks }); }
        // Rückfall: Ohne Fortschritt zeigt der Kasperl auch dir die Anzeige
        const showGauge = ps.ticks >= 25 && ps.green < 4;
        const gb = box.querySelector('.k2-gaugeb');
        gb.hidden = !showGauge;
        if (showGauge) gb.innerHTML = `<p class="k2-mini">Der Kasperl hat Mitleid und zeigt dir die Takt-Anzeige:</p>${gauge(z, spec.width, tempo)}`;
      }, 1000);
      return { destroy() { clearInterval(iv); clearInterval(iv2); } };
    }
    box.innerHTML = `<div class="k2-railwrap"></div><div class="k2-gaugewrap"></div>
      <div class="k2-prog"><i></i><span class="tnum"></span></div>
      <p class="k2-mini" data-slot="live"></p>`;
    let live = 0, liveT = 0;
    const offFx = on('fx', (dd) => { if (dd.sid === sid && dd.kind === 'k2crank') { live = +dd.v || 0; liveT = Date.now(); } });
    const draw = () => {
      const ps = st.ps[st.scene];
      box.querySelector('.k2-railwrap').innerHTML = crocRail(ps.croc, spec.croc);
      const pr = Math.min(1, ps.green / spec.need);
      box.querySelector('.k2-prog i').style.width = `${pr * 100}%`;
      box.querySelector('.k2-prog span').textContent = `Im Takt: ${ps.green}/${spec.need} Sekunden`;
    };
    const drawGauge = () => {
      const fresh = Date.now() - liveT < 1500;
      box.querySelector('.k2-gaugewrap').innerHTML = gauge(P.zone(spec, tNow()), spec.width, live, fresh);
      box.querySelector('[data-slot="live"]').textContent = fresh ? '' : `Warte auf die Kurbel von ${nameOf(q)} …`;
    };
    draw(); drawGauge();
    const iv = setInterval(drawGauge, 200);
    return { update: draw, destroy() { clearInterval(iv); offFx(); } };
  }

  // =====================================================================
  // Das Publikum (Enthüllung)
  // =====================================================================
  function mountReveal() {
    const sc = SCENES[st.scene];
    const box = h('div', { class: 'k2-scene k2-reveal' });
    box.innerHTML = `
      <div class="k2-stagepic">${theaterScene({ seed: 'rev' })}</div>
      <div class="kr-story k2-story">${sc.text.map((t) => `<p class="kr-para shown">${esc(t)}</p>`).join('')}</div>
      <div class="k2-guests">${['brandl', 'haslinger', 'gerda'].map((g) => guestCard(g)).join('')}</div>
      ${kasperlRow(sc.kasperl, 'grin')}
      <div class="k2-donebox"><button class="btn primary big block" type="button" data-a="next">Weiter</button><p class="k2-wait" data-slot="wait"></p></div>`;
    stageBox.append(box);
    bindDone(box.querySelector('.k2-donebox'));
    if (motionOK()) { sfx.thunder(); setTimeout(() => sfx.heart(), 900); }
    return { update() { waitLine(box.querySelector('.k2-donebox')); } };
  }
  function guestCard(g, extra = '') {
    const fate = st.guests[g];
    return `<div class="k2-guest ${fate}"><span class="k2-gimg">${portrait(g, { dead: fate !== 'alive' })}</span><b>${esc(PEOPLE2[g].name)}</b><small>${fate === 'alive' ? esc(PEOPLE2[g].role) : 'tot'}</small>${extra}</div>`;
  }

  // =====================================================================
  // Die Fäden
  // =====================================================================
  function mountFaden() {
    const sc = SCENES[st.scene];
    const g = sc.guest;
    const F = FADEN[g];
    const box = h('div', { class: 'k2-scene k2-faden' });
    box.innerHTML = `
      <div class="k2-fguest">${guestCard(g)}<div class="k2-sandbag"><i></i></div></div>
      <p class="k2-fthing">${esc(F.thing)}</p>
      ${kasperlRow(F.k, 'grin')}
      <div class="k2-vote" style="--them:'${esc(nameOf(q))}'">
        <button class="k2-vbtn cut" type="button" data-v="cut"><b>Faden durchschneiden</b><small>${esc(PEOPLE2[g].short)} stirbt. Ihr verliert kein Blut.</small></button>
        <button class="k2-vbtn hold" type="button" data-v="hold"><b>Faden festhalten</b><small>Ihr verliert beide 0,5 L Blut. ${esc(PEOPLE2[g].short)} lebt.</small></button>
      </div>
      <p class="k2-vrule">${esc(FADEN_RULE)}</p>
      <div class="k2-vstate tnum"></div>
      <div class="k2-fres"></div>`;
    stageBox.append(box);
    box.querySelector('.k2-vote').addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b || st.sub !== 'vote') return;
      sfx.tap(); haptic(10);
      addEvent(sid, 'vote', { s: st.scene, v: b.dataset.v });
    });
    let shown = false;
    const res = box.querySelector('.k2-fres');
    const update = () => {
      const me_ = st.votes[p], them = st.votes[q];
      box.querySelectorAll('.k2-vbtn').forEach((b) => { b.classList.toggle('me', me_ === b.dataset.v); b.classList.toggle('them', them === b.dataset.v); b.disabled = st.sub !== 'vote'; });
      const vs = box.querySelector('.k2-vstate');
      if (st.sub === 'vote') {
        const left = Math.max(0, st.voteT + FADEN_MS - Date.now());
        vs.innerHTML = `${me_ ? `Du: <b>${me_ === 'cut' ? 'schneiden' : 'halten'}</b>` : 'Du hast noch nicht gewählt'} · ${them ? `${esc(nameOf(q))}: <b>${them === 'cut' ? 'schneiden' : 'halten'}</b>` : `${esc(nameOf(q))} überlegt …`} · <span class="k2-vt">${mmss(left)}</span>`;
        vs.classList.toggle('clash', !!(me_ && them && me_ !== them));
      } else vs.textContent = '';
      if (st.sub === 'done' && !shown) {
        shown = true;
        const r = st.fadenRes;
        res.innerHTML = `${r.forced ? `<p class="k2-forced">${esc(FADEN_TIMEOUT)}</p>` : ''}<p class="k2-fout ${r.v}">${esc(r.v === 'cut' ? F.cut : F.hold)}</p>
          <div class="k2-donebox"><button class="btn primary big block" type="button" data-a="next">Weiter</button><p class="k2-wait" data-slot="wait"></p></div>`;
        bindDone(res.querySelector('.k2-donebox'));
        box.querySelector('.k2-fguest').innerHTML = guestCard(g) + `<div class="k2-sandbag ${r.v === 'cut' ? 'fall' : 'held'}"><i></i></div>`;
        if (r.v === 'cut') { bloodBurst(); sfx.boom(); haptic([80, 40, 120]); }
        else { sfx.heart(); }
        setTimeout(() => res.scrollIntoView?.({ block: 'start', behavior: motionOK() ? 'smooth' : 'auto' }), 300);
      }
      if (st.sub === 'done') waitLine(res);
    };
    return { update, tick: () => { if (st.sub === 'vote') { const vt = box.querySelector('.k2-vt'); if (vt) vt.textContent = mmss(Math.max(0, st.voteT + FADEN_MS - Date.now())); } } };
  }

  // =====================================================================
  // Das Tribunal
  // =====================================================================
  function mountTribunal() {
    const box = h('div', { class: 'k2-scene k2-trib' });
    box.innerHTML = `${kasperlRow(TRIBUNAL.k, 'mad')}<div class="k2-q"></div>
      <div class="k2-guests small">${['brandl', 'haslinger', 'gerda'].map((g) => guestCard(g)).join('')}</div>`;
    stageBox.append(box);
    const qBox = box.querySelector('.k2-q');
    let shownQ = -1;
    qBox.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b || st.timeUp) return;
      sfx.tap(); haptic(8);
      addEvent(sid, 'pick', { q: st.trib.q, v: b.dataset.v });
    });
    const update = () => {
      const qq = TRIBUNAL.questions[st.trib.q];
      if (!qq) return;
      if (shownQ !== st.trib.q) {
        shownQ = st.trib.q;
        qBox.innerHTML = `<p class="k2-qn">Frage ${st.trib.q + 1} von ${TRIBUNAL.questions.length}</p><h3 class="k2-qt">${esc(qq.q)}</h3>
          <div class="k2-opts">${qq.opts.map((o) => `<button class="k2-opt" type="button" data-v="${o}"><span class="k2-oimg">${portrait(o, { dead: st.guests[o] && st.guests[o] !== 'alive' })}</span><b>${esc(PNAME[o])}</b><i class="k2-pk"></i></button>`).join('')}</div>
          <p class="k2-mini">Beide müssen dasselbe wählen. Schaut in eure Mappen!</p>`;
        if (motionOK()) qBox.animate([{ opacity: 0, transform: 'rotateX(60deg)' }, { opacity: 1, transform: 'none' }], { duration: 480 });
      }
      qBox.querySelectorAll('.k2-opt').forEach((b) => {
        const v = b.dataset.v;
        const mk = [st.trib.picks[p] === v ? `<span class="me">${esc(nameOf(p)[0] || '')}</span>` : '', st.trib.picks[q] === v ? `<span class="them">${esc(nameOf(q)[0] || '')}</span>` : ''].join('');
        b.querySelector('.k2-pk').innerHTML = mk;
        b.classList.toggle('mine', st.trib.picks[p] === v);
        b.disabled = st.timeUp;
      });
    };
    return { update };
  }

  // =====================================================================
  // Finale
  // =====================================================================
  function mountFinale() {
    const box = h('div', { class: 'k2-scene k2-fin' });
    stageBox.append(box);
    let step = '';
    let holdOn = false, bothSince = 0, okSent = false;
    const render = () => {
      if (step === st.fin.step) return false;
      step = st.fin.step;
      if (step === 'twist') {
        box.innerHTML = `<div class="k2-fallen">${kasperl('broken', { strings: false })}</div>
          <div class="kr-story k2-story">${FINALE.twist.map((t) => `<p class="kr-para shown">${esc(t)}</p>`).join('')}</div>
          <div class="k2-donebox"><button class="btn primary big block" type="button" data-a="next">Weiter</button><p class="k2-wait" data-slot="wait"></p></div>`;
        bindDone(box.querySelector('.k2-donebox'));
        if (motionOK()) { sfx.boom(); flash('#fff', .4); }
      } else if (step === 'seam') {
        box.innerHTML = `<p class="k2-fintext">${esc(FINALE.seam)}</p><div class="k2-chestwrap no-drag">${seamChest(0)}</div>
          <p class="k2-mini">Wer zuerst fertig ist, findet, was in Kasperls Brust steckt.</p>`;
        bindSeam(box.querySelector('.k2-chestwrap'));
      } else if (step === 'letter') {
        const cutter = st.fin.cutter;
        box.innerHTML = `<p class="k2-fintext">${esc(FINALE.found)}</p>
          ${cutter === p ? `<div class="k2-letter"><p>${esc(DOCS.brief.x)}</p></div><p class="k2-mini">Nur du hast den Brief. Lies ihn ${esc(nameOf(q))} vor!</p>`
            : `<div class="k2-letter closed"><p>${esc(nameOf(cutter))} hält einen vergilbten Brief in der Hand. Lass ihn dir vorlesen!</p></div>`}
          <h3 class="k2-qt">${esc(FINALE.choose)}</h3>
          <div class="k2-vote" style="--them:'${esc(nameOf(q))}'">
            <button class="k2-vbtn hold" type="button" data-v="lesen"><b>${esc(FINALE.choices.lesen)}</b></button>
            <button class="k2-vbtn cut" type="button" data-v="reissen"><b>${esc(FINALE.choices.reissen)}</b></button>
          </div><div class="k2-vstate"></div>`;
        box.querySelector('.k2-vote').addEventListener('click', (e) => {
          const b = e.target.closest('[data-v]');
          if (!b) return;
          sfx.tap();
          addEvent(sid, 'vote', { s: st.scene, v: b.dataset.v });
        });
      } else if (step === 'read') {
        box.innerHTML = `<div class="k2-tobias">${portrait('tobias')}</div>
          <div class="kr-story k2-story">${FINALE.read.map((t) => `<p class="kr-para shown">${esc(t)}</p>`).join('')}</div>
          <div class="k2-donebox"><button class="btn primary big block" type="button" data-a="next">Zum Vorhang!</button><p class="k2-wait" data-slot="wait"></p></div>`;
        bindDone(box.querySelector('.k2-donebox'));
        if (motionOK()) { sfx.thunder(); }
      } else if (step === 'pull') {
        box.innerHTML = `<div class="k2-iron"><i class="k2-iron-wall"></i><i class="k2-iron-pup">${kasperl('broken', { strings: false })}</i></div>
          <p class="k2-fintext">${esc(FINALE.pull)}</p>
          <div class="k2-pullbar"><i></i></div>
          <button class="k2-holdbtn" type="button" aria-label="Gedrückt halten"><span>Gedrückt halten</span><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44"/></svg></button>
          <p class="k2-vstate" data-slot="hold"></p>`;
        const hb = box.querySelector('.k2-holdbtn');
        const set_ = (on_) => { if (holdOn === on_) return; holdOn = on_; hb.classList.toggle('on', on_); haptic(on_ ? 20 : 8); addEvent(sid, 'hold', { on: on_ }); };
        hb.addEventListener('pointerdown', (e) => { e.preventDefault(); hb.setPointerCapture?.(e.pointerId); set_(true); });
        hb.addEventListener('pointerup', () => set_(false));
        hb.addEventListener('pointercancel', () => set_(false));
        hb.addEventListener('contextmenu', (e) => e.preventDefault());
        hb.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); set_(true); } });
        hb.addEventListener('keyup', () => set_(false));
        sfx.thunder();
      }
      return true;
    };
    const bindSeam = (wrap) => {
      let y0 = null, prog = 0;
      const geo = () => { const r = wrap.querySelector('svg').getBoundingClientRect(); return { x: r.left + r.width / 2, top: r.top + r.height * (40 / 220), bot: r.top + r.height * (190 / 220), w: r.width }; };
      wrap.addEventListener('pointerdown', (e) => { e.preventDefault(); const g = geo(); if (Math.abs(e.clientX - g.x) < g.w * .16) { y0 = e.clientY; wrap.setPointerCapture?.(e.pointerId); } });
      wrap.addEventListener('pointermove', (e) => {
        if (y0 == null || st.fin.step !== 'seam') return;
        const g = geo();
        if (Math.abs(e.clientX - g.x) > g.w * .2) return;
        const pr = Math.min(1, Math.max(prog, (e.clientY - g.top) / (g.bot - g.top)));
        if (pr > prog + .04) { prog = pr; wrap.innerHTML = seamChest(prog); sfx.crack(); haptic(6); }
        if (prog >= .97 && !sent.has('seam')) { sent.add('seam'); addEvent(sid, 'seam', {}); }
      });
      wrap.addEventListener('pointerup', () => { y0 = null; });
    };
    const update = () => {
      const changed = render();
      if (step === 'twist' || step === 'read') waitLine(box);
      if (step === 'letter') {
        const me_ = st.votes[p], them = st.votes[q];
        box.querySelectorAll('.k2-vbtn').forEach((b) => { b.classList.toggle('me', me_ === b.dataset.v); b.classList.toggle('them', them === b.dataset.v); });
        box.querySelector('.k2-vstate').innerHTML = `${me_ ? `Du: <b>${me_ === 'lesen' ? 'vorlesen' : 'zerreißen'}</b>` : 'Du hast noch nicht gewählt'} · ${them ? `${esc(nameOf(q))}: <b>${them === 'lesen' ? 'vorlesen' : 'zerreißen'}</b>` : `${esc(nameOf(q))} überlegt …`}`;
      }
      if (step === 'pull') {
        const both = st.fin.holds.jos && st.fin.holds.joh;
        if (both && !bothSince) bothSince = Date.now();
        if (!both) bothSince = 0;
        box.querySelector('[data-slot="hold"]').textContent = `${st.fin.holds[p] ? 'Du hältst!' : 'Du hältst nicht.'} · ${st.fin.holds[q] ? `${nameOf(q)} hält!` : `${nameOf(q)} hält nicht.`}`;
      }
      return changed;
    };
    return {
      update,
      tick(now) {
        if (step !== 'pull') return;
        const left = Math.max(0, st.fin.pullT + PULL_MS - now);
        box.querySelector('.k2-pullbar i').style.width = `${(left / PULL_MS) * 100}%`;
        const wall = box.querySelector('.k2-iron-wall');
        if (wall) wall.style.height = `${(1 - left / PULL_MS) * 70 + 10}%`;
        const ring = box.querySelector('.k2-holdbtn circle');
        const pr = bothSince ? Math.min(1, (now - bothSince) / 3000) : 0;
        if (ring) ring.style.strokeDashoffset = String(277 * (1 - pr));
        if (pr >= 1 && !okSent) { okSent = true; addEvent(sid, 'pullok', {}); }
      },
    };
  }

  // =====================================================================
  // Rückmeldungen
  // =====================================================================
  function handleFeed(list, afterSwitch) {
    for (const f of list) {
      if (f.k === 'hurt') {
        const o = OUCH[f.why];
        if (f.who === p) hurtFx(o?.me || 'Du blutest.', f.l);
        else {
          sfx.crack();
          toast(`${nameOf(f.who)} blutet: −${liters(f.l)}${o?.them ? ' – ' + o.them : ''}`, { icon: 'info', ms: 4200 });
        }
        if (o?.k && f.who === p) setTimeout(() => kasperlSay(o.k), 900);
      }
      if (f.k === 'solved') { sfx.unlock(); setTimeout(() => sfx.win(), 200); haptic([20, 40, 20, 40, 60]); if (motionOK()) burst(innerWidth / 2, innerHeight * .35, { count: 30, colors: ['#c9a24d', '#f3e3b0', '#fff'], shapes: ['star', 'sparkle'] }); }
      if (f.k === 'act' && f.info === 'leer' && f.by === p) { toast(OUCH.leer.me, { icon: 'info' }); sfx.bad(); }
      if (f.k === 'hint') showHint(f);
      if (f.k === 'donate') { if (f.by === q) { toast(`${nameOf(q)} hat dir Blut gespendet (+0,5 L).`, { icon: 'heart' }); sfx.heart(); } else toast(`Du hast ${nameOf(q)} 0,5 L gespendet.`, { icon: 'heart' }); }
      if (f.k === 'timeup') timeUpOffer();
      if (f.k === 'overtime') { document.querySelector('.k2-timeup')?.remove(); toast('Zehn Minuten mehr – bezahlt mit Blut.', { icon: 'info' }); }
      if (f.k === 'verdict') {
        if (f.ok) { stamp('Richtig!', innerWidth / 2, innerHeight * .32, { color: '#c9a24d' }); sfx.good(); }
        else if (f.rage) { kasperlSay(TRIBUNAL.antonRage, 'mad'); shake(view, 10); }
        else if (!f.want) stamp('Falsch!', innerWidth / 2, innerHeight * .32, { color: '#c1121f' });
      }
      if (f.k === 'seam' && f.by === q) toast(`${nameOf(q)} hat die Naht aufgeschnitten – und einen Brief gefunden.`, { icon: 'info' });
      if (f.k === 'ja' && f.by === q && mode === 'hello') sfx.pop();
    }
  }
  function hurtFx(text, l) {
    haptic([80, 50, 120]);
    sfx.crack(); setTimeout(() => sfx.heart(), 200);
    if (!motionOK()) { toast(`${text} (−${liters(l)})`, { icon: 'info', ms: 4500 }); return; }
    flash('#8a0f14', .6);
    shake(view, 12);
    const ov = h('div', { class: 'k2-hurt', role: 'status' });
    ov.innerHTML = `<div class="k2-hurt-splat">${bloodSvg()}</div><p><b>−${liters(l)}</b>${esc(text)}</p>`;
    document.body.append(ov);
    setTimeout(() => ov.classList.add('out'), 2300);
    setTimeout(() => ov.remove(), 2800);
  }
  function bloodSvg() {
    const dots = Array.from({ length: 18 }, () => `<circle cx="${(Math.random() * 200).toFixed(0)}" cy="${(Math.random() * 200).toFixed(0)}" r="${(2 + Math.random() * 8).toFixed(1)}"/>`).join('');
    return `<svg viewBox="0 0 200 200"><g fill="#8a0f14"><path d="M100 30c30 0 60 30 60 70s-30 70-60 70-60-30-60-70 30-70 60-70z" opacity=".9"/>${dots}</g></svg>`;
  }
  function bloodBurst() { if (motionOK()) burst(innerWidth / 2, innerHeight * .3, { count: 40, colors: ['#8a0f14', '#b3121b', '#5a060a'], speed: [180, 520] }); }
  function kasperlSay(text, mood = 'talk') {
    if (!text) return;
    const ov = h('div', { class: 'k2-say', role: 'status' });
    ov.innerHTML = `<span>${kasperl(mood, { strings: false })}</span><p>${esc(text)}</p>`;
    document.body.append(ov);
    setTimeout(() => ov.classList.add('out'), 2600);
    setTimeout(() => ov.remove(), 3100);
  }
  async function askHint() {
    const sc = SCENES[st.scene];
    const used = st.hints[st.scene] || 0;
    if (used >= 2) { toast('Mehr Tipps gibt es hier nicht.', { icon: 'info' }); return; }
    const ok = await confirmBox({ title: 'Ein Tipp vom Kasperl?', text: `»Ein Tipp? Das kostet einen halben Liter, {K}!« (${used}/2 Tipps in dieser Szene)`.replace('{K}', anrede(p)), ok: 'Blut geben' });
    if (!ok || !alive || SCENES[st.scene] !== sc) return;
    addEvent(sid, 'hint', { s: st.scene, n: used + 1 });
  }
  function showHint(f) {
    const sc = SCENES[f.s];
    let text = '';
    if (sc.kind === 'puzzle') text = PUZ[sc.id].hint(st.specs[f.s], st.ps[f.s], f.n);
    else if (sc.kind === 'tribunal') text = f.n === 1 ? TRIBUNAL.hints[1] : TRIBUNAL.hints[TRIBUNAL.questions[st.trib.q]?.id] || TRIBUNAL.hints[1];
    text = fill(text, sc.roles);
    const box = h('div', { class: 'k2-hintbox stack' });
    box.innerHTML = `${kasperlRow(`»${text}«`, 'grin')}<p class="soft small">Tipp ${f.n}/2 · ${f.by === p ? 'von dir' : `von ${esc(nameOf(f.by))}`} bezahlt (−0,5 L)</p>`;
    sheet({ title: 'Kasperls Tipp', body: box, cls: 'kr-sheet' });
  }
  async function donate() {
    if (st.blood[p] <= 1.5) { toast('Du hast selbst zu wenig Blut.', { icon: 'info' }); return; }
    const ok = await confirmBox({ title: `${nameOf(q)} Blut spenden?`, text: `Du gibst 0,5 L ab (du hast ${liters(st.blood[p])}, ${nameOf(q)} hat ${liters(st.blood[q])}). Das kostet 30 Sekunden.`, ok: 'Spenden' });
    if (!ok || !alive) return;
    sfx.heart();
    addEvent(sid, 'donate', {});
  }
  function timeUpOffer() {
    if (document.querySelector('.k2-timeup') || st.phase !== 'play') return;
    const ov = h('div', { class: 'kr-news blood k2-timeup', role: 'alertdialog', 'aria-modal': 'true' });
    ov.innerHTML = `<div class="kr-news-card"><p class="kr-news-k">0:00</p><h2 class="kr-news-t">Die Zeit ist um</h2>
      <p class="kr-news-x">Der Eiserne Vorhang ruckt nach unten. Der Kasperl kichert: »Noch zehn Minuten? Kostet jeden von euch einen Liter Blut.«</p>
      <button class="btn primary block" type="button" data-a="more">Zehn Minuten kaufen (je −1 L)</button>
      <button class="btn block" type="button" data-a="give" style="margin-top:8px">Aufgeben</button></div>`;
    document.body.append(ov);
    sfx.thunder();
    ov.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'more') { ov.remove(); addEvent(sid, 'overtime', {}); }
      if (a === 'give') { ov.remove(); addEvent(sid, 'giveup', {}); }
    });
  }

  // ---------- Mappe ----------
  function openDocs() {
    const ids = st.docs[p];
    const box = h('div', { class: 'k2-docs stack' });
    box.innerHTML = ids.length ? ids.map((d) => `<article class="k2-docc${local.seenDocs.includes(d) ? '' : ' new'}"><h4>${esc(DOCS[d].t)}</h4><p>${esc(DOCS[d].x)}</p></article>`).join('')
      : `<p class="soft">Noch leer. Was du findest, landet hier – nur auf deinem Handy. Erzählt euch alles!</p>`;
    local.seenDocs = [...new Set([...local.seenDocs, ...ids])];
    saveLocal();
    sheet({ title: 'Deine Mappe', body: box, cls: 'kr-sheet' });
    renderHud();
  }
  function openDoc(d) {
    const box = h('div', { class: 'k2-docs stack' });
    box.innerHTML = `<article class="k2-docc"><h4>${esc(DOCS[d].t)}</h4><p>${esc(DOCS[d].x)}</p></article>`;
    if (!local.seenDocs.includes(d)) { local.seenDocs.push(d); saveLocal(); }
    sheet({ title: 'Fundstück', body: box, cls: 'kr-sheet' });
    renderHud();
  }

  // =====================================================================
  // Ende
  // =====================================================================
  async function mountEnd(animated) {
    clearInterval(tick);
    scene?.destroy?.();
    scene = null;
    document.querySelectorAll('.k2-timeup').forEach((n) => n.remove());
    if (st.aborted) {
      view = h('div', { class: 'k2-end' });
      view.innerHTML = `<h2 class="kr-end-rank">Stück abgebrochen</h2><p class="kr-end-rx">${esc(nameOf(st.abortBy))} hat das Stück beendet. Der Kasperl verbeugt sich vor leeren Rängen.</p>
        <div class="kr-end-acts"><button class="btn primary big block" type="button" data-a="again">Nochmal spielen</button><button class="btn block" type="button" data-a="home">Zur Lobby</button></div>`;
      body.replaceChildren(view);
      view.addEventListener('click', endClick);
      return;
    }
    const r = st.result;
    const E = ENDINGS[st.ending];
    saveRecord(r);
    if (animated && motionOK()) {
      await curtain(st.ending === 'vorhang' ? 'Schlussvorhang' : 'Vorhang', E.title, () => {});
      if (!alive) return;
    }
    view = h('div', { class: `k2-end ${st.ending}` });
    view.innerHTML = `
      <div class="k2-end-k">${kasperl(st.ending === 'vorhang' ? 'broken' : 'grin', { strings: st.ending !== 'vorhang' })}</div>
      <p class="kr-end-kick">${esc(E.kick)}</p>
      <h2 class="kr-end-rank">${esc(E.title)}</h2>
      ${r.stars ? `<p class="k2-stars" aria-label="${r.stars} von 3 Sternen">${'★'.repeat(r.stars)}<span>${'★'.repeat(3 - r.stars)}</span></p>` : ''}
      <div class="kr-epi"><p>${esc(E.x)}</p></div>
      <div class="k2-guests">${['brandl', 'haslinger', 'gerda'].map((g) => `<div class="k2-guest ${st.guests[g]}"><span class="k2-gimg">${portrait(g, { dead: st.guests[g] !== 'alive' })}</span><b>${esc(PEOPLE2[g].name)}</b><small>${esc(GUEST_FATE[g][st.guests[g] === 'alive' ? 'alive' : st.guests[g] === 'crushed' ? 'crushed' : 'dead'])}</small></div>`).join('')}</div>
      <dl class="kr-stats">
        <div><dt>Zeit</dt><dd class="tnum">${mmss(r.ms)}</dd></div>
        <div><dt>Blut ${esc(nameOf('jos'))}</dt><dd class="tnum">${liters(st.blood.jos)}</dd></div>
        <div><dt>Blut ${esc(nameOf('joh'))}</dt><dd class="tnum">${liters(st.blood.joh)}</dd></div>
        <div><dt>Tipps</dt><dd class="tnum">${r.hints}</dd></div>
      </dl>
      ${st.ending !== 'vorhang' ? `<details class="k2-truth"><summary>Die ganze Wahrheit lesen</summary><p>${esc(DOCS.brief.x)}</p></details>` : ''}
      <div class="kr-end-acts">
        <button class="btn primary big block" type="button" data-a="again">Nochmal spielen – neue Rätsel</button>
        <button class="btn block" type="button" data-a="other">Anderen Fall wählen</button>
        <button class="btn quiet block" type="button" data-a="home">Zur Lobby</button>
      </div>`;
    body.replaceChildren(view);
    view.addEventListener('click', endClick);
    if (animated && motionOK()) {
      if (st.ending === 'vorhang') { sfx.win(); burst(innerWidth / 2, innerHeight * .3, { count: 36, colors: ['#c9a24d', '#f3e3b0', '#fff'], shapes: ['star', 'sparkle'] }); }
      else { sfx.lose(); flash('#8a0f14', .5); }
    }
  }
  function saveRecord(r) {
    const all = get(RECKEY, {}) || {};
    const old = all.puppe;
    if (old?.sid === sid) return;
    if (!old || r.stars > old.stars || (r.stars === old.stars && r.ms < old.ms)) { all.puppe = { stars: r.stars, ms: r.ms, ending: ENDINGS[r.ending]?.title, sid, at: Date.now() }; set(RECKEY, all); }
  }
  function endClick(e) {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'again') {
      sfx.pop();
      const id = createSession('krimi', 'remote', { case: 'puppe', diff: st.diff, first: other(st.first), seed: Math.random().toString(36).slice(2, 10) });
      nav('#/spiel/' + id, { replace: true });
    } else if (a === 'other') nav('#/neu/krimi');
    else if (a === 'home') nav('#/lobby');
  }

  // ---------- kleine Symbole ----------
  function icoDocs() { return '<svg class="kr-ic" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 10h18"/></g></svg>'; }
  function icoHint() { return '<svg class="kr-ic" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/></g></svg>'; }
  function icoDrop() { return '<svg class="kr-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" fill="currentColor"/></svg>'; }
  function icoEye() { return '<svg class="kr-ic" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></g></svg>'; }

  // ---------- Verbindung ----------
  offs.push(on('session', ({ id }) => { if (id === sid) update(); }));
  offs.push(on('net', () => { el.classList.toggle('alone', !(netState().status === 'online' && netState().partner)); }));
  update();
  return () => {
    alive = false;
    clearInterval(tick);
    typer?.finish();
    scene?.destroy?.();
    document.querySelectorAll('.k2-hurt, .k2-say, .k2-curtain-ov, .k2-timeup').forEach((n) => n.remove());
    offs.forEach((f) => f());
    shellOff();
  };
}
export { TITLE, SUB, TAG, DIFFS };
