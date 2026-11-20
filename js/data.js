// Startwerte: Gewinnleiter, Zeiten, Opa-Sprüche, Abzeichen, Fragenkatalog

export const GENERATIONS = [
  { id: "enkel", label: "Enkel", icon: "🧒" },
  { id: "kinder", label: "Kinder", icon: "🧑" },
  { id: "grosseltern", label: "Großeltern", icon: "👴" },
];

export const CATEGORIES = {
  allgemein: { label: "Allgemeinwissen", icon: "🌍" },
  familie: { label: "Familienfrage", icon: "👨‍👩‍👧" },
  foto: { label: "Fotofrage", icon: "📷" },
};

export const DEFAULT_LADDER = [
  { amount: 50, prize: "", safe: false },
  { amount: 100, prize: "", safe: false },
  { amount: 200, prize: "", safe: false },
  { amount: 300, prize: "", safe: false },
  { amount: 500, prize: "Ein Lob von Opa", safe: true },
  { amount: 1000, prize: "", safe: false },
  { amount: 2000, prize: "", safe: false },
  { amount: 4000, prize: "Eine Kugel Eis", safe: false },
  { amount: 8000, prize: "", safe: false },
  { amount: 16000, prize: "Opa erzählt eine Geschichte von früher", safe: true },
  { amount: 32000, prize: "", safe: false },
  { amount: 64000, prize: "Ein Stück von Omas Kuchen", safe: false },
  { amount: 125000, prize: "Ein Ausflug mit Opa", safe: false },
  { amount: 500000, prize: "Wunschessen, von Opa gekocht/ausgegeben", safe: false },
  { amount: 1000000, prize: "Ein Essen mit der ganzen Familie", safe: false },
];

// Sekunden pro Stufe 1–15
export const DEFAULT_TIMES = [20, 22, 25, 28, 30, 60, 90, 120, 150, 180, 300, 360, 420, 540, 600];

export const OPA_MOMENTS = {
  greeting: "Begrüßung",
  start: "Spielstart",
  correct: "Richtige Antwort",
  wrong: "Falsche Antwort",
  safe: "Sicherheitsstufe erreicht",
  timeout: "Zeit läuft ab",
  quit: "Aufhören",
  million: "Millionengewinn",
};

export const DEFAULT_SAYINGS = {
  greeting: [
    "Schön, dass du da bist! Mach's dir bequem – gleich geht's los.",
    "Na, bereit, deinem Opa zu zeigen, was du drauf hast?",
  ],
  start: [
    "Dann wollen wir mal! Die erste Frage ist ganz entspannt.",
    "Konzentration! Und denk dran: Ich hab alle Zeit der Welt – du nicht.",
  ],
  correct: ["Richtig! Das hätte ich auch gewusst.", "Bravo! Weiter so!", "Sauber! Da ist Opa stolz."],
  wrong: ["Ach herrje … das war leider nix.", "Kopf hoch – beim nächsten Mal klappt's!"],
  safe: ["Sicherheitsstufe! Das kann dir keiner mehr nehmen.", "Gesichert! Jetzt kannst du ganz frei aufspielen."],
  timeout: ["Die Zeit ist um! Schneller denken als Opa beim Zeitunglesen – das üben wir noch."],
  quit: ["Klug aufgehört ist auch gewonnen!", "Wer aufhört, wenn's am schönsten ist, ist ein weiser Mensch."],
  million: ["MILLIONÄR! Ich bin sprachlos – und das passiert nicht oft!"],
};

export const BADGES = {
  millionaer: { icon: "💰", name: "Millionär", desc: "Die 1-Million-Frage richtig beantwortet" },
  wochensieger: { icon: "🏆", name: "Wochensieger", desc: "Eine Woche auf Platz 1 beendet" },
  schnell: { icon: "⚡", name: "Schnellster Denker", desc: "Schnellste Runde der Woche (mind. Stufe 5)" },
  ohnejoker: { icon: "🦸", name: "Ohne Joker durchgekommen", desc: "Mindestens Stufe 10 erreicht – ganz ohne Joker" },
  opaexperte: { icon: "👴", name: "Kennt Opa am besten", desc: "Die meisten richtigen Familienfragen" },
  fotoprofi: { icon: "📸", name: "Fotoalbum-Profi", desc: "Die meisten richtigen Fotofragen" },
  fragenmeister: { icon: "✍️", name: "Fragenmeister", desc: "Die meisten freigegebenen eingereichten Fragen" },
  duellant: { icon: "⚔️", name: "Duell-Sieger", desc: "Ein Duell gewonnen" },
};

