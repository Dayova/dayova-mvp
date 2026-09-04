import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	StyleSheet,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
import { ArrowLeft, Check } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { useAccess } from "~/context/AccessContext";
import { useAuthSession } from "~/context/AuthContext";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { logDiagnosticError } from "~/lib/diagnostics";
import { openExternalUrl } from "~/lib/open-external-url";
import {
	createNativeRevenueCatClient,
	type DayovaBillingPeriod,
	type DayovaStorePlan,
} from "~/lib/revenuecat-client";
import { env } from "~/lib/runtime-config";
import { getStoreName, getStoreSubscribeLabel } from "~/lib/store-subscription";

const SUBSCRIPTION_GRADIENT = DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive;
const BRAND_COLORS = DAYOVA_DESIGN_SYSTEM.colors;
const WHITE = BRAND_COLORS.light1;
// LinearGradient accepts its full-bleed geometry only through the native style API.
const gradientFillStyle = StyleSheet.absoluteFill;
// Fixed native design tokens keep Fabric descendants on this branded light
// surface legible when the system theme changes.
const primaryTextStyle = { color: BRAND_COLORS.text };
const secondaryTextStyle = { color: BRAND_COLORS.secondaryText };
// Button state styles are merged natively, so the branded Store action uses
// fixed design tokens instead of CSS variables.
const subscribeActionStyle = {
	backgroundColor: BRAND_COLORS.text,
	borderColor: BRAND_COLORS.border,
};
const planGlassSurface = "rgba(255, 255, 255, 0.8)";
const planGlassBorder = "rgba(255, 255, 255, 0.6)";
const STORE_NAME = getStoreName(process.env.EXPO_OS);

const getStoreApiKey = () =>
	process.env.EXPO_OS === "ios"
		? env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
		: process.env.EXPO_OS === "android"
			? env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
			: undefined;

const getPlanDescription = (
	plan: DayovaStorePlan | undefined,
	isLoading: boolean,
) => {
	if (!plan) {
		return isLoading
			? "Preis wird geladen …"
			: "Derzeit nicht im Store verfügbar";
	}
	if (plan.billingPeriod === "annual") {
		return plan.pricePerMonth
			? `${plan.pricePerMonth} pro Monat bei jährlicher Abrechnung`
			: `${plan.price} pro Jahr`;
	}
	return `${plan.price} pro Monat`;
};

