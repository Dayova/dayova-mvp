import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
import {
	PortraitContent,
	useContentSizeLayout,
} from "~/components/ui/portrait-content";
import { ScreenScroll } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";

export function LearningPlanEditor({
	topics,
	onChangeTopics,
	canEditTopics,
	isLoading,
	isMissing,
	isBusy,
	canSave,
	errorMessage,
	onCancel,
	onSave,
	children,
}: {
	topics: string;
	onChangeTopics: (value: string) => void;
	canEditTopics: boolean;
	isLoading: boolean;
	isMissing: boolean;
	isBusy: boolean;
	canSave: boolean;
	errorMessage: string | null;
	onCancel: () => void;
	onSave: () => void;
	children: ReactNode;
}) {
	const insets = useSafeAreaInsets();
	const { horizontalPadding } = useContentSizeLayout();
	return (
		<>
			<PortraitContent
				className="gap-3 pb-4"
				style={{
					paddingTop: insets.top + 16,
					paddingHorizontal: horizontalPadding,
				}}
			>
				<Text accessibilityRole="header" className="font-semibold text-body-1">
					Lernplan bearbeiten
				</Text>
				<Button
					variant="neutral"
					onPress={onCancel}
					accessibilityLabel="Abbrechen"
				>
					<Text className="min-w-0 shrink text-center">Abbrechen</Text>
				</Button>
			</PortraitContent>
			<ScreenScroll includeTopSafeArea={false} topPadding={8}>
				{isLoading ? (
					<ActivityIndicator accessibilityLabel="Lernplan wird geladen" />
				) : isMissing ? (
					<Text accessibilityRole="alert">
						Der Lernplan ist nicht verfügbar. Kehre zu Pläne zurück und versuche
						es erneut.
					</Text>
				) : (
					<View className="gap-6">
						<View className="gap-3">
							<Text className="font-semibold">Prüfungsthemen</Text>
							{canEditTopics ? (
								<Textarea
									accessibilityLabel="Prüfungsthemen"
									value={topics}
									onChangeText={onChangeTopics}
									editable={!isBusy}
									className="min-h-48 flex-none rounded-[24px] border border-border bg-card px-4 py-4"
								/>
							) : (
								<>
									<Text selectable>{topics}</Text>
									<Text className="text-body-3 text-secondary-text">
										Die Themen dieses Lernplans sind bereits festgelegt. Du
										kannst weiterhin Schulmaterial ergänzen.
									</Text>
								</>
							)}
						</View>
						{children}
						{errorMessage ? (
							<Text accessibilityRole="alert" className="text-destructive">
								{errorMessage}
							</Text>
						) : null}
						<Button
							disabled={!canSave || isBusy}
							accessibilityLabel={
								isBusy ? "Speichern, wird geladen" : "Speichern"
							}
							accessibilityState={{ busy: isBusy }}
							onPress={onSave}
						>
							{isBusy ? (
								<ActivityIndicator color="#FFFFFF" />
							) : (
								<Text className="min-w-0 shrink text-center">Speichern</Text>
							)}
						</Button>
					</View>
				)}
			</ScreenScroll>
		</>
	);
}
