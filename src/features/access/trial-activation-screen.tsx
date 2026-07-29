import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
import { Bell, Check, SquareLock } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { useAccess } from "~/context/AccessContext";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { openExternalUrl } from "~/lib/open-external-url";
import { env } from "~/lib/runtime-config";

const TRIAL_TERMS_VERSION = "2026-07-28-v1";
const TRIAL_GRADIENT = DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive;
const WHITE = DAYOVA_DESIGN_SYSTEM.colors.light1;
// LinearGradient exposes its full-bleed geometry through the native style API.
const gradientFillStyle = StyleSheet.absoluteFill;

const timelineItems = [
	{
		body: "Du kannst alle Lernfunktionen 14 Tage lang ohne Zahlungsmittel nutzen.",
		icon: Check,
		title: "Heute: Dein voller Zugriff startet",
	},
	{
		body: "Wir erinnern dich in Dayova und – wenn erlaubt – per Mitteilung.",
		icon: Bell,
		title: "Tag 12: Wir erinnern dich",
	},
	{
		body: "Du entscheidest selbst, ob du weitermachst. Es wird nichts automatisch berechnet.",
		icon: SquareLock,
		title: "Tag 14: Du entscheidest",
	},
] as const;

export function TrialActivationScreen() {
	const { access, activateTrial } = useAccess();
	const insets = useSafeAreaInsets();
	const { fontScale, height: windowHeight } = useWindowDimensions();
	const [isStarting, setIsStarting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const activationInFlightRef = useRef(false);
	const showStarting = isStarting || access?.canUseApp === true;
	const scrollEnabled = windowHeight < 820 || fontScale > 1;

	const startTrial = async () => {
		if (showStarting || activationInFlightRef.current) return;
		activationInFlightRef.current = true;
		setError(null);
		setIsStarting(true);
		try {
			await activateTrial(TRIAL_TERMS_VERSION);
		} catch {
			setError("Deine Testphase konnte nicht gestartet werden.");
		} finally {
			activationInFlightRef.current = false;
			setIsStarting(false);
		}
	};

	const openLink = async (url?: string) => {
		const opened = await openExternalUrl(url);
		if (!opened) {
			setError(
				"Der Link konnte nicht geöffnet werden. Bitte versuche es erneut.",
			);
		}
	};

	return (
		<View className="flex-1 bg-primary-strong">
			<StatusBar style="light" />
			<LinearGradient
				pointerEvents="none"
				colors={TRIAL_GRADIENT.colors}
				start={TRIAL_GRADIENT.start}
				end={TRIAL_GRADIENT.end}
				style={gradientFillStyle}
			/>
			<ScrollView
				alwaysBounceVertical={false}
				bounces={scrollEnabled}
				className="flex-1"
				contentInsetAdjustmentBehavior={scrollEnabled ? "automatic" : "never"}
				key={scrollEnabled ? "scrollable-trial" : "fixed-trial"}
				scrollEnabled={scrollEnabled}
				showsVerticalScrollIndicator={false}
				// Disabled iOS ScrollViews do not apply automatic top insets, so
				// fixed mode owns that runtime safe-area value explicitly.
				contentContainerStyle={{
					flexGrow: 1,
					paddingBottom: Math.max(insets.bottom, 16),
					paddingTop: scrollEnabled ? 0 : insets.top,
				}}
			>
				<View className="flex-1 px-7 pt-5 pb-2">
					<View className="gap-2 pb-7">
						<Text className="font-semibold text-body-4 text-white/85">
							14 TAGE KOSTENLOS
						</Text>
						<Text
							variant="h1"
							className="max-w-[330px] text-left font-semibold text-heading-1 text-white leading-tight"
						>
							So läuft deine Testphase
						</Text>
						<Text className="max-w-[330px] text-body-3 text-white/90">
							Voller Zugriff. Ohne Zahlungsmittel. Ohne automatische
							Verlängerung.
						</Text>
					</View>

					<View>
						{timelineItems.map((item, index) => {
							const Icon = item.icon;
							const isLast = index === timelineItems.length - 1;
							return (
								<View key={item.title} className="flex-row">
									<View className="mr-5 items-center">
										<View
											className={
												index === 0
													? "z-10 h-12 w-12 items-center justify-center rounded-full bg-white"
													: index === 1
														? "z-10 h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-white/25"
														: "z-10 h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-white/15"
											}
										>
											<Icon
												size={24}
												color={
													index === 0
														? DAYOVA_DESIGN_SYSTEM.colors.primaryStrong
														: WHITE
												}
												strokeWidth={2.4}
											/>
										</View>
										{!isLast ? (
											<View
												className={
													index === 0
														? "my-1 min-h-10 w-[3px] flex-1 rounded-full bg-white/55"
														: "my-1 min-h-10 w-[3px] flex-1 rounded-full bg-white/25"
												}
											/>
										) : null}
									</View>
									<View className={isLast ? "flex-1 pt-1" : "flex-1 pt-1 pb-6"}>
										<Text className="font-semibold text-body-2 text-white">
											{item.title}
										</Text>
										<Text className="mt-1 text-body-3 text-white/85">
											{item.body}
										</Text>
									</View>
								</View>
							);
						})}
					</View>

					<View className="pt-7">
						<View className="flex-row items-center gap-3">
							<View className="h-px flex-1 bg-white/30" />
							<SquareLock size={18} color={WHITE} strokeWidth={2.2} />
							<View className="h-px flex-1 bg-white/30" />
						</View>
						<View className="gap-1 py-4">
							<Text className="text-center font-semibold text-body-2 text-white">
								Danach, nur wenn du dich entscheidest
							</Text>
							<Text className="text-center text-body-4 text-white/80">
								Die aktuellen Preise werden dir vor dem Kauf im App Store oder
								bei Google Play angezeigt.
							</Text>
						</View>

						{error ? (
							<View className="mb-3 rounded-3xl bg-white/95 px-4 py-3">
								<Text
									accessibilityLiveRegion="polite"
									className="text-center text-body-3 text-destructive"
									selectable
								>
									{error}
								</Text>
							</View>
						) : null}
						<Button
							accessibilityHint="Aktiviert deine kostenlose 14-tägige Testphase."
							className="border-white bg-white shadow-black/10 active:bg-white/90"
							disabled={showStarting}
							onPress={() => void startTrial()}
							variant="outline"
						>
							{showStarting ? (
								<ActivityIndicator
									color={DAYOVA_DESIGN_SYSTEM.colors.primaryStrong}
								/>
							) : (
								<Text className="font-semibold text-body-2 text-primary-strong">
									Dayova starten
								</Text>
							)}
						</Button>
						<Text className="pt-3 text-center text-body-4 text-white/80">
							Mit „Dayova starten“ akzeptierst du die Bedingungen der Testphase.
						</Text>
						<View className="flex-row flex-wrap justify-center gap-x-4 gap-y-1 pt-1">
							<Pressable
								accessibilityRole="link"
								disabled={!env.EXPO_PUBLIC_TERMS_URL}
								hitSlop={8}
								onPress={() => void openLink(env.EXPO_PUBLIC_TERMS_URL)}
							>
								<Text className="text-body-4 text-white underline">
									Nutzungsbedingungen
								</Text>
							</Pressable>
							<Pressable
								accessibilityRole="link"
								disabled={!env.EXPO_PUBLIC_PRIVACY_URL}
								hitSlop={8}
								onPress={() => void openLink(env.EXPO_PUBLIC_PRIVACY_URL)}
							>
								<Text className="text-body-4 text-white underline">
									Datenschutz
								</Text>
							</Pressable>
						</View>
					</View>
				</View>
			</ScrollView>
		</View>
	);
}
