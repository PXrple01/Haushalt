// Geld & Datum – alle Beträge sind GANZZAHLIGE CENT. Nie mit Kommazahlen rechnen.

export function parseCents(input) {
  if (input === null || input === undefined) return 0;
  let s = String(input).trim().replace(/\s|€|EUR/gi, '');
  if (!s) return 0;
  let neg = false;
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  // "1.234,56" -> deutsch; "1234.56" -> englisch
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^\d*(\.\d*)?$/.test(s)) return NaN;
  const [eur = '0', frac = ''] = s.split('.');
  const cents = parseInt(eur || '0', 10) * 100 + parseInt((frac + '00').slice(0, 2), 10);
  return neg ? -cents : cents;
}

let currency = 'EUR';
const fmtCache = {};
export function setCurrency(c) { currency = c || 'EUR'; }
function nf(digits) {
  const k = currency + digits;
  return fmtCache[k] ||= new Intl.NumberFormat('de-DE', { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits });
}
/** Formatiert Cent. Ganze Beträge ohne ",00". */
export function fmt(cents, { sign = false, always2 = false } = {}) {
  const c = Math.round(cents || 0);
  const abs = Math.abs(c);
  const s = nf(always2 || abs % 100 !== 0 ? 2 : 0).format(abs / 100);
  if (c < 0) return '−' + s;
  if (sign && c > 0) return '+' + s;
  return s;
}
/** Eingabe-String der Zahlentastatur -> Anzeige */
export function keypadDisplay(str) {
  if (!str) return fmt(0);
  const [e, f] = str.split(',');
  const eur = new Intl.NumberFormat('de-DE').format(parseInt(e || '0', 10));
  const sym = nf(0).formatToParts(0).find(p => p.type === 'currency')?.value || '€';
  return eur + (f !== undefined ? ',' + f : '') + ' ' + sym;
}

// ---------- Datum (immer lokale Zeit, Format YYYY-MM-DD) ----------
export const pad = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => iso(new Date());
export const fromISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d || 1); };
export const daysIn = (y, m) => new Date(y, m + 1, 0).getDate(); // m: 0-11 (auch <0 / >11)

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTHS_S = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const monthName = (m, short) => (short ? MONTHS_S : MONTHS)[((m % 12) + 12) % 12];
export const monthYear = d => `${monthName(d.getMonth())} ${d.getFullYear()}`;

export function dayLabel(s) {
  const t = todayISO();
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (s === t) return 'Heute';
  if (s === iso(y)) return 'Gestern';
  const d = fromISO(s);
  const yr = d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '';
  return `${DAYS[d.getDay()]}, ${d.getDate()}. ${monthName(d.getMonth(), true)}.${yr}`;
}
export const shortDate = s => { const d = fromISO(s); return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`; };

// ---------- Zeiträume ----------
// Ergebnis: { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' (exklusiv), label }
function monthStartOf(y, m, startDay) { return new Date(y, m, Math.min(startDay, daysIn(y, m))); }

export function monthPeriod(date, startDay = 1, offset = 0) {
  let s = monthStartOf(date.getFullYear(), date.getMonth(), startDay);
  if (date < s) s = monthStartOf(date.getFullYear(), date.getMonth() - 1, startDay);
  if (offset) s = monthStartOf(s.getFullYear(), s.getMonth() + offset, startDay);
  const e = monthStartOf(s.getFullYear(), s.getMonth() + 1, startDay);
  let label;
  if (startDay === 1) label = monthYear(s);
  else {
    const last = new Date(e); last.setDate(last.getDate() - 1);
    label = `${s.getDate()}. ${monthName(s.getMonth(), true)} – ${last.getDate()}. ${monthName(last.getMonth(), true)}`;
  }
  return { start: iso(s), end: iso(e), label, startDate: s, short: monthName(s.getMonth(), true) };
}

export function weekPeriod(date, offset = 0) {
  const s = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7) + offset * 7);
  const e = new Date(s); e.setDate(e.getDate() + 7);
  const last = new Date(e); last.setDate(last.getDate() - 1);
  return { start: iso(s), end: iso(e), label: `${s.getDate()}. ${monthName(s.getMonth(), true)} – ${last.getDate()}. ${monthName(last.getMonth(), true)}` };
}

export function yearPeriod(date, offset = 0) {
  const y = date.getFullYear() + offset;
  return { start: `${y}-01-01`, end: `${y + 1}-01-01`, label: String(y) };
}

export const inRange = (dateISO, p) => dateISO >= p.start && dateISO < p.end;