export function defaultSettings() {
  return {
    ladder: DEFAULT_LADDER.map((s) => ({ ...s })),
    times: [...DEFAULT_TIMES],
    opa: {
      name: "Opa",
      photo: "icons/opa.svg",
      phone: "",
      signature: "Dein Opa",
      sayings: JSON.parse(JSON.stringify(DEFAULT_SAYINGS)),
      audio: {},
      certSaying: "Ich bin mächtig stolz auf dich!",
    },
    attemptsPerWeek: 0,
    pollSeconds: 60,
    familyCode: "",
    adminPinHash: "",
  };
}

// ------------------------------------------------------------
//  Fragenkatalog (Allgemeinwissen) – 4 Fragen pro Stufe
//  [Stufe, Frage, [A, B, C, D], richtig (0–3), Erklärung]
// ------------------------------------------------------------
const Q = [
  [1, "Wie viele Kerzen braucht ein Kuchen zum 77. Geburtstag, wenn jedes Lebensjahr eine Kerze bekommt?", ["7", "70", "77", "707"], 2, "77 Jahre – 77 Kerzen. Feuerlöscher bereithalten!"],
  [1, "Was macht ein Bäcker?", ["Brot backen", "Schuhe besohlen", "Zähne ziehen", "Haare schneiden"], 0, ""],
  [1, "Welche Farbe hat eine reife Banane normalerweise?", ["Blau", "Gelb", "Lila", "Kariert"], 1, ""],
  [1, "Wo lebt der Eisbär?", ["In der Wüste", "In der Arktis", "Im Regenwald", "Auf dem Mond"], 1, "Eisbären leben rund um den Nordpol."],
  [2, "Wie viele Tage hat eine Woche?", ["5", "6", "7", "8"], 2, ""],
  [2, "Welches Tier legt Eier?", ["Huhn", "Kuh", "Hund", "Katze"], 0, ""],
  [2, "Wie nennt man den Vater des Vaters?", ["Onkel", "Opa", "Cousin", "Neffe"], 1, "Und der hat heute Geburtstag!"],
  [2, "Was braucht man zum Skifahren unbedingt?", ["Schnee", "Sand", "Laub", "Regen"], 0, ""],
  [3, "Wie heißt die Hauptstadt von Deutschland?", ["München", "Hamburg", "Berlin", "Köln"], 2, ""],
  [3, "Wie viele Beine hat eine Spinne?", ["6", "8", "10", "12"], 1, "Insekten haben 6 Beine, Spinnen 8."],
  [3, "Was davon ist kein Obst?", ["Apfel", "Birne", "Kartoffel", "Kirsche"], 2, "Die Kartoffel ist ein Gemüse (eine Knolle)."],
  [3, "In welchem Monat ist Weihnachten?", ["November", "Dezember", "Januar", "Oktober"], 1, ""],
  [4, "Wie viele Spieler einer Mannschaft stehen beim Fußball gleichzeitig auf dem Feld?", ["9", "10", "11", "12"], 2, "Zehn Feldspieler plus Torwart."],
  [4, "Aus welchem Land stammt die Pizza ursprünglich?", ["Frankreich", "Spanien", "Italien", "Griechenland"], 2, "Die Pizza stammt aus Neapel."],
  [4, "Welches ist das größte Tier der Erde?", ["Elefant", "Blauwal", "Giraffe", "Nashorn"], 1, "Blauwale werden über 30 Meter lang."],
  [4, "Wie nennt man das Jubiläum nach 50 Ehejahren?", ["Silberne Hochzeit", "Goldene Hochzeit", "Diamantene Hochzeit", "Eiserne Hochzeit"], 1, "25 Jahre: Silber, 50: Gold, 60: Diamant, 65: Eisern."],
  [5, "Welcher Fluss fließt durch Köln?", ["Elbe", "Donau", "Rhein", "Main"], 2, ""],
  [5, "Wer schrieb den „Faust“?", ["Friedrich Schiller", "Johann Wolfgang von Goethe", "Gotthold Ephraim Lessing", "Heinrich Heine"], 1, ""],
  [5, "Wie viele Bundesländer hat Deutschland?", ["12", "14", "16", "18"], 2, ""],
  [5, "Welche Farbe entsteht, wenn man Blau und Gelb mischt?", ["Grün", "Orange", "Lila", "Braun"], 0, ""],
  [6, "In welchem Jahr fiel die Berliner Mauer?", ["1987", "1989", "1990", "1991"], 1, "Am 9. November 1989."],
  [6, "Welches chemische Zeichen hat Gold?", ["Go", "Gd", "Au", "Ag"], 2, "Vom lateinischen „aurum“. Ag ist Silber."],
  [6, "Wie heißt der höchste Berg Deutschlands?", ["Watzmann", "Zugspitze", "Brocken", "Feldberg"], 1, "Die Zugspitze ist 2.962 Meter hoch."],
  [6, "Welcher Komponist wurde 1770 in Bonn geboren?", ["Mozart", "Bach", "Beethoven", "Brahms"], 2, ""],
  [7, "Wie viele Minuten hat ein Tag?", ["1.240", "1.440", "1.640", "1.840"], 1, "24 × 60 = 1.440"],
  [7, "Welches Land hat die meisten Einwohner?", ["China", "Indien", "USA", "Indonesien"], 1, "Indien hat China 2023 überholt."],
  [7, "Wer war der erste Bundeskanzler der Bundesrepublik Deutschland?", ["Willy Brandt", "Ludwig Erhard", "Konrad Adenauer", "Helmut Schmidt"], 2, "Adenauer regierte von 1949 bis 1963."],
  [7, "Welches Instrument hat normalerweise 88 Tasten?", ["Akkordeon", "Klavier", "Orgel", "Cembalo"], 1, ""],
  [8, "In welchem Jahr wurde die D-Mark in Westdeutschland eingeführt?", ["1945", "1948", "1951", "1957"], 1, "Mit der Währungsreform am 20. Juni 1948."],
  [8, "Welcher Planet ist der größte unseres Sonnensystems?", ["Saturn", "Jupiter", "Neptun", "Uranus"], 1, ""],
  [8, "Wie heißt die Hauptstadt von Australien?", ["Sydney", "Melbourne", "Canberra", "Perth"], 2, ""],
  [8, "Aus wie vielen Karten besteht ein Skatblatt?", ["24", "32", "36", "52"], 1, ""],
  [9, "Welcher Fußballer wurde „Der Kaiser“ genannt?", ["Gerd Müller", "Franz Beckenbauer", "Uwe Seeler", "Fritz Walter"], 1, ""],
  [9, "In welchem Land fand die Fußball-WM 1954 statt („Das Wunder von Bern“)?", ["Schweden", "Schweiz", "Italien", "Frankreich"], 1, "Das Finale wurde in Bern gespielt."],
  [9, "Wie viele Knochen hat ein erwachsener Mensch ungefähr?", ["106", "206", "306", "406"], 1, ""],
  [9, "Welches Gas macht den größten Teil der Luft aus?", ["Sauerstoff", "Kohlendioxid", "Stickstoff", "Argon"], 2, "Etwa 78 % Stickstoff, 21 % Sauerstoff."],
  [10, "In welchem Jahr betraten erstmals Menschen den Mond?", ["1965", "1967", "1969", "1972"], 2, "Apollo 11, Juli 1969."],
  [10, "Welcher Maler schnitt sich einen Teil seines Ohres ab?", ["Claude Monet", "Vincent van Gogh", "Pablo Picasso", "Salvador Dalí"], 1, ""],
  [10, "Wie heißt der längste Fluss Europas?", ["Donau", "Rhein", "Wolga", "Dnepr"], 2, "Die Wolga ist rund 3.500 km lang."],
  [10, "Welche Stadt war Regierungssitz der Bundesrepublik von 1949 bis 1990?", ["Frankfurt", "Bonn", "Köln", "Düsseldorf"], 1, ""],
  [11, "Wie viele Herzen hat ein Oktopus?", ["1", "2", "3", "4"], 2, "Zwei Kiemenherzen und ein Hauptherz."],
  [11, "Welches Element hat die Ordnungszahl 1?", ["Helium", "Wasserstoff", "Lithium", "Sauerstoff"], 1, ""],
  [11, "Wer erfand in Europa den Buchdruck mit beweglichen Lettern?", ["Johannes Gutenberg", "Martin Luther", "Albrecht Dürer", "Johannes Kepler"], 0, "Um 1450 in Mainz."],
  [11, "In welchem Land liegt die Stadt Timbuktu?", ["Niger", "Mali", "Mauretanien", "Tschad"], 1, ""],
  [12, "Wie lange braucht das Sonnenlicht ungefähr bis zur Erde?", ["8 Sekunden", "8 Minuten", "8 Stunden", "8 Tage"], 1, "Genauer: etwa 8 Minuten und 20 Sekunden."],
  [12, "Wer komponierte die Oper „Die Zauberflöte“?", ["Richard Wagner", "Giuseppe Verdi", "Wolfgang Amadeus Mozart", "Joseph Haydn"], 2, ""],
  [12, "Wie heißt der kleinste Staat der Welt?", ["Monaco", "Vatikanstadt", "San Marino", "Liechtenstein"], 1, ""],
  [12, "In welchem Jahr begann der Erste Weltkrieg?", ["1912", "1914", "1916", "1918"], 1, ""],
  [13, "Wie heißt die Hauptstadt von Kanada?", ["Toronto", "Vancouver", "Ottawa", "Montreal"], 2, ""],
  [13, "Wer erhielt 1901 den allerersten Nobelpreis für Physik?", ["Max Planck", "Wilhelm Conrad Röntgen", "Albert Einstein", "Marie Curie"], 1, "Für die Entdeckung der Röntgenstrahlen."],
  [13, "Wie viele Zähne hat ein Erwachsener normalerweise, Weisheitszähne mitgezählt?", ["28", "30", "32", "34"], 2, ""],
  [13, "Welches Land hat – mit seinen Überseegebieten – die meisten Zeitzonen?", ["Russland", "USA", "Frankreich", "China"], 2, "Frankreich kommt dank seiner Überseegebiete auf 12 Zeitzonen."],
  [14, "An welchem Tag wurde das Grundgesetz der Bundesrepublik verkündet?", ["23. Mai 1949", "7. Oktober 1949", "17. Juni 1953", "3. Oktober 1990"], 0, ""],
  [14, "Wie viele Sinfonien hat Beethoven vollendet?", ["5", "7", "9", "11"], 2, ""],
  [14, "Welche ist die größte Insel Deutschlands?", ["Usedom", "Sylt", "Rügen", "Fehmarn"], 2, ""],
  [14, "Wer war 1961 der erste Mensch im Weltall?", ["Neil Armstrong", "Juri Gagarin", "John Glenn", "Sigmund Jähn"], 1, ""],
  [15, "Wie heißt die Hauptstadt der Mongolei?", ["Ulan-Ude", "Ulaanbaatar", "Astana", "Bischkek"], 1, ""],
  [15, "Wie viele Quadrate (aller Größen) gibt es auf einem Schachbrett?", ["64", "128", "204", "256"], 2, "1×1 bis 8×8 zusammengezählt: 64+49+36+25+16+9+4+1 = 204."],
  [15, "Welcher Planet dreht sich am schnellsten um sich selbst?", ["Saturn", "Jupiter", "Merkur", "Mars"], 1, "Ein Jupitertag dauert knapp 10 Stunden."],
  [15, "Wer war der erste Deutsche im Weltall?", ["Ulf Merbold", "Sigmund Jähn", "Thomas Reiter", "Alexander Gerst"], 1, "Sigmund Jähn flog 1978 ins All."],
];

