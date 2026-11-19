// Figurenpool für „Wer bin ich?“ (jede Figur nur einmal).

export const CHAR_CATS = [
  { id: 'all', label: 'Alles' },
  { id: 'disney', label: 'Disney & Pixar' },
  { id: 'anime', label: 'Anime' },
  { id: 'filme', label: 'Filme & Serien' },
  { id: 'maerchen', label: 'Märchen & Kinderbuch' },
  { id: 'promis', label: 'Promis & Legenden' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'helden', label: 'Superhelden & Comics' },
  { id: 'tiere', label: 'Tiere' },
];

const RAW = {
  disney: 'Micky Maus, Minnie Maus, Donald Duck, Goofy, Elsa, Anna, Olaf, Simba, Timon, Pumbaa, Arielle, Belle, Cinderella, Rapunzel, Vaiana, Mulan, Aladdin, Jasmin, Dschinni, Stitch, Nemo, Dorie, Woody, Buzz Lightyear, Mike Glotzkowski, WALL-E, Merida, Pocahontas, Tinker Bell, Käpt’n Hook, Dumbo, Bambi, Winnie Puuh, Tigger, Baymax, Mirabel, Hercules, Hades, Ursula, Maleficent, Remy, Lightning McQueen',
  anime: 'Pikachu, Ash Ketchum, Naruto, Sasuke, Son Goku, Vegeta, Ruffy, Lorenor Zorro, Nami, Sailor Moon, Totoro, Chihiro, Light Yagami, L, Ryuk, Eren Jäger, Mikasa, Levi, Tanjiro, Nezuko, Gojo Satoru, Saitama, Edward Elric, Deku, All Might, Kakashi, Doraemon, Detektiv Conan, Kirito, Spike Spiegel, Anya Forger, Frieren, Denji, Ponyo, Kiki, Howl, Ohngesicht, Rem, Megumin, Hinata Shoyo, Itadori Yuji, Kaguya Shinomiya',
  filme: 'Harry Potter, Hermine Granger, Ron Weasley, Dumbledore, Voldemort, Hagrid, Gandalf, Frodo, Gollum, Yoda, Darth Vader, Luke Skywalker, Prinzessin Leia, Indiana Jones, James Bond, Jack Sparrow, Shrek, Barbie, Ken, Forrest Gump, E.T., King Kong, Godzilla, Sherlock Holmes, Walter White, Eleven, Wednesday Addams, Joey Tribbiani, Rachel Green, Sheldon Cooper, Homer Simpson, Bart Simpson, SpongeBob, Patrick Star, Pumuckl, Mr. Bean, Paddington, Minion, Gru, Grinch, Katniss Everdeen, Mary Poppins, Willy Wonka, Daenerys Targaryen, Jon Snow',
  maerchen: 'Rotkäppchen, Der böse Wolf, Hänsel, Gretel, Frau Holle, Rumpelstilzchen, Dornröschen, Aschenputtel, Schneewittchen, Der Froschkönig, Der gestiefelte Kater, Pinocchio, Das hässliche Entlein, Rübezahl, Der Weihnachtsmann, Der Osterhase, Die Zahnfee, Robin Hood, König Artus, Merlin, Peter Pan, Alice im Wunderland, Die Grinsekatze, Der verrückte Hutmacher, Pippi Langstrumpf, Michel aus Lönneberga, Heidi, Biene Maja, Der kleine Prinz, Das Sandmännchen, Die kleine Raupe Nimmersatt, Der Grüffelo, Das Sams, Räuber Hotzenplotz, Der kleine Drache Kokosnuss, Dracula, Frankenstein, Medusa, Zeus, Odysseus',
  promis: 'Taylor Swift, Beyoncé, Rihanna, Billie Eilish, Ed Sheeran, Harry Styles, Lady Gaga, Michael Jackson, Elvis Presley, Freddie Mercury, Madonna, Shakira, Helene Fischer, Dieter Bohlen, Heidi Klum, Albert Einstein, Marie Curie, Leonardo da Vinci, Mozart, Beethoven, Napoleon, Kleopatra, Queen Elizabeth, Angela Merkel, Barack Obama, Elon Musk, Steve Jobs, Cristiano Ronaldo, Lionel Messi, Thomas Müller, Serena Williams, Usain Bolt, Michael Schumacher, Charlie Chaplin, Marilyn Monroe, Leonardo DiCaprio, Zendaya, Tom Holland, Keanu Reeves, Dwayne Johnson, Greta Thunberg, Jürgen Klopp',
  gaming: 'Mario, Luigi, Prinzessin Peach, Bowser, Yoshi, Toad, Donkey Kong, Link, Zelda, Kirby, Sonic, Pac-Man, Lara Croft, Kratos, Master Chief, Steve aus Minecraft, Creeper, Melinda aus Animal Crossing, Tom Nook, Crash Bandicoot, Spyro, Geralt von Riva, Ellie, Aloy, Samus Aran, Cloud Strife, Sora, Ezio Auditore, Wario, Daisy, Waluigi, Glurak, Evoli, Mewtu, Pummeluff',
  helden: 'Spider-Man, Batman, Superman, Wonder Woman, Iron Man, Captain America, Hulk, Thor, Loki, Black Widow, Black Panther, Doctor Strange, Captain Marvel, Deadpool, Wolverine, Groot, Rocket, Thanos, Joker, Harley Quinn, Catwoman, Robin, Aquaman, The Flash, Venom, Ant-Man, Scarlet Witch, Asterix, Obelix, Lucky Luke, Tim und Struppi, Garfield, Snoopy, Charlie Brown, Schlumpfine, Papa Schlumpf, Dagobert Duck',
  tiere: 'Giraffe, Pinguin, Faultier, Krake, Flamingo, Elefant, Löwe, Hai, Delfin, Koala, Panda, Eule, Igel, Fuchs, Waschbär, Erdmännchen, Alpaka, Kamel, Nashorn, Krokodil, Chamäleon, Biene, Schmetterling, Schnecke, Ameise, Marienkäfer, Papagei, Pfau, Storch, Kuh, Schwein, Huhn, Pferd, Esel, Hamster, Goldfisch, Schildkröte, Frosch, Einhorn, Drache',
};

