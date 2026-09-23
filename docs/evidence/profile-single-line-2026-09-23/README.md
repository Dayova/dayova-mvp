# iPad profile single-line correction

The iPad QA profile reproduced a long email wrapping onto a second line outside
its 60-point control despite `multiline=false` and `numberOfLines=1`.

## Isolation

Native inspection showed `RCTSinglelineTextInputView`, 344 × 58 points, Poppins
16 with explicit lineHeight 24. Removing vertical flex reduced its height to 24
but only clipped the second line, so that experiment was rejected.
Restoring flex and clearing only iOS lineHeight produced UIKit's single-line
ellipsis when unfocused and horizontal scrolling while editing. Font size,
field size, and Android lineHeight are unchanged.

## Verification and limits

- Native iPad before/after screenshots captured locally; account-bearing originals
  are not published. A synthetic unsaved input was also inspected while editing.
- TypeScript, scoped Biome and ESLint passed.
- Text-field and profile UI suites passed: 2 suites, 8 tests.
- The new iOS/Android tests check the style contract, not native text layout.
  Native screenshots remain the visual regression seam.
- A synthetic-input automation asserted the intended complete value and failed:
  the edit retained a trailing character. It is not a passing value-entry test.
  No profile save or account change was submitted.
- iPhone and Android native cross-checks remain pending. This document is not
  evidence that the overall Jakob QA checklist is complete.
