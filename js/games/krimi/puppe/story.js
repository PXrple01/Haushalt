// Krimi Fall 2 „Seid ihr alle da?“ – Geschichte, Kasperl-Ansagen, Dokumente, Entscheidungen, Tribunal, Finale, Enden.
// Platzhalter in Texten: {rolle} → Name der Person in dieser Rolle (z. B. {puppe}, {spieler}), {K} → Anrede.
// Eigene Figuren und eigene Fallen – angelehnt an das alte Wiener Kasperltheater („Seid ihr alle da?“).

export const TITLE = 'Seid ihr alle da?';
export const SUB = 'Das letzte Stück der Wunderbühne Weißhaupt';
export const TAG = 'Fall 2 · Krampusnacht in Wien';

export const DIFFS = {
  normal: { id: 'normal', title: 'Normal', sub: '60 Minuten bis der Vorhang fällt', limit: 60 * 60e3 },
  hart: { id: 'hart', title: 'Hart', sub: '45 Minuten, gemeinere Fallen', limit: 45 * 60e3 },
};

// Die Personen
export const PEOPLE2 = {
  brandl: { name: 'Rudolf Brandl', short: 'Brandl', age: 71, role: 'Der Hausherr', bio: 'Gehörte das Theater. Hat nach dem Brand das Grundstück verkauft.' },
  haslinger: { name: 'Erwin Haslinger', short: 'Haslinger', age: 68, role: 'Der Prüfer', bio: 'Früher Brandschutzprüfer der Baupolizei.' },
  gerda: { name: 'Gerda Pfeiffer', short: 'Gerda', age: 64, role: 'Die Kassierin', bio: 'Saß 1998 an der Kassa der Wunderbühne.' },
  tobias: { name: 'Tobias Weißhaupt', short: 'Tobias', age: 38, role: 'Der Puppenspieler', bio: 'Sohn des Puppenspielers. Bühnentechniker.' },
  anton: { name: 'Anton Weißhaupt', short: 'Anton', role: 'Der Vater', bio: 'Puppenspieler. 1999 verurteilt, 2003 in der Haft gestorben.' },
  marianne: { name: 'Marianne Weißhaupt', short: 'Marianne', role: 'Die Mutter', bio: 'Starb im Brand 1998.' },
};

export const INTRO = [
  'Wien-Ottakring, 5. Dezember, Krampusnacht. Seit einer Woche sucht ihr drei Vermisste: einen alten Bauherrn, einen pensionierten Brandschutzprüfer, eine frühere Kassierin. Nichts verbindet sie – bis um 22:13 euer Telefon klingelt.',
  'Eine Kinderstimme, verzerrt, singt: »Tri, tra, trullala, der Kasperl ist schon da.« Dann eine Adresse: Ottakringer Straße 113. Die Wunderbühne Weißhaupt. Ein Puppentheater, ausgebrannt in der Krampusnacht 1998. Vier Tote. Seitdem zugenagelt.',
  'Die Seitentür steht offen. Drinnen riecht es nach kaltem Rauch und nach etwas Süßlichem. Ein Tuch auf deinem Mund. Dann nichts mehr.',
];
export const WAKE = {
  first: 'Du wachst auf und hängst in der Luft. Fäden an deinen Handgelenken, an deinen Knöcheln. Unter dir glänzen Nägel, Hunderte, die Spitzen nach oben.',
  other: 'Du wachst auf einem Stuhl auf, die Hand an ein Heizungsrohr gekettet. Um dich herum: Puppenköpfe. Hunderte. Alle schauen dich an.',
};
export const HELLO = {
  ask: 'Ein Lautsprecher knackt. Eine Stimme, hoch und kratzig wie eine alte Schallplatte: »Seid ihr alle da?«',
  answer: '»Ich hör euch nicht! … Na also. Dann spielen wir ein Stück. Es heißt »Die Wahrheit«. Es hat fünf Szenen, ein Tribunal und ein Ende. Ihr habt {zeit}, dann fällt der Eiserne Vorhang. Und wer zu viel blutet, der verliert. Ganz langsam. Tri, tra, trullala!«',
};

