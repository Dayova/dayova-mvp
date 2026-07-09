import { useConvexAuth, useQuery } from "convex/react";
import { usePostHog } from "posthog-react-native";
import type React from "react";
import { useEffect, useRef } from "react";
import { api } from "#convex/_generated/api";
import { useAuth } from "~/context/AuthContext";
import {
	definedAnalyticsProperties,
	isPostHogConfigured,
} from "~/lib/analytics";

export function AnalyticsIdentity({ children }: { children: React.ReactNode }) {
	const posthog = usePostHog();
	const { user, isSessionLoading } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const convexUser = useQuery(
		api.users.getMe,
		user && isConvexAuthenticated ? {} : "skip",
	);
	const identifiedClerkIdRef = useRef<string | null>(null);

	useEffect(() => {
		if (!isPostHogConfigured || isSessionLoading) return;

		if (!user) {
			if (identifiedClerkIdRef.current) {
				posthog.reset();
				identifiedClerkIdRef.current = null;
			}
			return;
		}

		if (!isConvexAuthenticated || convexUser === undefined) return;

		posthog.identify(
			user.clerkId,
			definedAnalyticsProperties({
				clerk_id: user.clerkId,
				convex_user_id: convexUser?._id,
				grade: user.grade,
				school_type: user.schoolType,
				state: user.state,
				validation_student_code: convexUser?.validationStudentCode,
			}),
		);
		identifiedClerkIdRef.current = user.clerkId;
	}, [convexUser, isConvexAuthenticated, isSessionLoading, posthog, user]);

	return children;
}
