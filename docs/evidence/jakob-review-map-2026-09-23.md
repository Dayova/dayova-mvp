# Jakobs Review-Anforderungen: Nachweiszuordnung

Stand: 23.09.2026. Verantwortlich: Philipp Schossig, Codex-unterstützte Prüfung.
Dies ist eine vollständige Zuordnung für die unten genannten PRs, **keine
Behauptung vollständiger funktionaler Abnahme aller PRs**.

## Quellen und Abgrenzung

Der lokal protokollierte Discord-Abgleich umfasst 21.09. 13:03 bis 22.09. 22:21
einschließlich zitierter früherer Anforderungen, nicht die gesamte Chat-Historie.
Ein erneuter Live-Abruf am 23.09. scheiterte an Browser-Zeitüberschreitungen.
Die aktuellen PR-Beschreibungen, Reviewer und Nachweiskommentare wurden erneut
über GitHub gelesen. Keine private Discord-Unterhaltung wird hier veröffentlicht.

Anforderungen aus dem Abgleich: vergleichbare Vorher-/Nachher-Nachweise,
lesbare verkleinerte Bilder (insbesondere #651), Android-Gegenprüfung, visuelle
Evidenz für #693, #659 ausdrücklich berücksichtigen, Verantwortlichkeit und
Review-Bereitschaft kenntlich machen sowie Linear nicht voreilig auf Done setzen.
E-Mail und App-Store-Connect-Rechte sind außerhalb dieses PR-Nachweisauftrags.

## PR-Matrix

| PR / Issue | Konkreter vorhandener Beleg | Aussage und verbleibendes Kriterium |
| --- | --- | --- |
| #651 / DAY-417 | [79 gezielte Tests am exakten Head](https://github.com/Dayova/dayova-mvp/pull/651#issuecomment-5789692459); [Lernzeiten-CRUD iPad/iPhone/Android](jakob-qa-2026-09-22/README.md); [zwei Entwürfe je Gerät](jakob-qa-2026-09-23/README.md) | CRUD und Entwürfe belegt; Neunutzer-Defaults, Anpassung/Erinnerung nach Wissenscheck und exakte Before/After-Aufnahmen nicht vollständig. KI-Gate blockiert den Wissenscheck. Draft. |
| #652 / DAY-422 | [PR-Tests und native Checkliste](https://github.com/Dayova/dayova-mvp/pull/652); [iPad-Dateiupload](jakob-qa-2026-09-23/README.md) | Dateiupload ist **kein Galeriebeleg**. Einzel-/Mehrfachauswahl, iCloud, verweigerte Berechtigung und Android-Galerie fehlen. Draft. |
| #653 / DAY-402 | Exakte Before/After-Bilder und Aufnahmen: [iPhone](day-402-iphone-comparison/README.md), [iPad](day-402-ipad-comparison/README.md), [Android](day-402-android-comparison/README.md) | Vergleichsartefakte vorhanden. [Jakobs ausdrücklicher HOLD](https://github.com/Dayova/dayova-mvp/pull/653#issuecomment-5764496164) bleibt bis zu seiner visuellen Abnahme bestehen. Keine Freigabe durch diesen Bericht. |
| #655 / DAY-187 | [iPad anlegen/umbenennen/löschen, neun Bilder](jakob-qa-2026-09-22/README.md) | Gemeinsamer Stand mit #710, kein isolierter Parent/Head-Vergleich. Verknüpfte Einträge und vollständige Android-Gegenprüfung fehlen. Draft. |
| #656 / DAY-403 | [Grenztests und Evidenzanforderung](https://github.com/Dayova/dayova-mvp/pull/656); [804-Byte-QA-Dateiupload](jakob-qa-2026-09-23/README.md) | Kleine Textdatei beweist nicht 8–25 MiB, Grenzüberschreitung, Dokumentverarbeitung oder Produktion-R2. Draft. |
| #659 / DAY-423 | [51 gezielte Tests, 267 UI-Tests](https://github.com/Dayova/dayova-mvp/pull/659); [beobachteter Generation-Abbruch](jakob-qa-2026-09-23/README.md) | Fehlermeldung allein beweist keine erfolgreiche Wiederaufnahme. Material ersetzen, Antwort-/Fortschrittserhalt, gezielter Retry und erfolgreicher Abschluss offen. Nicht im 13-PR-Monitor enthalten; hier ausdrücklich erfasst. Draft, bisher kein Reviewer angefragt. |
| #661 / DAY-358 | [Passwortfeld und Serverkorrektur](https://github.com/Dayova/dayova-mvp/pull/720#issuecomment-5791575557) | Kein erfolgreicher Kontolöschungsnachweis. Passender Clerk-Zugang und Provider-/Worker-Abschluss bei Jakob; ausdrücklich ausgenommen. Draft. |
| #662 / DAY-380 | [Windows-Lasttest und Linux-CI](https://github.com/Dayova/dayova-mvp/pull/662#issuecomment-5766993348); [korrigierte Evidenzregel](https://github.com/Dayova/dayova-mvp/pull/662#issuecomment-5774972619) | Infrastruktur-PR: keine erfundenen App-Screenshots erforderlich. Ready for review; menschliche Freigabe ausstehend. Frühere pauschale Bildanforderung ist zurückgenommen. |
| #693 | [exakter iPhone-Vergleich](open-pr-audit-2026-09-22/README.md); [Android-Vergleich](day-693-android/README.md) | iPhone-Aufnahmen und Android-Stills vorhanden; Abdeckung der dokumentierten Ansichten, keine Aussage über jede denkbare Plus-Aktion. Ready for review. |
| #698 | [ursprüngliche native Testumgebung](entry-native-stack/README.md); [aktueller kombinierter Test](combined-native-retest-2026-09-23/README.md) | Originaltest verwendet Fixtures, neuer Test echte QA-App. Konflikte in #722 aufgelöst; kein Pflicht-Lernzeiten-Schritt wiedereingeführt. Release-Kaltlink gesondert. |
| #707 / DAY-415 | [PR mit UI-Beleg und Tests](https://github.com/Dayova/dayova-mvp/pull/707); `docs/pr-screenshots/DAY-415.png` | Einzelbild ersetzt keine neue echte Wiederholung über alle Phasen. QA-generierter Lernplan fehlt wegen Vertex. Ready-Status ist keine Geräteabnahme. |
| #708 / DAY-237 | [Status-Tests und manuelle Kriterien](https://github.com/Dayova/dayova-mvp/pull/708) | Busy/Erfolg/Fehler sowie VoiceOver/TalkBack und beide Themes nicht durch gemeinsame Navigationsbilder bewiesen. Ready-Status unverändert. |
| #709 / DAY-167 | [fünf Layouttests und manuelle Kriterien](https://github.com/Dayova/dayova-mvp/pull/709) | Reale Quiz-Tastatur, Vorschlagsleiste und große Schrift auf iOS plus Android-Gegenprüfung offen; echter QA-Quiz durch Vertex blockiert. |
| #710 / DAY-187 | [Fehlerbehandlung und Tests](day-187-subject-query-recovery/README.md); [gemeinsame iPad-CRUD-Bilder](jakob-qa-2026-09-22/README.md) | CRUD belegt, nicht alle Tastatur-/Fehlerzustände isoliert am PR-Head. Auf #655 gestapelt. Ready-Status unverändert. |
| #711 / DAY-445 | [gemeinsame Löschdialoge iPad/iPhone/Android](jakob-qa-2026-09-22/README.md); [neun Sheet-Tests](https://github.com/Dayova/dayova-mvp/pull/711) | Lernzeiten-Löschdialog ist nicht der angeforderte Lernplan-Dialog. Dessen Light/Dark/Loading und Safe-Area-Vergleich noch zu belegen. |
| #720 | [kombinierter Test und drei neue Gerätestills](combined-native-retest-2026-09-23/README.md) | 35 lokale Screenshots; 83 Suites/385 UI-Tests; Typecheck. Kein individueller Before/After-Ersatz, kein Merge nach main, kein OTA. |
| #721 | [iPhone: ganztägig vorher/nachher](agenda-time-label-2026-09-23/README.md) | In QA-Branch integriert; GitHub zeigt MERGED in QA, **nicht main**. |
| #722 | [Konfliktauflösung](native-entry-integration-2026-09-23/README.md); [drei Plattformen](combined-native-retest-2026-09-23/README.md) | In QA integriert; GitHub zeigt MERGED in QA, **nicht main**. |
| #723 | [Profilfeld-Isolation und Geräteprüfung](profile-single-line-2026-09-23/README.md) | Code in QA integriert, PR weiterhin offen auf #721-Branch. Private E-Mail-Bilder nur lokal; keine erfolgreiche Profiländerung behauptet. |

## Veröffentlichung / Review

Neu: [drei Navigationsvideos und neun Screenshots](navigation-final-2026-09-23/README.md)
für #698, #722 und #720. Abgebrochene/vollständige iOS-Randgeste sowie Android
System-Back und Auswahlerhalt sind jetzt am gemeinsamen QA-Stand dokumentiert.
Das ersetzt nicht den weiterhin offenen Release-Kaltlink-Test.

Vorhandene öffentliche Belege bleiben über die Matrix direkt erreichbar.
Neue Accountbilder bleiben lokal. Die Original-PRs behalten ihren Reviewstatus;
kein HOLD wird aufgehoben und kein Linear-Issue ohne Abnahme geschlossen.
Eine spätere Meldung „alles erledigt“ setzt die tatsächlich fehlenden Tests voraus.
