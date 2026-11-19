// #/spiel/<id>: eine laufende (oder beendete) Partie.
import { h } from '../core/dom.js';
import { icon } from '../art/icons.js';
import { getSession } from '../core/sync.js';
import { VIEW } from '../games/registry.js';
import { nav } from '../core/router.js';
import { setWhere } from '../core/net.js';

export async function mount(root, id) {
  const s = getSession(id);
  if (!s) {
    const box = h('section', { class: 'screen center stack' });
    box.innerHTML = `<div class="panel stack center" style="margin:auto;max-width:360px">
      <p class="lead">Diese Partie gibt es auf diesem Handy nicht (mehr).</p>
      <button class="btn primary" type="button">${icon('home')}<span>Zur Lobby</span></button></div>`;
    box.querySelector('button').addEventListener('click', () => nav('#/lobby'));
    root.append(box);
    return null;
  }
  setWhere(`spiel:${id}:${s.meta.game}`);
  const m = await VIEW[s.meta.game]();
  const cleanup = m.play(root, id);
  return () => { setWhere('lobby'); cleanup?.(); };
}
