// Krimi „Blutnacht im Hotel Edelweiß“ – der ganze Fall: Einleitung, Ereignisse der Nacht, Erkenntnisse,
// Tipps, Anklageschrift, Auflösung und Rekonstruktion. Orte, Spuren und Personen kommen aus eigenen Dateien.
// Uhrzeit = Minuten seit Mitternacht des 5. Jänner (23:00 = 1380, 01:00 = 1500, 06:00 = 1800).
import { FLOORS, ROOMS, MEET, START_ROOM, HALLS, STAIRS } from './fall-orte.js';
import { CLUES, KINDS } from './fall-spuren.js';
import { PEOPLE, PEOPLE_ORDER } from './fall-personen.js';

export const DIFFS = {
  normal: { id: 'normal', title: 'Kommissare', sub: 'Ab 23:00 Uhr · 14 Nadeln · 6 Tipps', start: 1380, pins: 14, hints: 6 },
  hart: { id: 'hart', title: 'Chefinspektoren', sub: 'Ab 23:30 Uhr · 10 Nadeln · 3 Tipps', start: 1410, pins: 10, hints: 3 },
};

export const INTRO = [
  'Hotel Edelweiß, 1.900 Meter über dem Meer. Die Nacht vom 5. auf den 6. Jänner – die letzte Rauhnacht. Seit dem Nachmittag tobt ein Schneesturm, um acht Uhr abends hat eine Lawine die einzige Straße ins Tal verschüttet. Telefon und Handynetz sind tot.',
  'Ihr wolltet hier oben nur ein paar ruhige Tage verbringen. Um 22:31 kracht es im Weinkeller. Um 22:35 schreit die Hausdame. Hotelbesitzer Konrad Falkner liegt zwischen den Regalen in seinem eigenen Blut – die Kehle durchtrennt, der Körper zerstochen, ringsum Scherben und Rotwein.',
  'Über Funk erreicht ihr Inspektor Hofer in Lienz. Er kennt euch – zwei Kommissare im Urlaub, Glück im Unglück. »Bis der Schneepflug um sechs Uhr oben ist, seid ihr das Gesetz da oben. Sichert die Spuren. Verhört alle. Und gebt mir einen Namen.«',
  'Acht Menschen sind mit euch eingeschneit. Einer von ihnen hat heute Nacht gemordet. Und die Nacht ist noch lange nicht vorbei.',
];

// Ereignisse, die zur Uhrzeit passieren (egal wer gerade handelt). kind: big (Einblendung) · tick (nur Laufband) · silent
export const EVENTS = [
  { id: 'mitternacht', at: 1440, kind: 'tick', title: 'Mitternacht', x: 'Die letzte Rauhnacht beginnt. Der Sturm heult ums Haus, das Licht flackert zweimal – dann brennt es wieder.' },
  { id: 'runde', at: 1445, kind: 'tick', w: { nf: 'emilSaved' }, set: ['note'], title: '00:05', x: 'Emil verlässt seine Loge für die Mitternachtsrunde.' },
  { id: 'heizen', at: 1461, kind: 'silent', w: { f: 'note' }, set: ['saunaHeiss'] },
  { id: 'stock', at: 1470, kind: 'silent', w: { f: 'note' }, set: ['stockWeg'] },
  { id: 'mord2', at: 1500, kind: 'special' },
  { id: 'fund2', at: 1550, kind: 'big', blood: true, w: { f: 'emilDead', nf: 'emilFound' }, set: ['emilFound'], title: 'Ein Schrei aus dem Keller', x: '01:50. Ein gellender Schrei aus dem Spa, dann noch einer. Greta hat Emil gefunden – in der Sauna, bei 110 Grad. Die Tür war von außen mit einem Skistock verkeilt, sein Schädel ist eingeschlagen, das Blut auf dem heißen Holz verbacken. Der Mörder ist noch im Haus. Und er hat wieder getötet.' },
  { id: 'sturm', at: 1620, kind: 'big', set: ['sturm'], title: 'Der Sturm legt sich', x: '03:00. Zum ersten Mal seit Stunden ist es still. Der Wind hat aufgehört, der Mond steht über dem Grat. Der Hinterhof ist wieder zugänglich.' },
  { id: 'flucht', at: 1650, kind: 'big', w: { f: 'emilDead' }, set: ['lukasFlucht'], title: 'Lukas flieht!', x: '03:30. Greta hämmert an eure Tür: Lukas Steiner ist weg! Im Mondlicht zieht eine einzelne Spur den Hang hinunter. Nach zwanzig Minuten kehrt er um, halb erfroren, die Ski unterm Arm. Er sitzt jetzt zitternd im Kaminzimmer.' },
  { id: 'funk5', at: 1740, kind: 'big', title: 'Funkspruch von Inspektor Hofer', x: '05:00. »Der Schneepflug ist in einer Stunde oben. Um sechs will ich einen Namen hören – und die Beweise dazu. Unterschrieben, von euch beiden.«' },
];

