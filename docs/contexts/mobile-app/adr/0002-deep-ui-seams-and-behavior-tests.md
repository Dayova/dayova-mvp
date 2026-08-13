# ADR: Deep UI Seams and Behavior Tests

- Status: Accepted
- Date: 2026-07-17
- Decision maker: Jakob Rössner
- Related work: [DAY-90](https://linear.app/dayova/issue/DAY-90/implement-password-recovery-forced-reset-and-password-change), [DAY-178](https://linear.app/dayova/issue/DAY-178/remove-angemeldet-bleiben-and-verify-persistent-native-sign-in), [DAY-109](https://linear.app/dayova/issue/DAY-109/)

## Context

The app had several broad or implicit seams: sheet lifecycle was coordinated by
effects without an explicit transition model, authentication mixed state and
all mutations in one context, state updates were sometimes the only duplicate
action guard, and several tests asserted source text instead of behavior.

## Decision

Adopt these five seams:

1. `DayovaSheetFrame` owns a small controlled lifecycle state machine and is
   verified through rendered interaction tests, including stale-dismiss races.
2. Native Clerk sessions always use the secure persistent token cache. Remove
   `Angemeldet bleiben` and its preference-aware cache.
3. Mutating UI actions provide visible busy/error state and use a synchronous
   transaction gate where duplicate invocation would be unsafe.
4. Split authentication into `useAuthSession`, `useAuthFlow`, and
   `useAccountActions`; consumers import only the capability they need.
5. Use Vitest for pure/domain behavior, Jest plus React Native Testing Library
   for rendered native behavior, and ESLint `RuleTester` for architectural
   import boundaries. Keep the sheet API narrow and document its contract.

## Consequences

- Source-text tests are not acceptable evidence for user interaction or
  architecture boundaries when an interaction test or lint rule can express
  the same invariant.
- A React state flag alone is not a synchronous lock: a transaction gate must
  reject a second invocation before the next render.
- Errors from optimistic mutations must roll back optimistic state and remain
  visible in the active surface, including confirmation sheets.
- Exceptions to the overlay boundary require a documented design-system
  decision and a narrow ESLint allowance with a regression test.

## Verification

- `pnpm test` runs both the pure/unit and rendered native suites.
- `pnpm check` runs Biome, the local architectural ESLint rules, and TypeScript.
- `pnpm check:unused` ensures removed escape hatches and compatibility APIs do
  not remain accidentally reachable.
