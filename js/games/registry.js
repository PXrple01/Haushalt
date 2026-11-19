// Register der Spiele: Logik (sofort geladen, klein) und Oberfläche (erst bei Bedarf geladen).
import * as hangman from './hangman/logic.js';
import * as whoami from './whoami/logic.js';
import * as number from './number/logic.js';
import * as mime from './mime/logic.js';

export const LOGIC = { hangman, whoami, number, mime };

export const VIEW = {
  hangman: () => import('./hangman/view.js'),
  whoami: () => import('./whoami/view.js'),
  number: () => import('./number/view.js'),
  mime: () => import('./mime/view.js'),
};

// Spielstand einer gespeicherten Partie berechnen
export function stateOf(session) {
  const L = LOGIC[session?.meta?.game];
  return L ? L.reduce(session.meta, session.evs) : null;
}
