// Zeichenfläche fürs Kritzelspiel. Koordinaten 0–1000 (quadratisch), damit die Zeichnung auf jedem Gerät gleich aussieht.
// Striche werden geglättet (Kurven durch Mittelpunkte) und beim Loslassen vereinfacht (Ramer-Douglas-Peucker).
import { h } from '../../core/dom.js';

export const INKS = [
  { c: '#3B1F2E', n: 'Schwarz' }, { c: '#FF5FA8', n: 'Pink' }, { c: '#8B5CFF', n: 'Lila' }, { c: '#3FA7FF', n: 'Blau' },
  { c: '#2FCB86', n: 'Grün' }, { c: '#FFC21A', n: 'Gelb' }, { c: '#FF7A2F', n: 'Orange' }, { c: '#9A5B34', n: 'Braun' },
];
export const SIZES = [{ s: 7, n: 'Fein' }, { s: 16, n: 'Mittel' }, { s: 34, n: 'Dick' }];

// Linie vereinfachen (Punkte als flache Liste x,y,x,y …)
function simplify(p, eps = 1.4) {
  if (p.length <= 4) return p.slice();
  const pts = [];
  for (let i = 0; i < p.length; i += 2) pts.push([p[i], p[i + 1]]);
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    for (let i = a + 1; i < b; i++) {
      // Fallen Anfang und Ende zusammen (geschlossene Form wie ein Kreis), zählt der Abstand zum Punkt selbst
      const d = len < 0.5 ? Math.hypot(pts[i][0] - ax, pts[i][1] - ay) : Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > max) { max = d; idx = i; }
    }
    if (max > eps && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  const out = [];
  pts.forEach((q, i) => { if (keep[i]) out.push(Math.round(q[0]), Math.round(q[1])); });
  return out;
}

export function drawStroke(c2d, st, scale, upto = Infinity) {
  const p = st.p;
  const n = Math.min(p.length / 2, upto);
  if (n < 1) return;
  c2d.save();
  const erase = st.c === 'erase';
  c2d.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
  c2d.strokeStyle = c2d.fillStyle = erase ? '#000' : st.c;
  c2d.lineWidth = st.s * scale;
  c2d.lineCap = 'round';
  c2d.lineJoin = 'round';
  if (n === 1) {
    c2d.beginPath();
    c2d.arc(p[0] * scale, p[1] * scale, (st.s * scale) / 2, 0, Math.PI * 2);
    c2d.fill();
  } else {
    c2d.beginPath();
    c2d.moveTo(p[0] * scale, p[1] * scale);
    for (let i = 1; i < n - 1; i++) {
      const x = p[i * 2], y = p[i * 2 + 1], nx = p[i * 2 + 2], ny = p[i * 2 + 3];
      c2d.quadraticCurveTo(x * scale, y * scale, ((x + nx) / 2) * scale, ((y + ny) / 2) * scale);
    }
    c2d.lineTo(p[(n - 1) * 2] * scale, p[(n - 1) * 2 + 1] * scale);
    c2d.stroke();
  }
  c2d.restore();
}

