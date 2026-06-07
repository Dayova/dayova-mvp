import type { StandardSchemaV1 } from "@t3-oss/env-core";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const publicEnvSchema = {
	EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
	EXPO_PUBLIC_CONVEX_URL: z.string().url(),
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

// Expo only inlines direct process.env.EXPO_PUBLIC_* member accesses.
export const readPublicRuntimeConfig = (): StrictPublicRuntimeConfigValues => ({
	EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY:
		process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
	EXPO_PUBLIC_CONVEX_URL: process.env.EXPO_PUBLIC_CONVEX_URL,
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
) => publicEnvKeys.filter((key) => !config[key]?.trim());

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
	const missing = getMissingPublicRuntimeConfig(runtimeEnv);
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
	createPublicEnv(runtimeEnv, { context: "release" });
};

export const env = createPublicEnv(rawPublicRuntimeConfig, {
	context: "app-runtime",
});
