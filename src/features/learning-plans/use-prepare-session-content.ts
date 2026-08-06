import { useAction } from "convex/react";
import { useEffect, useEffectEvent, useRef } from "react";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";

export function usePrepareSessionContent({
	enabled,
	sessionId,
	onError,
}: {
	enabled: boolean;
	sessionId: Id<"learningPlanSessions"> | undefined;
	onError: (error: unknown) => void;
}) {
	const ensureSessionContent = useAction(
		api.learningPlanAi.ensureSessionContent,
	);
	const preparingSessionIdRef = useRef<Id<"learningPlanSessions"> | null>(null);
	const preparedSessionIdRef = useRef<Id<"learningPlanSessions"> | null>(null);
	const reportError = useEffectEvent(onError);

	useEffect(() => {
		if (
			!enabled ||
			!sessionId ||
			preparingSessionIdRef.current === sessionId ||
			preparedSessionIdRef.current === sessionId
		) {
			return;
		}

		preparingSessionIdRef.current = sessionId;
		void ensureSessionContent({ sessionId })
			.then(() => {
				preparedSessionIdRef.current = sessionId;
			})
			.catch((error: unknown) => {
				reportError(error);
			})
			.finally(() => {
				if (preparingSessionIdRef.current === sessionId) {
					preparingSessionIdRef.current = null;
				}
			});
	}, [enabled, ensureSessionContent, sessionId]);
}
