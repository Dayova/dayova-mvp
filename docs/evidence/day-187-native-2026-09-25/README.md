# DAY-187 native QA: acceptance not passed

Date: 2026-09-25 Europe/Berlin. Source: exact PR #655 revision `6dbd96107f8a804e6764b3581d57adbcc03f9a8f`, tracked source unchanged during capture. iOS 26.4 simulator `47731F12-CE91-4857-8F3A-799040A0DCA3`, existing `de.dayova.app-dev` client, light mode, 1206 × 2622 PNGs. Metro port 8091 `/json/list` confirmed this device/app on runtime page 5. No application/backend code was changed.

Four focused Jest dialog tests passed on this revision. Native testing used the installed Maestro with the installed ARM JDK 17; the default Intel Java was incompatible.

## Native observations

1. Open `dayova://entry/new?type=exam`, choose Test, open Prüfungsart hinzufügen: dialog opens; original `exam-dialog.png` shows input and primary action, with cancel below the visible viewport.
2. Focus Name der Prüfungsart and enter QA text: `exam-keyboard.png` shows the keyboard and dimmed underlying exam screen, but not the dialog/input. The underlying Weiter action has moved above the keyboard.
3. Full flow could not reach Abbrechen after hideKeyboard and a 20-second scroll search; acceptance failed. Subsequent steps comparing Fach hinzufügen were not executed.
4. A second minimal run omitted hideKeyboard and scrolling. Its original keyboard screenshot reproduced the missing visible sheet. However, Maestro's assertVisible checks for the input and close control passed. Accessibility presence must not be mistaken for correct visual rendering here.

The two native runs are not a completed acceptance. The cause is not established. No exam or permanent subject was saved. Android and enlarged-text checks remain unperformed.

## Reproduction

Connect the existing development client to the exact source revision on port 8091; open the exam creation route above. Use `flow.yaml` for the full intended comparison, or `keyboard-repro.yaml` from the exam-type list for the minimal visual reproduction. Store screenshots using Maestro's test-output-dir option; screenshot paths in these files are relative.

Original PNGs are unedited Maestro screenshots. This evidence branch is documentation only; do not merge it as an application fix.
