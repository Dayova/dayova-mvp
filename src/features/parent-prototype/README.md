# Eltern-Dashboard — wegwerfbarer nativer Prototyp

Fragestellung: Finden Eltern schnell heraus, was ansteht und wie sie passend zum Schulmaterial unterstützen können?

Start: `pnpm prototype:parents` (installierter Dayova Development Client erforderlich). Im iOS-Simulator öffnen:

```sh
xcrun simctl openurl <device-id> 'dayova://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8083'
```

Der Schalter `EXPO_PUBLIC_PARENT_PROTOTYPE=1` ersetzt ausschließlich im Entwicklungsmodus die App-Oberfläche durch diese lokale Demo. Der normale Auth-/Access-Flow wird nicht geändert. Die Demo mountet keine Account- oder Backend-Provider. Alle Inhalte und die feste Demo-Woche ab 15.10.2026 sind erfunden. Es werden keine Accounts, Einladungen, Freigaben oder KI-Anfragen angelegt.

## Vergleich

- A — Überblick (Empfehlung): nächste Arbeit und Lernsession, dann Hausaufgaben und Lernpläne.
- B — Woche: chronologische Liste von Lernterminen, Abgaben und Arbeiten.
- C — Begleiten: eine gemeinsame Mini-Übung als Einstieg, danach Termine und Inhalte.

Die native Vergleichsleiste ersetzt bewusst den browserorientierten URL-Variantenumschalter. Alle drei Varianten führen zu denselben Details. Die Leiste bietet außerdem leere und unverknüpfte Zustände. Einstieg ist die Elternübersicht; über das M oben rechts sind Freigabe und Einladungsablauf erreichbar. „Merken“ gilt pro Lernplan nur für diese Demo-Sitzung.

## Vorgeschlagener MVP

Ein eigener Elternzugang, Verbindung mit einem Kind über eine vom Kind initiierte Einladung, freigegebene Arbeiten/Tests, nächste Lernsession, Hausaufgabenstatus und materialbezogene Elternhilfen. Die Hilfen enthalten Lernziel, Gesprächsfrage, Mini-Übung, Erklärung und einen Hinweis bei Schwierigkeiten. Vorläufige zukünftige Sessions sind ausdrücklich Vorschauen; es gibt keinen erfundenen festen vollständigen Lernplan oder pauschalen Beherrschungswert.

Echte Authentifizierung, rollenbasierte Autorisierung, Freigabe/Widerruf, sichere Einladungen und die KI-Erzeugung sind spätere Implementierungsarbeit. Auch die vorgeschlagene Grenze zwischen geteilten Lernzielen und privaten Einzelantworten muss vor Produktivbau entschieden werden. Wochenberichte, Push-Nachrichten, Eltern-Chat, Notenübersicht und mehrere Kinder sind nicht Teil dieses ersten Konzepts.

Kontext: [Dayova – Future Feature Ideas](https://app.notion.com/p/e555729f115849f888993919c7f4fbed) nennt einen Parents Login. Die hier konkrete MVP-Abgrenzung ist ein Vorschlag aus der aktuellen Konzeptanfrage, keine bereits verabschiedete Produktentscheidung.

Noch kein Sieger bestätigt. Diesen Branch als Konzeptbeleg behalten; nicht als produktionsfertigen Elternzugang mergen.

## Überprüfung

TypeScript, Biome und ESLint für die geänderten App-Dateien sind geprüft. Auf iOS 26.4.1 wurden die drei Varianten, beide Lernpläne, aufklappbare Hilfen, Hausaufgabendetails sowie Leer- und Einladungszustände durchgeklickt. Dunkles Design, große Bedienungshilfen-Schrift und der Wechsel zurück wurden visuell kontrolliert; die Vergleichssteuerung scrollt bei großer Schrift mit. Android und VoiceOver wurden nicht separat geprüft. Dies ist eine Konzeptprüfung, keine Freigabe eines produktiven Elternkontos.
