import { useUser } from "@clerk/expo";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConfirmationSheet } from "~/components/ui/confirmation-sheet";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import {
	ArrowRight,
	CreditCard,
	Logout,
	SquareLock,
	Trash2,
	UserRound,
} from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { useAccountActions } from "~/context/AuthContext";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { openExternalUrl } from "~/lib/open-external-url";
import { env } from "~/lib/runtime-config";

export type SubscriptionPayer = "parent" | "self";

const PAYWALL_GRADIENT = DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive;
const BRAND_COLORS = DAYOVA_DESIGN_SYSTEM.colors;
const WHITE = BRAND_COLORS.light1;
// LinearGradient exposes its full-bleed geometry through the native style API.
const gradientFillStyle = StyleSheet.absoluteFill;
// This focused branded route intentionally keeps its primary payer surface
// light in every app theme. Fixed shared tokens avoid stale CSS variables on
// Fabric.
const primaryPayerSurfaceStyle = {
	backgroundColor: BRAND_COLORS.surface,
	borderColor: BRAND_COLORS.light1,
};
const primaryPayerIconStyle = {
	backgroundColor: BRAND_COLORS.primaryStrong,
};

export function PaywallScreen() {
	const { user: clerkUser } = useUser();
	const { logout } = useAccountActions();
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [error, setError] = useState<string | null>(null);
	const [showSubscriptionManagement, setShowSubscriptionManagement] =
		useState(false);
	const pendingManagementActionRef = useRef<"delete" | null>(null);
	const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
	const [isDeletingAccount, setIsDeletingAccount] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const deletionInFlightRef = useRef(false);

	const openSubscription = (payer: SubscriptionPayer) => {
		router.push({
			pathname: "/subscription",
			params: { payer },
		});
	};

	const requestAccountDeletion = () => {
		setDeleteError(null);
		pendingManagementActionRef.current = "delete";
		setShowSubscriptionManagement(false);
	};

	const finishSubscriptionManagementDismissal = () => {
		if (pendingManagementActionRef.current !== "delete") return;
		pendingManagementActionRef.current = null;
		setShowDeleteConfirmation(true);
	};

	const switchAccount = () => {
		setShowSubscriptionManagement(false);
		void logout();
	};

	const deleteAccount = async () => {
		if (!clerkUser || deletionInFlightRef.current) return;
		deletionInFlightRef.current = true;
		setDeleteError(null);
		setIsDeletingAccount(true);
		try {
			await clerkUser.delete();
			await logout();
			setShowDeleteConfirmation(false);
		} catch {
			setDeleteError(
				"Das Konto konnte nicht gelöscht werden. Bitte kontaktiere den Support.",
			);
		} finally {
			deletionInFlightRef.current = false;
			setIsDeletingAccount(false);
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
		<>
			<View className="flex-1 bg-primary-strong">
				<StatusBar style="light" />
				<LinearGradient
					pointerEvents="none"
					colors={PAYWALL_GRADIENT.colors}
					start={PAYWALL_GRADIENT.start}
					end={PAYWALL_GRADIENT.end}
					style={gradientFillStyle}
				/>
				<ScrollView
					alwaysBounceVertical={false}
					className="flex-1"
					contentInsetAdjustmentBehavior="never"
					showsVerticalScrollIndicator={false}
					// This full-screen route has no native header, so its scroll
					// content owns both runtime safe-area values explicitly.
					contentContainerStyle={{
						paddingBottom: Math.max(insets.bottom, 24),
						paddingTop: insets.top,
					}}
				>
					<View className="px-7 pt-5">
						<View className="gap-3 pb-7">
							<Text className="font-semibold text-body-4 text-white/85">
								TESTPHASE BEENDET
							</Text>
							<Text
								variant="h1"
								className="max-w-[330px] text-left font-semibold text-heading-1 text-white leading-tight"
							>
								Deine Testphase ist beendet
							</Text>
							<Text className="max-w-[340px] text-body-3 text-white/90">
								Dein Lernstand bleibt erhalten. Wähle jetzt, wie du mit Dayova
								weitermachen möchtest.
							</Text>
						</View>

						<View className="flex-row">
							<View className="mr-5 items-center">
								<View className="z-10 h-12 w-12 items-center justify-center rounded-full bg-white">
									<UserRound
										size={24}
										color={BRAND_COLORS.primaryStrong}
										strokeWidth={2.3}
									/>
								</View>
								<View className="my-1 min-h-10 w-[3px] flex-1 rounded-full bg-white/35" />
							</View>
							<View className="flex-1 pt-1 pb-6">
								<Text className="font-semibold text-body-2 text-white">
									Wer bezahlt?
								</Text>
								<Text className="mt-1 text-body-3 text-white/85">
									Wähle den passenden Weg für dich.
								</Text>
								<View className="mt-4 gap-3">
									<PayerButton
										description="Direkt im App Store oder bei Google Play"
										icon={CreditCard}
										label="Ich zahle selbst"
										onPress={() => openSubscription("self")}
										testID="payer-self-action"
									/>
									<PayerButton
										description="Zahlungslink oder QR-Code teilen"
										icon={UserRound}
										label="Meine Eltern zahlen"
										onPress={() => openSubscription("parent")}
										testID="payer-parent-action"
									/>
								</View>
							</View>
						</View>

						<View className="flex-row">
							<View className="mr-5 items-center">
								<View className="h-12 w-12 items-center justify-center rounded-full border border-white/35 bg-white/20">
									<SquareLock size={24} color={WHITE} strokeWidth={2.3} />
								</View>
							</View>
							<View className="flex-1 pt-1 pb-2">
								<Text className="font-semibold text-body-2 text-white">
									Zugang freischalten
								</Text>
								<Text className="mt-1 text-body-3 text-white/85">
									Auf der nächsten Seite schließt du den gewählten Zahlungsweg
									ab.
								</Text>
							</View>
						</View>

						{error ? (
							<View className="mt-4 rounded-3xl bg-white px-4 py-3">
								<Text
									accessibilityLiveRegion="polite"
									className="text-center text-body-3 text-destructive"
									selectable
								>
									{error}
								</Text>
							</View>
						) : null}

						<View className="flex-row flex-wrap justify-center gap-x-4 gap-y-2 px-2 pt-6">
							<LegalLink
								label="Support"
								url={env.EXPO_PUBLIC_SUPPORT_URL}
								onOpen={openLink}
							/>
							<LegalLink
								label="Datenschutz"
								url={env.EXPO_PUBLIC_PRIVACY_URL}
								onOpen={openLink}
							/>
							<LegalLink
								label="Abo-Bedingungen"
								url={env.EXPO_PUBLIC_SUBSCRIPTION_TERMS_URL}
								onOpen={openLink}
							/>
							<LegalLink
								label="Kündigung"
								url={env.EXPO_PUBLIC_CANCELLATION_URL}
								onOpen={openLink}
							/>
							<LegalLink
								label="Abo verwalten"
								onPress={() => setShowSubscriptionManagement(true)}
							/>
						</View>
					</View>
				</ScrollView>
			</View>
			<DayovaSheetFrame
				visible={showSubscriptionManagement}
				title="Abo verwalten"
				description="Hier findest du Informationen zu deinem Zugang und kannst dein Dayova-Konto wechseln oder löschen."
				closeAccessibilityLabel="Abo-Verwaltung schließen"
				onClose={() => setShowSubscriptionManagement(false)}
				onDismiss={finishSubscriptionManagementDismissal}
			>
				<View className="overflow-hidden rounded-card border border-border/45 bg-card">
					<ManagementAction
						accessibilityLabel="Abmelden oder Konto wechseln"
						icon={<Logout size={20} color={BRAND_COLORS.primaryStrong} />}
						label="Konto wechseln"
						onPress={switchAccount}
					/>
					<View className="mx-4 h-px bg-border" />
					<ManagementAction
						destructive
						icon={<Trash2 size={20} color={BRAND_COLORS.destructive} />}
						label="Konto löschen"
						onPress={requestAccountDeletion}
					/>
				</View>
			</DayovaSheetFrame>
			<ConfirmationSheet
				visible={showDeleteConfirmation}
				title="Konto wirklich löschen?"
				description="Dein Dayova-Konto und deine Daten werden dauerhaft gelöscht. Ein Store-Abo musst du zusätzlich im Store kündigen."
				confirmLabel="Konto löschen"
				isBusy={isDeletingAccount}
				errorMessage={deleteError}
				onClose={() => setShowDeleteConfirmation(false)}
				onConfirm={() => void deleteAccount()}
			/>
		</>
	);
}

function PayerButton({
	description,
	icon,
	label,
	onPress,
	testID,
}: {
	description: string;
	icon: React.ComponentType<{
		color?: string;
		size?: number;
		strokeWidth?: number;
	}>;
	label: string;
	onPress: () => void;
	testID: string;
}) {
	const Icon = icon;

	return (
		<Pressable
			accessibilityLabel={`${label}. ${description}`}
			accessibilityHint="Öffnet die passende Aboseite."
			accessibilityRole="button"
			className="min-h-20 flex-row items-center rounded-card border px-4 py-3 shadow-black/15 shadow-md active:opacity-90"
			onPress={onPress}
			style={primaryPayerSurfaceStyle}
			testID={testID}
		>
			<View
				className="h-11 w-11 items-center justify-center rounded-full bg-white/20"
				style={primaryPayerIconStyle}
			>
				<Icon size={22} color={WHITE} strokeWidth={2.3} />
			</View>
			<View className="ml-3 flex-1">
				<Text className="font-semibold text-body-5 text-primary-strong">
					SOFORT STARTEN
				</Text>
				<Text
					className="font-semibold text-body-3"
					style={{ color: BRAND_COLORS.text }}
				>
					{label}
				</Text>
				<Text
					className="text-body-4"
					style={{ color: BRAND_COLORS.secondaryText }}
				>
					{description}
				</Text>
			</View>
			<View className="h-9 w-9 items-center justify-center rounded-full bg-primary-strong">
				<ArrowRight size={18} color={WHITE} strokeWidth={2.2} />
			</View>
		</Pressable>
	);
}

function ManagementAction({
	accessibilityLabel,
	destructive = false,
	icon,
	label,
	onPress,
}: {
	accessibilityLabel?: string;
	destructive?: boolean;
	icon: React.ReactNode;
	label: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			accessibilityLabel={accessibilityLabel}
			accessibilityRole="button"
			className="min-h-14 flex-row items-center px-4 py-3 active:bg-system-subtle"
			onPress={onPress}
		>
			<View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-system-subtle">
				{icon}
			</View>
			<Text
				className={
					destructive
						? "flex-1 font-semibold text-body-3 text-destructive"
						: "flex-1 font-semibold text-body-3 text-text"
				}
			>
				{label}
			</Text>
			<ArrowRight
				size={18}
				color={
					destructive ? BRAND_COLORS.destructive : BRAND_COLORS.secondaryText
				}
				strokeWidth={2}
			/>
		</Pressable>
	);
}

function LegalLink({
	label,
	onOpen,
	onPress,
	url,
}: {
	label: string;
	onOpen?: (url?: string) => Promise<void>;
	onPress?: () => void;
	url?: string;
}) {
	return (
		<Pressable
			accessibilityRole="link"
			disabled={!url && !onPress}
			hitSlop={8}
			onPress={() => {
				if (onPress) {
					onPress();
					return;
				}
				if (onOpen) void onOpen(url);
			}}
		>
			<Text className="text-body-4 text-white underline">{label}</Text>
		</Pressable>
	);
}
