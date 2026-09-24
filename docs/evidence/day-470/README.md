# DAY-470 — adaptive popup evidence

PR: https://github.com/Dayova/dayova-mvp/pull/726

## Before this PR / With this PR

Actual native captures from **before `00c5b190`** and **with this PR `0b88a0c4`** (product code unchanged from `dcb47876`). Same iPhone 16 / iOS 26.5, portrait, light appearance, standard iOS `large` text, and identical fixture content. Each preview is 180 px wide; click for the original.

| Before this PR | With this PR |
| :---: | :---: |
| <strong>Short material prompt</strong><br><a href="https://github.com/user-attachments/assets/211f87e5-25b6-4e10-8a62-8ea5cc3c9a93"><img src="https://github.com/user-attachments/assets/211f87e5-25b6-4e10-8a62-8ea5cc3c9a93" alt="DAY-470 before PR material-top" width="180" /></a> | <strong>Short material prompt</strong><br><a href="https://github.com/user-attachments/assets/f090be5c-6a50-43b5-8a96-8050b1550fea"><img src="https://github.com/user-attachments/assets/f090be5c-6a50-43b5-8a96-8050b1550fea" alt="DAY-470 with PR material-top" width="180" /></a> |
| <strong>App Information</strong><br><a href="https://github.com/user-attachments/assets/3d9733bc-7b51-43ed-b7ac-5156eba0e3e2"><img src="https://github.com/user-attachments/assets/3d9733bc-7b51-43ed-b7ac-5156eba0e3e2" alt="DAY-470 before PR info-top" width="180" /></a> | <strong>App Information</strong><br><a href="https://github.com/user-attachments/assets/43669492-af88-4910-afa1-4241efe741d7"><img src="https://github.com/user-attachments/assets/43669492-af88-4910-afa1-4241efe741d7" alt="DAY-470 with PR info-top" width="180" /></a> |
| <strong>18 topics · opened</strong><br><a href="https://github.com/user-attachments/assets/a3b66829-8f6e-4122-acd0-fdf445501214"><img src="https://github.com/user-attachments/assets/a3b66829-8f6e-4122-acd0-fdf445501214" alt="DAY-470 before PR long-material-top" width="180" /></a> | <strong>18 topics · opened</strong><br><a href="https://github.com/user-attachments/assets/a4484d4e-44ca-4aa5-bf1b-771c74ceda28"><img src="https://github.com/user-attachments/assets/a4484d4e-44ca-4aa5-bf1b-771c74ceda28" alt="DAY-470 with PR long-material-top" width="180" /></a> |
| <strong>18 topics · scrolled to end</strong><br><a href="https://github.com/user-attachments/assets/f9e657ae-f2cf-4214-a6d9-1899f1661541"><img src="https://github.com/user-attachments/assets/f9e657ae-f2cf-4214-a6d9-1899f1661541" alt="DAY-470 before PR long-material-end" width="180" /></a> | <strong>18 topics · scrolled to end</strong><br><a href="https://github.com/user-attachments/assets/7ed91368-545e-4be7-bee0-f8bcf1f43701"><img src="https://github.com/user-attachments/assets/7ed91368-545e-4be7-bee0-f8bcf1f43701" alt="DAY-470 with PR long-material-end" width="180" /></a> |

The last two rows cover the long-text requirement from **#649**, with **18 topics** on both sides. At the top, both versions use the same maximum sheet height. At the end, both show topic 18 and the full final paragraph above the pinned actions. With this PR, the heading scrolls away to leave more room for text. These are separate runs of the two code snapshots, not top/end images relabeled as before/after.

App Information uses fixed diagnostic values and the original caller layout/props for each snapshot; the displayed OTA ID is fixture data, not the running preview bundle. Material captures use the real `MaterialRequiredSheet`. The gallery and developer-tools bubble are test-only.

## Capture method for the baseline comparison

Captured on 2026-09-24. Two isolated preview directories load the source tree from
`00c5b190714ec2c4946c1190ed6078b6ed77b285` and
`0b88a0c44f1bbab734e4011f7c5875de33f82a73`, respectively. The latter changes only
documentation relative to product commit `dcb47876`. Neither capture includes
later follow-up PRs. Both use the same installed development client, dependency
runtime, Poppins fonts, gallery, simulator, appearance, and text settings.
The only shared theme override makes the fixture follow simulator appearance.
The new root `SheetSafeAreaProvider` is included only on the PR side, as in the app.

The short fixture uses `Englisch` and `Textanalyse und Zeitformen`. The long fixture
uses the 18-topic generator below. App Information mirrors the real caller's
seven rows and uses deterministic values from the report, including its OTA ID;
those values do **not** identify the preview's running bundle. Its baseline uses
`size="medium" scrollable`; the PR removes `size` and uses the new scrollable
default, matching the respective production callers.