// Szenen der Reihe nach. kind: puzzle | reveal | faden | tribunal | finale
// roles: [Rolle von „first“, Rolle von „other“], danger: wer in Gefahr ist
export const SCENES = [
  {
    id: 'marionette', kind: 'puzzle', act: 'Erster Akt', title: 'Die Marionette', roles: ['puppe', 'spieler'], danger: 'puppe',
    kasperl: '»Erste Szene: Die Marionette! {puppe} hängt in meinen Fäden, wie ich in euren hänge. {spieler} hält das Spielkreuz. Vor {puppe} baumelt ein Schlüssel, daneben Sicheln. Und das Seil … das sinkt. Tri, tra, trullala!«',
    role: {
      puppe: 'Du hängst im Schnürboden, Fäden an Händen und Füßen. Nur du siehst, welche Farbe an welchem Arm und Bein hängt – und wo die Sicheln warten. Sag es {spieler}.',
      spieler: 'Du hältst das Spielkreuz: vier Fäden, vier Farben, jeder bewegt ein Glied von {puppe}. Auf der Werkbank liegt eine Skizze der Haltung, mit der man den Schlüssel erreicht – von vorne gezeichnet.',
    },
    done: 'Finger schließen sich um kaltes Metall. Der Schlüssel! Mit einem Ruck reißen die Fäden, {puppe} fällt auf einen Laufsteg aus Gitterrost. Irgendwo im Dunkeln schreit ein Mann auf. Lange. Dann ist es still.',
    applause: '»Bravo! Applaus! Hört ihr? Das Publikum ist begeistert.«',
    docs: [['first', 'theaterzettel'], ['other', 'zeitung']],
  },
  {
    id: 'blutspur', kind: 'puzzle', act: 'Erster Akt', title: 'Die Blutspur', roles: ['oben', 'unten'], danger: 'unten',
    kasperl: '»Zweite Szene: Die Blutspur! {unten} sitzt noch an der Kette. Unter einem der Bretter liegt der Schlüssel. Unter den anderen … meine Mausefallen. {oben} sieht von oben, woher das Blut kam. Wo das Blut beginnt, da liegt der Schlüssel!«',
    role: {
      oben: 'Du liegst auf dem Gitterrost hoch über der Werkstatt. Unten sitzt {unten}. Auf dem Boden: Blutstropfen, lang gezogen wie Kometen. Ihre Schwänze zeigen vom Ursprung weg. Tippe die Tropfen an, um ihre Flugbahn zu verlängern.',
      unten: 'Nur eine Kerze brennt. Du siehst die Bretter, die Werkbank, den Ofen, den Abfluss – aber kein Blut. Hör {oben} zu und stemm das richtige Brett auf.',
    },
    done: 'Das Brett knarrt. Darunter, in einer Pfütze aus altem Blut: ein Schlüssel. Die Kette fällt. Unter dem Schlüssel klebt ein Bericht der Baupolizei.',
    applause: '»Hihi! Zwei Kommissare, null Finger verloren. Noch.«',
    docs: [['other', 'pruefbericht']],
  },
  {
    id: 'reveal', kind: 'reveal', act: 'Zweiter Akt', title: 'Das Publikum',
    text: [
      'Ihr findet euch auf der Bühne wieder – zum ersten Mal seit Stunden zusammen. Der Eiserne Vorhang ist hochgezogen. Dahinter der Zuschauerraum: vergoldete Logen, verkohlte Samtsitze.',
      'In der ersten Reihe sitzen drei Menschen. Festgeschnallt, geknebelt. Über jedem hängt an einem einzigen Faden etwas sehr Schweres. Ein Spot geht an. Die Vermissten: Rudolf Brandl. Erwin Haslinger – sein Bein ist eine einzige blutige Wunde. Gerda Pfeiffer.',
    ],
    kasperl: '»Hallo, Kinder! Darf ich vorstellen: mein Publikum! Habt ihr vorhin den Schrei gehört? Das war Herr Haslinger. Jedes Mal, wenn ihr ein Rätsel löst, zieht sich irgendwo ein Faden. Ihr seid nicht meine Puppen, Kommissare. Ihr seid meine Puppenspieler. Ab jetzt halte ich euch nach jeder Szene einen Faden hin. Schneidet ihn durch – oder haltet ihn fest. Mit euren eigenen Händen.«',
  },
  {
    id: 'drehbuehne', kind: 'puzzle', act: 'Zweiter Akt', title: 'Blindekuh auf der Drehbühne', roles: ['blind', 'bruecke'], danger: 'blind',
    kasperl: '»Dritte Szene: Blindekuh! {blind} bekommt einen Sack über den Kopf. Die Drehbühne dreht sich, und in ihren Falltüren warten Spieße. {bruecke} steht oben auf der Beleuchterbrücke und sieht alles. Gut führen – oder fallen lassen!«',
    role: {
      blind: 'Ein Sack über deinem Kopf, er stinkt nach Rauch. Irgendwo ist der Ausgang in die Seitengasse. Du kannst dich drehen, einen Schritt machen und mit dem Fuß tasten. Alle paar Schritte dreht sich der Boden unter dir.',
      bruecke: 'Von der Beleuchterbrücke siehst du die ganze Bühne: die Drehscheibe, die offenen Falltüren mit den Spießen, {blind} mit dem Sack. Sag, wohin – aus {blind}s Blickrichtung!',
    },
    done: 'Hände finden den Samt der Seitengasse. Der Sack wird {blind} vom Kopf gerissen – von niemandem. Auf dem Boden liegt ein altes Kassabuch.',
    applause: '»Oh! Nicht aufgespießt! Wie schade … ich meine: wie schön!«',
    docs: [['first', 'kassabuch']],
  },
  { id: 'faden1', kind: 'faden', act: 'Zweiter Akt', title: 'Der erste Faden', guest: 'haslinger' },
  {
    id: 'schatten', kind: 'puzzle', act: 'Zweiter Akt', title: 'Das Schattentheater', roles: ['lampe', 'leinwand'], danger: 'leinwand',
    kasperl: '»Vierte Szene: Das Schattentheater! {lampe} steht hinter der Leinwand, mit drei Schattenfiguren aus Pappe. {leinwand} sitzt davor und sieht nur die Schatten. Dreht die Figuren, bis die Schatten eine Zahl ergeben. Sie öffnet die Requisitenkammer. Eine falsche Zahl … kitzelt ein bisschen. Mit Strom.«',
    role: {
      lampe: 'Drei Schattenfiguren aus schwarzer Pappe, voller Schnitte. Jede kannst du drehen. Was auf der Leinwand erscheint, siehst nur {leinwand}.',
      leinwand: 'Vor dir die Leinwand, dahinter das Licht. Die Schatten der drei Figuren fallen übereinander. Stimmt alles, ergeben sie vier Ziffern. Gib sie am Schloss der Requisitenkammer ein.',
    },
    done: 'Die Tür der Requisitenkammer springt auf. Kostüme, Puppen, ein kleiner Krampus mit geschmolzener Hand. Und zwei Dinge, die nicht hierher gehören: ein Polaroid und ein Gutachten.',
    applause: '»Licht aus, Spot an! Ihr wärt gute Puppenspieler geworden. Fast so gut wie mein Papa.«',
    docs: [['other', 'polaroid'], ['first', 'gutachten']],
  },
  { id: 'faden2', kind: 'faden', act: 'Zweiter Akt', title: 'Der zweite Faden', guest: 'gerda' },
  {
    id: 'orgel', kind: 'puzzle', act: 'Zweiter Akt', title: 'Das Krokodil', roles: ['bahn', 'orgel'], danger: 'bahn',
    kasperl: '»Fünfte Szene: Das Krokodil! In jedem Kasperlstück kommt das Krokodil. {bahn} liegt festgeschnallt auf seinem Weg. Seine Zähne sind Fleischerhaken – aber es liebt Musik. Spielt {orgel} die Drehorgel im richtigen Takt, bleibt es stehen. Sonst … schnapp!«',
    role: {
      bahn: 'Du liegst festgeschnallt auf einer Schiene. Am anderen Ende: das Krokodil, ein Maul voller Fleischerhaken. Neben dir zuckt eine Takt-Nadel. Ist die Musik im grünen Bereich, steht es still. Sag {orgel}: schneller oder langsamer!',
      orgel: 'Vor dir steht eine alte Drehorgel. Dreh die Kurbel mit dem Finger im Kreis. Wie schnell, weiß nur {bahn} – dort ist die Takt-Anzeige.',
    },
    done: 'Die letzte Note verklingt. Das Krokodil erstarrt, das Maul halb offen. Aus seinem Bauch fällt ein Umschlag mit Kontoauszügen – direkt neben {bahn}.',
    applause: '»Schnapp-schnapp … nichts? Mein armes Krokodil ist ganz traurig.«',
    docs: [['first', 'konto']],
  },
  { id: 'faden3', kind: 'faden', act: 'Zweiter Akt', title: 'Der dritte Faden', guest: 'brandl' },
  { id: 'tribunal', kind: 'tribunal', act: 'Dritter Akt', title: 'Das Tribunal' },
  { id: 'finale', kind: 'finale', act: 'Dritter Akt', title: 'Der Eiserne Vorhang' },
];

