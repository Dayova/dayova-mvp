/** Optional instruction templates, not inferred exam rules or additional topics.
 * Topic keys are normalized word prefixes. Keep them specific to avoid accidental
 * matches (e.g. "genetik", not "gen"). Labels are the only persisted values.
 */
type HintGroup = {
	subjects: readonly string[];
	topics: readonly string[];
	hints: readonly string[];
};
const group = (subjects: string, topics: string, hints: string): HintGroup => ({
	subjects: subjects.split("|"),
	topics: topics ? topics.split("|") : [],
	hints: hints.split("|"),
});

export const examHintCatalog: readonly HintGroup[] = [
	group(
		"Mathematik",
		"",
		"Ohne Taschenrechner|Lösungsweg angeben|Ohne Hilfsmittel|Formelsammlung erlaubt|Ergebnisse exakt angeben|Ergebnisse runden|Probe durchführen",
	),
	group(
		"Mathematik",
		"bruch|brüch|prozent|dreisatz|zins",
		"Brüche vollständig kürzen|Gemeinsamen Nenner angeben|Zwischenschritte beim Umformen zeigen|Prozentwerte mit Bezugsgröße angeben",
	),
	group(
		"Mathematik",
		"gleichung|quadratisch|linear|polynom|nullstell",
		"Alle Lösungen angeben|Lösungsmenge angeben|Verwendetes Lösungsverfahren benennen|Definitionsmenge beachten",
	),
	group(
		"Mathematik",
		"funktion|parabel|quadratisch|exponential|logarithm",
		"Funktionsgraphen beschriften|Achsen und Maßstab angeben|Eigenschaften am Graphen begründen|Parameter im Sachzusammenhang deuten",
	),
	group(
		"Mathematik",
		"ableitung|differential|kurvendiskussion|extrem|analysis",
		"Ableitungsregeln benennen|Extremstellen rechnerisch nachweisen|Randwerte berücksichtigen|Ergebnisse im Sachzusammenhang deuten",
	),
	group(
		"Mathematik",
		"integral|stammfunktion|flächenberechnung",
		"Integrationsgrenzen angeben|Stammfunktion angeben|Flächeninhalt und Integral unterscheiden|Integrationskonstante berücksichtigen",
	),
	group(
		"Mathematik",
		"geometrie|vektor|dreieck|trigonometrie|kreis|körper",
		"Skizzen beschriften|Verwendete Formel angeben|Winkel mit Einheit angeben|Längen und Flächen mit Einheit angeben",
	),
	group(
		"Mathematik",
		"vektor|gerade|ebene|skalarprodukt",
		"Vektoren mit Koordinaten angeben|Lagebeziehungen begründen|Parameterlösungen prüfen",
	),
	group(
		"Mathematik",
		"stochastik|wahrscheinlichkeit|baumdiagramm|binomial|kombinatorik",
		"Baumdiagramm beschriften|Ereignisse definieren|Wahrscheinlichkeiten als Bruch angeben|Unabhängigkeit begründen",
	),
	group(
		"Mathematik",
		"statistik|mittelwert|standardabweichung|hypothesentest",
		"Statistische Kenngrößen deuten|Hypothesen formulieren|Signifikanzniveau angeben|Testentscheidung im Kontext erklären",
	),
	group(
		"Deutsch",
		"",
		"Textbelege mit Zeilenangaben|Im Präsens schreiben|Nur die behandelten Kapitel|Direkte und indirekte Zitate kennzeichnen",
	),
	group(
		"Deutsch",
		"gedicht|lyrik|ballade|sonett",
		"Versangaben verwenden|Reimschema und Metrum benennen|Sprachliche Mittel mit Wirkung erklären|Deutungshypothese formulieren",
	),
	group(
		"Deutsch",
		"roman|novelle|kurzgeschichte|erzähl|epik|lektüre",
		"Erzählperspektive berücksichtigen|Figurencharakterisierung mit Textbelegen|Inhalt knapp zusammenfassen|Erzählzeit und erzählte Zeit unterscheiden",
	),
	group(
		"Deutsch",
		"drama|szenen|dialog|theater",
		"Szene in den Handlungsverlauf einordnen|Gesprächsverlauf untersuchen|Regieanweisungen berücksichtigen",
	),
	group(
		"Deutsch",
		"erörter|argument|sachtext|rede|rhetor",
		"Argumente mit Beispielen stützen|Gegenargumente berücksichtigen|Eigene Position begründen|Intention und Adressaten berücksichtigen",
	),
	group(
		"Deutsch",
		"grammatik|satzglied|rechtschreib|komma",
		"Grammatische Fachbegriffe verwenden|Satzglieder markieren|Rechtschreibregeln begründen",
	),
	group(
		"Englisch|Französisch|Spanisch|Latein",
		"",
		"Nur das behandelte Vokabular|In vollständigen Sätzen antworten|Wörterbuch erlaubt|Textbelege angeben",
	),
	group(
		"Englisch|Französisch|Spanisch",
		"grammar|grammatik|tense|zeitform|past|present|subjonctif|subjuntivo",
		"Vorgegebene Zeitform verwenden|Signalwörter beachten|Grammatikregel erläutern",
	),
	group(
		"Englisch|Französisch|Spanisch",
		"essay|comment|writing|schreiben|analyse|analysis|lettre",
		"Vorgegebene Wortzahl einhalten|Textsortenmerkmale beachten|Passendes Sprachregister verwenden|Absätze sinnvoll gliedern",
	),
	group(
		"Englisch|Französisch|Spanisch",
		"mediation|sprachmittlung|übersetz|translation",
		"Sinngemäß statt wörtlich übertragen|Nur relevante Informationen übertragen|Adressatenbezug beachten",
	),
	group(
		"Englisch|Französisch|Spanisch",
		"listening|hörverstehen|compréhension|comprension",
		"Antworten in Stichpunkten|Schlüsselwörter notieren",
	),
	group(
		"Latein",
		"übersetz|caesar|cicero|ovid|ablativ|aci|grammatik",
		"Satzkonstruktionen markieren|Tempus und Modus bestimmen|Übersetzungsentscheidungen begründen|Kasusfunktionen benennen",
	),
	group(
		"Physik|Chemie",
		"",
		"Einheiten angeben|Rechenweg angeben|Formeln vor dem Einsetzen umstellen|Messwerte sinnvoll runden",
	),
	group(
		"Physik",
		"mechanik|kraft|bewegung|energie|impuls|kinematik",
		"Kräfte in einer Skizze einzeichnen|Vorzeichenkonvention angeben|Energieansatz begründen|Diagrammachsen mit Einheiten beschriften",
	),
	group(
		"Physik",
		"elektr|strom|spannung|widerstand|schaltung",
		"Schaltplan mit Symbolen zeichnen|Stromrichtung kennzeichnen|Messgeräte richtig einzeichnen|Reihen- und Parallelschaltung unterscheiden",
	),
	group(
		"Physik",
		"optik|licht|linse|welle|schwingung",
		"Strahlengang mit Lineal zeichnen|Winkel zum Lot messen|Wellenlänge und Frequenz mit Einheiten angeben",
	),
	group(
		"Physik",
		"wärme|thermo|gas|temperatur",
		"Temperaturen in Kelvin einsetzen|Systemgrenzen angeben|Wärmeverluste berücksichtigen",
	),
	group(
		"Chemie",
		"reaktion|stöchiometrie|stoffmenge|mol",
		"Reaktionsgleichungen ausgleichen|Aggregatzustände angeben|Stoffmengenverhältnis angeben|Teilchen- und Stoffebene unterscheiden",
	),
	group(
		"Chemie",
		"säure|base|ph|titration|redox|elektrochem",
		"Ladungen vollständig angeben|Teilgleichungen aufstellen|Oxidationszahlen bestimmen|Reaktionsbedingungen nennen",
	),
	group(
		"Chemie",
		"organisch|alkan|alken|alkohol|ester|polymer",
		"Strukturformeln zeichnen|Funktionelle Gruppen markieren|Stoffe systematisch benennen|Reaktionsmechanismus mit Elektronenpfeilen darstellen",
	),
	group(
		"Biologie",
		"",
		"Fachbegriffe verwenden|Abbildungen beschriften|Bau und Funktion verknüpfen|Beobachtung und Erklärung trennen",
	),
	group(
		"Biologie",
		"genetik|vererbung|dna|rna|proteinbiosynthese|mendel",
		"Kreuzungsschema angeben|Genotyp und Phänotyp unterscheiden|Basensequenzen mit Leserichtung angeben|Erbgang begründen",
	),
	group(
		"Biologie",
		"ökologie|ökosystem|nahrung|population|evolution|selektion",
		"Ursache-Wirkungs-Beziehungen erklären|Nahrungsnetz mit Pfeilrichtung zeichnen|Anpassung mit Selektionsvorteil begründen|Abiotische und biotische Faktoren unterscheiden",
	),
	group(
		"Biologie",
		"zelle|zellbiologie|mitose|meiose|stoffwechsel|photosynthese|enzym",
		"Zellbestandteile beschriften|Prozessschritte in richtiger Reihenfolge erklären|Stoff- und Energieflüsse unterscheiden|Versuchsergebnisse mit Kontrollansatz vergleichen",
	),
	group(
		"Geschichte",
		"",
		"Quellenbelege angeben|Historischen Kontext einordnen|Sachurteil und Werturteil trennen|Fachbegriffe und Jahreszahlen verwenden",
	),
	group(
		"Geschichte",
		"quelle|revolution|krieg|nationalsozial|weimar|kaiserreich|antike",
		"Autor und Adressaten der Quelle berücksichtigen|Quellenart und Intention benennen|Perspektive der Quelle kritisch prüfen|Ursachen und Folgen unterscheiden",
	),
	group(
		"Geografie|Geographie",
		"",
		"Atlas erlaubt|Kartenlegende beachten|Räume genau verorten|Materialbelege angeben",
	),
	group(
		"Geografie|Geographie",
		"klima|wetter|vegetation|ökosystem",
		"Klimadiagramme mit Einheiten auswerten|Jahreszeiten und Hemisphäre beachten|Klima und Vegetation verknüpfen",
	),
	group(
		"Geografie|Geographie",
		"stadt|bevölkerung|migration|globalisierung|wirtschaft",
		"Räumliche Maßstabsebenen unterscheiden|Statistiken mit Bezugsjahr auswerten|Ökologische, ökonomische und soziale Folgen abwägen",
	),
	group(
		"Politik|Gesellschaftskunde|Politische Bildung",
		"",
		"Politische Fachbegriffe verwenden|Positionen mit Materialbelegen darstellen|Urteil anhand klarer Kriterien begründen",
	),
	group(
		"Politik|Gesellschaftskunde|Politische Bildung",
		"demokratie|wahl|verfassung|grundrecht|europa",
		"Institutionen und Zuständigkeiten unterscheiden|Grundgesetzartikel angeben|Interessen verschiedener Akteure berücksichtigen",
	),
	group(
		"Wirtschaftskunde",
		"",
		"Rechenweg angeben|Geldbeträge mit Währung angeben|Ergebnisse wirtschaftlich deuten",
	),
	group(
		"Wirtschaftskunde",
		"buchhaltung|buchung|bilanz|inventur|rechnungswesen",
		"Buchungssätze mit Kontonummern angeben|Soll und Haben kennzeichnen|Kontenrahmen verwenden|Umsatzsteuer gesondert ausweisen",
	),
	group(
		"Wirtschaftskunde",
		"kosten|kalkulation|deckungsbeitrag|break|gewinn",
		"Fixe und variable Kosten trennen|Kalkulationsschema einhalten|Zwischenergebnisse ausweisen|Mengen- und Geldeinheiten unterscheiden",
	),
	group(
		"Wirtschaftskunde",
		"markt|angebot|nachfrage|inflation|konjunktur",
		"Modellannahmen nennen|Angebots- und Nachfragekurven beschriften|Kurzfristige und langfristige Folgen unterscheiden",
	),
	group(
		"Recht",
		"",
		"Gesetzestexte erlaubt|Paragraphen vollständig zitieren|Tatbestandsmerkmale prüfen|Gutachtenstil verwenden",
	),
	group(
		"Informatik",
		"",
		"Vorgegebene Programmiersprache verwenden|Variablen verständlich benennen|Lösung mit Testfällen prüfen",
	),
	group(
		"Informatik",
		"algorithm|programmier|schleife|rekursion|sortier",
		"Pseudocode verwenden|Randfälle berücksichtigen|Laufzeit begründen|Algorithmus schrittweise nachvollziehen",
	),
	group(
		"Informatik",
		"datenbank|sql|relation|normalisierung",
		"SQL-Abfragen angeben|Primär- und Fremdschlüssel kennzeichnen|ER-Diagramm mit Kardinalitäten zeichnen|Normalformen begründen",
	),
	group(
		"Informatik",
		"netzwerk|protokoll|verschlüssel|datenschutz",
		"Protokollschichten unterscheiden|Datenfluss schematisch darstellen|Sicherheitsmaßnahmen begründen",
	),
	group(
		"Kunst",
		"",
		"Bildbelege angeben|Komposition skizzieren|Fachbegriffe zur Bildgestaltung verwenden",
	),
	group(
		"Kunst",
		"bildanalyse|malerei|perspektive|farbe|komposition",
		"Beschreibung und Deutung trennen|Farbwirkung begründen|Perspektive und Fluchtpunkte kennzeichnen|Werk in seine Epoche einordnen",
	),
	group(
		"Musik",
		"",
		"Taktangaben verwenden|Musikalische Fachbegriffe verwenden|Notenbeispiele angeben",
	),
	group(
		"Musik",
		"harmonie|akkord|tonart|rhythm|sonate|analyse",
		"Tonart und Taktart bestimmen|Akkorde mit Umkehrungen benennen|Formteile kennzeichnen|Rhythmuswerte vollständig notieren",
	),
	group(
		"Sport",
		"",
		"Bewegungsphasen beschreiben|Sportartspezifische Fachbegriffe verwenden|Sicherheitsaspekte berücksichtigen",
	),
	group(
		"Sport",
		"training|ausdauer|kraft|koordination|bewegung",
		"Belastungsnormative angeben|Trainingsprinzipien begründen|Bewegungsablauf mit Skizze erklären",
	),
	group(
		"Religion|Ethik|Philosophie",
		"",
		"Begriffe präzise definieren|Positionen voneinander abgrenzen|Eigene Bewertung begründen",
	),
	group(
		"Religion|Ethik|Philosophie",
		"ethik|moral|kant|utilitar|gerechtigkeit|freiheit",
		"Ethische Prinzipien auf den Fall anwenden|Gegenposition berücksichtigen|Argumentation auf Widersprüche prüfen",
	),
	group(
		"Religion",
		"bibel|gleichnis|religion|gott|jesus",
		"Textstellen belegen|Historischen und religiösen Kontext beachten|Deutung von persönlicher Bewertung trennen",
	),
];
