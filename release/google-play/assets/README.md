# Google Play asset manifest

Prepared: 2026-08-22; uploaded to the production listing under review on
2026-08-23

## Ready assets

| File | Validated properties | Intended Console slot |
| --- | --- | --- |
| `play-store-icon-512.png` | 512 × 512 PNG, RGBA, 66,136 bytes | Play Store app icon |
| `feature-graphic-1024x500.png` | 1024 × 500 PNG, 24-bit RGB/no alpha, 628,561 bytes | Feature graphic |
| `feature-graphic-source.png` | 1774 × 887 PNG, 24-bit RGB, 1,331,531 bytes | Retained generation source; do not upload instead of the exact-size file |

The icon was resized from the repository's official Dayova app mark. The
feature graphic was AI-generated from the same brand mark, then cropped/resized
and converted to the Play-safe RGB PNG above. Visual inspection found a clean
white/pale-blue composition with the Dayova Y, a learning path, checks, a
calendar, and books; it contains no promotional text, price, rating, device
frame, or store badge.

Generation brief preserved for provenance:

> Create a polished Google Play feature graphic for Dayova, a calm German
> learning-planner app. Use the provided official Dayova Y mark faithfully as
> the dominant brand element. Make a wide 2:1 composition on a white and very
> pale icy-blue background, with a subtle flowing learning path and restrained
> educational symbols such as check marks, a calendar, and books. Keep it
> premium, spacious, friendly, and crisp. No words, letters beyond the logo,
> slogans, prices, ratings, device mockups, app-store badges, or gradients that
> reduce legibility. Output a clean raster suitable for cropping to 1024 × 500.

The generated source itself is retained so the exact visible result—not prompt
text alone—is the authoritative provenance artifact.

## Ready phone-screenshot set

Upload the eight files in `screenshots/phone/` in filename order. Every final
file is a 1080 × 1920 portrait, 24-bit RGB PNG with no alpha channel. The
benefit header occupies less than 20% of the canvas; the rest is current,
readable Android UI without a physical device frame.

| Order | File | Product coverage | Suggested Play alt text |
| --- | --- | --- | --- |
| 1 | `01-dein-naechster-lernschritt.png` | Home, weekly context, next learning action | Dayova home screen showing Lea's next biology learning step and weekly progress. |
| 2 | `02-lernplaene-die-sich-anpassen.png` | Plan overview, exam date, progress | Dayova plan overview with a biology exam, adaptive next topic, duration, and remaining days. |
| 3 | `03-dein-weg-bis-zur-pruefung.png` | Populated learning path, completed and upcoming steps | Dayova learning path showing the next mitosis and meiosis session and the route toward the exam. |
| 4 | `04-aktiv-lernen.png` | Active learning session and question formats | A Dayova learning session with a multiple-choice biology question about mitosis and meiosis. |
| 5 | `05-direktes-feedback.png` | Immediate evaluation and ideal answer | Dayova feedback screen explaining a correct answer and showing the ideal answer. |
| 6 | `06-staerken-und-luecken.png` | Topic-level analysis, evidence, learning gaps | Dayova analysis ranking biology exam topics and showing securely evidenced knowledge and gaps. |
| 7 | `07-lernzeiten-die-passen.png` | Weekly learning availability | Dayova learning-time settings with Monday and Wednesday availability. |
| 8 | `08-stundenplan-verbunden.png` | School timetable and class details | Dayova timetable with an active Monday mathematics class, room, and lesson times. |

The matching lossless 1280 × 2856 captures are retained in
`screenshots/source/`. They were captured on 2026-08-22 from the current-source
Android app in German using one synthetic learner, Lea, with a consistent
biology exam, timetable, availability, learning path, session answers, and
analysis. The Expo development tools button was disabled and Android System UI
demo mode supplied a clean, consistent status bar. No personal user data is
present.

The app UI is genuine and was not generated or redrawn. Only deterministic
cropping, scaling, a rounded presentation card, and concise German benefit
headers were applied by `../scripts/compose-screenshots.cjs`. The website's
older iPhone-framed product images were intentionally not reused.

## Final asset QA

- [x] App icon is exactly 512 × 512 PNG.
- [x] Feature graphic is exactly 1024 × 500 and has no alpha channel.
- [x] Artwork uses the official brand mark and no unsupported marketing claim.
- [x] Eight phone screenshots are exactly 1080 × 1920 and have no alpha channel.
- [x] Screenshots show current Android UI, not a developer menu, browser, iPhone frame, or mock interface.
- [x] The first three screenshots prioritize the actual home, plan overview, and learning-path experience.
- [x] Headers are concise, localized to German, and confined to the top 17% of each image.
- [x] All visible learner data is synthetic and internally consistent across the set.
- [x] Store listing claims and screenshots match implemented Dayova features.
