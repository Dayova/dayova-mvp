# Synthetic DAY-423 simulator fixtures

These files contain no learner data. The matching `.txt` files make the PDF content reviewable.

- `insufficient.pdf` contains only the subject name. It is intended to exercise the `insufficient_material` recovery path.
- `linear-functions.pdf` contains definitions, worked examples, and exercises on linear functions. It is intended as replacement material for a successful retry.

Both PDFs are single-page text PDFs. Ghostscript extracted the expected text from `linear-functions.pdf` and rendered it without clipping. Whether the model judges either file sufficient is a result to observe, not an assertion made by this fixture.
