# Onboarding: Lerndauer und Wochentage

Stand: 3. Oktober 2026. Folgeänderungen für PR #825.

## Umsetzung

- Dauer: 15, 30, 45, 60, 90, 120, 180 und 240 Minuten. Ab 60 Minuten zeigt der Kreis Stunden mit deutschem Dezimalkomma. Weiter bestätigt die angezeigten 30 Minuten; das Öffnen allein speichert keine Auswahl.
- Der Infotext zur Dauer passt sich dem gewählten Wert an.
- Lerntage: keine initiale Vorauswahl, 48pt Mindesthöhe, semibold body-3, 2/2/2/1 angeordnet. Auswahl mit blauem Verlauf und weißer Schrift; zugänglicher Checkbox-Zustand bleibt erhalten.
- Ein zusätzlicher Lernfakt erklärt verteiltes Wiederholen zwischen Tages- und Startzeitauswahl. Zwölf Profil-/Kontoschritte führen bis zur Verifikation.
- Der echte Einstieg verwendet `expo-router/entry`. Die lokale Vier-Seiten-Vorschau, die den gemeldeten Rücksprung ausgelöst hatte, ist entfernt.
- Persistierte ältere Dauern bleiben lesbar. Backend und Outbox akzeptieren zusätzlich 15 und 240 Minuten.

## Native Bildbelege

| Dauer | Tage ohne Auswahl |
| --- | --- |
| ![Dauer](dayova-real-duration.png) | ![Tage](dayova-real-days-empty.png) |

| Lernfakt | Startzeit |
| --- | --- |
| ![Lernfakt](dayova-real-routine.png) | ![Startzeit](dayova-real-time.png) |

Die Aufnahmen stammen aus dem echten Router auf „Dayova Jakob Review iPhone“.
Die zusätzlichen Nutzeraufnahmen unter `../onboarding-review-2026-10-03/`
zeigen den Ablauf bis zur Zusammenfassung bei Schritt 7.

## Validierung

- Gezielte Unit-/Backend-Prüfung: 84 Tests bestanden, einschließlich Speicherung von 15 und 240 Minuten über die öffentliche Mutation, Mitternachtsgrenze und Kompatibilität mit älteren Dauern.
- UI-Regressionsprüfung: 56 Tests für Auth-Screens, Lernfakt und Slider. Ein zusätzlicher Test betätigt Weiter auf jedem der zwölf Schritte und prüft den jeweiligen Folgerouten-Aufruf bis zur Verifikation. Auth-Dienste sind dabei gemockt.
- Vollständige Testsuiten: 968 Vitest-Tests und 393 Jest-UI-Tests bestanden.
- TypeScript, gezieltes ESLint/Biome und Diff-Review bestanden.
- Maestro prüfte im echten Router Intro → Name → Dauer → Erklärung → leere Tagesauswahl → Lernfakt → Startzeitauswahl sowie Zurücknavigation und erhaltene Antworten.
- Backend einschließlich Typprüfung erfolgreich in der isolierten lokalen Convex-Deployment `local-philipp_schossig-dayova_mvp-2` bereitgestellt. Dies ersetzt den zuvor durch fremde `learningPlanDocuments`-Felder blockierten Versuch auf dem gemeinsamen Dev-Ziel. Dessen Schema und Daten wurden nicht verändert.

Die echte Kontoanlage mit E-Mail-Code und anschließender Dashboard-Anmeldung wurde nicht erneut durchgeführt; die vorhandenen Auth-Tests prüfen diese Übergänge mit Testdiensten. Es wurde kein neues Nutzerkonto angelegt und kein Produktionsdeploy ausgeführt.

## Grundlage des Lernfakts

[Cepeda et al. (2006), Distributed practice in verbal recall tasks](https://www.yorku.ca/ncepeda/publications/CPVWR2006.html).
Die Aussage zur Gedächtnisleistung bezieht sich auf verteiltes Lernen; feste
Wochentage und Uhrzeiten sind die praktische Umsetzung, keine in dieser Studie
isoliert bewiesene Wirkung identischer Uhrzeiten.
