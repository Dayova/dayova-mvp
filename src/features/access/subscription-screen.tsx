import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
import {
	ArrowLeft,
	ArrowRight,
	CreditCard,
	SquareLock,
	UserRound,
} from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { useAccess } from "~/context/AccessContext";
import { useAuthSession } from "~/context/AuthContext";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { logDiagnosticError } from "~/lib/diagnostics";
import { openExternalUrl } from "~/lib/open-external-url";
import {
	createNativeRevenueCatClient,
	type DayovaStorePlan,
} from "~/lib/revenuecat-client";
import { env } from "~/lib/runtime-config";
import {
	DAYOVA_SUBSCRIPTION_PRICING,
	type DayovaBillingPeriod,
} from "~/lib/subscription-pricing";
import type { SubscriptionPayer } from "./paywall-screen";

export type { SubscriptionPayer } from "./paywall-screen";

const SUBSCRIPTION_GRADIENT = DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive;
const BRAND_COLORS = DAYOVA_DESIGN_SYSTEM.colors;
const WHITE = BRAND_COLORS.light1;
// LinearGradient exposes its full-bleed geometry through the native style API.
const gradientFillStyle = StyleSheet.absoluteFill;
// This branded access flow stays light in every app theme. These fixed shared
// tokens are passed natively to avoid stale CSS variables on Fabric descendants.
const contentSurfaceStyle = {
	backgroundColor: BRAND_COLORS.surface,
	borderColor: BRAND_COLORS.primaryAccent,
};
const utilitySurfaceStyle = {
	backgroundColor: BRAND_COLORS.systemSubtle,
	borderColor: BRAND_COLORS.primaryAccent,
};
const primaryActionStyle = {
	backgroundColor: BRAND_COLORS.primaryStrong,
	borderColor: BRAND_COLORS.primaryAccent,
};
const primaryTextStyle = { color: BRAND_COLORS.text };
const secondaryTextStyle = { color: BRAND_COLORS.secondaryText };

const getStoreApiKey = () =>
	Platform.select({
		ios: env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
		android: env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
	});

