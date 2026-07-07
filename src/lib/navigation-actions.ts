import type { Href } from "expo-router";

type Router = Pick<
	typeof import("expo-router").router,
	"back" | "canGoBack" | "dismissTo" | "replace"
>;

export const goBackOrReplace = (router: Router, fallback: Href) => {
	if (router.canGoBack()) {
		router.back();
		return;
	}

	router.replace(fallback);
};

export const goBackToReturnOrReplace = (
	router: Router,
	fallback: Href,
	returnTo?: string,
) => {
	if (returnTo) {
		router.replace(returnTo as Href);
		return;
	}

	goBackOrReplace(router, fallback);
};

export const dismissToOrReplace = (router: Router, target: string) => {
	router.dismissTo(target as Href);
};
