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
- Native Runtime-/Dependency-Änderungen aus #798. `package.json`, Lockfile und
  App-Konfiguration bleiben auf main. Kein Cloud-Build, OTA oder Deploy erfolgt.
- Account-Löschstatus-Guard aus der alten Kette: main hat diesen Guard und sein
  Datenmodell nicht. Die neue Abfrage nutzt main-Authentifizierung und prüft
  sowohl Session- als auch Plan-Eigentum.

Die bestehende main-Prüfungserstellung wird weiterverwendet, einschließlich
`returnTo=/home`. Die Isolierung führt keinen neuen Erstellungs-Flow ein.

## Review und Veröffentlichung

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
