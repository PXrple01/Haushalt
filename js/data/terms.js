import { MORE_TERMS } from './terms-more.js';
import { curatedLevel, defaultLevel } from './levels.js';

// Begriffe für Pantomime und Kritzelspiel. Pro Kategorie eine Grundstufe; „!“ vor einem Begriff = schwer, „~“ = leicht.

const POOL = {
  mime: {
    cats: [
      { id: 'alltag', label: 'Alltag', level: 'leicht', list: 'Zähne putzen, Duschen, Staubsaugen, Fenster putzen, ~Kochen, Zwiebeln schneiden, Abwaschen, Einkaufen, ~Auto fahren, ~Fahrrad fahren, Bus verpassen, Wecker ausschalten, Verschlafen, Schuhe binden, Haare föhnen, Schminken, Rasieren, ~Kaffee trinken, Spaghetti essen, ~Eis essen, ~Telefonieren, Selfie machen, Fernsehen, Schlüssel suchen, Wäsche aufhängen, Geschenk auspacken, Kerzen auspusten, ~Niesen, ~Gähnen, Schluckauf, Regenschirm aufspannen, Koffer packen, Zelt aufbauen, Blumen gießen, Briefe schreiben' },
      { id: 'sport', label: 'Sport & Freizeit', level: 'mittel', list: '~Fußball, ~Tennis, Basketball, ~Schwimmen, Surfen, Skifahren, Boxen, Yoga, Joggen, Gewichtheben, Bogenschießen, Golf, Bowling, Reiten, Klettern, Tauchen, Rudern, Eiskunstlauf, Seilspringen, Ballett, Breakdance, Limbo, Fallschirmspringen, Angeln, Karate, Hula-Hoop, Trampolin springen, Kegeln, Zumba, Achterbahn fahren, Karaoke singen, Sandburg bauen, Drachen steigen lassen, Schneeballschlacht' },
      { id: 'tiere', label: 'Tiere', level: 'leicht', list: 'Hund, Katze, Elefant, Affe, Pinguin, Känguru, Giraffe, Schlange, Krokodil, Frosch, Huhn, Flamingo, !Faultier, !Krake, Hase, Kuh, Pferd, Schmetterling, Biene, Ente, Löwe, Gorilla, Robbe, Eichhörnchen, Fisch, Bär, Kamel, Einhorn, Drache, Spinne, Eule, !Chamäleon' },
      { id: 'berufe', label: 'Berufe', level: 'mittel', list: '~Arzt, Zahnarzt, Feuerwehrmann, Polizist, ~Koch, Kellner, Pilot, Friseur, Maler, Fotograf, Lehrer, Dirigent, DJ, Zauberer, Clown, Bauarbeiter, Postbote, Gärtner, Astronaut, Pirat, Detektiv, Model, Schlagzeuger, Gitarrist, Bäcker, Taxifahrer, Tierpfleger, Ritter, Bademeister, Pantomime' },
      { id: 'gefuehle', label: 'Gefühle', level: 'schwer', list: 'Verliebt, Wütend, Traurig, Glücklich, Gelangweilt, Nervös, Müde, Überrascht, Ängstlich, Stolz, Eifersüchtig, Verwirrt, Schüchtern, Aufgeregt, Beleidigt, Erleichtert, Angeekelt, Lachanfall, Schadenfroh, Heimweh' },
      { id: 'figuren', label: 'Figuren & Promis', level: 'mittel', list: 'Superman, Spider-Man, Harry Potter, Elsa, Darth Vader, Pikachu, Mario, Tarzan, Dracula, Zombie, Roboter, Meerjungfrau, Pinocchio, Sumo-Ringer, Weihnachtsmann, Osterhase, Ninja, Cowboy, Prinzessin, Hexe, Gespenst, Sherlock Holmes, Moonwalk, Elvis, Mr. Bean, Hulk, Batman, Rapunzel, Shrek, Son Goku' },
      { id: 'wir', label: 'Wir zwei', level: 'mittel', list: 'Heiratsantrag, Händchen halten, Kuscheln auf dem Sofa, Frühstück ans Bett, Liebesbrief schreiben, Erstes Date, Hochzeitswalzer, Ständchen singen, Gute-Nacht-Kuss, Streit um die Fernbedienung, Decke klauen, Schnarchen, Zusammen kochen, Pärchen-Selfie, Blumen überreichen, Ring anstecken, Umzugskartons tragen, IKEA-Schrank aufbauen, Serienabend, Romantisches Picknick, Huckepack tragen, Rücken massieren, Auf den Partner warten, Gemeinsam einschlafen' },
      { id: 'knifflig', label: 'Knifflige Sachen', level: 'schwer', list: 'Zeitreise, Lampenfieber, Déjà-vu, Muskelkater, Ohrwurm, Gänsehaut, Schwerelosigkeit, Fernweh, Funkloch, Montagmorgen, Stau, Winterschlaf, Sonnenbrand, Lagerfeuer, Erdbeben, Vulkanausbruch, Gewitter, Regenbogen, Spiegelbild, Schatten, Echo, Wackelpudding, Heißluftballon, Geisterbahn, Karussell, Seifenblase, Kaugummi, Zahnschmerzen, Kalte Füße' },
    ],
  },
  draw: {
    cats: [
      { id: 'tiere', label: 'Tiere', level: 'leicht', list: 'Katze, Hund, Fisch, Vogel, Schnecke, Elefant, Giraffe, Schlange, Spinne, Schmetterling, Biene, Hase, Pinguin, Eule, Krake, Schildkröte, Igel, Maus, Frosch, Einhorn, Dino, !Krokodil, Qualle, Wal, Fuchs, !Seepferdchen, !Flamingo' },
      { id: 'essen', label: 'Essen', level: 'leicht', list: 'Pizza, Eis, Banane, Apfel, Erdbeere, Kirsche, Brezel, Burger, Hotdog, Donut, Torte, Croissant, Spiegelei, Karotte, Ananas, Popcorn, Lolli, Sushi, Spaghetti, Pommes, Melone, Avocado, Käse, Toast, Muffin' },
      { id: 'dinge', label: 'Dinge', level: 'leicht', list: 'Haus, Auto, Fahrrad, Boot, Flugzeug, Rakete, Schlüssel, Brille, Regenschirm, Lampe, Uhr, Handy, Kamera, Gitarre, Krone, Ballon, Geschenk, Kerze, Buch, Stuhl, Bett, Zelt, Leiter, Schere, Glühbirne, Anker, !Kompass, Koffer, Rucksack, Socke' },
      { id: 'natur', label: 'Natur', level: 'mittel', list: '~Sonne, ~Mond, ~Stern, Wolke, Regenbogen, Blitz, Schneemann, Baum, Blume, Kaktus, Pilz, Berg, Vulkan, Insel, Welle, Palme, Tannenbaum, Schneeflocke, Feuer, Blatt, Rose, Sonnenblume, Kleeblatt, !Wasserfall, !Polarlicht' },
      { id: 'orte', label: 'Orte', level: 'mittel', list: 'Schloss, Leuchtturm, Eiffelturm, Brücke, Zirkuszelt, Riesenrad, Achterbahn, Strand, Spielplatz, Bauernhof, Pyramide, Iglu, Burg, Bahnhof, Kino, Schwimmbad, Zoo, Baumhaus, !Freiheitsstatue, !Weihnachtsmarkt' },
      { id: 'szenen', label: 'Szenen', level: 'schwer', list: 'Angeln, Schlafen, Tanzen, Fliegen, Kochen, Zähne putzen, Schwimmen, Lesen, Picknick, Geburtstag, Hochzeit, Umarmung, Selfie, Sternschnuppe, Schneeballschlacht, Sonnenuntergang, Gewitter, Lagerfeuer, Weltraum, Unterwasserwelt' },
      { id: 'wir', label: 'Wir zwei', level: 'mittel', list: '~Herz, Ring, Kussmund, Liebesbrief, Rose, Kerzenlicht-Dinner, Hochzeitstorte, Teddy, Sofa, Kinoabend, Picknickdecke, Liebesschloss, Händchen halten, Zahnbürsten, Kuschelsocken, Heißluftballon, Gondel, Sonnenuntergang am Meer, Frühstück im Bett, Unser Zuhause' },
    ],
  },
};

