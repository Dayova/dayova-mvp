import { useUser } from "@clerk/expo";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConfirmationSheet } from "~/components/ui/confirmation-sheet";
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
// This focused branded route intentionally keeps its primary payer and utility
// surfaces light in every app theme. Fixed shared tokens avoid stale CSS
// variables on Fabric.
const utilitySurfaceStyle = {
	backgroundColor: BRAND_COLORS.systemSubtle,
	borderColor: BRAND_COLORS.primaryAccent,
};
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

	const openAccountDeletion = () => {
		setDeleteError(null);
		setShowDeleteConfirmation(true);
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
						<View className="gap-2 pb-7">
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
										emphasis="primary"
										icon={CreditCard}
										label="Ich zahle selbst"
										onPress={() => openSubscription("self")}
									/>
									<PayerButton
										description="Zahlungslink oder QR-Code teilen"
										icon={UserRound}
										label="Meine Eltern zahlen"
										onPress={() => openSubscription("parent")}
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
						</View>

						<View
							className="mt-4 flex-row rounded-3xl border px-2 py-1 shadow-black/5 shadow-sm"
							style={utilitySurfaceStyle}
							testID="paywall-utility-surface"
						>
							<EssentialAction
								accessibilityLabel="Abmelden oder Konto wechseln"
								icon={<Logout size={16} color={BRAND_COLORS.secondaryText} />}
								label="Konto wechseln"
								onPress={() => void logout()}
							/>
							<View className="my-2 w-px bg-border" />
							<EssentialAction
								icon={<Trash2 size={16} color={BRAND_COLORS.destructive} />}
								label="Konto löschen"
								destructive
								onPress={openAccountDeletion}
							/>
						</View>
					</View>
				</ScrollView>
			</View>
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
	emphasis = "secondary",
	icon,
	label,
	onPress,
}: {
	description: string;
	emphasis?: "primary" | "secondary";
	icon: React.ComponentType<{
		color?: string;
		size?: number;
		strokeWidth?: number;
	}>;
	label: string;
	onPress: () => void;
}) {
	const Icon = icon;
	const isPrimary = emphasis === "primary";

	return (
		<Pressable
			accessibilityLabel={`${label}. ${description}`}
			accessibilityHint="Öffnet die passende Aboseite."
			accessibilityRole="button"
			className={
				isPrimary
					? "min-h-20 flex-row items-center rounded-card border px-4 py-3 shadow-black/15 shadow-md active:opacity-90"
					: "min-h-[72px] flex-row items-center rounded-card border border-white/50 bg-white/25 px-4 py-3 active:bg-white/30"
			}
			onPress={onPress}
			style={isPrimary ? primaryPayerSurfaceStyle : undefined}
			testID={`payer-${emphasis}-action`}
		>
			<View
				className="h-11 w-11 items-center justify-center rounded-full bg-white/20"
				style={isPrimary ? primaryPayerIconStyle : undefined}
			>
				<Icon
					size={22}
					color={isPrimary ? WHITE : BRAND_COLORS.light1}
					strokeWidth={2.3}
				/>
			</View>
			<View className="ml-3 flex-1">
				{isPrimary ? (
					<Text className="font-semibold text-body-5 text-primary-strong">
						SOFORT STARTEN
					</Text>
				) : null}
				<Text
					className={
						isPrimary
							? "font-semibold text-body-2"
							: "font-semibold text-body-3"
					}
					style={{
						color: isPrimary ? BRAND_COLORS.text : BRAND_COLORS.light1,
					}}
				>
					{label}
				</Text>
				<Text
					className="text-body-4"
					style={{
						color: isPrimary ? BRAND_COLORS.secondaryText : BRAND_COLORS.light1,
					}}
				>
					{description}
				</Text>
			</View>
			<View
				className={
					isPrimary
						? "h-9 w-9 items-center justify-center rounded-full bg-primary-strong"
						: "h-9 w-9 items-center justify-center rounded-full bg-white/15"
				}
			>
				<ArrowRight size={18} color={WHITE} strokeWidth={2.2} />
			</View>
		</Pressable>
	);
}

function EssentialAction({
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
			className="min-h-11 flex-1 flex-row items-center justify-center px-2 py-2"
			hitSlop={4}
			onPress={onPress}
		>
			<View className="mr-2.5">{icon}</View>
			<Text
				className="font-semibold text-body-5"
				style={{
					color: destructive
						? BRAND_COLORS.destructive
						: BRAND_COLORS.secondaryText,
				}}
			>
				{label}
			</Text>
		</Pressable>
	);
}

function LegalLink({
	label,
	onOpen,
	url,
}: {
	label: string;
	onOpen: (url?: string) => Promise<void>;
	url?: string;
}) {
	return (
		<Pressable
			accessibilityRole="link"
			disabled={!url}
			hitSlop={8}
			onPress={() => void onOpen(url)}
		>
			<Text className="text-body-4 text-white underline">{label}</Text>
		</Pressable>
	);
}
