// Krimi „Blutnacht im Hotel Edelweiß“ – Stockwerke, Räume und Fundstellen.
// Raum: { name, floor, r: [x, y, w, h] (Grundriss, viewBox 0 0 100 70), d: Beschreibung, lock?, spots: [...] }
// lock: 'schluessel' (Büroschlüssel) · 'master' (Generalschlüssel) · { after: Minute, msg } (erst ab einer Uhrzeit)
// Fundstelle: { id, n: Handlung, c: Minuten (für die Spurensicherung), g: [Spuren], x: was man sieht,
//               w?: Bedingung (sonst gesperrt, lockMsg), v?: [{ w, g, x, set }] (je nach Uhrzeit/Ereignis) }
// Bedingungen: after/before (Minuten seit Mitternacht des 5. Jänner, 23:00 = 1380), f/nf (Merker), has (eigene Akte)

export const FLOORS = [
  { id: 'ug', name: 'Keller', short: 'UG' },
  { id: 'eg', name: 'Erdgeschoss', short: 'EG' },
  { id: 'og', name: '1. Stock', short: 'OG' },
  { id: 'dg', name: 'Dachgeschoss', short: 'DG' },
];

export const ROOMS = {
  // ---------------- Keller ----------------
  weinkeller: {
    name: 'Weinkeller', floor: 'ug', r: [2, 3, 38, 33],
    d: 'Ein Gewölbe aus Bruchstein, acht Grad kalt. Es riecht nach Rotwein, Eisen und feuchter Erde. Zwischen den Regalen liegt Konrad Falkner.',
    spots: [
      { id: 'leiche', n: 'Leiche untersuchen', c: 15, g: ['leiche', 'schluessel'], x: 'Du kniest dich an den Rand der Lache. Das Blut ist kalt und dunkel, fast schwarz, und es klebt an deinen Schuhsohlen.' },
      { id: 'unter', n: 'Unter der Leiche nachsehen', c: 10, w: { has: 'leiche' }, lockMsg: 'Untersuche zuerst die Leiche.', g: ['uhr', 'medaillon'], x: 'Du drehst ihn ein Stück auf die Seite. Das Blut darunter ist schon zäh wie Sirup – und darin glitzert etwas.' },
      { id: 'wunde', n: 'Die Wunden genauer ansehen', c: 10, w: { has: 'leiche' }, lockMsg: 'Untersuche zuerst die Leiche.', g: ['wunde'], x: 'Mit der Taschenlampe ganz nah heran. Du zwingst dich hinzusehen.' },
      { id: 'scherben', n: 'Scherben und Flaschen untersuchen', c: 10, g: ['scherben', 'flaschenhals'], x: 'Zwölf Flaschen, eine zerborstene Holzkiste, Rotwein überall. Glas knirscht unter deinen Schuhen.' },
      { id: 'regal', n: 'Auf das Regal klettern', c: 10, w: { has: 'scherben' }, lockMsg: 'Sieh dir zuerst die Scherben an – woher kam die Kiste?', g: ['kerze', 'wachsabdruck'], x: 'Du steigst auf eine Weinkiste und leuchtest das oberste Brett ab – dort, wo die Kiste gestanden hat.' },
      { id: 'boden', n: 'Den Boden nach Spuren absuchen', c: 10, g: ['schuhspuren'], x: 'Auf allen vieren, die Lampe flach über den Steinboden.' },
    ],
  },
  waschkueche: {
    name: 'Waschküche', floor: 'ug', r: [42, 3, 27, 33],
    d: 'Neonlicht, zwei Trommelwaschmaschinen, ein großes Steinbecken. Gleich neben dem Weinkeller – keine zehn Schritte entfernt.',
    spots: [
      { id: 'becken', n: 'Waschbecken untersuchen', c: 10, g: ['abfluss'], x: 'Das Becken ist trocken. Fast zu sauber.' },
      { id: 'korb', n: 'Wäschekorb durchwühlen', c: 10, g: ['handtuch'], x: 'Frische Bettwäsche, Tischtücher, Schürzen – und ganz unten etwas Feuchtes.' },
      { id: 'regal', n: 'Regal ansehen', c: 5, g: ['schnurrolle'], x: 'Waschmittel, Klammern, Bügelstärke, eine Rolle Schnur.' },
    ],
  },
  heizraum: {
    name: 'Heizraum', floor: 'ug', r: [71, 3, 27, 33],
    d: 'Der Ölkessel brummt wie ein schlafendes Tier. An der Wand hängen Thermometer und ein Klemmbrett.',
    spots: [
      { id: 'kessel', n: 'Klemmbrett am Kessel lesen', c: 5, g: ['heizprotokoll'], x: 'Gretas saubere Schrift, Tag für Tag.' },
      { id: 'werkbank', n: 'Werkbank durchsuchen', c: 5, g: [], x: 'Schraubenzieher, Isolierband, eine tote Spinne. Hier hat heute Nacht niemand etwas gesucht.' },
    ],
  },
  skiraum: {
    name: 'Skiraum', floor: 'ug', r: [2, 45, 40, 22],
    d: 'Reihen von Skiern, Wachsgeruch, ein Bügeleisen auf der Wachsbank. Weit weg von den Gästen – ein Ort, an dem man ungestört ist.',
    spots: [
      { id: 'staender', n: 'Skiständer ansehen', c: 5, g: ['stoecke_voll'], v: [{ w: { f: 'stockWeg' }, g: ['stock_fehlt'], x: 'Du gehst die Reihen ab. Irgendetwas ist anders als vorhin.' }], x: 'Leihski, Rennski, Stöcke in Reih und Glied.' },
      { id: 'wachsbank', n: 'Wachsbank durchsuchen', c: 10, g: ['schal'], x: 'Wachsblöcke, Abziehklingen, das Bügeleisen ist kalt.' },
      { id: 'spind', n: 'Lukas’ Spind öffnen', c: 10, g: ['kuendigung', 'foto_vl'], x: 'Der Spind ist nicht abgesperrt. Ein Skilehrer-Anorak, Handschuhe, ein Spiegel an der Tür.' },
    ],
  },
  spa: {
    name: 'Spa', floor: 'ug', r: [44, 45, 54, 22],
    d: 'Holz, gedämpftes Licht und der Geruch von Zirbe. Ein Whirlpool, Ruheliegen und die Sauna mit dem kleinen Fenster in der Tür.',
    spots: [
      { id: 'whirlpool', n: 'Whirlpool ansehen', c: 5, g: ['whirlpool'], x: 'Ein Schild hängt am Geländer.' },
      {
        id: 'sauna', n: 'Sauna öffnen', c: 10, g: [], x: 'Die Sauna ist kalt und dunkel. Es riecht nach altem Holz.',
        v: [
          { w: { f: 'emilDead' }, g: ['leiche2', 'kuebel', 'skistock'], set: 'emilFound', x: 'Die Tür klemmt – von außen ist ein Skistock unter die Klinke gekeilt. Du reißt ihn weg. Eine Wand aus Hitze schlägt dir entgegen.' },
          { w: { f: 'falle' }, g: ['falle'], x: 'Hitze schlägt dir entgegen, obwohl niemand drin ist.' },
          { w: { f: 'saunaHeiss' }, g: ['sauna_heiss'], x: 'Warme Luft strömt dir entgegen. Die Steine knistern.' },
        ],
      },
      { id: 'thermostat', n: 'Thermostat ablesen', c: 5, g: ['thermo_aus'], v: [{ w: { f: 'saunaHeiss' }, g: ['thermostat'] }], x: 'Ein kleines Display neben der Saunatür.' },
    ],
  },

  // ---------------- Erdgeschoss ----------------
  hinterhof: {
    name: 'Hinterhof', floor: 'eg', r: [2, 2, 96, 9], outside: true,
    lock: { after: 1620, msg: 'Draußen tobt der Sturm. Die Hintertür lässt sich gegen den Wind nicht einmal einen Spalt öffnen – erst wenn er sich legt.' },
    d: 'Schneewehen bis zur Hüfte, der Wind hat endlich nachgelassen. Über euch die dunklen Fenster der Bibliothek.',
    spots: [
      { id: 'schnee', n: 'Unter dem Bibliotheksfenster graben', c: 15, g: ['skalpell'], x: 'Du gräbst mit bloßen Händen, bis die Finger brennen. Dann stößt du auf etwas Hartes, Steifgefrorenes.' },
      { id: 'kellerfenster', n: 'Kellerfenster prüfen', c: 5, g: ['kellerfenster'], x: 'Ein kleines Fenster knapp über dem Boden, halb im Schnee.' },
    ],
  },
  bibliothek: {
    name: 'Bibliothek', floor: 'eg', r: [2, 14, 25, 25],
    d: 'Ledersessel, Bücher bis unter die Decke, ein Schachtisch am Fenster. Draußen wirft sich der Sturm gegen die Scheiben.',
    spots: [
      { id: 'schach', n: 'Schachtisch untersuchen', c: 10, g: ['schachbrett', 'schachprotokoll'], x: 'Die Figuren stehen noch so, wie sie um 22:31 verlassen wurden.' },
      { id: 'fenster', n: 'Aus dem Fenster sehen', c: 5, g: ['fenster'], x: 'Du drückst die Stirn an das eiskalte Glas.' },
      { id: 'sessel', n: 'Sessel durchsuchen', c: 5, g: ['brillenetui'], x: 'Du fährst mit der Hand in die Ritzen der Polster.' },
    ],
  },
  bar: {
    name: 'Bar', floor: 'eg', r: [29, 14, 18, 25],
    d: 'Zirbenholz, Flaschen bis zur Decke. Nachts ist die Bar ohne Personal: Wer trinkt, trägt sich ins Barbuch ein.',
    spots: [
      { id: 'theke', n: 'Barbuch lesen', c: 5, g: ['barbuch'], x: 'Ein ledernes Buch auf der Theke, ein Kugelschreiber an einer Kette.' },
      { id: 'glaeser', n: 'Gläser ansehen', c: 5, g: [], x: 'Zwei Cognacschwenker, ein Teeglas, ein Gin-Tonic-Glas mit Lippenstift. Nichts, was nicht ins Barbuch passt.' },
    ],
  },
  speisesaal: {
    name: 'Speisesaal', floor: 'eg', r: [49, 14, 25, 25],
    d: 'Der lange Tisch ist noch nicht abgeräumt. Halbvolle Gläser, erkaltetes Wachs, zurückgeschobene Stühle.',
    spots: [
      { id: 'tafel', n: 'Gedeckten Tisch ansehen', c: 5, g: ['sitzordnung'], x: 'Tischkarten, Weingläser, ein umgekipptes Salzfass.' },
      { id: 'kandelaber', n: 'Tischkerzen prüfen', c: 5, g: ['stearinkerzen'], x: 'Zwei silberne Kandelaber mit heruntergebrannten Kerzen.' },
    ],
  },
  kueche: {
    name: 'Küche', floor: 'eg', r: [76, 14, 22, 25],
    d: 'Blitzblanker Edelstahl – Maries Reich. Eine schmale Tür führt hinaus in den Personalgang.',
    spots: [
      { id: 'tuer', n: 'Den Weg zum Keller abgehen', c: 5, g: ['weg'], x: 'Du nimmst die Stoppuhr am Handy und gehst los: Bibliothek, Speisesaal, Küche, Personalgang, Treppe, Keller.' },
      { id: 'spuele', n: 'Spülbecken ansehen', c: 5, g: ['geschirrtuch'], x: 'Ein großes Doppelbecken, darüber ein Haken mit Geschirrtüchern.' },
      { id: 'messer', n: 'Messerblock prüfen', c: 5, g: [], x: 'Alle Messer stecken an ihrem Platz, blitzsauber. Maries Messertasche liegt verschlossen daneben. Hier fehlt nichts.' },
    ],
  },
  kapelle: {
    name: 'Kapelle', floor: 'eg', r: [2, 44, 19, 24],
    d: 'Eine winzige Hauskapelle aus Zirbenholz. Es ist so still, dass du deinen eigenen Herzschlag hörst.',
    spots: [
      { id: 'altar', n: 'Altar untersuchen', c: 10, g: ['altar'], x: 'Zwei schwere Messingleuchter, ein Kreuz, eine kleine Tafel aus Messing.' },
      { id: 'bank', n: 'Kirchenbänke absuchen', c: 5, g: ['taschentuch'], x: 'Sechs schmale Bänke, das Holz blank gesessen.' },
    ],
  },
  kaminzimmer: {
    name: 'Kaminzimmer', floor: 'eg', r: [23, 44, 24, 24], meet: true,
    d: 'Hier warten die Verdächtigen, bewacht vom Feuer und voneinander. Niemand spricht. Jeder beobachtet jeden.',
    spots: [
      { id: 'kamin', n: 'Kamin durchsuchen', c: 5, g: [], x: 'Im Feuer knacken Buchenscheite. Hier wurde nichts verbrannt außer Holz.' },
    ],
  },
  rezeption: {
    name: 'Rezeption', floor: 'eg', r: [49, 44, 23, 24],
    d: 'Die Halle mit dem Hirschgeweih und dem großen Kamin. Hier hängt das Schlüsselbrett, hier liegt das Gästebuch.',
    spots: [
      { id: 'gaestebuch', n: 'Gästebuch lesen', c: 5, g: ['gaestebuch'], x: 'Ein schweres Buch mit Goldschnitt.' },
      { id: 'brett', n: 'Schlüsselbrett prüfen', c: 5, g: ['schluesselbrett'], x: 'Messinghaken, nummerierte Anhänger aus Holz.' },
    ],
  },
  portiersloge: {
    name: 'Portiersloge', floor: 'eg', r: [74, 44, 12, 24], emil: true,
    d: 'Emils Glaskasten: ein Stuhl, das Haustelefon, die Funkstation und sein Dienstbuch. Von hier sieht man fast alles.',
    spots: [
      { id: 'dienstbuch', n: 'Dienstbuch lesen', c: 10, g: ['dienstbuch'], x: 'Ein dickes Buch mit Ledereinband. Jede Nacht, Seite für Seite.' },
      { id: 'block', n: 'Notizblock ansehen', c: 5, g: [], v: [{ w: { f: 'note' }, g: ['durchdruck'], x: 'Du hältst den Block schräg gegen das Licht.' }], x: 'Ein Block mit Hotel-Briefkopf. Die oberste Seite ist leer und glatt.' },
    ],
  },
  personalgang: {
    name: 'Personalgang', floor: 'eg', r: [88, 44, 10, 24],
    d: 'Ein schmaler, kalter Gang hinter der Küche, gefliest bis zur Decke. Hier führt die Personaltreppe hinunter zum Keller.',
    spots: [
      { id: 'treppe', n: 'Personaltreppe absuchen', c: 5, g: ['tropfen'], x: 'Stufe für Stufe, die Lampe dicht über dem Stein.' },
      { id: 'spiegel', n: 'Den Spiegel an der Ecke prüfen', c: 5, g: ['spiegel'], x: 'Ein großer, gewölbter Spiegel hängt an der Ecke zur Halle.' },
    ],
  },

  // ---------------- 1. Stock ----------------
  suite: {
    name: 'Suite Falkner', floor: 'og', r: [2, 3, 34, 30], lock: 'master',
    d: 'Ein Himmelbett, zwei Nachttische, ein Kleiderschrank so groß wie ein Zimmer. Es riecht nach Parfum und kaltem Zigarrenrauch.',
    spots: [
      { id: 'schrank', n: 'Kleiderschrank durchsuchen', c: 5, g: ['kleid'], x: 'Abendkleider, Pelze, Anzüge.' },
      { id: 'nachttisch', n: 'Nachttische durchsuchen', c: 10, g: ['brief_t'], x: 'Links Viktorias Cremes und Schlaftabletten, rechts Falkners Lesebrille und Papiere.' },
      { id: 'handy', n: 'Viktorias Handy ansehen', c: 10, g: ['handy'], x: 'Es liegt auf dem Bett, der Bildschirm leuchtet auf.' },
    ],
  },
  buero: {
    name: 'Büro', floor: 'og', r: [38, 3, 24, 30], lock: 'schluessel',
    d: 'Ein Eichenschreibtisch, Hirschgeweihe, ein Wandtresor hinter einem Bild vom Großglockner. Nur Falkner hatte einen Schlüssel.',
    spots: [
      { id: 'schreibtisch', n: 'Schreibtisch durchsuchen', c: 10, g: ['kalender', 'tagebuch', 'zettel_tresor'], x: 'Papiere, Rechnungen, ein Lederbüchlein.' },
      { id: 'schublade', n: 'Verschlossene Schublade aufbrechen', c: 10, g: ['dna'], x: 'Mit einem Brieföffner hebelst du das kleine Schloss auf. Darin: ein einzelner Umschlag.' },
      { id: 'tresor', n: 'Wandtresor hinter dem Bild', c: 5, g: ['tresor'], x: 'Du hebst das Bild ab.' },
      { id: 'papierkorb', n: 'Papierkorb durchsuchen', c: 5, g: ['vertrag'], x: 'Papierfetzen, eine leere Zigarrenschachtel.' },
    ],
  },
  zimmer3: {
    name: 'Zimmer 3', floor: 'og', r: [64, 3, 34, 30], lock: 'master',
    d: 'Zimmer 3, Sophie Lenz. Ein aufgeklappter Laptop, überall Notizzettel, eine teure Kamera auf dem Bett.',
    spots: [
      { id: 'laptop', n: 'Laptop durchsehen', c: 15, g: ['recherche'], x: 'Kein Passwort – sie hat ihn in der Eile offen gelassen.' },
      { id: 'kamera', n: 'Kamera durchklicken', c: 5, g: ['kamera'], x: 'Du blätterst rückwärts durch die Bilder.' },
      { id: 'koffer', n: 'Koffer durchsuchen', c: 5, g: ['generalschluessel2', 'presseausweis'], x: 'Kleidung, Ladekabel – und eine Naht im Futter, die nicht vom Hersteller ist.' },
    ],
  },
  zimmer9: {
    name: 'Zimmer 9', floor: 'og', r: [2, 39, 30, 28], lock: 'master',
    d: 'Zimmer 9, Henrik Novak. Penibel aufgeräumt. Anzüge auf Bügeln, eine Aktentasche aus schwarzem Leder.',
    spots: [
      { id: 'aktentasche', n: 'Aktentasche öffnen', c: 10, g: ['novak_mail'], x: 'Verträge, Exposés, ein ausgedruckter Mailverlauf.' },
      { id: 'schuhe', n: 'Schuhe ansehen', c: 5, g: ['novak_schuhe'], x: 'Neben der Tür, ordentlich nebeneinander.' },
    ],
  },
  zimmer12: {
    name: 'Zimmer 12', floor: 'og', r: [34, 39, 30, 28], lock: 'master',
    d: 'Zimmer 12, Dr. Theodor Wendt. Es riecht nach Desinfektionsmittel und nasser Wolle.',
    spots: [
      { id: 'arzttasche', n: 'Arzttasche durchsuchen', c: 10, g: ['arzttasche'], x: 'Eine abgewetzte Ledertasche mit Messingschloss, nicht verschlossen.' },
      { id: 'jacke', n: 'Jacke untersuchen', c: 10, g: ['jacke'], v: [{ w: { f: 'emilDead' }, g: ['jacke', 'jacke_faden'] }], x: 'Über der Stuhllehne hängt eine grünbraune Tweedjacke.' },
      { id: 'schuhe', n: 'Schuhe ansehen', c: 5, g: ['wendt_schuhe'], x: 'Vor dem Bett, daneben ein Schuhputzkasten.' },
      { id: 'aschenbecher', n: 'Aschenbecher ansehen', c: 5, g: [], v: [{ w: { f: 'emilDead' }, g: ['asche'], x: 'Es riecht verbrannt.' }], x: 'Ein schwerer Aschenbecher aus Kristall. Sauber. Dr. Wendt raucht nicht.' },
      { id: 'nachttisch', n: 'Nachttisch durchsuchen', c: 10, g: ['taschenuhr'], x: 'Ein Buch über Bergkräuter, ein Glas Wasser, eine goldene Taschenuhr.' },
    ],
  },

  // ---------------- Dachgeschoss (Personal) ----------------
  marie: {
    name: 'Maries Zimmer', floor: 'dg', r: [2, 14, 31, 40], lock: 'master',
    d: 'Unter der Dachschräge: Kochbücher, Rechnungsstapel, auf dem Nachttisch ein Foto ihrer Mutter.',
    spots: [
      { id: 'schreibtisch', n: 'Schreibtisch durchsuchen', c: 10, g: ['marie_schulden'], x: 'Briefe mit rotem Stempel, ein Ordner mit der Aufschrift »Innsbruck«.' },
      { id: 'waesche', n: 'Wäschekorb ansehen', c: 5, g: ['bluse'], x: 'Obenauf liegt etwas Weißes. Es ist nicht mehr weiß.' },
    ],
  },
  greta: {
    name: 'Gretas Kammer', floor: 'dg', r: [35, 14, 30, 40], lock: 'master',
    d: 'Heiligenbilder, ein Strickkorb, ein Radio. Auf dem Kasten steht eine alte Blechschatulle.',
    spots: [
      { id: 'schatulle', n: 'Blechschatulle öffnen', c: 10, g: ['briefe', 'sterbebild'], x: 'Die Schatulle ist schwer. Darin: Papier, mit einem Samtband verschnürt.' },
      { id: 'strick', n: 'Strickkorb und Radio ansehen', c: 5, g: [], x: 'Ein halbfertiger Schal, ein Rosenkranz, das Radio steht auf Ö2. Gretas Abend sieht genau so aus, wie sie ihn beschreibt.' },
    ],
  },
  lukas: {
    name: 'Lukas’ Zimmer', floor: 'dg', r: [67, 14, 31, 40], lock: 'master',
    d: 'Pokale, Rennplakate, Wäsche auf dem Boden. Unter dem Bett liegt etwas.',
    spots: [
      { id: 'tasche', n: 'Unter dem Bett nachsehen', c: 10, g: ['reisetasche'], x: 'Du ziehst eine prall gefüllte Sporttasche hervor.' },
      { id: 'messer', n: 'Nachttisch durchsuchen', c: 5, g: ['taschenmesser'], x: 'Kopfhörer, Kaugummi, ein Taschenmesser.' },
    ],
  },
};

// Wo die Verdächtigen warten (Emil bleibt in seiner Loge)
export const MEET = 'kaminzimmer';
export const START_ROOM = 'rezeption';

// Gänge für den Grundriss (nur Grafik)
export const HALLS = {
  ug: [[2, 37, 96, 6]],
  eg: [[2, 40, 96, 3], [27, 14, 2, 25]],
  og: [[2, 34, 96, 4], [66, 39, 32, 28]],
  dg: [[2, 56, 96, 6]],
};
// Treppen (nur Grafik): [x, y]
export const STAIRS = { ug: [[90, 41]], eg: [[93, 41], [62, 41]], og: [[80, 52]], dg: [[50, 59]] };
