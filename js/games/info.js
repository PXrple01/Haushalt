// Spiele-Übersicht: Titel und kurze Beschreibungen (für Lobby, Einladungen, Bilanz).
export const GAMES = {
  hangman: { id: 'hangman', title: 'Galgenmännchen', sub: 'Einer versteckt ein Wort, der andere rät Buchstabe für Buchstabe.' },
  whoami: { id: 'whoami', title: 'Wer bin ich?', sub: 'Ihr denkt euch gegenseitig eine Figur aus und erfragt, wer ihr seid.' },
  number: { id: 'number', title: 'Zahl erraten', sub: '1 bis 100 – wer braucht weniger Fragen?' },
  mime: { id: 'mime', title: 'Pantomime', sub: 'Darstellen ohne Worte – der andere rät laut.' },
  draw: { id: 'draw', title: 'Kritzelspiel', sub: 'Einer kritzelt, der andere rät.' },
  ships: { id: 'ships', title: 'Herzchen versenken', sub: 'Versteckt Einhörner, Wolken und Katzen – und findet die des anderen.' },
  escape: { id: 'escape', title: 'Escape-Abenteuer', sub: 'Befreit euch gemeinsam – jeder sieht etwas anderes.', coop: true },
};
export const gameTitle = (id) => GAMES[id]?.title ?? 'Spiel';
