# DAY-490: eigenständiges Dashboard auf main

## Ziel und Herkunft

Dieser Branch trennt das neue Heute-Dashboard von der bisherigen QA-PR-Kette.
Basis: `main` bei `8c9ed0cecddf60ad971cd3d5a61821b8271a5e33`.
Quelle des Dashboard-Verhaltens: PR #797 bei
`78e5eaf2fd6b2edfc17f7cbc3b0698e820b51839`, verglichen mit dessen Parent
`2f25ea3a80a72741cb9df34558143fee872a9519` (#780).

Es werden nicht die gesamten historischen Parent-Branches übernommen.
#712, #720, #728, #744, #780, #797 und #798 bleiben unverändert erhalten.
Der neue PR benötigt keinen dieser PRs als Merge-Voraussetzung.

## Enthalten

- Fachbezogene Lernkarte mit Dauer, Datum, Illustration und Start-/Fortsetzen-Aktion.
- Nächster offener Lernschritt ab heute, unabhängig vom ausgewählten Kalendertag,
  ohne 30-Tage-Suchgrenze; paginierte, authentifizierte Convex-Abfrage.
- Synchronisierte Wochen- und Tagesnavigation, feste Wochentagsüberschriften,
  animierte Auswahl und Ereignispunkte auch für abgeschlossene Einträge.
- Kompakte Agenda, Leerzustände, Tageszusammenfassung und Rückwege nach Heute.
- Wiederverwendbare Status-Badges und namensbasierte Fach-Icons.

## Bewusst nicht übernommen

- Routine-Check-in-Popup und dessen separate Backend-Funktionen.
- Analytics- und persönliche-Fächer-Verwaltung aus anderen Parent-PRs.
- Native Runtime-/Dependency-Änderungen aus #798. Die App-Konfiguration bleibt
  auf main. Hinzu kommt ausschließlich die Backend-Migrationskomponente
  `@convex-dev/migrations@0.3.4`, kompatibel mit Convex 1.41.
  Kein Cloud-Build oder OTA wurde veröffentlicht. Backend-Tests und ein Deploy
  erfolgten ausschließlich im isolierten DEV, nicht in Produktion.
- Account-Löschstatus-Guard aus der alten Kette: main hat diesen Guard und sein
  Datenmodell nicht. Die neue Abfrage nutzt main-Authentifizierung und prüft
  sowohl Session- als auch Plan-Eigentum.

Die bestehende main-Prüfungserstellung wird weiterverwendet, einschließlich
`returnTo=/home`. Die Isolierung führt keinen neuen Erstellungs-Flow ein.

## Review und Veröffentlichung

Die freigegebene Heute-Schaltfläche ist eine absichtliche, auf diese
Kalendernavigation begrenzte Ausnahme von den üblichen Pill-Varianten: helle
Oberfläche, schwarze Schrift in Light Mode und passende Dark-Mode-Farben.
Sie ist kein neues allgemeines CTA-Design. Bei vergrößerter Systemschrift
wechseln die sieben Kalenderzellen in lesbare vertikale Tageszeilen mit
Wochentagsnamen; die normale kompakte Wochenansicht bleibt unverändert.

Historische Screenshots/Videos sind im [alten PR #797](https://github.com/Dayova/dayova-mvp/pull/797)
verlinkt. Sie dienen nur als Designreferenz, nicht als Laufzeitnachweis dieses
isolierten Builds. Automatisierte Tests ersetzen keine Geräte-Abnahme.

Vor Veröffentlichung dieses neuen Standes:

- [ ] Frische Light-/Dark-, große-Schrift- und Android-Abnahme auf diesem Branch.
- [ ] Kalendergesten, Tageswechsel, Leerzustände und Rückwege am Gerät prüfen.
- [ ] Neue Convex-Abfrage auf dem vorgesehenen Backend bereitstellen und prüfen,
      bevor der neue Client veröffentlicht wird.
- [ ] CI, CodeRabbit und finalen menschlichen Review des aktuellen Heads prüfen.
- [ ] OTA-Kompatibilität gegen den tatsächlich eingesetzten Build bestimmen.

Es gibt keine Merge- oder OTA-Freigabe allein durch das Herauslösen aus der Kette.

## Datumsindex und sichere Einführung (29. September)

Der bestätigte Full-History-Scan ist behoben: Sessions erhalten einen normalisierten
Berlin-Tag und einen Owner-/Tag-Index. Alle Erstellungs- und Verschiebepfade pflegen
das Feld. Der Client liest ab heute und beendet die Suche nach dem vollständig
gelesenen frühesten geeigneten Tag. Eine 30-Tage-Grenze gibt es weiterhin nicht.

Das Feld bleibt optional. Alte Clients und noch nicht migrierte Nutzer verwenden
den bisherigen paginierten Pfad. `isDayIndexReady` schaltet erst nach vollständiger
Normalisierung des jeweiligen Nutzers auf den Index um. Ungültige Altdaten erhalten
`null`, gültige Offset-Zeitstempel werden auf Europe/Berlin normalisiert; das
ursprüngliche Datum wird nicht verändert.

Reihenfolge für den verantwortlichen Release-Operator:

1. Zieldeployment ausdrücklich prüfen und Backend inklusive Migrationskomponente
   bereitstellen (kein Produktionsauftrag durch diese Dokumentation).
2. `dashboardMigrations:backfillBerlinDayKeys` zunächst mit `{"dryRun":true}` testen.
3. Danach mit `{"dryRun":false}` über die Migrationskomponente ausführen und den
   Abschluss aller Batches prüfen; bei Fehlern fortsetzen, nicht Daten überschreiben.
4. Fehlende Indexfelder und Readiness prüfen, anschließend Client freigeben.

Im isolierten DEV `beloved-crane-533` wurde der Backfill abgeschlossen: vier
synthetische Sessions, keine fehlenden Indexfelder, Readiness `true`.
Produktion wurde nicht migriert. Der automatisierte Migrationstest prüft mehrere
Batches mit 105 Einträgen, ungültige Datumswerte und Wiederholbarkeit.

## Ergänzende QA und verbleibende Abnahme

- [x] Regression mit 320 vergangenen Sessions: vor dem Fix fehlgeschlagen,
      anschließend erfolgreich; die erste Indexseite erreicht direkt heute.
- [x] Backend-Gesamtsuite: 920 Tests / 129 Dateien; UI-Gesamtsuite:
      350 Tests / 78 Suites. Zusätzlich neuer Hook-Test für Mitternacht und
      Monatswechsel erfolgreich. TypeScript, ESLint, Biome und Diff-Check geprüft.
- [x] Unabhängige Standards- und Spec-Code-Reviews: keine offenen Code-Findings.
- [x] iOS-Leerzustände, Morgen, Datum außerhalb von 30 Tagen, Kalenderauswahl und
      Rückwege im isolierten DEV geprüft; keine echten Lerndaten verändert.
- [x] Android: Agenda → Plan → Zurück sowie obere Karte → Übung → Zurück geprüft.
      KI-Einwilligung wurde abgelehnt, nicht stellvertretend erteilt.
- [x] Android Light/Dark sowie Systemschrift 1,5 geprüft; iOS Light/Dark geprüft.
- [ ] Abschließende Animationsevidenz auf dem finalen Stand: iOS-Testclient zeigte
      beim erneuten Start nur eine weiße Fläche. Die beiden Aufnahmeversuche sind
      deshalb **keine** gültige Kalender-Animationsevidenz. Ursache nicht bestätigt.
- [ ] Abschließende große-Schrift-Abnahme wiederholen: ein früherer iOS-Durchlauf
      zeigte vorübergehend abgeschnittenen Header, nach Neustart nicht reproduziert.
      Dies ist keine bestätigte Fehlerbehebung.
- [ ] Aktuellen Head durch CI, CodeRabbit, OTA-Kompatibilitätsreport und Jakob
      prüfen lassen. Frühere grüne Checks gelten nicht für spätere Commits.

Die generische Codeprüfung ersetzt keine separate Produktqualitätsabnahme.
Simulator-/Entwicklungsclient-Tests belegen keine Release-Framerate.
