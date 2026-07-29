import { useUser } from "@clerk/expo";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
	ActivityIndicator,
	Linking,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
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
import { useAccess } from "~/context/AccessContext";
import { useAccountActions, useAuthSession } from "~/context/AuthContext";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import {
	createNativeRevenueCatClient,
	type DayovaStorePlan,
} from "~/lib/revenuecat-client";
import { env } from "~/lib/runtime-config";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

type Payer = "parent" | "self";
type ProductIdentifier = DayovaStorePlan["productIdentifier"];

const PAYWALL_GRADIENT = DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive;
const WHITE = DAYOVA_DESIGN_SYSTEM.colors.light1;
const gradientFillStyle = StyleSheet.absoluteFill;

const openUrl = async (url?: string) => {
	if (url) await Linking.openURL(url);
};

const getStoreApiKey = () =>
	Platform.select({
		ios: env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
		android: env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
	});

export function PaywallScreen() {
	const { user: clerkUser } = useUser();
	const { access, refreshPaidAccess } = useAccess();
	const { user } = useAuthSession();
	const { logout } = useAccountActions();
	const { colors } = useDayovaTheme();
	const insets = useSafeAreaInsets();
	// Runtime theme colors avoid mixed light/dark CSS variables on already-mounted
	// Fabric views; static geometry and spacing remain in NativeWind.
	const adaptiveSurfaceStyle = {
		backgroundColor: colors.surface,
		borderColor: colors.border,
	};
	const primaryTextStyle = { color: colors.text };
	const secondaryTextStyle = { color: colors.secondaryText };
	const [payer, setPayer] = useState<Payer | null>(null);
	const [selectedProduct, setSelectedProduct] =
		useState<ProductIdentifier>("dayova_monthly");
	const [plans, setPlans] = useState<DayovaStorePlan[]>([]);
	const [isLoadingPlans, setIsLoadingPlans] = useState(false);
	const [isPurchasing, setIsPurchasing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
	const [isDeletingAccount, setIsDeletingAccount] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const storeApiKey = getStoreApiKey();
	const storeClient = useMemo(
		() =>
			user && storeApiKey
				? createNativeRevenueCatClient({
						apiKey: storeApiKey,
						appUserId: user.clerkId,
					})
				: null,
		[storeApiKey, user],
	);

	const selectSelfPayment = async () => {
		setPayer("self");
		setError(null);
		if (!storeClient || plans.length > 0 || isLoadingPlans) return;
		setIsLoadingPlans(true);
		try {
			setPlans(await storeClient.getPlans());
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: "Die Tarife konnten nicht aus dem Store geladen werden.",
			);
		} finally {
			setIsLoadingPlans(false);
		}
	};

	const planByProduct = useMemo(
		() => new Map(plans.map((plan) => [plan.productIdentifier, plan])),
		[plans],
	);

	const finishStoreAction = async (
		action: () => Promise<
			| { status: "purchased" }
			| { status: "cancelled" }
			| { status: "notEntitled" }
		>,
	) => {
		if (isPurchasing) return;
		setError(null);
		setIsPurchasing(true);
		try {
			const result = await action();
			if (result.status === "cancelled") return;
			if (result.status !== "purchased") {
				setError("Für dieses Store-Konto wurde kein aktives Abo gefunden.");
				return;
			}
			const active = await refreshPaidAccess();
			if (!active) {
				setError(
					"Der Kauf wird noch bestätigt. Bitte tippe gleich auf „Käufe wiederherstellen“.",
				);
			}
		} catch (purchaseError) {
			setError(
				purchaseError instanceof Error
					? purchaseError.message
					: "Der Kauf konnte nicht abgeschlossen werden.",
			);
		} finally {
			setIsPurchasing(false);
		}
	};

	const purchase = async () => {
		if (!storeClient) return;
		await finishStoreAction(() => storeClient.purchase(selectedProduct));
	};

	const restore = async () => {
		if (!storeClient) {
			setError("Store-Käufe sind auf diesem Gerät nicht verfügbar.");
			return;
		}
		await finishStoreAction(() => storeClient.restore());
	};

	const openAccountDeletion = () => {
		setDeleteError(null);
		setShowDeleteConfirmation(true);
	};

	const deleteAccount = async () => {
		if (!clerkUser || isDeletingAccount) return;
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
			setIsDeletingAccount(false);
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
					// This full-screen route has no native header, and iOS does not
					// apply an automatic top inset here. The scroll content therefore
					// owns both runtime safe-area values explicitly.
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
										color={colors.primaryStrong}
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
										selected={payer === "parent"}
										onPress={() => {
											setPayer("parent");
											setError(null);
										}}
									/>
									<PayerButton
										description="Direkt im App Store oder bei Google Play"
										icon={CreditCard}
										label="Ich zahle selbst"
										selected={payer === "self"}
										onPress={() => void selectSelfPayment()}
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
									{payer
										? "Schließe den gewählten Zahlungsweg ab."
										: "Danach geht es direkt mit deinem Lernplan weiter."}
								</Text>
							</View>
						</View>

						{payer === "parent" ? (
							<View
								className="mt-5 items-center rounded-card border px-5 py-6 shadow-black/10 shadow-sm"
								style={adaptiveSurfaceStyle}
							>
								{env.EXPO_PUBLIC_PARENT_CHECKOUT_URL ? (
									<>
										<View className="rounded-2xl bg-white p-4">
											<QRCode
												value={env.EXPO_PUBLIC_PARENT_CHECKOUT_URL}
												size={184}
												color="#1A1A1A"
												backgroundColor="#FFFFFF"
											/>
										</View>
										<Text
											className="mt-5 text-center font-semibold text-body-2"
											style={primaryTextStyle}
										>
											QR-Code an deine Eltern weitergeben
										</Text>
										<Text
											className="mt-2 text-center text-body-3"
											style={secondaryTextStyle}
										>
											Der Link öffnet die sichere Dayova-Zahlungsseite.
										</Text>
										<Button
											accessibilityHint="Öffnet den Zahlungslink, den du mit deinen Eltern teilen kannst."
											className="mt-5 w-full"
											variant="neutral"
											style={{
												backgroundColor: colors.buttonNeutral,
												borderColor: colors.border,
											}}
											onPress={() =>
												void openUrl(env.EXPO_PUBLIC_PARENT_CHECKOUT_URL)
											}
										>
											<Text style={{ color: colors.background }}>
												Zahlungsseite öffnen
											</Text>
										</Button>
									</>
								) : (
									<>
										<Text
											className="text-center font-semibold text-body-2"
											style={primaryTextStyle}
										>
											Elternzahlung kommt mit der Dayova-Webzahlung
										</Text>
										<Text
											className="mt-2 text-center text-body-3"
											style={secondaryTextStyle}
										>
											Diese Option wird freigeschaltet, sobald die sichere
											Website-Zahlung und Kontozuordnung bereit sind.
										</Text>
									</>
								)}
							</View>
						) : null}

						{payer === "self" ? (
							<View
								className="mt-5 rounded-card border px-5 py-6 shadow-black/10 shadow-sm"
								style={adaptiveSurfaceStyle}
							>
								<Text
									className="mb-3 font-semibold text-body-2"
									style={primaryTextStyle}
								>
									Tarif wählen
								</Text>
								<View className="gap-3">
									<PlanCard
										badge="11 % günstiger"
										description="13,33 € pro Monat · jährlich abgerechnet"
										label="Jährlich"
										price={
											planByProduct.get("dayova_annual")?.price ?? "159,99 €"
										}
										selected={selectedProduct === "dayova_annual"}
										onPress={() => setSelectedProduct("dayova_annual")}
									/>
									<PlanCard
										description="Monatlich abgerechnet"
										label="Monatlich"
										price={
											planByProduct.get("dayova_monthly")?.price ?? "14,99 €"
										}
										selected={selectedProduct === "dayova_monthly"}
										onPress={() => setSelectedProduct("dayova_monthly")}
									/>
								</View>
								<Button
									accessibilityHint="Öffnet den Kauf im App Store oder bei Google Play."
									className="mt-5"
									disabled={
										isLoadingPlans ||
										isPurchasing ||
										!storeClient ||
										!planByProduct.has(selectedProduct)
									}
									variant="neutral"
									style={{
										backgroundColor: colors.buttonNeutral,
										borderColor: colors.border,
									}}
									onPress={() => void purchase()}
								>
									{isLoadingPlans || isPurchasing ? (
										<ActivityIndicator color={colors.background} />
									) : (
										<Text style={{ color: colors.background }}>
											Im Store abonnieren
										</Text>
									)}
								</Button>
								<Text
									className="mt-3 text-center text-body-4"
									style={secondaryTextStyle}
								>
									Die Zahlung läuft über den App Store oder Google Play. Das Abo
									verlängert sich dort bis zur Kündigung.
								</Text>
							</View>
						) : null}

						{error ? (
							<View
								className="mt-4 rounded-3xl px-4 py-3"
								style={{ backgroundColor: colors.surface }}
							>
								<Text
									accessibilityLiveRegion="polite"
									className="text-center text-body-3"
									selectable
									style={{ color: colors.destructive }}
								>
									{error}
								</Text>
							</View>
						) : null}

						<View
							className="mt-8 rounded-card px-5 py-2 shadow-black/10 shadow-sm"
							style={{ backgroundColor: colors.surface }}
						>
							<EssentialAction
								label="Käufe wiederherstellen"
								onPress={() => void restore()}
							/>
							{access?.managementUrl ? (
								<EssentialAction
									label="Abo verwalten"
									onPress={() => void openUrl(access.managementUrl)}
								/>
							) : null}
							<EssentialAction
								icon={<Logout size={19} color={colors.secondaryText} />}
								label="Abmelden oder Konto wechseln"
								onPress={() => void logout()}
							/>
							<EssentialAction
								icon={<Trash2 size={19} color={colors.destructive} />}
								label="Konto löschen"
								destructive
								onPress={openAccountDeletion}
							/>
						</View>

						<View className="flex-row flex-wrap justify-center gap-x-4 gap-y-2 px-2 pt-5">
							<LegalLink label="Support" url={env.EXPO_PUBLIC_SUPPORT_URL} />
							<LegalLink
								label="Datenschutz"
								url={env.EXPO_PUBLIC_PRIVACY_URL}
							/>
							<LegalLink
								label="Abo-Bedingungen"
								url={env.EXPO_PUBLIC_SUBSCRIPTION_TERMS_URL}
							/>
							<LegalLink
								label="Kündigung"
								url={env.EXPO_PUBLIC_CANCELLATION_URL}
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
	selected,
}: {
	description: string;
	icon: React.ComponentType<{
		color?: string;
		size?: number;
		strokeWidth?: number;
	}>;
	label: string;
	onPress: () => void;
	selected: boolean;
}) {
	const Icon = icon;
	const { colors } = useDayovaTheme();

	return (
		<Pressable
			accessibilityLabel={`${label}. ${description}`}
			accessibilityRole="button"
			accessibilityState={{ selected }}
			className={cn(
				"min-h-[72px] flex-row items-center rounded-card border px-4 py-3 active:opacity-90",
				!selected && "border-white/30 bg-white/15",
			)}
			onPress={onPress}
			// Selected surfaces use runtime theme colors because mounted Fabric
			// descendants can otherwise retain stale NativeWind variables.
			style={
				selected
					? {
							backgroundColor: colors.surface,
							borderColor: colors.primary,
						}
					: undefined
			}
		>
			<View
				className={cn(
					"h-10 w-10 items-center justify-center rounded-full",
					!selected && "bg-white/15",
				)}
				style={selected ? { backgroundColor: colors.systemSubtle } : undefined}
			>
				<Icon
					size={21}
					color={
						selected ? colors.primaryStrong : DAYOVA_DESIGN_SYSTEM.colors.light1
					}
					strokeWidth={2.2}
				/>
			</View>
			<View className="ml-3 flex-1">
				<Text
					className={cn("font-semibold text-body-3", !selected && "text-white")}
					style={selected ? { color: colors.text } : undefined}
				>
					{label}
				</Text>
				<Text
					className={cn("text-body-4", !selected && "text-white/75")}
					style={selected ? { color: colors.secondaryText } : undefined}
				>
					{description}
				</Text>
			</View>
			<ArrowRight
				size={19}
				color={
					selected ? colors.primaryStrong : DAYOVA_DESIGN_SYSTEM.colors.light1
				}
				strokeWidth={2}
			/>
		</Pressable>
	);
}

