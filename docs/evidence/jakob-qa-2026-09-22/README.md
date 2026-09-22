# Gemeinsamer QA-Stand für Jakobs Review

Stand: 23. September 2026. **In Arbeit, keine vollständige Abnahme.**

Neu: [Android-Lernzeiten vollständig im Testaccount geprüft](android/README.md)
und [iPhone-Start und Lernzeiten-CRUD](iphone/README.md). Die ältere Android-
Unterbrechung unten ist inzwischen geklärt; der Testalias wurde verifiziert.
iPhone-Lernzeiten-CRUD ist ebenfalls bestanden. Weitere Ende-zu-Ende-Tests bleiben offen.

Aktuelle Ergänzung: [PR #653: exakter iPhone-Vorher-/Nachhervergleich mit
zwei Screenshots und zwei geprüften Aufnahmen](../day-402-iphone-comparison/README.md).
Der iPad-Review-HOLD bleibt offen. Die historischen Abschnitte unten dokumentieren
den damaligen Zustand und sind nicht als aktuelle Android-/iPhone-Sperre zu lesen.

Aktueller Backend-Blocker: Der echte Android-Dateiupload scheiterte in
`learningPlans:generateUploadUrl` an fehlender R2-Konfiguration. Im verwendeten
Development-Backend `trustworthy-skunk-257` wurde nur die Clerk-Variable
nachgewiesen. Zugriff auf das früher dokumentierte `resilient-pika-316` ist nicht
vorhanden. Kein erfolgreicher Upload, Wissenscheck oder vollständiger Lernplan
wird aus den bisherigen Bildern abgeleitet. Kein Production-Deployment erfolgt.

## Herkunft und Grenzen

- QA-Branch: `codex/jakob-qa-integration-20260922`.
- Basis: PR #712, `codex/consolidate-app-work-20260922`, Commit `a90c018`.
- Lokal zusammengeführt: #651, #652, #653, #655, #656, #661, #662, #693,
  #707, #708, #709, #710, #711, #719, #701, #703, #700 und #694.
- Integrations-Merge vor den abschließenden Korrekturen: `5ed05f4d8bff38088769403f2655dbae248a35fc`.
- #698 ist **nicht integriert**: Die ältere native Navigationsänderung kollidiert
  semantisch mit dem neuen Prüfungs-/Lernplan-Ablauf, insbesondere dem durch #651
  entfernten verpflichtenden Lernzeiten-Schritt. Der Merge wurde abgebrochen.
- Keine Zusammenführung nach `main`, kein Production-Deployment und kein OTA-Release.
- Ein gemeinsamer QA-Screenshot ersetzt nicht den angeforderten Vorher-/Nachher-
  Nachweis eines einzelnen PRs. Ältere Nutzerbilder haben keine verifizierte Build-Zuordnung.

## Integrationskorrekturen

- Lernplanübersicht: fehlenden Theme-Zugriff ergänzt.
- Stundenplan: weiterhin verwendeten `cn`-Import wiederhergestellt.
- Destruktive Buttons: roter Hintergrund mit weißer Beschriftung; Test angepasst.
- Extrahierte Wochentagsauswahl: gemeinsame SelectionControl wiederhergestellt,
  einschließlich Checked-Zustand und kontrastreicher Beschriftung.
- Theme-Test an den gemeinsamen Auswahlindikator angepasst; kollidierenden Mock entfernt.
- Zwei ungenutzte ältere native Patch-Dateien entfernt. Aktive SDK-57-Patches bleiben erhalten.

## Automatisierte Prüfung

| Prüfung | Ergebnis |
| --- | --- |
| TypeScript `tsc --noEmit` | bestanden |
| Vitest | 142 Dateien, 974 Tests bestanden |
| Jest native UI | 82 Suites, 370 Tests bestanden |
| Biome lint | bestanden |
| ESLint src/convex/index | bestanden |
| Zusätzliche Node-Skripttests | 21 bestanden; Watcher separat außerhalb Sandbox bestanden |
| `git diff --check` | bestanden |

Der Watcher-Test scheiterte innerhalb der Sandbox mit `EMFILE`; derselbe Test
bestand außerhalb der Sandbox. Diese Einschränkung ist kein bestandener Gerätetest.

## Native Prüfung – noch offen

