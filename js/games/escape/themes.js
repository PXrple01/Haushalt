// Escape-Abenteuer – die sieben Geschichten. Jede hat vier Räume mit je einer Rätsel-Art und eigener „Verkleidung“ (skin).
// Farben: pal.dark = dunkle Szene (helle Schrift). symbols = Symbole für Schloss und Echo.

const ing = (id, name, sym, col) => ({ id, name, sym, col });
const obj = (id, name, pl, sym, col) => ({ id, name, pl, sym, col });
const acc = (id, name, w, wo) => ({ id, name, with: w, without: wo });

export const THEMES = [
  {
    id: 'schloss',
    title: 'Flucht aus dem Regenbogenschloss',
    short: 'Regenbogenschloss',
    tag: 'Märchen',
    blurb: 'Die Wolkenhexe Nimbella hat euch in ihren höchsten Turm gesperrt. Verblasst der Regenbogen, kommt ihr nie wieder nach Hause.',
    pal: { dark: false, bg1: '#FFE1F1', bg2: '#CFE6FF', acc: '#FF4FA0', acc2: '#8F5BFF', ink: '#4E1D45', glow: '#FFD1EA' },
    symbols: ['stern', 'herz', 'krone', 'mond', 'diamant', 'blume', 'wolke', 'perle', 'bonbon'],
    intro: [
      'Eben habt ihr noch auf einer Wolke gepicknickt. Dann ein Donnergrollen, ein Wirbel aus Glitzer – und plötzlich: Steinwände, ein winziges Fenster, eine schwere Tür.',
      '„Hihi!“, kichert es draußen. Die Wolkenhexe Nimbella! „Wer auf MEINER Wolke picknickt, bleibt für immer in meinem Schloss!“',
      'Durchs Fenster seht ihr den Regenbogen, der zur Erde führt. Er wird schon blasser. Wenn er ganz verschwindet, sitzt ihr fest.',
      'Zum Glück hat Nimbella eine Schwäche: Sie schreibt sich alles auf. Einer von euch findet ihre Notizen, der andere die Schlösser. Nur zusammen kommt ihr raus!',
    ],
    outro: [
      'Hand in Hand rutscht ihr den Regenbogen hinunter – so schnell, dass es im Bauch kribbelt.',
      'Hinter euch kreischt Nimbella: „Das ist UNFAIR! Ihr habt ja zusammengearbeitet!“',
      'Ganz genau. Und genau deshalb habt ihr gewonnen.',
    ],
    lose: 'Der Regenbogen ist verblasst … Nimbella serviert Wolkentee. Für immer. Na ja – vielleicht klappt es beim nächsten Mal!',
    rooms: [
      {
        kind: 'lock', name: 'Das Turmzimmer', icon: 'krone',
        story: 'Die Tür hat ein Schloss mit Regenbogen-Edelsteinen und drehbaren Symbolen. In einem Kissen steckt Nimbellas Zauberbuch – voller Kritzeleien.',
        done: 'Klick! Die Tür schwingt auf. Eine Wendeltreppe aus Zuckerguss führt nach unten.',
        skin: { device: 'Turmschloss', gems: 'Edelsteine', book: 'Zauberbuch', indicator: 'die Kerze', lamp: 'Kerze', on: 'brennt', off: 'ist aus' },
      },
      {
        kind: 'echo', name: 'Der Kristallsaal', icon: 'diamant',
        story: 'Im Saal schweben singende Kristalle. Sie leuchten nacheinander auf – und die Gartentür öffnet sich nur, wenn man ihre Melodie mit Symbolen nachspielt.',
        done: 'Die Kristalle singen im Chor – und die Gartentür springt auf!',
        skin: { device: 'Kristallharfe', lights: 'Kristalle', book: 'Notenblatt' },
      },
      {
        kind: 'maze', name: 'Der Heckengarten', icon: 'blume',
        story: 'Ein Labyrinth aus Rosenhecken, eingehüllt in Glitzernebel. Wer drinsteht, sieht kaum die eigene Nasenspitze. Aber am Brunnen hängt eine Gartenkarte.',
        done: 'Ihr steht vor dem Regenbogentor – aber es ist blass und durchsichtig …',
        skin: { map: 'Gartenkarte', goal: 'das Regenbogentor', fog: 'Glitzernebel', wall: 'Hecke' },
      },
      {
        kind: 'potion', name: 'Nimbellas Hexenküche', icon: 'flasche',
        story: 'Neben dem Tor brodelt Nimbellas Kessel. Nur ein goldener Trank lässt den Regenbogen wieder leuchten. Das Rezept? Steht natürlich in ihrem Buch.',
        done: 'Der Trank glüht golden. Ihr gießt ihn über das Tor – und der Regenbogen strahlt in allen Farben!',
        skin: {
          pot: 'Kessel', book: 'Rezeptbuch',
          ingredients: [ing('staub', 'Sternenstaub', 'stern', 'gold'), ing('watte', 'Wolkenwatte', 'wolke', 'weiss'), ing('tau', 'Mondtau', 'tropfen', 'blau'), ing('bluete', 'Feenblüte', 'blume', 'rosa'), ing('pilz', 'Glitzerpilz', 'pilz', 'lila'), ing('bonbon', 'Herzbonbon', 'bonbon', 'rot'), ing('perle', 'Zauberperle', 'perle', 'tuerkis')],
        },
      },
    ],
  },
  {
    id: 'tokio',
    title: 'Neon-Nacht in Neo-Tokio',
    short: 'Neo-Tokio',
    tag: 'Cyber-Krimi',
    blurb: 'Der Hacker-Kater Glitch hat euch in einer Spielhalle eingesperrt. Um Mitternacht fährt der letzte Magnetzug nach Hause.',
    pal: { dark: true, bg1: '#12082E', bg2: '#33105A', acc: '#FF3DAE', acc2: '#38E8FF', ink: '#F7EEFF', glow: '#FF3DAE' },
    symbols: ['blitz', 'stern', 'herz', 'note', 'katze', 'planet', 'rakete', 'diamant', 'sonne'],
    intro: [
      'Neo-Tokio, 23:31 Uhr. Ihr wolltet nur schnell noch einen Mochi-Automaten ausprobieren. Dann ein Zischen – und die Rollläden knallen herunter.',
      'Auf allen Bildschirmen erscheint ein grinsender Kater mit Sonnenbrille. „Ich bin GLITCH. Diese Spielhalle gehört jetzt mir. Und ihr … spielt mit!“',
      'Der letzte Magnetzug nach Hause fährt um Mitternacht. Aber Glitch hat einen Fehler gemacht: Seine Codes und Anleitungen liegen überall herum.',
      'Einer von euch hackt sich in Glitchs Notizen, der andere steht an den Geräten. Redet miteinander – laut und schnell!',
    ],
    outro: [
      'Mit einem Satz springt ihr in den Magnetzug. Die Türen schließen sich – 23:59 Uhr.',
      'Auf dem Bildschirm im Zug taucht Glitch auf. Er schmollt. Dann grinst er: „Okay … ihr seid gut. Revanche?“',
      'Ihr winkt ihm zu, während Neo-Tokio in Pink und Blau an euch vorbeirauscht.',
    ],
    lose: 'Der letzte Zug ist weg. Glitch spendiert euch wenigstens eine Schüssel Ramen. Revanche?',
    rooms: [
      {
        kind: 'echo', name: 'Der Tanzautomat', icon: 'note',
        story: 'Der einzige Weg nach draußen führt durch Glitchs Lieblingsautomaten. Seine Neonlichter blinken eine Folge – spielt sie als Symbole nach! Die Anleitung klebt auf der Rückseite.',
        done: 'HIGHSCORE! Der Automat klappt zur Seite – dahinter liegt ein Geheimgang.',
        skin: { device: 'Tanzautomat', lights: 'Neonlichter', book: 'Anleitung' },
      },
      {
        kind: 'maze', name: 'Die Nudelgassen', icon: 'blitz',
        story: 'Der Geheimgang endet in einem Gewirr aus Gassen, voller Dampf von hundert Nudelküchen. Man sieht keinen Meter weit – aber das Handy hat eine Stadtkarte.',
        done: 'Da! Die Treppe zur U-Bahn. Aber das Drehkreuz ist verriegelt.',
        skin: { map: 'Stadtkarte', goal: 'die U-Bahn-Treppe', fog: 'Nudeldampf', wall: 'Mauer' },
      },
      {
        kind: 'wires', name: 'Das Drehkreuz', icon: 'zahnrad',
        story: 'Glitch hat das Drehkreuz umprogrammiert. Unter der Abdeckung leuchten bunte Neonkabel. Im Wartungshandbuch der Bahn steht, welches man durchschneiden muss.',
        done: 'Das Drehkreuz dreht sich mit einem fröhlichen Pling!',
        skin: { device: 'Drehkreuz', threads: 'Neonkabel', book: 'Wartungshandbuch', plate: 'Seriennummer' },
      },
      {
        kind: 'safe', name: 'Das Schließfach', icon: 'schluessel',
        story: 'Auf dem Bahnsteig steht Glitchs Schließfach – darin die Fahrkarte nach Hause! Den Code hat er als Rechenaufgaben notiert. Die Zahlen stecken in den Dingen am Bahnsteig.',
        done: 'Die Tür springt auf – da liegt sie, die goldene Fahrkarte!',
        skin: {
          safe: 'Schließfach', book: 'Glitchs Notizblock', scene: 'Bahnsteig',
          objects: [obj('katze', 'Winkekatze', 'Winkekatzen', 'katze', 'gold'), obj('taiyaki', 'Taiyaki', 'Taiyaki', 'fisch', 'orange'), obj('blitz', 'Blitz-Sticker', 'Blitz-Sticker', 'blitz', 'tuerkis'), obj('note', 'Musiknote', 'Musiknoten', 'note', 'rosa'), obj('bonbon', 'Bonbon', 'Bonbons', 'bonbon', 'lila')],
        },
      },
    ],
  },
  {
    id: 'lebkuchen',
    title: 'Gefangen im Lebkuchenhaus',
    short: 'Lebkuchenhaus',
    tag: 'Süß & schaurig',
    blurb: 'Ihr wolltet nur ein winziges Stück vom Dach naschen … Jetzt seid ihr eingesperrt, und die Hexe Knusperine heizt schon den Ofen vor.',
    pal: { dark: false, bg1: '#FFEFD6', bg2: '#F7C59B', acc: '#D64F23', acc2: '#7A3E1D', ink: '#4A2512', glow: '#FFD9A8' },
    symbols: ['stern', 'herz', 'bonbon', 'pilz', 'glocke', 'schluessel', 'muenze', 'kleeblatt', 'tropfen'],
    intro: [
      'Mitten im Zuckerwald stand es: ein Haus aus Lebkuchen, mit Dachziegeln aus Schokolade und Fenstern aus Zucker. Nur ein klitzekleiner Bissen …',
      'KNACK – die Tür fällt hinter euch ins Schloss. Aus der Küche schlurft die Hexe Knusperine. „Wie schööön! Besuch zum Abendessen!“',
      'Zum Glück ist Knusperine furchtbar vergesslich. Überall im Haus hat sie Zettel versteckt. Und gleich hält sie ihr Nickerchen.',
      'Einer von euch liest die Zettel, der andere packt an. Leise … und schnell!',
    ],
    outro: [
      'Ihr rennt den Schokolinsenweg entlang, bis das Lebkuchenhaus nur noch ein Krümel am Horizont ist.',
      'In euren Taschen: ein paar Zimtsterne als Andenken. Die habt ihr euch verdient.',
      'Und Knusperine? Schnarcht vermutlich bis Weihnachten.',
    ],
    lose: 'Knusperine ist aufgewacht! Zum Glück will sie nur, dass ihr Plätzchen backt. Sehr viele Plätzchen. Nächstes Mal klappt die Flucht!',
    rooms: [
      {
        kind: 'safe', name: 'Die Vorratskammer', icon: 'bonbon',
        story: 'Knusperine hat euch in ihre Vorratskammer gesperrt. Die Tür hat ein Zahlenschloss. Auf einem Zettel stehen Rechenaufgaben – und die Antworten liegen überall in den Regalen.',
        done: 'Das Schloss klickt. Ihr schleicht in den Flur – wo eine ganze Familie Lebkuchenmännchen steht.',
        skin: {
          safe: 'Zahlenschloss', book: 'Knusperines Zettel', scene: 'Regal',
          objects: [obj('bonbon', 'Bonbon', 'Bonbons', 'bonbon', 'rosa'), obj('pilz', 'Zuckerpilz', 'Zuckerpilze', 'pilz', 'rot'), obj('stern', 'Zimtstern', 'Zimtsterne', 'stern', 'gold'), obj('herz', 'Lebkuchenherz', 'Lebkuchenherzen', 'herz', 'orange'), obj('blatt', 'Minzblatt', 'Minzblätter', 'blatt', 'gruen'), obj('taler', 'Schokotaler', 'Schokotaler', 'muenze', 'gold')],
        },
      },
      {
        kind: 'lineup', name: 'Die Lebkuchen-Familie', icon: 'herz',
        story: 'Sechs Lebkuchenmännchen stehen stramm im Flur. Eines davon ist der verzauberte Hausschlüssel! Auf einem Steckbrief hat Knusperine notiert, wie es aussieht.',
        done: 'Ihr drückt auf seinen Bauch – „Hihi!“ – und es verwandelt sich in einen Schlüssel aus Zuckerguss.',
        skin: {
          book: 'Steckbrief', figures: 'Lebkuchenmännchen', figure: 'lebkuchen', target: 'Das Schlüssel-Männchen',
          dots: { one: 'Knopf', many: 'Knöpfe' },
          accessories: [acc('muetze', 'Zipfelmütze', 'eine Zipfelmütze', 'keine Zipfelmütze'), acc('fliege', 'Fliege', 'eine Fliege', 'keine Fliege'), acc('schal', 'Schal', 'einen Schal', 'keinen Schal')],
        },
      },
      {
        kind: 'potion', name: 'Die Hexenküche', icon: 'flamme',
        story: 'Der Zuckerschlüssel passt zur Küche. Dort brodelt Knusperines Kessel. Braut ihr einen goldenen Schlaftrank, schläft sie ganz sicher weiter.',
        done: 'Ein goldener Duft zieht durchs Haus. Aus dem Schlafzimmer: lautes Schnarchen. Perfekt.',
        skin: {
          pot: 'Hexenkessel', book: 'Rezeptbuch',
          ingredients: [ing('zimt', 'Zimtstern', 'stern', 'orange'), ing('pilz', 'Zuckerpilz', 'pilz', 'rot'), ing('kroete', 'Krötenbonbon', 'bonbon', 'gruen'), ing('tau', 'Mondtau', 'tropfen', 'blau'), ing('herz', 'Schokoherz', 'herz', 'rosa'), ing('minze', 'Minzblatt', 'blatt', 'tuerkis'), ing('kern', 'Kürbiskern', 'kuerbis', 'gold')],
        },
      },
      {
        kind: 'lock', name: 'Die Haustür', icon: 'schluessel',
        story: 'Die Haustür ist mit einem Zuckerperlen-Schloss gesichert. Knusperines Kochbuch verrät die Kombination.',
        done: 'Die Tür schwingt auf. Frische Luft! Ein Weg aus Schokolinsen führt nach Hause.',
        skin: { device: 'Zuckerschloss', gems: 'Zuckerperlen', book: 'Kochbuch', indicator: 'die Kerze im Fenster', lamp: 'Kerze', on: 'brennt', off: 'ist aus' },
      },
    ],
  },
  {
    id: 'meer',
    title: 'Der Palast der Meerjungfrau',
    short: 'Meerjungfrau',
    tag: 'Unterwasser',
    blurb: 'Die Meerjungfrau Perlina hat euch zum Tee eingeladen – doch ein Strudel hat den Palast verriegelt und Perlina entführt.',
    pal: { dark: true, bg1: '#05324F', bg2: '#0B7486', acc: '#5FF2D9', acc2: '#FF8CC6', ink: '#E9FFFB', glow: '#5FF2D9' },
    symbols: ['muschel', 'perle', 'fisch', 'stern', 'anker', 'tropfen', 'mond', 'krone', 'herz'],
    intro: [
      'Mit zwei magischen Luftblasen um den Kopf taucht ihr hinab zum Korallenpalast. Perlina, die Meerjungfrau, hat zum Seetang-Tee eingeladen.',
      'Doch kaum seid ihr drin, wirbelt ein Strudel durch die Gänge. Alle Tore schlagen zu – und Perlina wird in einer Blase davongetragen!',
      'Eure Zauberblasen halten nicht ewig. Ihr müsst raus – und Perlina retten.',
      'Einer von euch hat Perlinas Unterwasser-Notizen, der andere flinke Hände. Blubb-blubb, los geht’s!',
    ],
    outro: [
      'Perlina umarmt euch so fest, dass eure Luftblasen fast platzen.',
      '„Ihr seid die besten Taucher, die ich kenne!“, ruft sie und schenkt jedem von euch eine leuchtende Perle.',
      'Gemeinsam schwimmt ihr nach oben, wo die Sonne auf dem Wasser glitzert.',
    ],
    lose: 'Blubb … die Luftblasen werden knapp! Ein freundlicher Delfin bringt euch nach oben. Perlina wartet auf euren nächsten Versuch!',
    rooms: [
      {
        kind: 'echo', name: 'Die Muschelhalle', icon: 'muschel',
        story: 'Riesige Muscheln säumen die Halle. Sie leuchten nacheinander auf – eine Melodie aus Licht. Perlinas Notenbuch verrät, welches Symbol zu welcher Farbe gehört.',
        done: 'Die Muscheln klappen auf und spielen ein fröhliches Lied. Das Tor öffnet sich!',
        skin: { device: 'Muschelorgel', lights: 'Muscheln', book: 'Notenbuch' },
      },
      {
        kind: 'maze', name: 'Das Korallenlabyrinth', icon: 'stern',
        story: 'Dahinter: ein Labyrinth aus Korallen, voller aufgewirbeltem Sand. Man sieht keine Flosse vor Augen. Zum Glück trägt Perlina immer eine Muschelkarte bei sich.',
        done: 'Ihr schwimmt in die Schatzgrotte. Dort warten sechs Fische – und alle tun ganz unschuldig.',
        skin: { map: 'Muschelkarte', goal: 'die Schatzgrotte', fog: 'Sandwolken', wall: 'Koralle' },
      },
      {
        kind: 'lineup', name: 'Die Fischparade', icon: 'fisch',
        story: 'Einer dieser Fische ist Perlinas Bote und weiß, wo sie ist! Im Steckbrief steht, woran man ihn erkennt.',
        done: '„Blubb! Endlich!“, ruft der Bote. „Perlina ist hinter dem Perlentor!“',
        skin: {
          book: 'Steckbrief', figures: 'Fische', figure: 'fisch', target: 'Der Bote',
          dots: { one: 'Punkt', many: 'Punkte' },
          accessories: [acc('krone', 'Krone', 'eine Krone', 'keine Krone'), acc('brille', 'Taucherbrille', 'eine Taucherbrille', 'keine Taucherbrille'), acc('schleife', 'Schleife', 'eine Schleife', 'keine Schleife')],
        },
      },
      {
        kind: 'lock', name: 'Das Perlentor', icon: 'perle',
        story: 'Ein Tor mit funkelnden Perlen in vielen Farben, daneben ein Leuchtfisch. In Perlinas Notizen steht, welche Symbole das Tor öffnen.',
        done: 'Das Tor gleitet zur Seite – da ist Perlina, und sie strahlt über das ganze Gesicht!',
        skin: { device: 'Perlentor', gems: 'Perlen', book: 'Perlinas Notizen', indicator: 'der Leuchtfisch', lamp: 'Leuchtfisch', on: 'leuchtet', off: 'ist dunkel' },
      },
    ],
  },
  {
    id: 'mond',
    title: 'Mission Mondbasis',
    short: 'Mondbasis',
    tag: 'Weltraum',
    blurb: 'Kurzschluss auf der Mondbasis Luna-7! Die Rückflug-Rakete ist gesperrt – und der Sauerstoff reicht nicht ewig.',
    pal: { dark: true, bg1: '#0A1030', bg2: '#22306A', acc: '#FFC94D', acc2: '#7FD6FF', ink: '#EEF3FF', glow: '#7FD6FF' },
    symbols: ['planet', 'rakete', 'stern', 'mond', 'sonne', 'blitz', 'zahnrad', 'diamant', 'kleeblatt'],
    intro: [
      'Mondbasis Luna-7, Tag 214. Ihr sitzt gerade beim Frühstück, als die Lichter flackern. Dann: Stille. Nur die Notbeleuchtung summt.',
      'Der Bordcomputer KEKS meldet sich: „Kurzschluss im Hauptsystem. Rückflug-Rakete gesperrt. Sauerstoff … ausreichend. Vermutlich.“',
      'Die Rakete startet nur, wenn alle Systeme wieder laufen. Die Handbücher dafür liegen überall in der Basis verstreut.',
      'Einer liest die Handbücher, der andere schraubt. Over and out!',
    ],
    outro: [
      'Die Rakete hebt ab. Der Mond wird kleiner und kleiner, vor euch leuchtet die blaue Erde.',
      'KEKS meldet sich ein letztes Mal: „Mission erfüllt. Ihr seid ein … hervorragendes Team. Piep.“',
      'Ihr klatscht euch ab. Schwerelos.',
    ],
    lose: 'Houston, wir haben ein Problem … Ein Rettungsshuttle holt euch ab. KEKS meint: „Nächstes Mal schafft ihr das. Piep.“',
    rooms: [
      {
        kind: 'wires', name: 'Der Generator', icon: 'blitz',
        story: 'Im Generatorraum funkt und knistert es. Ein Kabel muss durchtrennt werden, um den Kurzschluss zu stoppen – aber welches? Das Wartungshandbuch weiß es.',
        done: 'Die Lichter gehen wieder an. KEKS piept zufrieden.',
        skin: { device: 'Generator', threads: 'Kabel', book: 'Wartungshandbuch', plate: 'Seriennummer' },
      },
      {
        kind: 'maze', name: 'Der Kraterpfad', icon: 'mond',
        story: 'Die Rakete steht draußen, hinter einem Feld voller Krater. Mondstaub wirbelt auf, die Sicht ist null. Der Rover hat ein Navi – aber nur auf dem anderen Bildschirm.',
        done: 'Der Rover rumpelt an die Startrampe. Die Rakete ragt über euch in den Sternenhimmel.',
        skin: { map: 'Navi-Karte', goal: 'die Startrampe', fog: 'Mondstaub', wall: 'Kraterrand' },
      },
      {
        kind: 'safe', name: 'Das Vorratsmodul', icon: 'rakete',
        story: 'Die Rakete braucht Treibstoff-Kapseln. Sie liegen in einem Tresor im Vorratsmodul. Die Formeln für den Code stehen im Logbuch – die Zahlen stecken in den Vorräten.',
        done: 'Klack! Treibstoff geladen. Jetzt fehlt nur noch die Startfreigabe.',
        skin: {
          safe: 'Vorratstresor', book: 'Logbuch', scene: 'Vorratsmodul',
          objects: [obj('rakete', 'Modellrakete', 'Modellraketen', 'rakete', 'rot'), obj('planet', 'Planetenkugel', 'Planetenkugeln', 'planet', 'lila'), obj('stern', 'Leuchtstern', 'Leuchtsterne', 'stern', 'gold'), obj('zahnrad', 'Zahnrad', 'Zahnräder', 'zahnrad', 'tuerkis'), obj('flasche', 'Saftflasche', 'Saftflaschen', 'flasche', 'orange')],
        },
      },
      {
        kind: 'echo', name: 'Das Funkpult', icon: 'planet',
        story: 'Die Bodenstation will einen Lichtcode zur Bestätigung. Die Funklichter blinken in Farben – und das Codebuch übersetzt sie in Symbole.',
        done: '„Start freigegeben!“ 3 … 2 … 1 …',
        skin: { device: 'Funkpult', lights: 'Funklichter', book: 'Codebuch' },
      },
    ],
  },
  {
    id: 'spuk',
    title: 'Die Spukvilla von Tante Gruselda',
    short: 'Spukvilla',
    tag: 'Grusel (aber lieb)',
    blurb: 'Tante Gruselda hat euch ihre Villa vererbt. Dumm nur, dass sie selbst noch darin wohnt – als Gespenst. Und sie hat Prüfungen für euch.',
    pal: { dark: true, bg1: '#170D29', bg2: '#33204F', acc: '#B6F36B', acc2: '#FF9E3D', ink: '#F3ECFF', glow: '#B6F36B' },
    symbols: ['geist', 'kuerbis', 'mond', 'schluessel', 'glocke', 'flasche', 'flamme', 'stern', 'katze'],
    intro: [
      'Ein Gewitter, eine knarrende Tür, ein Kronleuchter voller Spinnweben: Willkommen in der Villa von Tante Gruselda.',
      '„Huhuuu!“ Eine durchsichtige alte Dame schwebt die Treppe herunter. „Endlich Besuch! Ihr bleibt doch zum Tee? Für … immer?“',
      'Die Tür fällt ins Schloss. Gruselda kichert: „Nur wer meine vier Prüfungen besteht, darf gehen. Und nur zusammen!“',
      'Einer von euch findet Gruseldas Tagebuch, der andere muss anpacken. Keine Angst – sie ist eigentlich ganz nett.',
    ],
    outro: [
      'Draußen ist das Gewitter vorbei. Über der Villa leuchtet der Vollmond.',
      'Gruselda winkt euch aus dem Fenster nach und wischt sich eine Geisterträne weg. „Kommt mich mal wieder besuchen!“',
      'Vielleicht. Am Tag. Mit Taschenlampe.',
    ],
    lose: 'Mitternacht! Gruselda schenkt euch Tee ein … und lässt euch trotzdem gehen. „Ihr kommt ja wieder, ihr Lieben!“',
    rooms: [
      {
        kind: 'lock', name: 'Die Bibliothek', icon: 'schluessel',
        story: 'Ein Bücherregal mit einem Geheimschloss. Darüber funkeln die Edelsteinaugen eines alten Gemäldes. Gruseldas Tagebuch verrät die richtigen Symbole.',
        done: 'Das Regal schwingt knarzend zur Seite. Dahinter: ein Saal voller Gespenster.',
        skin: { device: 'Regalschloss', gems: 'Edelsteinaugen', book: 'Tagebuch', indicator: 'der Kerzenleuchter', lamp: 'Kerzenleuchter', on: 'brennt', off: 'ist aus' },
      },
      {
        kind: 'lineup', name: 'Der Geisterball', icon: 'geist',
        story: 'Sechs Gespenster tanzen Walzer. Eines davon hat den Küchenschlüssel verschluckt (passiert Gespenstern öfter). Im Tagebuch steht ein Steckbrief.',
        done: '„Hicks!“ Das Gespenst hustet einen silbernen Schlüssel aus. Entschuldigung.',
        skin: {
          book: 'Steckbrief', figures: 'Gespenster', figure: 'geist', target: 'Das Schlüssel-Gespenst',
          dots: { one: 'Fleck', many: 'Flecken' },
          accessories: [acc('zylinder', 'Zylinder', 'einen Zylinder', 'keinen Zylinder'), acc('kette', 'Kette', 'eine Kette', 'keine Kette'), acc('monokel', 'Monokel', 'ein Monokel', 'kein Monokel')],
        },
      },
      {
        kind: 'potion', name: 'Gruseldas Küche', icon: 'kuerbis',
        story: 'In der Küche blubbert ein Kessel Geistersuppe. Gruselda wünscht sich einen goldenen Gute-Laune-Trank – dann öffnet sie vielleicht den Keller.',
        done: 'Gruselda probiert und strahlt. „Köstlich! Na gut, der Keller ist offen.“',
        skin: {
          pot: 'Suppenkessel', book: 'Gruselrezepte',
          ingredients: [ing('kuerbis', 'Kürbisstück', 'kuerbis', 'orange'), ing('pilz', 'Geisterpilz', 'pilz', 'lila'), ing('stein', 'Krötenstein', 'diamant', 'gruen'), ing('tau', 'Mondtau', 'tropfen', 'blau'), ing('staub', 'Sternenstaub', 'stern', 'gold'), ing('blatt', 'Gruselblatt', 'blatt', 'rot'), ing('glocke', 'Glockenblume', 'glocke', 'rosa')],
        },
      },
      {
        kind: 'wires', name: 'Die Kelleruhr', icon: 'glocke',
        story: 'Im Keller tickt eine riesige Spukuhr. Schlägt sie Mitternacht, bleibt ihr für immer! Hinter dem Zifferblatt hängen Zauberfäden – einer muss durchgeschnitten werden.',
        done: 'Die Uhr bleibt stehen, eine Minute vor Mitternacht. Die Kellertür nach draußen springt auf.',
        skin: { device: 'Spukuhr', threads: 'Zauberfäden', book: 'Uhrmacher-Handbuch', plate: 'Uhrnummer' },
      },
    ],
  },
  {
    id: 'pirat',
    title: 'Der Schatz der Piratenkatze',
    short: 'Piratenkatze',
    tag: 'Abenteuer',
    blurb: 'Kapitänin Samtpfote hat euch auf ihrem Schiff festgesetzt, weil ihr (aus Versehen!) ihren Thunfisch gegessen habt. Findet ihren Schatz – dann seid ihr frei.',
    pal: { dark: true, bg1: '#0A2A4A', bg2: '#13618A', acc: '#FFC94D', acc2: '#FF6B5E', ink: '#FFF7E6', glow: '#FFC94D' },
    symbols: ['anker', 'muschel', 'fisch', 'muenze', 'stern', 'schluessel', 'flasche', 'katze', 'sonne'],
    intro: [
      'Ahoi! Ihr wacht im Bauch eines Piratenschiffs auf. Es schaukelt, es riecht nach Fisch und Abenteuer.',
      'Vor euch thront Kapitänin Samtpfote, die gefürchtetste Katze der sieben Meere. „Ihr habt meinen Thunfisch gefressen! Dafür bleibt ihr an Bord. FÜR IMMER! … Oder bis ihr meinen Schatz findet.“',
      'Ihr wisst: Samtpfote hat ein Logbuch, eine Mannschaftsliste – und sie liebt Rätsel.',
      'Einer von euch hat die Unterlagen, der andere die Pfoten am Werk. Hisst die Segel!',
    ],
    outro: [
      'Ihr grabt, bis die Hände wehtun. Dann: KLONK. Eine Truhe voller Goldmünzen – aus Schokolade.',
      'Samtpfote schnurrt zufrieden. „Ihr seid die erste Mannschaft, die meinen Schatz gefunden hat. Ihr seid frei! Und die Schokolade teilen wir.“',
      'Bei Sonnenuntergang rudert ihr an Land, die Taschen voller Schokotaler.',
    ],
    lose: 'Die Sonne ist untergegangen. Samtpfote lässt euch Deck schrubben … und schenkt euch dann doch einen Schokotaler. Nächstes Mal!',
    rooms: [
      {
        kind: 'safe', name: 'Die Kapitänskajüte', icon: 'muenze',
        story: 'In der Kajüte steht eine Truhe mit Zahlenschloss. Samtpfote hat den Code im Logbuch versteckt – als Rechenaufgaben. Die Zahlen liegen überall in der Kajüte herum.',
        done: 'Die Truhe springt auf. Darin: keine Juwelen, sondern eine Mannschaftsliste. Eine Katze ist eine Diebin …',
        skin: {
          safe: 'Schatztruhe', book: 'Logbuch', scene: 'Kajüte',
          objects: [obj('muenze', 'Goldmünze', 'Goldmünzen', 'muenze', 'gold'), obj('muschel', 'Muschel', 'Muscheln', 'muschel', 'rosa'), obj('flasche', 'Flaschenpost', 'Flaschenposten', 'flasche', 'gruen'), obj('anker', 'Anker', 'Anker', 'anker', 'blau'), obj('fisch', 'Sardine', 'Sardinen', 'fisch', 'orange')],
        },
      },
      {
        kind: 'lineup', name: 'Die Katzenmannschaft', icon: 'katze',
        story: 'Sechs Piratenkatzen stehen an Deck. Eine von ihnen hat Samtpfotes Schatzkarte geklaut! Die Mannschaftsliste beschreibt die Diebin.',
        done: '„Miau … ertappt“, murmelt die Katze und rückt die Schatzkarte heraus.',
        skin: {
          book: 'Mannschaftsliste', figures: 'Piratenkatzen', figure: 'katze', target: 'Die Diebin',
          dots: { one: 'Fleck', many: 'Flecken' },
          accessories: [acc('klappe', 'Augenklappe', 'eine Augenklappe', 'keine Augenklappe'), acc('tuch', 'Kopftuch', 'ein Kopftuch', 'kein Kopftuch'), acc('ring', 'Ohrring', 'einen Ohrring', 'keinen Ohrring')],
        },
      },
      {
        kind: 'wires', name: 'Die Kanone', icon: 'anker',
        story: 'Ein feindliches Schiff! Die Kanone hat mehrere Zündschnüre, aber nur eine ist die richtige. Das Kanonier-Handbuch erklärt, welche.',
        done: 'BUMM! Eine riesige Konfettiwolke – das feindliche Schiff dreht beeindruckt ab.',
        skin: { device: 'Kanone', threads: 'Zündschnüre', book: 'Kanonier-Handbuch', plate: 'Kanonennummer' },
      },
      {
        kind: 'potion', name: 'Die Schatzinsel', icon: 'sonne',
        story: 'Auf der Schatzinsel wacht ein Flaschengeist über den Schatz. Er lässt euch nur vorbei, wenn ihr ihm einen goldenen Seemannstrank mischt.',
        done: 'Der Geist nippt, rülpst zufrieden – und gibt den Weg frei. Da glitzert etwas im Sand …',
        skin: {
          pot: 'Kokosnuss-Kessel', book: 'Seemanns-Rezepte',
          ingredients: [ing('stern', 'Seestern', 'stern', 'orange'), ing('milch', 'Kokosmilch', 'tropfen', 'weiss'), ing('salz', 'Muschelsalz', 'muschel', 'rosa'), ing('alge', 'Algenblatt', 'blatt', 'gruen'), ing('taler', 'Goldtaler', 'muenze', 'gold'), ing('sardine', 'Sardine', 'fisch', 'blau'), ing('klee', 'Glücksklee', 'kleeblatt', 'tuerkis')],
        },
      },
    ],
  },
];

export const themeById = (id) => THEMES.find((t) => t.id === id) || null;

// Beschreibung der Rätsel-Arten (für Regeln und die Rollen-Hinweise)
export const KINDS = {
  lock: { title: 'Symbol-Schloss' },
  wires: { title: 'Zauberfäden' },
  maze: { title: 'Nebel-Labyrinth' },
  echo: { title: 'Kristall-Echo' },
  potion: { title: 'Trank-Kessel' },
  safe: { title: 'Tresor-Rechnung' },
  lineup: { title: 'Aufstellung' },
};
