// Register der Spiele: Logik (sofort geladen, klein) und Oberfläche (erst bei Bedarf geladen).
import * as hangman from './hangman/logic.js';
import * as whoami from './whoami/logic.js';
import * as number from './number/logic.js';
import * as mime from './mime/logic.js';
import * as draw from './draw/logic.js';
import * as ships from './ships/logic.js';
import * as escape from './escape/logic.js';
import * as krimi from './krimi/logic.js';

export const LOGIC = { hangman, whoami, number, mime, draw, ships, escape, krimi };

export const VIEW = {
  hangman: () => import('./hangman/view.js'),
  whoami: () => import('./whoami/view.js'),
  number: () => import('./number/view.js'),
  mime: () => import('./mime/view.js'),
  draw: () => import('./draw/view.js'),
  ships: () => import('./ships/view.js'),
  escape: () => import('./escape/view.js'),
  krimi: () => import('./krimi/view.js'),
};

// Spielstand einer gespeicherten Partie berechnen
export function stateOf(session) {
  const L = LOGIC[session?.meta?.game];
  return L ? L.reduce(session.meta, session.evs) : null;
}
