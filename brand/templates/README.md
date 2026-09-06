# Dayova communication template kit

Version 1.0 · 6 September 2026 · German-first.

Visual correction revision: optically centered badges/initials/actions,
consistent table alignment, restored Canva paragraph spacing and aligned
spreadsheet metrics. See `QA.md` for measurements and the outstanding native
PowerPoint rendering check.

The original Dayova image mark accompanies the wordmark on the title and
closing slides and appears in the Start worksheet header. Reuse the unchanged
transparent PNG in `dist/Assets/dayova-logo.png`; preserve its proportions and
padding. Interior slides retain the quieter wordmark treatment.

The cover now uses an exact crop of the recorded native `LearningPathVisual`
artwork (30 August 2026, source commit `c576928`). It replaces the invented
numbered stair graphic. The image is replaceable as one asset; its internal
nodes are deliberately not reconstructed as editable presentation shapes.
`dist/Assets/dayova-learning-path.png` preserves the source pixels within crop
box `(430, 375, 950, 1085)`. Refresh from real product evidence after a redesign.

- [Canva master](https://www.canva.com/d/V3bfWBUDPvnLAPb)
- [Google Sheets master](https://docs.google.com/spreadsheets/d/1ClE8G9dB5NRH9ctSDZWapyqK85FrSm8Fri0-BQM4ues/edit)
- [Canonical design decision in Notion](https://app.notion.com/p/3d32e87228bf81ec8b1ae2c3e2c3c052)

## Open and reuse

**PowerPoint:** install the supplied Poppins Regular and SemiBold fonts from
`dist/Fonts` first, then open `Dayova-Presentation.potx` to create a new deck.
Alternatively open the PPTX and Save As a new file. Duplicate the relevant
example slides rather than using PowerPoint's stock New Slide layouts. This is
a 20-slide layout library packaged as a real POTX template, not 20 custom
Slide Master layouts. Text, shapes, the table and the chart are editable.
For the chart, use Edit Data; the vertical axis scales automatically from zero.
Read the speaker notes for each layout's instructions.

**Canva:** open the master and use File → Make a copy before editing. Duplicate
pages, replace bracketed text, and retain the proportions. The imported chart
uses editable bars and labels; update both the bars and labels manually,
including the scale when values change. It is not linked to a data source.
This is a duplicable editable design, not an organization-wide Canva Brand
Template or Brand Kit (the connected account had neither configured).
The two earlier import drafts are superseded by the design named
“Dayova · MASTER · Vorlagen-Kit v1.0” linked above.

**Google Sheets:** open the master, then File → Make a copy. It contains Start,
Dashboard, Lernschritte, Budget and Marke. The XLSX is the portable offline copy
and can be uploaded through File → Import → Upload to create another native
Google spreadsheet. Reopening the import dialog and cancelling at the final
import-options dialog cleared a lingering Google import overlay during QA.

Use the blue-tinted cells in rows 7–106 for up to 100 records. Replace the six
learning examples and three budget examples with real inputs, or clear those
input fields to start empty. Keep the formulas in Lernschritte column I and
Budget columns F/H/I. Input IDs/positions may be text or numbers; blank ones
exclude a row from the dashboard. Status and type have dropdowns; minutes
accept whole numbers 0–1440; budget inputs accept nonnegative numbers. To use
more than 100 records, extend formulas, filters and validations together.
Calculated cells are visually separated but are not access-protected.

Budget columns: Plan = quantity × unit price; Rest = Plan − Ist. A negative
remainder shows “Über Plan”. Amounts are fictional operational examples, not
Dayova prices, forecasts or accounting advice. No App, Linear or live-data
synchronization is configured. Linear remains the source of truth for issues.

Remove instruction and brand-guide slides before presenting. Replace every
bracketed placeholder. Example data and the quote placeholder must never be
represented as real Dayova results or customer testimonials. Update the product
screenshot from a real current app rendering before public use.

## Files

| File | Purpose |
| --- | --- |
| `dist/Dayova-Presentation.potx` | Reusable PowerPoint template |
| `dist/Dayova-Presentation.pptx` | Editable presentation library |
| `dist/Dayova-Workbook.xlsx` | Branded workbook with formulas, validation and chart |
| `dist/Dayova-Canva.html` | Self-contained 20-page editable Canva import source |
| `dist/Dayova-Reference.pdf` | Vector visual reference with Poppins preserved |
| `dist/Dayova-Overview.png` | Contact sheet of all layouts |
| `dist/Dayova-Cover.png` | Current cover preview |
| `dist/Fonts/` | Original fonts and SIL Open Font License |
| `dist/brand-tokens.json` | Versioned communication tokens |
| `QA.md` | Exact checks and remaining verification limitations |

Layouts: cover, usage guide, agenda, chapter, key message, two columns, three
building blocks, process, app evidence, image and text, metrics, chart, table,
timeline, quote, people, options, closing, brand reference, dark content.

## Sources and implementation contract

The [website](https://dayova.com) was inspected on 6 September 2026. The app's
current semantic tokens and recorded native onboarding evidence informed this
kit. See `docs/contexts/design-system/CONTEXT.md` and its linked July 2026
Figma/app decision. The supplied screenshots are historical reference, not
instructions or an authority over the current app.

The canonical rationale, alternatives and review triggers live in Notion.
Implementation-critical differences are:

- 1280 × 720 communication canvas, 56 px margins and presentation-sized type.
- Poppins retained; no unsupported external fonts or paid imagery.
- Cyan uses dark text. Communication-only secondary text is `#5F6B7C`;
  the app's original `#697586` is retained as `appMuted` for provenance.
- Native editable Office elements and simple Canva geometry are preferred
  over rasterized slides. Product artwork uses recorded native pixels; the
  cover's former abstract route has been removed.
- No app tokens or flows were changed. No platform is automatically synchronized.

## Rebuild

Use a Python environment with `requirements.txt`, then run:

```text
python -m pip install -r brand/templates/requirements.txt
python brand/templates/build.py
python brand/templates/check_layout.py
```

The builder reads existing repository fonts, the original logo and two recorded
app screenshots (daily guidance and the shared learning path).
It requires no API credentials, makes no network calls, and writes only under
`brand/templates/dist`. The distributed PDF is rendered from the shared layout
model; it is not a PowerPoint-produced PDF and does not prove PowerPoint's
native rendering. Live Google/Canva changes require an explicit reimport; a
local rebuild does not modify cloud documents.

Poppins license source:
https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/OFL.txt
