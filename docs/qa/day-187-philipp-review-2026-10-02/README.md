# PR #816 — Philipps Bild- und Videonachweise

Von Philipp am 02.10.2026 für die PR-Beschreibung bereitgestellt. Simulator:
Dayova Jakob Review iPhone, iOS 26.4, helles Design. Kombinierter lokaler
Review-Stand, kein isolierter #816-Build; die Aufnahme selbst enthält keine
Commit-ID. Die Bilder um 21:53 liegen vor dem späteren Rücknavigations-Fix.

## Video

[Vollständige Demo, 60,99 Sekunden](demo.mp4). Ungekürzt, für das Repository auf
720 Pixel Breite H.264-komprimiert; keine Tonspur, keine Transkription nötig.
Original: `Screen Recording Dayova Jakob Review iPhone 02.10.2026 at 22.26.25.mp4`.
Original-SHA256: `fd59d428bd57664abe5193b705a62431c48b08764cbb9d2e83e0cd5086b1a061`.

Beobachtungen aus der vollständigen zeitlichen Stichprobe:

| Zeit | Sichtbarer Ablauf |
| --- | --- |
| 00:00–00:03 | Einstellungen → Persönliche Fächer; Spanisch vorhanden. |
| 00:05–00:17 | Französisch eingeben und hinzufügen; danach Französisch und Spanisch in der Liste. |
| 00:19–00:25 | Spanisch bearbeiten, Löschen öffnen, Bestätigung anzeigen; danach nur Französisch vorhanden. |
| 00:29–00:31 | Hinzufügen-Dialog öffnen und wieder schließen, ohne weiteres Fach in der Liste. |
| 00:32–00:35 | Swipe-Löschaktion zeigen; anschließend Rückkehr zu den Einstellungen. |
| 00:39–00:46 | Prüfungsart Test wählen, Fachauswahl öffnen; Französisch ist verfügbar. |
| 00:47–01:00 | Spanisch im Prüfungsflow hinzufügen; danach ausgewählt mit aktivem Weiter-Button. |

Coverage: 60.99-second video; 61 full-timeline frames sampled at 1 fps (1-second interval); 4 contact sheet(s); no audio stream.

Alle vier Übersichtsblätter wurden geprüft; Einzelbilder bei 00:17, 00:23,
00:25, 00:35 und 00:58 zusätzlich geöffnet. Die Stichprobe belegt die genannten
Zustandswechsel, nicht framegenaues Animationstiming. Keine tatsächliche
Umbenennung, kein App-Neustart/Persistenz-Langzeittest und kein Abschließen
einer Prüfung im Video. Backend-Verknüpfungen werden durch separate Tests
geprüft, nicht durch diese Bilder. Der schwebende Zahnradknopf ist Entwicklungs-UI.

## Alle acht Screenshots

| Datei | Originalzeit | Sichtbarer Zustand |
| --- | --- | --- |
| [01-settings-subjects.png](01-settings-subjects.png) | 21:53:11 | Französisch und Spanisch mit Stift-Aktionen. |
| [02-edit-actions.png](02-edit-actions.png) | 21:53:20 | Bearbeiten mit Tastatur; Löschen und Speichern nebeneinander. |
| [03-single-subject.png](03-single-subject.png) | 21:53:31 | Liste mit einem Fach; allein kein Beweis des Löschvorgangs. |
| [04-swipe-delete.png](04-swipe-delete.png) | 21:53:33 | Freigelegte Swipe-Löschaktion. |
| [05-add-settings.png](05-add-settings.png) | 21:53:38 | Leeres Hinzufügen-Sheet mit Tastatur und gesperrter Hinzufügen-Aktion. |
| [06-exam-subject-list.png](06-exam-subject-list.png) | 22:26:39 | Durchgehende Fachliste, noch keine Auswahl. |
| [07-add-italian.png](07-add-italian.png) | 22:26:54 | Italienisch eingegeben; direktes Hinzufügen ohne Speicherart-Abfrage. |
| [08-italian-selected.png](08-italian-selected.png) | 22:26:57 | Italienisch ausgewählt; Weiter aktiv. |

Die PNG-Dateien sind unveränderte Originale. Die spätere Italienisch-Bildfolge
ist ein separater Nachweis; das Video endet bei Spanisch.

## Review-Grenze

Keine neuen Produktcode-Änderungen in diesem Evidence-Commit. Lokale Prüfungen
am vorherigen Code-Stand: 950 Vitest- und 386 UI-Tests, TypeScript und gezielte
Lint-/Formatprüfungen bestanden. Die beiden konkreten CodeRabbit-Befunde sind
behoben; die erneute Review-Anfrage wurde durch ein Rate-Limit blockiert.
Philipp prüft zuerst die ergänzte Beschreibung. Keine Nachricht an Jakob und
keine Umstellung von Draft auf Ready for Review durch diesen Schritt.