export function SubscriptionScreen({ payer }: { payer: SubscriptionPayer }) {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { access, refreshPaidAccess } = useAccess();
	const { user } = useAuthSession();
	const storeApiKey = getStoreApiKey();
	const appUserId = user?.clerkId;
	const storeConnection = useMemo(() => {
		if (!appUserId || !storeApiKey) {
			return { client: null, initializationError: null };
		}
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
	const storeUnavailableMessage = storeConnection.initializationError
		? "Store-Käufe konnten auf diesem Gerät nicht gestartet werden. Bitte öffne die App erneut oder kontaktiere den Support."
		: "Store-Käufe sind auf diesem Gerät noch nicht verfügbar.";
	const [selectedBillingPeriod, setSelectedBillingPeriod] =
		useState<DayovaBillingPeriod>("monthly");
	const [plans, setPlans] = useState<DayovaStorePlan[]>([]);
	const [isLoadingPlans, setIsLoadingPlans] = useState(
		payer === "self" && Boolean(storeClient),
	);
	const [isPurchasing, setIsPurchasing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const storeActionInFlightRef = useRef(false);

	useEffect(() => {
		if (payer !== "self") return;
		if (!storeClient) {
			if (storeConnection.initializationError) {
				logDiagnosticError(
					"Unable to initialize RevenueCat.",
					storeConnection.initializationError,
					{ source: "paywall.store.initialize", level: "error" },
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
				if (isActive) {
					setError("Die Tarife konnten nicht aus dem Store geladen werden.");
				}
			})
			.finally(() => {
				if (isActive) setIsLoadingPlans(false);
			});

		return () => {
			isActive = false;
		};
	}, [payer, storeClient, storeConnection.initializationError]);

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
			if (active) {
				router.replace("/home");
			} else {
				setError(
					"Der Kauf wird noch bestätigt. Bitte tippe gleich auf „Käufe wiederherstellen“.",
				);
			}
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
		if (!storeClient) return;
		await finishStoreAction(() => storeClient.purchase(selectedBillingPeriod));
	};

	const restore = async () => {
		if (!storeClient) {
			setError("Store-Käufe sind auf diesem Gerät nicht verfügbar.");
			return;
		}
		await finishStoreAction(() => storeClient.restore());
	};

	const openLink = async (url?: string) => {
		const opened = await openExternalUrl(url);
		if (!opened) {
			setError(
				"Der Link konnte nicht geöffnet werden. Bitte versuche es erneut.",
			);
		}
	};

	const annualPlan = planByBillingPeriod.get("annual");
	const monthlyPlan = planByBillingPeriod.get("monthly");
	const unavailablePlanDescription = isLoadingPlans
		? "Preis wird geladen …"
		: "Derzeit nicht im Store verfügbar";
	const isParentPayment = payer === "parent";
	const returnToPayerChoice = () => {
		if (router.canGoBack()) {
			router.back();
			return;
		}
		router.replace("/paywall");
	};

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
				contentContainerStyle={{
					paddingBottom: Math.max(insets.bottom, 24),
					paddingTop: insets.top,
				}}
			>
				<View className="px-7 pt-4">
					<Pressable
						accessibilityHint="Kehrt zur Auswahl zurück, wer bezahlt."
						accessibilityLabel="Zurück"
						accessibilityRole="button"
						className="h-12 w-12 items-center justify-center rounded-full bg-white active:opacity-80"
						hitSlop={8}
						onPress={returnToPayerChoice}
					>
						<ArrowLeft
							size={21}
							color={BRAND_COLORS.primaryStrong}
							strokeWidth={2.4}
						/>
					</Pressable>

					<View className="gap-2 pt-6 pb-7">
						<Text className="font-semibold text-body-4 text-white/85">
							SCHRITT 2 VON 2
						</Text>
						<Text
							variant="h1"
							className="max-w-[330px] text-left font-semibold text-heading-1 text-white leading-tight"
						>
							{isParentPayment
								? "Mit deinen Eltern freischalten"
								: "Dein Dayova-Abo auswählen"}
						</Text>
						<Text className="max-w-[340px] text-body-3 text-white/90">
							{isParentPayment
								? "Teile den sicheren Zahlungsweg. Dein Lernstand bleibt dabei erhalten."
								: "Wähle den Tarif, der zu dir passt. Bezahlt wird sicher über deinen Store."}
						</Text>
					</View>

					<View className="flex-row items-center pb-5">
						<View className="h-12 w-12 items-center justify-center rounded-full bg-white">
							{isParentPayment ? (
								<UserRound
									size={24}
									color={BRAND_COLORS.primaryStrong}
									strokeWidth={2.3}
								/>
							) : (
								<CreditCard
									size={24}
									color={BRAND_COLORS.primaryStrong}
									strokeWidth={2.3}
								/>
							)}
						</View>
						<View className="ml-4 flex-1">
							<Text className="font-semibold text-body-2 text-white">
								{isParentPayment ? "Meine Eltern zahlen" : "Ich zahle selbst"}
							</Text>
							<Text className="mt-1 text-body-4 text-white/80">
								{isParentPayment
									? "Zahlungslink oder QR-Code"
									: "App Store oder Google Play"}
							</Text>
						</View>
						<SquareLock size={22} color={WHITE} strokeWidth={2.2} />
					</View>

					<View
						className="rounded-card border px-5 py-6 shadow-black/10 shadow-sm"
						style={contentSurfaceStyle}
						testID="subscription-payment-surface"
					>
						{isParentPayment ? (
							<ParentPayment onOpen={openLink} />
						) : (
							<>
								<Text
									className="mb-3 font-semibold text-body-2"
									style={primaryTextStyle}
								>
									Tarif wählen
								</Text>
								<View className="gap-3">
									<PlanCard
										description={
											annualPlan
												? DAYOVA_SUBSCRIPTION_PRICING.annual.billingDescription
												: unavailablePlanDescription
										}
										label="Jährlich"
										price={
											annualPlan
												? DAYOVA_SUBSCRIPTION_PRICING.annual.displayPrice
												: "—"
										}
										selected={selectedBillingPeriod === "annual"}
										onPress={() => setSelectedBillingPeriod("annual")}
									/>
									<PlanCard
										description={
											monthlyPlan
												? DAYOVA_SUBSCRIPTION_PRICING.monthly.billingDescription
												: unavailablePlanDescription
										}
										label="Monatlich"
										price={
											monthlyPlan
												? DAYOVA_SUBSCRIPTION_PRICING.monthly.displayPrice
												: "—"
										}
										selected={selectedBillingPeriod === "monthly"}
										onPress={() => setSelectedBillingPeriod("monthly")}
									/>
								</View>
								{!storeClient ? (
									<Text
										accessibilityLiveRegion="polite"
										className="mt-3 text-center text-body-4"
										style={secondaryTextStyle}
									>
										{storeUnavailableMessage}
									</Text>
								) : null}
								<Button
									accessibilityHint="Öffnet den Kauf im App Store oder bei Google Play."
									className="mt-5"
									disabled={
										isLoadingPlans ||
										isPurchasing ||
										!storeClient ||
										!planByBillingPeriod.has(selectedBillingPeriod)
									}
									variant="neutral"
									style={primaryActionStyle}
									onPress={() => void purchase()}
								>
									{isLoadingPlans || isPurchasing ? (
										<ActivityIndicator color={WHITE} />
									) : (
										<Text style={{ color: WHITE }}>Im Store abonnieren</Text>
									)}
								</Button>
								<Text
									className="mt-3 text-center text-body-4"
									style={secondaryTextStyle}
								>
									Die Zahlung läuft über den App Store oder Google Play. Das Abo
									verlängert sich dort bis zur Kündigung.
								</Text>
							</>
						)}
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

					{!isParentPayment || access?.managementUrl ? (
						<View
							className="mt-5 rounded-card border px-5 py-2 shadow-black/10 shadow-sm"
							style={utilitySurfaceStyle}
						>
							{!isParentPayment ? (
								<SubscriptionAction
									label="Käufe wiederherstellen"
									onPress={() => void restore()}
								/>
							) : null}
							{access?.managementUrl ? (
								<SubscriptionAction
									label="Abo verwalten"
									onPress={() => void openLink(access.managementUrl)}
								/>
							) : null}
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
	);
}

function ParentPayment({
	onOpen,
}: {
	onOpen: (url?: string) => Promise<void>;
}) {
	if (!env.EXPO_PUBLIC_PARENT_CHECKOUT_URL) {
		return (
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
					Diese Option wird freigeschaltet, sobald die sichere Website-Zahlung
					und Kontozuordnung bereit sind.
				</Text>
			</>
		);
	}

	return (
		<View className="items-center">
			<View className="rounded-2xl bg-white p-4">
				<QRCode
					value={env.EXPO_PUBLIC_PARENT_CHECKOUT_URL}
					size={184}
					color={BRAND_COLORS.text}
					backgroundColor={BRAND_COLORS.surface}
				/>
			</View>
			<Text
				className="mt-5 text-center font-semibold text-body-2"
				style={primaryTextStyle}
			>
				QR-Code an deine Eltern weitergeben
			</Text>
			<Text className="mt-2 text-center text-body-3" style={secondaryTextStyle}>
				Der Link öffnet die sichere Dayova-Zahlungsseite.
			</Text>
			<Button
				accessibilityHint="Öffnet den Zahlungslink, den du mit deinen Eltern teilen kannst."
				className="mt-5 w-full"
				variant="neutral"
				style={primaryActionStyle}
				onPress={() => void onOpen(env.EXPO_PUBLIC_PARENT_CHECKOUT_URL)}
			>
				<Text style={{ color: WHITE }}>Zahlungsseite öffnen</Text>
			</Button>
		</View>
	);
}

function PlanCard({
	description,
	label,
	onPress,
	price,
	selected,
}: {
	description: string;
	label: string;
	onPress: () => void;
	price: string;
	selected: boolean;
}) {
	return (
		<Pressable
			accessibilityLabel={`${label}, ${price}. ${description}`}
			accessibilityRole="radio"
			accessibilityState={{ checked: selected }}
			className="rounded-3xl border px-5 py-4"
			onPress={onPress}
			style={{
				backgroundColor: selected
					? BRAND_COLORS.systemSubtle
					: BRAND_COLORS.surface,
				borderColor: selected
					? BRAND_COLORS.primaryStrong
					: BRAND_COLORS.border,
			}}
		>
			<View className="flex-row items-start">
				<View className="flex-1">
					<Text className="font-semibold text-body-2" style={primaryTextStyle}>
						{label}
					</Text>
					<Text className="mt-1 text-body-4" style={secondaryTextStyle}>
						{description}
					</Text>
				</View>
				<Text
					className="ml-3 font-semibold text-body-2"
					style={primaryTextStyle}
				>
					{price}
				</Text>
			</View>
		</Pressable>
	);
}

function SubscriptionAction({
	label,
	onPress,
}: {
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
			<Text className="flex-1 text-body-3" style={secondaryTextStyle}>
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
