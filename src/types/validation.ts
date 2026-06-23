import type { Doc } from "#convex/_generated/dataModel";

export type AttributionSource = Doc<"validationAttributions">["source"];

export const ATTRIBUTION_SOURCES = [
	"product_only",
	"founder_check_in",
	"app_reminder",
	"combination",
	"unknown",
] as const satisfies readonly AttributionSource[];

export const ATTRIBUTION_LABEL = {
	product_only: "Produkt",
	founder_check_in: "Founder",
	app_reminder: "Reminder",
	combination: "Kombi",
	unknown: "Unklar",
} satisfies Record<AttributionSource, string>;
