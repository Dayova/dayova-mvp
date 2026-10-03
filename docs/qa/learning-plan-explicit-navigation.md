# Lernpläne: Wischfehler beheben, ursprüngliches Kartendesign erhalten

## Korrektur nach Philipps Rückmeldung

Die ursprünglich eingeführte sichtbare Bearbeiten-/Löschen-Zeile war nicht
freigegeben und wurde wieder entfernt. Die ursprüngliche dunkle Aktionsleiste
hinter der seitlich verschiebbaren Karte ist wiederhergestellt. Karteninhalt,
Typografie und Geometrie sind unverändert; die Kopfzeile bleibt Sache von #820.

Der vorhandene blaue Pfeil bleibt das Öffnungsziel. Eine aktivierte Wischgeste
setzt eine Sperre, die über das Loslassen hinaus bestehen bleibt und erst mit
der nächsten Berührung zurückgesetzt wird. Damit kann ein nachgeliefertes
Press-Ereignis nicht versehentlich navigieren – auch nicht, wenn ein kurzer
Swipe schon wieder bei Offset 0 angekommen ist. Tippen auf den Pfeil bei
offener Aktionsleiste schließt zunächst diese. Bearbeiten/Löschen schließen
die Leiste und führen die bestehende Aktion aus; Löschen bleibt bestätigt.

Die separaten Stack-/Zurück-/Fortsetzen-/Später-Korrekturen bleiben erhalten.

Prüfung: Der Kartentest schlug mit vorhandener Buttonzeile wie erwartet fehl.
Nach der Korrektur bestehen Karten-, Swipe-Hook- und Creation-Flow-Tests
(3 Suites / 11 Tests). Hook-Tests führen die registrierten Gesten-Callbacks
aus und prüfen den nachfolgenden tatsächlichen Öffnungs-Callback. Sie simulieren
Animationen; eine neue native iOS-/Android-Wischabnahme ist noch offen.
Die nachstehende native Abnahme beschreibt ausdrücklich den früheren,
inzwischen verworfenen Kartenstand und gilt nicht als Abnahme dieser Korrektur.

Abschlussprüfung der Korrektur: alle 80 Jest-Suites / 355 Tests grün,
TypeScript, gezieltes ESLint und Diff-Check grün. Kein Backend-Deployment.

## Video-Befund (Philipp, 3. Oktober 2026)

Quelle: `VIDEO-2026-10-02-11-02-09.mp4`, SHA-256
`5f1f3ac9d09bd341367c6c9f06ccd94bbb3156d1eb7bce24a29c239664f82962`.
Das private Original und extrahierte Bilder bleiben lokal.

- 00:00.8–00:02.2: Mathematik-Karte wird nach links versetzt, Aktionen werden
  sichtbar; anschließend öffnet sich die Lernplanansicht.
- 00:03.4–00:05.2: Die noch offene Karte wird zurückgeschoben, anschließend
  öffnet sich erneut die Lernplanansicht. 00:06–00:07 wiederholt das Muster.
- 00:16–00:19: Die Materialseite wird seitlich zur Übersicht gezogen und
  kehrt wieder zurück.
- 00:29.8–00:31 und 00:33.2–00:34.4: Die Übersicht erscheint bereits,
  anschließend kommt die Themenseite samt „Lernplan-Erstellung pausieren?“
  zurück. Weitere Wiederholungen bis 00:46.

Beobachtung und Ursache trennen: Es gibt keine sichtbaren Touch-Marker. Der
Film belegt die Übergänge, aber nicht, ob beim Loslassen zusätzlich ein Tap
erzeugt wurde. Philipps Beschreibung benennt das versehentliche Öffnen beim
Wischen. Keine Aussage über Audioinhalte; Tonspur nicht transkribiert.

Coverage: 47.01-second video; 47 full-timeline frames sampled at 1 fps (1-second interval); 3 contact sheet(s); 35 additional frames from 00:00:00.000 to 00:00:07.000 at 5 fps; 30 additional frames from 00:00:29.000 to 00:00:35.000 at 5 fps; audio stream detected; transcription not performed.

Alle acht Kontaktbögen wurden angesehen. Zwischen den Stichproben liegende
Einzelbilder und die exakte Fingergeste sind damit nicht vollständig erfasst.

## Historische Entscheidung – Kartenredesign zurückgenommen

