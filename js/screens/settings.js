// Einstellungen (Blatt): Design, Töne, Vibration, Bewegung, Code für „Weit weg“, Person wechseln, Bilanz zurücksetzen.
import { h } from '../core/dom.js';
import { icon } from '../art/icons.js';
import { me, prefs } from '../core/store.js';
import { nameOf } from '../core/util.js';
import { miniHalf } from '../art/heart.js';
import { esc } from '../core/dom.js';
import { switchTheme, themeOf } from '../core/theme.js';
import { sheet, segmented, toast, confirmBox } from '../core/ui.js';
import { sfx } from '../core/sound.js';
import { nav } from '../core/router.js';
import { resetStats } from '../core/stats.js';

export function openSettings() {
  const p = me.get();
  const body = h('div', { class: 'stack', style: { '--gap': '4px' } });
  body.innerHTML = `
    <div class="set-group"><h3>Mein Design</h3><div data-slot="theme"></div></div>
    <div class="set-group">
      <label class="switch">${icon('soundon')}<span>Töne</span><input type="checkbox" data-k="sound" ${prefs.get('sound') ? 'checked' : ''}><span class="track"></span></label>
      <label class="switch">${icon('vibrate')}<span>Vibration <small class="soft">(Android)</small></span><input type="checkbox" data-k="haptics" ${prefs.get('haptics') ? 'checked' : ''}><span class="track"></span></label>
    </div>
    <div class="set-group"><h3>Bewegung</h3><div data-slot="motion"></div></div>
    <div class="set-group">
      <h3>Spitznamen in der App</h3>
      <label class="nick-row"><span class="nick-half" aria-hidden="true">${miniHalf('jos')}</span><input class="field" data-nick="jos" maxlength="20" autocomplete="off" aria-label="Spitzname für die pinke Herzhälfte" value="${esc(nameOf('jos'))}"></label>
      <label class="nick-row"><span class="nick-half" aria-hidden="true">${miniHalf('joh')}</span><input class="field" data-nick="joh" maxlength="20" autocomplete="off" aria-label="Spitzname für die lila Herzhälfte" value="${esc(nameOf('joh'))}"></label>
      <p class="hint">Gilt für dieses Handy. Auf „Wer spielt?“ stehen immer die echten Namen.</p>
    </div>
    <div class="set-group">
      <h3>Code für „Weit weg“</h3>
      <div class="row"><input class="field grow" data-slot="code" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="40" placeholder="z. B. einhorn42">
      <button class="btn" type="button" data-a="code">Speichern</button></div>
      <p class="hint">Auf beiden Handys muss derselbe Code stehen.</p>
    </div>
    <div class="set-group">
      <button class="btn block" type="button" data-a="who">${icon('users')}<span>Person wechseln</span></button>
      <button class="btn quiet block" type="button" data-a="reset">${icon('trash')}<span>Duell-Bilanz zurücksetzen</span></button>
    </div>
    <p class="ver">Kicherkiste 1.0 – gemacht für ${esc(nameOf('jos'))} und ${esc(nameOf('joh'))}</p>`;
  body.querySelector('[data-slot="code"]').value = prefs.get('code') || '';

  const themeSeg = segmented({
    label: 'Mein Design', value: themeOf(p),
    options: [{ value: 'baby', label: 'Baby', icon: 'heart' }, { value: 'lila', label: 'Lila', icon: 'star' }],
    onChange: (v) => {
      prefs.set('themeFor', { ...prefs.get('themeFor'), [p]: v });
      const r = themeSeg.getBoundingClientRect();
      switchTheme(v, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    },
  });
  body.querySelector('[data-slot="theme"]').append(themeSeg);

  body.querySelector('[data-slot="motion"]').append(segmented({
    label: 'Bewegung', value: prefs.get('motion'),
    options: [{ value: 'auto', label: 'Automatisch' }, { value: 'full', label: 'Voll' }, { value: 'reduced', label: 'Ruhig' }],
    onChange: (v) => prefs.set('motion', v),
  }));

  body.addEventListener('change', (e) => {
    const nk = e.target.dataset.nick;
    if (nk) {
      prefs.set('nicks', { ...prefs.get('nicks'), [nk]: e.target.value.trim() });
      e.target.value = nameOf(nk);
      toast('Spitzname gespeichert.', { icon: 'check' });
      return;
    }
    const k = e.target.dataset.k;
    if (!k) return;
    prefs.set(k, e.target.checked);
    if (k === 'sound' && e.target.checked) sfx.good();
  });

  const sh = sheet({ title: 'Einstellungen', body, label: 'Einstellungen' });
  body.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'who') { sh.close(); nav('#/wer'); }
    else if (a === 'code') {
      const v = body.querySelector('[data-slot="code"]').value.trim();
      if (v && v.length < 4) { toast('Der Code braucht mindestens 4 Zeichen.', { icon: 'info' }); return; }
      prefs.set('code', v);
      toast(v ? 'Code gespeichert.' : 'Code gelöscht.', { icon: 'check' });
    } else if (a === 'reset') {
      const ok = await confirmBox({ title: 'Bilanz zurücksetzen?', text: `Alle Siege von ${nameOf('jos')} und ${nameOf('joh')} werden auf 0 gesetzt – auch auf dem anderen Handy, sobald ihr verbunden seid.`, ok: 'Zurücksetzen', danger: true });
      if (ok) { resetStats(); toast('Bilanz steht wieder auf 0:0.', { icon: 'check' }); }
    }
  });
  return sh;
}

