# Styling

This app uses NativeWind with Tailwind CSS utilities. Shared class strings should be composed with `cn()` from `src/lib/utils.ts`, not with direct `clsx()` or string joins, when classes can come from multiple sources.

## NativeWind Release-Build Patch

This project patches `nativewind@4.2.3` through `pnpm-workspace.yaml` and
`patches/nativewind@4.2.3.patch`.

The patch fixes an iOS release-build hang in NativeWind's Tailwind v3 Metro
integration. During `expo-updates` embedded resource generation, NativeWind could
finish producing CSS and still leave its child Tailwind process alive. EAS Build
then remained stuck in the `Generate updates resources for expo-updates` phase.

`metro.config.js` sets `NATIVEWIND_DISABLE_WATCH=true` for non-Debug native
builds so the patch uses one-shot Tailwind generation. Metro development and
Debug builds keep NativeWind watch mode.

See `patches/README.md` for the full diagnosis, verification commands, and
upgrade/removal checklist.

## Text Classes And `tailwind-merge`

Tailwind uses the `text-*` prefix for multiple utility groups:

- Text size: `text-sm`, `text-lg`, or this app's custom `text-16`.
- Text color: `text-white`, `text-primary`, or this app's custom `text-text`.
- Text alignment and other text utilities: `text-center`, `text-left`, etc.

This project defines semantic text roles from the Figma design system in
`tailwind.config.ts`. Numeric aliases exist only for low-level compatibility;
new UI should prefer the semantic classes.

```js
fontSize: {
  "heading-1": ["32px", { lineHeight: "48px", letterSpacing: "0px" }],
  "heading-2": ["24px", { lineHeight: "36px", letterSpacing: "0px" }],
  "body-1": ["20px", { lineHeight: "30px", letterSpacing: "0px" }],
  "body-2": ["16px", { lineHeight: "24px", letterSpacing: "0px" }],
  "body-3": ["14px", { lineHeight: "21px", letterSpacing: "0px" }],
  "body-4": ["12px", { lineHeight: "18px", letterSpacing: "0px" }],
  "body-5": ["10px", { lineHeight: "15px", letterSpacing: "0px" }],
}
```

It also defines a custom text color:

```js
colors: {
  text: "hsl(var(--text))",
  "secondary-text": "hsl(var(--secondary-text))",
}
```

That means a normal text component can legitimately need both utilities:

```tsx
<Text className="font-poppins text-16 text-text">Label</Text>
```

The issue is `tailwind-merge` cannot infer every custom Tailwind token by default. Without project-specific configuration, it can treat `text-16` and `text-text` as conflicting `text-*` classes and remove one of them. In practice, this made adding `text-text` drop the font-size class, so React Native fell back to its default text size.

`src/lib/utils.ts` fixes this globally by configuring `tailwind-merge` with the app's custom text size tokens:

```ts
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["heading-1", "heading-2", "body-1", "body-2", "body-3", "body-4", "body-5", "10", "12", "14", "16", "20", "24", "32"],
    },
  },
});
```

With that configuration:

- `cn("text-16 text-text")` preserves both text size and text color.
- `cn("text-16 text-secondary-text")` preserves both text size and secondary text color.
- `cn("text-14 text-16 text-text")` still resolves competing sizes and keeps `text-16`.
- `cn("text-text text-white")` still resolves competing colors normally.

## Maintenance Rules

- When adding or removing custom `fontSize` tokens in `tailwind.config.ts`, update the `theme.text` list in `src/lib/utils.ts`.
- Use Tailwind's standard spacing scale. Spacing must stay on a 4px rhythm: `gap-1` is 4px, `gap-2` is 8px, `gap-3` is 12px, `gap-4` is 16px, and so on. Do not redefine spacing keys so class numbers mean raw pixels.
- The app supports light, dark, and system theme preferences. Keep palette
  changes centralized in `src/global.css`, `src/lib/theme.ts`, and
  `src/lib/theme-preference.ts` so NativeWind classes, React Navigation, and
  native-only color props stay aligned.
- The Figma typography source of truth is Poppins, Regular for body copy, and SemiBold for headings and highlighted text. Do not use `font-bold`, `font-medium`, or arbitrary `text-[Npx]` classes for app text.
- Use `text-heading-1`, `text-heading-2`, `text-body-1`, `text-body-2`, `text-body-3`, `text-body-4`, and `text-body-5` for text hierarchy.
- Use `cn()` for component class merging so variants, defaults, and caller-provided classes resolve consistently.
- Do not replace `cn()` with direct `clsx()` in shared components unless you explicitly want to preserve all conflicting utilities.
- Prefer pairing size and color explicitly on `Text` components, for example `text-body-3 text-text/60`, instead of relying on inherited defaults when readability matters.
- Avoid adding color names that look like size names, and avoid adding size names that look like color names. The `text-*` namespace is shared and ambiguity increases merge risk.

## Style Prop Exceptions

Prefer NativeWind classes for static layout, color, typography, spacing, borders,
and shadows. Keep `style` only when the value is runtime data or a native API
constraint:

- Safe-area, keyboard, measured width/height, and responsive scale calculations.
- Reanimated animated styles and SVG/native component geometry.
- Third-party component APIs that only expose `style`/`backgroundStyle` props.
- Native text-input rendering resets such as Android `includeFontPadding`.

When adding a new style prop, leave a nearby comment explaining which exception
applies.

## Debugging Checklist

If a class appears to change unrelated text styling:

1. Check whether both classes share the same prefix, especially `text-*`.
2. Run a quick merge check with the same class string:

```sh
node -e "const { cn } = require('./src/lib/utils.ts'); console.log(cn('text-16 text-text'))"
```

3. If importing TypeScript from Node is inconvenient, reproduce with `tailwind-merge` directly and mirror the config from `src/lib/utils.ts`.
4. Verify the generated class order after `cn()` before debugging NativeWind rendering.