- Aufgabe: Den richtigen Lernplan gezielt öffnen oder bearbeiten.
- Hierarchie: Fach/Status, nächster Lernschritt, klar getrennte Aktionen.
- Hauptaktion: Der vorhandene blaue Pfeil öffnet den Plan.
- Reibung: Kein verdecktes Bearbeiten/Löschen durch seitliches Verschieben;
  kein Antippen der gesamten Karte während einer Wischgeste.
- Umsetzung: Sichtbare Bearbeiten-/Löschen-Schaltflächen oben auf der Karte;
  keine horizontale Kartengeste. Löschen öffnet weiterhin die vorhandene
  Bestätigung und löscht nicht unmittelbar.
- Erstellung und Lernplanübersicht im Detail: Navigation über den vorhandenen
  Zurück-Button, keine interaktive iOS-Zurückgeste. Der äußere Creation-Stack
  ist ebenfalls geschützt. Android-Back und der Pausendialog bleiben erhalten.

Keine Änderung an Auth-Onboarding, Kalendergesten, Hausaufgabenkarten,
Lernzeiten, Backend oder Lernplan-Daten.

## Prüfung

Regressionstests wurden vor der Änderung rot ausgeführt: Creation-Screen
meldete `gestureEnabled: true`; die Lernplankarte hatte keine getrennten
Bearbeiten-/Löschen-Aktionen. Diese Tests prüfen die echte Screen-Konfiguration
und die tatsächliche Karte, nicht die native Zustellung einer Fingerbewegung.
Die native Abnahme wird separat dokumentiert; automatisierte Tests beweisen
keinen vollständigen iOS-/Android-Gestentest.

Automatisiert: 79 Jest-Suites / 353 Tests grün; TypeScript, gezieltes ESLint und
`git diff --check` grün. Keine Backendänderung, daher kein Deployment erforderlich.
Die sichtbaren 44pt-Aktionsflächen haben fachbezogene Accessibility-Labels;
Artwork bleibt nicht-interaktiv. iOS-Light-Sichtprüfung durchgeführt, große
Schrift und dekorative Darstellung durch bestehende UI-Tests abgedeckt.
Android, VoiceOver und native Dark-/Großschrift-Abnahme nicht durchgeführt.

Native iOS-Abnahme am 03.10.2026, „Dayova Jakob Review iPhone“, iOS 26.4:
Maestro-Flow erfolgreich (Exit 0). Links-/Rechtswischen auf dem vorhandenen
Mathematik-Entwurf und Tippen auf dessen Text bleiben in der Übersicht.
Bearbeiten öffnet korrekt den gespeicherten Material-Schritt. Edge-Swipes in
Material und Themen verlassen den Screen nicht und öffnen keinen Pausendialog.
Der obere Zurück-Button führt Material → Themen → Pausendialog;
„Weiter bearbeiten“ schließt diesen wieder. Keine Planinhalte gespeichert,
keine Löschung ausgeführt. Der erste Test erwartete fälschlich direkt die
Themenseite; die Wiederaufnahme startete korrekt im Material-Schritt. Nach
Korrektur dieser Testannahme bestanden alle beschriebenen nativen Schritte.
Ein bereits vorhandener lokaler Notification-Fehlerbadge beim Start ist von
diesem Frontend-Fix unabhängig und wird damit nicht als behoben behauptet.

## Nachprüfung: Fortsetzen und Später

Die Buttons heißen jetzt „Fortsetzen“ und „Später“. Fortsetzen schließt nur
den Dialog. Später gibt nach ausdrücklicher Bestätigung den Removal-Guard
frei und navigiert erst nach dem entsprechenden Render zur Lernplanübersicht.
Der Screen-Test prüft beide Aktionen und die Freigabe vor `dismissTo`.
Fünf Flow-Tests, TypeScript, gezieltes ESLint und Diff-Prüfung bestanden.

Native Nachprüfung auf „Dayova PR819 Dialogtest“ (iOS 26.4) erfolgreich:
Fortsetzen lässt die Themenseite geöffnet; anschließend führt Später zur
Übersicht und schließt Dialog und Bearbeitung. Maestro Exit 0.
Vorherige Versuche waren nicht als erfolgreiche Abnahme verwertbar: Der
gemeinsame Simulator wurde zwischenzeitlich per App-Umschalter beendet;
zusätzlich verdeckte ein vorhandener Entwickler-LogBox-Toast die Buttons.
Nach Schließen dieses Toasts bestand der gezielte Test auf einer isolierten
Gerätekopie. Der zugrunde liegende Notification-Fehler ist nicht Teil des Fixes.
