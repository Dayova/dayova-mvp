import { createElement } from "react";
import { View } from "react-native";
import { ArrowRight, CalendarDays, Check } from "~/components/ui/icon";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { ActionSurface, Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { getSubjectIcon } from "~/features/subjects/subject-catalog";
import { formatGermanUiText } from "~/lib/german-ui-text";
import { useDayovaTheme } from "~/lib/theme";
import {
	type DashboardAgendaItem,
	getAgendaEntryTitle,
} from "./dashboard-agenda";

/** Displays an entry with completion derived from its explicit state, not elapsed time. */
export function AgendaRow({
	item,
	onOpenItem,
	mode = "screen",
}: { item: DashboardAgendaItem } & (
	| { mode?: "screen"; onOpenItem: (item: DashboardAgendaItem) => void }
	| { mode: "artwork"; onOpenItem?: never }
)) {
	const isArtwork = mode === "artwork";
	const { colors } = useDayovaTheme();
	const { shouldStackInlineContent } = useContentSizeLayout();
	const subject = formatGermanUiText(item.entry.subject ?? "").trim();
	const fullTitle = formatGermanUiText(getAgendaEntryTitle(item.entry))
		.replace(/\s+/g, " ")
		.trim();
	const topic =
		subject && (fullTitle === subject || fullTitle.startsWith(`${subject} `))
			? fullTitle.slice(subject.length).trim()
			: fullTitle;
	const completed = item.entry.executionStatus
		? item.entry.executionStatus === "completed"
		: item.entry.completed === true;
	const time =
		item.startMinutes === null
			? "Ganztägig"
			: `${Math.floor(item.startMinutes / 60)
					.toString()
					.padStart(
						2,
						"0",
					)}:${(item.startMinutes % 60).toString().padStart(2, "0")}`;
	const duration = item.entry.durationMinutes;
	const kindLabel =
		item.kind === "schoolLesson"
			? "Schule"
			: item.kind === "exam"
				? "Prüfung"
				: item.kind === "homework"
					? "Hausaufgabe"
					: null;
	const metadata = [
		time,
		duration != null && duration > 0 ? `${duration} min` : null,
		kindLabel,
	]
		.filter(Boolean)
		.join(" · ");
	const label = [
		subject,
		topic,
		metadata,
		completed
			? "Erledigt"
			: item.entry.executionStatus === "started"
				? "Begonnen"
				: null,
	]
		.filter(Boolean)
		.join(". ");
	const content = (
		<View className="flex-row items-center gap-3">
			<View
				accessible={false}
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
				className="h-10 w-10 items-center justify-center rounded-full bg-system-subtle"
			>
				{createElement(getSubjectIcon(subject), {
					size: 20,
					color: colors.primaryStrong,
					strokeWidth: 1.9,
				})}
			</View>
			<View className="min-w-0 flex-1 gap-1">
				<Text
					className="font-poppins font-semibold text-body-3 text-text"
					allowFontScaling={!isArtwork}
					numberOfLines={!isArtwork && shouldStackInlineContent ? undefined : 1}
					ellipsizeMode="tail"
				>
					{[subject, topic].filter(Boolean).join(" · ")}
				</Text>
				<Text
					className="font-poppins text-body-4 text-secondary-text"
					allowFontScaling={!isArtwork}
					numberOfLines={!isArtwork && shouldStackInlineContent ? undefined : 1}
					ellipsizeMode="tail"
				>
					{metadata}
				</Text>
			</View>
			{completed ? (
				<View
					testID="agenda-completed"
					accessible={false}
					accessibilityElementsHidden
					importantForAccessibility="no-hide-descendants"
				>
					<Check size={20} color={colors.primaryStrong} strokeWidth={2} />
				</View>
			) : item.kind !== "schoolLesson" ? (
				<View
					testID="agenda-open-arrow"
					accessible={false}
					accessibilityElementsHidden
					importantForAccessibility="no-hide-descendants"
				>
					<ArrowRight
						size={18}
						color={colors.secondaryText}
						strokeWidth={1.9}
					/>
				</View>
			) : null}
		</View>
	);
	const className = "border border-border bg-card px-4 py-3";
	if (isArtwork) {
		return (
			<Surface
				className={className}
				accessible={false}
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
				pointerEvents="none"
			>
				{content}
			</Surface>
		);
	}
	return item.kind === "schoolLesson" ? (
		<Surface className={className} accessible accessibilityLabel={label}>
			{content}
		</Surface>
	) : (
		<ActionSurface
			className={className}
			accessible
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityHint={
				item.entry.relatedLearningPlanId
					? "Öffnet den zugehörigen Lernplan."
					: "Öffnet diesen Eintrag."
			}
			onPress={() => onOpenItem?.(item)}
		>
			{content}
		</ActionSurface>
	);
}

/** Displays a day's compact entries or a non-interactive empty state. */
export function CompactDayAgenda({
	items,
	isLoading,
	onOpenItem,
}: {
	items: DashboardAgendaItem[];
	isLoading: boolean;
	onOpenItem: (item: DashboardAgendaItem) => void;
}) {
	const { colors } = useDayovaTheme();
	if (isLoading)
		return (
			<Text
				accessibilityRole="progressbar"
				className="py-4 text-center font-poppins text-body-3 text-secondary-text"
			>
				Dein Tag wird geladen …
			</Text>
		);
	if (!items.length)
		return (
			<View
				className="min-h-44 items-center justify-center gap-3 py-6"
				testID="calendar-empty-day"
			>
				<View
					className="h-14 w-14 items-center justify-center rounded-full bg-system-subtle"
					accessible={false}
					accessibilityElementsHidden
					importantForAccessibility="no-hide-descendants"
				>
					<CalendarDays
						size={28}
						color={colors.primaryStrong}
						strokeWidth={1.5}
					/>
				</View>
				<Text className="text-center font-poppins text-body-3 text-secondary-text">
					Für diesen Tag ist nichts geplant.
				</Text>
				<Text className="text-center font-poppins text-body-4 text-secondary-text">
					Wische, um deine anderen Tage anzusehen.
				</Text>
			</View>
		);
	return (
		<View className="gap-3">
			{items.map((item) => (
				<AgendaRow key={item.entry.id} item={item} onOpenItem={onOpenItem} />
			))}
		</View>
	);
}
