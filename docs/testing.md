# Testing

Dayova uses two complementary test environments:

- `pnpm test:unit` runs Vitest for pure functions, Convex behavior, adapters,
  and ESLint `RuleTester` architecture rules.
- `pnpm test:ui` runs Jest with `jest-expo` and React Native Testing Library for
  rendered component behavior and accessibility queries.
- `pnpm test` runs both suites in that order.

Prefer observable behavior over source scanning for new or modified contracts.
Pure transition and validation logic should be extracted into small modules;
native rendering, controls, labels, and lifecycle interactions belong in
`*.ui.test.tsx`. Source-file tests remain appropriate for assets, configuration,
and generated artifact contracts that have no runtime behavior to render.

Automated tests do not replace phone/tablet acceptance evidence. Auth session
persistence, remote revocation, keyboard layout, and platform-native surfaces
must be verified on the devices named by the relevant Linear issue.