export function SubscriptionScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { refreshPaidAccess } = useAccess();
	const { user } = useAuthSession();
	const storeApiKey = getStoreApiKey();
	const appUserId = user?.clerkId;
	const storeConnection = useMemo(() => {
		if (!appUserId || !storeApiKey)
			return { client: null, initializationError: null };
		try {
			return {
				client: createNativeRevenueCatClient({
					apiKey: storeApiKey,
					appUserId,
				}),
				initializationError: null,
			};
		} catch (initializationError) {
			return { client: null, initializationError };
		}
	}, [appUserId, storeApiKey]);
	const storeClient = storeConnection.client;
	const [selectedBillingPeriod, setSelectedBillingPeriod] =
		useState<DayovaBillingPeriod>("monthly");
	const [plans, setPlans] = useState<DayovaStorePlan[]>([]);
	const [isLoadingPlans, setIsLoadingPlans] = useState(Boolean(storeClient));
	const [isPurchasing, setIsPurchasing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const storeActionInFlightRef = useRef(false);

	useEffect(() => {
		if (!storeClient) {
			if (storeConnection.initializationError) {
				logDiagnosticError(
					"Unable to initialize RevenueCat.",
					storeConnection.initializationError,
					{
						source: "paywall.store.initialize",
						level: "error",
					},
				);
			}
			return;
		}
		let isActive = true;
		void storeClient
			.getPlans()
			.then((loadedPlans) => {
				if (isActive) setPlans(loadedPlans);
			})
			.catch((loadError: unknown) => {
				logDiagnosticError("Unable to load RevenueCat plans.", loadError, {
					source: "paywall.store.plans",
					level: "error",
				});
				if (isActive)
					setError("Die Tarife konnten nicht aus dem Store geladen werden.");
			})
			.finally(() => {
				if (isActive) setIsLoadingPlans(false);
			});
		return () => {
			isActive = false;
		};
	}, [storeClient, storeConnection.initializationError]);

	const planByBillingPeriod = useMemo(
		() => new Map(plans.map((plan) => [plan.billingPeriod, plan])),
		[plans],
	);

	const finishStoreAction = async (
		action: () => Promise<
			| { status: "purchased" }
			| { status: "cancelled" }
			| { status: "notEntitled" }
		>,
		successPath: "/home" | "/pro-welcome",
	) => {
		if (storeActionInFlightRef.current) return;
		storeActionInFlightRef.current = true;
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
			if (active) router.replace(successPath);
			else
				setError(
					"Der Kauf wird noch bestätigt. Bitte tippe gleich auf „Käufe wiederherstellen“.",
				);
		} catch (purchaseError) {
			logDiagnosticError(
				"Unable to complete RevenueCat action.",
				purchaseError,
				{
					source: "paywall.store.action",
					level: "error",
				},
			);
			setError("Der Kauf konnte nicht abgeschlossen werden.");
		} finally {
			storeActionInFlightRef.current = false;
			setIsPurchasing(false);
		}
	};

	const purchase = async () => {
		if (storeClient) {
			await finishStoreAction(
				() => storeClient.purchase(selectedBillingPeriod),
				"/pro-welcome",
			);
		}
	};
	const restore = async () => {
		if (!storeClient) {
			setError("Store-Käufe sind auf diesem Gerät nicht verfügbar.");
			return;
		}
		await finishStoreAction(() => storeClient.restore(), "/home");
	};
	const openLink = async (url?: string) => {
		if (!(await openExternalUrl(url))) {
			setError(
				"Der Link konnte nicht geöffnet werden. Bitte versuche es erneut.",
			);
		}
	};
	const goBack = () => {
		if (router.canGoBack()) router.back();
		else router.replace("/paywall");
	};

	const annualPlan = planByBillingPeriod.get("annual");
	const monthlyPlan = planByBillingPeriod.get("monthly");
	const selectedPlan = planByBillingPeriod.get(selectedBillingPeriod);
	const storeUnavailableMessage = storeConnection.initializationError
		? "Store-Käufe konnten auf diesem Gerät nicht gestartet werden. Bitte öffne die App erneut oder kontaktiere den Support."
		: "Store-Käufe sind auf diesem Gerät noch nicht verfügbar.";

	return (
		<View className="flex-1 bg-primary-strong">
			<StatusBar style="light" />
			<LinearGradient
				pointerEvents="none"
				colors={SUBSCRIPTION_GRADIENT.colors}
				start={SUBSCRIPTION_GRADIENT.start}
				end={SUBSCRIPTION_GRADIENT.end}
				style={gradientFillStyle}
			/>
			<ScrollView
				alwaysBounceVertical={false}
				className="flex-1"
				contentInsetAdjustmentBehavior="never"
				showsVerticalScrollIndicator={false}
				// Runtime safe-area values cannot be represented by static classes.
				contentContainerStyle={{
					paddingBottom: Math.max(insets.bottom, 24),
					paddingTop: insets.top,
				}}
			>
				<View className="px-7 pt-4">
					<Pressable
						accessibilityHint="Kehrt zur vorherigen Seite zurück."
						accessibilityLabel="Zurück"
						accessibilityRole="button"
						className="h-12 w-12 items-center justify-center rounded-full bg-white active:opacity-80"
						hitSlop={8}
						onPress={goBack}
					>
						<ArrowLeft
							size={21}
							color={BRAND_COLORS.primaryStrong}
							strokeWidth={2.4}
						/>
					</Pressable>

					<View className="gap-3 pt-5 pb-6" testID="subscription-page-intro">
						<Text
							variant="h1"
							className="text-left font-semibold text-body-1 text-white"
						>
							Dayova Pro abonnieren
						</Text>
						<Text className="max-w-[340px] text-body-3 text-white/90">
							Wähle deinen Tarif. Der Kauf und die Verlängerung werden sicher
							über {STORE_NAME} abgewickelt.
						</Text>
					</View>

					<View className="mb-5 gap-2 rounded-3xl bg-white/15 px-4 py-4">
						<Benefit>Persönliche Lernpläne für deine Prüfungen</Benefit>
						<Benefit>Dein Lernstand und deine Pläne bleiben erhalten</Benefit>
						<Benefit>Auf allen Geräten mit deinem Dayova-Konto nutzbar</Benefit>
					</View>

					<View className="gap-3">
						<PlanCard
							description={getPlanDescription(annualPlan, isLoadingPlans)}
							label="Jährlich"
							price={annualPlan?.price ?? "—"}
							selected={selectedBillingPeriod === "annual"}
							testID="subscription-plan-annual"
							onPress={() => setSelectedBillingPeriod("annual")}
						/>
						<PlanCard
							description={getPlanDescription(monthlyPlan, isLoadingPlans)}
							label="Monatlich"
							price={monthlyPlan?.price ?? "—"}
							selected={selectedBillingPeriod === "monthly"}
							testID="subscription-plan-monthly"
							onPress={() => setSelectedBillingPeriod("monthly")}
						/>
					</View>

					{!storeClient ? (
						<Text
							accessibilityLiveRegion="polite"
							className="mt-3 text-center text-body-4 text-white"
						>
							{storeUnavailableMessage}
						</Text>
					) : null}

					<Button
						accessibilityHint={`Öffnet den Kauf in ${STORE_NAME}.`}
						className="mt-5"
						disabled={
							isLoadingPlans || isPurchasing || !storeClient || !selectedPlan
						}
						variant="neutral"
						style={subscribeActionStyle}
						testID="subscription-checkout-button"
						onPress={() => void purchase()}
					>
						{isLoadingPlans || isPurchasing ? (
							<ActivityIndicator color={WHITE} />
						) : (
							<Text className="text-white">
								{getStoreSubscribeLabel(process.env.EXPO_OS)}
							</Text>
						)}
					</Button>

					<Text className="mt-3 text-center text-body-4 text-white/85">
						Das Abo verlängert sich automatisch, sofern du es nicht spätestens
						24 Stunden vor Ablauf in {STORE_NAME} kündigst.
					</Text>

					<Pressable
						accessibilityRole="button"
						accessibilityState={{
							busy: isPurchasing,
							disabled: isPurchasing || !storeClient,
						}}
						className="min-h-12 items-center justify-center px-4"
						disabled={isPurchasing || !storeClient}
						hitSlop={4}
						onPress={() => void restore()}
						testID="restore-purchases-link"
					>
						<Text className="text-body-4 text-white underline">
							Käufe wiederherstellen
						</Text>
					</Pressable>

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
							label="Nutzungsbedingungen"
							url={env.EXPO_PUBLIC_TERMS_URL}
							onOpen={openLink}
						/>
						<LegalLink
							label="Abo-Bedingungen"
							url={env.EXPO_PUBLIC_SUBSCRIPTION_TERMS_URL}
							onOpen={openLink}
						/>
					</View>
				</View>
			</ScrollView>
		</View>
	);
}

