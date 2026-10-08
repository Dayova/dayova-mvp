import { inject } from "vitest";

export type ExpoConfigVariant = "development" | "production";
export type ExpoConfigType = "introspect" | "public";
export type ExpoConfigKey =
	| "development:introspect"
	| "production:introspect"
	| "production:public";

export type ExpoConfigSnapshot = {
	version?: string;
	sdkVersion?: string;
	ios?: {
		bundleIdentifier?: string;
		runtimeVersion?: unknown;
		usesAppleSignIn?: boolean;
		entitlements?: Record<string, unknown>;
		infoPlist?: Record<string, unknown>;
	};
	android?: {
		package?: string;
		runtimeVersion?: unknown;
	};
};

export type ExpoConfigSnapshots = Record<ExpoConfigKey, ExpoConfigSnapshot>;

declare module "vitest" {
	export interface ProvidedContext {
		expoConfigSnapshots: ExpoConfigSnapshots;
		metroWatchmanOptIn: boolean;
	}
}

export const expoConfigKey = (
	variant: ExpoConfigVariant,
	type: ExpoConfigType,
): ExpoConfigKey => {
	const key = `${variant}:${type}`;
	if (
		key !== "development:introspect" &&
		key !== "production:introspect" &&
		key !== "production:public"
	) {
		throw new Error(`Unsupported Expo config contract snapshot: ${key}`);
	}
	return key;
};

export const readExpoConfigSnapshot = (
	variant: ExpoConfigVariant,
	type: ExpoConfigType,
) => inject("expoConfigSnapshots")[expoConfigKey(variant, type)];

export const readMetroWatchmanOptIn = () => inject("metroWatchmanOptIn");
