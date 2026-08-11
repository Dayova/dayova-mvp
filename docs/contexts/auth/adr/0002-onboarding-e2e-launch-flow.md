# ADR: Preserve the Launch Onboarding Journey End to End

- Status: Accepted
- Date: 2026-08-11
- Owner: Jakob Rössner
- Product decision: [Onboarding E2E — launch flow, rationale and ownership](https://app.notion.com/p/3b92e87228bf817faac0f15bd19ccb29)
- Delivery: [DAY-292](https://linear.app/dayova/issue/DAY-292/comprehensive-login-and-registration-flow-review-ux-ui-animation-and)

## Context

PR 375 replaced the explanatory onboarding with one value screen followed by
seven profile/account steps. That change removed the existing three-page
introduction and every intermediate personalization or explanation without a
durable product decision. The Sunday product review required the explanation
and deliberate pacing to return, while the earlier 23 July review had already
identified specific legacy availability questions as redundant or unused.

The complete rationale, meeting evidence, ownership history, superseded work,
and product boundaries remain canonical in Notion. This ADR records only the
code-facing contract that must evolve with the implementation.

## Decision

The launch flow is ordered as follows:

1. three fixed educational intro pages;
2. name;
3. current study-time estimate;
4. a manual personalized study-time fact;
5. one primary blocker;
6. one first goal;
7. a payoff that visibly uses the learner's answers;
8. grade, federal state, and bounded school type;
9. date of birth as explicit year, month, then day selection;
10. email with a remote existing-account check at the email boundary;
11. password, six-digit verification, and account creation;
12. trial activation and a direct first-exam action from the empty home state.

The following constraints are part of the contract:

- Intro pages remain a fixed three-page native pager with stable keys.
- Question/profile progress starts after the intro and includes informational
  steps so the visible count matches the remaining forward actions.
- No screen advances on a timer or animation callback.
- Grade, state, school type, and every birth-date part require explicit input.
- Challenge and goal store stable keys; the UI resolves localized labels and
  payoff copy from one typed module.
- `studyTime`, `challenge`, and `goal` are saved after authentication because
  they affect the visible payoff and remain useful onboarding context.
- Strength-by-subject and registration-time availability fields are not
  collected. Availability belongs in Settings or a contextual scheduling step.
- Nonessential onboarding motion follows the system reduced-motion setting.
- Registration guards synchronous repeated actions and preserves internal back
  navigation across flow, verification, and creation stages.
- Changes to order, collected fields, deferred fields, or the first-action
  handoff require an updated or superseding canonical Notion decision.
- Historical Figma screens and prior implementations are evidence, not release
  authorities. A deliberate divergence is allowed only when the canonical
  product record captures the learner problem, alternatives, rationale,
  trade-offs, reversal condition, and verification evidence.
- An implemented or visually polished change is not complete while its
  decision-to-code-to-evidence chain is missing. PR 458 remains draft and
  DAY-292 remains in progress until the traceability and native acceptance
  gates in the canonical product record are closed by the decision owner.

The changed event contract uses `onboarding_version: 3`.

## Historical Personalization-Screen Reconciliation

The historical Figma sequence showed strengths, challenges, and goals as dense
chip or row selectors. The launch implementation intentionally differs:

| Historical surface | Launch behavior | Code-facing rationale |
| --- | --- | --- |
| Strength-by-subject multi-select | Removed | No launch behavior consumed the answer. Do not collect learner data that neither changes the immediate payoff nor the first plan. |
| Broad challenge multi-select | Six explanatory cards; one primary blocker | A single stable key gives the payoff and downstream behavior one unambiguous priority. Labels and descriptions must remain readable and accessible at supported sizes. |
| Broad goal multi-select | Five explanatory cards; one first goal | One initial outcome avoids conflicting personalization. Additional goals are deferred instead of increasing registration friction. |
| No immediate proof of personalization | Added personalized payoff | Study time, blocker, and goal must visibly change the result before required profile/account collection continues. |

This is a product decision, not a claim that the current rendering is already
release-ready. The complete alternatives, user rationale, trade-offs, reversal
conditions, and open proof requirements remain canonical in the linked Notion
record. Any future change to these boundaries must update that record and
DAY-292 before implementation is accepted.

## Consequences

- The flow is longer than the compact profile setup, but every retained
  non-account step either explains the real product or changes the immediate
  personalized outcome.
- The old generic plan-fit and availability fact screens do not return.
- The old auto-advance defect is structurally impossible because the launch
  flow contains no timed navigation.
- DAY-60, DAY-81, DAY-235, and DAY-236 are verified as children of DAY-292.
- UI tests cover flow order, explicit selection, personalized output,
  registration boundaries, keyboard-safe layout, and first-action routing.
