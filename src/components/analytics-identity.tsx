import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { usePostHog } from "posthog-react-native";
import { useEffect, useMemo, useRef } from "react";
import { api } from "#convex/_generated/api";
import { useAuth } from "~/context/AuthContext";
import {
	createValidationAnalytics,
	isPostHogConfigured,
} from "~/lib/analytics";
import { getDayKey } from "~/lib/day-key";
import { logDiagnosticError } from "~/lib/diagnostics";

export function AnalyticsIdentity() {
	const posthog = usePostHog();
	const { user, isSessionLoading } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const convexUser = useQuery(
		api.users.getMe,
		user && isConvexAuthenticated ? {} : "skip",
	);
	const markReturnedNextDay = useMutation(
		api.validationAnalytics.markReturnedNextDay,
	);
	const analytics = useMemo(
		() => createValidationAnalytics(posthog),
		[posthog],
	);
	const identifiedClerkIdRef = useRef<string | null>(null);
	const returnCaptureKeyRef = useRef<string | null>(null);

	useEffect(() => {
		if (!isPostHogConfigured || isSessionLoading) return;

		if (!user) {
			if (identifiedClerkIdRef.current) {
				analytics.identify(null);
				identifiedClerkIdRef.current = null;
				returnCaptureKeyRef.current = null;
			}
			return;
		}

		const validationStudentCode =
			convexUser?.validationStudentCode ?? user.validationStudentCode;
		analytics.identify({
			distinctId: user.clerkId,
			convexUserId: convexUser?._id,
			grade: user.grade,
			state: user.state,
			validationStudentCode,
		});
		identifiedClerkIdRef.current = user.clerkId;

		const localDayKey = getDayKey(new Date());
		const returnCaptureKey = `${user.clerkId}:${localDayKey}`;
		if (
			!isConvexAuthenticated ||
			!convexUser ||
			returnCaptureKeyRef.current === returnCaptureKey
		) {
			return;
		}

		void markReturnedNextDay({ localDayKey })
			.then((result) => {
				returnCaptureKeyRef.current = returnCaptureKey;
				if (!result.captured || !result.previousActivityDayKey) return;
				createValidationAnalytics(posthog, {
					distinctId: user.clerkId,
					sharedContext: {
						validationStudentCode: result.validationStudentCode,
					},
				}).capture("user_returned_next_day", {
					local_day_key: localDayKey,
					previous_activity_day_key: result.previousActivityDayKey,
				});
			})
			.catch((error: unknown) => {
				logDiagnosticError(
					"Failed to mark next-day validation return.",
					error,
					{
						source: "analytics.markReturnedNextDay",
						level: "warn",
					},
				);
			});
	}, [
		analytics,
		convexUser,
		isConvexAuthenticated,
		isSessionLoading,
		markReturnedNextDay,
		posthog,
		user,
	]);

	return null;
}
