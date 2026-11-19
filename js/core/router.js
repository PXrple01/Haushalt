// Router: Adressen wie #/wer, #/lobby, #/neu/hangman, #/spiel/<id> → Bildschirm-Module.
// Jedes Modul exportiert mount(root, ...params) und gibt optional eine Aufräum-Funktion zurück.
import { me } from './store.js';
import { motionOK } from './theme.js';
import { clearOverlays } from './ui.js';

const ROUTES = [
  { re: /^#\/wer$/, load: () => import('../screens/wer.js') },
  { re: /^#\/lobby$/, load: () => import('../screens/lobby.js') },
  { re: /^#\/neu\/(hangman|whoami|number|mime|draw|ships|escape)$/, load: () => import('../screens/setup.js') },
  { re: /^#\/spiel\/([a-z0-9]+)$/, load: () => import('../screens/game.js') },
  { re: /^#\/dev$/, load: () => import('../screens/dev.js') },
];

let app = null;
let current = null;
let token = 0;

export async function nav(hash, o = {}) {
  if (o.replace) history.replaceState(null, '', hash);
  else if (location.hash !== hash) history.pushState(null, '', hash);
  await render(o);
}

export const currentHash = () => location.hash;

async function render(o = {}) {
  const my = ++token;
  let hash = location.hash || '#/wer';
  let route = ROUTES.find((r) => r.re.test(hash));
  if (!route || (!me.get() && !/^#\/(wer|dev)$/.test(hash))) {
    hash = '#/wer';
    history.replaceState(null, '', hash);
    route = ROUTES[0];
  }
  const params = hash.match(route.re).slice(1);
  let mod;
  try {
    mod = await route.load();
  } catch (e) {
    console.error(e);
    app.innerHTML = '<div class="screen center"><p class="panel">Das hat nicht geklappt. Bitte die Seite neu laden.</p></div>';
    return;
  }
  if (my !== token) return; // inzwischen woanders hin navigiert
  const swap = async () => {
    try { current?.(); } catch (e) { console.error(e); }
    current = null;
    clearOverlays();
    app.replaceChildren();
    let res = null;
    try { res = await mod.mount(app, ...params); } catch (e) { console.error(e); }
    current = typeof res === 'function' ? res : null;
    window.scrollTo(0, 0);
  };
  const useVT = o.vt !== false && !!document.startViewTransition && motionOK() && app.childElementCount > 0;
  if (useVT) {
    try {
      const t = document.startViewTransition(swap);
      await t.updateCallbackDone;
    } catch { /* Übergang abgebrochen – Inhalt ist trotzdem getauscht */ }
  } else {
    await swap();
  }
}

export function startRouter(root) {
  app = root;
  window.addEventListener('popstate', () => render({ vt: true }));
  return render({ vt: false });
}