// Mord an Emil um 1 Uhr (oder nicht): wird in der Logik ausgewertet
export const MORD2 = {
  saved: { kind: 'big', title: '01:00 – Schritte im Spa', x: 'Die Tür zum Spa geht auf. Emil steht da, kreidebleich, und starrt dich an. Irgendwo hinter ihm fällt eine Tür ins Schloss, schnelle Schritte auf der Personaltreppe – dann Stille. »Was … was machen Sie hier?«, flüstert Emil. Dann bricht er zusammen und erzählt dir alles.' },
  waited: { kind: 'tick', title: '01:00', x: 'Irgendwo im Keller fällt eine Tür ins Schloss.' },
};
export const FOUND2 = { kind: 'big', blood: true, title: 'Emil ist tot', x: 'In der Sauna, bei 110 Grad, die Tür von außen mit einem Skistock verkeilt: Emil Brandner, der Schädel eingeschlagen. Der Mörder hat wieder zugeschlagen – mitten in eurer Ermittlung.' };

// Erkenntnisse: zwei angepinnte Spuren mit rotem Faden verbunden (eine aus a, eine aus b)
export const COMBOS = [
  { a: ['kerze'], b: ['altar', 'a_greta_kerzen'], g: 'c_kerze' },
  { a: ['kerze', 'x_kerze'], b: ['schnurrolle'], g: 'c_schnur' },
  { a: ['handtuch', 'x_handtuch'], b: ['jacke'], g: 'c_faden' },
  { a: ['kuebel', 'x_kuebel'], b: ['jacke_faden'], g: 'c_faden2' },
  { a: ['skalpell', 'x_skalpell'], b: ['arzttasche'], g: 'c_skalpell' },
  { a: ['schachprotokoll', 'a_novak_brille'], b: ['a_wendt_alibi'], g: 'c_luecke' },
  { a: ['uhr', 'x_uhr'], b: ['x_scherben'], g: 'c_zeit' },
  { a: ['medaillon', 'a_greta_medaillon'], b: ['briefe'], g: 'c_medaillon' },
  { a: ['dna'], b: ['taschenuhr', 'briefe', 'foto_et'], g: 'c_vater' },
  { a: ['recherche', 'a_sophie_2004'], b: ['tagebuch_klar'], g: 'c_lawine' },
  { a: ['fenster'], b: ['a_novak_fenster', 'schachprotokoll'], g: 'c_fenster' },
  { a: ['a_wendt_waschen'], b: ['a_greta_nachher', 'geschirrtuch'], g: 'c_waschen' },
  { a: ['schuhspuren', 'x_schuhspuren'], b: ['wendt_schuhe'], g: 'c_schuhe' },
  { a: ['a_greta_kerzen'], b: ['a_marie_kerze'], g: 'c_kerzenzeit' },
  { a: ['erpressung'], b: ['a_wendt_nacht'], g: 'c_nacht' },
  { a: ['a_emil_aussage', 'dienstbuch_seite'], b: ['a_wendt_alibi', 'a_wendt_luecke'], g: 'c_zeuge' },
];