function Benefit({ children }: { children: string }) {
	return (
		<View className="flex-row items-start gap-3">
			<View className="mt-0.5 h-5 w-5 items-center justify-center rounded-full bg-white">
				<Check size={13} color={BRAND_COLORS.primaryStrong} strokeWidth={3} />
			</View>
			<Text className="flex-1 text-body-4 text-white">{children}</Text>
		</View>
	);
}

function PlanCard({
	description,
	label,
	onPress,
	price,
	selected,
	testID,
}: {
	description: string;
	label: string;
	onPress: () => void;
	price: string;
	selected: boolean;
	testID: string;
}) {
	return (
		<Pressable
			accessibilityLabel={`${label}, ${price}. ${description}`}
			accessibilityRole="radio"
			accessibilityState={{ checked: selected }}
			className="rounded-3xl border px-5 py-4"
			onPress={onPress}
			testID={testID}
			// Selection changes native glass border and shadow values at runtime.
			style={{
				backgroundColor: planGlassSurface,
				borderColor: selected ? BRAND_COLORS.text : planGlassBorder,
				borderWidth: 1,
				boxShadow: selected
					? "inset 0 1px 0 rgba(255, 255, 255, 0.64), 0 8px 20px rgba(9, 54, 78, 0.1)"
					: "inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 6px 16px rgba(9, 54, 78, 0.08)",
			}}
		>
			<View className="flex-row items-start">
				<View className="flex-1 pr-3">
					<Text className="font-semibold text-body-2" style={primaryTextStyle}>
						{label}
					</Text>
					<Text className="mt-1 text-body-4" style={secondaryTextStyle}>
						{description}
					</Text>
				</View>
				<View className="items-end gap-2">
					<Text className="font-semibold text-body-2" style={primaryTextStyle}>
						{price}
					</Text>
					<View
						accessible={false}
						className="h-6 w-6 items-center justify-center rounded-full border"
						// The selected radio state drives both native colors.
						style={{
							backgroundColor: selected
								? BRAND_COLORS.text
								: BRAND_COLORS.surface,
							borderColor: selected ? BRAND_COLORS.text : BRAND_COLORS.border,
						}}
						testID={`${testID}-indicator`}
					>
						{selected ? (
							<Check size={14} color={WHITE} strokeWidth={3} />
						) : null}
					</View>
				</View>
			</View>
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
