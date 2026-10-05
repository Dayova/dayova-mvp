import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { PreparationSlot } from "#convex/preparationSchedule";
import {
	berlinNow,
	slotDateLabel,
	timeLabel,
	timeMinutes,
} from "#convex/preparationSchedule";
import { ScreenHeader } from "~/components/screen-header";
import { Button } from "~/components/ui/button";
import { Pencil, Plus, Time04 } from "~/components/ui/icon";
import {
	PortraitContent,
	useContentSizeLayout,
} from "~/components/ui/portrait-content";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { PreparationAcceptAction } from "~/features/learning-plans/preparation-accept-action";
import { PreparationSlotEditor } from "~/features/learning-plans/preparation-slot-editor";
import { getErrorMessage } from "~/features/learning-plans/utils";

type Slot = PreparationSlot & {
	locked: boolean;
	completed: boolean;
	completedMinutes: number;
};
const durationLabel = (minutes: number) =>
	minutes >= 60
		? `${Math.floor(minutes / 60)} Std.${minutes % 60 ? ` ${minutes % 60} Min.` : ""}`
		: `${minutes} Min.`;
const weekLabel = (key: string) => {
	const date = new Date(`${key}T12:00:00Z`);
	date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
	return `Woche ab ${slotDateLabel(date.toISOString().slice(0, 10))}`;
};
export default function PreparationScreen() {
	const { planId } = useLocalSearchParams<{ planId: string }>();
	const id = planId as Id<"learningPlans">;
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { horizontalPadding } = useContentSizeLayout({
		requestedHorizontalPadding: 32,
	});
	const { isAuthenticated } = useConvexAuth();
	const [proposalTime] = useState(() => berlinNow());
	const schedule = useQuery(
		api.learningPlans.getPreparationSchedule,
		isAuthenticated && id ? { learningPlanId: id, now: proposalTime } : "skip",
	);
	const snapshot = useQuery(
		api.learningPlans.getSnapshot,
		isAuthenticated && id ? { id } : "skip",
	);
	const save = useMutation(api.learningPlans.savePreparationSchedule);
	const startFlexible = useMutation(api.learningPlans.startFlexiblePreparation);
	const [draft, setDraft] = useState<{
		slots: Slot[];
		revision: number;
	} | null>(null);
	const [editing, setEditing] = useState<PreparationSlot | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const slots = draft?.slots ?? schedule?.slots ?? [];
	const total = slots.reduce(
		(sum, s) => sum + s.durationMinutes + s.completedMinutes,
		0,
	);
	const budget = schedule?.budgetMinutes ?? 0;
	const update = (next: Slot[]) =>
		setDraft({
			slots: next.sort(
				(a, b) =>
					a.dateKey.localeCompare(b.dateKey) ||
					a.startTime.localeCompare(b.startTime),
			),
			revision: draft?.revision ?? schedule?.revision ?? 0,
		});
	const accept = async () => {
		if (busy || !schedule) return;
		setBusy(true);
		setError(null);
		try {
			await save({
				learningPlanId: id,
				revision: draft?.revision ?? schedule.revision,
				slots: slots.map(({ id, dateKey, startTime, durationMinutes }) => ({
					id,
					dateKey,
					startTime,
					durationMinutes,
				})),
			});
			router.replace(`/learning-plans/${id}`);
		} catch (cause) {
			setError(
				getErrorMessage(
					cause,
					"Deine Termine konnten nicht übernommen werden.",
				),
			);
		} finally {
			setBusy(false);
		}
	};
	const startNow = async () => {
		if (busy) return;
		setBusy(true);
		setError(null);
		try {
			const sessionId = await startFlexible({ learningPlanId: id });
			router.replace(
				budget === 0
					? `/learning-plans/${id}`
					: `/learning-plans/${id}/sessions/${sessionId}`,
			);
		} catch (cause) {
			setError(
				getErrorMessage(cause, "Dein Lernplan konnte nicht gestartet werden."),
			);
			setBusy(false);
		}
	};
	const add = () => {
		const now = berlinNow();
		let dateKey = now.dateKey;
		let time = slots[0]?.startTime ?? "17:00";
		if ((timeMinutes(time) ?? 0) <= now.minutes) {
			const date = new Date(`${dateKey}T12:00:00Z`);
			date.setUTCDate(date.getUTCDate() + 1);
			dateKey = date.toISOString().slice(0, 10);
			if (dateKey >= (snapshot?.plan.examDateKey.slice(0, 10) ?? dateKey)) {
				dateKey = now.dateKey;
				time = timeLabel(Math.min(1410, Math.ceil((now.minutes + 5) / 5) * 5));
			}
		}
		setEditing({
			id: `manual-${Date.now()}`,
			dateKey,
			startTime: time,
			durationMinutes: 30,
		});
	};
	const groups = new Map<string, Slot[]>();
	for (const slot of slots) {
		const week = weekLabel(slot.dateKey);
		const days = groups.get(week) ?? [];
		days.push(slot);
		groups.set(week, days);
	}
	return (
		<Screen>
			<ScreenScroll includeTopSafeArea>
				<ScreenHeader
					title="Deine Lernzeiten"
					onBack={() => router.replace("/learning-plans")}
				/>
				<View className="items-center pt-3 pb-8">
					<View className="h-20 w-20 items-center justify-center rounded-full bg-system-subtle">
						<Time04 size={34} color="#00A0E6" strokeWidth={2.4} />
					</View>
					<Text className="mt-3 font-poppins font-semibold text-body-3 text-primary">
						Deine Vorbereitung
					</Text>
					<Text className="mt-4 text-center font-poppins font-semibold text-heading-2 text-text">
						Dein Plan ist bereit
					</Text>
					<Text className="mt-3 text-center font-poppins text-body-3 text-secondary-text">
						{schedule
							? `Du hast ${schedule.correctCount} von ${schedule.questionCount} Fragen richtig beantwortet. Für deine Vorbereitung empfehlen wir insgesamt etwa ${durationLabel(schedule.totalMinutes)}.`
							: "Deine Termine werden vorbereitet …"}
					</Text>
				</View>

				{!schedule ? (
					<ActivityIndicator color="#00A0E6" />
				) : (
					<>
						{Array.from(groups, ([week, days]) => (
							<View key={week} className="mb-5 gap-3">
								{groups.size > 1 ? (
									<Text className="font-poppins font-semibold text-body-4 text-secondary-text">
										{week}
									</Text>
								) : null}
								{days.map((slot) => (
									<Pressable
										key={slot.id}
										disabled={slot.locked}
										accessibilityRole="button"
										accessibilityLabel={`${slotDateLabel(slot.dateKey)}, ${slot.startTime}, ${slot.durationMinutes} Minuten${slot.locked ? ", bereits begonnen" : ", bearbeiten"}`}
										onPress={() => setEditing(slot)}
										className="min-h-20 flex-row items-center gap-3 rounded-card border border-border bg-card px-4 py-4"
									>
										<View className="h-11 w-11 items-center justify-center rounded-full bg-light-2">
											<Text className="font-poppins font-semibold text-body-4 text-text">
												{slotDateLabel(slot.dateKey).slice(0, 2)}
											</Text>
										</View>
										<View className="flex-1">
											<Text className="font-poppins font-semibold text-body-3 text-text">
												{slotDateLabel(slot.dateKey)}
											</Text>
											<Text className="mt-1 font-poppins text-body-4 text-secondary-text">
												{slot.startTime}–
												{timeLabel(
													(timeMinutes(slot.startTime) ?? 0) +
														slot.durationMinutes,
												)}{" "}
												Uhr
												{slot.completed
													? " · Geschafft"
													: slot.locked
														? " · Begonnen"
														: ""}
											</Text>
										</View>
										{!slot.locked ? (
											<Pencil size={20} className="text-text" />
										) : null}
									</Pressable>
								))}
							</View>
						))}
						{total < budget ? (
							<Text className="mb-3 text-center font-poppins text-body-4 text-secondary-text">{`${durationLabel(budget - total)} weniger als empfohlen. Wir konzentrieren uns auf die wichtigsten Übungsschwerpunkte.`}</Text>
						) : null}
						{!slots.length && snapshot?.plan.preparationState === "review" ? (
							<View className="mb-4 gap-3">
								<Text className="text-secondary-text">
									{budget === 0
										? "Dein Wissenscheck deckt die empfohlene Vorbereitungszeit bereits ab. Du kannst danach freiwillig weiterlernen."
										: "Gerade passt kein Lerntermin. Du kannst deinen Plan ohne feste Termine beginnen und später Zeiten ergänzen."}
								</Text>
							</View>
						) : null}
					</>
				)}
			</ScreenScroll>
			{schedule ? (
				<View
					className="shrink-0 border-border border-t bg-background pt-3"
					style={{ paddingBottom: Math.max(insets.bottom, 16) }}
				>
					<PortraitContent
						className="gap-3"
						style={{ paddingHorizontal: horizontalPadding }}
					>
						{error ? (
							<Text accessibilityRole="alert" className="text-destructive">
								{error}
							</Text>
						) : null}
						<Button
							variant="cancel"
							className="border-primary/40 border-dashed"
							disabled={busy || !snapshot}
							onPress={add}
						>
							<Plus size={18} color="#00A0E6" />
							<Text className="text-primary">Hinzufügen</Text>
						</Button>

						{!slots.length && snapshot?.plan.preparationState === "review" ? (
							<Button disabled={busy} onPress={() => void startNow()}>
								<Text>{budget === 0 ? "Abschließen" : "Jetzt lernen"}</Text>
							</Button>
						) : (
							<PreparationAcceptAction
								plannedMinutes={total}
								recommendedMinutes={budget}
								busy={busy}
								disabled={!slots.length}
								onAccept={accept}
							/>
						)}
					</PortraitContent>
				</View>
			) : null}
			{editing && snapshot ? (
				<PreparationSlotEditor
					slot={editing}
					examDateKey={snapshot.plan.examDateKey}
					onSave={(value) =>
						update([
							...slots.filter((s) => s.id !== value.id),
							{
								...value,
								locked: false,
								completed: false,
								completedMinutes:
									slots.find((s) => s.id === value.id)?.completedMinutes ?? 0,
							},
						])
					}
					onRemove={
						slots.some((s) => s.id === editing.id)
							? () => update(slots.filter((s) => s.id !== editing.id))
							: undefined
					}
					onClose={() => setEditing(null)}
				/>
			) : null}
		</Screen>
	);
}
