const ENTITLEMENT_ID = "dayova_full_access";
const OFFERING_ID = "default";

type RevenueCatPackage = {
	identifier: string;
	packageType?: string;
	product: {
		identifier: string;
		priceString: string;
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
	billingPeriod: "annual" | "monthly";
	packageIdentifier: string;
	price: string;
	productIdentifier: "dayova_annual" | "dayova_monthly";
};

type PurchaseResult =
	| { status: "purchased" }
	| { status: "cancelled" }
	| { status: "notEntitled" };

const isDayovaProduct = (
	productIdentifier: string,
): productIdentifier is DayovaStorePlan["productIdentifier"] =>
	productIdentifier === "dayova_annual" ||
	productIdentifier === "dayova_monthly";

const toStorePlan = (
	revenueCatPackage: RevenueCatPackage,
): DayovaStorePlan | null => {
	const productIdentifier = revenueCatPackage.product.identifier;
	if (!isDayovaProduct(productIdentifier)) return null;

	return {
		billingPeriod: productIdentifier === "dayova_annual" ? "annual" : "monthly",
		packageIdentifier: revenueCatPackage.identifier,
		price: revenueCatPackage.product.priceString,
		productIdentifier,
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
			productIdentifier: DayovaStorePlan["productIdentifier"],
		): Promise<PurchaseResult> => {
			await ready;
			const packages = availablePackages ?? (await loadPackages());
			const packageToPurchase = packages.find(
				(candidate) => candidate.product.identifier === productIdentifier,
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
	const sdk = purchasesModule.default as unknown as RevenueCatSdkBoundary;
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
		ready = sdk.logIn(appUserId).then((result) => {
			configuredNativeAppUserId = appUserId;
			return result;
		});
	}

	return createRevenueCatClient({
		apiKey,
		appUserId,
		configure: false,
		ready,
		sdk,
	});
};
