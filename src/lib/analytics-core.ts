import type { PostHog } from "posthog-react-native";
import { env } from "~/lib/runtime-config";

type ValidationEventName =
	| "dashboard_viewed"
	| "dashboard_day_selected"
	| "dashboard_today_selected"
	| "dashboard_create_opened"
	| "dashboard_create_type_selected"
	| "dashboard_entry_opened"
	| "dashboard_hero_day_changed"
	| "onboarding_completed"
	| "homework_created"
	| "exam_created"
	| "study_plan_generated"
	| "study_slot_started"
	| "study_slot_completed"
	| "qualified_study_slot_completed"
	| "continue_learning_started"
	| "learning_session_composition_exposed"
	| "study_slot_partially_completed"
	| "study_slot_missed"
	| "missed_reason_selected"
	| "plan_adjusted"
	| "user_returned_next_day"
	| "material_uploaded"
	| "generalprobe_completed";

type AnalyticsProperty = string | number | boolean | null;
type AnalyticsProperties = Record<string, AnalyticsProperty>;
type AnalyticsPropertiesInput = Record<string, AnalyticsProperty | undefined>;

export const isPostHogConfigured = Boolean(
	env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim(),
);

export const postHogApiKey = env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim() ?? "";

export const postHogHost =
	env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || "https://eu.i.posthog.com";

export function definedAnalyticsProperties(
	properties: AnalyticsPropertiesInput,
) {
	return Object.fromEntries(
		Object.entries(properties).filter(
			(entry): entry is [string, AnalyticsProperty] => entry[1] !== undefined,
		),
	);
}

export function captureValidationEvent(
	posthog: PostHog,
	eventName: ValidationEventName,
	clerkId: string,
	properties?: AnalyticsProperties,
) {
	const normalizedClerkId = clerkId.trim();
	if (!isPostHogConfigured || !normalizedClerkId) return;

	posthog.identify(normalizedClerkId);
	posthog.capture(eventName, {
		...properties,
		clerk_id: normalizedClerkId,
	});
}

export type {
	AnalyticsProperties,
	AnalyticsPropertiesInput,
	ValidationEventName,
};
