// Krimi – Werkzeuge: Chiffre (Tagebuch), Tresor, Bleistift-Durchdruck, Fingerabdruck-Vergleich, Schachprotokoll.
// Jedes Werkzeug öffnet ein Blatt. Das Ergebnis meldet die Oberfläche später über tool.result(...) zurück.
import { h, esc } from '../../core/dom.js';
import { sheet, toast } from '../../core/ui.js';
import { motionOK } from '../../core/theme.js';
import { sfx, haptic } from '../../core/sound.js';
import { shake } from '../../core/fx.js';
import { CASE, normKey, cipherKeyOk, COST } from './logic.js';
import { fingerprint, clueIcon } from './art.js';

const C = CASE;

// ---------- Vigenère (nur Buchstaben A–Z, Schlüssel rückt nur bei Buchstaben weiter) ----------
export function vigenere(text, key, dir = 1) {
  const k = normKey(key);
  if (!k) return text;
  let j = 0;
  let out = '';
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    if (c >= 65 && c <= 90) {
      const s = k.charCodeAt(j % k.length) - 65;
      out += String.fromCharCode(((c - 65 + dir * s + 26 * 2) % 26) + 65);
      j++;
    } else out += ch;
  }
  return out;
}
export const CIPHER_TEXT = vigenere(C.cipher.plain, C.cipher.key, 1);

