import { useUser } from "@clerk/expo";
import { useMemo, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Linking,
	Platform,
	Pressable,
	View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Button } from "~/components/ui/button";
import {
	ArrowRight,
	Check,
	Logout,
	SquareLock,
	Trash2,
	UserRound,
} from "~/components/ui/icon";
import { ScreenScroll } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { useAccess } from "~/context/AccessContext";
import { useAuth } from "~/context/AuthContext";
import {
	createNativeRevenueCatClient,
	type DayovaStorePlan,
} from "~/lib/revenuecat-client";
import { env } from "~/lib/runtime-config";
import { useDayovaTheme } from "~/lib/theme";

type Payer = "parent" | "self";
type ProductIdentifier = DayovaStorePlan["productIdentifier"];

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
	const { user, logout } = useAuth();
	const { colors } = useDayovaTheme();
	const [payer, setPayer] = useState<Payer | null>(null);
	const [selectedProduct, setSelectedProduct] =
		useState<ProductIdentifier>("dayova_monthly");
	const [plans, setPlans] = useState<DayovaStorePlan[]>([]);
	const [isLoadingPlans, setIsLoadingPlans] = useState(false);
	const [isPurchasing, setIsPurchasing] = useState(false);
	const [error, setError] = useState<string | null>(null);
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

	const confirmAccountDeletion = () => {
		Alert.alert(
			"Konto wirklich löschen?",
			"Dein Dayova-Konto und deine Daten werden dauerhaft gelöscht. Ein Store-Abo musst du zusätzlich im Store kündigen.",
			[
				{ text: "Abbrechen", style: "cancel" },
				{
					text: "Konto löschen",
					style: "destructive",
					onPress: () => {
						void clerkUser
							?.delete()
							.then(() => logout())
							.catch(() => {
								setError(
									"Das Konto konnte nicht gelöscht werden. Bitte kontaktiere den Support.",
								);
							});
					},
				},
			],
		);
	};

	return (
		<ScreenScroll horizontalPadding={24} topPadding={48} bottomPadding={36}>
			<View className="items-center">
				<View className="mb-5 h-14 w-14 items-center justify-center rounded-2xl bg-system-subtle">
					<SquareLock size={28} color={colors.primaryStrong} strokeWidth={2} />
				</View>
				<Text variant="h1">Deine Testphase ist beendet</Text>
				<Text className="mt-3 max-w-md text-center text-body-2 text-secondary-text">
					Wähle zuerst, wer bezahlt. Ohne aktives Abo bleiben die Lernfunktionen
					gesperrt.
				</Text>
			</View>

			<View className="mt-8 gap-3">
				<PayerButton
					icon={<UserRound size={23} color={colors.text} strokeWidth={2} />}
					label="Meine Eltern zahlen"
					selected={payer === "parent"}
					onPress={() => {
						setPayer("parent");
						setError(null);
					}}
				/>
				<PayerButton
					icon={<Check size={23} color={colors.text} strokeWidth={2} />}
					label="Ich zahle selbst"
					selected={payer === "self"}
					onPress={() => void selectSelfPayment()}
				/>
			</View>

			{payer === "parent" ? (
				<View className="mt-6 items-center rounded-rectangle border border-border bg-card px-5 py-6">
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
							<Text className="mt-5 text-center font-semibold text-body-2">
								QR-Code an deine Eltern weitergeben
							</Text>
							<Text className="mt-2 text-center text-body-3 text-secondary-text">
								Der Link öffnet die sichere Dayova-Zahlungsseite.
							</Text>
							<Button
								className="mt-5 w-full"
								variant="outline"
								onPress={() =>
									void openUrl(env.EXPO_PUBLIC_PARENT_CHECKOUT_URL)
								}
							>
								<Text>Zahlungsseite öffnen</Text>
							</Button>
						</>
					) : (
						<>
							<Text className="text-center font-semibold text-body-2">
								Elternzahlung kommt mit der Dayova-Webzahlung
							</Text>
							<Text className="mt-2 text-center text-body-3 text-secondary-text">
								Diese Option wird erst freigeschaltet, sobald die sichere
								Website-Zahlung und Kontozuordnung bereit sind.
							</Text>
						</>
					)}
				</View>
			) : null}

			{payer === "self" ? (
				<View className="mt-6">
					<Text className="mb-3 font-semibold text-body-2">Tarif wählen</Text>
					<View className="gap-3">
						<PlanCard
							badge="11 % günstiger"
							description="13,33 € pro Monat · jährlich abgerechnet"
							label="Jährlich"
							price={planByProduct.get("dayova_annual")?.price ?? "159,99 €"}
							selected={selectedProduct === "dayova_annual"}
							onPress={() => setSelectedProduct("dayova_annual")}
						/>
						<PlanCard
							description="Monatlich abgerechnet"
							label="Monatlich"
							price={planByProduct.get("dayova_monthly")?.price ?? "14,99 €"}
							selected={selectedProduct === "dayova_monthly"}
							onPress={() => setSelectedProduct("dayova_monthly")}
						/>
					</View>
					<Button
						className="mt-5"
						disabled={
							isLoadingPlans ||
							isPurchasing ||
							!storeClient ||
							!planByProduct.has(selectedProduct)
						}
						onPress={() => void purchase()}
					>
						{isLoadingPlans || isPurchasing ? (
							<ActivityIndicator color="#FFFFFF" />
						) : (
							<Text>Im Store abonnieren</Text>
						)}
					</Button>
					<Text className="mt-3 text-center text-body-4 text-secondary-text">
						Die Zahlung läuft über den App Store oder Google Play. Das Abo
						verlängert sich dort bis zur Kündigung.
					</Text>
				</View>
			) : null}

			{error ? (
				<Text className="mt-4 text-center text-body-3 text-destructive">
					{error}
				</Text>
			) : null}

			<View className="mt-8 border-border border-t pt-5">
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
					onPress={confirmAccountDeletion}
				/>
			</View>

			<View className="mt-4 flex-row flex-wrap justify-center gap-x-4 gap-y-2">
				<LegalLink label="Support" url={env.EXPO_PUBLIC_SUPPORT_URL} />
				<LegalLink label="Datenschutz" url={env.EXPO_PUBLIC_PRIVACY_URL} />
				<LegalLink
					label="Abo-Bedingungen"
					url={env.EXPO_PUBLIC_SUBSCRIPTION_TERMS_URL}
				/>
				<LegalLink label="Kündigung" url={env.EXPO_PUBLIC_CANCELLATION_URL} />
			</View>
		</ScreenScroll>
	);
}

