---
name: dayova-product-design
description: Guides product-design decisions for Dayova UI. Use when designing or substantially redesigning a screen, flow, or significant component; critiquing product UI; or implementing a UI task whose hierarchy, interaction, or structure is still unresolved.
---

# Dayova Product Design

Own the design judgment for Dayova. Improve clarity, coherence, usefulness, and intentionality within the existing product language.

## 1. Ground the decision

For every substantive UI task:

1. Read the existing screen or flow and nearby related screens.
2. Inspect relevant shared components before introducing a new pattern.
3. Read `docs/contexts/design-system/CONTEXT.md`; also read `docs/styling.md` when styling or implementation conventions matter.
4. Ground the work in the user's task, realistic Dayova content, and the surrounding product.

Before implementation or critique, record a compact decision brief:

- **Job:** the single job this surface performs.
- **Hierarchy:** what the user should notice first, second, and third.
- **Primary action:** the action that deserves the strongest affordance.
- **Friction:** what can be removed, combined, deferred, or clarified.
- **Chosen decision:** the structural or interaction decision that best resolves the task.

**Completion criterion:** every field has a concrete answer grounded in the current product and task.

## 2. Design before decorating

Use structure to communicate relationships. Start with hierarchy, composition, interaction, pacing, and meaningful use of space.

Make one strong decision that most improves the experience, then keep supporting elements quiet. Distinctiveness should come primarily from information hierarchy, composition, interaction, and prioritization.

Work within Dayova's existing semantic tokens, Poppins typography, spacing rhythm, radii, button patterns, icon system, theming model, and native-control abstractions. Reuse shared components when they express the intended UX well. When implementation is in scope and a new reusable pattern is genuinely needed, implement it as a shared pattern and update the relevant design-system guidance.

## 3. Product UI over portfolio design

Optimize for clarity, learnability, speed, accessibility, consistency, realistic content, and edge cases.

A familiar interaction executed exceptionally well is better than novelty users have to decode. Visual emphasis should reinforce the user's task rather than compete with it.

## 4. Design the full state space

Account for the states that materially affect the surface, including loading, empty, partial, complete, error, disabled, selected, long text, many items, and few items.

Empty states should direct the next useful action. Errors should explain what happened and what the user can do next. Controls should use language that names the action from the user's perspective.

## 5. Accessibility gate

Before considering an implementation or critique complete, check every applicable item:

- interactive controls and icon-only actions expose appropriate labels, roles, and states;
- touch targets are comfortably operable, using `hitSlop` where needed;
- text and controls remain legible with sufficient contrast in supported themes;
- text scaling and realistic long content do not break hierarchy or clipping;
- focus and screen-reader order follow the intended visual and interaction order;
- nonessential motion has an appropriate reduced-motion path.

**Completion criterion:** every applicable check passes, or the final report explicitly records the limitation.

## 6. Explore only when uncertainty blocks progress

Use the existing `prototype` skill only when the user requests alternatives or unresolved design uncertainty still blocks implementation after the decision brief. The existence of several plausible directions alone is not a reason to prototype.

When the current prototype workflow does not fit a native-only task, resolve the decision directly or use the smallest temporary native comparison needed rather than forcing a browser-oriented workflow.

## 7. Implementation boundaries

This skill owns product and visual design judgment. Use the relevant existing Expo, React Native, SwiftUI, Jetpack Compose, data, and backend skills for implementation-specific guidance.

Work with the repository's current stack and conventions. Introduce a dependency or system-level design change only when the task provides a concrete product or engineering reason.

## 8. Render, inspect, and revise

For implementation work, inspect the actual rendered result on the affected platform or platforms available in the task. For critique-only work, inspect the provided or available rendered surface. For platform-sensitive shared UI, inspect both iOS and Android when available. When rendering is unavailable, explicitly state which platform or state was not inspected and why.

Review the result against the surrounding product:

1. Is the most important thing immediately clear?
2. Is the primary action visually unambiguous?
3. Does the layout communicate the relationships between information?
4. Does the surface feel coherent with nearby Dayova screens?
5. Does it hold up with realistic content, edge states, and supported themes?
6. Does it pass the accessibility gate?

Identify the weakest remaining design decision. For implementation work, improve it before declaring the work complete. For critique-only work, report it with evidence and a concrete recommendation.

**Completion criterion:** rendered inspection was performed or its limitation was explicitly recorded, and every material issue identified was addressed or, for critique-only work, reported.
