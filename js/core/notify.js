// Globale Hinweise: Einladungen, „Du bist dran“, Anstupsen – und die Duell-Bilanz, sobald eine Partie endet.
import { h, esc } from './dom.js';
import { on, me } from './store.js';
import { nameOf } from './util.js';
import { getSession } from './sync.js';
import { LOGIC, stateOf } from '../games/registry.js';
import { gameTitle } from '../games/info.js';
import { addRecord, removeRecord } from './stats.js';
import { sheet, toast } from './ui.js';
import { mascot } from '../art/mascots.js';
import { currentTheme } from './theme.js';
import { sfx, haptic } from './sound.js';
import { stamp } from './fx.js';
import { nav } from './router.js';

const lastTodo = new Map();
const onScreen = (id) => location.hash === '#/spiel/' + id;

function recordIfEnded(s) {
  const st = stateOf(s);
  if (st && st.phase === 'end' && !st.aborted && st.winner) {
    addRecord({ id: s.meta.id, game: s.meta.game, winner: st.winner, ts: st.endedAt || Date.now(), mode: s.meta.mode });
  } else if (st && st.phase !== 'end' && s.meta.mode === 'couch') removeRecord(s.meta.id);
  return st;
}

// Einladung: das andere Gerät hat eine neue Partie gestartet
on('invite', (meta) => {
  if (meta.mode !== 'remote' || onScreen(meta.id)) return;
  const s = getSession(meta.id);
  const st = s && stateOf(s);
  if (!st || st.phase === 'end') return;
  const todo = LOGIC[meta.game].todo(st, me.get());
  lastTodo.set(meta.id, todo);
  sfx.join(); haptic([20, 40, 20]);
  const body = h('div', { class: 'invite' });
  body.innerHTML = `
    ${mascot(currentTheme(), 'cheer', 'invite-masc')}
    <p class="invite-text"><b>${esc(nameOf(meta.by))}</b> möchte <b>${esc(gameTitle(meta.game))}</b> mit dir spielen.${todo ? `<br><span class="soft">Du bist dran: ${esc(todo)}</span>` : ''}</p>`;
  const go = h('button', { class: 'btn primary big block', type: 'button' }, 'Los geht’s');
  const later = h('button', { class: 'btn quiet block', type: 'button' }, 'Später');
  body.append(go, later);
  const sh = sheet({ title: `${nameOf(meta.by)} lädt dich ein`, body });
  go.addEventListener('click', () => { sh.close(true); nav('#/spiel/' + meta.id); });
  later.addEventListener('click', () => sh.close());
});

// Jede Änderung an einer Partie: Bilanz eintragen + „Du bist dran“, wenn man woanders ist
on('session', ({ id, local, isNew }) => {
  const s = getSession(id);
  if (!s) return;
  const st = recordIfEnded(s);
  if (!st || local || isNew || s.meta.mode !== 'remote') return;
  const todo = st.phase === 'end' ? null : LOGIC[s.meta.game].todo(st, me.get());
  const before = lastTodo.get(id);
  lastTodo.set(id, todo);
  if (onScreen(id)) return;
  if (st.phase === 'end' && !st.aborted) {
    const line = LOGIC[s.meta.game].endLine ? LOGIC[s.meta.game].endLine(st) : (st.winner === 'draw' ? 'Unentschieden!' : `${nameOf(st.winner)} hat gewonnen!`);
    toast(`${gameTitle(s.meta.game)}: ${line}`, { icon: 'trophy', action: { label: 'Ansehen', run: () => nav('#/spiel/' + id) } });
  } else if (todo && todo !== before) {
    sfx.join();
    toast(`${gameTitle(s.meta.game)} – du bist dran: ${todo}`, { icon: 'sparkle', ms: 5000, action: { label: 'Los', run: () => nav('#/spiel/' + id) } });
  }
});

// Anstupsen vom anderen Handy
on('fx', (d) => {
  if (d.kind !== 'poke') return;
  haptic([30, 60, 30, 60, 30]);
  sfx.pop();
  stamp(currentTheme() === 'lila' ? 'ツン!' : 'Stups!', innerWidth / 2, innerHeight / 3, { cls: currentTheme() === 'lila' ? 'manga' : '' });
  toast(`${nameOf(d.from)} stupst dich an!`, { icon: 'poke' });
});