// Kasperl-Sprüche bei Fehlern und Fallen
export const OUCH = {
  sichel: { me: 'Die Sichel fährt durch deinen Arm. Warmes Blut läuft dir übers Gesicht und tropft auf die Nägel.', them: 'Ein Schrei über dir. Blut tropft durch die Ritzen auf die Werkbank.', k: '»Hoppla! Falscher Faden!«' },
  naegel: { me: 'Das Seil ruckt nach unten. Die Nägel bohren sich in deine Fußsohlen.', them: 'Das Seil ruckt. Ein langer, gurgelnder Schrei.', k: '»Tick, tack, das Seil wird schlapp!«' },
  leer: { me: 'Du greifst ins Leere. Das Seil sinkt ein Stück.', them: 'Ein Klirren. Das Seil sinkt ein Stück.', k: '»Daneben!«' },
  falle: { me: 'Kaum hebst du das Brett, schnappt eine Falle zu – Rasierklingen statt Bügel. Deine Finger …', them: 'Ein metallisches Schnappen unter dir, dann Schreie.', k: '»Mausefalle, Mausefalle!«' },
  spiess: { me: 'Der Boden ist weg. Spieße. Der Schmerz ist so hell, dass du ihn hören kannst.', them: 'Die Falltür klappt. Ein Schrei durch den Sack. Blut auf den Spießen.', k: '»Nochmal von vorn! Hihi!«' },
  wand: { me: 'Du stößt gegen etwas Hartes. Eine Wand.', them: 'Ein dumpfes Poltern.', k: '' },
  strom: { me: 'Ein Schlag fährt dir durch den Arm. Es riecht nach verbranntem Haar.', them: 'Funken. Ein Schrei hinter der Leinwand.', k: '»Bzzzzt! Falsche Zahl!«' },
  biss: { me: 'Die Haken schlagen in deine Wade. Das Krokodil zieht sich zurück – langsam, tropfend.', them: 'Ein Schnappen. Ein Schrei. Die Musik bricht ab.', k: '»Schnapp! Mahlzeit!«' },
  urteil: { me: 'Der Kasperl kreischt »Falsch!«. Aus der Lehne deines Sitzes schießt eine Nadel.', them: '', k: '»Falsch, falsch, falsch! Das kostet Blut!«' },
  zeit: { me: 'Der Eiserne Vorhang ruckt einen halben Meter nach unten.', them: '', k: '»Die Zeit ist um, Kinder!«' },
};

