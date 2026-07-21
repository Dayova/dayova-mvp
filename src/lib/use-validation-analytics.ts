import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { usePostHog } from "posthog-react-native";
import { useCallback } from "react";
import { api } from "#convex/_generated/api";
import { useAuth } from "~/context/AuthContext";
import {
	createValidationAnalytics,
	isPostHogConfigured,
	type ValidationEventName,
	type ValidationEventProperties,
} from "~/lib/analytics";
import { getDayKey } from "~/lib/day-key";
import { logDiagnosticError } from "~/lib/diagnostics";

export function useValidationAnalytics() {
	const posthog = usePostHog();
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const convexUser = useQuery(
		api.users.getMe,
		user && isConvexAuthenticated ? {} : "skip",
	);
	const markActivity = useMutation(api.validationAnalytics.markActivity);
	const clerkId = user?.clerkId;

	const capture = useCallback(
		async <EventName extends ValidationEventName>(
			eventName: EventName,
			properties: ValidationEventProperties[EventName],
		) => {
			if (!isPostHogConfigured || !clerkId || !isConvexAuthenticated) return;

			let validationStudentCode =
				convexUser?.validationStudentCode ??
				user?.validationStudentCode ??
				null;
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
				// Validation analytics are backend-confirmed; without recorded activity,
				// this event must not be emitted or attributed from device state alone.
				return;
			}

			createValidationAnalytics(posthog, {
				distinctId: clerkId,
				sharedContext: { validationStudentCode },
			}).capture(eventName, properties);
		},
		[
			clerkId,
			convexUser,
			isConvexAuthenticated,
			markActivity,
			posthog,
			user?.validationStudentCode,
		],
	);

	return { capture };
}
