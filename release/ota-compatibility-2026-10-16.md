# Screenshot-ignore native equivalence — 16 October 2026

The exact source `5743e752b79bf4b14482d4e071843191844714eb` merges main,
including the screenshot cleanup in #881, into #869. Its [production EAS
workflow](https://expo.dev/accounts/dayova/projects/dayova/workflows/01a145ea-18d0-72ae-919c-9cb9310cf24f)
passed quality checks, CNG fingerprint generation and both production exports.
The compatibility guard correctly reported an unreviewed fingerprint mismatch.
Nothing was published or deployed by that PR workflow.

## EAS source comparison

Using EAS CLI 25.0.0, compare the previously reviewed platform fingerprints
against the exact CNG outputs of that run:

```sh
eas fingerprint:compare f92f0379d721a5c3c2bcee935878412d7d559857 57a1a902d2fb5d7b9c8abb450e3cfa02363d49ae --json --non-interactive
eas fingerprint:compare df6aacec11591f424f52decf30d1522c3fe90820 f40c556a3a6952d2c672630b516cdbdba491000b --json --non-interactive
```

The complete returned source arrays were compared, including entry identity,
hash, reasons and debug information. iOS contains 70 entries in each array;
Android contains 73. There are no added or removed entries. On each platform,
the sole changed entry is `.gitignore` (`bareGitIgnore`):

| Input | Previously reviewed input hash | Candidate input hash |
| --- | --- | --- |
| `.gitignore` | `2bdbd5b2d579fed0d3b79b5b863bc2f64ef01197` | `a3e7817a05e2e58438e3379bfd3be130c4f0fdd8` |

`git diff 5345625a51176687beb3c3ec181f4be8095c951e 5743e752b79bf4b14482d4e071843191844714eb -- .gitignore`
adds one comment and twelve ignore patterns for PNG/JPG/JPEG/WebP screenshots
under `docs/evidence`, `docs/pr-screenshots` and `docs/qa`. These patterns do not
match application assets or native sources. All other fingerprint source
objects, including native dependencies, generated native directories, config,
plugins, assets and patches, are identical to the previously reviewed hashes.
The earlier comparison of those hashes to the actual binaries remains recorded
in [the original equivalence audit](./ota-activation-2026-09-16.md#reviewed-native-equivalence).

## Compatibility decision

Under the existing [exact reviewed-equivalence policy](./README.md#gate-inputs),
record these two candidate hashes separately from the immutable build hashes:

| Platform | Actual distributed build fingerprint | Additional reviewed equivalent |
| --- | --- | --- |
| iOS build 75 | `1b690a3f1a0c5ac4d73873da35ab9c2ca695d807` | `57a1a902d2fb5d7b9c8abb450e3cfa02363d49ae` |
| Android build 25 | `d91ab0f33529c36e5e7a76ef4e9a0a3bb66f26a1` | `f40c556a3a6952d2c672630b516cdbdba491000b` |

Each record binds its original platform/build fingerprint, full audit source SHA
and this evidence. No guard logic, input classes, app version, runtime, SDK,
channel, distributed-build identity or installation provenance changes. Unknown
future hashes continue to fail closed. This is a compatibility decision about
documentation ignore rules, not a claim that the binary and source hashes match.

Independent standards and specification reviews each confirmed the complete
comparison and exact build binding, with no actionable findings. The actual
updated baseline with the production app config accepts both exact reviewed
hashes and original distributed hashes, while rejecting an unknown hash on
either platform. All 94 OTA safety, publication, diagnostics, freshness and PR
workflow tests pass in a serial local run with a 30-second timeout; the initial
parallel run hit the default five-second timeout in two config/Metro subprocess
tests. CodeRabbit's additional data/documentation review was rate limited;
the two independent reviews above completed. A fresh final-head cloud run must still confirm the exact
fingerprints and both exports. This audit does not replace
the native UI and authenticated-flow evidence limitations documented in #869.
