# Popup-Korrektur vom 03.10.2026

## Videoabdeckung

Coverage: 105.37-second video; 105 full-timeline frames sampled at 1 fps (1-second interval); 7 contact sheet(s); 42 additional frames from 00:00:00.000 to 00:00:08.000 at 5 fps; no audio stream.

Alle sieben Übersichtsbögen und alle drei Detailbögen wurden angesehen. Kein Audiostream, daher keine Transkription. Originalvideo bleibt lokal. SHA-256: d9995bb92abb407ce81a07a6a522d9c66d29fdb39a1e64ab16503c05c2ac6d16.

Beobachtungen, Zeiten relativ zum Videoanfang:
- 00:00.6–00:02.0: Editor fährt herunter; dazwischen ist nur die Übersicht sichtbar; anschließend öffnet die Dauer-Auswahl.
- 00:02.8–00:04.4: Derselbe Umweg bei der Rückkehr zum Editor.
- 00:05.2–00:06.4: Editor schließt vor Öffnen des Uhrzeitwählers.
- 00:07.2–00:07.6: Rückkehr zum Editor mit sichtbarem Aufbau.
- 00:12–00:15: Hinzufügen und geänderte Liste; etwa 00:20 öffnet der Editor erneut.
- 00:20–00:96: weitgehend unveränderte Editoransicht. Ohne Touchanzeige kein Beleg für eine blockierte Eingabe.
- 00:97–00:105: Schließen und Scrollen der Übersicht.

Grenzen: Keine sichtbaren Touchpunkte, deshalb keine genaue Tap-to-ready-Latenz. Detailabtastung 0,2 Sekunden; keine Framerate- oder Geräteleistungsbehauptung.

## Ursache und Änderung

Der reproduzierende UI-Test schlug vor der Korrektur fehl: Beim Öffnen der Dauer wurde `visible=false` gesetzt. Die Auswahl wartete im Code auf `onDismiss` und öffnete danach eine zweite Sheet-Instanz. Dieser Ablauf erklärt die im Video sichtbare Unterbrechung.

Der Editor behält jetzt eine Sheet-Instanz; Datum, Beginn und Lerndauer wechseln deren Inhalt. Native Auswahlräder bleiben bestehen. Android behält seine nativen Datum-/Uhrzeitdialoge. Keine globale Beschleunigung aller Sheet-Animationen.

Beim Bearbeiten ersetzt Entfernen den linken Abbrechen-Button; rechts bleibt Speichern. X schließt den Entwurf ohne Speichern. Die redundante Summenzeile „… eingeplant“ entfällt. Ein tatsächliches Zeitdefizit bleibt sichtbar.

## Validierung

- Elf gezielte UI-Tests bestanden, darunter Öffnen ohne Dismiss-Wartezeit, Uhrzeitübernahme, Dauerberechnung, Entfernen und Android-Picker.
- TypeScript, ESLint für betroffene Dateien und Diff-Whitespace-Prüfung bestanden.
- Im iOS-Simulator per Maestro: Editor → Dauer → Editor → Beginn → Editor → Dauer → Editor erfolgreich; Entfernen sichtbar, Abbrechen beim Bearbeiten nicht sichtbar.
- Zweiter nativer Test: Dauer öffnen, per X schließen, zurück zur bedienbaren Übersicht scrollen; Summenzeile nicht vorhanden.
- Unveränderte Aufnahme der echten Komponenten: `editor-streamlined.png`.
- Die lokale Vorschau nutzt Beispieldaten und speichert nicht im Backend. Keine vollständige authentifizierte Abnahme; Android, VoiceOver und große Schrift diesmal nicht nativ geprüft.
