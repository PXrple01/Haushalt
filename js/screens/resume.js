// „Laufende Partien“ in der Lobby: noch nicht beendete Partien der letzten Tage, mit „Du bist dran“-Hinweis.
import { h, esc } from '../core/dom.js';
import { icon } from '../art/icons.js';
import { me } from '../core/store.js';
import { allSessions } from '../core/sync.js';
import { LOGIC, stateOf } from '../games/registry.js';
import { gameTitle } from '../games/info.js';
import { nav } from '../core/router.js';
import { sfx } from '../core/sound.js';

export function resumeList() {
  const p = me.get();
  const items = [];
  for (const s of allSessions()) {
    if (Date.now() - (s.updated || 0) > 7 * 864e5) continue;
    const st = stateOf(s);
    if (!st || st.phase === 'end') continue;
    items.push({ s, st, todo: LOGIC[s.meta.game].todo(st, p), label: LOGIC[s.meta.game].label(st) });
    if (items.length >= 3) break;
  }
  if (!items.length) return [];
  const wrap = h('section', { class: 'resume', 'aria-label': 'Laufende Partien' });
  wrap.innerHTML = `<h2 class="resume-h">Laufende Partien</h2>` + items.map(({ s, todo, label }) => `
    <button class="resume-item${todo ? ' mine' : ''}" type="button" data-sid="${esc(s.meta.id)}">
      <span class="r-icon">${icon(s.meta.mode === 'remote' ? 'remote' : 'sofa')}</span>
      <span class="r-text"><b>${esc(gameTitle(s.meta.game))}</b><small>${esc(todo ? `Du bist dran: ${todo}` : label)}</small></span>
      <span class="r-go">Weiter</span>
    </button>`).join('');
  wrap.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sid]');
    if (b) { sfx.pop(); nav('#/spiel/' + b.dataset.sid); }
  });
  return [wrap];
}