// Tipps: der erste passende, noch nicht gegebene wird genommen (team… = einer von euch beiden)
export const HINTS = [
  { id: 'emil1', w: { after: 1430, before: 1500, nf: 'emilSaved', nf2: 'emilDead', teamNotAny: ['spiegel', 'dienstbuch', 'tropfen'] }, x: 'Emil, der Nachtportier, behauptet, niemand sei im Personalgang gewesen. Seht euch den Gang an – und das Dienstbuch in seiner Loge. Bald.' },
  { id: 'emil2', w: { after: 1430, before: 1500, nf: 'emilSaved', nf2: 'emilDead', teamAny: ['spiegel', 'dienstbuch', 'tropfen'] }, x: 'Haltet Emil in seiner Loge vor, was ihr über den Spiegel, die Treppe oder sein Dienstbuch wisst. Er weiß mehr – und das ist gefährlich für ihn.' },
  { id: 'tatort', w: { teamNot: 'leiche' }, x: 'Fangt am Tatort an: im Weinkeller im Keller. Untersucht die Leiche – und schaut auch darunter.' },
  { id: 'unter', w: { teamHas: 'leiche', teamNot: 'uhr' }, x: 'Unter der Leiche liegt mehr, als man auf den ersten Blick sieht. Dreht ihn um.' },
  { id: 'scherben', w: { teamNot: 'scherben' }, x: 'Seht euch im Weinkeller die Scherben genau an: Wo liegen sie im Verhältnis zum Blut?' },
  { id: 'funk', w: { teamHas: 'scherben', teamNot: 'x_scherben' }, x: 'Funkt die Scherben an Dr. Kranz. Die Gerichtsmedizin kann euch sagen, WANN die Kiste gefallen ist.' },
  { id: 'regal', w: { teamHas: 'scherben', teamNot: 'kerze' }, x: 'Wo stand die Kiste, bevor sie fiel? Klettert auf das Regal.' },
  { id: 'schach', w: { teamNot: 'schachprotokoll' }, x: 'Wendt und Novak haben Schach gespielt. Novak schreibt alles mit – sucht sein Protokoll in der Bibliothek.' },
  { id: 'master', w: { teamNot: 'generalschluessel', teamNot2: 'generalschluessel2' }, x: 'Greta, die Hausdame, hat einen Generalschlüssel für alle Zimmer. Fragt sie im Kaminzimmer danach.' },
  { id: 'chiffre', w: { teamHas: 'tagebuch', teamNot: 'tagebuch_klar' }, x: 'Das Tagebuch: Der Schlüssel ist ein Kosename. Wie wurde Falkners erste Frau genannt? Schaut auf das Medaillon oder die Tafel in der Kapelle.' },
  { id: 'tresor', w: { teamHas: 'tresor', teamNot: 'testament' }, x: 'Lisls letzter Tag ist ihr Todestag – er steht auf der Gedenktafel in der Kapelle. Sechs Ziffern: Tag, Monat, Jahr.' },
  { id: 'schnee', w: { f: 'sturm', teamNot: 'skalpell' }, x: 'Der Sturm ist vorbei. Was liegt draußen im Hinterhof, unter dem Bibliotheksfenster?' },
  { id: 'abdruck', w: { teamHas: 'wachsabdruck', teamNot: 'fp_treffer' }, x: 'Der Daumen im Wachs: Nehmt im Verhör Fingerabdrücke und vergleicht sie in eurer Akte. Achtet auf Schleife, Narbe und Inselchen.' },
  { id: 'liebe', w: { teamNotAny: ['briefe', 'taschenuhr', 'a_greta_wahrheit'] }, x: 'Wer hat Elisabeth geliebt? Greta hütet seit 22 Jahren ein Geheimnis – in ihrer Kammer unter dem Dach.' },
  { id: 'affaere', w: { teamNotAny: ['a_viktoria_wahr', 'a_lukas_wahr'] }, x: 'Viktoria und Lukas sagen beide, sie seien allein gewesen. Verhört sie gleichzeitig, jeder von euch einen – dann könnt ihr bluffen.' },
  { id: 'zeit', w: {}, x: 'Ordnet die Zeit: Wer war zwischen 21:45 und 22:00 wo – und wer kann es beweisen? Pinnt die wichtigsten Spuren an die Tafel und verbindet sie mit roten Fäden.' },
];

const P = (ids) => ids.map((id) => ({ id, t: PEOPLE[id].name }));
const ALL = PEOPLE_ORDER;

