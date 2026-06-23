import { useMutation } from "convex/react";
import { usePostHog } from "posthog-react-native";
import { useCallback } from "react";
import { api } from "#convex/_generated/api";
import { useAuth } from "~/context/AuthContext";
import {
	captureValidationEvent,
	type ValidationEventName,
} from "~/lib/analytics-core";
import { getDayKey } from "~/lib/day-key";
import { logDiagnosticError } from "~/lib/diagnostics";
import { isPostHogConfigured } from "~/lib/analytics-core";
import type { AnalyticsProperties } from "~/lib/analytics-core";

export function useValidationAnalytics() {
	const posthog = usePostHog();
	const { user } = useAuth();
	const markActivity = useMutation(api.validationAnalytics.markActivity);
	const clerkId = user?.clerkId;

	const capture = useCallback(
		async (eventName: ValidationEventName, properties?: AnalyticsProperties) => {
			if (!isPostHogConfigured || !clerkId) return;

			let validationStudentCode: string | null = null;
			try {
				const activity = await markActivity({
					localDayKey: getDayKey(new Date()),
				});
				validationStudentCode = activity.validationStudentCode;
			} catch (error) {
				logDiagnosticError("Failed to mark validation activity.", error, {
					source: "analytics.markActivity",
					level: "warn",
					metadata: { eventName },
				});
			}

			captureValidationEvent(posthog, eventName, clerkId, {
				...properties,
				...(validationStudentCode
					? { validation_student_code: validationStudentCode }
					: {}),
			});
		},
		[clerkId, markActivity, posthog],
	);

	return { capture };
}
