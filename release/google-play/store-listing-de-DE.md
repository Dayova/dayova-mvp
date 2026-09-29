# Google Play store listing — de-DE

Public listing rechecked: 2026-09-16. App name, descriptions, category, support
email, website, privacy URL, and current release notes below match the
[German Play listing](https://play.google.com/store/apps/details?id=com.dayova&hl=de&gl=DE).
Reviewer instructions retain the August record; reviewer login was not retested.

## Main store listing

**App name (6/30 characters)**

Dayova

**Short description (75/80 characters)**

Dein persönlicher Lernbegleiter für klare Pläne und sichtbare Fortschritte.

**Full description**

Dayova ist dein persönlicher Lernbegleiter für die Schule. Aus deinen Prüfungsterminen, Schulunterlagen und verfügbaren Lernzeiten entsteht ein klarer Plan, der dich Schritt für Schritt durch die Vorbereitung führt.

Mit Dayova kannst du:

• Prüfungen und Aufgaben übersichtlich organisieren
• Schulmaterial als Grundlage für deinen persönlichen Lernplan hochladen
• in kurzen, fokussierten Lernsessions arbeiten
• deinen nächsten Lernschritt an deinen bisherigen Antworten ausrichten
• deinen Wissensstand und deine Entwicklung nachvollziehen
• Lernzeiten planen und dich an wichtige Schritte erinnern lassen

Statt dir den gesamten Lernstoff auf einmal zu zeigen, konzentriert sich Dayova auf den nächsten sinnvollen Schritt. Nach abgeschlossenen Lernsessions wird der weitere Plan anhand deiner Ergebnisse aktualisiert.

Du kannst die Lernfunktionen 14 Tage lang ohne Zahlungsmittel ausprobieren. Danach ist für die weitere Nutzung ein monatliches oder jährliches, über Google Play verwaltetes Abonnement erforderlich. Preis und Abrechnungszeitraum werden dir vor dem Kauf in Google Play angezeigt. Abonnements können in den Google-Play-Einstellungen verwaltet und gekündigt werden.

Für Dayova brauchst du ein Konto und eine Internetverbindung.

## Current release notes — 1.0.5

Verbesserte Stabilität und geringerer Speicherverbrauch.
Überarbeitete Einführung und Verbesserungen bei der Lernplanung.
Korrekturen an Android-Layouts und der Abo-Verwaltung.

## Historical first-release notes

Erste Android-Version von Dayova: Organisiere Prüfungen und Schulmaterial, erstelle persönliche Lernpläne, bearbeite fokussierte Lernsessions und behalte deine Entwicklung im Blick.

## Listing fields

| Field | Value |
| --- | --- |
| Default language | German (Germany) — de-DE |
| App or game | App |
| Free or paid | Free download; paid digital subscription after the 14-day no-card trial |
| Category | Education |
| Support email | kontakt@dayova.de (current public listing; supersedes the August `contact@dayova.de` record) |
| Website | https://dayova.com/ |
| Privacy policy | https://dayova.com/datenschutz — submitted URL; now redirects to the app-inclusive https://dayova.com/privacy. Remaining policy/implementation reconciliation is tracked under DAY-217/DAY-359; see the [Data safety draft](./data-safety-draft.md). |
| Package name | `com.dayova` |

## App access / reviewer instructions

All meaningful learning functionality requires a Dayova account. Before review,
create a dedicated, non-personal reviewer account with a stable password and a
populated synthetic learner state. Put its credentials directly in Play
Console's **App access** section; never commit them here.

Suggested instructions after the account is verified:

> Sign in with the review account supplied below. It has permanent full paid
> access and synthetic school data. No free trial, purchase, one-time code,
> two-factor authentication, or special device is required. From “Lernpläne”,
> open the prepared plan and its next session; “Analyse” shows the associated
> sample progress.

The submitted Play reviewer instructions use a dedicated synthetic Clerk
account with permanent RevenueCat `dayova_full_access`. No free trial, purchase,
OTP, 2FA, or special device is required. Credentials are stored only in Play
Console. The complete account-deletion flow remains separate open work under
DAY-183 and must not be inferred from reviewer access.

## Copy checks before submission

- Confirm every feature named above works in the exact Play internal-test build.
- Use Play-localized prices; do not hard-code euro prices in the description.
- Do not mention the parent web checkout in the Android listing while that route
  is disabled and Google Play Billing is the purchase path.
- Add English localization later if desired; German alone is sufficient for a
  Germany-first launch.