// Anklageschrift (gemeinsam ausfüllen, beide unterschreiben)
export const QUESTIONS = [
  { id: 'taeter', q: 'Wer hat Konrad Falkner ermordet?', pts: 25, opts: P(ALL), ok: 'wendt', big: true },
  { id: 'waffe', q: 'Womit?', pts: 8, ok: 'skalpell', opts: [
    { id: 'flasche', t: 'Mit dem abgebrochenen Flaschenhals' }, { id: 'skalpell', t: 'Mit einem Skalpell' },
    { id: 'kuechenmesser', t: 'Mit einem Küchenmesser' }, { id: 'taschenmesser', t: 'Mit Lukas’ Taschenmesser' },
    { id: 'kiste', t: 'Gar nicht – die stürzende Weinkiste traf ihn' }] },
  { id: 'zeit', q: 'Wann starb Konrad Falkner?', pts: 8, ok: 'b', opts: [
    { id: 'a', t: 'Zwischen 21:15 und 21:35' }, { id: 'b', t: 'Zwischen 21:45 und 22:00' },
    { id: 'c', t: 'Zwischen 22:05 und 22:20' }, { id: 'd', t: 'Um 22:31, beim Klirren' }] },
  { id: 'trick', q: 'Was war das Klirren um 22:31?', pts: 8, ok: 'kerze', opts: [
    { id: 'sturz', t: 'Der Mord selbst: Falkner riss im Kampf die Kiste herunter' }, { id: 'kerze', t: 'Ein Zeitzünder: Eine Kerze brannte eine Schnur durch' },
    { id: 'flucht', t: 'Der fliehende Täter stieß die Kiste um' }, { id: 'lawine', t: 'Eine Erschütterung durch die Lawine' }] },
  { id: 'motiv', q: 'Warum musste er sterben?', pts: 10, ok: 'rache', opts: [
    { id: 'rache', t: 'Rache für Elisabeth – und um Maries Erbe zu retten' }, { id: 'erbe', t: 'Um selbst zu erben, bevor um 6 Uhr das Testament geändert wird' },
    { id: 'eifersucht', t: 'Eifersucht wegen einer Affäre' }, { id: 'geld', t: 'Geld: Der Hotelverkauf sollte durchgesetzt werden' },
    { id: 'kuendigung', t: 'Rache für eine Kündigung' }] },
  { id: 'abdruck', q: 'Wessen Daumen steckt im Kerzenwachs?', pts: 6, opts: P(ALL), ok: 'wendt' },
  { id: 'versteck', q: 'Wo verschwand die echte Tatwaffe?', pts: 6, ok: 'schnee', opts: [
    { id: 'schnee', t: 'Aus dem Bibliotheksfenster in den Schnee' }, { id: 'abfluss', t: 'In den Abfluss der Waschküche' },
    { id: 'kamin', t: 'Im Kamin verbrannt' }, { id: 'tasche', t: 'Zurück in die Arzttasche' }, { id: 'regal', t: 'Zwischen den Weinflaschen versteckt' }] },
  { id: 'emil_wer', q: 'Wer tötete Emil Brandner?', pts: 8, w: { f: 'emilDead' }, opts: P(ALL.filter((x) => x !== 'emil')), ok: 'wendt' },
  { id: 'emil_warum', q: 'Warum musste Emil sterben?', pts: 6, w: { f: 'emilDead' }, ok: 'erpressung', opts: [
    { id: 'erpressung', t: 'Er erpresste den Mörder – er hatte ihn um 22:01 gesehen' }, { id: 'kasse', t: 'Er hatte Geld aus der Hotelkasse gestohlen' },
    { id: 'affaere', t: 'Er wusste von Viktorias Affäre' }, { id: 'unfall', t: 'Gar nicht – es war ein Unfall in der Sauna' }] },
  { id: 'emil_sah', q: 'Wen sah Emil um 22:01 im Spiegel?', pts: 8, w: { nf: 'emilDead' }, opts: P(ALL.filter((x) => x !== 'emil')), ok: 'wendt' },
  { id: 'luegner', q: 'Wer log über 21:20 bis 22:30, um eine Affäre zu verbergen? (alle ankreuzen)', pts: 6, multi: true, opts: P(['viktoria', 'lukas', 'marie', 'novak', 'sophie']), ok: ['viktoria', 'lukas'] },
  { id: 'vater', q: 'Wer ist Maries leiblicher Vater?', pts: 6, ok: 'wendt', opts: [
    { id: 'konrad', t: 'Konrad Falkner' }, { id: 'wendt', t: 'Dr. Theodor Wendt' }, { id: 'novak', t: 'Henrik Novak' }, { id: 'emil', t: 'Emil Brandner' }] },
  { id: 'lawine', q: 'Was geschah am 12. März 2004 am Hang?', pts: 6, ok: 'konrad', opts: [
    { id: 'unglueck', t: 'Ein tragisches Unglück' }, { id: 'konrad', t: 'Konrad trat das Schneebrett absichtlich los' },
    { id: 'wendt', t: 'Dr. Wendt ließ Elisabeth im Stich' }, { id: 'selbst', t: 'Elisabeth ging absichtlich in den Hang' }] },
  { id: 'sophie', q: 'Wer ist Sophie Lenz wirklich?', pts: 5, ok: 'presse', opts: [
    { id: 'blog', t: 'Eine Reisebloggerin' }, { id: 'presse', t: 'Journalistin – sie recherchiert Elisabeths Tod' },
    { id: 'novak', t: 'Novaks heimliche Geschäftspartnerin' }, { id: 'tochter', t: 'Konrads uneheliche Tochter' }] },
];
export const BONUS = { emil: 10, perQuarter: 1, timeMax: 10, hint: 3 };

