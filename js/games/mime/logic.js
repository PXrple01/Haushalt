// Pantomime – Logik (gemeinsame Rundenlogik, siehe ../rounds.js)
import { reduceRounds, roundTodo, roundLabel } from '../rounds.js';

export const reduce = (meta, evs) => reduceRounds(meta, evs);
export const todo = (st, p) => roundTodo(st, p, 'Darstellen');
export const label = (st) => roundLabel(st, 'stellt dar');
