import { Redirect, useLocalSearchParams } from "expo-router";
import type { SubscriptionPayer } from "~/features/access/paywall-screen";
import { SubscriptionScreen } from "~/features/access/subscription-screen";

export default function SubscriptionRoute() {
	const params = useLocalSearchParams<{ payer?: string | string[] }>();
	const rawPayer = Array.isArray(params.payer) ? params.payer[0] : params.payer;
	const payer: SubscriptionPayer | null =
		rawPayer === "parent" || rawPayer === "self" ? rawPayer : null;

	if (!payer) {
		return <Redirect href="/paywall" />;
	}

	return <SubscriptionScreen payer={payer} />;
}
