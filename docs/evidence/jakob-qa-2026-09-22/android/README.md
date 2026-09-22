# Android: Lernzeiten – gemeinsamer QA-Stand

Aufnahme: 23.09.2026, 00:00–00:05 CEST (Hostzeit). Emulator: Pixel 9,
Android 16, `com.dayova.dev`, Metro 8095. Quellstand `a53ef62`.
Die Emulator-Statusleiste verwendet ein anderes Zeitformat als der Host.

Der entbehrliche Testaccount wurde vor der Prüfung anhand der vollständigen
Adresse im Profil verifiziert. Der Profilbeleg mit E-Mail wird nicht veröffentlicht.

Bestanden: leere Liste → Montag 17:00–17:30 anlegen → Dienstag speichern →
Löschung abbrechen (Editor und Dienstag bleiben) → Löschung bestätigen → leere Liste.
Die Ergebnisse wurden jeweils anhand der Android-UI-Hierarchie und Screenshots
geprüft. Entfernt wurde nur die eigens angelegte Testlernzeit; sie ist neu anlegbar.

| Zustand | Screenshot |
| --- | --- |
| Einstellungen | <img src="dayova-android-settings-verified.png" width="240" alt="Android Einstellungen" /> |
| Leer | <img src="dayova-android-times-empty.png" width="240" alt="Keine Lernzeiten" /> |
| Anlegen | <img src="dayova-android-times-add.png" width="240" alt="Neue Lernzeit" /> |
| Montag gespeichert | <img src="dayova-android-times-saved.png" width="240" alt="Montag gespeichert" /> |
| Dienstag gespeichert | <img src="dayova-android-times-updated.png" width="240" alt="Dienstag gespeichert" /> |
| Löschdialog | <img src="dayova-android-times-delete-dialog.png" width="240" alt="Roter Entfernen-Button mit weißer Schrift" /> |
| Abgebrochen | <img src="dayova-android-times-delete-cancelled.png" width="240" alt="Editor nach Abbruch" /> |
| Gelöscht | <img src="dayova-android-times-deleted.png" width="240" alt="Leer nach bestätigtem Entfernen" /> |

Grenzen: Integrationstest, kein isolierter PR-Vorher-/Nachhervergleich.
Keine Abnahme der altersabhängigen Defaults, Zeitpicker-Grenzfälle,
Wissenscheck-Erinnerung oder des vollständigen Lernplans. Kein Production-/OTA-Nachweis.
