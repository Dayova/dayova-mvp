// The UI tests exercise controlled state and accessibility, not native physics.
const React = require("react");
const Native = require("react-native");
const animationBuilder = {
 duration: () => animationBuilder,
 delay: () => animationBuilder,
 reduceMotion: () => animationBuilder,
};
module.exports = {
 __esModule: true,
 default: { View: Native.View, Text: Native.Text, createAnimatedComponent: (component) => component },
 Easing: { cubic: "cubic", out: (value) => value },
 FadeIn: animationBuilder,
 FadeInDown: animationBuilder,
 LinearTransition: animationBuilder,
 useReducedMotion: () => false,
 useSharedValue: (initial) => {
  const ref = React.useRef(initial);
  return React.useMemo(() => ({get: () => ref.current, set: (value) => {ref.current = value;}}), []);
 },
 useAnimatedStyle: (factory) => factory(),
 interpolateColor: (value, _input, output) => output[value === 0 ? 0 : 1],
 withTiming: (value) => value,
 withSpring: (value) => value,
};