export const RANKS = [
  { min: .9, id: 'meister', title: 'Meisterdetektive', x: 'Jede Lüge entlarvt, jede Spur gelesen. Inspektor Hofer schüttelt euch lange die Hand.' },
  { min: .75, id: 'haupt', title: 'Hauptkommissare', x: 'Ein wasserdichter Fall. Ein paar Geheimnisse sind euch durchgerutscht – aber der Mörder nicht.' },
  { min: .55, id: 'kommissar', title: 'Kommissare', x: 'Ihr habt den Richtigen. Der Staatsanwalt hätte sich trotzdem ein paar Beweise mehr gewünscht.' },
  { min: 0, id: 'anwaerter', title: 'Anwärter', x: 'Der richtige Name – aber eine dünne Akte. Ohne Geständnis wäre er davongekommen.' },
];
export const WRONG = { id: 'falsch', title: 'Der Täter lacht', x: 'Ihr habt die falsche Person angeklagt.' };

// Auflösung
export const EPILOG = {
  right: [
    'Um 6:04 Uhr kämpft sich der Schneepflug die letzte Kehre herauf, dahinter blaues Licht. Inspektor Hofer stapft in die Halle, liest eure Anklageschrift und nickt nur.',
    'Dr. Theodor Wendt leistet keinen Widerstand. Als die Handschellen klicken, fragt er nur: »Darf ich mich von Marie verabschieden?« Hofer erlaubt es nicht.',
    'In Lienz redet er dann doch, stundenlang. »Er stand oben am Hang, an diesem Tag. Heute Nacht hat er es mir ins Gesicht gesagt, mit einem Glas Margaux in der Hand. Lachend. ›Ich hab das Brett losgetreten, Theo. Sie wollte zu dir. Der Berg hat entschieden.‹ Und dann: ›Morgen um sechs streiche ich deine Tochter aus meinem Leben.‹« Er schweigt lange. »Da habe ich entschieden.«',
  ],
  emilDead: '»Und Emil?«, fragt Hofer. Wendt sieht auf seine Hände. »Er hätte nur schweigen müssen. Nur schweigen.«',
  emilSaved: '»Und Emil?«, fragt Hofer. Wendt lächelt müde. »Er hat Glück gehabt. Sie waren schneller als ich.«',
  end: 'Marie Falkner führt das Hotel Edelweiß bis heute. Sie hat keinen ihrer beiden Väter je wieder besucht. Aber in der Kapelle brennen seit jener Nacht wieder zwei Kerzen.',
  wrong: {
    marie: 'Um 6:04 Uhr legt Inspektor Hofer Marie Falkner Handschellen an. Sie schreit nicht, sie weint nicht. Sie sieht nur Dr. Wendt an, der in der Halle steht und den Blick abwendet. Drei Wochen sitzt sie in Untersuchungshaft. Dann findet man Dr. Theodor Wendt tot in seiner Praxis in Lienz, daneben ein Brief: »Marie ist unschuldig. Ich habe Konrad getötet. Verzeih mir, Lisl.«',
    viktoria: 'Viktoria Falkner verlässt das Hotel in Handschellen und mit erhobenem Kopf. Ihr Wiener Anwalt zerlegt die Anklage in zwei Wochen: ein Liebhaber als Alibi, und kein Motiv – sie hätte durch den Tod vor sechs Uhr alles verloren. Im Frühling findet ein Wanderer unter dem Bibliotheksfenster eine rostige Klinge in einer Serviette.',
    lukas: 'Lukas Steiner wird abgeführt, sein eigener Skistock als Beweisstück in einer Plastiktüte. Die Zeitungen nennen ihn »den Saunamörder«. Erst Monate später bringt ein Laborbericht die Wende: Tweedfasern, ein Daumen im Wachs – und ein Hausarzt, der plötzlich nach Südamerika verreist ist.',
    novak: 'Henrik Novak telefoniert noch in der Halle mit seinen Anwälten. Nach 48 Stunden ist er frei – sein Alibi steht im Barbuch, mit Uhrzeit und Unterschrift. Die Ermittlungen beginnen von vorn. Und der wahre Täter hat zwei Tage Vorsprung.',
    greta: 'Greta Huber lässt sich wortlos abführen, den Rosenkranz in der Hand, und verrät kein einziges Geheimnis. Erst als Marie sie im Gefängnis besucht, erzählt sie ihr von den Briefen – und von »T.«. Eine Woche später stellt sich Dr. Theodor Wendt der Polizei.',
    sophie: '»Die Journalistin war’s« – die Schlagzeile schreibt sich von selbst. Doch Sophie Lenz hat mehr Beweise als die Polizei. Ihre Recherche führt geradewegs zu einem Mann, der zweiundzwanzig Jahre auf diesen Abend gewartet hat. Zwei Monate später ist sie frei, und ihre Geschichte steht auf jeder Titelseite.',
    emil: 'Einen Nachtportier anzuklagen ist bequem. Doch Greta Huber schweigt nicht. Sie bringt Lisls Briefe zur Polizei – und eine Spur, die geradewegs zu Zimmer 12 führt.',
    wendt: '',
  },
  wrongEnd: 'Der Mörder von Konrad Falkner war Dr. Theodor Wendt.',
};