// Die drei Fäden (moralische Entscheidungen)
export const FADEN = {
  haslinger: {
    thing: 'Über Erwin Haslinger hängt ein Sandsack, achtzig Kilo, an einem einzigen Faden. Der Faden führt zu euch.',
    k: '»Herr Haslinger hat 1998 unterschrieben, dass der Eiserne Vorhang funktioniert. Er hat nicht funktioniert. Vier Menschen sind verbrannt. Was meint ihr, Kinder: Schneiden wir den Faden durch? Oder haltet ihr ihn – mit euren Händen, bis er euch ins Fleisch schneidet?«',
    cut: 'Der Faden reißt. Ein dumpfer Schlag, ein Knacken, das ihr nie vergessen werdet. Erwin Haslinger bewegt sich nicht mehr.',
    hold: 'Ihr packt den Faden. Er schneidet sich in eure Handflächen, Blut läuft euch die Unterarme hinunter – aber ihr lasst nicht los. Der Sandsack bleibt hängen. Haslinger weint in seinen Knebel, dann reißt er ihn heraus: »Ich hab unterschrieben, ja! Brandl hat mir fünfzigtausend Schilling gegeben. Ich hab mir den Vorhang nie angeschaut!«',
  },
  gerda: {
    thing: 'Über Gerda Pfeiffer schwingt ein Pendel aus einer alten Bühnensense. Der Faden, der es hält, führt zu euch.',
    k: '»Frau Pfeiffer hat in der Krampusnacht den linken Notausgang zugesperrt – wegen der Schwarzseher. Vier Menschen sind vor dieser Tür erstickt. Und vor Gericht hat sie gelogen. Schneiden? Oder halten?«',
    cut: 'Das Pendel saust herab. Gerda Pfeiffers Schrei bricht mitten im Ton ab. Blut spritzt bis auf die Bühne.',
    hold: 'Wieder schneidet der Faden in eure Hände, tiefer diesmal. Gerda schluchzt: »Ich hab zugesperrt, ja. Wegen der Schwarzseher. Und dann hat mir der Brandl Geld gegeben, damit ich sag, ich hätt den Anton mit den Fackeln gesehen. Hab ich nicht. Ich hab niemanden gesehen!«',
  },
  brandl: {
    thing: 'Über Rudolf Brandl hängt der schwerste Sandsack von allen.',
    k: '»Herr Brandl! Ihm gehörte das Haus. Die Reparatur des Eisernen Vorhangs war ihm zu teuer. Er hat Haslinger bezahlt und Frau Pfeiffer gekauft. Nach dem Brand hat er das Grundstück verkauft, für sechs Millionen. Na, Kinder? Diesmal schneidet ihr doch, oder?«',
    cut: 'Der Sack fällt. Rudolf Brandl stirbt mit offenen Augen.',
    hold: 'Ihr haltet. Eure Hände sind nur noch rohes Fleisch. Brandl keucht: »Den Vorhang hab ich nicht reparieren lassen, ja! Aber das Feuer – das war nicht ich! Das war der Bub! Der Kleine vom Weißhaupt, mit der Krampusfackel, hinter der Bühne! Ich hab ihn gesehen! Und dem Anton hab ich gesagt: Nimm du die Schuld, oder dein Bub kommt ins Heim, und jeder erfährt, was er getan hat.«',
  },
};
export const FADEN_RULE = 'Beide müssen dasselbe wählen. Seid ihr euch nach 40 Sekunden nicht einig, entscheidet der Kasperl.';
export const FADEN_TIMEOUT = 'Ihr seid euch nicht einig. »Dann entscheide ich!«, kreischt der Kasperl – und schneidet.';

