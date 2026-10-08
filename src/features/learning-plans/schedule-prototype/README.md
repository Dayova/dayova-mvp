# Throwaway learning-schedule experiment

Question: after a learner moves a session, how can the plan respect their schedule while making adaptive previews and genuine prerequisites understandable?

Three structurally different variants on `/learning-plans/demo?variant=A|B|C`, with a floating switcher. This is a separate experimental branch based on origin/main at 3a95cd0, not a continuation of DAY-424 or PR #646. No product decision has been made.

Run: `node scripts/prototype-learning-schedule.mjs` (uses the repository's existing Vite and React dependencies). The equivalent package script is `pnpm run prototype:learning-schedule` after a normal dependency installation; the Node command also works in a worktree sharing an existing node_modules directory. Open http://127.0.0.1:8766/learning-plans/demo?variant=A.

## Decision brief

- Job: understand what is next and intentionally move a learning appointment without an unexplained skip.
- Hierarchy: next actionable session; scheduled sessions; tentative future work.
- Primary action: begin the same eligible session highlighted by the visible schedule.
- Friction: remove internal committed/generated terminology, explain only actual consequences during rescheduling.
- Experimental decision: compare A chronological agenda with dated previews, B focused next appointment with an undated adaptive outlook, and C week overview with an explicit change summary. No winner selected.

## Why a separate browser harness

The host in the real app is `src/app/learning-plans/[planId]/index.tsx`, with `SessionPreviewCard` and `LearningPathVisual`. This experiment keeps its learning-plan context, German copy, Poppins, and Dayova colors, but stubs all mutations. Mounting this through the real native auth/backend shell would make comparing invented prerequisite policies slower and risk mixing real data with proposed behavior. The code lives beside that feature and is never imported by the Expo routes. It is a browser interaction demo, not proof of native rendering or production behavior. Native date sheets are represented by a semantic HTML select. No custom icon artwork.

## Try it

1. On A, move “Gleichungen verstehen” from Tuesday to Friday. Inspect the proposed changes before saving; cancel also works.
2. Inspect the new next session. Independent extra practice stays Thursday; its start button agrees with the agenda.
3. Switch to B and C with the floating arrows. Each variant resets the same selected scenario, so previous experiments do not bias the comparison.
4. Enable the simulated prerequisite. Compare moving linked work versus choosing independent work for Thursday.
5. Start and complete the simulated session. Completing extra practice does not promote the preview; completing the core session does. Pick a demonstrated result to see its effect.
6. Try generation failure, only a preview, all overdue, and an empty plan. Reset restores the selected scenario.

The experiment panel exposes all session state after actions. All data is in React memory; refresh resets it. URL stores only variant. Preparation and learning are explicitly simulated, with no AI, auth, database, analytics, notifications, or network mutations.

## Assumptions being tested, not established product rules

- Explicit prerequisites exist only when enabled in the experiment panel; no prerequisite inference from sort order.
- All variants follow scheduled order among executable work. All-overdue work offers “Jetzt nachholen”.
- A/C keep a timed preview after its source session and disclose that move before saving. B keeps its preview undated.
- Moving core theory after dependent extra practice requires an explicit choice: move linked work, or replace the extra exercise with independent revision. Cancel leaves everything untouched.
- Fixture times are a fixed September 2026 week. Real availability, exam deadlines, multi-plan conflicts, timezone conversions, and generation latency are not simulated.
- No persistent nextSessionId or schema change is proposed by this implementation.

## Verdict

Pending user exploration. No architecture, dependency policy, or UI direction approved. Do not merge this throwaway harness into production.

Tracking: [DAY-458](https://linear.app/dayova/issue/DAY-458). Prototype preserved on `codex/experiment-learning-schedule`.

## Verification (20 September 2026)

- Browser walkthrough: cancel preserves dates; saving Friday moves the dated preview after theory; independent Thursday practice becomes the visible next start in A and B.
- Both prerequisite choices exercised: linked move and independent replacement; C shows the resulting week.
- Completing extra practice does not promote the preview. Completing theory adapts the preview from the chosen simulated result; simulated preparation then enables Start.
- Preparation failure/retry, preview-only with no Start, empty plan, and all-overdue recovery exercised.
- Default desktop layout and a 390px viewport with dark theme and large text inspected. No horizontal page overflow at 390px; modal content scrolls. Browser console showed no warnings/errors in the checked flows.
- Changed-file Biome checks, Node syntax check, repository TypeScript check, and git whitespace check passed. No automated tests added for this throwaway experiment; ESLint does not configure JSX files in this repository, so no ESLint coverage is claimed.
- Browser behavior is validated, not the product hypothesis. No native device verification or real backend integration was attempted for this isolated browser harness.
