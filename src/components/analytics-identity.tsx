import { useQuery } from "convex/react";
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
	const convexUser = useQuery(api.users.getMe, user ? {} : "skip");
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
				validation_student_code: convexUser?.validationStudentCode,
			}),
		);
		identifiedClerkIdRef.current = user.clerkId;
	}, [convexUser, isSessionLoading, posthog, user]);

	return children;
}
