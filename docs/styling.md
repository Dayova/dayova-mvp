# Styling

This app uses NativeWind with Tailwind CSS utilities. Shared class strings should be composed with `cn()` from `src/lib/utils.ts`, not with direct `clsx()` or string joins, when classes can come from multiple sources.

## Text Classes And `tailwind-merge`

Tailwind uses the `text-*` prefix for multiple utility groups:

- Text size: `text-sm`, `text-lg`, or this app's custom `text-16`.
- Text color: `text-white`, `text-primary`, or this app's custom `text-text`.
- Text alignment and other text utilities: `text-center`, `text-left`, etc.

This project defines custom numeric text sizes in `tailwind.config.js`:

```js
fontSize: {
  12: ["12px", { lineHeight: "16.8px" }],
  14: ["14px", { lineHeight: "19.6px" }],
  16: ["16px", { lineHeight: "22.4px" }],
  18: ["18px", { lineHeight: "25.2px" }],
  20: ["20px", { lineHeight: "24px" }],
  24: ["24px", { lineHeight: "28.8px" }],
  28: ["28px", { lineHeight: "33.6px" }],
  32: ["32px", { lineHeight: "38.4px" }],
  40: ["40px", { lineHeight: "48px" }],
  56: ["56px", { lineHeight: "67.2px" }],
}
```

It also defines a custom text color:

```js
colors: {
  text: "hsl(var(--foreground))",
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
      text: ["12", "14", "16", "18", "20", "24", "28", "32", "40", "56"],
    },
  },
});
```

With that configuration:

- `cn("text-16 text-text")` preserves both text size and text color.
- `cn("text-14 text-16 text-text")` still resolves competing sizes and keeps `text-16`.
- `cn("text-text text-white")` still resolves competing colors normally.

## Maintenance Rules

- When adding or removing custom `fontSize` tokens in `tailwind.config.js`, update the `theme.text` list in `src/lib/utils.ts`.
- Use `cn()` for component class merging so variants, defaults, and caller-provided classes resolve consistently.
- Do not replace `cn()` with direct `clsx()` in shared components unless you explicitly want to preserve all conflicting utilities.
- Prefer pairing size and color explicitly on `Text` components, for example `text-14 text-text/60`, instead of relying on inherited defaults when readability matters.
- Avoid adding color names that look like size names, and avoid adding size names that look like color names. The `text-*` namespace is shared and ambiguity increases merge risk.

## Debugging Checklist

If a class appears to change unrelated text styling:

1. Check whether both classes share the same prefix, especially `text-*`.
2. Run a quick merge check with the same class string:

```sh
node -e "const { cn } = require('./src/lib/utils.ts'); console.log(cn('text-16 text-text'))"
```

3. If importing TypeScript from Node is inconvenient, reproduce with `tailwind-merge` directly and mirror the config from `src/lib/utils.ts`.
4. Verify the generated class order after `cn()` before debugging NativeWind rendering.

