// Kleine, selbstgebaute SVG-Diagramme. Keine Bibliothek nötig.

const R = 40, C = 2 * Math.PI * R;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Donut. segments: [{id, value, color, label}]
 * Gibt HTML zurück; nach dem Einfügen animateCharts(container) aufrufen.
 */
export function donut(segments, { center = '', sub = '', size = 220, width = 13, muted = false } = {}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  let off = 0;
  const gap = segments.length > 1 ? 0.8 : 0;
  const arcs = total > 0 ? segments.map(s => {
    const len = (s.value / total) * C;
    const draw = Math.max(len - gap, 0.01);
    const el = `<circle class="arc" data-id="${esc(s.id)}" cx="50" cy="50" r="${R}" fill="none"
      stroke="${s.color}" stroke-width="${width}" stroke-linecap="butt"
      style="stroke-dasharray:0 ${C}" data-dash="${draw} ${C - draw}" stroke-dashoffset="${-off}"
      transform="rotate(-90 50 50)"><title>${esc(s.label || '')}</title></circle>`;
    off += len;
    return el;
  }).join('') : '';
  return `<div class="donut ${muted ? 'muted' : ''}" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 100 100" role="img" aria-label="Kreisdiagramm">
      <circle cx="50" cy="50" r="${R}" fill="none" stroke="var(--track)" stroke-width="${width}"/>
      ${arcs}
    </svg>
    <div class="donut-center"><div class="donut-total">${center}</div><div class="donut-sub">${sub}</div></div>
  </div>`;
}

/** Balken: groups: [{label, a, b}] (a = Einnahmen grün, b = Ausgaben rot) */
export function bars(groups, { height = 170, fmt = v => v } = {}) {
  const max = Math.max(1, ...groups.flatMap(g => [g.a, g.b]));
  const W = 320, H = height, top = 18, bottom = 24, ch = H - top - bottom;
  const gw = W / groups.length, bw = Math.min(16, gw / 3.2);
  const out = groups.map((g, i) => {
    const cx = gw * i + gw / 2;
    const ha = Math.max((g.a / max) * ch, g.a ? 2 : 0), hb = Math.max((g.b / max) * ch, g.b ? 2 : 0);
    return `
      <rect class="bar" x="${cx - bw - 2}" y="${top + ch - ha}" width="${bw}" height="${ha}" rx="4" fill="var(--green)"><title>Einnahmen ${esc(fmt(g.a))}</title></rect>
      <rect class="bar" x="${cx + 2}" y="${top + ch - hb}" width="${bw}" height="${hb}" rx="4" fill="var(--red)"><title>Ausgaben ${esc(fmt(g.b))}</title></rect>
      <text x="${cx}" y="${H - 6}" text-anchor="middle" class="bar-label ${g.current ? 'cur' : ''}">${esc(g.label)}</text>`;
  }).join('');
  return `<svg class="bars" viewBox="0 0 ${W} ${H}" role="img" aria-label="Balkendiagramm">
    <line x1="0" x2="${W}" y1="${top + ch}" y2="${top + ch}" stroke="var(--line)"/>${out}</svg>`;
}

/** Startet die sanften Einblend-Animationen */
export function animateCharts(root) {
  const arcs = root.querySelectorAll('.arc[data-dash]');
  const barsEls = root.querySelectorAll('.bar');
  barsEls.forEach(b => b.classList.add('grow'));
  requestAnimationFrame(() => requestAnimationFrame(() => {
    arcs.forEach(a => { a.style.strokeDasharray = a.dataset.dash; });
    barsEls.forEach(b => b.classList.add('in'));
  }));
}
