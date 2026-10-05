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

## Aktuell: ergebnisabhängige Vorbereitung und zehn Fragen

Diese Entscheidung ersetzt die früheren Aussagen über fünf Fragen und unveränderte Budgets. Neue Wissenschecks erzeugen genau zehn Fragen über die bestätigten Themen. Bestehende Checks mit fünf Fragen bleiben abschließbar; Ergebnisstufen verwenden den Anteil der ersten richtigen Antworten (Wiederholungen erhöhen den Wert nicht).

- 90–100 % richtig: 75 % des Basisbudgets; 70–<90 %: 100 %; 40–<70 %: 125 %; unter 40 %: 150 %.
- Aktive Wissenscheck-Minuten werden angerechnet. Die restliche Planung wird auf fünf Minuten aufgerundet. Keine negative Restzeit und keine erfundene Mindest-Lerneinheit, wenn der Check das Budget abdeckt.
- Erfassung nur während aktiver Session im Vordergrund. Checkpoints alle 15 Sekunden sowie beim Verlassen/Hintergrundwechsel erhalten Zeit beim Wiederöffnen; bei abruptem Prozessabbruch können höchstens die seit dem letzten erfolgreichen Checkpoint erfassten Sekunden fehlen. Offline fehlgeschlagene Checkpoints werden beim nächsten Checkpoint/Abschluss nachgeliefert, solange der Prozess lebt.
- Vorschläge bevorzugen gespeicherte Zeiten und ergänzen bei Bedarf Blöcke rund um die bevorzugte Uhrzeit. Automatisch maximal 120 Minuten pro Tag, Zusatzblöcke 08–21 Uhr mit mindestens zehn Minuten Abstand zu anderen Lernblöcken. Kalendereinträge bleiben gesperrt. Manuelle Bearbeitung bleibt möglich.
- Sieben und drei Tage verteilen denselben Bedarf; ein Tag begrenzt die tatsächlich planbare Kapazität, nicht die Bedarfsschätzung. Fehlende Zeit wird in der Übersicht ausgewiesen. Nach 21 Uhr keine automatischen Zusatztermine; Sofortstart bleibt möglich. Keine automatische Wiederherstellung entfernter Termine nach Übernahme.

Validierung: vollständiger Vitest-Lauf 1.039/1.039, Jest 415/415. Anschließend zusätzlicher Backend-Integrationstest ergänzt: zehn Fragen, neun richtige Antworten, Eigentümerschutz der Zeit-Checkpoints, 900 aktive Sekunden, 135 Gesamtminuten und 120 Restminuten; betroffene Suite 14/14 bestanden. TypeScript und ESLint geprüft. Änderungen lokal auf `anonymous-agent` (3230) eingespielt. Echte KI-Neugenerierung weiterhin mangels lokalem Vertex-Schlüssel offen.

Lokaler Testplan für Philipp: `kh7bfb5hj74w6fsa9s9dfc36qh8fj5qz`, Route `/learning-plans/kh7bfb5hj74w6fsa9s9dfc36qh8fj5qz/preparation`, bestehendes lokales Testkonto. Die zehn Beispielantworten und 15 Minuten aktive Zeit wurden als Testdaten gesetzt, nicht real 15 Minuten im Simulator absolviert.

Native Ansicht: separater Simulator B240CC0C-9883-4E16-86C5-1FD0607A1080, Metro 8083. Keine Anmeldung; deshalb gekennzeichnete lokale Vorschau mit dem tatsächlichen Backend-Ergebnis. Vorschau lässt UI-Termine bearbeiten, speichert keine Backend-Änderungen; sie ist nicht Bestandteil des PR. `Simulator.app` fehlt in dieser Installation, CoreSimulator läuft dennoch. Keine vollständige manuelle Live-Abnahme behauptet. Aufnahme `adaptive-result-preview.png` zeigt diesen begrenzten Teststand.

## Popup-Nachbesserung nach Video-Feedback

Die Summenzeile „… eingeplant“ entfällt; ein echtes Defizit bleibt erklärt. Entfernen ersetzt beim Bearbeiten links Abbrechen, Speichern bleibt rechts. X verwirft den Editorentwurf. Zeit- und Dauerwähler nutzen auf iOS dieselbe offene Sheet-Instanz statt erst zu schließen und danach ein neues Popup zu öffnen. Android behält seine nativen Datum-/Uhrzeitdialoge.

[Timestamp-basierte Videoauswertung und Validierung](../evidence/pr-813-learning-plan-after/popup-correction.md). Aktuelle lokale Simulatorvorschau weiterhin ohne Backend-Speicherung.

## Weitere Textkürzung nach markiertem Screenshot

Aus der Übersicht entfernt: separate Check-Zeit-Anrechnung, Stärken-/Schwächenliste und Hinweis „Deine Lerntermine …“. Ergebnis, Gesamtzeit und Terminliste bleiben. Die Berechnung und Anrechnung der Wissenscheck-Zeit bleiben unverändert. Der nur lokale Vorschauhinweis wird auf Nutzerwunsch auch in der nicht ausgelieferten Simulatorroute entfernt; die Vorschau speichert weiterhin nicht im Backend.

Validierung: TypeScript, Biome und ESLint für den Screen bestanden; Diff als reine Anzeigeänderung geprüft.

## Rückfrage bei abweichender Lernzeit

