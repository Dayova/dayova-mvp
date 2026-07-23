# Animations

Choose the animation primitive by behavior instead of defaulting to one library.

| Scenario | Prefer |
| --- | --- |
| Navigation, modal, sheet, or screen transition already supported by the platform | Expo Router and native stack or presentation APIs |
| Gesture-driven, scroll-linked, interruptible, or layout-coupled motion | Reanimated v4 |
| Long-running, trigger-based `transform` or `opacity` motion under UI-thread pressure | A platform-driven primitive; evaluate `react-native-ease` only after checking project dependencies, confirming its limitations, and getting approval to add it |
| Existing simple `opacity` or `transform` animation that already uses React Native `Animated` with the native driver | Keep it when it meets the interaction and performance requirements; do not rewrite it solely for consistency |

Follow this selection workflow:

1. Read repository guidance and inspect the installed dependencies before proposing a library.
2. Prefer built-in platform and navigation transitions when they express the interaction.
3. Match the primitive to the behavior. Reanimated remains the default for gestures, scroll coupling, shared values, interruptible motion, and layout animation.
4. Profile performance-sensitive motion in a release build on representative iOS and Android hardware. Debug-build animation timing is not decision-quality evidence.
5. Preserve the project's reduced-motion behavior. Provide a static or reduced alternative instead of merely shortening every animation.
6. Do not add or replace an animation dependency without explaining the tradeoff and confirming the change with the user.

`react-native-ease` is intentionally narrow: it can reduce per-frame application-thread work for declarative, trigger-based visual animations, but it is not a replacement for gesture-driven, scroll-linked, layout-changing, readable, or interruptible animation state. See Expo's [animation benchmark](https://expo.dev/blog/the-real-cost-of-react-native-animations-benchmarking-every-approach) for the measured tradeoffs.

The remaining examples use Reanimated because they cover the interaction classes where Reanimated is appropriate. They are patterns, not a mandate to migrate unrelated animation code.

## Entering and Exiting Animations

Use Animated.View with entering and exiting animations. Layout animations can animate state changes.

```tsx
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

function App() {
  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      layout={LinearTransition}
    />
  );
}
```

## On-Scroll Animations

Create high-performance scroll animations using Reanimated's hooks:

```tsx
import Animated, {
  useAnimatedRef,
  useScrollViewOffset,
  useAnimatedStyle,
  interpolate,
} from "react-native-reanimated";

function Page() {
  const ref = useAnimatedRef();
  const scroll = useScrollViewOffset(ref);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(scroll.value, [0, 30], [0, 1], "clamp"),
  }));

  return (
    <Animated.ScrollView ref={ref}>
      <Animated.View style={style} />
    </Animated.ScrollView>
  );
}
```

## Common Animation Presets

### Entering Animations

- `FadeIn`, `FadeInUp`, `FadeInDown`, `FadeInLeft`, `FadeInRight`
- `SlideInUp`, `SlideInDown`, `SlideInLeft`, `SlideInRight`
- `ZoomIn`, `ZoomInUp`, `ZoomInDown`
- `BounceIn`, `BounceInUp`, `BounceInDown`

### Exiting Animations

- `FadeOut`, `FadeOutUp`, `FadeOutDown`, `FadeOutLeft`, `FadeOutRight`
- `SlideOutUp`, `SlideOutDown`, `SlideOutLeft`, `SlideOutRight`
- `ZoomOut`, `ZoomOutUp`, `ZoomOutDown`
- `BounceOut`, `BounceOutUp`, `BounceOutDown`

### Layout Animations

- `LinearTransition` — Smooth linear interpolation
- `SequencedTransition` — Sequenced property changes
- `FadingTransition` — Fade between states

## Customizing Animations

```tsx
<Animated.View
  entering={FadeInDown.duration(500).delay(200)}
  exiting={FadeOut.duration(300)}
/>
```

### Modifiers

```tsx
// Duration in milliseconds
FadeIn.duration(300);

// Delay before starting
FadeIn.delay(100);

// Spring physics
FadeIn.springify();
FadeIn.springify().damping(15).stiffness(100);

// Easing curves
FadeIn.easing(Easing.bezier(0.25, 0.1, 0.25, 1));

// Chaining
FadeInDown.duration(400).delay(200).springify();
```

## Shared Value Animations

For imperative control over animations:

```tsx
import {
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const offset = useSharedValue(0);

// Spring animation
offset.value = withSpring(100);

// Timing animation
offset.value = withTiming(100, { duration: 300 });

// Use in styles
const style = useAnimatedStyle(() => ({
  transform: [{ translateX: offset.value }],
}));
```

## Gesture Animations

Combine with React Native Gesture Handler:

```tsx
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

function DraggableBox() {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const gesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd(() => {
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.box, style]} />
    </GestureDetector>
  );
}
```

## Keyboard Animations

Animate with keyboard height changes:

```tsx
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
} from "react-native-reanimated";

function KeyboardAwareView() {
  const keyboard = useAnimatedKeyboard();

  const style = useAnimatedStyle(() => ({
    paddingBottom: keyboard.height.value,
  }));

  return <Animated.View style={style}>{/* content */}</Animated.View>;
}
```

## Staggered List Animations

Animate list items with delays:

```tsx
{
  items.map((item, index) => (
    <Animated.View
      key={item.id}
      entering={FadeInUp.delay(index * 50)}
      exiting={FadeOutUp}
    >
      <ListItem item={item} />
    </Animated.View>
  ));
}
```

## Best Practices

- Use motion only when it communicates state, continuity, or feedback
- Use layout animations when items are added/removed from lists
- Use `useAnimatedStyle` for scroll-driven animations
- Prefer `interpolate` with "clamp" for bounded values
- You can't pass `Color` (from expo-router) or `PlatformColor` values to reanimated views or styles; use static colors instead
- Validate timing against the interaction instead of enforcing a universal duration
- Use spring animations for natural movement
- Avoid animating layout properties (width, height) when possible — prefer transforms
- Test the reduced-motion path and the release build before calling animation work complete