// Rekonstruktion: was in dieser Nacht wirklich geschah (läuft auf dem Grundriss ab)
export const RECON = [
  { t: '16:12', room: 'suite', who: 'sophie', x: 'Sophie Lenz schleicht mit dem gestohlenen Generalschlüssel in die Suite und fotografiert den Brief von »T.«.' },
  { t: '19:30', room: 'speisesaal', x: 'Abendessen. Falkner kündigt an: Um sechs Uhr kommt der Notar. »Dann wird hier aufgeräumt.«' },
  { t: '20:50', room: 'kapelle', who: 'greta', x: 'Greta zündet beide Altarkerzen für Elisabeth an.' },
  { t: '21:10', room: 'skiraum', x: 'Falkner feuert Lukas – er ahnt etwas von Viktoria.' },
  { t: '21:15', room: 'kapelle', who: 'wendt', x: 'Dr. Wendt nimmt die linke Altarkerze an sich. Er hat einen Plan.' },
  { t: '21:20', room: 'skiraum', who: 'viktoria', x: 'Viktoria schleicht zu Lukas. Die beiden bleiben bis kurz vor halb elf.' },
  { t: '21:25', room: 'buero', who: 'marie', x: '»Du bist nicht einmal mein Blut!« Falkner enterbt Marie. Sophie lauscht an der Treppe.' },
  { t: '21:30', room: 'bibliothek', who: 'wendt', x: 'Wendt und Novak beginnen ihre Schachpartie. Novak notiert jeden Zug.' },
  { t: '21:35', room: 'kapelle', who: 'marie', x: 'Marie weint in der Kapelle. Es brennt nur noch eine Kerze.' },
  { t: '21:38', room: 'weinkeller', x: 'Falkner geht in den Weinkeller, wie jeden Abend.' },
  { t: '21:41', room: 'bibliothek', who: 'wendt', x: 'Zug 14. Wendt steht auf: »Ich hole meine Lesebrille.« Sie steckt in seiner Brusttasche.' },
  { t: '21:44', room: 'personalgang', who: 'wendt', x: 'Über Speisesaal, Küche und Personaltreppe hinunter. Emil sieht nur einen Rücken in Tweed.' },
  { t: '21:52', room: 'weinkeller', who: 'wendt', blood: true, x: 'Falkner gesteht lachend den Mord an Lisl und will Marie enterben. Wendt schneidet ihm die Kehle durch und sticht zu, wieder und wieder. Im Fallen reißt Falkner ihm das Medaillon vom Hals. Die Uhr zerbricht: 21:52.' },
  { t: '21:55', room: 'weinkeller', who: 'wendt', x: 'Die Falle: Schnur aus der Waschküche, die Kerze auf dem Regal, die Kiste schräg über der Kante. Den blutigen Flaschenhals legt er neben die Hand.' },
  { t: '21:59', room: 'waschkueche', who: 'wendt', x: 'Er wäscht Hände, Skalpell und Ärmel und versteckt das Handtuch ganz unten im Wäschekorb.' },
  { t: '22:01', room: 'personalgang', who: 'wendt', x: 'Auf dem Weg nach oben sieht er in den Spiegel – und Emil sieht ihn.' },
  { t: '22:03', room: 'bibliothek', who: 'wendt', x: 'Zug 15. Außer Atem, ein roter Striemen am Hals.' },
  { t: '22:06', room: 'bibliothek', who: 'wendt', x: '»Zu heiß.« Er reißt das Fenster auf. Das Skalpell, in eine Serviette gewickelt, fällt in den Schnee.' },
  { t: '22:31', room: 'weinkeller', x: 'Die Flamme erreicht die Schnur, die Kiste stürzt. Wendt sitzt seelenruhig am Schachbrett.' },
  { t: '22:40', room: 'weinkeller', who: 'wendt', x: 'Wendt »untersucht« die Leiche: »Höchstens zehn Minuten tot.« Danach wäscht er sich ganz offen in der Küche.' },
  { t: '00:05', room: 'zimmer12', who: 'emil', w: { f: 'note' }, x: 'Emil schiebt seinen Erpresserbrief unter die Tür von Zimmer 12.' },
  { t: '00:21', room: 'spa', who: 'wendt', w: { f: 'note' }, x: 'Wendt heizt die Sauna auf 110 Grad. Um 00:30 holt er Lukas’ Skistock.' },
  { t: '01:00', room: 'spa', who: 'wendt', blood: true, w: { f: 'emilDead' }, x: 'Emil kommt, um sein Geld zu holen. Der Kübel trifft ihn am Hinterkopf. Wendt verkeilt die Saunatür mit dem Skistock und verbrennt später die Dienstbuch-Seite.' },
  { t: '01:00', room: 'spa', who: 'wendt', w: { f: 'note', f2: 'emilSaved' }, x: 'Wendt wartet in der Hitze auf Emil – vergeblich. Ihr wart schneller.' },
];

