# Lernpläne: Header an die aktuelle Heute-Seite angleichen

## Auftrag und Entscheidung

Philipp bat darum, die frühere Plus-Anpassung wiederzufinden und an die aktuelle
Heute-Seite anzupassen. Die bestehende PR #693 ist diese Änderung; deshalb bleibt
die Umsetzung auf deren Branch und Basis `main`.

- Aufgabe: eigene Lernpläne überblicken und einen weiteren Plan erstellen.
- Hierarchie: Seitentitel, Erstellen-Aktion, anschließend Plankarten.
- Primäre Aktion: das vorhandene gemeinsame blaue Verlaufs-Plus.
- Reibung: die bisherige größere Überschrift und zusätzliche obere Verschiebung
  wirkten gegenüber Heute wie ein anderer Seitenkopf.
- Entscheidung: `heading-2`, Safe-Area plus 16, horizontal 24 und gemeinsamer
  `CreateEntryButton`. Der Titel darf bei großer Schrift umbrechen; die Aktion
  bleibt ungeschrumpft. Kontextuelles Zurück zu Heute bleibt erhalten.

## Umfang

Nur der Lernpläne-Seitenkopf wird neu angepasst. Das gemeinsame Verlaufs-Plus
und die Navigation stammen bereits aus #693. Keine neue Änderung an Backend,
Lernzeiten, persönlichen Fächern oder Karten-Gesten.

Philipps Figma-Bild `lernpla.png` dient als Kartenreferenz. Der unregelmäßig
beobachtete Kartenfehler ist ohne konkreten Zustand oder Reproduktion nicht als
behoben zu bewerten. Die vorhandenen Karten-Tests decken Status-Badges,
große Schrift und Fortschrittsdarstellung ab; sie ersetzen keinen Nachweis des
gemeldeten sporadischen Fehlers. Separate Navigationsänderungen in #819 sind
nicht Bestandteil dieses Commits.

## Verifikation

- TypeScript (`tsc --noEmit`), ESLint der geänderten Dateien und Diff-Check grün.
- Vier gezielte Jest-Suites mit acht Tests grün: Seitenkopf, gemeinsamer
  Erstellen-Button, Kartenvisualisierung und Karten-Fußzeile.
- Eigene Diff-Prüfung: nur Header-Layout und dessen Extraktion; bestehende
  Rücknavigation und Zielroute unverändert, kein Zugriff auf Nutzerdaten.
- Native App aus diesem Checkout auf iOS geladen, Heute-Referenz gesehen.
  Der abschließende Lernpläne-Sichtvergleich wurde nicht durchgeführt, weil
  Philipp denselben Simulator zeitgleich für die Abnahme von #819 benötigt.
  Android und große Systemschrift wurden nicht nativ geprüft.
