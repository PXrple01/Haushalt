// Wortpool fürs Galgenmännchen. Schwierigkeit ergibt sich aus der Länge (ohne Leerzeichen/Bindestriche):
// leicht ≤ 6 Buchstaben, mittel 7–9, schwer ≥ 10 (oder mehrere Wörter).

import { MORE_CATS, MORE, MORE_NEW } from './words-more.js';

export const WORD_CATS = [
  { id: 'all', label: 'Alles' },
  { id: 'liebe', label: 'Liebe & wir zwei' },
  { id: 'tiere', label: 'Tiere' },
  { id: 'essen', label: 'Essen & Trinken' },
  { id: 'fantasie', label: 'Märchen & Fantasie' },
  { id: 'zuhause', label: 'Zuhause' },
  { id: 'natur', label: 'Natur & Wetter' },
  { id: 'freizeit', label: 'Freizeit' },
  { id: 'orte', label: 'Orte & Reisen' },
  { id: 'berufe', label: 'Berufe' },
  { id: 'dinge', label: 'Alltag & Dinge' },
];

export const WORD_LEVELS = [
  { id: 'leicht', label: 'Leicht' },
  { id: 'mittel', label: 'Mittel' },
  { id: 'schwer', label: 'Schwer' },
];

const RAW = {
  liebe: 'Kuss, Umarmung, Kuscheln, Date, Herzklopfen, Liebesbrief, Jahrestag, Verliebt, Händchenhalten, Candlelight-Dinner, Sternenhimmel, Schmetterlinge im Bauch, Liebesschloss, Rosenstrauß, Pärchenfoto, Kuschelsocken, Filmabend, Frühstück im Bett, Lieblingsmensch, Schatz, Spaziergang, Überraschung, Geschenk, Valentinstag, Hochzeit, Flitterwochen, Seelenverwandt, Kuschelecke, Sonnenschein, Herzchen, Glücksmoment, Lachanfall, Zweisamkeit, Pyjamaparty, Wolke sieben, Videoanruf, Kosename, Liebeslied, Hand in Hand, Für immer, Schmusen, Zärtlichkeit, Romantik, Heiratsantrag, Verlobungsring',
  tiere: 'Hund, Katze, Maus, Pferd, Esel, Schwein, Schaf, Ziege, Hase, Igel, Fuchs, Wolf, Eule, Adler, Spatz, Pinguin, Delfin, Krake, Qualle, Seestern, Robbe, Otter, Biber, Faultier, Koala, Känguru, Giraffe, Zebra, Tiger, Elefant, Nashorn, Nilpferd, Krokodil, Schildkröte, Chamäleon, Papagei, Flamingo, Schmetterling, Marienkäfer, Eichhörnchen, Waschbär, Erdmännchen, Alpaka, Pfau, Glühwürmchen, Hamster, Meerschweinchen, Wellensittich, Pandabär, Seepferdchen, Kolibri, Dackel, Hummel',
  essen: 'Apfel, Banane, Kiwi, Mango, Erdbeere, Himbeere, Wassermelone, Ananas, Kirsche, Zitrone, Brezel, Pizza, Nudeln, Lasagne, Pfannkuchen, Waffel, Croissant, Toast, Müsli, Honig, Marmelade, Schokolade, Gummibärchen, Zuckerwatte, Popcorn, Eiscreme, Cupcake, Donut, Muffin, Käsekuchen, Bratwurst, Pommes, Ketchup, Kartoffel, Brokkoli, Karotte, Gurke, Tomate, Avocado, Sushi, Ramen, Döner, Spaghetti, Kakao, Milchshake, Limonade, Smoothie, Bubble Tea, Spiegelei, Lebkuchen, Marzipan, Erdnussbutter, Zimtschnecke, Bienenstich, Kaiserschmarrn',
  fantasie: 'Einhorn, Drache, Fee, Elfe, Zauberer, Hexe, Prinzessin, Prinz, Ritter, Krone, Zauberstab, Zaubertrank, Kristallkugel, Meerjungfrau, Kobold, Troll, Riese, Zwerg, Phönix, Pegasus, Wichtel, Gespenst, Vampir, Werwolf, Schatztruhe, Piratenschiff, Schatzkarte, Feenstaub, Glücksklee, Wunschbrunnen, Zauberspiegel, Lebkuchenhaus, Fliegender Teppich, Tarnumhang, Drachenei, Sternenstaub, Regenbogenland, Zauberwald, Elfenkönigin, Glitzerschuhe',
  zuhause: 'Sofa, Kissen, Decke, Lampe, Spiegel, Teppich, Vorhang, Kühlschrank, Toaster, Wasserkocher, Kaffeemaschine, Waschmaschine, Staubsauger, Bügeleisen, Zahnbürste, Handtuch, Badewanne, Dusche, Bett, Wecker, Fernbedienung, Fernseher, Bücherregal, Kleiderschrank, Schublade, Pfanne, Kochtopf, Schneebesen, Nudelholz, Gießkanne, Blumentopf, Kerze, Lichterkette, Kuscheltier, Hausschuhe, Bettwäsche, Schlüssel, Briefkasten, Türklingel, Fensterbank, Steckdose, Ladekabel, Spülmaschine, Mikrowelle, Wäscheklammer, Badeente',
  natur: 'Sonne, Mond, Stern, Wolke, Regen, Schnee, Gewitter, Blitz, Donner, Regenbogen, Nebel, Wind, Sturm, Hagel, Frost, Sonnenuntergang, Sternschnuppe, Polarlicht, Vulkan, Wasserfall, Gletscher, Wüste, Oase, Dschungel, Wald, Wiese, Berg, Insel, Strand, Muschel, Welle, Ozean, Fluss, Höhle, Kaktus, Sonnenblume, Gänseblümchen, Tulpe, Rose, Löwenzahn, Kirschblüte, Pilz, Eichel, Kastanie, Herbstlaub, Schneeflocke, Eiszapfen, Pfütze, Vollmond, Morgentau',
  freizeit: 'Fußball, Tennis, Schwimmen, Wandern, Radfahren, Skifahren, Schlittschuh, Yoga, Tanzen, Malen, Basteln, Stricken, Lesen, Kochen, Backen, Gärtnern, Fotografieren, Puzzle, Brettspiel, Karaoke, Konzert, Festival, Zelten, Angeln, Klettern, Bowling, Minigolf, Trampolin, Achterbahn, Videospiel, Serienmarathon, Picknick, Sandburg, Schneemann, Drachensteigen, Seifenblasen, Lagerfeuer, Rollschuhe, Skateboard, Kinoabend, Spieleabend, Kissenschlacht',
  orte: 'Paris, Rom, London, Berlin, Hamburg, München, Wien, Venedig, Tokio, New York, Hawaii, Island, Norwegen, Kanada, Japan, Italien, Spanien, Griechenland, Ägypten, Australien, Mexiko, Brasilien, Ostsee, Nordsee, Alpen, Schwarzwald, Bodensee, Freizeitpark, Zoo, Aquarium, Kino, Museum, Bibliothek, Flughafen, Bahnhof, Spielplatz, Schwimmbad, Eisdiele, Bäckerei, Jahrmarkt, Weihnachtsmarkt, Campingplatz, Leuchtturm, Schloss, Riesenrad, Disneyland',
  berufe: 'Ärztin, Lehrer, Bäcker, Koch, Polizistin, Feuerwehrmann, Pilotin, Astronaut, Tierärztin, Friseur, Gärtner, Fotografin, Zahnarzt, Schreiner, Maler, Musiker, Sängerin, Tänzerin, Schauspieler, Detektiv, Journalistin, Programmierer, Architektin, Krankenpfleger, Hebamme, Bauer, Fischer, Kellnerin, Postbote, Bibliothekarin, Konditor, Florist, Imker, Archäologe, Meeresbiologin, Busfahrer, Clown, Bergführer, Erzieherin, Tierpfleger',
  dinge: 'Regenschirm, Rucksack, Brille, Uhr, Handy, Laptop, Kamera, Fahrrad, Roller, Auto, Zug, Flugzeug, Rakete, Luftballon, Kompass, Taschenlampe, Sonnenbrille, Sonnencreme, Lippenstift, Nagellack, Haarspange, Haargummi, Schal, Mütze, Handschuhe, Gummistiefel, Turnschuhe, Geldbeutel, Kugelschreiber, Radiergummi, Notizbuch, Klebeband, Schere, Briefmarke, Postkarte, Konfetti, Geschenkpapier, Wunderkerze, Glitzer, Sticker, Kopfhörer, Polaroid',
};

const lettersOf = (w) => w.replace(/[ -]/g, '').length;
const levelOf = (w) => {
  const n = lettersOf(w);
  if (/[ -]/.test(w) || n >= 10) return 'schwer';
  return n <= 6 ? 'leicht' : 'mittel';
};

WORD_CATS.push(...MORE_CATS);

// Grundpool + Erweiterung zusammenführen; jedes Wort nur einmal (Groß/Klein egal)
const ALL = { ...RAW };
for (const [cat, list] of Object.entries({ ...MORE, ...MORE_NEW })) ALL[cat] = ALL[cat] ? `${ALL[cat]}, ${list}` : list;
const seen = new Set();
export const WORDS = Object.entries(ALL).flatMap(([cat, list]) =>
  list.split(',').map((s) => s.trim()).filter(Boolean).filter((t) => {
    const k = t.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).map((text) => ({ text, cat, level: levelOf(text) })));

// Für den Pool-Wähler: Liste nach Kategorie und Schwierigkeit
export function wordItems(cat, level) {
  let list = cat === 'all' ? WORDS : WORDS.filter((w) => w.cat === cat);
  if (level) {
    const f = list.filter((w) => w.level === level);
    if (f.length >= 3) list = f;
  }
  return list;
}
