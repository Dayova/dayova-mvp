---
status: accepted
---

# Model onboarding as native stack history

[DAY-349](https://linear.app/dayova/issue/DAY-349/model-onboarding-steps-as-a-native-navigation-stack)
replaces the launch-only custom edge-back approximation from
[PR #458](https://github.com/Dayova/dayova-mvp/pull/458) with real Expo Router
native-stack history. The accepted product sequence and copy remain governed by
the [canonical onboarding decision](https://app.notion.com/p/3b92e87228bf817faac0f15bd19ccb29).

## Decision brief

- **Job:** preserve the learner's onboarding answers while every reversible
  profile/account step behaves like a native screen.
- **Hierarchy:** current question first, progress second, forward/back controls
  third.
- **Primary action:** validate and advance exactly one step.
- **Friction:** remove custom edge thresholds, preview transforms, gesture
  arbitration, and duplicated internal/native back state.
- **Chosen decision:** extend the existing `(auth)` native stack with grouped
  `/onboarding/[step]` route instances and keep flow state outside route
  screens.

## Considered options

1. **A second nested native stack with one route file per step.** This provides
   native history, but adds parent/child gesture ownership at the onboarding
   entry and duplicates nearly identical route adapters.
2. **Grouped routes in the existing auth native stack.** Chosen. A single
   dynamic `[step]` route creates a distinct native history entry for every
   pushed step parameter while the existing auth stack still owns the native
   pop back to the auth choice. Route files remain thin adapters.
3. **A screen-independent flow state machine.** Retained only for state that is
   not navigation: answers, confirmed learning times, field errors, intro page,
   visited-step authorization, and the transient registration operation stage
   used to authorize verification/creation routes across screen unmounts. That
   stage describes the in-flight auth operation; it does not choose the visible
   route. The route history itself is the navigation state machine, and there is
   no second `activeIndex` that can advance or rewind it.

The three educational intro pages remain one native horizontal pager route.
That is the documented native equivalent for those homogeneous pages: it gives
an interactive preview, commit, and cancellation while avoiding competition
between two horizontal navigation gestures. From the first intro page, the
auth stack's system edge-pop returns to the auth choice. All 14 later actions,
verification, and account creation are distinct stack entries.

## State, resume, and irreversible boundaries

- The root onboarding module owns answers and field errors so native screen
  detach/unmount and ordinary app backgrounding do not discard them.
- Step URLs are not public resume checkpoints. A direct `/onboarding/[step]`
  entry without an in-memory visited predecessor replaces the route with the
  auth choice. `/onboarding` is the only supported cold entry.
- Before registration, the non-secret schedule/profile persistence payload is
  staged in the existing durable onboarding outbox. Passwords and verification
  codes are deliberately excluded. A cold start without an authenticated Clerk
  session therefore begins from the auth choice instead of reconstructing
  sensitive partial registration.
- Once the Clerk session exists, every pending, failed, recovery-required, or
  ready-for-trial handoff resumes on `/onboarding/creating`. The creation route
  either continues the outbox sync, collects only the three operational
  learning-time answers needed to replace a lost payload, or waits for the
  learner's explicit transition to `/trial`.
- Verification is a reversible route above the password step. Account creation
  replaces the active route, disables route removal, and remains forward-only;
  verification failure replaces it with verification again without duplicating
  stack entries.
- Visible back, iOS edge-pop, and Android system/predictive back all consume the
  same native stack history. Busy and account-creation routes prevent removal.

## Consequences and rollback

The custom `OnboardingEdgeBackGesture` and its thresholds are deleted. Intro,
duration, picker, and sheet gestures retain their own native interaction
surfaces; the stack uses only the iOS edge region. VoiceOver/TalkBack semantics,
RTL, and reduced-motion rendering stay in the existing screen modules.

There is no data or backend migration. Reverting the DAY-349 commit restores
PR #458's single-route hybrid navigation without changing onboarding answers or
the registration payload.