// Werkzeuge
export const CIPHER = {
  key: 'LISL',
  plain: '3. JAENNER. EIN BRIEF VON T. ER WEISS ES. DIESE JOURNALISTIN HAT IHM ALLES GEZEIGT. ICH HABE IHN FUER DEN FUENFTEN EINGELADEN.\n4. JAENNER. DER TEST IST DA: MARIE IST NICHT MEIN KIND. SIE IST SEINES. LISL LACHT MICH AUS, NOCH AUS DEM GRAB.\n5. JAENNER. MORGEN UM SECHS KOMMT PICHLER, DANN BEKOMMT MARIE NICHTS. UND HEUTE NACHT SAGE ICH T. INS GESICHT, WAS AM HANG WIRKLICH WAR: ICH HABE DAS BRETT LOSGETRETEN. SIE WOLLTE ZU IHM. DER BERG HAT ENTSCHIEDEN. ICH HABE ENTSCHIEDEN.',
};
export const SAFE = { code: '120304', room: 'buero' };
export const RUB = { lines: ['Herr Dr. W. –', 'Ich hab Sie gesehen.', '22:01, Personalgang,', 'nasse Ärmel.', '50.000 € oder ich rede.', 'Heute 1 Uhr, Sauna.', '– E.'] };
export const CHESS = {
  head: 'Dr. T. Wendt (Weiß) – H. Novak (Schwarz) · Bibliothek, 5. 1.',
  rows: [
    ['1.', 'e4', 'e5', '21:30'], ['2.', 'Sf3', 'Sc6', '21:31'], ['3.', 'Lb5', 'a6', '21:31'], ['4.', 'La4', 'Sf6', '21:32'],
    ['5.', '0-0', 'Le7', '21:33'], ['6.', 'Te1', 'b5', '21:34'], ['7.', 'Lb3', 'd6', '21:35'], ['8.', 'c3', '0-0', '21:35'],
    ['9.', 'h3', 'Sb8', '21:36'], ['10.', 'd4', 'Sbd7', '21:37'], ['11.', 'Sbd2', 'Lb7', '21:38'], ['12.', 'Lc2', 'Te8', '21:39'],
    ['13.', 'Sf1', 'Lf8', '21:40'], ['14.', 'Sg3', 'g6', '21:41', 'T. holt Brille'], ['15.', 'a4', 'c5', '22:03'],
    ['16.', 'd5', 'c4', '22:05', 'T.: Fenster auf, zu heiß'], ['17.', 'Lg5', 'h6', '22:10'], ['18.', 'Le3', 'Sc5', '22:14'],
    ['19.', 'Dd2', 'h5', '22:19'], ['20.', 'Lg5', 'Le7', '22:24'], ['21.', 'Ta3', 'Sh7', '22:28'], ['22.', '…', '', '22:31', 'Krach! Abbruch.'],
  ],
};