export const CHARS = Object.entries(RAW).flatMap(([cat, list]) =>
  list.split(',').map((s) => s.trim()).filter(Boolean).map((text) => ({ text, cat })));

export function charItems(cat) {
  return cat === 'all' ? CHARS : CHARS.filter((c) => c.cat === cat);
}

// Schnellfragen (Weit weg) – antippen statt tippen
export const QUICK_QUESTIONS = [
  'Bin ich ein Mensch?', 'Bin ich echt?', 'Bin ich weiblich?', 'Bin ich männlich?', 'Lebe ich noch?',
  'Bin ich aus einem Film?', 'Bin ich aus einer Serie?', 'Bin ich aus einem Anime?', 'Bin ich aus einem Videospiel?',
  'Bin ich ein Tier?', 'Habe ich Superkräfte?', 'Kann ich zaubern?', 'Kann ich fliegen?', 'Bin ich ein Bösewicht?',
  'Bin ich von Disney?', 'Bin ich aus einem Märchen?', 'Mache ich Musik?', 'Mache ich Sport?', 'Bin ich ein Kind?',
  'Bin ich in Deutschland bekannt?', 'Trage ich etwas auf dem Kopf?', 'Bin ich gelb?',
];

// Merkzettel (Nebeneinander): antippen = ✓, nochmal = ✗, nochmal = leer
export const NOTE_CHIPS = ['Mensch', 'Tier', 'echt', 'erfunden', 'weiblich', 'männlich', 'lebt', 'Kind', 'Film', 'Serie', 'Anime', 'Spiel', 'Märchen', 'Disney', 'Musik', 'Sport', 'Superkraft', 'Bösewicht'];