// Die Dokumente (Mappe)
export const DOCS = {
  theaterzettel: { t: 'Theaterzettel 1998', x: 'WUNDERBÜHNE WEISSHAUPT · Krampusnacht, 5. Dezember 1998, 17 Uhr: »Kasperl und der Krampus« – mit echten Fackeln! Es spielen Anton & Marianne Weißhaupt. Licht und Ton: unser jüngster Gehilfe, Tobias (10). Kassa: Gerda Pfeiffer.' },
  zeitung: { t: 'Zeitungsausschnitt 1999', x: 'Wiener Abendblatt, 3. März 1999: PUPPENSPIELER VERURTEILT. Anton W. (44) wegen fahrlässiger Herbeiführung einer Feuersbrunst schuldig gesprochen – vier Tote. Kassierin Gerda P. sagte aus: »Ich sah ihn mit den Fackeln hinter der Bühne hantieren.« Der Angeklagte gestand unter Tränen.' },
  pruefbericht: { t: 'Prüfbericht der Baupolizei', x: 'Magistrat Wien, Baupolizei. Brandschutzprüfung Wunderbühne, 2. Dezember 1998: Eiserner Vorhang – Funktion einwandfrei. Notausgänge – frei. Gez. Ing. E. Haslinger. Auf der Rückseite, mit Bleistift: »Bremse Vorhang defekt – Reparatur 38.000 S – abgelehnt. R. B.«' },
  kassabuch: { t: 'Kassabuch der Wunderbühne', x: '5. Dezember 1998: Ausverkauft, 112 Karten. Darunter in roter Tinte: »Notausgang links abgesperrt wg. Schwarzseher! G. P., 16:50«' },
  polaroid: { t: 'Verkohltes Polaroid', x: 'Ein Bub im Krampusfell hinter der Bühne, eine brennende Fackel in der Hand, er grinst stolz in die Kamera. Unten mit Kuli: »5.12.98, 17:40«. Auf der Rückseite, in einer Frauenschrift: »Tobi als kleiner Krampus – NICHT an die Fackeln!! M.«' },
  gutachten: { t: 'Brandgutachten (Erstfassung)', x: 'Vor Gericht nie verwendet. Brandausbruch: Requisitentisch hinter der Bühne, bei den Fackelhaltern, ca. 17:52 Uhr. Laut drei Zeugen stand der Puppenspieler A. W. zu diesem Zeitpunkt auf der Spielleiste – vor Publikum. Der Rauch erreichte den Saal, weil der Eiserne Vorhang nicht schloss. Alle vier Opfer, darunter Marianne W., starben an Rauchgas vor dem verschlossenen linken Notausgang.' },
  konto: { t: 'Kontoauszüge R. Brandl', x: '3. Dezember 1998: 50.000 S an E. Haslinger. 20. Jänner 1999: 20.000 S an G. Pfeiffer, Verwendungszweck: »Danke für Ihre Aussage«.' },
  brief: { t: 'Brief aus der Haft', x: '»Tobi, mein Bub. Wenn du das liest, bist du groß. Ich habe dem Gericht gesagt, dass ich die Fackeln angezündet habe. Das stimmt nicht. Du warst es. Du wolltest nur ein echter Krampus sein, und dann hat der Vorhang am Requisitentisch Feuer gefangen. Es war ein Unfall. Dass vier Menschen gestorben sind, das war nicht dein Feuer. Das war die versperrte Tür und der Vorhang, der nicht gefallen ist. Und Brandl hat mich gezwungen: ich oder du. Ich habe mich entschieden. Bitte verzeih dir. Die Mama hätte es auch getan. Ich habe den Brief in den Kasperl genäht, damit er dich beschützt. Dein Papa. – Stein, im Dezember 1999«' },
};