Designentscheidung: Job ist die bewusste Übernahme einer abweichenden Zeitplanung. Hierarchie: mehr/weniger Zeit, geplanter Umfang gegenüber Empfehlung, Entscheidung. Primäraktion „Übernehmen“, sekundär „Anpassen“. Friktion: keine zusätzliche Frage bei passender Zeit und keine Fragen während einzelner Bearbeitungen. Gewählt ist der bestehende ConfirmationSheet mit primärem Bestätigungsbutton und umrandetem Anpassen-Button; dessen Textskalierung und responsive Aktionsanordnung werden übernommen.

Beim Tippen auf Übernehmen wird die Summe der Planzeiten mit dem Budget nach Anrechnung des Wissenschecks verglichen. Gleiche Zeit speichert direkt; mehr oder weniger Zeit öffnet die passende Rückfrage. Anpassen oder X kehrt ohne Speichern zur Übersicht zurück. Erst die Bestätigung löst das bisherige Speichern aus. Die individuelle Empfehlung ist kein Versprechen eines exakten Lernbedarfs. Leere Pläne und laufendes Speichern bleiben gesperrt; der separate Sofortstart bleibt bestehen.

Validierung: vier gezielte UI-Tests für passend, mehr, weniger und gesperrte Aktionen; TypeScript, Biome und ESLint bestanden. Native iOS-Simulatorprüfung mit lokalen Beispieldaten; keine Backend-Speicherung in dieser Vorschau. Android, VoiceOver und große Schrift nicht separat manuell geprüft.

## CodeRabbit follow-up · 3 October 2026

- Structured-output/schema failures now participate in the bounded three-attempt generation retry before conversion to a safe user-facing error. German-text and duplicate-prompt retries remain; unrelated errors propagate immediately.
- Preparation proposals use `getPlanningLearningTimes`. The grade fallback from this follow-up was removed by the 5 October review correction below; missing personal windows now yield no automatic appointments.
- Appointment reconciliation excludes unscheduled steps and counts them toward the 500-step limit. Adding appointments retains untouched, running and interrupted flexible work.
- The diagnostic introduction says ten questions. The obsolete completion callback and quick-add-sheet wiring are removed: the agreed preparation overview replaces that historical prompt.
- The older QA table formatting finding is also corrected.

Validation: 52 targeted Vitest tests, 6 Jest UI tests, TypeScript, scoped ESLint, Biome and diff checks passed. Local Convex deployment to `anonymous-agent` at `127.0.0.1:3230` succeeded. No production deployment. Retry tests use synthetic SDK errors; live model generation remains outside this verification.

## Review follow-up · 5 October 2026

- Missing learning times return an empty availability list in creation, AI context, rolling planning and preparation proposals. No grade-based windows or implicit Monday appointment are generated. Learners can still add and confirm one-off appointments or start flexible preparation immediately.
- The current session screen already completes after the last theory page or answered task, irrespective of unused planned minutes. A screen-level regression covers theory, practice and Praxis finishing early without automatically extending content or repeating it. This finding did not reproduce on the current PR head; no new timer-padding fix is claimed.
- `learningPlanCalendar.ts` owns calendar occupancy and session/event reconciliation. `learningPlanDiagnostic.ts` validates and stores diagnostic items. `learningPreparation.ts` owns diagnostic lifecycle, result budget, preparation appointment reconciliation, flexible start and additional practice. Existing registered functions and validators stay in `learningPlans.ts`, preserving caller paths and scheduled callbacks; the extracted modules expose no additional Convex endpoints.

Validation results are recorded in the PR description. Automated screen tests mock backend responses; they do not establish native device acceptance or live AI generation.


## CodeRabbit follow-up · 5 October 2026

The seven comments in [review 5420109215](https://github.com/Dayova/dayova-mvp/pull/813#pullrequestreview-5420109215) were checked against the current branch:

- Deleted grouped calendar entries are recreated on synchronization; moving the remaining steps skips a deleted historical entry. Ownership is checked before patching.
- Grouped event titles stay unchanged. Start and completion timestamps come from the group's recorded step timestamps, with existing event timestamps retained when no member has the relevant metadata. Interrupted groups keep their start time.
- Outcome recording caps submitted study seconds at nonnegative elapsed time, preserving previously recorded seconds. Storage and diagnostic budgeting use the same capped value.
- Open required flexible steps consume the appointment editor's budget. Completed steps and voluntary practice are excluded from that subtraction; the result cannot become negative.
- Functional QA expectations now require empty availability without saved times, irrespective of grade, while retaining explicit one-off appointments and immediate flexible study.
- The appointment picker's minimum is Berlin's current date and its maximum is the calendar day before the exam. Both are represented at local noon; calendar arithmetic preserves noon across daylight-saving transitions.
- The login-test reset finding is already satisfied: the enclosing `OnboardingScreen` `beforeEach` resets `mockOnboarding.answers.studyTime` to `"30"` before every test, including the duration cases. No redundant reset was added.

Validation: new regressions first reproduced the failures (13 backend failures and 2 picker failures). After corrections, 72 targeted backend tests and the complete Vitest suite (137 files, 1,058 tests) passed. The full suite used four workers and a 30-second test timeout; an initial unrelated PNG/Git subprocess hang was stopped before the successful rerun. Five targeted Jest suites passed with 76 tests. The seven picker tests also passed separately in Los Angeles and Tokyo timezones, alongside the Berlin run. Jest used the temporary CommonJS-icon transform bypass documented in the previous follow-up; the repository's Jest configuration was unchanged. TypeScript, scoped ESLint, Biome and whitespace checks passed.

The separate anonymous local Convex deployment compiled successfully. A deployed save/start/interrupted-outcome smoke test stored fewer than 60 seconds after submitting 999,999 seconds immediately after starting, and retained the resumable step. The workspace environment was restored and the local process stopped. No cloud deployment, new native device acceptance, or live model generation is claimed.
