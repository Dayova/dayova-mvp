import { useConvexAuth, useQuery } from "convex/react";
import { Component, type ReactNode } from "react";
import { View } from "react-native";
import { api } from "#convex/_generated/api";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";

function LearningTimeReminderContent({
	onOpen,
	disabled,
}: {
	onOpen: () => void;
	disabled: boolean;
}) {
	const { isAuthenticated } = useConvexAuth();
	const times = useQuery(
		api.learningTimes.listMine,
		isAuthenticated ? {} : "skip",
	);
	// No prompt while loading or when the learner already chose their times.
	if (!times || times.length > 0) return null;
	return (
		<View className="mt-6 w-full items-center gap-4 rounded-[24px] bg-system-subtle p-6">
			<Text
				accessibilityRole="header"
				className="text-center font-semibold text-body-2 text-text"
			>
				Wann passt Lernen in deinen Alltag?
			</Text>
			<Text className="text-center text-body-3 text-secondary-text">
				Feste Lernzeiten helfen dir, regelmäßig anzufangen. Wenn du an mehreren
				Tagen lernst, kannst du dir den Stoff besser merken. Wähle Zeiten, die
				zu deinem Alltag passen.
			</Text>
			<Button className="w-full" disabled={disabled} onPress={onOpen}>
				<Text>Lernzeiten jetzt eintragen</Text>
			</Button>
		</View>
	);
}

// Optional guidance must never prevent completing a learning session if its
// independent availability query fails (for example during a staged rollout).
class ReminderBoundary extends Component<
	{ children: ReactNode },
	{ failed: boolean }
> {
	state = { failed: false };
	static getDerivedStateFromError() {
		return { failed: true };
	}
	render() {
		return this.state.failed ? null : this.props.children;
	}
}

export function LearningTimeReminder(props: {
	onOpen: () => void;
	disabled: boolean;
}) {
	return (
		<ReminderBoundary>
			<LearningTimeReminderContent {...props} />
		</ReminderBoundary>
	);
}
