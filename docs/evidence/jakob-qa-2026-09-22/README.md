# Gemeinsamer QA-Stand für Jakobs Review

Stand: 22. September 2026. **In Arbeit, keine vollständige Abnahme.**

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
Der vorhandene Entwicklungsbuild ist deshalb nicht als funktionierender QA-Build
abgenommen. Ein neuer lokaler nativer Build mit diesem Modul wurde gestartet.

| Ablauf | Status / noch nötiger Nachweis |
| --- | --- |
| Start mit passenden nativen Modulen | neuer Build und erneuter Start offen |
| Neuer entbehrlicher Testaccount | Registrierung/Verifizierung offen |
| Onboarding und Standardwerte | Schrittfolge und Screenshots offen |
| Persönliche Fächer anlegen/umbenennen/löschen | Geräteprüfung offen |
| Lernzeiten anlegen/ändern/löschen | Geräteprüfung offen |
| Prüfung / Lernplan-Entwurf / Fortsetzen | Geräteprüfung offen |
| Material: Kamera, Galerie, Dateien, Grenzen und Fehlerfälle | Geräteprüfung offen |
| Lernschritt abschließen und wiederholen | Geräteprüfung offen |
| Tastatur, Sheets, Navigation und Abstände | Geräteprüfung offen |
| Theme und Auswahlkontraste | Geräteprüfung offen |
| Abbrechen und bestätigtes Löschen | Geräteprüfung offen |
| Testaccount löschen und Ergebnis prüfen | ausschließlich am entbehrlichen Account, zuletzt |
| Android-Gegenprüfung | offen; vorhandene alte Bilder sind kein Nachweis dieses QA-Stands |

Keine Passwörter oder Bestätigungscodes in Screenshot-Belege aufnehmen. Den
persönlichen Hauptaccount nicht löschen. Erfolgszustände erst nach beobachtetem
Speicher-/Lösch-Ergebnis dokumentieren, nicht bereits beim Bestätigungsdialog.

## Jakobs übrige Punkte

- Vollständige, passend skalierte Vorher-/Nachher-Bilder je betroffenem PR bleiben
  von dieser gemeinsamen Funktionsprüfung getrennt zu verfolgen.
- Review-Bereitschaft je PR ausdrücklich melden; Draft ist nicht review-fertig.
- E-Mail-Antworten und App-Store-Connect-Rechte sind durch dieses QA-Protokoll
  nicht nachgewiesen.
- Noch keine Abschlussmeldung oder Screenshot-Sammlung an Discord versendet.
