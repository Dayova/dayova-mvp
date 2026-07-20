import { useConvexAuth, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, View } from "react-native";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { ScreenHeader as Header } from "~/components/screen-header";
import { Button } from "~/components/ui/button";
import { ClipboardEdit, Plus } from "~/components/ui/icon";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { Screen, ScreenScroll } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { ThemedStatusBar } from "~/components/ui/themed-status-bar";
import { WarningBanner } from "~/components/ui/warning-banner";
import { useAuth } from "~/context/AuthContext";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { goBackToReturnOrReplace } from "~/lib/navigation";
import { getSafeReturnTo, ROUTES, withReturnTo } from "~/lib/routes";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

const LEARNING_DAYS = [
	{ abbreviation: "Mo", label: "Montag", value: 1 },
	{ abbreviation: "Di", label: "Dienstag", value: 2 },
	{ abbreviation: "Mi", label: "Mittwoch", value: 3 },
	{ abbreviation: "Do", label: "Donnerstag", value: 4 },
	{ abbreviation: "Fr", label: "Freitag", value: 5 },
	{ abbreviation: "Sa", label: "Samstag", value: 6 },
	{ abbreviation: "So", label: "Sonntag", value: 7 },
] as const;

function LearningTimeRow({
	abbreviation,
	accessibilityLabel,
	label,
	onPress,
	timeRange,
}: {
	abbreviation: string;
	accessibilityLabel: string;
	label: string;
	onPress: () => void;
	timeRange: string;
}) {
	const { colors } = useDayovaTheme();
	const { shouldStackInlineContent } = useContentSizeLayout({
		requestedHorizontalPadding: 24,
	});

	return (
		<Pressable
			accessibilityLabel={accessibilityLabel}
			accessibilityRole="button"
			className={cn(
				"min-h-[96px] rounded-[48px] bg-card px-6 active:opacity-85",
				shouldStackInlineContent
					? "items-stretch gap-3 py-4"
					: "flex-row items-center",
			)}
			onPress={onPress}
		>
			<View
				className={cn(
					"min-w-0 flex-1",
					shouldStackInlineContent ? "items-start" : "flex-row items-center",
				)}
			>
				<View
					className={cn(
						"shrink-0 items-center justify-center rounded-full bg-button-neutral",
						shouldStackInlineContent
							? "min-h-16 min-w-16 px-4 py-3"
							: "h-16 w-16",
					)}
				>
					<Text className="font-poppins font-semibold text-background text-body-1">
						{abbreviation}
					</Text>
				</View>

				<View
					className={cn(
						"min-w-0 flex-1",
						shouldStackInlineContent ? "mt-3" : "ml-5",
					)}
				>
					<Text
						className="font-poppins font-semibold text-body-1 text-text"
						numberOfLines={shouldStackInlineContent ? undefined : 1}
					>
						{label}
					</Text>
					<Text
						className="font-poppins text-body-2 text-secondary-text"
						numberOfLines={shouldStackInlineContent ? undefined : 1}
					>
						{timeRange}
					</Text>
				</View>
			</View>

			<View
				className={cn(
					"h-[72px] w-[72px] items-center justify-center rounded-full border border-border bg-card",
					shouldStackInlineContent && "self-end",
				)}
			>
				<ClipboardEdit size={30} color={colors.text} strokeWidth={1.8} />
			</View>
		</Pressable>
	);
}

export default function LearningTimesOverviewScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ returnTo?: string }>();
	const { user } = useAuth();
	const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const learningTimes = useQuery(
		api.learningTimes.listMine,
		user && isConvexAuthenticated ? {} : "skip",
	);

	const rows =
		learningTimes?.map((entry) => {
			const day = LEARNING_DAYS.find(
				(learningDay) => learningDay.value === entry.dayOfWeek,
			);

			return {
				abbreviation: day?.abbreviation ?? "?",
				dayOfWeek: entry.dayOfWeek,
				id: entry.id,
				label: day?.label ?? "Lerntag",
				timeRange: `${entry.startTime} - ${entry.endTime}`,
			};
		}) ?? [];
	const firstMissingDay =
		LEARNING_DAYS.find(
			(day) => !learningTimes?.some((entry) => entry.dayOfWeek === day.value),
		)?.value ?? 1;
	const returnTo = getSafeReturnTo(params.returnTo);

	const goBack = () => {
		goBackToReturnOrReplace(router, ROUTES.settings, returnTo);
	};

	const openEditor = ({
		dayOfWeek,
		id,
	}: {
		dayOfWeek: number;
		id?: Id<"userLearningTimes">;
	}) => {
		const idParam = id ? `&id=${encodeURIComponent(id)}` : "";
		router.push(
			withReturnTo(`/learning-times/edit?day=${dayOfWeek}${idParam}`, returnTo),
		);
	};

	return (
		<Screen>
			<ThemedStatusBar />
			<ScreenScroll topPadding={80} bottomPadding={150} horizontalPadding={24}>
				<Header title={"Lern\u00ADzeiten"} onBack={goBack} className="mb-11" />

				<View className="gap-4">
					<Text className="font-poppins font-semibold text-heading-2 text-text">
						{"Lern\u00ADzeiten an\u00ADpassen"}
					</Text>
					<Text className="font-poppins text-body-1 text-secondary-text">
						Trage hier deine wiederkehrend verfügbaren Zeiten ein, an denen du
						lernen kannst.
					</Text>
				</View>

				<View className="mt-9 gap-7">
					{learningTimes === undefined ? (
						<View className="items-center py-5">
							<ActivityIndicator color={DAYOVA_DESIGN_SYSTEM.colors.primary} />
						</View>
					) : null}

					{learningTimes?.length === 0 ? (
						<WarningBanner
							title={"Lern\u00ADzeiten fehlen"}
							description="Dayova braucht Lernzeiten, damit wir Lernpläne in deine freien Zeitfenster eintragen können. Lege mindestens eine Lernzeit an, bevor du einen Plan erstellen lässt."
							ctaLabel="Lernzeit hinzufügen"
							onPressCta={() => openEditor({ dayOfWeek: firstMissingDay })}
						/>
					) : null}

					{rows.map((row) => (
						<LearningTimeRow
							key={row.id}
							abbreviation={row.abbreviation}
							accessibilityLabel={`${row.label}, Lernzeit ${row.timeRange} bearbeiten`}
							label={row.label}
							timeRange={row.timeRange}
							onPress={() =>
								openEditor({ dayOfWeek: row.dayOfWeek, id: row.id })
							}
						/>
					))}
				</View>
			</ScreenScroll>

			<View
				pointerEvents="box-none"
				className="absolute right-0 bottom-0 left-0 flex-col items-end px-6 pb-24"
			>
				<Button
					accessibilityLabel="Lernzeit hinzufügen"
					className="h-[74px] w-[74px] rounded-full px-0"
					onPress={() => openEditor({ dayOfWeek: firstMissingDay })}
				>
					<Plus size={32} color="#FFFFFF" strokeWidth={1.8} />
				</Button>
			</View>
		</Screen>
	);
}