export function sketchCanvas({ editable = false, onStroke, onInk } = {}) {
  const wrap = h('div', { class: 'sketch' + (editable ? ' editable' : '') });
  const cv = h('canvas', { class: 'sk-main', role: 'img', 'aria-label': 'Zeichnung' });
  const live = h('canvas', { class: 'sk-live', 'aria-hidden': 'true' });
  wrap.append(cv, live);
  const ctx = cv.getContext('2d');
  const lctx = live.getContext('2d');
  let W = 0, scale = 1, dpr = 1;
  let strokes = [];
  let remoteCur = null;
  const tool = { c: INKS[0].c, s: SIZES[1].s, erase: false };

  function resize() {
    const w = wrap.clientWidth;
    if (!w || Math.abs(w - W) < 1) return;
    W = w;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const c of [cv, live]) { c.width = Math.round(W * dpr); c.height = Math.round(W * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = W / 1000;
    redraw();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(wrap);

  function redraw() {
    ctx.clearRect(0, 0, W, W);
    for (const s of strokes) drawStroke(ctx, s, scale);
  }
  function clearLive() { lctx.clearRect(0, 0, W, W); }

  // ---------- Zeichnen ----------
  if (editable) {
    let cur = null, sent = 0, inkT = 0, first = true;
    const pt = (e) => {
      const r = cv.getBoundingClientRect();
      return [Math.max(0, Math.min(1000, ((e.clientX - r.left) / r.width) * 1000)), Math.max(0, Math.min(1000, ((e.clientY - r.top) / r.height) * 1000))];
    };
    const flushInk = (force) => {
      if (!cur || !onInk) return;
      if (!force && performance.now() - inkT < 95) return;
      if (cur.p.length / 2 <= sent && !force) return;
      const from = Math.max(0, sent - 1);
      onInk({ c: cur.c, s: cur.s, p: cur.p.slice(from * 2).map(Math.round), first });
      first = false;
      sent = cur.p.length / 2;
      inkT = performance.now();
    };
    cv.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      e.preventDefault();
      cv.setPointerCapture(e.pointerId);
      const [x, y] = pt(e);
      cur = { c: tool.erase ? 'erase' : tool.c, s: tool.erase ? tool.s * 1.6 : tool.s, p: [x, y] };
      sent = 0; first = true; inkT = 0;
      clearLive();
      drawStroke(lctx, cur, scale);
    });
    cv.addEventListener('pointermove', (e) => {
      if (!cur) return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs) {
        const [x, y] = pt(ev);
        const lx = cur.p[cur.p.length - 2], ly = cur.p[cur.p.length - 1];
        if (Math.hypot(x - lx, y - ly) < 2.2) continue;
        cur.p.push(x, y);
      }
      if (cur.c === 'erase') {
        // Radierer sofort auf der Hauptfläche anwenden
        redraw();
        drawStroke(ctx, cur, scale);
      } else {
        clearLive();
        drawStroke(lctx, cur, scale);
      }
      flushInk(false);
      if (cur.p.length > 1100) finish();
    });
    const finish = () => {
      if (!cur) return;
      flushInk(true);
      const done = { c: cur.c, s: Math.round(cur.s), p: simplify(cur.p) };
      cur = null;
      clearLive();
      strokes.push(done);
      redraw();
      onStroke?.(done);
    };
    cv.addEventListener('pointerup', finish);
    cv.addEventListener('pointercancel', finish);
  }

  // ---------- Von außen ----------
  const ensure = () => { if (!W) resize(); };
  wrap.setStrokes = (arr) => { ensure(); strokes = (arr || []).map((s) => ({ c: s.c, s: s.s, p: s.p })); remoteCur = null; clearLive(); redraw(); };
  wrap.setTool = (t) => Object.assign(tool, t);
  wrap.ink = ({ c, s, p, first }) => {
    if (!Array.isArray(p)) return;
    ensure();
    if (first || !remoteCur || remoteCur.c !== c) remoteCur = { c, s, p: [] };
    remoteCur.p.push(...p.slice(remoteCur.p.length ? 2 : 0));
    clearLive();
    if (c === 'erase') { redraw(); drawStroke(ctx, remoteCur, scale); } else drawStroke(lctx, remoteCur, scale);
  };
  // Zeitraffer: Striche nacheinander nachmalen
  wrap.replay = (arr = strokes, ms = 4200) => new Promise((resolve) => {
    ensure();
    const list = (arr || []).filter((s) => s.p?.length);
    const totalPts = list.reduce((a, s) => a + s.p.length / 2, 0) || 1;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      let budget = Math.floor(k * totalPts);
      ctx.clearRect(0, 0, W, W);
      for (const s of list) {
        const n = s.p.length / 2;
        if (budget <= 0) break;
        drawStroke(ctx, s, scale, Math.min(n, budget));
        budget -= n;
      }
      if (k < 1) requestAnimationFrame(step); else { strokes = list; redraw(); resolve(); }
    };
    requestAnimationFrame(step);
  });
  wrap.strokes = () => strokes.slice();
  wrap.destroy = () => ro.disconnect();
  requestAnimationFrame(resize);
  return wrap;
}

// Kleines Vorschaubild (Kunstbuch)
export function thumb(strokes, size = 140) {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = c.height = Math.round(size * dpr);
  c.style.width = c.style.height = size + 'px';
  const x = c.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const s of strokes || []) drawStroke(x, s, size / 1000);
  return c;
}