export function openCipher({ solved, onSolve }) {
  const box = h('div', { class: 'kr-tool kr-cipher stack' });
  box.innerHTML = `
    <p class="kr-tool-note">${clueIcon('diary')}<span>»Der Schlüssel ist der Name, den nur ich ihr gab.« Jeder Buchstabe des Schlüsselworts verschiebt einen Buchstaben im Text – reihum.</span></p>
    <label class="kr-key"><span>Schlüsselwort</span><input class="field" maxlength="16" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="z. B. ROSE" ${solved ? 'disabled' : ''}></label>
    <pre class="kr-cipher-text no-drag" aria-live="polite"></pre>
    <button class="btn primary block" type="button" data-a="ok" hidden>${clueIcon('diary')}<span>Entschlüsselt – in die Akte (${COST.cipher} Min)</span></button>`;
  const input = box.querySelector('input');
  const out = box.querySelector('.kr-cipher-text');
  const ok = box.querySelector('[data-a="ok"]');
  let shown = '';
  const render = () => {
    const key = input.value;
    const good = solved || cipherKeyOk(key);
    const txt = solved ? C.cipher.plain : key.trim() ? vigenere(CIPHER_TEXT, key, -1) : CIPHER_TEXT;
    out.classList.toggle('good', good);
    if (txt !== shown) {
      shown = txt;
      out.textContent = txt;
      if (motionOK() && key) out.animate([{ opacity: .5, filter: 'blur(1.5px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 220 });
    }
    ok.hidden = solved || !good;
    if (good && !solved && !box.dataset.rang) { box.dataset.rang = '1'; sfx.unlock(); haptic([20, 30, 20]); }
  };
  input.addEventListener('input', () => { sfx.key(); render(); });
  ok.addEventListener('click', () => { ok.disabled = true; onSolve(input.value); sh.close(); });
  if (solved) input.value = C.cipher.key;
  render();
  const sh = sheet({ title: solved ? 'Tagebuch – entschlüsselt' : 'Tagebuch entschlüsseln', body: box, cls: 'kr-sheet' });
  if (!solved) setTimeout(() => input.focus(), 120);
  return { result() {} };
}

// ---------- Tresor: sechs Zahlenräder ----------
export function openSafe({ onTry, here }) {
  const box = h('div', { class: 'kr-tool kr-safe stack' });
  const digits = [0, 0, 0, 0, 0, 0];
  box.innerHTML = `
    <p class="kr-tool-note">${clueIcon('safe')}<span>${here ? 'Sechs Zahlenräder. Jeder Versuch kostet Zeit.' : 'Der Tresor hängt im Büro. Geh erst dorthin.'}</span></p>
    <div class="kr-safe-box no-drag" role="group" aria-label="Zahlenräder">
      ${digits.map((d, i) => `<div class="kr-wheel" data-i="${i}">
        <button type="button" class="kr-wb up" aria-label="Rad ${i + 1} hoch">▲</button>
        <span class="kr-wd tnum" aria-live="polite">0</span>
        <button type="button" class="kr-wb down" aria-label="Rad ${i + 1} runter">▼</button></div>`).join('')}
      <div class="kr-safe-door"><i></i></div>
    </div>
    <button class="btn primary block" type="button" data-a="try" ${here ? '' : 'disabled'}>${clueIcon('safe')}<span>Öffnen (${COST.safe} Min)</span></button>`;
  const wheels = [...box.querySelectorAll('.kr-wheel')];
  const set = (i, v) => {
    digits[i] = (v + 10) % 10;
    const el = wheels[i].querySelector('.kr-wd');
    el.textContent = digits[i];
    if (motionOK()) el.animate([{ transform: 'translateY(-30%)', opacity: .3 }, { transform: 'none', opacity: 1 }], { duration: 160, easing: 'ease-out' });
    sfx.tick();
  };
  box.querySelector('.kr-safe-box').addEventListener('click', (e) => {
    const b = e.target.closest('.kr-wb');
    if (!b) return;
    const i = +b.closest('.kr-wheel').dataset.i;
    set(i, digits[i] + (b.classList.contains('up') ? 1 : -1));
    haptic(5);
  });
  // Wischen auf einem Rad
  for (const w of wheels) {
    let y0 = null;
    w.addEventListener('pointerdown', (e) => { if (!e.target.closest('.kr-wb')) { y0 = e.clientY; w.setPointerCapture?.(e.pointerId); } });
    w.addEventListener('pointermove', (e) => {
      if (y0 == null) return;
      const dy = e.clientY - y0;
      if (Math.abs(dy) > 22) { const i = +w.dataset.i; set(i, digits[i] + (dy < 0 ? 1 : -1)); y0 = e.clientY; }
    });
    w.addEventListener('pointerup', () => { y0 = null; });
    w.addEventListener('pointercancel', () => { y0 = null; });
  }
  const btn = box.querySelector('[data-a="try"]');
  btn.addEventListener('click', () => { btn.disabled = true; sfx.click(); onTry(digits.join('')); });
  const sh = sheet({ title: 'Wandtresor', body: box, cls: 'kr-sheet' });
  return {
    result(ok) {
      if (!box.isConnected) return;
      if (ok) {
        box.classList.add('open');
        sfx.unlock(); haptic([30, 40, 60]);
        setTimeout(() => sh.close(), motionOK() ? 1300 : 200);
      } else {
        btn.disabled = false;
        sfx.buzz(); haptic([60, 40, 60]);
        shake(box.querySelector('.kr-safe-box'), 8);
        toast('Falsche Kombination. 5 Minuten verloren.', { icon: 'info' });
      }
    },
  };
}

// ---------- Bleistift-Durchdruck ----------
export function openRub({ solved, onDone }) {
  const box = h('div', { class: 'kr-tool kr-rub stack' });
  box.innerHTML = `
    <p class="kr-tool-note">${clueIcon('pad')}<span>${solved ? 'Der Durchdruck ist sichtbar gemacht.' : 'Schraffiere mit dem Finger flach über das Blatt – wie mit einem Bleistift.'}</span></p>
    <div class="kr-rub-paper no-drag"><canvas aria-label="Notizblock zum Schraffieren"></canvas></div>
    <div class="kr-rub-bar"><i></i></div>
    <button class="btn primary block" type="button" data-a="ok" ${solved ? 'hidden' : 'disabled'}>${clueIcon('pad')}<span>Festhalten (${COST.rub} Min)</span></button>`;
  const cv = box.querySelector('canvas');
  const bar = box.querySelector('.kr-rub-bar i');
  const ok = box.querySelector('[data-a="ok"]');
  const sh = sheet({ title: 'Notizblock', body: box, cls: 'kr-sheet' });
  const paper = box.querySelector('.kr-rub-paper');
  const W = Math.min(360, paper.clientWidth || 320), H = Math.round(W * .68);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  const mask = document.createElement('canvas');
  mask.width = cv.width; mask.height = cv.height;
  const mx = mask.getContext('2d');
  mx.scale(dpr, dpr);
  const GX = 18, GY = 10;
  const hit = new Set();
  let need = 0;
  const textCells = new Set();
  const drawMask = () => {
    mx.clearRect(0, 0, W, H);
    mx.fillStyle = '#000';
    mx.font = `700 ${Math.round(W / 13)}px Caveat, "Comic Sans MS", cursive`;
    mx.textBaseline = 'middle';
    const L = C.rub.lines;
    L.forEach((t, i) => mx.fillText(t, 16 + (i % 2) * 4, 18 + i * ((H - 30) / (L.length - 1))));
    // Zellen mit Schrift merken (für den Fortschritt)
    const img = mx.getImageData(0, 0, mask.width, mask.height).data;
    for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) {
      let any = false;
      for (let yy = 0; yy < 6 && !any; yy++) for (let xx = 0; xx < 6 && !any; xx++) {
        const px = Math.floor(((gx + (xx + .5) / 6) / GX) * mask.width), py = Math.floor(((gy + (yy + .5) / 6) / GY) * mask.height);
        if (img[(py * mask.width + px) * 4 + 3] > 40) any = true;
      }
      if (any) textCells.add(gy * GX + gx);
    }
    need = Math.max(1, Math.round(textCells.size * .55));
  };
  const fill = () => {
    if (solved) {
      ctx.fillStyle = 'rgba(70,70,78,.62)';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(mask, 0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      bar.style.width = '100%';
    }
  };
  const ready = document.fonts?.load ? document.fonts.load('700 26px Caveat').catch(() => null) : Promise.resolve();
  ready.then(() => { drawMask(); fill(); });
  let last = null;
  const stroke = (x, y) => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(64,64,72,.34)';
    ctx.lineCap = 'round';
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.moveTo(last ? last.x : x - .1, last ? last.y : y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(mask, 0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    last = { x, y };
    const gx = Math.floor((x / W) * GX), gy = Math.floor((y / H) * GY);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const k = (gy + dy) * GX + gx + dx;
      if (textCells.has(k)) hit.add(k);
    }
    const p = Math.min(1, hit.size / need);
    bar.style.width = Math.round(p * 100) + '%';
    if (p >= 1 && ok.disabled && !solved) { ok.disabled = false; sfx.good(); haptic([20, 30]); }
  };
  const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  let down = false, tick = 0;
  cv.addEventListener('pointerdown', (e) => { if (solved) return; down = true; last = null; cv.setPointerCapture?.(e.pointerId); const p = pos(e); stroke(p.x, p.y); });
  cv.addEventListener('pointermove', (e) => {
    if (!down) return;
    const p = pos(e); stroke(p.x, p.y);
    if (++tick % 7 === 0) sfx.draw();
  });
  const up = () => { down = false; last = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', up);
  ok.addEventListener('click', () => { ok.disabled = true; onDone(); sh.close(); });
  return { result() {} };
}

// ---------- Fingerabdrücke vergleichen ----------
// cards: [{ who, name }] – eigene Abdruck-Karten · spec(who) → Muster
export function openFp({ cards, spec, hasSpur, solved, onConfirm }) {
  const box = h('div', { class: 'kr-tool kr-fpc stack' });
  let cur = cards[0]?.who || null;
  let rot = 0;
  let overlay = false;
  const SPUR = { ...spec('wendt') };
  box.innerHTML = `
    <p class="kr-tool-note">${clueIcon('print')}<span>Links der halbe Daumen aus dem Kerzenwachs, rechts eure Abdruck-Karten. Achtet auf die Richtung der Schleife, Narben und Inselchen. Mit „Überlagern“ und dem Regler könnt ihr drehen und vergleichen.</span></p>
    <div class="kr-fp-pair no-drag">
      <figure class="kr-fp-card spur">${hasSpur ? fingerprint(SPUR, { seed: 'wendt', partial: true, rot: 24, ink: '#6f4b16', bg: '#ecd9a6' }) : '<div class="kr-fp-empty">Spur fehlt</div>'}<figcaption>Wachs</figcaption></figure>
      <figure class="kr-fp-card ref"><div class="kr-fp-slot"></div><figcaption data-slot="cap">–</figcaption></figure>
      <div class="kr-fp-over" hidden></div>
    </div>
    <div class="row kr-fp-ctrl"><button class="btn small" type="button" data-a="over">${clueIcon('search')}<span>Überlagern</span></button>
      <input type="range" min="-60" max="60" value="0" step="1" aria-label="Drehen" class="grow" disabled></div>
    <div class="chips scroll kr-fp-chips" role="group" aria-label="Abdruck-Karten">${cards.map((c) => `<button class="chip" type="button" data-who="${c.who}" aria-pressed="${c.who === cur}">${esc(c.name)}</button>`).join('') || '<span class="soft small">Noch keine Abdrücke genommen. Im Verhör: „Fingerabdrücke nehmen“.</span>'}</div>
    <button class="btn primary block" type="button" data-a="ok" ${cur && hasSpur && !solved ? '' : 'disabled'}>${clueIcon('print')}<span>${solved ? 'Treffer bereits festgehalten' : `Übereinstimmung festhalten (${COST.fp} Min)`}</span></button>`;
  const slot = box.querySelector('.kr-fp-slot');
  const cap = box.querySelector('[data-slot="cap"]');
  const over = box.querySelector('.kr-fp-over');
  const range = box.querySelector('input[type="range"]');
  const ok = box.querySelector('[data-a="ok"]');
  const draw = () => {
    if (!cur) { slot.innerHTML = '<div class="kr-fp-empty">Keine Karte</div>'; return; }
    slot.innerHTML = fingerprint(spec(cur), { seed: cur });
    cap.textContent = cards.find((c) => c.who === cur)?.name || '';
    if (overlay) {
      over.hidden = false;
      over.innerHTML = `${hasSpur ? fingerprint(SPUR, { seed: 'wendt', partial: true, rot: 24, ink: '#6f4b16', bg: '#ecd9a6' }) : ''}<div class="kr-fp-top" style="transform: rotate(${rot}deg)">${fingerprint(spec(cur), { seed: cur, noBg: true, ink: '#0b4aa8' })}</div>`;
    } else over.hidden = true;
  };
  box.querySelector('.kr-fp-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-who]');
    if (!b) return;
    cur = b.dataset.who;
    box.querySelectorAll('.kr-fp-chips .chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    sfx.flip();
    draw();
    ok.disabled = !hasSpur || solved;
  });
  box.querySelector('[data-a="over"]').addEventListener('click', (e) => {
    overlay = !overlay;
    e.currentTarget.classList.toggle('on', overlay);
    range.disabled = !overlay;
    sfx.tap();
    draw();
  });
  range.addEventListener('input', () => {
    rot = +range.value;
    const top = over.querySelector('.kr-fp-top');
    if (top) top.style.transform = `rotate(${rot}deg)`;
  });
  ok.addEventListener('click', () => { if (!cur) return; ok.disabled = true; onConfirm(cur); });
  draw();
  const sh = sheet({ title: 'Fingerabdrücke vergleichen', body: box, cls: 'kr-sheet' });
  return {
    result(hitOk) {
      if (!box.isConnected) return;
      if (hitOk) { sfx.unlock(); setTimeout(() => sh.close(), 600); }
      else { ok.disabled = false; sfx.buzz(); shake(box.querySelector('.kr-fp-pair'), 6); toast('Keine Übereinstimmung. 5 Minuten verloren.', { icon: 'info' }); }
    },
  };
}

// ---------- Schachprotokoll ----------
export function openChess() {
  const box = h('div', { class: 'kr-tool kr-chess' });
  box.innerHTML = `<p class="kr-chess-head">${esc(C.chess.head)}</p>
    <table class="kr-chess-tab"><thead><tr><th>Zug</th><th>Weiß</th><th>Schwarz</th><th>Uhr</th></tr></thead><tbody>
    ${C.chess.rows.map((r) => `<tr class="${r[4] ? 'note' : ''}"><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td class="tnum">${r[3]}</td></tr>${r[4] ? `<tr class="kr-chess-note"><td colspan="4">${esc(r[4])}</td></tr>` : ''}`).join('')}
    </tbody></table>`;
  sheet({ title: 'Novaks Schachprotokoll', body: box, cls: 'kr-sheet' });
  return { result() {} };
}
