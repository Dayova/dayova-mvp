# PR #817: Löschdialog-Übergang · 02.10.2026

## Ergänzung 03.10.: Uhrzeitauswahl

Das Öffnen der Uhrzeitauswahl aus dem Editor konnte den Editor samt Picker
schließen. Der Editor wird nun kontrolliert ausgeblendet; erst dessen natives
`onDismiss` öffnet den Picker. Beim Schließen des Pickers kehrt der Editor mit
dem geänderten Entwurf zurück. Keine zusätzlichen Timer oder Backendänderungen.

Fokussierte Suite: 10 Tests grün, einschließlich Draft-Erhalt, Rückkehr und
Speichern der geänderten Endzeit. TypeScript geprüft. Native Prüfung durch die
koordinierte Simulator-Aufgabe auf dem kombinierten Review-Stand, Metro 8084:
`dayova-picker-verify.yaml` (Ende → Fertig sichtbar) und
`dayova-picker-wheel.yaml` (Stundenrad wischen → Fertig → geänderte Endzeit im
Editor) jeweils Exit 0. Nur Entwurf geändert, nicht gespeichert. Das ist kein
Nachweis für die gesamte Wissensanalyse oder alle Picker auf Android.

Die separate Tastatur-Korrektur gehört zu #816; Buttonbreiten-Sprünge sind mit
dieser Picker-Korrektur nicht als behoben nachgewiesen.

## Ursache und Änderung

Der Editor wurde vollständig geschlossen; erst sein natives onDismiss öffnete ein zweites Bestätigungsblatt. Dadurch verschwand der abgedunkelte Hintergrund zwischen den Dialogen.

Code-Stand `cad5e20f`: Editor und Bestätigung verwenden dieselbe präsentierte DayovaSheetFrame-Instanz. Wiederverwendbarer ConfirmationSheetContent stellt die bestehenden Aktionen bereit; andere ConfirmationSheet-Aufrufer behalten ihr Verhalten. Bestätigung, Abbrechen, gespeicherte Ziel-ID und Mutationssperren bleiben erhalten. Inhalt bleibt beim abschließenden Ausblenden bestehen.

## Prüfung

- Regressionstest vor dem Fix fehlgeschlagen: keine Bestätigung sichtbar, solange das alte Blatt nicht nativ geschlossen war.
- Nach Fix fokussierte Suite: 9/9 Tests bestanden. Gesamtlauf: 80 Suites / 365 Tests; TypeScript, gezieltes ESLint/Biome und Diff-Check bestanden.
- Nicht-destruktiver Maestro-Lauf bestanden: Editor öffnen → Löschen → Bestätigung → Abbrechen → Zurück zu Einstellungen.
- Simulator: Dayova Jakob Review iPhone, iOS 26.4, Hellmodus; kombinierter lokaler Review-Stand `873fe6ab`, kein isolierter PR-Build.
- Keine echten Fächer/Lernzeiten gelöscht, keine Backendänderung oder Produktionsbereitstellung.

## Videoauswertung

22,0–22,1 s: Editor. 22,2–22,5 s: Bestätigung und Anpassung der Blatthöhe bei unverändert dunklem Hintergrund. 24–26 s: Abbrechen und zurück zu Einstellungen. Vorherige Aufnahme zeigte bei 21,2–21,7 s die helle Liste ohne Blatt und erst danach die Bestätigung. Die variable Aufnahme endet mit einem statischen Zustand; die Volltimeline-Extraktion liefert Frames bis 28 s.

Coverage: 31.96-second video; 29 full-timeline frames sampled at 1 fps (1-second interval); 2 contact sheet(s); 18 additional frames from 00:00:22.000 to 00:00:23.500 at 10 fps; no audio stream.

Alle Volltimeline-Kontaktblätter, das fokussierte Intervall und relevante Einzelbilder geprüft. Keine Tonspur, keine Transkription. Zeitangaben sind Stichprobenpositionen; variable Aufnahmefrequenz und resampelte Frames erlauben keine framegenaue FPS-/Ruckelfreiheitsgarantie. Kein neuer Android-, Dark-Mode- oder VoiceOver-Nachweis.

Lokale Aufnahme: `delete-transition-after-check.mp4`. SHA-256: `c38f1e41f09589e6eac13507891761251f8c7f74a2b49b51122668a69ffa45d6`. Die Aufnahme wurde nicht als öffentlicher Upload veröffentlicht. Die vorhandenen GitHub-Screenshots bleiben direkt sichtbar in 220 px Breite.
