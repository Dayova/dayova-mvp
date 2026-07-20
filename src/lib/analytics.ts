import { useMutation, useQuery } from "convex/react";
import { usePostHog } from "posthog-react-native";
import { useCallback } from "react";
import { api } from "#convex/_generated/api";
import { useAuthSession } from "~/context/AuthContext";
import type { AnalyticsProperties } from "~/lib/analytics-core";
import {
	captureValidationEvent,
	isPostHogConfigured,
	type ValidationEventName,
} from "~/lib/analytics-core";
import { getDayKey } from "~/lib/day-key";
import { logDiagnosticError } from "~/lib/diagnostics";

export function useValidationAnalytics() {
	const posthog = usePostHog();
	const { user, isConvexAuthenticated } = useAuthSession();
	const convexUser = useQuery(
		api.users.getMe,
		user && isConvexAuthenticated ? {} : "skip",
	);
	const markActivity = useMutation(api.validationAnalytics.markActivity);
	const clerkId = user?.clerkId;

	const capture = useCallback(
		async (
			eventName: ValidationEventName,
			properties?: AnalyticsProperties,
		) => {
			if (!isPostHogConfigured || !clerkId) return;

			let validationStudentCode = convexUser?.validationStudentCode ?? null;
			if (isConvexAuthenticated) {
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
			}

			captureValidationEvent(posthog, eventName, clerkId, {
				...properties,
				...(validationStudentCode
					? { validation_student_code: validationStudentCode }
					: {}),
			});
		},
		[clerkId, convexUser, isConvexAuthenticated, markActivity, posthog],
	);

	return { capture };
}