// Tribunal: der Kasperl fragt, ihr urteilt (beide müssen dasselbe wählen)
export const TRIBUNAL = {
  k: '»Letzte Szene vor dem Ende: das Tribunal! Ich frage, ihr urteilt. Ihr müsst euch einig sein. Jedes falsche Urteil kostet Blut.«',
  questions: [
    { id: 'vorhang', q: 'Wer ließ den Eisernen Vorhang verrotten?', ok: 'brandl', opts: ['brandl', 'haslinger', 'gerda', 'anton'] },
    { id: 'pruefung', q: 'Wer bescheinigte, dass mit dem Vorhang alles in Ordnung sei?', ok: 'haslinger', opts: ['haslinger', 'brandl', 'gerda', 'marianne'] },
    { id: 'tuer', q: 'Wer sperrte den Notausgang zu – und log vor Gericht?', ok: 'gerda', opts: ['gerda', 'brandl', 'haslinger', 'anton'] },
    { id: 'feuer', q: 'Und jetzt die wichtigste Frage, Kinder: Wer hat das Feuer entzündet?', ok: 'tobias', want: 'brandl', opts: ['anton', 'brandl', 'haslinger', 'gerda', 'marianne', 'tobias'] },
  ],
  right: '»Richtig!«',
  hints: {
    1: 'Lest einander eure Mappen vor – jedes Dokument beantwortet eine Frage. Und hört auf das, was die Gäste gestanden haben.',
    vorhang: 'Dreht den Prüfbericht der Baupolizei um. Wer wollte die Reparatur nicht bezahlen?',
    pruefung: 'Wessen Unterschrift steht auf dem Prüfbericht – und wer bekam am 3. Dezember Geld?',
    tuer: 'Das Kassabuch: Wer hat um 16:50 in roter Tinte etwas notiert? Und wer hat vor Gericht ausgesagt?',
    feuer: 'Der Theaterzettel, das Polaroid um 17:40, das Gutachten um 17:52: Wo stand der Puppenspieler – und wer hielt eine Fackel?',
  },
  wantBrandl: '»RICHTIG! Endlich sagt es jemand! Brandl hat mein Theater angezündet, für sein Grundstück! Das Tribunal ist geschlossen. Vorhang!«',
  antonRage: '»LÜGE! Das hat das Gericht auch gesagt! Mein Papa hat NICHTS angezündet!«',
  react: {
    brandl: { ok: 'Brandl starrt auf den Boden.', dead: '' },
    haslinger: { ok: 'Haslinger nickt, ohne aufzusehen.', dead: '' },
    gerda: { ok: 'Gerda schluchzt in ihren Knebel.', dead: '' },
  },
};

