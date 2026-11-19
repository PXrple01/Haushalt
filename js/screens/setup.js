// #/neu/<spiel>: Einstellungen vor dem Start (kommt aus dem jeweiligen Spiel-Modul).
import { VIEW } from '../games/registry.js';

export async function mount(root, game) {
  const m = await VIEW[game]();
  return m.setup(root);
}
