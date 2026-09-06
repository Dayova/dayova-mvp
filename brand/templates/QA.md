# Validation — 6 September 2026

## Second visual audit and corrections

- Reviewed all 20 reference-PDF pages individually at 1280 × 720, including
  the cover, process, initial placeholders, tables, chart, dark layouts and
  footer text. Corrected optical centering on pages 1, 8, 16 and 18; table
  vertical alignment on page 13; process connector alignment; and missing
  arrow glyphs on page 19. Normal table text shares one baseline per row.
- `python brand/templates/check_layout.py` measures visible rendered ink at
  3× resolution and normalizes offsets to the 1280 × 720 source canvas.
  It fails against the original committed PDF: process labels were roughly
  8 canvas pixels too high. The corrected twelve circle/button labels have
  at most 0.167 canvas pixels vertical and 0.667 horizontal displacement.
  `dist/layout-check.json` contains the measured values. Assertions cannot
  silently be disabled: the checker refuses Python's `-O` mode.
- Canva: saved 28 position corrections on pages 1/8/13/16/18 and replaced
  missing arrow separators on page 19. The existing master ID is retained.
  Individual page review additionally found collapsed blank paragraphs on
  pages 6/10/12/17. Restored six body blocks using nonbreaking-space blank
  lines and included that import fix in the HTML source. All editing
  transactions were committed; previews were displayed before saving.
  The final pass also aligned the dark-content text optically with its bullets
  and restored regular-weight supporting text on the three dark Canva pages.
  All 20 Canva pages were inspected individually in the editor; corrected
  pages were also checked through editing-transaction previews.
- Google Sheets: visually inspected all five tabs. Aligned dashboard values
  with their labels and centered narrow minutes/completion columns. Exported
  before and after the formatting edits: every populated cell's data/formula
  is unchanged across all five tabs. No cached formula errors. Current values
  remain 6 / 50% / 160 minutes and €210 / €205 / €5. Verified formatting at
  both first and last supported input rows in the fresh native export.
- Revalidated the editable PPTX/POTX/XLSX packages, XML, all slide bounds,
  notes, and native middle anchors. The numeric label correction is retained
  in the PowerPoint source, not just in the PDF preview.
- CodeRabbit reviewed this follow-up. Addressed its validation-mode and
  measurement-unit findings by refusing `-O` and explicitly naming offsets
  in source-canvas pixels. The follow-up review returned zero findings.

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

## Original logo follow-up — 6 September 2026

- Added the unchanged production `assets/dayova-logo.png` to slides 1 and 18,
  beside the optically aligned wordmark; inspected both reference-PDF renders.
- Committed both logo additions to the existing Canva master. The Start tab
  in Google Sheets has a centered in-cell logo in I2:J3; its title uses B2:H3.
  Inspected the live Start header after saving.
- Compared Google Sheets exports immediately before and after this change:
  every existing cell value and formula is identical. Both the exported Sheet
  and the local XLSX embed the original PNG bytes. PPTX embeds that same asset
  on exactly slides 1 and 18. The original PNG is included in `dist/Assets`.
- Rebuilt all formats and reran `check_layout.py`: Office packages and all
  existing optical-centering checks pass. Native PowerPoint limitation below
  still applies. CodeRabbit reviewed this follow-up with zero findings.

## Boundaries

- Native PowerPoint desktop rendering and save/reopen remain blocked. The
  supported Windows helper launched PowerPoint but repeatedly rejected its
  own returned window with `window id ... no longer belongs to
  Microsoft.Office.POWERPNT.EXE.15; current owner is
  Microsoft.Office.POWERPNT.EXE.15`. Retrying fresh window selection did not
  resolve it. Office package checks and the separate reference PDF do not
  substitute for that test. Native rendering is therefore **not certified**.
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