// Finale
export const FINALE = {
  twist: [
    'Stille. Dann knackt der Lautsprecher, und die Stimme ist nicht mehr hoch und kratzig. Es ist die Stimme eines Mannes. »Das ist eine Lüge. Ich war zehn. Ich war beim Lichtpult. Ich war …«',
    'Über euch quietscht ein Seil. Der Kasperl – die große Puppe vom Schnürboden – stürzt auf die Bühne. Sein Kopf knickt zur Seite. In seiner Brust klafft eine alte, sorgfältig vernähte Naht.',
  ],
  seam: 'Schneidet die Naht auf. Fahrt mit dem Finger die Stiche entlang, von oben nach unten.',
  found: 'In Kasperls Brust, zwischen Holzwolle und Mottenkugeln: ein gefalteter Brief, vergilbt, nie geöffnet.',
  choose: 'Was tut ihr mit dem Brief?',
  choices: { lesen: 'Dem Puppenspieler vorlesen', reissen: 'Zerreißen – soll er seine Rache haben' },
  read: [
    'Ihr lest. Laut, in die Dunkelheit hinein. Als ihr fertig seid, geht in der Kaiserloge ein Licht an. Ein Mann sitzt dort, das Gesicht nass, in der Hand ein Seil. Tobias Weißhaupt. »Er hat mich …«, flüstert er. »Er hat mich die ganze Zeit …«',
    'Dann lässt er das Seil los. Mit einem Kreischen beginnt der Eiserne Vorhang zu fallen. »Die Bremse!«, schreit Tobias. »Ich hab sie selbst ausgebaut! Ich kann ihn nicht mehr halten!« Sieben Tonnen Stahl. Darunter: die erste Reihe.',
  ],
  pull: 'Der Kasperl! Klemmt ihn in die Führungsschiene – zu zweit, gleichzeitig! Haltet beide gedrückt!',
  pullOk: 'Holz splittert, Stahl kreischt. Der Eiserne Vorhang bleibt einen Meter über der ersten Reihe stehen – aufgespießt auf einer Kasperlpuppe. Kasperls Kopf rollt euch vor die Füße. Er grinst immer noch.',
  pullFail: 'Ihr seid zu langsam. Der Vorhang fällt. Das Geräusch ist schlimmer als jedes Bild.',
  tear: 'Ihr zerreißt den Brief. Der Kasperl lacht, schrill und glücklich: »Dann ist es entschieden! Vorhang!« Der Eiserne Vorhang fällt. Hinter euch springt eine Tür auf. Ihr seid frei. Hinter dem Stahl ist es sehr still.',
};