function PayerButton({
	icon,
	label,
	onPress,
	selected,
}: {
	icon: React.ReactNode;
	label: string;
	onPress: () => void;
	selected: boolean;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected }}
			className={`h-16 flex-row items-center rounded-button border bg-card px-5 ${
				selected ? "border-primary" : "border-border"
			}`}
			onPress={onPress}
		>
			{icon}
			<Text className="ml-3 flex-1 font-semibold text-body-2">{label}</Text>
			<ArrowRight size={20} color="#697586" strokeWidth={2} />
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
	return (
		<Pressable
			accessibilityRole="radio"
			accessibilityState={{ checked: selected }}
			className={`rounded-3xl border bg-card px-5 py-4 ${
				selected ? "border-primary" : "border-border"
			}`}
			onPress={onPress}
		>
			<View className="flex-row items-start">
				<View className="flex-1">
					<View className="flex-row flex-wrap items-center gap-2">
						<Text className="font-semibold text-body-2">{label}</Text>
						{badge ? (
							<View className="rounded-full bg-success-subtle px-2.5 py-1">
								<Text className="font-semibold text-body-4 text-success">
									{badge}
								</Text>
							</View>
						) : null}
					</View>
					<Text className="mt-1 text-body-4 text-secondary-text">
						{description}
					</Text>
				</View>
				<Text className="ml-3 font-semibold text-body-2">{price}</Text>
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
	return (
		<Pressable
			accessibilityRole="button"
			className="min-h-12 flex-row items-center py-3"
			onPress={onPress}
		>
			{icon ? <View className="mr-3">{icon}</View> : null}
			<Text
				className={`flex-1 text-body-3 ${
					destructive ? "text-destructive" : "text-secondary-text"
				}`}
			>
				{label}
			</Text>
			<ArrowRight size={18} color="#697586" />
		</Pressable>
	);
}

function LegalLink({ label, url }: { label: string; url?: string }) {
	return (
		<Pressable
			accessibilityRole="link"
			disabled={!url}
			onPress={() => void openUrl(url)}
		>
			<Text className="text-body-4 text-primary">{label}</Text>
		</Pressable>
	);
}
