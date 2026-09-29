# Persönliche Fächer in Einstellungen – UI-Review

## Aufgabe und Entscheidung

Schüler sollen ihre selbst hinzugefügten Fächer wiederfinden und weitere Fächer ohne unnötige Entscheidung anlegen können. Die Einstellungsseite verwaltet ausschließlich dauerhaft gespeicherte Fächer. Deshalb speichert das Eingabeblatt dort direkt; die Unterscheidung zwischen einmaliger und dauerhafter Verwendung bleibt in den Fachwählern anderer Abläufe erhalten.

- Der Eintrag in Einstellungen benennt die Aufgabe als „Eigene Fächer verwalten“.
- Ein leerer Bestand zeigt genau eine primäre Aktion „Fach hinzufügen“. Sobald Fächer vorhanden sind, liegt die Hinzufügen-Aktion als Plus im Seitenkopf.
- Das Eingabeblatt hat eine kurze Überschrift und erklärt, dass das Fach später wieder ausgewählt werden kann. „Fach speichern“ bezeichnet die dauerhafte Aktion; während des Speicherns ist die Aktion gesperrt und zeigt Fortschritt.
- Bestehende Fachauswahl, Korrektur bekannter Schreibweisen, Bearbeiten/Löschen und die Fehlerbehandlung bleiben erhalten.

## Sichtbare Zustände

Laden, Ladefehler, leerer und gefüllter Bestand sowie offenes Eingabeblatt. Ein fehlgeschlagener Speicherversuch lässt das Blatt offen und zeigt einen wiederholbaren Fehler. Der leere Zustand wurde in UI-Tests geprüft, ohne dafür echte Lerndaten zu löschen.

| Gefüllter Bestand, Light Mode | Eingabeblatt, Dark Mode |
| --- | --- |
| ![Persönliche Fächer](../pr-screenshots/DAY-187-subjects-settings-list-light.png) | ![Fach hinzufügen](../pr-screenshots/DAY-187-subjects-settings-add-dark.png) |

Die Simulatorbilder stammen vom lokalen Entwicklungsclient. Für das zweite Bild wurde das Eingabeblatt nur zur Vorschau geöffnet; es wurde kein Fach gespeichert.

## Umfang und Review-Grenze

Dieser UI-PR baut auf der bestehenden Fach-Abhängigkeitskette auf: #655 → #710 → dieser PR. Er ändert keine Convex-Funktionen, keine Fach-Datenstruktur und keine Lernzeiten-Logik. Jakob sollte insbesondere den Ein-Aktions-Leerzustand, die Benennung der dauerhaften Speicherung, den Tastaturzustand und Light/Dark vergleichen. Der PR ist keine isolierte Merge-Freigabe vor seinen Parents.
