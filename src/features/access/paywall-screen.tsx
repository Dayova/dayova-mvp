import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
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
// This focused branded route intentionally keeps its utility surface light in
// every app theme. Fixed shared tokens avoid stale CSS variables on Fabric.
const utilitySurfaceStyle = {
	backgroundColor: BRAND_COLORS.systemSubtle,
	borderColor: BRAND_COLORS.primaryAccent,
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
										description="Zahlungslink oder QR-Code teilen"
										icon={UserRound}
										label="Meine Eltern zahlen"
										onPress={() => openSubscription("parent")}
									/>
									<PayerButton
										description="Direkt im App Store oder bei Google Play"
										icon={CreditCard}
										label="Ich zahle selbst"
										onPress={() => openSubscription("self")}
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

						<View
							className="mt-8 rounded-card border px-5 py-2 shadow-black/10 shadow-sm"
							style={utilitySurfaceStyle}
							testID="paywall-utility-surface"
						>
							<EssentialAction
								icon={<Logout size={19} color={BRAND_COLORS.secondaryText} />}
								label="Abmelden oder Konto wechseln"
								onPress={() => void logout()}
							/>
							<EssentialAction
								icon={<Trash2 size={19} color={BRAND_COLORS.destructive} />}
								label="Konto löschen"
								destructive
								onPress={openAccountDeletion}
							/>
						</View>

						<View className="flex-row flex-wrap justify-center gap-x-4 gap-y-2 px-2 pt-5">
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
	icon,
	label,
	onPress,
}: {
	description: string;
	icon: React.ComponentType<{
		color?: string;
		size?: number;
		strokeWidth?: number;
	}>;
	label: string;
	onPress: () => void;
}) {
	const Icon = icon;

	return (
		<Pressable
			accessibilityLabel={`${label}. ${description}`}
			accessibilityHint="Öffnet die passende Aboseite."
			accessibilityRole="button"
			className="min-h-[72px] flex-row items-center rounded-card border border-white/35 bg-white/20 px-4 py-3 active:opacity-80"
			onPress={onPress}
		>
			<View className="h-10 w-10 items-center justify-center rounded-full bg-white/15">
				<Icon size={21} color={WHITE} strokeWidth={2.2} />
			</View>
			<View className="ml-3 flex-1">
				<Text className="font-semibold text-body-3 text-white">{label}</Text>
				<Text className="text-body-4 text-white/75">{description}</Text>
			</View>
			<ArrowRight size={19} color={WHITE} strokeWidth={2} />
		</Pressable>
	);
}

function EssentialAction({
	destructive = false,
	icon,
	label,
	onPress,
}: {
	destructive?: boolean;
	icon: React.ReactNode;
	label: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			className="min-h-12 flex-row items-center py-3"
			hitSlop={4}
			onPress={onPress}
		>
			<View className="mr-3">{icon}</View>
			<Text
				className="flex-1 text-body-3"
				style={{
					color: destructive
						? BRAND_COLORS.destructive
						: BRAND_COLORS.secondaryText,
				}}
			>
				{label}
			</Text>
			<ArrowRight size={18} color={BRAND_COLORS.secondaryText} />
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
