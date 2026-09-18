# Personal-subject query recovery — 18 September 2026

Related: [DAY-187](https://linear.app/dayova/issue/DAY-187), [DAY-376](https://linear.app/dayova/issue/DAY-376).

The reported iPhone screens crash while rendering Settings → Personal subjects and exam/learning-plan subject selection. Both call `personalSubjects:list` through `useSubjectOptions`. Screenshot request IDs: `b4147bf09202f8c3`, `4ca9d02831725783`.

## Confirmed findings

- `useQuery` throws query errors during rendering. Previously neither consumer handled a failed subject query, so an unavailable catalog unmounted the creation flow.
- The list query applied write-time subject validation to existing active-timetable lessons. Empty or over-60-character legacy labels could reject the whole catalog, including otherwise valid personal subjects.
- The active app checkout points at `https://sleek-bulldog-130.eu-west-1.convex.cloud`. An unauthenticated HTTP query returned a generic server error, which does **not** identify the production cause. The configured CLI account was denied project access when requesting logs. No production deployment or authenticated production verification was possible.

## Changes

- Use Convex's error-returning `useQueries` API, retaining the reactive subscription and authenticated-only reads.
- Display safe German load-error text in both picker variants and Settings. Do not present an unavailable catalog as an empty personal-subject list.
- Preserve built-in selection and one-time custom subjects during catalog failures; permanent-save failures still remain visible and do not report success.
- Skip unusable legacy timetable suggestions and require lesson ownership; retain strict validation for new subjects.

## Verification

- TypeScript: `node node_modules/typescript/bin/tsc --noEmit` — passed in the scoped checkout.
- Biome and ESLint on changed source/tests — passed.
- Vitest: `convex/personalSubjects.test.ts`, `src/features/subjects/subject-catalog.test.ts` — 11 tests passed. Includes language persistence into learning plans, account isolation, rename/delete label preservation, legacy malformed labels, and unauthorized access.
- Jest: subject picker, hook, settings screen, and learning-plan creation flow — 14 tests passed. Includes query failure/recovery, sign-out, save failures, built-in and one-time language selection during failure, and preservation of navigation and form behavior.
- Separate anonymous local Convex deployment at port 3220: full schema/function push succeeded. Authenticated CLI calls to `personalSubjects:create` persisted `Französisch`, `Latein`, and `Spanisch`; `personalSubjects:list` returned all three with their IDs. Only a synthetic local test identity was used. No live learner data was changed.

## Remaining live verification

Access to `sleek-bulldog-130` is required to inspect the reported request IDs, establish the actual server-side cause, confirm that the complete personal-subject schema/functions are deployed, and publish the applicable backend fix. Do not treat graceful query failure as working permanent persistence.

After deployment, verify on the signed-in iPhone: open personal subjects in Settings; choose an exam type and continue to subjects; permanently add each language and reuse it in another flow; rename/delete a test subject; confirm saved entry labels survive deletion. Native device completion has not been claimed by this change.
