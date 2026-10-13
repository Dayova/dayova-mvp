import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { api } from "#convex/_generated/api";
import { ConfirmationSheet } from "~/components/ui/confirmation-sheet";
import { DAYOVA_NOTIFICATION_CHANNEL_ID } from "~/lib/local-notification-scheduler";
import {
	getNotificationsModule,
	hasNotificationPermission,
} from "~/lib/notification-permissions";

/** Mounted only when a learning plan has scheduled, unfinished sessions. */
export function LearningReminderOffer() {
	const { isAuthenticated } = useConvexAuth();
	const preferences = useQuery(
		api.notifications.getPreferences,
		isAuthenticated ? {} : "skip",
	);
	const updatePreferences = useMutation(api.notifications.updatePreferences);
	const [canOffer, setCanOffer] = useState(false);
	const [dismissed, setDismissed] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const eligible = Boolean(
		preferences?.systemNotificationsEnabled &&
			!preferences.learningReminderOfferSeen,
	);
	useEffect(() => {
		if (!eligible) return;
		let cancelled = false;
		const notifications = getNotificationsModule();
		if (!notifications) return;
		void notifications
			.getPermissionsAsync()
			.then((permission) => {
				if (!cancelled)
					setCanOffer(
						permission.canAskAgain &&
							!hasNotificationPermission(notifications, permission),
					);
			})
			.catch(() => {
				/* The learning plan remains usable without native notifications. */
			});
		return () => {
			cancelled = true;
		};
	}, [eligible]);
	const dismiss = () => {
		setDismissed(true);
		void updatePreferences({ learningReminderOfferSeen: true }).catch(() => {
			/* Retry on a later visit. */
		});
	};
	const enable = async () => {
		if (busy) return;
		setBusy(true);
		setError(null);
		try {
			const notifications = getNotificationsModule();
			if (!notifications) {
				dismiss();
				return;
			}
			if (Platform.OS === "android")
				await notifications.setNotificationChannelAsync(
					DAYOVA_NOTIFICATION_CHANNEL_ID,
					{
						name: "Dayova Erinnerungen",
						importance: notifications.AndroidImportance.DEFAULT,
					},
				);
			const permission = await notifications.requestPermissionsAsync();
			await updatePreferences({
				systemNotificationsEnabled: hasNotificationPermission(
					notifications,
					permission,
				),
				learningReminderOfferSeen: true,
			});
			setDismissed(true);
		} catch {
			setError(
				"Die Erinnerung konnte nicht aktiviert werden. Versuche es erneut oder aktiviere sie später unter Mitteilungen.",
			);
		} finally {
			setBusy(false);
		}
	};
	return (
		<ConfirmationSheet
			visible={eligible && canOffer && !dismissed}
			title="An deine Lernsession erinnern?"
			description="Dayova erinnert dich zum Start und hilft dir nach einem verpassten Termin beim Neuplanen. Du kannst das unter Mitteilungen ändern."
			confirmLabel="Aktivieren"
			cancelLabel="Später"
			confirmTone="primary"
			isBusy={busy}
			errorMessage={error}
			onConfirm={() => {
				void enable();
			}}
			onClose={dismiss}
		/>
	);
}