Each run opens short material, App Information, and long material through the
same gallery deep links, waits for the heading and animation, and captures the
opened state. It then performs seven upward swipes from 65% to 30% screen height
(450 ms each) and asserts `Material hochladen` and `Später` before capturing the
end. Both Maestro runs passed. All eight PNGs were inspected: the final topic and
full explanation are visible in both end states. Screenshots are unedited;
only their HTML display width is reduced. Asset URLs and file hashes are recorded
in [comparison-provenance.json](comparison-provenance.json).

## Regression case from #649

The long-content requirement from [#649](https://github.com/Dayova/dayova-mvp/pull/649)
remains part of the shared sheet contract. Short content determines its own height;
long content grows to the viewport cap and then scrolls.

The dedicated material fixture uses the real `MaterialRequiredSheet`, subject
`Englisch`, and 18 newline-separated topics generated with:

```ts
Array.from(
  { length: 18 },
  (_, index) => `Thema ${index + 1}: Grammatik und ausführliche Textanalyse`,
).join("\n");
```

This is an isolated component fixture, not an authenticated production flow or a
claim about the usefulness of AI-generated learning plans. The gallery background
and development-tools bubble are test-only.

## Expected behavior and reviewer walkthrough

1. Open the short material prompt: its height fits the content without a large gap.
2. Open the 18-topic fixture at standard text size: both actions remain visible.
3. Scroll to topic 18 and the final explanatory paragraph: neither is hidden behind
   the pinned actions; both actions remain visible.
4. Repeat at iOS `accessibility-large` text size: the heading uses the full text
   width and the actions become part of the scroll content.
5. Scroll to the end: the final topic, explanation, and both actions are reachable.
6. Tap `Später`: the fixture closes.

Unlike #649, the heading intentionally scrolls with the body. It does not reserve
permanent height when enlarged. Actions are pinned only if the viewport and their
measured height leave sufficient reading space. See [the sheet contract](../../bottom-sheets.md).

## Earlier PR-only capture matrix

The four earlier PR-only captures below use the same 18-topic fixture on an iPhone 16 simulator
(iOS 26.5, portrait, light appearance). Standard text is iOS `large`; enlarged
text is iOS `accessibility-large`. The app source is commit `dcb47876`.

| Text setting | Top of dialog | End of dialog |
| --- | --- | --- |
| Standard | Heading, early topics, and both pinned actions | Topic 18 and final explanation above both pinned actions |
| Accessibility large | Full-width heading; content scrolls with its actions | Final explanation and both actions reached by scrolling |

The native checks assert both action labels at the beginning and end for standard
text, and at the end for enlarged text. Screenshots are inspected separately for
content clipping and the bottom system inset. Both native Maestro flows passed;
the standard end capture shows topic 18 and the full concluding paragraph. The
enlarged end capture shows the full concluding paragraph and both buttons.

## Earlier PR-only scroll evidence

Click a compact preview to view the original screenshot. Each pair shows the same
current implementation before and after scrolling.

| Standard · top | Standard · end | Large text · top | Large text · end |
| :---: | :---: | :---: | :---: |
| <a href="https://github.com/user-attachments/assets/f94ff77a-41db-4ee6-935d-e81354c7b937"><img src="https://github.com/user-attachments/assets/f94ff77a-41db-4ee6-935d-e81354c7b937" alt="DAY-470 long material standard top" width="160" /></a> | <a href="https://github.com/user-attachments/assets/1b7002c2-9fb7-43f4-88ca-b68fdc9c5d76"><img src="https://github.com/user-attachments/assets/1b7002c2-9fb7-43f4-88ca-b68fdc9c5d76" alt="DAY-470 long material standard end" width="160" /></a> | <a href="https://github.com/user-attachments/assets/adc6ec5d-93b1-4866-a565-7a8f9a068a50"><img src="https://github.com/user-attachments/assets/adc6ec5d-93b1-4866-a565-7a8f9a068a50" alt="DAY-470 long material enlarged top" width="160" /></a> | <a href="https://github.com/user-attachments/assets/a6373871-6c4e-4125-8ae3-3d2ac91f1fb0"><img src="https://github.com/user-attachments/assets/a6373871-6c4e-4125-8ae3-3d2ac91f1fb0" alt="DAY-470 long material enlarged end" width="160" /></a> |

## Coverage limits

The attached native screenshots are still-image evidence of the inspected states.
They are not recordings of every intermediate animation. Native VoiceOver/TalkBack
navigation, iOS date-wheel gestures, and full authenticated app regression are not
covered. Constrained/landscape sizing has automated layout coverage; this dedicated
material capture uses a portrait iPhone 16 simulator.
