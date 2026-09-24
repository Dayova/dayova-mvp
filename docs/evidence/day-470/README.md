# DAY-470 — adaptive popup evidence

PR: https://github.com/Dayova/dayova-mvp/pull/726

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

## Capture matrix

All four captures use the same 18-topic fixture on an iPhone 16 simulator
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

## Visual evidence

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
