// Start der Kicherkiste: Symbole einsetzen, Theme setzen, Router starten, Offline-Modus anmelden.
import { iconSprite } from './art/icons.js';
import { applyMotion, setTheme, themeForMe } from './core/theme.js';
import { me, prefs, on } from './core/store.js';
import { setNicks } from './core/util.js';
import { unlockAudio } from './core/sound.js';
import { startRouter } from './core/router.js';
import './core/sync.js';
import './core/notify.js';
import { connect } from './core/net.js';

setNicks(prefs.get('nicks'));
on('prefs', ({ k, v }) => { if (k === 'nicks') setNicks(v); });
document.body.insertAdjacentHTML('afterbegin', iconSprite());
applyMotion();
setTheme(themeForMe());
unlockAudio();

// Jeder Start beginnt mit „Wer spielt?“ – außer man lädt mitten in einer laufenden Partie neu.
const startHash = location.hash;
if (!(me.get() && /^#\/spiel\//.test(startHash)) && startHash !== '#/dev') history.replaceState(null, '', '#/wer');
startRouter(document.getElementById('app'));
connect(); // Weit weg: Verbindung sofort aufbauen (auch beim Neuladen mitten in einer Partie)

// Offline-Start (nicht auf dem lokalen Test-Server, damit Änderungen sofort sichtbar sind)
if ('serviceWorker' in navigator && !/^(localhost|127\.)/.test(location.hostname)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