// Vorlagen für Familien- und Fotofragen: liegen in der Prüfliste und
// müssen im Admin-Bereich mit echten Antworten (und Fotos) versehen werden.
const TEMPLATES = [
  [3, "familie", "Was ist Opas Lieblingsessen?"],
  [5, "familie", "Wo hat Opa Oma kennengelernt?"],
  [6, "familie", "Welchen Beruf hat Opa gelernt?"],
  [8, "familie", "In welchem Jahr haben Opa und Oma geheiratet?"],
  [9, "familie", "Welches war Opas erstes Auto?"],
  [11, "familie", "In welcher Stadt ist Opa geboren?"],
  [4, "foto", "Wo wurde dieses Foto aufgenommen?"],
  [7, "foto", "Wie alt ist Opa auf diesem Bild?"],
];

export function defaultQuestions() {
  const now = Date.now();
  const qs = Q.map(([level, text, answers, correct, explanation], i) => ({
    id: "std" + String(i + 1).padStart(3, "0"),
    level, category: "allgemein", text, answers, correct, explanation,
    status: "approved", createdAt: now,
  }));
  TEMPLATES.forEach(([level, category, text], i) => {
    qs.push({
      id: "tpl" + (i + 1),
      level, category, text,
      answers: ["Antwort A – bitte anpassen", "Antwort B – bitte anpassen", "Antwort C – bitte anpassen", "Antwort D – bitte anpassen"],
      correct: 0, explanation: "",
      status: "pending", submittedByName: "Vorlage", createdAt: now,
    });
  });
  return qs;
}