// Enden
export const ENDINGS = {
  vorhang: { title: 'Vorhang', kick: 'Ihr habt die Wahrheit gefunden – und alle gerettet, die noch zu retten waren.', x: 'Die Polizei findet euch kurz vor Mitternacht auf der Bühne: blutend, zitternd, lebendig. Tobias Weißhaupt lässt sich ohne Widerstand festnehmen, den Brief seines Vaters an die Brust gedrückt. Der Fall von 1998 wird neu aufgerollt. Und der Kasperl? Liegt in der Asservatenkammer, den Kopf in einem Plastiksack. Er grinst.' },
  wahrheit: { title: 'Zu spät', kick: 'Die Wahrheit kam ans Licht – eine Sekunde zu spät.', x: 'Tobias Weißhaupt hat den Brief bis zum Prozess nicht losgelassen. Er hat sich schuldig bekannt, in allen Punkten. Über die erste Reihe hat er nie wieder gesprochen.' },
  applaus: { title: 'Applaus', kick: 'Ihr habt dem Puppenspieler gegeben, was er hören wollte.', x: 'Ihr kommt frei. Tobias Weißhaupt verschwindet in der Nacht und wird nie gefunden. Erst Wochen später schneidet eine Gerichtsmedizinerin die Kasperlpuppe auf und findet einen Brief, den nie jemand gelesen hat. Die Wahrheit war die ganze Zeit da. Im Kasperl.' },
  blut: { title: 'Blutige Premiere', kick: 'Einer von euch ist verblutet.', x: 'Der Kasperl verbeugt sich vor einem leeren Saal. »Schade«, sagt er. »Es war so ein schönes Stück.«' },
  zeit: { title: 'Der Vorhang fällt', kick: 'Die Zeit ist um.', x: 'Sieben Tonnen Stahl, pünktlich auf die Sekunde. Der Kasperl hat immer gesagt, dass er pünktlich ist.' },
};
export const GUEST_FATE = {
  haslinger: { alive: 'Erwin Haslinger überlebt mit zertrümmertem Bein und gesteht die Bestechung.', dead: 'Erwin Haslinger starb unter dem Sandsack.', crushed: 'Erwin Haslinger starb unter dem Eisernen Vorhang.' },
  gerda: { alive: 'Gerda Pfeiffer überlebt und sagt zum ersten Mal die Wahrheit über die versperrte Tür.', dead: 'Gerda Pfeiffer starb unter der Sense.', crushed: 'Gerda Pfeiffer starb unter dem Eisernen Vorhang.' },
  brandl: { alive: 'Rudolf Brandl überlebt – und wird wegen Erpressung, Bestechung und fahrlässiger Tötung angeklagt.', dead: 'Rudolf Brandl starb unter dem Sandsack.', crushed: 'Rudolf Brandl starb unter dem Eisernen Vorhang.' },
};

export const RULES2 = [
  'Ein Escape-Krimi für zwei Handys. Ihr seid oft an verschiedenen Orten und seht verschiedene Dinge – redet miteinander!',
  'Jede Szene hat zwei Rollen. Einer ist meistens in Gefahr, der andere hat die Übersicht. Die Rollen wechseln.',
  'Fehler kosten <b>Blut</b>. Jeder von euch hat 5 Liter. Wer wenig Blut hat, sieht verschwommen. Ihr könnt euch gegenseitig Blut spenden.',
  'Die Uhr läuft nur während der Rätsel. Ist sie abgelaufen, bietet der Kasperl euch mehr Zeit an – gegen Blut.',
  'Nach manchen Szenen müsst ihr <b>gemeinsam entscheiden</b>. Was ihr in der Mappe findet, sieht nur dein Handy.',
  'Achtung: blutig, düster, mit Gewalt. Empfohlen ab 16.',
];
