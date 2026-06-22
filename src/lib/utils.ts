import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Keep this in sync with `theme.extend.fontSize` in `tailwind.config.ts`.
// Without these tokens, tailwind-merge treats custom size classes like
// `text-body-2` as conflicting with color classes like `text-text`.
const twMerge = extendTailwindMerge({
	extend: {
		theme: {
			text: [
				"heading-1",
				"heading-2",
				"body-1",
				"body-2",
				"body-3",
				"body-4",
				"body-5",
				"10",
				"12",
				"14",
				"16",
				"20",
				"24",
				"32",
			],
		},
	},
});

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
