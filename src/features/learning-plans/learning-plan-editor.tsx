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
	footer,
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
	footer?: ReactNode;
}) {
	const insets = useSafeAreaInsets();
	const { horizontalPadding, usableWidth } = useContentSizeLayout();
	const actionWidth =
		isLoading || isMissing ? usableWidth : Math.max(0, (usableWidth - 12) / 2);
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
			</PortraitContent>
			<ScreenScroll
				includeTopSafeArea={false}
				topPadding={8}
				bottomPadding={32}
			>
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
					</View>
				)}
			</ScreenScroll>
			<PortraitContent
				className="flex-row items-stretch gap-3 bg-background pt-6"
				style={{
					paddingHorizontal: horizontalPadding,
					paddingBottom: Math.max(insets.bottom, 20),
				}}
			>
				{footer ?? (
					<>
						<Button
							variant="cancel"
							className="min-h-16 min-w-0 px-3 py-4"
							style={{ width: actionWidth }}
							onPress={onCancel}
							accessibilityLabel="Abbrechen"
						>
							<Text
								className="min-w-0 shrink text-center"
								numberOfLines={1}
								adjustsFontSizeToFit
							>
								Abbrechen
							</Text>
						</Button>
						{!isLoading && !isMissing ? (
							<Button
								className="min-h-16 min-w-0 px-3 py-4"
								style={{ width: actionWidth }}
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
									<Text
										className="min-w-0 shrink text-center"
										numberOfLines={1}
										adjustsFontSizeToFit
									>
										Speichern
									</Text>
								)}
							</Button>
						) : null}
					</>
				)}
			</PortraitContent>
		</>
	);
}
