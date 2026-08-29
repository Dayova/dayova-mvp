import { Redirect, useLocalSearchParams } from "expo-router";
import type { SubscriptionPayer } from "~/features/access/paywall-screen";
import { SubscriptionScreen } from "~/features/access/subscription-screen";
import { areNativeStorePurchasesEnabled } from "~/lib/native-store-purchases";
import { env } from "~/lib/runtime-config";

export default function SubscriptionRoute() {
	const params = useLocalSearchParams<{ payer?: string | string[] }>();
	const rawPayer = Array.isArray(params.payer) ? params.payer[0] : params.payer;
	const payer: SubscriptionPayer | null =
		rawPayer === "parent" || rawPayer === "self" ? rawPayer : null;

	if (!payer) {
		return <Redirect href="/paywall" />;
	}
	if (
		payer === "self" &&
		!areNativeStorePurchasesEnabled(
			env.EXPO_PUBLIC_NATIVE_STORE_PURCHASES_ENABLED,
		)
	) {
		return <Redirect href="/paywall" />;
	}
	if (payer === "parent" && !env.EXPO_PUBLIC_PARENT_CHECKOUT_URL) {
		return <Redirect href="/paywall" />;
	}

	return <SubscriptionScreen payer={payer} />;
}
