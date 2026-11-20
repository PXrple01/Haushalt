// Krimi „Blutnacht im Hotel Edelweiß“ – die Verdächtigen und ihre Verhöre.
// intro: erstes Gespräch (Aussage + Alibi) · topics: Fragen · show: Beweise vorhalten (erste passende Zeile gilt)
// Bedingungen zusätzlich: split (Partner verhört gerade Person X) · together (beide verhören dieselbe Person)
//                         teamAny/teamAny2 (einer von euch hat eine dieser Spuren) · nhas (du hast die Spur noch nicht)
// {K} wird zu „Herr Kommissar“ bzw. „Frau Kommissarin“. set: Merker setzen (z. B. Emil gerettet).

export const PEOPLE = {
  viktoria: {
    name: 'Viktoria Falkner', short: 'Viktoria', age: 41, role: 'Die Witwe', bio: '41, Falkners zweite Frau. Früher Rezeptionistin in Wien.',
    fpc: { type: 'arch', scar: false, island: false },
    intro: { a: '»Ich war im Spa. Im Whirlpool, ab zwanzig nach neun bis kurz vor halb elf. Allein – ich wollte meine Ruhe. Konrad und ich hatten uns gestritten, ja. Wie jedes Paar. Und jetzt ist er …« Sie zieht den Morgenmantel enger. Ihre Hände zittern nicht.', g: ['a_viktoria_alibi'] },
    topics: [
      { id: 'streit', q: 'Worum ging es im Streit um 20:45?', a: '»Ums Hotel. Er wollte nicht verkaufen, ich schon – ich wollte zurück nach Wien, zurück ins Leben. Er hat gelacht und gesagt, ich solle mich nicht so wichtig nehmen. Morgen werde ohnehin alles anders.«', g: ['a_viktoria_streit'] },
      { id: 'notar', q: 'Wussten Sie, warum der Notar kommen sollte?', a: '»Pichler? Konrad hat beim Essen damit angegeben. Mir hat er gestern ins Ohr geflüstert: ›Bald bekommst du, was du verdienst.‹ Ich dachte, das ist eine Drohung. Bei Konrad war alles eine Drohung.«', g: ['a_viktoria_notar'] },
      { id: 'wendt', q: 'Was wissen Sie über Dr. Wendt?', a: '»Theo? Der Hausarzt, seit Ewigkeiten. Er hat mir Schlaftabletten verschrieben. Er und Konrad waren mal Freunde, glaube ich. Heute beim Essen haben sie kein einziges Wort gewechselt. Theo hat seinen Teller nicht angerührt.«', g: ['a_viktoria_wendt'] },
      { id: 'marie', q: 'Wie stehen Sie zu Marie?', a: '»Marie hasst mich. Sie glaubt, ich wollte ihre Mutter ersetzen. Niemand ersetzt Elisabeth – das hat mir dieses Haus jeden einzelnen Tag gezeigt. Sogar mit den Kerzen in der Kapelle.«' },
      { id: 'bluff', q: '»Lukas hat uns gerade alles erzählt.«', bluff: true, w: { split: 'lukas', nhas: 'a_viktoria_wahr' }, a: 'Sie starrt dich an. Dann zur Tür, hinter der dein Partner mit Lukas spricht. »Dieser Idiot.« Lange Stille. »Also gut. Ich war bei ihm, im Skiraum, von zwanzig nach neun bis kurz vor halb elf. Konrad hatte ihn gefeuert – wegen mir. Mein Mann lag tot im Keller, und ich lag in den Armen eines Skilehrers. Sind Sie jetzt zufrieden?«', g: ['a_viktoria_wahr'] },
    ],
    show: [
      { c: ['whirlpool'], a: '»Außer Betrieb? …« Ein Lidschlag zu lang. »Dann war ich eben auf der Liege. Oder in der Sauna. Ich weiß es nicht mehr, ich stehe unter Schock!« Sie verschränkt die Arme. »Ich sage nichts mehr ohne meinen Anwalt.«', g: ['a_viktoria_luege'] },
      { c: ['schal'], a: '»Mein Schal? Im Skiraum?« Sie lächelt dünn. »Den habe ich seit Tagen nicht gesehen. Jeder kann ihn dorthin gebracht haben.«' },
      { c: ['foto_vl', 'handy', 'kleid', 'a_lukas_wahr'], a: 'Sie sieht lange darauf. Dann lacht sie, kurz und bitter. »Also gut. Ich war mit Lukas zusammen. Im Skiraum, von zwanzig nach neun bis kurz vor halb elf, wir haben die Tür nicht aufgemacht. Konrad hatte ihn gefeuert – wegen mir. Mein Mann wurde ermordet, und ich lag in den Armen eines Skilehrers. Schreiben Sie das ruhig auf.«', g: ['a_viktoria_wahr'] },
      { c: ['reisetasche', 'a_lukas_tickets'], a: '»Wien, morgen um 9:12?« Sie wird blass. »Davon wusste ich nichts. Lukas ist ein Kind. Ich wäre nie … ich war doch verheiratet.« Sie merkt, was sie gerade gesagt hat.' },
      { c: ['testament'], a: 'Sie liest den Entwurf zweimal. »Alles für mich? Ab sechs Uhr?« Dann lacht sie, schrill und hässlich. »Wissen Sie, was das heißt? Wenn er heute Nacht stirbt, bevor er unterschreibt, bekomme ich nichts. Wer immer das war, hat MIR alles genommen.«', g: ['a_viktoria_testament'] },
      { c: ['dna', 'a_marie_wahr'], a: '»Nicht seine Tochter?« Zum ersten Mal wirkt sie wirklich erschüttert. »Das arme Ding. Und er hat es ihr heute Abend gesagt? Das sieht ihm ähnlich.«' },
      { c: ['a_viktoria_alibi', 'a_viktoria_luege'], a: '»Ich habe gesagt, was ich zu sagen habe.«' },
    ],
    nope: ['»Was soll ich dazu sagen? Das hat nichts mit mir zu tun.«', '»Ich verstehe nicht, worauf Sie hinauswollen.«', 'Sie betrachtet ihre Fingernägel. »Nein.«'],
  },

  lukas: {
    name: 'Lukas Steiner', short: 'Lukas', age: 29, role: 'Der Skilehrer', bio: '29, früher Rennläufer. Heute Abend fristlos gefeuert.',
    fpc: { type: 'loopR', scar: true, island: true },
    intro: { a: '»Ich war im Skiraum, ab neun, und hab gewachst. Allein. Bis es um halb elf gekracht hat.« Er knetet seine Mütze. »Ja, der Chef hat mich um zehn nach neun rausgeschmissen. Fristlos. Aber deswegen bringt man doch keinen um!«', g: ['a_lukas_alibi'] },
    topics: [
      { id: 'kuendigung', q: 'Warum hat Falkner Sie gefeuert?', a: '»Angeblich, weil ich die Gäste schlecht betreue. Blödsinn. Er hat was geahnt.« Er beißt sich auf die Lippe. »Was, das geht Sie nichts an.«', g: ['a_lukas_kuendigung'] },
      { id: 'wachs', q: 'Was genau haben Sie gewachst?', a: '»Ski halt. Rennski. Von … Gästen. Mehrere Paar.« Er sieht dich nicht an. Seine Hände sind sauber – zu sauber für jemanden, der zwei Stunden gewachst haben will.' },
      { id: 'falkner', q: 'Wie war Falkner als Chef?', a: '»Ein Tyrann. Aber meistens ein gerechter. Die Greta sagt, früher, mit der ersten Frau, war er ein anderer Mensch. Seit der Lawine nicht mehr.«' },
      { id: 'flucht', q: 'Warum wollten Sie fliehen?', w: { f: 'lukasFlucht' }, a: 'Er zittert noch, die Lippen blau. »Weil das mein Stock war, an der Sauna! Ich bin doch nicht blöd, ich weiß, wie das aussieht! Ich war’s nicht. Den Stock kann jeder genommen haben, der Skiraum ist nie zugesperrt.«', g: ['a_lukas_flucht'] },
      { id: 'bluff', q: '»Viktoria hat uns gerade alles erzählt.«', bluff: true, w: { split: 'viktoria', nhas: 'a_lukas_wahr' }, a: '»Was?« Er springt fast vom Stuhl. »Die hat … okay. Okay! Ja, sie war bei mir. Ab zwanzig nach neun bis kurz vor halb elf, im Skiraum. Wir haben die Tür keine Sekunde aufgemacht, das schwör ich. Wir wollten zusammen weg.«', g: ['a_lukas_wahr'] },
    ],
    show: [
      { c: ['schal', 'foto_vl', 'handy', 'kleid', 'a_viktoria_wahr'], a: 'Er sackt in sich zusammen. »Okay. Ja. Viktoria war bei mir. Von zwanzig nach neun bis kurz vor halb elf. Wir haben die Tür nicht aufgemacht, keine Sekunde. Wir wollten zusammen weg – ich hab sogar schon Tickets.«', g: ['a_lukas_wahr'] },
      { c: ['reisetasche'], a: '»Die Tickets. Ja.« Er lächelt schief. »Ich dachte, sie kommt mit. Jetzt glaub ich, sie wollte nie.«', g: ['a_lukas_tickets'] },
      { c: ['skistock', 'stock_fehlt', 'falle'], a: '»Mein Stock?« Er wird kalkweiß. »Ich war das nicht! Der Skiraum ist offen, Tag und Nacht, da kommt jeder rein!«', g: ['a_lukas_stock'] },
      { c: ['taschenmesser'], a: '»Mein Wachsmesser. Damit kratz ich Wachs von den Kanten. Schauen Sie halt nach, ob Blut dran ist.«' },
      { c: ['kuendigung'], a: '»Die hat er mir in die Hand gedrückt. Mit diesem Grinsen. ›Mit dem ersten Schneepflug.‹ Als ob ich ein Sack Müll wär.«', g: ['a_lukas_kuendigung'] },
    ],
    nope: ['»Keine Ahnung, ehrlich.«', '»Was hat das mit mir zu tun?«', 'Er zuckt mit den Schultern. »Weiß nicht.«'],
  },

  marie: {
    name: 'Marie Falkner', short: 'Marie', age: 33, role: 'Die Tochter', bio: '33, Köchin und Hotelchefin. Hat ihren Vater gefunden.',
    fpc: { type: 'whorl', scar: true, island: false },
    intro: { a: 'Ihre Bluse ist noch immer voller Blut. »Ich war in der Kapelle. Ab halb zehn, ungefähr. Ich wollte allein sein. Dann hab ich Greta schreien hören und bin hinunter, und da lag Papa … Ich hab ihn gehalten. Ich hab seinen Kopf gehalten, bis Theo mich weggezogen hat.« Ihre Stimme bricht.', g: ['a_marie_alibi'] },
    topics: [
      { id: 'streit', q: 'Worum ging es im Streit mit Ihrem Vater?', a: '»Ums Hotel. Wie immer.« Sie sieht an dir vorbei auf den Boden.', g: ['a_marie_streit'] },
      { id: 'mutter', q: 'Erzählen Sie von Ihrer Mutter.', a: '»Mama ist gestorben, als ich elf war. Eine Lawine, am Hang hinter dem Haus. Papa war dabei. Er hat nie darüber geredet, kein einziges Mal. Theo – Dr. Wendt – hat mich danach jede Woche besucht. Er war wie ein zweiter Vater. Ehrlich gesagt mehr als der erste.«', g: ['a_marie_mutter'] },
      { id: 'hotel', q: 'Was wird jetzt aus dem Hotel?', a: '»Es gehört mir. Hat Papa immer gesagt. Ich koche hier seit fünfzehn Jahren, ich führe dieses Haus. Viktoria will verkaufen? Über meine Leiche.« Sie hört selbst, was sie gesagt hat, und verstummt.' },
      { id: 'fund', q: 'Was ist Ihnen beim Fund aufgefallen?', a: '»Blut. So viel Blut. Und Theo, der ganz ruhig war. Er hat Papa angesehen und gesagt: ›Höchstens zehn Minuten. Er hat nicht gelitten.‹ Dann hat er uns alle hinausgeschickt.«', g: ['a_marie_fund'] },
    ],
    show: [
      { c: ['a_sophie_hoert', 'dna', 'testament', 'tagebuch_klar'], a: 'Sie schließt die Augen. »Ja. Er hat mir gesagt, dass ich nicht seine Tochter bin. Dass er es seit gestern schwarz auf weiß hat. Dass ich ab morgen nichts mehr bin in diesem Haus. Und ich hab geschrien: Dann bist du für mich gestorben.« Sie sieht dich an, die Augen rot. »Aber ich hab ihn nicht umgebracht. Ich hab ihn geliebt. Trotz allem.«', g: ['a_marie_wahr'] },
      { c: ['kerze', 'altar', 'a_greta_kerzen', 'c_kerze'], a: '»Die Altarkerzen? Als ich um halb zehn kam, brannte nur eine, die rechte. Ich hab mich noch gewundert. Greta zündet immer beide an, für Mama, jeden Abend, seit zweiundzwanzig Jahren.«', g: ['a_marie_kerze'] },
      { c: ['bluse', 'x_bluse'], a: '»Das ist sein Blut! Ich hab ihn doch gehalten! Was glauben Sie, wie man aussieht, wenn man seinen toten Vater im Arm hält?«' },
      { c: ['marie_schulden', 'novak_mail'], a: 'Sie wird rot. »Ja, ich hab Schulden. Ja, ohne das Hotel bin ich erledigt. Glauben Sie, das weiß ich nicht?«', g: ['a_marie_schulden'] },
      { c: ['taschenuhr', 'briefe', 'foto_et', 'a_greta_wahrheit', 'a_wendt_vater', 'c_vater'], a: 'Sie starrt darauf. »Theo … und Mama?« Ihre Hand fährt zum Mund. »Nein. Nein, nein, nein. Theo ist mein … ist er mein Vater?« Sie beginnt zu zittern.', g: ['a_marie_theo'] },
      { c: ['taschentuch'], a: '»Meins. Ich hab geweint, fast eine Stunde lang. Ist das jetzt auch verdächtig?«' },
      { c: ['medaillon'], a: '»Das ist Mamas Medaillon!« Sie greift danach. »Das hat sie immer getragen. Und irgendwann nicht mehr. Wo war es?«' },
    ],
    nope: ['»Ich weiß nicht, was Sie meinen.«', 'Sie schüttelt nur den Kopf.', '»Bitte. Ich kann nicht mehr.«'],
  },

  wendt: {
    name: 'Dr. Theodor Wendt', short: 'Dr. Wendt', age: 61, role: 'Der Hausarzt', bio: '61, Arzt aus Lienz. Seit dreißig Jahren Hausarzt der Familie.',
    fpc: { type: 'loopL', scar: true, island: true },
    intro: { a: 'Dr. Wendt sitzt aufrecht, die Hände gefaltet, die Lesebrille in der Brusttasche. »Eine furchtbare Nacht. Ich habe ab halb zehn mit Herrn Novak in der Bibliothek Schach gespielt. Einmal war ich kurz weg, meine Lesebrille holen – fünf Minuten, höchstens. Als es krachte, saßen wir beide am Brett. Ich habe Konrad dann untersucht: Er war höchstens zehn Minuten tot. Die Glasscherbe hat die Halsschlagader getroffen. Er hat nicht gelitten.«', g: ['a_wendt_alibi', 'a_wendt_zeit'] },
    topics: [
      { id: 'konrad', q: 'Wie standen Sie zu Falkner?', a: '»Wir kennen uns seit der Volksschule. Ich bin seit dreißig Jahren Hausarzt der Familie. Freunde?« Er nimmt die Brille aus der Tasche, putzt sie, steckt sie zurück. »Man wird älter. Man redet weniger.«' },
      { id: 'lisl', q: 'Erzählen Sie von Elisabeth Falkner.', w: { hasAny: ['medaillon', 'altar', 'sterbebild', 'briefe', 'recherche', 'a_marie_mutter', 'a_greta_lisl', 'tagebuch_klar', 'zettel_tresor'] }, a: 'Eine winzige Pause. »Lisl war … Frau Falkner war ein wunderbarer Mensch. Ich habe damals den Totenschein ausgestellt. Erstickt unter einem Schneebrett. Ein Unglück. Konrad stand unten am Hang und konnte nichts tun.«', g: ['a_wendt_lisl'] },
      { id: 'nacht', q: 'Wo waren Sie um 1 Uhr nachts?', w: { after: 1500, f: 'emilFound' }, a: '»In meinem Zimmer. Ich habe nach diesem Abend eine Schlaftablette genommen. Ich habe nichts gehört, bis Greta geschrien hat.«', g: ['a_wendt_nacht'] },
      { id: 'nacht2', q: 'Wo waren Sie um 1 Uhr nachts?', w: { after: 1500, nf: 'emilFound' }, a: '»Im Bett. Ich habe eine Schlaftablette genommen, nach diesem Abend. Was soll diese Frage?«', g: ['a_wendt_nacht'] },
      { id: 'zange', q: 'Zu zweit: ihn in die Zange nehmen', together: true, w: { together: true, teamAny: ['c_luecke', 'a_novak_brille', 'a_emil_aussage', 'c_zeuge', 'c_skalpell', 'erpressung'], teamAny2: ['medaillon', 'c_medaillon', 'briefe', 'taschenuhr', 'c_vater', 'a_wendt_vater'] }, a: 'Ihr setzt euch links und rechts neben ihn und legt ihm vor, was ihr habt – Stück für Stück, abwechselnd, ohne ihm Luft zu lassen. Wendts Hände beginnen zu zittern. »Sie hat es mir geschenkt«, sagt er plötzlich, ganz leise. »Das Medaillon. Im Februar 2004. ›Damit du mich nie vergisst.‹ Vier Wochen später war sie tot. Und er … er stand oben am Hang und hat zugesehen, wie es abgeht.« Er presst die Lippen aufeinander, bis sie weiß werden. »Nein. Ich sage nichts mehr. Kein Wort.«', g: ['a_wendt_bruch'] },
    ],
    show: [
      { c: ['schachprotokoll', 'a_novak_brille', 'c_luecke'], a: '»Zweiundzwanzig Minuten?« Er lächelt dünn. »Nun – die Brille war nicht im Zimmer, ich habe gesucht. Dann war ich noch auf der Toilette. In meinem Alter, {K}, achtet man nicht auf die Minute.«', g: ['a_wendt_luecke'] },
      { c: ['x_scherben', 'x_leiche', 'uhr', 'x_uhr', 'c_zeit'], a: '»Die Gerichtsmedizin sitzt in Innsbruck und hat die Leiche nie gesehen. Ich schon. Ich bleibe bei meiner Einschätzung.« Er sagt es ruhig. Zu ruhig.' },
      { c: ['arzttasche'], a: '»Ein Skalpell fehlt? Die Tasche steht seit Tagen offen herum, hier im Haus kann jeder hinein.« Er zuckt mit den Schultern. »Ich zähle meine Klingen nicht.«' },
      { c: ['skalpell', 'x_skalpell', 'c_skalpell'], a: 'Sein Blick bleibt an der blutigen Serviette hängen. Lange. »Dazu sage ich nichts mehr«, sagt er schließlich. »Ich möchte mit einem Anwalt sprechen.«', g: ['a_wendt_anwalt'] },
      { c: ['medaillon', 'c_medaillon', 'a_greta_medaillon'], a: 'Er wird grau im Gesicht. Seine Hand fährt an den Kragen – dorthin, wo ein frischer roter Striemen über den Hals läuft. »Das … habe ich nie gesehen.« Er bemerkt deinen Blick. »Vom Rasieren.«', g: ['a_wendt_hals'] },
      { c: ['taschenuhr', 'briefe', 'foto_et', 'dna', 'c_vater', 'a_greta_wahrheit', 'a_marie_theo'], a: 'Er sieht lange darauf. Dann nimmt er die Brille ab. »Ja. Ich habe Lisl geliebt. Zwölf Jahre lang. Marie ist meine Tochter – sie weiß es nicht, und ich hoffe, sie erfährt es nicht von Ihnen.« Er setzt die Brille wieder auf. »Aber das macht mich nicht zum Mörder. Konrad hatte viele Feinde.«', g: ['a_wendt_vater'] },
      { c: ['recherche', 'tagebuch_klar', 'brief_t', 'a_sophie_wendt', 'a_sophie_2004', 'c_lawine', 'kalender'], a: 'Etwas in ihm bricht und fügt sich sofort wieder zusammen. »Sie hat mir die Aussage des Bergführers gezeigt, ja. Konrad stand oberhalb. Ich weiß es seit drei Tagen.« Er sieht dich an. »Wissen Sie, wie das ist? Zweiundzwanzig Jahre lang einem Mörder die Hand zu schütteln? … Ich habe ihn nicht getötet.«', g: ['a_wendt_wusste'] },
      { c: ['erpressung', 'asche', 'c_nacht'], a: '»Ein Erpresserbrief? Lächerlich.« Er schnaubt. »Emil hat Gespenster gesehen – im Spiegel, um diese Uhrzeit, mit seinem Zirbenschnaps.« Er hält inne. Niemand hat ihm von einem Spiegel erzählt.', g: ['a_wendt_spiegel'] },
      { c: ['a_emil_aussage', 'a_emil_erpressung', 'dienstbuch_seite', 'c_zeuge'], a: '»Emil?« Ein abfälliges Lächeln. »Ein Nachtportier, der seit Jahren heimlich trinkt. Ich war die ganze Zeit oben. Fragen Sie Herrn Novak.«' },
      { c: ['a_greta_nachher', 'c_waschen', 'geschirrtuch'], a: 'Eine Spur zu lange Pause. »Dann habe ich mich eben zweimal gewaschen. Einmal in der Küche, einmal unten. Blut geht schwer ab, {K}.«' },
      { c: ['jacke', 'handtuch', 'abfluss', 'x_abfluss', 'x_handtuch', 'c_faden'], a: '»Natürlich habe ich mich gewaschen. Nach der Untersuchung, in der Waschküche – ich hatte sein Blut an den Händen. Ist das ein Verbrechen?«', g: ['a_wendt_waschen'] },
      { c: ['wendt_schuhe', 'schuhspuren', 'x_schuhspuren', 'c_schuhe'], a: '»Ich putze meine Schuhe jeden Abend, seit fünfzig Jahren. Und ja, ich bin durch das Blut gegangen. Bei der Untersuchung.«' },
      { c: ['wachsabdruck', 'fp_treffer', 'kerze', 'c_kerze', 'c_schnur'], a: '»Ein Daumenabdruck in einer Kerze?« Er hebt die Augenbrauen. »Ich war in der Kapelle, wie jeder Gast. Vielleicht habe ich eine Kerze angefasst. Das ist doch kein Verbrechen.«', g: ['a_wendt_kerze'] },
      { c: ['kuebel', 'leiche2', 'x_leiche2', 'x_kuebel', 'c_faden2', 'jacke_faden', 'skistock'], a: '»Ich habe geschlafen.« Er sieht dich nicht an. »Fragen Sie, wen Sie wollen.«' },
      { c: ['brillenetui'], a: '»Mein Etui. Ich habe es wohl liegen lassen.« Er tastet nach seiner Brusttasche. Die Brille steckt darin.' },
      { c: ['fenster', 'a_novak_fenster', 'c_fenster'], a: '»Es war unerträglich heiß in der Bibliothek, der Kamin. Ich habe gelüftet. Seit wann ist Lüften verboten?«' },
    ],
    nope: ['»Ich verstehe nicht, worauf Sie hinauswollen.«', '»Das ist unerheblich.«', '»Bitte. Ich bin Arzt, kein Hellseher.«'],
  },

  novak: {
    name: 'Henrik Novak', short: 'Novak', age: 47, role: 'Der Investor', bio: '47, aus Wien. Wollte das Hotel für 14,5 Millionen kaufen.',
    fpc: { type: 'loopL', scar: false, island: true },
    intro: { a: 'Henrik Novak sitzt mit übergeschlagenen Beinen da, als warte er auf einen Geschäftstermin. »Ich habe ab halb zehn mit Dr. Wendt Schach gespielt. Zwischendurch war ich kurz an der Bar, Frau Lenz war auch dort. Als es um 22:31 krachte, saßen wir beide wieder am Brett. Mehr kann ich nicht beitragen.«', g: ['a_novak_alibi'] },
    topics: [
      { id: 'schach', q: 'Erzählen Sie von der Schachpartie.', a: '»Wir begannen um 21:30. Ich notiere jeden Zug mit Uhrzeit – eine alte Gewohnheit, ich bin Controller, ich messe alles. Das Protokoll liegt noch neben dem Brett in der Bibliothek.«', g: ['a_novak_protokoll'] },
      { id: 'deal', q: 'Was ist mit dem Hotelkauf?', a: '»Herr Falkner wollte nicht verkaufen. Er hat den Vertrag heute Nachmittag vor meinen Augen zerrissen. Für meine Firma bedauerlich. Für einen Mord?« Er lacht leise. »Es gibt andere Hotels.«', g: ['a_novak_deal'] },
      { id: 'fenster', q: 'Was geschah, als Wendt zurückkam?', w: { hasAny: ['a_novak_brille', 'fenster', 'schachprotokoll', 'a_novak_protokoll'] }, a: '»Er setzte sich und zog – und kurz nach zehn riss er mitten im Sturm das Fenster auf. ›Zu heiß‹, sagte er. Er stand eine ganze Weile dort, mit dem Rücken zu mir. Sein rechter Ärmel war nass, das fiel mir auf, als er den nächsten Zug machte.«', g: ['a_novak_fenster'] },
    ],
    show: [
      { c: ['schachprotokoll'], a: '»Genau so war es. Zug vierzehn um 21:41, dann ging er – die Brille holen, sagte er. Seltsam eigentlich: Die Brille steckte die ganze Zeit in seiner Brusttasche, ich habe sie gesehen. Um 22:03 kam er zurück, außer Atem. Und er hatte einen roten Kratzer am Hals, den er vorher nicht hatte.«', g: ['a_novak_brille'] },
      { c: ['a_wendt_alibi', 'a_wendt_luecke', 'c_luecke'], a: '»Fünf Minuten? Sagt er das?« Novak zieht die Augenbrauen hoch. »Ich habe es aufgeschrieben. Sehen Sie in meinem Protokoll nach.«' },
      { c: ['novak_mail'], a: '»Mein Chef schreibt viel, wenn der Tag lang ist.« Er verzieht keine Miene. »Mit einer Erbin über einen Verkauf zu sprechen, ist kein Verbrechen. Ein Mord dagegen wäre … geschäftsschädigend.«' },
      { c: ['barbuch', 'a_sophie_novak'], a: '»Sehen Sie? 21:47 und 21:55, mit meiner Unterschrift. Und Frau Lenz saß zwei Hocker weiter.«' },
      { c: ['vertrag'], a: '»Ja, den hat er zerrissen. Heute Nachmittag, in seinem Büro, vor meinen Augen. Mit sichtlichem Vergnügen.«' },
      { c: ['novak_schuhe', 'schuhspuren', 'x_schuhspuren'], a: '»Größe 45, mit Profil. Ich bin aus Wien, nicht aus Paris. Mit glatten Sohlen bricht man sich hier oben den Hals.«' },
      { c: ['brillenetui'], a: '»Das Etui lag den ganzen Abend auf seinem Sessel. Die Brille hatte er in der Brusttasche.«' },
    ],
    nope: ['»Dazu kann ich nichts sagen.«', '»Das liegt außerhalb meiner Zuständigkeit.«', 'Er sieht auf seine Uhr. »Nein.«'],
  },

  greta: {
    name: 'Greta Huber', short: 'Greta', age: 67, role: 'Die Hausdame', bio: '67, seit 35 Jahren im Haus. Kennt jedes Geheimnis.',
    fpc: { type: 'loopL', scar: true, island: false },
    intro: { a: 'Greta sitzt kerzengerade, den Rosenkranz in den Händen. »Ab neun war ich in meiner Kammer, hab gestrickt und Radio gehört. Um halb elf ruft der Emil an, es hat im Keller gekracht. Ich bin hinunter … und da lag der Chef.« Sie bekreuzigt sich. »Die Marie ist gleich nach mir gekommen.«', g: ['a_greta_alibi'] },
    topics: [
      { id: 'schluessel', q: 'Können wir die Zimmer aufsperren?', a: '»Der Herr Inspektor hat gesagt, Sie dürfen alles.« Sie löst einen schweren Schlüssel vom Gürtel. »Mein Generalschlüssel. Er sperrt jedes Zimmer im Haus – nur nicht das Büro vom Chef. Da hatte nur er selbst einen Schlüssel.«', g: ['generalschluessel'] },
      { id: 'kerzen', q: 'Was machen Sie abends in der Kapelle?', a: '»Jeden Abend um zehn vor neun zünde ich die zwei Altarkerzen an, für die Frau Elisabeth. Seit zweiundzwanzig Jahren. Heute auch. Beide.«', g: ['a_greta_kerzen'] },
      { id: 'abend', q: 'Haben Sie heute Abend etwas gehört?', a: '»Um Viertel vor neun hat der Chef mit seiner Frau gestritten, in der Suite. Laut. Sie hat geschrien: ›Ich bin nicht deine Angestellte!‹ Und um halb zehn war’s im Büro laut, mit der Marie. Ich war grad auf der Treppe zu meiner Kammer.«', g: ['a_greta_streit'] },
      { id: 'lisl', q: 'Erzählen Sie von Elisabeth.', a: 'Ihre Augen werden feucht. »Die Lisl war ein Engel. Der Chef hat sie nicht verdient, Gott verzeih mir. Er ist damals allein vom Hang zurückgekommen, ohne einen Kratzer. Und der Herr Doktor hat bei der Beerdigung geweint wie ein Kind. Mehr als der Witwer.«', g: ['a_greta_lisl'] },
      { id: 'nachher', q: 'Was geschah nach dem Fund?', a: '»Der Herr Doktor hat den Chef angeschaut und uns hinaufgeschickt. Dann ist er mit mir in die Küche und hat sich am Spülbecken die Hände gewaschen. Ich hab ihm selber das Geschirrtuch gegeben. In die Waschküche ist er nicht gegangen. Danach hat der Emil den Inspektor angefunkt.«', g: ['a_greta_nachher'] },
      { id: 'emil', q: 'Ist Ihnen an Emil etwas aufgefallen?', w: { f: 'emilFound' }, a: 'Sie weint. »Der Emil … er war heut Abend so komisch. Um Mitternacht hat er mich gefragt, wie viel so ein Arzt wohl verdient. Ich hab gelacht. Jetzt lach ich nicht mehr.«', g: ['a_greta_emil'] },
    ],
    show: [
      { c: ['briefe', 'sterbebild'], a: 'Sie fährt hoch. »Sie waren in meiner Schatulle!« Dann sinkt sie zurück, plötzlich alt und müde. »Ja. Die Briefe hab ich nach ihrem Tod aus ihrem Zimmer genommen, damit der Chef sie nie findet. ›T.‹ – das ist der Herr Doktor. Die Marie ist sein Kind. Ich hab es zweiundzwanzig Jahre lang für mich behalten. Für die Lisl.«', g: ['a_greta_wahrheit'] },
      { c: ['medaillon'], a: '»Das Medaillon von der Lisl!« Sie greift sich ans Herz. »Das hat sie im Winter vor ihrem Tod verschenkt. An wen, hat sie mir nie gesagt. Der Chef hat es nie getragen, nie. Wo haben Sie das her?«', g: ['a_greta_medaillon'] },
      { c: ['schluesselbrett'], a: '»Der Zweier fehlt? Seit wann?« Sie überlegt. »Das kann nur die Neue gewesen sein, die Blonde von Zimmer drei. Die ist am Nachmittag so herumgeschnüffelt.«', g: ['a_greta_zweier'] },
      { c: ['whirlpool'], a: '»Der Whirlpool ist seit sechs kaputt, hab ich selber angeschrieben. Da war heut Abend niemand drin, das sag ich Ihnen.«' },
      { c: ['heizprotokoll', 'thermostat', 'sauna_heiss', 'falle'], a: '»Die Sauna dreh ich jeden Abend um zehn ab. Wer sie mitten in der Nacht wieder aufdreht, auf hundertzehn Grad – der hat nichts Gutes vor.«' },
      { c: ['geschirrtuch'], a: '»Das Tuch hab ich dem Herrn Doktor gegeben, nach der Untersuchung. Da hat er sich die Hände gewaschen. Ich hab’s noch nicht in die Wäsche getan.«' },
      { c: ['handtuch'], a: '»Ein blutiges Handtuch, ganz unten im Korb versteckt? Das hab nicht ich hineingetan. Ich leg die Handtücher immer obenauf, seit fünfunddreißig Jahren.«' },
      { c: ['dienstbuch'], a: '»Der Emil schreibt alles auf. Alles. Eine Seite herausreißen – das täte der nie. Außer er hat Angst.«' },
    ],
    nope: ['»Da weiß ich nichts davon, {K}.«', 'Sie schüttelt den Kopf und betet weiter.', '»Fragen Sie da wen anderen.«'],
  },

  sophie: {
    name: 'Sophie Lenz', short: 'Sophie', age: 31, role: 'Der Gast', bio: '31, aus München. Angeblich Reisebloggerin.',
    fpc: { type: 'whorl', scar: false, island: true },
    intro: { a: 'Sophie Lenz hält ihr Handy fest wie einen Rettungsring. »Ich war ab halb zehn an der Bar und hab an meinem Blogeintrag gearbeitet. Herr Novak kam irgendwann dazu. Und dann dieser Krach … furchtbar. Einfach furchtbar.«', g: ['a_sophie_alibi'] },
    topics: [
      { id: 'blog', q: 'Worüber schreiben Sie?', a: '»Über versteckte Hotels in den Alpen. Das Edelweiß ist ein Juwel. War.« Sie lächelt verkrampft. Auf ihrem Handy ist keine einzige Blog-App zu sehen, dafür ein Diktiergerät.' },
      { id: 'gehoert', q: 'Haben Sie heute Abend etwas gehört?', a: 'Sie zögert. »Ja … gegen halb zehn, auf dem Weg zur Bar, an der Treppe. Aus dem Büro hat Herr Falkner gebrüllt: ›Du bist nicht einmal mein Blut!‹ Und Marie hat geschrien: ›Dann bist du für mich gestorben!‹ Dann flog eine Tür.«', g: ['a_sophie_hoert'] },
      { id: 'novak', q: 'Wie lange war Herr Novak an der Bar?', a: '»Er kam etwa um Viertel vor zehn, trank zwei Cognac und hat mir Zinseszins erklärt. Kurz vor zehn ging er wieder. Ich war froh.«', g: ['a_sophie_novak'] },
      { id: '2004', q: 'Was wissen Sie über den Tod von Elisabeth Falkner?', w: { has: 'a_sophie_journalistin' }, a: '»Zwölfter März 2004. Ein Schneebrett am Hang hinter dem Haus. Falkner sagte, er sei unterhalb gewesen und habe alles mit ansehen müssen. Ein Bergführer sah ihn oberhalb – genau dort, wo das Brett abging. Man hat ihm nicht geglaubt; Falkner war mächtig. Den Totenschein schrieb der Hausarzt. Dr. Wendt.«', g: ['a_sophie_2004'] },
      { id: 'wendt', q: 'Kennen Sie Dr. Wendt?', w: { has: 'a_sophie_journalistin' }, a: '»Ich habe ihn am 3. Jänner in Lienz interviewt und ihm die Aussage des Bergführers gezeigt. Er ist kreidebleich geworden. Er hat nur gesagt: ›Dann stimmt es also.‹ Dann ist er aufgestanden und gegangen, mitten im Satz. Am selben Tag hat er Falkner einen Brief geschrieben – den hab ich heute Nachmittag in der Suite fotografiert.«', g: ['a_sophie_wendt'] },
    ],
    show: [
      { c: ['generalschluessel2', 'presseausweis', 'kamera', 'recherche', 'a_greta_zweier'], a: 'Sie lässt die Schultern sinken. »Okay. Ich bin keine Bloggerin. Ich bin Journalistin, Süddeutsche Rundschau. Ich recherchiere seit einem Jahr über den Tod von Elisabeth Falkner. Den Schlüssel hab ich genommen, um in die Suite zu kommen. Das war nicht in Ordnung. Aber ich habe niemanden umgebracht – ich wollte, dass endlich jemand für einen Mord bezahlt.«', g: ['a_sophie_journalistin'] },
      { c: ['barbuch', 'a_novak_alibi'], a: '»Sehen Sie, da stehe ich. 21:32, 21:50, 22:12. Und Herr Novak zweimal dazwischen.«' },
      { c: ['brief_t'], a: 'Sie wird rot. »Den … kenne ich. ›T.‹ – wissen Sie, wer das ist?« Sie beißt sich auf die Lippe. »Vergessen Sie, dass ich das gefragt habe.«' },
    ],
    nope: ['»Kein Kommentar.« Sie beißt sich auf die Lippe. »Entschuldigung. Berufskrankheit.«', '»Davon weiß ich nichts.«', '»Das müssen Sie andere fragen.«'],
  },

  emil: {
    name: 'Emil Brandner', short: 'Emil', age: 58, role: 'Der Nachtportier', bio: '58, sitzt jede Nacht in seiner Loge und schreibt alles auf.',
    where: 'portiersloge', gone: { f: 'emilDead' },
    fpc: { type: 'loopR', scar: false, island: false },
    intro: { a: 'Emil Brandner sitzt in seiner Loge, die Hände um eine Tasse Tee. »Ich sitz jede Nacht hier, {K}. Um 21:38 ist der Chef in den Keller, wie jeden Abend, das steht im Buch. Sonst? Niemand. Gar niemand. Dann um halb elf der Krach, und ich hab gleich die Greta angerufen.« Er sieht dabei auf seine Tasse, nicht auf dich.', g: ['a_emil_alibi'] },
    topics: [
      { id: 'buch', q: 'Steht in Ihrem Dienstbuch wirklich alles?', a: '»Alles, was wichtig ist.« Er streicht über den Einband. Seine Hand zittert ein wenig.' },
      { id: 'chef', q: 'Wie war Falkner zu Ihnen?', a: '»Dreißig Jahre hab ich für ihn gearbeitet. Gehalt wie vor zwanzig Jahren. Er hat gesagt, ich soll froh sein, dass mich in meinem Alter überhaupt noch wer nimmt.« Er lacht freudlos. »Jetzt bin ich wohl arbeitslos.«' },
      { id: 'runde', q: 'Was haben Sie um Mitternacht gemacht?', w: { after: 1445 }, a: '»Meine Runde. Wie jede Nacht, durch alle Gänge, oben und unten.« Er greift nach seiner Tasse, obwohl sie leer ist.', g: ['a_emil_runde'] },
    ],
    show: [
      { c: ['spiegel', 'dienstbuch', 'tropfen', 'weg'], w: { nf: 'note' }, set: 'emilSaved', a: 'Er starrt dich an. Lange. »Ja«, flüstert er dann. »Ich hab jemanden gesehen. Um 21:44 ging einer Richtung Keller – nur ein Rücken, Tweed. Und um 22:01 kam er wieder herauf, die Ärmel nass, und hat sich die Hände an der Jacke abgewischt. Der Herr Doktor. Er hat in den Spiegel geschaut. Direkt zu mir.« Er schluckt. »Ich hab Angst gehabt. Drum hab ich die Seite herausgerissen. Hier.«', g: ['a_emil_aussage', 'dienstbuch_seite'] },
      { c: ['spiegel', 'dienstbuch', 'tropfen', 'weg', 'durchdruck', 'erpressung'], w: { f: 'note' }, set: 'emilSaved', a: 'Er starrt dich an – und dann bricht es aus ihm heraus. »Der Herr Doktor! Um 22:01 kam er aus dem Keller, die Ärmel nass, und hat in den Spiegel geschaut, direkt zu mir. Und ich Trottel … ich hab ihm um Mitternacht einen Zettel unter die Tür geschoben. Fünfzigtausend Euro. Um eins in der Sauna.« Er packt deinen Arm. »Bitte. Ich geh da nicht hin. Lassen Sie mich nicht allein.«', g: ['a_emil_aussage', 'a_emil_erpressung', 'dienstbuch_seite'] },
    ],
    nope: ['»Ich hab nichts gesehen, {K}. Wirklich nicht.«', 'Er wischt sich den Schweiß von der Stirn. »Nein.«', '»Da kann ich Ihnen nicht helfen.«'],
  },
};

export const PEOPLE_ORDER = ['wendt', 'marie', 'viktoria', 'novak', 'lukas', 'greta', 'sophie', 'emil'];