Dediziertes Gerät: **Dayova Jakob Review iPad**, iPad Pro 11 M4, iOS 26.4.
App-ID: `de.dayova.app-dev`. Lokaler QA-Metro-Port: `8095`.
Backend: Development; Authentifizierung verwendet echte E-Mail-Verifizierung.

Der erste Start des gemeinsamen JavaScript-Stands zeigte:
`Cannot find native module 'ExpoImageManipulator'`.
Der vorhandene Entwicklungsbuild war deshalb nicht als QA-Build geeignet.
Ein neuer lokaler nativer Build mit diesem Modul wurde erfolgreich gebaut
(0 Fehler, 0 Warnungen) und auf dem dedizierten iPad installiert. Nach Verbindung
mit Port 8095 startete die App ohne diesen Fehler; Einstieg und Einstellungen
wurden sichtbar. Das ist noch kein vollständiger Ende-zu-Ende-Test.

| Ablauf | Status / noch nötiger Nachweis |
| --- | --- |
| Start mit passenden nativen Modulen | bestanden: neuer nativer Build, Start und Einstellungen sichtbar |
| Neuer entbehrlicher Testaccount | Testalias im Profil verifiziert; angemeldete Sitzung „Dayova QA Test“ vorhanden. Vollständiger Neunutzer-Nachweis noch offen |
| Onboarding und Standardwerte | Schrittfolge und Screenshots offen |
| Persönliche Fächer anlegen/umbenennen/löschen | iPad bestanden: Eintrag angelegt, umbenannt, bestätigt entfernt; Leerzustand und Abwesenheit des Eintrags per Maestro geprüft. Verknüpfte Einträge und Android noch offen |
| Lernzeiten anlegen/ändern/löschen | iPad, iPhone und Android bestanden: Montag 17:00–17:30 angelegt, auf Dienstag geändert, Löschung abgebrochen und danach bestätigt; Leerzustand und Abwesenheit des Eintrags geprüft. Zeitpicker und Konfliktfälle noch offen |
| Prüfung / Lernplan-Entwurf / Fortsetzen | Geräteprüfung offen |
| Material: Kamera, Galerie, Dateien, Grenzen und Fehlerfälle | Geräteprüfung offen |
| Lernschritt abschließen und wiederholen | Geräteprüfung offen |
| Tastatur, Sheets, Navigation und Abstände | Geräteprüfung offen |
| Theme und Auswahlkontraste | Geräteprüfung offen |
| Abbrechen und bestätigtes Löschen | Geräteprüfung offen |
| Testaccount löschen und Ergebnis prüfen | ausschließlich am entbehrlichen Account, zuletzt |
| Android-Gegenprüfung | Lernzeiten-CRUD bestanden, siehe android/README.md; übrige Abläufe offen. Alte Nutzerbilder bleiben ohne verifizierte Build-Zuordnung |

Keine Passwörter oder Bestätigungscodes in Screenshot-Belege aufnehmen. Den
persönlichen Hauptaccount nicht löschen. Erfolgszustände erst nach beobachtetem
Speicher-/Lösch-Ergebnis dokumentieren, nicht bereits beim Bestätigungsdialog.

### Beobachtete offene Darstellung

Die lange Testalias-Adresse läuft im iPad-Profil in einer zweiten Zeile über den
unteren Rand des E-Mail-Feldes. Sichtbar am 22.09.2026, 22:53 CEST, auf dem
nativen QA-Build; noch nicht behoben. Lokaler Diagnosebeleg (enthält E-Mail,
nicht für ungeprüfte Veröffentlichung): `/private/tmp/dayova-qa-profile-verified.png`.

## iPad-Belege dieses QA-Stands

Aufgenommen am 22.09.2026, ca. 22:51–23:05 CEST, Quellstand `399eee3`.
Die Bilder zeigen den gemeinsamen Stand, **keinen individuellen PR-Vorhervergleich**.
Das graue Zahnrad ist ein Simulator-Overlay. Mehrere Maestro-Textselektoren
trafen gruppierte Elemente nicht; bestätigte Ergebnisse wurden anschließend
mit sichtbaren Trefferpunkten und Ergebnis-Assertions geprüft.