// Erweiterung einhängen: bestehende Kategorien ergänzen, neue anhängen
for (const game of Object.keys(MORE_TERMS)) {
  const P = POOL[game], M = MORE_TERMS[game];
  for (const c of P.cats) if (M.add[c.id]) c.list += `, ${M.add[c.id]}`;
  P.cats.push(...M.cats);
}

// Stufe: von Hand zugeordnet (levels.js) → „!“/„~“ → Standard der Kategorie in levels.js → Grundstufe
const parse = (game, cat, list, base) => list.split(',').map((s) => s.trim()).filter(Boolean).map((t) => {
  let text = t, mark = null;
  if (t.startsWith('!')) { text = t.slice(1).trim(); mark = 'schwer'; }
  else if (t.startsWith('~')) { text = t.slice(1).trim(); mark = 'leicht'; }
  return { text, level: curatedLevel(game, cat, text) || mark || defaultLevel(game, cat) || base };
});

export function termCats(game) {
  return [{ id: 'all', label: 'Alles' }, ...POOL[game].cats.map((c) => ({ id: c.id, label: c.label }))];
}

// Begriffe für Kategorien (Liste von IDs oder ['all']) und Stufe ('leicht' | 'mittel' | 'schwer' | 'alle')
// Alle Begriffe eines Spiels (jeder nur einmal, Groß/Klein egal) – einmal berechnet
const cacheAll = {};
function allOf(game) {
  if (cacheAll[game]) return cacheAll[game];
  const seen = new Set();
  cacheAll[game] = POOL[game].cats.flatMap((c) => parse(game, c.id, c.list, c.level).map((x) => ({ ...x, cat: c.id, catLabel: c.label })))
    .filter((x) => { const k = x.text.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  return cacheAll[game];
}

export function termItems(game, cats = ['all'], level = 'alle') {
  const all = allOf(game);
  let list = cats.includes('all') ? all : all.filter((x) => cats.includes(x.cat));
  if (!list.length) list = all;
  if (level && level !== 'alle') {
    const f = list.filter((x) => x.level === level);
    if (f.length >= 6) list = f;
  }
  return list;
}

export function pickTerm(game, cats, level, avoid = []) {
  const list = termItems(game, cats, level);
  const fresh = list.filter((x) => !avoid.includes(x.text));
  const from = fresh.length ? fresh : list;
  return from[Math.floor(Math.random() * from.length)];
}
