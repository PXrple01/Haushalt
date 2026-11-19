// Spiele-Übersicht: Titel und kurze Beschreibungen (für Lobby, Einladungen, Bilanz).
export const GAMES = {
  hangman: { id: 'hangman', title: 'Galgenmännchen', sub: 'Einer versteckt ein Wort, der andere rät Buchstabe für Buchstabe.' },
  whoami: { id: 'whoami', title: 'Wer bin ich?', sub: 'Ihr denkt euch gegenseitig eine Figur aus und erfragt, wer ihr seid.' },
  number: { id: 'number', title: 'Zahl erraten', sub: '1 bis 100 – wer braucht weniger Fragen?' },
};
export const gameTitle = (id) => GAMES[id]?.title ?? 'Spiel';
