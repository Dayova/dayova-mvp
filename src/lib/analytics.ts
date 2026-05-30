import { usePostHog } from "posthog-react-native";
import { useCallback } from "react";
import { useAuth } from "~/context/AuthContext";

type ValidationEventName =
	| "onboarding_completed"
	| "homework_created"
	| "exam_created"
	| "study_plan_generated"
	| "study_slot_started"
	| "study_slot_completed"
	| "study_slot_partially_completed"
	| "study_slot_missed"
	| "missed_reason_selected"
	| "plan_adjusted"
	| "user_returned_next_day"
	| "material_uploaded"
	| "generalprobe_completed";

type AnalyticsProperty = string | number | boolean | null;
type AnalyticsProperties = Record<string, AnalyticsProperty>;
type AnalyticsPropertiesInput = Record<
	string,
	AnalyticsProperty | undefined
>;

export const isPostHogConfigured = Boolean(
	process.env.EXPO_PUBLIC_POSTHOG_API_KEY,
);

export const postHogHost =
	process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

export function definedAnalyticsProperties(properties: AnalyticsPropertiesInput) {
	return Object.fromEntries(
		Object.entries(properties).filter(
			(entry): entry is [string, AnalyticsProperty] => entry[1] !== undefined,
		),
	);
}

export function useValidationAnalytics() {
	const posthog = usePostHog();
	const { user } = useAuth();
	const clerkId = user?.clerkId;

	const capture = useCallback(
		(eventName: ValidationEventName, properties?: AnalyticsProperties) => {
			if (!isPostHogConfigured || !clerkId) return;
			posthog.identify(clerkId);
			posthog.capture(eventName, {
				...properties,
				clerk_id: clerkId,
			});
		},
		[clerkId, posthog],
	);

	return { capture };
}

export type {
	AnalyticsProperties,
	AnalyticsPropertiesInput,
	ValidationEventName,
};
