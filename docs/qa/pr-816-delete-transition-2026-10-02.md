# PR #816: Löschdialog-Übergang · 02.10.2026

## Ursache und Änderung

Der Editor wurde vollständig geschlossen; erst sein natives onDismiss öffnete ein zweites Bestätigungsblatt. Dadurch verschwand der abgedunkelte Hintergrund zwischen den Dialogen.

Code-Stand `39368c2a`: Editor und Bestätigung verwenden dieselbe präsentierte DayovaSheetFrame-Instanz. Wiederverwendbarer ConfirmationSheetContent stellt die bestehenden Aktionen bereit; andere ConfirmationSheet-Aufrufer behalten ihr Verhalten. Bestätigung, Abbrechen, gespeicherte Ziel-ID und Mutationssperren bleiben erhalten. Inhalt bleibt beim abschließenden Ausblenden bestehen.

## Prüfung

- Regressionstest vor dem Fix fehlgeschlagen: keine Bestätigung sichtbar, solange das alte Blatt nicht nativ geschlossen war.
- Nach Fix fokussierte Suite: 9/9 Tests bestanden. Gesamtlauf: 84 Suites / 386 Tests; TypeScript, gezieltes ESLint/Biome und Diff-Check bestanden.
- Nicht-destruktiver Maestro-Lauf bestanden: Editor öffnen → Löschen → Bestätigung → Abbrechen → Zurück zu Einstellungen.
- Simulator: Dayova Jakob Review iPhone, iOS 26.4, Hellmodus; kombinierter lokaler Review-Stand `873fe6ab`, kein isolierter PR-Build.
- Keine echten Fächer/Lernzeiten gelöscht, keine Backendänderung oder Produktionsbereitstellung.

## Videoauswertung

19,3–19,5 s: Editor mit Tastatur. 19,6–20,0 s: Bestätigung erscheint im selben Blatt, während die Tastatur ausfährt; Hintergrund bleibt abgedunkelt. 21,5–23,5 s: Abbrechen, unveränderte Fachliste und Rückkehr zu Einstellungen. Aufnahme enthält schwarze Frames von ca. 8–16 s vor dem geprüften Übergang; diese sind kein UI-Nachweis.

Coverage: 28.10-second video; 56 full-timeline frames sampled at 2 fps (0.5-second interval); 4 contact sheet(s); 8 additional frames from 00:00:19.300 to 00:00:20.300 at 10 fps; no audio stream.

Alle Volltimeline-Kontaktblätter, das fokussierte Intervall und relevante Einzelbilder geprüft. Keine Tonspur, keine Transkription. Zeitangaben sind Stichprobenpositionen; variable Aufnahmefrequenz und resampelte Frames erlauben keine framegenaue FPS-/Ruckelfreiheitsgarantie. Kein neuer Android-, Dark-Mode- oder VoiceOver-Nachweis.

Lokale Aufnahme: `subject-delete-transition-after.mp4`. SHA-256: `e52e85910d1e68e83edcf9b838b696b0e0e426ecb1f2670ca6707c64090d73c5`. Die Aufnahme wurde nicht als öffentlicher Upload veröffentlicht. Die vorhandenen GitHub-Screenshots bleiben direkt sichtbar in 220 px Breite.

