# Eltern-Dashboard — nativer Prototyp

Fragestellung: Finden Eltern schnell heraus, was ansteht und wie sie passend zum Schulmaterial unterstützen können?

Start: `pnpm prototype:parents` (installierter Dayova Development Client erforderlich).

```sh
xcrun simctl openurl <device-id> 'dayova://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8083'
```

`EXPO_PUBLIC_PARENT_PROTOTYPE=1` aktiviert ausschließlich im Entwicklungsmodus die lokale Demo. Sie mountet keine Account- oder Backend-Provider. Alle Inhalte, Fortschritte und die feste Demo-Woche ab 15.10.2026 sind erfunden. Es werden keine Accounts, Einladungen, Freigaben oder KI-Anfragen angelegt.

## Gestaltung

Die Elternansicht übernimmt drei Bereiche der bestehenden App: **Heute**, **Pläne** und **Einstellungen**. Heute zeigt den nächsten Lernschritt und den originalen Wochenkalender mit Tagesagenda für Lernschritte, Arbeiten und Hausaufgaben. Pläne enthält die vollständigen Listen. Einstellungen übernimmt sämtliche Bereiche der Schülerseite und ergänzt die Familienverbindung.

Wiederverwendete App-Komponenten:

- `DayovaTabs`: originale native Tab-Leiste, aus dem App-Layout extrahiert; gleiche Beschriftungen wie in der Schüleransicht.
- `SettingsContent`: gemeinsame vollständige Einstellungsstruktur für Schüler und Eltern (Profil, Support, Lernen, App, Abo, Datenschutz). Elternaktionen werden als Callbacks übergeben.
- `SettingsCard`, `SettingsSection`, `SettingsRow`, `InsetTextField`, `Switch` und `ThemePreferenceToggle`: gleiche Formulare und native Bedienelemente.
- `DashboardCalendarHeader`, `CalendarWeekdays`, `WeekCalendar`, `CalendarPager` und `CompactDayAgenda`: originaler Kalender einschließlich Tageswechsel.

- `TodayLearningCard`: originale Verlaufskarte, Fachillustration, Badges und kleine runde Aktion; Elternaktion „So kannst du helfen“ über einen optionalen Präsentationsparameter.
- `PlansTabSwitch`: unverändert aus dem Pläne-Screen extrahierter animierter Umschalter, jetzt von beiden Screens verwendet.
- `LearningPlanCardVisual`: originale Lernplankarte mit ausgesparter Pfeilaktion, Statusbadges und Fortschrittsfuß.
- `CompactNotchedActionCard`: originale Form für Hausaufgaben, mit denselben Metadaten-/Textmustern.
- Shared `Surface`, `Button`, `BackButton`, `Text` und Icons für Details. Header und Abstände folgen Heute und Deine Pläne.

Der Prototyp ergänzt horizontales Wischen im Plänebereich; die Tabs bleiben direkt antippbar. Arbeiten und Tests sind über den Kalender und die Pläne erreichbar. Elternhilfen sind von der Heute-Karte und jedem Lernplan aus erreichbar. Die frühere Variantenleiste wurde entfernt. Leerzustand und fehlende Verbindung bleiben als untergeordnete Demo-Aktionen unter Einstellungen verfügbar.

## Umfang

Ein Kind, freigegebene Arbeiten/Tests, nächste Lernsession, Hausaufgabenstatus und materialbezogene Elternhilfen mit Gesprächsfrage, Mini-Übung und aufklappbarer Erklärung. Zukünftige Sessions sind ausdrücklich Vorschauen. Der Einladungsablauf und Freigabeumfang werden nur erklärt und simuliert.

Echte Authentifizierung, Autorisierung, Einladungen, Freigabe/Widerruf und KI-Erzeugung sind spätere Implementierungsarbeit. Die Grenze zwischen geteilten Lernzielen und privaten Einzelantworten ist ein Produktvorschlag. Der Versand von Wochenübersichten und Push-Mitteilungen ist nicht implementiert; nur die Einstellungen werden simuliert. Eltern-Chat, Noten und mehrere Kinder gehören nicht zu diesem Konzept.

Kontext: [Dayova – Future Feature Ideas](https://app.notion.com/p/e555729f115849f888993919c7f4fbed) nennt einen Parents Login. Die MVP-Abgrenzung ist noch keine verabschiedete Produktentscheidung. Diesen Branch als Konzeptbeleg behalten und nicht als produktionsfertigen Elternzugang mergen.

## Überprüfung

TypeScript, Biome und ESLint für geänderte Dateien; vorhandene UI-Tests für Heute- und Lernplankarte (19 Tests) sowie native Navigation (5 Tests). Visuelle iOS-Kontrolle der drei nativen Tabs, beider Kartenlisten, Hausaufgabendetails, Profil, Familienverbindung und simuliertem Abmelden/Wiedereinstieg. Der antippbare Listenwechsel funktioniert; die Wischgeste konnte per Simulator-Automation nicht zuverlässig bestätigt werden. Android und VoiceOver sind nicht separat geprüft. Die frühere Version wurde zusätzlich mit dunklem Design und großer Schrift geprüft; diese vollständige Prüfung ist nach dem Redesign noch offen.

## Vollständige Eltern-Einstellungen

Profil mit lokalem Speichern und Eingabeprüfung, Support-Entwurf, Mias Lernzeiten und Fächer, App-Informationen, Mitteilungsoptionen, funktionierender Designwechsel, Abo-Vorschau, KI-Einwilligung als Simulation, Datenschutz-/Nutzungsbedingungen-Vorschau, Passwortänderung und Kontolöschung als Simulation. Es werden keine Nachrichten versendet, Käufe gestartet, Zugangsdaten geändert oder Rechtstexte akzeptiert. Demo-Werte gelten nur für die laufende Ansicht; ein Neustart setzt sie zurück. Der Designwechsel verwendet die vorhandene lokale App-Präferenz.

Nach der Erweiterung: 13 bestehende Tests für Einstellungen und Navigation bestanden. iOS: Kalender-Tageswechsel, Profil speichern, Mitteilungsschalter und dunkles Design geprüft. Android, VoiceOver und vollständige Großschriftprüfung sind weiterhin offen.
