# Validation — 6 September 2026

## Completed

- Parsed all PPTX/POTX/XLSX XML parts and checked ZIP integrity.
- Reopened the PPTX: 20 slides, speaker notes on every slide, one native chart,
  one native table, editable text and shapes, no shapes beyond slide bounds.
- Verified POTX uses the template main content type and the Office theme uses
  Poppins and the Dayova accent palette.
- Inspected the 20-page shared-layout PDF contact sheet and the actual Canva
  editor/grid. Canva imported 20 pages at 1280 × 720; the editor exposed text
  and shape elements, not one full-slide image. Cover rendering was inspected
  at presentation scale. Fonts, colors, page count and basic compositions held.
- Google Sheets imported all five tabs, Poppins, formulas, chart, frozen input
  headers, validation and conditional formatting. Corrected frozen panes that
  crossed merged headings, then reimported the final build.
- Exported the final native Google Sheet as XLSX and checked cached results:
  6 learning records, 50% complete, 160 minutes; status counts 2 planned,
  1 in progress, 3 completed; budget plan €210, actual €205, remaining €5.
  No formula-error cells appeared anywhere in that export. Final formulas use
  nonblank matching rather than text-only matching, including numeric IDs.
- Exercised the live Google Sheet with numeric ID `106` at the final supported
  row: 7 records, 4/7 complete and 170 minutes. Cleared the test row and all
  example IDs: all three summary values returned zero without errors. Restored
  the six original IDs. The sample overrun row returned −€10 and “Über Plan”.
- Contrast measured: dark text on cyan ≈7.85:1. Avoided cyan/primary-strong
  small text on white. Darkened communication secondary text because the app
  source gray was only ≈4.32:1 on off-white.
- CodeRabbit 0.7.5 reviewed the builder. Fixed numeric-ID exclusion and a fixed
  chart maximum; the follow-up review reported zero findings.

## Boundaries

- Native PowerPoint desktop rendering and save/reopen were not exercised:
  native-app computer control was unavailable in this session. Office package
  checks and the separate reference PDF do not substitute for that test.
  Install the bundled Poppins fonts and inspect line wrapping before delivery.
- Canva is an editable duplicable master, not an organizational Brand Template.
  Chart bars and table cells are editable shapes/text, not linked data objects.
- The workbook has a documented 100-record input capacity. Formula cells are
  not protected from overwriting. The Google and local copies do not sync.
- The app screenshot is recorded native evidence from the repository, not a
  fresh live-device capture. User-provided images were treated as still images.
- Color checks cover template text and backgrounds, not every pixel in the
  historical app screenshot. Full assistive-technology and mobile editing
  audits were not performed.
