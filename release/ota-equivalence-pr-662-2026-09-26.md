# PR #662 native fingerprint equivalence review — 26 September 2026

The [PR run](https://expo.dev/accounts/dayova/projects/dayova/workflows/01a0dda4-f698-7463-a749-3e5fe21ab9d2) checked source
`2e3ccd579d170887f6c88980e419ca6a44b7e024`. Its production CNG fingerprint
job and both platform exports completed, but the OTA guard correctly rejected
unlisted fingerprints. The verified distributed binaries remain iOS build 75
and Android build 25 from source `96f8fe31bac3cccc6100b703d06ce7f9b27aefa5`.

| Platform | Distributed build hash | PR source hash | EAS source entries |
| --- | --- | --- | --- |
| iOS | `1b690a3f1a0c5ac4d73873da35ab9c2ca695d807` | `0d4d8c27e554a284c2e5cbdbfc8b169737cd3965` | 70 in each |
| Android | `d91ab0f33529c36e5e7a76ef4e9a0a3bb66f26a1` | `392680bd43db4eae74d334e9b1a8ff6e4da14517` | 73 in each |

`eas fingerprint:compare` compared each pair of remote EAS hashes. Both
platforms have exactly the same source entries, with only two changed hashes:

| Source | Build hash | PR source hash |
| --- | --- | --- |
| `.gitignore` | `75a431a2e9fb65f762fcb8a513125f435b273242` | `2bdbd5b2d579fed0d3b79b5b863bc2f64ef01197` |
| `packageJson:scripts` | `d6b49aa9f36af0b0b2c1e8a3a151bc19e6096aa1` | `fed306f54580ed1e292654ca7076d650e235a3de` |

For these two inputs, the Git diff from the build source to the checked PR
source adds only `/.maestro/artifacts/` to `.gitignore` and the `test:smoke:android`,
`test:smoke:ios`, and `test:unit:expo-config` scripts to `package.json`. These
commands run only when invoked by a developer or test workflow. They are not
native build or install hooks. No dependency, plugin, asset, patch, generated
native source, or other fingerprint source hash changed. PR #662's remaining
changes are test code and documentation; intervening app changes from `main`
do not alter the native fingerprint sources.

The two exact PR hashes are therefore reviewed as native-equivalent to their
respective verified builds. The baseline retains each binary's original hash
and binds the additional accepted hash to this full audit source SHA and this
comparison. Unknown hashes still fail closed. This review does not publish an
OTA update or replace device and distribution verification. The merged `main`
commit must pass its own production checks before any update is published.