| Zustand | Beleg |
| --- | --- |
| Einstellungen | [Bild](dayova-qa-settings-settled.png) |
| Fächer vorher leer | [Bild](dayova-qa-subjects-open.png) |
| Fach hinzufügen, leerer Dialog | [Bild](dayova-qa-subject-add.png) |
| Angelegt (Testeingabe mit zusätzlichem n durch Testtrefferpunkt) | [Bild](dayova-qa-subject-result.png) |
| Umbenennen-Dialog | [Bild](dayova-qa-rename-dialog.png) |
| Umbenannt auf QA Latein | [Bild](dayova-qa-renamed.png) |
| Swipe-Löschaktion | [Bild](dayova-qa-subject-swipe.png) |
| Bestätigungsdialog | [Bild](dayova-qa-delete-second.png) |
| Nach bestätigter Löschung wieder leer | [Bild](dayova-qa-subject-deleted-final.png) |

Der entbehrliche Testeintrag wurde entfernt und kann bei Bedarf neu angelegt
werden. Der Testaccount selbst und der persönliche Hauptaccount wurden nicht gelöscht.

### Ergänzung: Lernzeiten, 23:19–23:28 CEST

Quellstand `0400c6b`, derselbe QA-Metro auf Port 8095. Die bestätigten Maestro-
Assertions prüfen gespeicherten Wochentag und Uhrzeit sowie den Leerzustand nach
dem Entfernen. Der Abbruch ließ den Editor und den Eintrag bestehen. Entfernt
wurde ausschließlich die in diesem Test angelegte Lernzeit.

| Zustand | Beleg |
| --- | --- |
| Ausgangszustand leer | [Bild](dayova-qa-times-opened.png) |
| Neue Lernzeit | [Bild](dayova-qa-times-add.png) |
| Montag gespeichert | [Bild](dayova-qa-times-list.png) |
| Auf Dienstag geändert; Löschdialog nach Abbruch erneut geöffnet | [Bild](dayova-qa-times-delete-confirm.png) |
| Bestätigt gelöscht | [Bild](dayova-qa-times-deleted.png) |

Der Löschdialog zeigt den roten Bestätigungsbutton mit weißer Beschriftung.
Dies ist ein gemeinsamer iPad-Nachweis, kein isolierter Vorher-/Nachhervergleich
für #711. Der anfangs leere Zustand beweist keine Neunutzer-Standardwerte für #651.

Testwerkzeug-Grenzen: Klicks auf Texte ohne passenden Button-Selektor führten
teilweise nicht zur Navigation. Die erfolgreichen Wiederholungen verwendeten
die vollständigen Accessibility-Labels. Ein Maestro-Treiberstart während der
Android-Kompilierung lief in einen Timeout; der Speichertest bestand danach.
Absolute Screenshot-Pfade wurden von Maestro abgelehnt; die hier verlinkten
Originalbilder wurden mit `simctl io ... screenshot` aufgenommen und visuell geprüft.

Android: Lokaler Entwicklungsbuild erfolgreich (`assembleDebug`, 626 Tasks,
2m 31s), anschließend auf `Dayova_Pixel_9_Android_16` installiert. Die Installation
musste nach dem während des Builds geschlossenen Emulator separat erfolgen.
Nach Weiterleitung von Port 8095 und erneuter Verbindung wurde die Home-Ansicht
sichtbar. Die Sitzung zeigte nicht den auf dem iPad verifizierten QA-Namen.
Zudem wechselte die Ansicht unerwartet bis zu einem Fach-Umbenennen-Dialog;
deshalb wurde die Android-Bedienung zur Klärung paralleler Nutzung pausiert.
Keine Löschung und keine bestätigte Änderung wurden auf Android ausgeführt.
Der Account und angemeldete Ende-zu-Ende-Abläufe sind noch nicht verifiziert;
die Android-Aufnahmen werden nicht als QA-Abnahme veröffentlicht.

GitHub-Prüfung für #720: bisher nur CodeRabbit mit „Review skipped: draft pull
request“. Dies ist keine erfolgreiche vollständige CI-Abnahme.

## Jakobs übrige Punkte

- Vollständige, passend skalierte Vorher-/Nachher-Bilder je betroffenem PR bleiben
  von dieser gemeinsamen Funktionsprüfung getrennt zu verfolgen.
- Review-Bereitschaft je PR ausdrücklich melden; Draft ist nicht review-fertig.
- E-Mail-Antworten und App-Store-Connect-Rechte sind durch dieses QA-Protokoll
  nicht nachgewiesen.
- Noch keine Abschlussmeldung oder Screenshot-Sammlung an Discord versendet.
