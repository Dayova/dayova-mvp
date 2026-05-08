import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Keep this in sync with `theme.extend.fontSize` in `tailwind.config.js`.
// Without these tokens, tailwind-merge treats custom size classes like
// `text-16` as conflicting with color classes like `text-text`.
const twMerge = extendTailwindMerge({
	extend: {
		theme: {
			text: ["12", "14", "16", "18", "20", "24", "28", "32", "40", "56"],
		},
	},
});

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
