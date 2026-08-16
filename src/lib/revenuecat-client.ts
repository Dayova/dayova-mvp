import type { DayovaBillingPeriod } from "./subscription-pricing";

const ENTITLEMENT_ID = "dayova_full_access";
const OFFERING_ID = "default";
const PACKAGE_BILLING_PERIOD = {
	$rc_annual: "annual",
	$rc_monthly: "monthly",
} as const;

type RevenueCatPackage = {
	identifier: string;
	packageType?: string;
	product: {
		identifier: string;
		priceString: string;
		pricePerMonthString?: string | null;
	};
};

type RevenueCatCustomerInfo = {
	entitlements: {
		active: Record<string, unknown>;
	};
};

type RevenueCatOffering = {
	availablePackages: RevenueCatPackage[];
};

export type RevenueCatSdkBoundary = {
	configure: (options: { apiKey: string; appUserID: string }) => void;
	logIn?: (appUserId: string) => Promise<unknown>;
	getOfferings: () => Promise<{
		all: Record<string, RevenueCatOffering>;
		current: RevenueCatOffering | null;
	}>;
	purchasePackage: (
		packageToPurchase: RevenueCatPackage,
	) => Promise<{ customerInfo: RevenueCatCustomerInfo }>;
	restorePurchases: () => Promise<RevenueCatCustomerInfo>;
};

export type DayovaStorePlan = {
	billingPeriod: DayovaBillingPeriod;
	packageIdentifier: keyof typeof PACKAGE_BILLING_PERIOD;
	price: string;
	productIdentifier: string;
};

type PurchaseResult =
	| { status: "purchased" }
	| { status: "cancelled" }
	| { status: "notEntitled" };

const isDayovaPackage = (
	packageIdentifier: string,
): packageIdentifier is DayovaStorePlan["packageIdentifier"] =>
	packageIdentifier === "$rc_annual" || packageIdentifier === "$rc_monthly";

const toStorePlan = (
	revenueCatPackage: RevenueCatPackage,
): DayovaStorePlan | null => {
	const packageIdentifier = revenueCatPackage.identifier;
	if (!isDayovaPackage(packageIdentifier)) return null;

	return {
		billingPeriod: PACKAGE_BILLING_PERIOD[packageIdentifier],
		packageIdentifier,
		price: revenueCatPackage.product.priceString,
		productIdentifier: revenueCatPackage.product.identifier,
	};
};

const hasFullAccess = (customerInfo: RevenueCatCustomerInfo) =>
	Boolean(customerInfo.entitlements.active[ENTITLEMENT_ID]);

const isUserCancelledError = (error: unknown) =>
	typeof error === "object" &&
	error !== null &&
	"userCancelled" in error &&
	error.userCancelled === true;

export const createRevenueCatClient = ({
	apiKey,
	appUserId,
	configure = true,
	ready = Promise.resolve(),
	sdk,
}: {
	apiKey: string;
	appUserId: string;
	configure?: boolean;
	ready?: Promise<unknown>;
	sdk: RevenueCatSdkBoundary;
}) => {
	if (configure) sdk.configure({ apiKey, appUserID: appUserId });
	let availablePackages: RevenueCatPackage[] | null = null;

	const loadPackages = async () => {
		await ready;
		const offerings = await sdk.getOfferings();
		const offering = offerings.all[OFFERING_ID] ?? offerings.current;
		availablePackages = offering?.availablePackages ?? [];
		return availablePackages;
	};

	return {
		getPlans: async () => {
			const packages = await loadPackages();
			return packages
				.map(toStorePlan)
				.filter((plan): plan is DayovaStorePlan => plan !== null)
				.sort((left, right) =>
					left.billingPeriod === right.billingPeriod
						? 0
						: left.billingPeriod === "annual"
							? -1
							: 1,
				);
		},
		purchase: async (
			billingPeriod: DayovaBillingPeriod,
		): Promise<PurchaseResult> => {
			await ready;
			const packages = availablePackages ?? (await loadPackages());
			const packageToPurchase = packages.find(
				(candidate) =>
					isDayovaPackage(candidate.identifier) &&
					PACKAGE_BILLING_PERIOD[candidate.identifier] === billingPeriod,
			);
			if (!packageToPurchase) {
				throw new Error("Der gewählte Tarif ist im Store nicht verfügbar.");
			}

			try {
				const result = await sdk.purchasePackage(packageToPurchase);
				return hasFullAccess(result.customerInfo)
					? { status: "purchased" }
					: { status: "notEntitled" };
			} catch (error) {
				if (isUserCancelledError(error)) return { status: "cancelled" };
				throw error;
			}
		},
		restore: async (): Promise<PurchaseResult> => {
			await ready;
			const customerInfo = await sdk.restorePurchases();
			return hasFullAccess(customerInfo)
				? { status: "purchased" }
				: { status: "notEntitled" };
		},
	};
};

let configuredNativeApiKey: string | null = null;
let configuredNativeAppUserId: string | null = null;

export const createNativeRevenueCatClient = ({
	apiKey,
	appUserId,
}: {
	apiKey: string;
	appUserId: string;
}) => {
	const purchasesModule =
		require("react-native-purchases") as typeof import("react-native-purchases");
	const sdk = (purchasesModule.default ??
		purchasesModule) as unknown as RevenueCatSdkBoundary;
	let ready: Promise<unknown> = Promise.resolve();
	if (!configuredNativeApiKey) {
		sdk.configure({ apiKey, appUserID: appUserId });
		configuredNativeApiKey = apiKey;
		configuredNativeAppUserId = appUserId;
	} else if (configuredNativeApiKey !== apiKey) {
		throw new Error(
			"RevenueCat wurde mit einem anderen Store-Schlüssel geladen.",
		);
	} else if (configuredNativeAppUserId !== appUserId) {
		if (!sdk.logIn) {
			throw new Error("Das RevenueCat-Konto konnte nicht gewechselt werden.");
		}
		const loginPromise = sdk.logIn(appUserId).then((result) => {
			configuredNativeAppUserId = appUserId;
			return result;
		});
		// Attach a handler immediately so a rejected native login cannot become an
		// unhandled promise before a store operation awaits the same promise.
		void loginPromise.catch(() => undefined);
		ready = loginPromise;
	}

	return createRevenueCatClient({
		apiKey,
		appUserId,
		configure: false,
		ready,
		sdk,
	});
};
