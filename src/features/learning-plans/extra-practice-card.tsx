import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import { Text } from "~/components/ui/text";
import { getErrorMessage } from "./utils";
export function ExtraPracticeCard({
	planId,
	topics,
}: {
	planId: Id<"learningPlans">;
	topics: Array<{ id: string; title: string }>;
}) {
	const router = useRouter();
	const create = useMutation(api.learningPlans.createAdditionalPractice);
	const [visible, setVisible] = useState(false);
	const [topicId, setTopicId] = useState(topics[0]?.id ?? "");
	const [duration, setDuration] = useState(10);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const start = async () => {
		if (busy || !topicId) return;
		setBusy(true);
		setError(null);
		try {
			const sessionId = await create({
				learningPlanId: planId,
				topicId,
				durationMinutes: duration,
			});
			setVisible(false);
			router.push(`/learning-plans/${planId}/sessions/${sessionId}`);
		} catch (cause) {
			setError(
				getErrorMessage(
					cause,
					"Deine Lerneinheit konnte nicht erstellt werden.",
				),
			);
		} finally {
			setBusy(false);
		}
	};
	return (
		<>
			<View className="mt-6 gap-4 rounded-card border border-primary/20 bg-system-subtle p-5">
				<Text className="font-poppins font-semibold text-body-1 text-text">
					Lernplan geschafft!
				</Text>
				<Text className="font-poppins text-body-3 text-secondary-text">
					Du hast alle geplanten Schritte abgeschlossen. Mit Dayova kannst du
					weiterüben und Themen vertiefen – so oft du möchtest.
				</Text>
				<Button onPress={() => setVisible(true)}>
					<Text>Lerneinheit erstellen</Text>
				</Button>
			</View>
			<DayovaSheetFrame
				visible={visible}
				title="Weiterlernen"
				description="Wähle dein Thema und die Dauer."
				onClose={() => {
					if (!busy) setVisible(false);
				}}
				dismissible={!busy}
				footer={
					<Button disabled={busy || !topicId} onPress={() => void start()}>
						<Text>{busy ? "Erstellt …" : "Erstellen"}</Text>
					</Button>
				}
			>
				<View className="gap-3">
					{topics.map((topic) => (
						<Button
							key={topic.id}
							variant={topicId === topic.id ? "default" : "cancel"}
							onPress={() => setTopicId(topic.id)}
						>
							<Text>{topic.title}</Text>
						</Button>
					))}
					<Text className="mt-4 text-secondary-text">Dauer</Text>
					<View className="flex-row flex-wrap gap-2">
						{[5, 10, 15, 20, 30].map((value) => (
							<Button
								key={value}
								size="sm"
								variant={duration === value ? "default" : "cancel"}
								onPress={() => setDuration(value)}
							>
								<Text>{value} Min.</Text>
							</Button>
						))}
					</View>
					{error ? (
						<Text accessibilityRole="alert" className="text-destructive">
							{error}
						</Text>
					) : null}
				</View>
			</DayovaSheetFrame>
		</>
	);
}
