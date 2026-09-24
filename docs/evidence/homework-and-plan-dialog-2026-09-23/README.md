# Ergänzende native QA: Hausaufgaben und Lernplan-Löschdialog

23.09.2026, QA-Code `1721cd3c` (App-Code unverändert gegenüber `6aaba8bd`).
Keine Production-Abnahme, keine Konto- oder Lernplanlöschung durchgeführt.

## Hausaufgaben: drei Plattformen bestanden

[Reproduzierbarer Flow](homework-flow.yaml): Heute → Neue Hausaufgabe → Abgabe →
Fach Chemie → Weiter → Erledigen → Zurück → Abgabe mit Chemie → Zurück → Heute.
Alle Assertions bestanden, alle Prozesse Exit 0. Kein Speichern ausgelöst.

| Gerät | Planungsschritt | Erhaltene Fachauswahl nach Zurück |
| --- | --- | --- |
| iPad | [Bild](ipad/homework-schedule.png) | [Bild](ipad/homework-retained.png) |
| iPhone | [Bild](iphone/homework-schedule.png) | [Bild](iphone/homework-retained.png) |
| Android | [Bild](android/homework-schedule.png) | [Bild](android/homework-retained.png) |

Je Plattform wurden fünf Originalbilder aufgenommen; die sechs hier verlinkten
Bilder wurden vor Veröffentlichung visuell geprüft. Alle Originale bleiben lokal.
Dieser Test ergänzt #698/#722, nicht den Release-Kaltstarttest.

## #711: tatsächlicher Lernplan-Dialog auf iPad

- [Light Mode](ipad/plan-delete-light.png)
- [Dark Mode](ipad/plan-delete-dark.png)
- [Dialog-Testablauf](plan-dialog-flow.yaml)

Vorhandenen Mathematik-QA-Entwurf per Swipe geöffnet, „Lernplan löschen“ gewählt,
Dialog erfasst und abgebrochen. Beide Läufe bestanden. Weißes „Löschen“ auf rotem
Button und beide Aktionen im sichtbaren Sheet. Dark Mode anschließend auf Light
zurückgestellt. Dies belegt den Lernplan-Dialog, nicht nur den Lernzeiten-Dialog.
Loading-Zustand und erfolgreiche Löschung sind dadurch nicht geprüft.

Zusätzlich: `pnpm exec jest --runInBand src/components/ui/dayova-sheet-frame.ui.test.tsx`
bestanden: 13 Tests (Safe Area, Android Back, Modal-Semantik, Fokus und weitere
Sheet-Verträge). Automatisierte Semantik ersetzt keine VoiceOver-/TalkBack-Abnahme.

## Ausgeschlossene Versuche und offene Kriterien

Der anschließende iPad-Galerieversuch fand einen anderen Bildschirm vor; der
Nutzer bestätigte zwischenzeitliche manuelle Bedienung. Kein Galerie-Ergebnis.
Beim anschließenden Android-Dialogversuch stand das Gerät unerwartet in Lernzeiten;
auch dieser Versuch zählt nicht als App-Fehler oder Abnahme. Der iPhone-Swipe
öffnete die Aktionsleiste nicht; Dialog dort weiterhin unbestätigt.
Für weitere native Tests müssen die QA-Geräte während der Läufe unbedient sein.

Clerk, QA-Vertex, größere Uploads, Galerie, iPhone-/Android-Dialogzustände,
Accessibility und Release-Kaltlink bleiben gemäß [Matrix](../jakob-review-map-2026-09-23.md)
offen. Keine pauschale Fertigmeldung oder Änderung eines Review-HOLD.
