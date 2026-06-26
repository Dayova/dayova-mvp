import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { usePostHog } from "posthog-react-native";
import { useEffect, useRef } from "react";
import { api } from "#convex/_generated/api";
import { useAuth } from "~/context/AuthContext";
import {
	captureValidationEvent,
	definedAnalyticsProperties,
	isPostHogConfigured,
} from "~/lib/analytics-core";
import { getDayKey } from "~/lib/day-key";
import { logDiagnosticError } from "~/lib/diagnostics";

export function AnalyticsIdentity() {
	const posthog = usePostHog();
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const convexUser = useQuery(
		api.users.getMe,
		user && isConvexAuthenticated ? {} : "skip",
	);
	const markReturnedNextDay = useMutation(
		api.validationAnalytics.markReturnedNextDay,
	);
	const identifiedClerkIdRef = useRef<string | null>(null);
	const returnCaptureKeyRef = useRef<string | null>(null);

	useEffect(() => {
		if (!isPostHogConfigured) return;

		if (!user) {
			if (identifiedClerkIdRef.current) {
				posthog.reset();
				identifiedClerkIdRef.current = null;
				returnCaptureKeyRef.current = null;
			}
			return;
		}

		const validationStudentCode =
			convexUser?.validationStudentCode ?? user.validationStudentCode;
		posthog.identify(
			user.clerkId,
			definedAnalyticsProperties({
				clerk_id: user.clerkId,
				convex_user_id: convexUser?._id,
				email: user.email,
				name: user.name,
				birth_date: user.birthDate,
				grade: user.grade,
				school_type: user.schoolType,
				state: user.state,
				avatar_url: user.avatarUrl,
				validation_student_code: validationStudentCode,
			}),
		);
		identifiedClerkIdRef.current = user.clerkId;

		const localDayKey = getDayKey(new Date());
		const returnCaptureKey = `${user.clerkId}:${localDayKey}`;
		if (!isConvexAuthenticated || returnCaptureKeyRef.current === returnCaptureKey) {
			return;
		}

		void markReturnedNextDay({ localDayKey })
			.then((result) => {
				returnCaptureKeyRef.current = returnCaptureKey;
				if (!result.captured) return;
				captureValidationEvent(posthog, "user_returned_next_day", user.clerkId, {
					local_day_key: localDayKey,
					previous_activity_day_key: result.previousActivityDayKey,
					...(result.validationStudentCode
						? { validation_student_code: result.validationStudentCode }
						: {}),
				});
			})
			.catch((error: unknown) => {
				logDiagnosticError("Failed to mark next-day validation return.", error, {
					source: "analytics.markReturnedNextDay",
					level: "warn",
				});
			});
	}, [convexUser, isConvexAuthenticated, markReturnedNextDay, posthog, user]);

	return null;
}