function PlanCard({
	badge,
	description,
	label,
	onPress,
	price,
	selected,
}: {
	badge?: string;
	description: string;
	label: string;
	onPress: () => void;
	price: string;
	selected: boolean;
}) {
	const { colors } = useDayovaTheme();

	return (
		<Pressable
			accessibilityLabel={`${label}, ${price}. ${description}`}
			accessibilityRole="radio"
			accessibilityState={{ checked: selected }}
			className="rounded-3xl border px-5 py-4"
			onPress={onPress}
			// Plan colors are runtime theme data for the same Fabric variable
			// invalidation case as the containing payment surface.
			style={{
				backgroundColor: selected ? colors.systemSubtle : colors.surface,
				borderColor: selected ? colors.primaryStrong : colors.border,
			}}
		>
			<View className="flex-row items-start">
				<View className="flex-1">
					<View className="flex-row flex-wrap items-center gap-2">
						<Text
							className="font-semibold text-body-2"
							style={{ color: colors.text }}
						>
							{label}
						</Text>
						{badge ? (
							<View
								className="rounded-full px-2.5 py-1"
								style={{ backgroundColor: colors.successSubtle }}
							>
								<Text
									className="font-semibold text-body-4"
									style={{ color: colors.success }}
								>
									{badge}
								</Text>
							</View>
						) : null}
					</View>
					<Text
						className="mt-1 text-body-4"
						style={{ color: colors.secondaryText }}
					>
						{description}
					</Text>
				</View>
				<Text
					className="ml-3 font-semibold text-body-2"
					style={{ color: colors.text }}
				>
					{price}
				</Text>
			</View>
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
	icon?: React.ReactNode;
	label: string;
	onPress: () => void;
}) {
	const { colors } = useDayovaTheme();

	return (
		<Pressable
			accessibilityRole="button"
			className="min-h-12 flex-row items-center py-3"
			hitSlop={4}
			onPress={onPress}
		>
			{icon ? <View className="mr-3">{icon}</View> : null}
			<Text
				className="flex-1 text-body-3"
				style={{
					color: destructive ? colors.destructive : colors.secondaryText,
				}}
			>
				{label}
			</Text>
			<ArrowRight size={18} color={colors.secondaryText} />
		</Pressable>
	);
}

function LegalLink({ label, url }: { label: string; url?: string }) {
	return (
		<Pressable
			accessibilityRole="link"
			disabled={!url}
			hitSlop={8}
			onPress={() => void openUrl(url)}
		>
			<Text className="text-body-4 text-white underline">{label}</Text>
		</Pressable>
	);
}