export const RULES = [
  'Ihr ermittelt zusammen – mit zwei Handys. Jeder hat seine <b>eigene Akte</b>: Was du findest, sieht dein Partner nicht. Erzählt euch alles!',
  'Die Uhr läuft von 23 Uhr bis 6 Uhr früh – für euch <b>beide gemeinsam</b>. Jede Handlung kostet Minuten: Laufen, Durchsuchen, Verhören, Funken.',
  'Die <b>Spurensicherung</b> durchsucht schneller, wer <b>Verhöre</b> führt, fragt schneller. Machen könnt ihr beide alles.',
  'Die <b>Ermittlungstafel</b> teilt ihr euch: Was dort hängt, kann der andere lesen. Nadeln sind begrenzt. Verbindet zwei Spuren mit einem <b>roten Faden</b> – passen sie zusammen, bekommt ihr eine Erkenntnis.',
  'Im Verhör: Fragen stellen und <b>Beweise vorhalten</b>. Verhört ihr zwei Personen gleichzeitig getrennt oder eine Person zu zweit, öffnen sich manchmal neue Wege.',
  'Per <b>Funk</b> schickt ihr Spuren an die Gerichtsmedizin in Innsbruck. Die Antwort kommt 30 Minuten später.',
  'Am Ende füllt ihr gemeinsam die <b>Anklageschrift</b> aus und unterschreibt beide. Je mehr stimmt, desto besser euer Rang.',
  'Achtung: Diese Geschichte ist blutig und düster. Empfohlen ab 16.',
];

export const CASE = {
  id: 'edelweiss',
  title: 'Blutnacht im Hotel Edelweiß',
  short: 'Hotel Edelweiß',
  tag: 'Fall 1',
  date: 'Nacht vom 5. auf den 6. Jänner',
  end: 1800,
  startRoom: START_ROOM, meet: MEET,
  floors: FLOORS, rooms: ROOMS, halls: HALLS, stairs: STAIRS,
  clues: CLUES, kinds: KINDS, people: PEOPLE, order: PEOPLE_ORDER,
  intro: INTRO, events: EVENTS, mord2: MORD2, found2: FOUND2, combos: COMBOS, hints: HINTS,
  questions: QUESTIONS, bonus: BONUS, ranks: RANKS, wrong: WRONG, epilog: EPILOG, recon: RECON,
  cipher: CIPHER, safe: SAFE, rub: RUB, chess: CHESS, rules: RULES, diffs: DIFFS,
};
