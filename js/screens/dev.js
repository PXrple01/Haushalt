// Prüf-Seite #/dev: alle Bausteine in beiden Themes (für Screenshots und Tests).
import { h } from '../core/dom.js';
import { icon } from '../art/icons.js';
import { mascot } from '../art/mascots.js';
import { HEART, heartDefs, halfJos, halfJoh, logo, fullHeart } from '../art/heart.js';
import { switchTheme, currentTheme } from '../core/theme.js';
import { segmented, toast, sheet, confirmBox, handoff } from '../core/ui.js';
import { burst, celebrate, confetti, shake, stamp } from '../core/fx.js';
import { sfx } from '../core/sound.js';

export function mount(root) {
  const s = h('section', { class: 'screen stack dev', style: { '--gap': '18px' } });
  s.innerHTML = `
    <div class="lobby-top">${logo()}<span class="spacer"></span>
      <button class="iconbtn" data-a="theme" aria-label="Theme wechseln">${icon('palette')}</button></div>
    <h1 class="display h1">Bausteine</h1>
    <div class="row wrap">
      <button class="btn primary" data-a="toast">${icon('sparkle')} Primär</button>
      <button class="btn">Normal</button>
      <button class="btn quiet">Leise</button>
      <button class="btn small">Klein</button>
      <button class="btn danger small">Gefahr</button>
      <button class="btn" disabled>Aus</button>
    </div>
    <button class="btn primary big block" data-a="sheet">Großer Knopf – Blatt öffnen</button>
    <div data-slot="seg"></div>
    <div class="chips"><button class="chip" aria-pressed="true">Tiere</button><button class="chip">Essen</button><button class="chip">${icon('dice')} Zufall</button><button class="chip">Liebe</button></div>
    <div class="panel stack"><span class="label">Eingabe</span><input class="field" placeholder="Dein Wort …"><p class="hint bad">Nur Buchstaben, bitte.</p>
      <div class="row wrap"><span class="badge jos"><span class="dot on"></span>Josefine ist online</span><span class="badge joh">Johann</span><span class="badge"><span class="dot wait"></span>Warte …</span></div></div>
    <div class="note">${icon('info')}<span>Ein Hinweis in ruhigem Ton, damit man weiß, was als Nächstes passiert.</span></div>
    <div class="row wrap" data-slot="masc"></div>
    <div class="row wrap">
      <button class="btn small" data-a="burst">Herzchen</button>
      <button class="btn small" data-a="confetti">Konfetti</button>
      <button class="btn small" data-a="win">Sieg</button>
      <button class="btn small" data-a="shake">Wackeln</button>
      <button class="btn small" data-a="dialog">Dialog</button>
      <button class="btn small" data-a="handoff">Übergabe</button>
      <button class="btn small" data-a="stamp">Stempel</button>
    </div>
    <svg viewBox="${HEART.view}" style="width:200px;overflow:visible">${heartDefs('dv')}<g>${halfJos('dv')}</g><g>${halfJoh('dv')}</g></svg>
    <div style="width:80px">${fullHeart()}</div>`;
  root.append(s);

  s.querySelector('[data-slot="seg"]').append(segmented({
    label: 'Modus', cls: 'big', value: 'couch',
    options: [{ value: 'couch', label: 'Nebeneinander', icon: 'sofa' }, { value: 'remote', label: 'Weit weg', icon: 'remote' }],
  }));
  const ms = s.querySelector('[data-slot="masc"]');
  for (const k of ['kiki', 'kuro']) for (const m of ['idle', 'happy', 'cheer', 'shock', 'sad', 'hide']) {
    ms.insertAdjacentHTML('beforeend', `<div style="width:92px;text-align:center;font-size:12px">${mascot(k, m)}<div>${m}</div></div>`);
  }

  s.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const r = b.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    switch (b.dataset.a) {
      case 'theme': switchTheme(currentTheme() === 'baby' ? 'lila' : 'baby', { x, y }); break;
      case 'toast': toast('Gespeichert – alles bereit!', { icon: 'check' }); sfx.good(); break;
      case 'sheet': sheet({ title: 'Ein Blatt', body: '<p class="soft">Zum Schließen nach unten ziehen oder daneben tippen.</p><div style="height:180px"></div>' }); break;
      case 'burst': burst(x, y, { emoji: true }); sfx.sparkle(); break;
      case 'confetti': confetti(); break;
      case 'win': celebrate(); sfx.win(); break;
      case 'shake': shake(b); sfx.bad(); break;
      case 'dialog': confirmBox({ title: 'Partie beenden?', text: 'Der Spielstand dieser Runde geht verloren.', ok: 'Beenden', danger: true }); break;
      case 'handoff': await handoff({ to: currentTheme() === 'baby' ? 'jos' : 'joh', text: 'Johann, nicht hinschauen!' }); toast('Weiter geht’s'); break;
      case 'stamp': stamp(currentTheme() === 'lila' ? 'ガーン!' : 'Juhu!', x, y - 40, { cls: currentTheme() === 'lila' ? 'manga' : '' }); break;
    }
  });
}
