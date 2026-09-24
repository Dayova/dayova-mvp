import { ActivityIndicator, View, type ViewStyle } from "react-native";
import { Button } from "~/components/ui/button";
import { CalendarDays, Plus } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { useDayovaTheme } from "~/lib/theme";

// Continuous corners are a native rendering control without a class equivalent.
const continuousBorderStyle = {
	borderCurve: "continuous",
} satisfies ViewStyle;

type TimetableEntryProps = {
	isImportDisabled: boolean;
	isManualDisabled: boolean;
	isOpeningImport: boolean;
	onImport: () => void;
	onAddManualLesson: () => void;
};

export function TimetableEntry({
	isImportDisabled,
	isManualDisabled,
	isOpeningImport,
	onImport,
	onAddManualLesson,
}: TimetableEntryProps) {
	const { colors } = useDayovaTheme();

	return (
		<View className="gap-5">
			<View
				className="overflow-hidden rounded-card border border-border bg-card p-6"
				style={continuousBorderStyle}
			>
				<View className="h-14 w-14 items-center justify-center rounded-full bg-system-subtle">
					<CalendarDays
						size={26}
						color={colors.primaryStrong}
						strokeWidth={2}
					/>
				</View>
				<Text
					accessibilityRole="header"
					className="mt-5 font-semibold text-heading-2 text-text"
				>
					Deine Schulzeiten im Tagesplan
				</Text>
				<Text className="mt-3 text-body-3 text-secondary-text">
					Lade ein Bild oder PDF hoch. Prüfe die erkannten Stunden, bevor sie
					bei „Heute“ erscheinen und Lernzeiten blockieren.
				</Text>
			</View>

			<View className="gap-3">
				<Button
					accessibilityLabel="Stundenplan importieren"
					accessibilityHint="Öffnet die Auswahl zum Scannen oder Hochladen eines Stundenplans."
					accessibilityState={{ busy: isOpeningImport }}
					disabled={isImportDisabled}
					onPress={onImport}
				>
					{isOpeningImport ? (
						<ActivityIndicator color="#FFFFFF" />
					) : (
						<CalendarDays size={20} color="#FFFFFF" strokeWidth={2} />
					)}
					<Text className="shrink text-center">Stundenplan importieren</Text>
				</Button>
				<Text className="text-center text-body-4 text-secondary-text">
					Bild, PDF oder direkt mit der Kamera
				</Text>
			</View>

			<Button
				accessibilityLabel="Unterrichtsstunde manuell hinzufügen"
				disabled={isManualDisabled}
				variant="neutral"
				onPress={onAddManualLesson}
			>
				<Plus size={20} color={colors.background} strokeWidth={2} />
				<Text className="shrink text-center">Stunde manuell hinzufügen</Text>
			</Button>
		</View>
	);
}
