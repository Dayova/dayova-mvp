export type DayovaBillingPeriod = "annual" | "monthly";

// Pricing decision PRICING-001, confirmed by Linear DAY-228.
// Store products must use the same amounts before a production release.
export const DAYOVA_SUBSCRIPTION_PRICING = {
	annual: {
		billingDescription: "155,88 € jährlich abgerechnet",
		displayPrice: "12,99 €",
	},
	monthly: {
		billingDescription: "Monatlich abgerechnet",
		displayPrice: "14,99 €",
	},
} as const satisfies Record<
	DayovaBillingPeriod,
	{ billingDescription: string; displayPrice: string }
>;
