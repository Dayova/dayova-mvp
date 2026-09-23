# Native Navigation: ergänzender Abschlussnachweis

Getesteter Code: `6aaba8bdedb5f723d7705d53aaed79282c1451ce`, QA-Integration,
23.09.2026. Entwicklungsclient, keine Production-/OTA-Abnahme.

Der reproduzierbare [Maestro-Ablauf](flow.yaml) öffnet eine neue Prüfung mit
Klausur / Chemie und navigiert vom Datum zurück. Es wird keine Prüfung gespeichert.

| Gerät | Aufnahme | Ergebnis |
| --- | --- | --- |
| iPad | [Video](ipad/navigation.mp4), [Fach](ipad/retained-subject.png), [Prüfungsart](ipad/retained-exam-type.png), [Root-Exit](ipad/root-exit.png) | Teilweise iOS-Randgeste abgebrochen; Datum bleibt. Vollständige Randgeste zeigt Fach statt Home. Chemie und Klausur bleiben ausgewählt. Home erst nach Verlassen des ersten Schritts. |
| iPhone | [Video](iphone/navigation.mp4), [Fach](iphone/retained-subject.png), [Prüfungsart](iphone/retained-exam-type.png), [Root-Exit](iphone/root-exit.png) | Dieselben Assertions bestanden. |
| Android | [Video](android/navigation.mp4), [Fach](android/retained-subject.png), [Prüfungsart](android/retained-exam-type.png), [Root-Exit](android/root-exit.png) | System-Back Datum → Fach; anschließend Header-Zurück → Prüfungsart → Home. Auswahl bleibt erhalten. Keine Aussage über Predictive-Back-Gesten. |

## Sichtprüfung der vollständigen Zeitleisten

Alle Contact Sheets und relevante Einzelbilder wurden geprüft. Keine Audiospur,
keine Transkription. Sampling kann kurze Effekte zwischen zwei Bildern nicht
ausschließen; dies ist keine Frame-für-Frame-Zertifizierung.

- iPad: 2–3 s zeigt die Teilgeste das Fach hinter dem Datum; 3,5–5 s wieder Datum;
  5,5 s Übergang zum Fach; 6–8,5 s Chemie ausgewählt; 9–10,5 s Klausur ausgewählt;
  ab 11 s Übergang zu Home.
  Coverage: 12.47-second video; 24 full-timeline frames sampled at 2 fps (0.5-second interval); 2 contact sheet(s); no audio stream.
- iPhone: 2,5–3,5 s Fach hinter Datum; 4–4,5 s Datum nach Abbruch; 5 s Übergang
  zum Fach; 5,5–7,5 s Chemie; 8,5–9,5 s Klausur; 10–10,5 s Home.
  Coverage: 10.98-second video; 22 full-timeline frames sampled at 2 fps (0.5-second interval); 2 contact sheet(s); no audio stream.
- Android: 0 s Datum; 0,5–3 s Fach mit Chemie; 3,5–5,5 s Klausur;
  6 s Übergang zu Home. Abschließendes Still und Maestro-Assertion belegen Home.
  Coverage: 6.60-second video; 13 full-timeline frames sampled at 2 fps (0.5-second interval); 1 contact sheet(s); no audio stream.

Alle drei Maestro-Läufe bestanden. Beim iPad meldete das nachgelagerte Beenden
des Test-Runners einen SpringBoard-Cleanup-Fehler (Code 64), nachdem Assertions
und Recording abgeschlossen waren; nicht als App-Crash klassifiziert.
Ein erster iPhone-Versuch stand auf SpringBoard und war ungültig. Der dokumentierte
Wiederholungslauf startet die App ausdrücklich und bestand vollständig.
Zusätzlich bestanden die zwei gezielten Navigations-Test-Suites mit 17 Tests.

## Reichweite

Ergänzt [den kombinierten Test](../combined-native-retest-2026-09-23/README.md)
für #698 / #722 / #720. Kein isolierter Vorher-/Nachher-Vergleich aller PRs.
Ein OS-killed Deep Link muss weiterhin mit einem geeigneten Preview-/Release-Build
geprüft werden. Quiz, Upload, Kontolöschung und Hausaufgaben sind durch diesen
Prüfungs-Navigationstest nicht abgenommen.
Weitere Anforderungen: [PR-Matrix](../jakob-review-map-2026-09-23.md).
