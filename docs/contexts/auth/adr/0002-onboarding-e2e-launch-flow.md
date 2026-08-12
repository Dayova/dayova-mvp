# ADR: Preserve the Launch Onboarding Journey End to End

- Status: Accepted
- Date: 2026-08-12
- Owner: Jakob Rössner
- Product decision: [Onboarding E2E — launch flow, rationale and ownership](https://app.notion.com/p/3b92e87228bf817faac0f15bd19ccb29)
- Delivery: [DAY-292](https://linear.app/dayova/issue/DAY-292/comprehensive-login-and-registration-flow-review-ux-ui-animation-and)

## Context

PR 375 replaced the explanatory onboarding with one value screen followed by
seven profile/account steps. That change removed the existing three-page
introduction and every intermediate explanation without a durable product
decision. The Sunday product review required the explanation and deliberate
pacing to return.

A later code audit established that the first restored implementation still
collected study duration, a blocker, and a goal without an operational
consumer: those values changed only local payoff copy and never changed the
learning plan. The historical Figma sequence, Julius's review, and the decision
owner's 12 August direction point to a stronger purpose: collect recurring
learning-time windows that the scheduler can actually use. The backend already
exposes that contract through `userLearningTimes`; the mobile flow had stopped
supplying it.

The complete rationale, meeting evidence, ownership history, superseded work,
and product boundaries remain canonical in Notion. This ADR records only the
code-facing contract that must evolve with the implementation.

## Correction Chronology

This section records an implementation and synthesis error. It is not a claim
that Julius's input was unclear.

1. The 23 July review rejected the isolated "best learning time" screen
   because its answer was unused. It proposed a real learning-time setup at
   the payment/start boundary instead of decorative collection.
2. In Julius's detailed walkthrough at 06:14-07:10, he explicitly kept the
   weekday question. For the following time step he named two acceptable
   outcomes: collect actual learning times, or, if that made onboarding too
   long, show an explicit handoff to complete them in Settings. His objection
   was to an unused question, not to operational scheduling.
3. The first restoration in commit `37e7a0e` collapsed those scoped statements
   into the broader rule that all availability belonged in Settings or a later
   contextual step. It then collected duration, blocker, and goal and treated
   a changed local payoff as sufficient personalization. No planner, lesson,
   recommendation, or schedule consumer used blocker or goal.
4. That was the wrong synthesis. The available evidence was sufficient; the
   failure was that the implementation did not reconcile each source at the
   level of learner job, persistence, and runtime consumer. It also treated a
   decision made while time data was unused as a permanent prohibition without
   re-auditing the existing `userLearningTimes` and scheduler path.
5. After the decision owner challenged whether the answers actually changed
   the product, commit `3a4826f` replaced blocker and goal with recurring days
   and a confirmed start time. It wired duration, days, and time through
   registration into `userLearningTimes`, which the scheduler consumes.
6. Commit `44b69da` extended the same truthfulness audit to the remaining
   onboarding promises and made the consumer map a release contract.

The accepted flow therefore selects Julius's operational alternative and
deliberately does not select the payment/Settings fallback. The reason is now
explicit: the launch implementation has a real scheduler consumer, can show
the exact persisted windows before account creation, and the decision owner
accepted that value as worth the additional steps. If that consumer is removed
or completion materially harms onboarding, the payment/Settings handoff is the
documented fallback to reconsider.

Future reconciliation must preserve this distinction. "Remove an unused
screen" cannot be generalized to "remove the learner job", and local copy is
not a runtime consumer. A source conflict or deliberate deviation must be
recorded before implementation with the source statement, chosen alternative,
decision owner, rationale, trade-off, and reversal condition.

## Decision

The launch flow is ordered as follows:

1. three fixed educational intro pages;
2. name;
3. intended duration per learning day;
4. a manual explanation of how duration, days, and time become appointments;
5. one or more recurring weekdays;
6. one recurring start time;
7. an exact schedule confirmation showing days, duration, and start–end time;
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
- A required step's primary action is visibly disabled until the local answer
  is valid. Submit-time validation remains the defensive boundary; it is not
  the first indication that an empty answer is required.
- Duration, weekday selection, and start time are mandatory operational input,
  not survey data. The visible confirmation must match the derived windows.
- The native time picker keeps changes in draft state and persists an answer
  only after explicit confirmation. Cancelling the picker leaves the prior
  answer unchanged and cannot unlock the next step.
- After authentication the app maps these answers to `dailySchoolTime`,
  `studyDays`, and `learningTime`. The backend creates one `userLearningTimes`
  record per selected weekday; the learning-plan scheduler consumes those
  records directly.
- Existing `userLearningTimes` are preserved, so a repeated onboarding sync
  cannot overwrite later edits made in Settings.
- Strength, blocker, and goal are not collected until a defined product
  consumer changes learner behavior. Changing local payoff copy alone does not
  qualify as a consumer.
- The backend continues accepting legacy optional onboarding fields for older
  app versions, but the launch client neither asks for nor submits them.
- Nonessential onboarding motion follows the system reduced-motion setting.
- The profile-step progress fill animates forward and backward over 260 ms with
  a restrained ease-out. It starts at the current value on first render rather
  than replaying progress from zero, while reduced-motion users receive the new
  value immediately. The textual step count and accessibility value always
  update synchronously with the actual step.
- Registration guards synchronous repeated actions and preserves one-step back
  navigation across flow and verification. The visible back action and Android
  system/predictive back always resolve the nearest reversible state first:
  dismiss an open picker or sheet, then return one onboarding step. iOS keeps
  the native edge-pop only on the first intro page, where it returns to the auth
  choice. Later conflict-free steps use an interactive edge swipe that returns
  exactly one internal step; the intro pager and horizontal duration carousel
  retain their own horizontal gestures. Route gestures and internal edge-back
  are disabled while registration or account creation is in flight, and the
  completed account handoff remains forward-only.
- Profile or onboarding-answer persistence failures after authentication must
  replace the indefinite loader with a user-visible error and an explicit retry
  of the failed boundary. Answers remain local until persistence succeeds.
- Successful account setup does not auto-advance. It truthfully announces trial
  activation as the next step and waits for the learner's explicit CTA.
- Grade and federal state are launch profile data only. Their question copy
  must not claim that language, tasks, terminology, or recommendations already
  adapt to them. Such a promise may return only with a tested downstream
  consumer and an updated canonical decision.
- Auth-flow primary and back actions use the shared `Button` and `BackButton`
  contracts. Solid cyan selection controls use the documented `onPrimary`
  foreground instead of borrowing a theme surface token.
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

## Historical Input-Screen Reconciliation

The historical Figma sequence showed strengths, challenges, goals, weekdays,
and start time. The launch implementation intentionally selects only inputs
with a truthful release consumer:

| Historical surface | Launch behavior | Code-facing rationale |
| --- | --- | --- |
| Strength-by-subject multi-select | Removed | No launch behavior consumed the answer. Do not collect learner data that changes neither the first plan nor another product behavior. |
| Broad challenge multi-select | Removed | The prior value changed only local copy; no planner, lesson, or recommendation consumed it. |
| Broad goal multi-select | Removed | The prior value changed only local copy; collecting it created a personalization promise the product did not fulfill. |
| Weekday multi-select | Restored as a mandatory seven-day multi-select | Each selected day creates one recurring `userLearningTimes` window. |
| Preferred start time | Restored through the shared native time picker | Start plus duration derives the exact same-day end time stored for every selected day. |
| Generic personalization payoff | Replaced with exact schedule confirmation | The learner sees the same days and start–end window the backend persists and the planner consumes. |

This is a product decision, not a claim that the current rendering is already
release-ready. The complete alternatives, user rationale, trade-offs, reversal
conditions, and open proof requirements remain canonical in the linked Notion
record. Any future change to these boundaries must update that record and
DAY-292 before implementation is accepted.

## Consequences

- The flow remains 14 profile/account actions: two decorative questions were
  replaced by two operational scheduling questions.
- The old generic plan-fit promise does not return. The fact and confirmation
  describe the real persistence boundary and the Settings edit path.
- The old auto-advance defect is structurally impossible because the launch
  flow contains no timed navigation.
- Post-auth failure is recoverable in place; completion can no longer strand a
  learner behind an animation-only state.
- The former grade/state personalization claims are removed until the product
  actually consumes those values. Storing profile data is not personalization.
- DAY-60, DAY-81, DAY-235, and DAY-236 are verified as children of DAY-292.
- UI and backend tests cover multi-day input, native time input, exact window
  derivation, persistence into `userLearningTimes`, scheduler visibility,
  idempotency, registration boundaries, and first-action routing.
