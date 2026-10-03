# PR 813: endliche Lernplanung mit flexiblen Terminen

Stand: 03.10.2026. Spezifikation: [PR 813](https://github.com/Dayova/dayova-mvp/pull/813), Philipps Entscheidungen im zugehörigen Chat. Diese Datei beschreibt Implementierung und Abnahme; sie ersetzt keine allgemeinen Produkt-/Notion-Unterlagen.

## Entscheidung und UI

Schüler sollen nach einem kurzen Wissenscheck einen verständlichen Plan übernehmen und unmittelbar lernen können. Priorität: ungefähres Vorbereitungsbudget → passende Themen → konkrete editierbare Termine → Übernehmen. Keine wiederholte Verfügbarkeitsabfrage. Bevorzugte Onboarding-Zeiten bilden Vorschläge; Zusatztermine bleiben ausschließlich in diesem Prüfungsplan.

Die Übersicht verwendet eine blaue Uhr, eine motivierende Überschrift und datierte Zeilen im vorhandenen Lernzeitenstil. Lange Pläne werden nach Wochen gruppiert. Stift und Hinzufügen öffnen den gemeinsamen DayovaSheetFrame; Tag, Beginn und Ende verwenden die vorhandene native DateTimePickerSheet. Kurze Beschriftungen: Übernehmen, Speichern, Hinzufügen, Starten. Freiwilliges Weiterlernen verwendet den ausdrücklich gewünschten Button „Lerneinheit erstellen“.

## Feste Richtwerte, Version 1

| Prüfungsart | Vorbereitung je Prüfung/Fach | Vorschlagszeitraum vor Prüfung |
| --- | --- | --- |
| Test, Kurzkontrolle, Leistungskontrolle, Quiz | 60 Minuten | 7 Tage |
| Klassenarbeit | 180 Minuten | 14 Tage |
| Klausur | 240 Minuten | 21 Tage |
| Mündliche Prüfung | 120 Minuten | 14 Tage |
| Präsentation | 240 Minuten | 21 Tage |
| Vorabitur | 720 Minuten | 42 Tage |
| Abitur, auch mündliches Abitur | 1800 Minuten | 112 Tage |
| Eigene/sonstige Prüfungsart | 120 Minuten | 14 Tage |

Dies sind explizite Produktdefaults, keine wissenschaftlich gemessene Lernzeit und keine Notengarantie. Fünf Antworten steuern Stärken/Schwächen, Inhalte und Reihenfolge; auch fünf richtige Antworten verändern das Budget nicht. Individuelle Zielnoten und eine nachgewiesene bedarfsabhängige Zeitkalibrierung sind nicht Teil dieser Version.

## Zustände und Invarianten

- Diagnostic: bereits erzeugte fünf Fragen werden ohne weiteren KI-Kalenderaufruf vorbereitet; jetzt beginnen oder einen Termin bestätigen.
- Review: nach Abschluss zeigt die neue Route `/learning-plans/[planId]/preparation` die Terminübersicht. Wiederaufruf führt zurück in diese Prüfung.
- Ready: eine atomare Übernahme erzeugt endliche kleine Schritte (normal zehn Minuten, Rest ggf. fünf). Ein Kalendertermin pro Lerntag/Zeitblock, nicht pro Schritt. Genau ein nächster erforderlicher Schritt ist committed; begonnene Arbeit hat Vorrang.
- Preferred days first; zusätzliche Tage übernehmen eine vertraute Uhrzeit. Persönliche längere Fenster bleiben nutzbar, weitere Pläne/Unterricht werden auf Konflikte geprüft. Unzureichende Kapazität wird ehrlich angezeigt und nicht auf den letzten Tag zusammengepresst.
- Ohne Vorschlag bleibt „Jetzt lernen“ möglich, selbst am Prüfungstag. Der gesamte Richtwert wird in endliche, nicht terminierte Schritte aufgeteilt. Keine erfundenen Kalendertermine; Termine können später ergänzt werden.
- Änderungen bewahren abgeschlossene/gerade laufende Arbeit. Nach einem teilweise erledigten Lerntag lässt sich dessen verbleibende Zeit verschieben. Bereits erledigte Schritte werden nicht nochmals gezählt.
- Versionierung verhindert Überschreiben einer parallel geänderten Planung. Kalenderkonflikte und Änderungen erfolgen transaktional.
- Höchstens 180 bearbeitbare Terminblöcke und 60 Stunden pro Übernahme; einschließlich bestehender Historie höchstens 500 erforderliche Schritte. Dadurch können begrenzte Datenbankabfragen keine noch offenen Schritte beim Abschluss übersehen.
- Completed: keine automatisch neu entstehenden Pflichtschritte. Zusätzliche Einheiten nach Themenwahl sind beliebig wiederholbar, ohne Kalenderpflicht. Doppeltippen erstellt keine doppelte offene freiwillige Einheit. Übersicht liest die neuesten Einheiten; älterer Verlauf ist auf 500 angezeigte Schritte begrenzt.
- Alte Pläne bleiben kompatibel; „Plan übernehmen“ bietet dort keine wirkungslose Terminwahl an. Keine automatische Migration alter Lernwege.

## Automatisierte Absicherung

Neue Regressionen umfassen feste Budgets unabhängig vom Wissensstand, langfristige Abiturverteilung, freie Zusatztermine, Zeit-/Datums-/DST-Grenzen, vollständige persönliche Zeitfenster, Eigentümergrenzen, konkurrierende Pläne, atomare Übernahme, ein Kalenderereignis pro Zeitblock, frühes Lernen, endlichen Abschluss, freiwillige Wiederholung, Wiederaufnahme, Verschiebung restlicher Zeit, genau einen nächsten Schritt, unmittelbaren Einstieg ohne Termine sowie große Pläne und deren vollständige Löschung.

Standards- und Spec-Review unabhängig durchgeführt. Sämtliche darin bestätigten Blocker behoben; letzte Begrenzungsprüfung durch Regression abgesichert. TypeScript, ESLint der Änderungen, Biome und `git diff --check` geprüft. Vollständiger Vitest-Lauf: 1.024/1.024 bestanden; anschließend ein zusätzlicher Erhaltungs-Regressionstest ergänzt, betroffener Block 13/13 bestanden. Vollständiger Jest-Lauf: 408/408 bestanden; anschließend zwei zusätzliche Navigationstests 2/2 bestanden. Insgesamt 1.025 Unit- und 410 UI-Tests.

## Lokaler Teststand

- Arbeitsverzeichnis: `/Users/philipp/.codex/worktrees/learning-plan-scheduling/dayova-mvp`
- Metro: `http://127.0.0.1:8083`, eigener Prozess mit geleertem Cache; Entwicklungs-App `de.dayova.app-dev`.
- Backend: ausschließlich `local-anonymous anonymous-agent`, `http://127.0.0.1:3230`. Kein Produktionsdeployment und kein Merge.
- Separater Simulator: **Dayova PR 813 Lernplanung**, iPhone 17 Pro / iOS 26.4, UUID `B240CC0C-9883-4E16-86C5-1FD0607A1080`.
- Öffnen: `xcrun simctl openurl B240CC0C-9883-4E16-86C5-1FD0607A1080 'exp+dayova://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8083'`
- Anmeldung im separaten Simulator noch erforderlich. CoreSimulator ist vorhanden, das Desktop-Fenster `Simulator.app` fehlt in dieser Xcode-Installation. Keine Benutzerkonten/Schlüssel aus anderen Simulatoren kopiert.
- Vier lokale Beispiele im vorhandenen Testkonto: noch offener Wissenscheck, normale Prüfung mit drei Stunden Vorbereitung, Abitur mit 30 Stunden, abgeschlossener Testplan. Die mathematischen Fragen und Abschlüsse wurden ausdrücklich als Testdaten vorbereitet; sie sind kein Beleg echter KI-Generierung oder einer durchgespielten Lernsession.
- Lokalem Backend fehlt `GOOGLE_VERTEX_API_KEY`. Transfer aus persönlichem Dev-Backend wurde von automatischer Freigabeprüfung abgelehnt; explizite Zustimmung steht aus. Kein Schlüssel übertragen. Neue KI-Inhalte daher noch nicht Ende-zu-Ende geprüft.

## Manuelle Abnahme für Philipp

1. Anmelden, neuen Plan erstellen: Prüfungsarten einschließlich Vorabitur/Abitur prüfen. Für echten Neuaufbau ist der KI-Zugang nötig; alternativ vorbereiteten Wissenscheck verwenden.
2. Wissenscheck jetzt starten oder Termin wählen. Mit fünf Antworten abschließen. Ergebnis/Schwerpunkte erscheinen über dem unveränderten Zeitrichtwert.
3. Termin am Stift öffnen, Tag/Beginn/Ende ändern; Hinzufügen und Entfernen prüfen. Übersicht übernimmt gemeinsam; reguläre Lernzeiten bleiben unverändert.
4. Lernweg sofort vor dem Termin beginnen. Drei kleine Schritte entsprechen z. B. 30 Minuten. Nach dem ersten Abschluss restliche 20 Minuten verschieben; keine Duplikate im Kalender.
5. Abiturbeispiel: Termine über mehrere Wochen, vertraute Uhrzeiten, keine künstliche letzte Woche mit 30 Stunden. Bei später Anmeldung geringere verfügbare Zeit klar anzeigen.
6. Ohne zukünftiges Zeitfenster: Jetzt lernen. Kein künstlicher Termin und kein Warten bis morgen.
7. Fertigen Plan öffnen: unten „Lernplan geschafft!“ und „Lerneinheit erstellen“. Thema/Dauer wählen, mehrfach weiterlernen; Pflichtplan bleibt abgeschlossen.
8. Erinnerungen, Light/Dark, große Schrift und VoiceOver am endgültigen nativen Stand abnehmen.

## Native Prüfgrenze

Die Übersicht und der zunächst umfangreichere Bearbeitungsdialog wurden im angemeldeten bisherigen Review-Simulator gerendert. Tippen auf einen Termin, Übergang in den nativen Zeitwähler, Rückkehr, Speichern und Übernehmen wurden bedient; anschließend erschien die vorhandene KI-Einwilligungsabfrage. Der korrigierte Editor wurde anschließend im separaten iOS-Simulator als echte Komponente mit festen Beispieldaten visuell geprüft. Die ausschließlich lokale Vorschau-Route wurde danach entfernt. Abschlusskarte und vollständiger Lernfluss sind noch nicht unabhängig im separaten angemeldeten Gerät visuell abgenommen. Parallel laufender fremder Entwicklungsserver schaltete den gemeinsam genutzten Simulator um; weitere Eingriffe dort wurden eingestellt. Der gemeinsame Simulator wurde nicht abgeschaltet.

Die Original-Vorher-Bilder sind direkt in der PR eingebettet. Neue technische Belege unten zeigen nur die ausdrücklich beschrifteten Zwischenstände, nicht eine vollständige native Abnahme.

## UI-Korrektur nach Philipps Bildvergleich

Job: einen konkreten Lerntag verschieben bzw. sein Zeitfenster bearbeiten. Hierarchie: Wochentag, Beginn/Ende, Speichern. Primäraktion: Speichern bzw. Hinzufügen; Abbrechen daneben. Entfernt: separate Dauer-Auswahl und Dauer-Erklärtext. Entscheidung: denselben `LearningTimeEditorFields`-Baustein wie „Lernzeit hinzufügen“ verwenden (sieben Tageskreise, zwei helle Zeitfelder mit Uhrsymbol nebeneinander). Eine dezente Datumszeile hält den konkreten Termin eindeutig und öffnet bei Bedarf die vorhandene Datumsauswahl; die Tageskreise beziehen sich auf dessen Woche. Keine Änderung regelmäßiger Lernzeiten. Das alte Editor-Zwischenbild wurde aus der aktuellen PR-Galerie entfernt.

Validierung der UI-Korrektur: TypeScript ohne Fehler; beide betroffenen UI-Testdateien mit 5/5 Tests bestanden. Die neue Regression prüft Tageswechsel innerhalb derselben Kalenderwoche und das gespeicherte Zeitfenster. Native Light-Mode-Aufnahme: `docs/evidence/pr-813-learning-plan-after/editor-corrected.png`. Dark Mode, große Schrift und vollständiger authentifizierter Ablauf bleiben manuell abzunehmen.

## Lerndauer als nativer Drehwähler (aktuelle Entscheidung)

Job: Lerntag mit Beginn und gewünschter Dauer festlegen. Hierarchie: Tag, Beginn/Lerndauer nebeneinander, berechnetes Ende. Primäraktion: Speichern im Editor und Übernehmen im Wähler. Friktion: keine Minuten-Buttons, kein zweites manuell zu pflegendes Ende. Die Dauer bleibt ausdrücklich gewünscht; die vorherige Entscheidung für zwei Uhrzeiten wird damit ersetzt.

Der gemeinsame `DurationPickerSheet` verwendet echte native Stunden-/Minutenräder auf iOS. Sekunden entfallen. 5-Minuten-Schritte und bestehende Grenze 5–240 Minuten; ungültige Radkombinationen sperren Übernehmen. Abbrechen/Schließen verwirft den Entwurf. Beginn bleibt beim Ändern der Dauer erhalten, Ende wird berechnet. Bestehende reguläre Lernzeiten bleiben bei Beginn/Ende. Android/Web erhalten die Plattformauswahl derselben Felder, keine nachgebaute Apple-Oberfläche.

Native Komponentenprüfung im separaten iOS-Simulator: Lerndauer öffnen, Stundenrad drehen, Übernehmen und Rückkehr erfolgreich bedient. Ergebnis 150 Minuten bei Beginn 17:00 ergibt Ende 19:30. Maestro-Aufnahme schlug zunächst nur wegen eines nicht erlaubten absoluten Screenshotpfads fehl; der Screenshot wurde anschließend unverändert mit simctl aufgenommen. Vorschau nutzt feste lokale Beispieldaten und wird nicht ausgeliefert. Kein Nachweis des kompletten authentifizierten Lernflows. Android/Web, VoiceOver und große Schrift nicht manuell geprüft.

Aktuelle Validierung: 9/9 UI-Tests, 17/17 Lint-Regeltests, TypeScript und ESLint bestanden. Editor in Light/Dark visuell geprüft, Dauerwähler in Light; vollständige Accessibility- und Android/Web-Abnahme bleibt offen.
