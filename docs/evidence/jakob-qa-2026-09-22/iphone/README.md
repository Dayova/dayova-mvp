# iPhone: Startnachweis

23.09.2026, 00:03 CEST. Separater Simulator „Dayova Jakob Review iPhone“,
iPhone 17 / iOS 26.4; `de.dayova.app-dev`, Metro 8095, Quellstand `a53ef62`.
Dasselbe native App-Bundle wie auf dem QA-iPad. Start ohne sichtbaren nativen
Modulfehler; Willkommensscreen nach Schließen der Dev-Client-Einführung sichtbar.

<img src="dayova-iphone-welcome-final.png" width="240" alt="iPhone Willkommensscreen" />

Nur After-/Integrationsbeleg. Kein vollständiger Neunutzer- oder Login-Test.
Die Anmeldung wurde anschließend vom Nutzer durchgeführt und die Identität des
freigegebenen QA-Accounts in der App per Maestro-Assertion verifiziert.

## Lernzeiten: bestanden

23.09.2026, 00:11–00:19 CEST, Integrationsstand `216757c`.
Maestro prüfte: leer → Montag 17:00–17:30 anlegen → auf Dienstag ändern →
Löschdialog abbrechen (Dienstag bleibt im Editor) → Entfernen bestätigen →
Liste leer, Dienstag nicht mehr vorhanden. Nur der selbst angelegte Testeintrag
wurde entfernt. Die Bilder enthalten keine E-Mail-Adresse oder Zugangsdaten.

| Leer | Anlegen | Gespeichert |
| --- | --- | --- |
| <img src="dayova-iphone-times-empty.png" width="240" alt="Lernzeiten leer" /> | <img src="dayova-iphone-times-add.png" width="240" alt="Neue Lernzeit" /> | <img src="dayova-iphone-times-saved.png" width="240" alt="Montag gespeichert" /> |

| Geändert | Löschdialog | Nach Löschung |
| --- | --- | --- |
| <img src="dayova-iphone-times-updated.png" width="240" alt="Dienstag gespeichert" /> | <img src="dayova-iphone-times-delete-dialog.png" width="240" alt="Löschbestätigung" /> | <img src="dayova-iphone-times-deleted.png" width="240" alt="Liste wieder leer" /> |

Dies ist kein Nachweis für Neuregistrierung, Kontolöschung, Upload,
Wissenscheck oder vollständige Lernplan-Erstellung und kein isolierter
Before-/After-Test eines einzelnen PR-Heads.
