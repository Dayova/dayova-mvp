import type { StandardSchemaV1 } from "@t3-oss/env-core";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const publicEnvSchema = {
	EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
	EXPO_PUBLIC_CONVEX_URL: z.string().url(),
	EXPO_PUBLIC_POSTHOG_API_KEY: z.string().optional(),
	EXPO_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
	EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: z.string().min(1).optional(),
	EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: z.string().min(1).optional(),
	EXPO_PUBLIC_PRIVACY_URL: z.string().url().optional(),
	EXPO_PUBLIC_TERMS_URL: z.string().url().optional(),
	EXPO_PUBLIC_SUBSCRIPTION_TERMS_URL: z.string().url().optional(),
	EXPO_PUBLIC_CANCELLATION_URL: z.string().url().optional(),
	EXPO_PUBLIC_SUPPORT_URL: z.string().url().optional(),
	EXPO_PUBLIC_PARENT_CHECKOUT_URL: z.string().url().optional(),
} as const;

type PublicRuntimeConfigKey = keyof typeof publicEnvSchema;

export type PublicRuntimeConfigValues = Partial<
	Record<PublicRuntimeConfigKey, string | undefined>
>;

type StrictPublicRuntimeConfigValues = Record<
	PublicRuntimeConfigKey,
	string | undefined
>;

const publicEnvKeys = Object.keys(publicEnvSchema) as PublicRuntimeConfigKey[];
const requiredPublicEnvKeys = [
	"EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
	"EXPO_PUBLIC_CONVEX_URL",
] satisfies PublicRuntimeConfigKey[];
const requiredReleasePublicEnvKeys = [
	...requiredPublicEnvKeys,
	"EXPO_PUBLIC_REVENUECAT_IOS_API_KEY",
	"EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY",
	"EXPO_PUBLIC_PRIVACY_URL",
	"EXPO_PUBLIC_TERMS_URL",
	"EXPO_PUBLIC_SUBSCRIPTION_TERMS_URL",
	"EXPO_PUBLIC_CANCELLATION_URL",
	"EXPO_PUBLIC_SUPPORT_URL",
] satisfies PublicRuntimeConfigKey[];

// Expo only inlines direct process.env.EXPO_PUBLIC_* member accesses.
export const readPublicRuntimeConfig = (): StrictPublicRuntimeConfigValues => ({
	EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY:
		process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
	EXPO_PUBLIC_CONVEX_URL: process.env.EXPO_PUBLIC_CONVEX_URL,
	EXPO_PUBLIC_POSTHOG_API_KEY: process.env.EXPO_PUBLIC_POSTHOG_API_KEY,
	EXPO_PUBLIC_POSTHOG_HOST: process.env.EXPO_PUBLIC_POSTHOG_HOST,
	EXPO_PUBLIC_REVENUECAT_IOS_API_KEY:
		process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
	EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY:
		process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
	EXPO_PUBLIC_PRIVACY_URL: process.env.EXPO_PUBLIC_PRIVACY_URL,
	EXPO_PUBLIC_TERMS_URL: process.env.EXPO_PUBLIC_TERMS_URL,
	EXPO_PUBLIC_SUBSCRIPTION_TERMS_URL:
		process.env.EXPO_PUBLIC_SUBSCRIPTION_TERMS_URL,
	EXPO_PUBLIC_CANCELLATION_URL: process.env.EXPO_PUBLIC_CANCELLATION_URL,
	EXPO_PUBLIC_SUPPORT_URL: process.env.EXPO_PUBLIC_SUPPORT_URL,
	EXPO_PUBLIC_PARENT_CHECKOUT_URL: process.env.EXPO_PUBLIC_PARENT_CHECKOUT_URL,
});

const toStrictPublicRuntimeConfig = (
	config: PublicRuntimeConfigValues,
): StrictPublicRuntimeConfigValues =>
	Object.fromEntries(
		publicEnvKeys.map((key) => [key, config[key]]),
	) as StrictPublicRuntimeConfigValues;

const rawPublicRuntimeConfig = readPublicRuntimeConfig();

export const getMissingPublicRuntimeConfig = (
	config: PublicRuntimeConfigValues,
) => requiredPublicEnvKeys.filter((key) => !config[key]?.trim());

export const getMissingReleasePublicRuntimeConfig = (
	config: PublicRuntimeConfigValues,
) => requiredReleasePublicEnvKeys.filter((key) => !config[key]?.trim());

export const missingPublicRuntimeConfig = getMissingPublicRuntimeConfig(
	rawPublicRuntimeConfig,
);

const formatIssuePath = (issue: StandardSchemaV1.Issue) =>
	issue.path
		?.map((segment) =>
			typeof segment === "object" && "key" in segment
				? String(segment.key)
				: String(segment),
		)
		.join(".");

type CreatePublicEnvOptions = {
	context: "app-runtime" | "release";
};

const createPublicEnvValidationError = (
	runtimeEnv: PublicRuntimeConfigValues,
	issues: readonly StandardSchemaV1.Issue[],
	context: CreatePublicEnvOptions["context"],
) => {
	const missing =
		context === "release"
			? getMissingReleasePublicRuntimeConfig(runtimeEnv)
			: getMissingPublicRuntimeConfig(runtimeEnv);
	const invalidIssues = issues.filter((issue) => {
		const path = formatIssuePath(issue);
		return !missing.some((key) => key === path);
	});
	const details = invalidIssues
		.map((issue) => {
			const path = formatIssuePath(issue);
			return path ? `${path}: ${issue.message}` : issue.message;
		})
		.join("; ");
	const invalid = details ? ` Invalid values: ${details}.` : "";

	if (context === "release") {
		const missingMessage =
			missing.length > 0 ? ` Missing values: ${missing.join(", ")}.` : "";

		return new Error(
			`Missing or invalid required public app env for release.${missingMessage}${invalid} Set these in EAS/CI before building or publishing updates.`,
		);
	}

	return new Error(`Invalid public runtime config:${invalid}`);
};

export const createPublicEnv = (
	runtimeEnv: PublicRuntimeConfigValues,
	options: CreatePublicEnvOptions,
) =>
	createEnv({
		clientPrefix: "EXPO_PUBLIC_",
		client: publicEnvSchema,
		runtimeEnvStrict: toStrictPublicRuntimeConfig(runtimeEnv),
		emptyStringAsUndefined: true,
		skipValidation:
			options.context === "app-runtime" &&
			getMissingPublicRuntimeConfig(runtimeEnv).length > 0,
		onValidationError: (issues) => {
			throw createPublicEnvValidationError(runtimeEnv, issues, options.context);
		},
	});

export const validatePublicEnvForRelease = (
	runtimeEnv: PublicRuntimeConfigValues = readPublicRuntimeConfig(),
) => {
	const missing = getMissingReleasePublicRuntimeConfig(runtimeEnv);
	if (missing.length > 0) {
		throw new Error(
			`Missing or invalid required public app env for release. Missing values: ${missing.join(", ")}. Set these in EAS/CI before building or publishing updates.`,
		);
	}
	createPublicEnv(runtimeEnv, { context: "release" });
};

export const env = createPublicEnv(rawPublicRuntimeConfig, {
	context: "app-runtime",
});
