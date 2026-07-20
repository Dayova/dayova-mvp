# Production OTA baseline

`production-ota-baseline.json` records the production binaries that are known to
be distributed for each platform. The automatic production OTA workflow compares
the current native fingerprints with this manifest. It does not infer safety from
the previous Git commit.

Only mark a platform's distribution as `verified` after the intended audience can
actually install that exact build. Record the EAS build ID, store build number or
version code, full source SHA, runtime version, and EAS native fingerprint. A
finished EAS build by itself is not distribution evidence.

After recording a replacement baseline, run:

```sh
APP_VARIANT=production node scripts/ota-safety.mjs
```

An all-platform update remains blocked when either platform is unverified or when
either current fingerprint differs from its distributed build. This is deliberate:
an unsafe release merge remains blocked after later JavaScript-only or formatting
commits until compatible binaries become the recorded baseline.

The current provenance and distribution evidence is tracked in
[DAY-114](https://linear.app/dayova/issue/DAY-114/replace-submitted-ios-v103-build-49-with-the-corrected-analytics).
