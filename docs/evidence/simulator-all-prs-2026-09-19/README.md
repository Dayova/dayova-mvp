# Simulator-Abgleich: 19. September 2026

Repository: Dayova/dayova-mvp. Ausgangspunkt: 55045f1 (bisheriger nativer QA-Branch).
Testbranch: `codex/all-open-prs-simulator-20260919`.
Die GitHub-PRs selbst werden nicht nach main gemergt oder geschlossen.

## Umfang

37 offene PRs einschließlich Drafts geprüft. 32 PR-Head-Commits sind im Testbranch enthalten.
Analyse und Stundenplan bleiben aus der Navigation entfernt. Bei älteren Überschneidungen bleiben die neueren Abläufe erhalten.

| PR | Titel | Ergebnis |
|---|---|---|
| [#378](https://github.com/Dayova/dayova-mvp/pull/378) | Enforce per-user and per-plan AI budgets | Überholt: main hat mit PR #423 ausdrücklich den adaptiven Ablauf ohne KI-Budget-Gating übernommen (57af3f5/6d08745). |
| [#391](https://github.com/Dayova/dayova-mvp/pull/391) | Show evidence-based topic readiness on dashboard | Ausgelassen: alte Analyse-/Fortschrittsdarstellung auf dem Dashboard; basiert außerdem auf dem veralteten KI-Budget-Stack. |
| [#450](https://github.com/Dayova/dayova-mvp/pull/450) | DAY-332 Codify agent-system governance | Integriert. |
| [#484](https://github.com/Dayova/dayova-mvp/pull/484) | Keep learning plans active until mastery | Integriert. |
| [#494](https://github.com/Dayova/dayova-mvp/pull/494) | DAY-377: Fix exam flow back navigation | Integriert. |
| [#495](https://github.com/Dayova/dayova-mvp/pull/495) | Improve Analyse progress overview | Ausgelassen: entfernte Analyse-Funktion (Nutzervorgabe). |
| [#496](https://github.com/Dayova/dayova-mvp/pull/496) | fix(convex): eliminate repeated learning-material egress | Integriert. |
| [#497](https://github.com/Dayova/dayova-mvp/pull/497) | Lock iPad to full-screen portrait | Integriert. |
| [#499](https://github.com/Dayova/dayova-mvp/pull/499) | Pin Android Gradle builds to JDK 17 | Integriert. |
| [#517](https://github.com/Dayova/dayova-mvp/pull/517) | fix: enforce 13+ and define DAY-357 privacy contract | Offen / nicht integriert: verlangt ein Geburtsdatum, das der aktuelle Anmeldeablauf nicht mehr abfragt. Würde neue Registrierungen blockieren. Nutzerentscheidung ausstehend. |
| [#532](https://github.com/Dayova/dayova-mvp/pull/532) | Fix legal links across app (DAY-361) | Integriert. |
| [#534](https://github.com/Dayova/dayova-mvp/pull/534) | Add Dayova presentation and spreadsheet template kit | Integriert. |
| [#543](https://github.com/Dayova/dayova-mvp/pull/543) | Add AI consent recovery action | Integriert. |
| [#546](https://github.com/Dayova/dayova-mvp/pull/546) | Fix missing next learning session after early completion | Integriert. |
| [#584](https://github.com/Dayova/dayova-mvp/pull/584) | Fix misleading purchase failure after successful subscription | Integriert. |
| [#616](https://github.com/Dayova/dayova-mvp/pull/616) | feat: add session repeat actions (DAY-415) | Integriert. |
| [#636](https://github.com/Dayova/dayova-mvp/pull/636) | DAY-403: Improve material uploads and knowledge-check recovery | Integriert. Aktuelle 25-MiB-Dokumentgrenze und 7-MiB-Bildgrenze haben Vorrang vor der alten 10-MiB-Variante. |
| [#641](https://github.com/Dayova/dayova-mvp/pull/641) | fix: clarify entry status actions (DAY-237) | Integriert. |
| [#642](https://github.com/Dayova/dayova-mvp/pull/642) | fix: keep quiz answers above iOS keyboard (DAY-167) | Integriert. |
| [#645](https://github.com/Dayova/dayova-mvp/pull/645) | ci: report OTA compatibility before PR merge | Integriert. |
| [#646](https://github.com/Dayova/dayova-mvp/pull/646) | fix: recover Analyse next-step failures (DAY-424) | Ausgelassen: entfernte Analyse-Funktion (Nutzervorgabe). |
| [#648](https://github.com/Dayova/dayova-mvp/pull/648) | Measure feature usage against product hypotheses (DAY-435) | Integriert. Ohne Änderungen an den entfernten Analyse- und Stundenplan-Bildschirmen. |
| [#649](https://github.com/Dayova/dayova-mvp/pull/649) | fix: make material-required sheet scrollable (DAY-392) | Integriert. |
| [#651](https://github.com/Dayova/dayova-mvp/pull/651) | feat: make learning times optional and adaptive (DAY-417) | Integriert. |
| [#652](https://github.com/Dayova/dayova-mvp/pull/652) | DAY-422: Allow gallery photos in learning-plan material upload | Integriert. |
| [#653](https://github.com/Dayova/dayova-mvp/pull/653) | fix: make the Dayova welcome artwork responsive (DAY-402) | Integriert. |
| [#654](https://github.com/Dayova/dayova-mvp/pull/654) | fix: support French, Latin, and Spanish learning flows (DAY-376) | Integriert. |
| [#655](https://github.com/Dayova/dayova-mvp/pull/655) | feat: unify personal subject management (DAY-187) | Integriert. |
| [#656](https://github.com/Dayova/dayova-mvp/pull/656) | Raise learning-plan document uploads to 25 MiB (DAY-403) | Integriert. |
| [#657](https://github.com/Dayova/dayova-mvp/pull/657) | style: remove heavy interface shadows (DAY-393) | Integriert. |
| [#658](https://github.com/Dayova/dayova-mvp/pull/658) | DAY-416: Add back navigation to registration flow | Integriert. |
| [#659](https://github.com/Dayova/dayova-mvp/pull/659) | DAY-423: Recover learning plan creation after material failures | Integriert. |
| [#661](https://github.com/Dayova/dayova-mvp/pull/661) | DAY-358: Server-authoritative account deletion | Integriert. |
| [#662](https://github.com/Dayova/dayova-mvp/pull/662) | DAY-380: Stabilize Expo configuration contract tests | Integriert. |
| [#670](https://github.com/Dayova/dayova-mvp/pull/670) | Focus navigation on learning plans and homework (DAY-436) | Integriert. |
| [#671](https://github.com/Dayova/dayova-mvp/pull/671) | fix: stabilize personal subject dialogs and add subjects from Settings (DAY-187) | Integriert. |
| [#673](https://github.com/Dayova/dayova-mvp/pull/673) | fix: correct delete confirmation spacing and label contrast (DAY-445) | Integriert. |

## Validierung

- TypeScript: bestanden.
- Vitest: 138 Dateien / 937 Tests bestanden.
- Jest: 75 Suites / 329 Tests bestanden.
- ESLint für manuell zusammengeführte Backend-, Lernpfad- und Abo-Dateien: bestanden.
- Kombiniertes Backend auf vorhandenes lokales Convex-System übertragen: bestanden.
- iPhone 17 Pro / iOS 26.4 gestartet, vorhandenen DEV-Client installiert und gestartet.
- Sichtprüfung noch nicht bestätigt: Device-Hub-Bildschirmsteuerung liefert Timeouts.

## Start

```bash
cd /Users/philipp/Documents/dayova-website/.codex-worktrees/day-437-native-qa
CONVEX_AGENT_MODE=anonymous ./node_modules/.bin/convex dev --local-backend-version precompiled-2026-09-16-8600144
```

In einem zweiten Terminal:

```bash
APP_VARIANT=development ./node_modules/.bin/expo start --dev-client --lan --port 8081
```

Simulator-DEV-Client mit `http://127.0.0.1:8081` verbinden. Lokales Backend: `http://127.0.0.1:3210`.
Die Server müssen während des Tests weiterlaufen. Dies ist eine lokale Testkombination, keine Produktionsfreigabe.

## Review-Grenzen

Vorher-/Nachher-Screenshots und -Videos fehlen; die Desktop-Bildschirmsteuerung ist nicht erreichbar.
Der separate Dayova-Produktqualitätsreview aus DAY-289 ist laut Repository-Vertrag noch eine Workflow-Lücke. Ein etwaiger Integrations-PR bleibt daher Draft.

## Popup-Anordnung nach Figma-Referenzen

Umgesetzt nach den drei am 19. September bereitgestellten Figma-Bildern:
- Schließen in einer eigenen oberen Zeile; Titel erhält die volle Inhaltsbreite.
- 16 px Abstand zur Titelgruppe, 8 px zwischen Titel und Beschreibung und 24 px vor Inhalt/Aktionen.
- Inhaltsabhängige Höhe für sämtliche app-eigenen Dialogaufrufe; lange Inhalte einschließlich Aktionen bleiben scrollbar.
- Abbrechen/Später mit sichtbarer Umrandung. Große Systemschrift stapelt Bestätigungsaktionen und Auswahlkacheln.
- Kompaktere Auswahlkarten, keine abgeschnittenen Beschreibungen und keine zusätzlichen Icons über Titeln.
- Sicherheitsabstand unten berücksichtigt die Bildschirm-Safe-Area, nicht die Tab-Leiste.

Bestandsprüfung: Alle app-eigenen Popups laufen über DayovaSheetFrame, ConfirmationSheet, ActionSheet oder SelectSheet. Native Android-Datums-/Zeitdialoge bleiben systemgesteuert.
Validierung: TypeScript, 75 Jest-Suites / 329 Tests; nach der abschließenden Vereinheitlichung der Bestätigungsabstände nochmals 5 Suites / 26 Tests bestanden.
Sichtprüfung offen: Der erneute Zugriff auf Device Hub liefert `timeoutReached (-10005)`; neue Screenshots/Videos konnten deshalb nicht aufgenommen werden. Die Änderungen sind im laufenden DEV-Teststand verfügbar. Der Draft-Status und die bereits dokumentierte DAY-289-Review-Lücke bleiben bestehen.

## Prüfung erforderlicher Eingaben und Button-Zustände

Geprüfte aktive Abläufe: Registrierung/Onboarding, Login, Passwortzurücksetzung und Codeprüfung, Profil, persönliche Fächer, Prüfungs-/Hausaufgabenerstellung, Lernplan-Themen und Material, Lernzeiten, Lerneinheiten und Quizantworten. Die gemeinsame Button-Komponente reduziert deaktivierte Aktionen auf 50 Prozent Deckkraft und deaktiviert ihre Bedienung.

Geschlossene Lücken: Login verlangt gültige E-Mail und nicht leeres Passwort; Passwortzurücksetzung verlangt je Schritt gültige E-Mail, vollständigen Code oder übereinstimmende gültige Passwörter. Das Speichern einer bearbeiteten Lerneinheit verlangt eine Endzeit nach der Startzeit. Auswahlöffner und optionale Schritte bleiben bedienbar. Keine Änderungen an den entfernten Analyse-/Stundenplan-Abläufen.

Die Prüfung erfolgte anhand des Codes und automatisierter Tests; eine vollständige visuelle Prüfung aller Zustände auf dem Gerät ist weiterhin offen.

## Größere Materialpakete und Fotoaufbereitung

Upload-Kapazität pro Lernplan: 30 Dateien, zusammen 100 MiB. Einzelne Dokumente bleiben auf 25 MiB begrenzt; Fotos werden vor der Größenprüfung als JPEG mit Qualität 0,9 und maximal 3508 Pixeln an der längsten Seite aufbereitet. Kleine Bilder werden nicht hochskaliert. Die bestehende 7-MiB-Grenze für ein verarbeitetes Bild bleibt bestehen. Kamera, Mediathek und Bilddateien aus dem Dateiauswahldialog verwenden dieselbe Aufbereitung. Die Mediathek begrenzt die Auswahl auf die verbleibenden Plätze, und Client sowie Backend prüfen das Gesamtbudget.

Die Dokumentabfragen für Upload-Prüfung, Übersichten und KI-Kontext berücksichtigen jetzt ebenfalls die erhöhte Dateizahl. Die KI-Kontextlängengrenze bleibt bestehen: Die Upload-Kapazität garantiert keine vollständige Verarbeitung beliebig umfangreicher Dokumente in einer einzelnen Modellanfrage.

Validierung: 4 Backend-Testdateien / 80 Tests; 2 Jest-Suites / 9 Tests; TypeScript und ESLint bestanden. Enthalten sind parallele Uploads bis zur Kapazitätsgrenze, Abruf aller 30 Dokumente, Kontextauswahl für 30 kurze Arbeitsblätter und Fotoaufbereitung im Hoch-/Querformat. Reale Fotoqualität und ein vollständiger Upload auf dem Gerät sind noch nicht visuell geprüft.

Zusätzlicher UI-Gesamtlauf: nach acht bestandenen Suites mehrere Minuten ohne weitere Ausgabe; beendet, daher kein neuer vollständiger UI-Suite-Nachweis. Die gezielten neun UI-/Fototests sind separat vollständig bestanden. Lokaler Xcode-Workaround: ExpoModulesJSI schreibt den generierten Buildcache nun direkt nach `/tmp/dayova-expo-jsi-build-native`, weil macOS im synchronisierten Dokumente-Ordner Finder-Attribute hinzufügte und die Signatur scheiterte. Diese lokale node_modules-Anpassung gehört nicht zum Quellcode-Diff.
