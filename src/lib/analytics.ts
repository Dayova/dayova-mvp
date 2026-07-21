import type { PostHogOptions } from "posthog-react-native";
import { z } from "zod";
import { logDiagnosticError } from "./diagnostics";
import { EXAM_TYPE_OPTIONS } from "./entry-options";
import { isSupportedFederalState } from "./federal-states";
import { isSupportedGrade } from "./grades";
import { env } from "./runtime-config";
import { ACCEPTED_FILE_TYPES } from "./upload-policy";

type AnalyticsProperty = string | number | boolean;

type AnalyticsAdapter = {
	identify(
		distinctId: string,
		properties?: Record<string, AnalyticsProperty>,
	): void;
	capture(
		eventName: string,
		properties?: Record<string, AnalyticsProperty>,
	): void;
	reset(): void;
};

type AnalyticsMode = "development" | "production";

type AnalyticsDiagnostic = {
	eventName: string;
	propertyName?: string;
};

type AnalyticsIdentityInput = {
	distinctId: string;
	convexUserId?: string;
	validationStudentCode?: string;
	grade?: string;
	state?: string;
};

type SharedAnalyticsContextInput = {
	validationStudentCode?: string | null;
	easUpdateId?: string | null;
	easChannel?: string | null;
	easRuntimeVersion?: string | null;
	easIsEmbeddedLaunch?: boolean | null;
};

const IDENTITY_INPUT_KEYS = new Set([
	"distinctId",
	"convexUserId",
	"validationStudentCode",
	"grade",
	"state",
]);

export const isPostHogConfigured = Boolean(
	env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim(),
);

export const postHogApiKey = env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim() ?? "";

export const postHogHost =
	env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || "https://eu.i.posthog.com";

const ANALYTICS_SCHEMA_VERSION = 1;

const VALIDATION_FILE_TYPES = [
	...ACCEPTED_FILE_TYPES,
	"application/octet-stream",
] as const;

const VALIDATION_FILE_SIZE_BUCKETS = [
	"lt_1_mb",
	"1_to_10_mb",
	"10_to_50_mb",
	"gte_50_mb",
] as const;

const VALIDATION_SESSION_PHASES = ["theory", "practice", "rehearsal"] as const;

const VALIDATION_MISSED_REASONS = [
	"no_time",
	"forgot",
	"no_motivation",
	"too_hard",
	"too_big",
	"unclear",
	"other",
] as const;

const VALIDATION_ADJUSTMENT_TYPES = [
	"rescheduled",
	"shortened",
	"rescheduled_and_shortened",
] as const;

export function getValidationFileSizeBucket(
	fileSizeBytes: number,
): (typeof VALIDATION_FILE_SIZE_BUCKETS)[number] {
	const oneMegabyte = 1024 * 1024;
	if (fileSizeBytes < oneMegabyte) return "lt_1_mb";
	if (fileSizeBytes < 10 * oneMegabyte) return "1_to_10_mb";
	if (fileSizeBytes < 50 * oneMegabyte) return "10_to_50_mb";
	return "gte_50_mb";
}

const optionalTrimmedString = (value: unknown) => {
	const normalized = typeof value === "string" ? value.trim() : undefined;
	return normalized ? normalized : undefined;
};

const isDayKey = (value: unknown): value is string => {
	if (typeof value !== "string") return false;
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return false;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const parsed = new Date(Date.UTC(year, month - 1, day));
	return (
		parsed.getUTCFullYear() === year &&
		parsed.getUTCMonth() === month - 1 &&
		parsed.getUTCDate() === day
	);
};

const nonEmptyStringSchema = z
	.string()
	.min(1)
	.refine((value) => value.trim() === value);
const dayKeySchema = z.string().refine(isDayKey);
const positiveIntegerSchema = z.number().int().positive();
const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);

const slotPropertySchemas = {
	learning_plan_id: nonEmptyStringSchema,
	learning_plan_session_id: nonEmptyStringSchema,
	phase: z.enum(VALIDATION_SESSION_PHASES),
	planned_day_key: dayKeySchema,
	planned_start_time: timeSchema,
	duration_minutes: positiveIntegerSchema,
	deadline_day_key: dayKeySchema.optional(),
} as const;

const sharedContextSchemas = {
	validationStudentCode: {
		outputName: "validation_student_code",
		schema: nonEmptyStringSchema,
	},
	easUpdateId: { outputName: "eas_update_id", schema: nonEmptyStringSchema },
	easChannel: { outputName: "eas_channel", schema: nonEmptyStringSchema },
	easRuntimeVersion: {
		outputName: "eas_runtime_version",
		schema: nonEmptyStringSchema,
	},
	easIsEmbeddedLaunch: {
		outputName: "eas_is_embedded_launch",
		schema: z.boolean(),
	},
} as const satisfies Record<
	keyof SharedAnalyticsContextInput,
	{ outputName: string; schema: z.ZodType<AnalyticsProperty> }
>;

const sharedOutputSchema = z.strictObject({
	analytics_schema_version: z.literal(ANALYTICS_SCHEMA_VERSION),
	validation_student_code: nonEmptyStringSchema.optional(),
	eas_update_id: nonEmptyStringSchema.optional(),
	eas_channel: nonEmptyStringSchema.optional(),
	eas_runtime_version: nonEmptyStringSchema.optional(),
	eas_is_embedded_launch: z.boolean().optional(),
});

const identityOutputSchema = z.strictObject({
	convex_user_id: nonEmptyStringSchema.optional(),
	validation_student_code: nonEmptyStringSchema.optional(),
	grade: z.string().refine(isSupportedGrade).optional(),
	state: z.string().refine(isSupportedFederalState).optional(),
});

const eventPropertySchemas = {
	onboarding_completed: z.strictObject({
		local_day_key: dayKeySchema,
		onboarding_version: z.literal(1),
	}),
	homework_created: z.strictObject({
		day_entry_id: nonEmptyStringSchema,
		planned_day_key: dayKeySchema,
		due_day_key: dayKeySchema,
		duration_minutes: positiveIntegerSchema,
	}),
	exam_created: z.strictObject({
		day_entry_id: nonEmptyStringSchema,
		planned_day_key: dayKeySchema,
		duration_minutes: positiveIntegerSchema,
		exam_type: z.enum(EXAM_TYPE_OPTIONS),
	}),
	material_uploaded: z.strictObject({
		learning_plan_id: nonEmptyStringSchema,
		file_type: z.enum(VALIDATION_FILE_TYPES),
		file_size_bucket: z.enum(VALIDATION_FILE_SIZE_BUCKETS),
	}),
	study_plan_generated: z.strictObject({
		learning_plan_id: nonEmptyStringSchema,
		session_count: positiveIntegerSchema,
	}),
	study_slot_started: z.strictObject({
		...slotPropertySchemas,
		started_at: positiveIntegerSchema,
	}),
	study_slot_completed: z.strictObject({
		...slotPropertySchemas,
		outcome_at: positiveIntegerSchema,
	}),
	study_slot_partially_completed: z.strictObject({
		...slotPropertySchemas,
		outcome_at: positiveIntegerSchema,
	}),
	study_slot_missed: z.strictObject({
		...slotPropertySchemas,
		outcome_at: positiveIntegerSchema,
		missed_reason: z.enum(VALIDATION_MISSED_REASONS),
	}),
	plan_adjusted: z.strictObject({
		original_session_id: nonEmptyStringSchema,
		new_session_id: nonEmptyStringSchema,
		adjustment_type: z.enum(VALIDATION_ADJUSTMENT_TYPES),
		old_planned_day_key: dayKeySchema,
		new_planned_day_key: dayKeySchema,
		old_duration_minutes: positiveIntegerSchema,
		new_duration_minutes: positiveIntegerSchema,
		missed_reason: z.enum(VALIDATION_MISSED_REASONS).optional(),
	}),
	user_returned_next_day: z.strictObject({
		local_day_key: dayKeySchema,
		previous_activity_day_key: dayKeySchema,
	}),
} as const satisfies Record<string, z.ZodObject>;

type ValidationEventProperties = {
	[EventName in keyof typeof eventPropertySchemas]: z.infer<
		(typeof eventPropertySchemas)[EventName]
	>;
};

type ValidationEventName = keyof ValidationEventProperties;

type CreateValidationAnalyticsOptions = {
	configured?: boolean;
	mode?: AnalyticsMode;
	reportDiagnostic?: (diagnostic: AnalyticsDiagnostic) => void;
	distinctId?: string | null;
	sharedContext?: SharedAnalyticsContextInput;
};

type PostHogBeforeSendFunction = Extract<
	NonNullable<PostHogOptions["before_send"]>,
	(...args: never[]) => unknown
>;
type PostHogBeforeSendEvent = NonNullable<
	Parameters<PostHogBeforeSendFunction>[0]
>;
type PostHogEventProperties = NonNullable<PostHogBeforeSendEvent["properties"]>;

const POSTHOG_SYSTEM_PROPERTY_KEYS = new Set(["token", "distinct_id"]);
const POSTHOG_SYSTEM_PERSON_PROPERTY_KEYS = new Set([
	"$app_version",
	"$app_build",
	"$app_namespace",
	"$os_name",
	"$os_version",
	"$device_type",
	"$lib",
	"$lib_version",
]);
const PROHIBITED_ANALYTICS_KEYS = new Set([
	"name",
	"email",
	"birth_date",
	"avatar_url",
	"school_type",
	"school_name",
	"notes",
	"file_name",
	"answers",
	"answer_text",
]);

const isProhibitedAnalyticsKey = (propertyName: string) =>
	PROHIBITED_ANALYTICS_KEYS.has(
		propertyName.startsWith("$") ? propertyName.slice(1) : propertyName,
	);

const projectProperties = (
	schema: z.ZodObject,
	input: Record<string, unknown>,
	options: {
		rejectUnknown?: boolean;
		onRejected?: (propertyName: string) => void;
	} = {},
): Record<string, AnalyticsProperty> | null => {
	const onRejected = options.onRejected ?? (() => undefined);
	const shape = schema.shape as Record<string, z.ZodType>;
	if (options.rejectUnknown) {
		for (const propertyName of Object.keys(input)) {
			if (!Object.hasOwn(shape, propertyName)) onRejected(propertyName);
		}
	}

	const projected: Record<string, AnalyticsProperty> = {};
	for (const [propertyName, propertySchema] of Object.entries(shape)) {
		const value = input[propertyName];
		const acceptsUndefined = propertySchema.safeParse(undefined).success;
		if (value === undefined) {
			if (acceptsUndefined) continue;
			onRejected(propertyName);
			return null;
		}
		const result = propertySchema.safeParse(value);
		if (!result.success) {
			onRejected(propertyName);
			if (acceptsUndefined) continue;
			return null;
		}
		projected[propertyName] = result.data as AnalyticsProperty;
	}
	return projected;
};

const postHogSystemProperties = (properties: Record<string, unknown>) =>
	Object.fromEntries(
		Object.entries(properties).filter(
			([key]) =>
				!isProhibitedAnalyticsKey(key) &&
				((key.startsWith("$") && key !== "$set" && key !== "$set_once") ||
					POSTHOG_SYSTEM_PROPERTY_KEYS.has(key)),
		),
	) as PostHogEventProperties;

const guardedPersonProperties = (properties: Record<string, unknown>) =>
	({
		...Object.fromEntries(
			Object.entries(properties).filter(([key]) =>
				POSTHOG_SYSTEM_PERSON_PROPERTY_KEYS.has(key),
			),
		),
		...(projectProperties(identityOutputSchema, properties) ?? {}),
	}) as PostHogEventProperties;

const withoutPersonUpdates = (event: PostHogBeforeSendEvent) => {
	const sanitized = { ...event };
	delete sanitized.$set;
	delete sanitized.$set_once;
	return sanitized;
};

const propertyRecord = (value: unknown) =>
	typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;

export const validationAnalyticsBeforeSend: PostHogBeforeSendFunction = (
	event,
) => {
	if (!event) return null;
	const properties = event.properties ?? {};

	if (event.event === "$identify") {
		const personProperties =
			event.$set ?? propertyRecord(properties.$set) ?? {};
		const personPropertiesOnce =
			event.$set_once ?? propertyRecord(properties.$set_once);
		return {
			...withoutPersonUpdates(event),
			properties: postHogSystemProperties(properties),
			$set: guardedPersonProperties(personProperties),
			...(personPropertiesOnce
				? { $set_once: guardedPersonProperties(personPropertiesOnce) }
				: {}),
		};
	}

	const eventSchema = Object.hasOwn(eventPropertySchemas, event.event)
		? (eventPropertySchemas[event.event as ValidationEventName] as z.ZodObject)
		: undefined;
	if (eventSchema) {
		const shared = projectProperties(sharedOutputSchema, properties);
		const specific = projectProperties(eventSchema, properties);
		if (!shared || !specific) return null;
		return {
			...withoutPersonUpdates(event),
			properties: {
				...postHogSystemProperties(properties),
				...shared,
				...specific,
			},
		};
	}

	if (!event.event.startsWith("$")) return null;
	const personProperties = event.$set ?? propertyRecord(properties.$set);
	const personPropertiesOnce =
		event.$set_once ?? propertyRecord(properties.$set_once);
	const safeProperties = Object.fromEntries(
		Object.entries(properties).filter(
			([propertyName]) =>
				propertyName !== "$set" &&
				propertyName !== "$set_once" &&
				!isProhibitedAnalyticsKey(propertyName),
		),
	) as PostHogEventProperties;
	return {
		...withoutPersonUpdates(event),
		properties: safeProperties,
		...(personProperties
			? { $set: guardedPersonProperties(personProperties) }
			: {}),
		...(personPropertiesOnce
			? { $set_once: guardedPersonProperties(personPropertiesOnce) }
			: {}),
	};
};

const defaultAnalyticsMode = () =>
	typeof __DEV__ !== "undefined" && __DEV__ ? "development" : "production";

const defaultAnalyticsDiagnostic = (diagnostic: AnalyticsDiagnostic) => {
	logDiagnosticError(
		"Analytics event or property was rejected.",
		new Error("Invalid analytics contract input."),
		{
			source: "analytics.contract",
			level: "warn",
			metadata: diagnostic,
		},
	);
};

export function createValidationAnalytics(
	adapter: AnalyticsAdapter,
	options: CreateValidationAnalyticsOptions = {},
) {
	const configured = options.configured ?? isPostHogConfigured;
	const mode = options.mode ?? defaultAnalyticsMode();
	const reportDiagnostic =
		options.reportDiagnostic ?? defaultAnalyticsDiagnostic;
	let currentDistinctId = optionalTrimmedString(
		options.distinctId ?? undefined,
	);
	const rejectProperty = (eventName: string, propertyName: string) => {
		if (mode === "development") {
			throw new Error(`Invalid analytics property: ${propertyName}`);
		}
		reportDiagnostic({ eventName, propertyName });
	};

	return {
		identify(input: AnalyticsIdentityInput | null) {
			if (input === null) {
				adapter.reset();
				currentDistinctId = undefined;
				return;
			}
			if (!configured) return;

			const unknownKeys = Object.keys(input).filter(
				(key) => !IDENTITY_INPUT_KEYS.has(key),
			);
			for (const unknownKey of unknownKeys) {
				rejectProperty("$identify", unknownKey);
			}

			const distinctId = optionalTrimmedString(input.distinctId);
			if (!distinctId) {
				rejectProperty("$identify", "distinct_id");
				return;
			}
			currentDistinctId = distinctId;

			const convexUserId = optionalTrimmedString(input.convexUserId);
			const validationStudentCode = optionalTrimmedString(
				input.validationStudentCode,
			);
			const grade = optionalTrimmedString(input.grade);
			const state = optionalTrimmedString(input.state);
			if (input.convexUserId !== undefined && !convexUserId) {
				rejectProperty("$identify", "convex_user_id");
			}
			if (input.validationStudentCode !== undefined && !validationStudentCode) {
				rejectProperty("$identify", "validation_student_code");
			}
			if (input.grade !== undefined && (!grade || !isSupportedGrade(grade))) {
				rejectProperty("$identify", "grade");
			}
			if (
				input.state !== undefined &&
				(!state || !isSupportedFederalState(state))
			) {
				rejectProperty("$identify", "state");
			}

			adapter.identify(distinctId, {
				...(convexUserId ? { convex_user_id: convexUserId } : {}),
				...(validationStudentCode
					? { validation_student_code: validationStudentCode }
					: {}),
				...(grade && isSupportedGrade(grade) ? { grade } : {}),
				...(state && isSupportedFederalState(state) ? { state } : {}),
			});
		},
		capture<EventName extends ValidationEventName>(
			eventName: EventName,
			properties: ValidationEventProperties[EventName],
		) {
			if (!configured || !currentDistinctId) return;
			const schema = Object.hasOwn(eventPropertySchemas, eventName)
				? (eventPropertySchemas[eventName] as z.ZodObject)
				: undefined;
			if (!schema) {
				if (mode === "development") {
					throw new Error(`Unknown analytics event: ${eventName}`);
				}
				reportDiagnostic({ eventName });
				return;
			}

			const projectedProperties = projectProperties(
				schema,
				properties as Record<string, unknown>,
				{
					rejectUnknown: true,
					onRejected: (propertyName) => rejectProperty(eventName, propertyName),
				},
			);
			if (!projectedProperties) return;

			const sharedContext = (options.sharedContext ?? {}) as Record<
				string,
				unknown
			>;
			const projectedSharedContext: Record<string, AnalyticsProperty> = {
				analytics_schema_version: ANALYTICS_SCHEMA_VERSION,
			};
			for (const propertyName of Object.keys(sharedContext)) {
				if (!Object.hasOwn(sharedContextSchemas, propertyName)) {
					rejectProperty(eventName, propertyName);
				}
			}
			for (const [inputName, rule] of Object.entries(sharedContextSchemas)) {
				const value = sharedContext[inputName];
				if (value === undefined || value === null) continue;
				const result = rule.schema.safeParse(value);
				if (!result.success) {
					rejectProperty(eventName, rule.outputName);
					continue;
				}
				projectedSharedContext[rule.outputName] = result.data;
			}
			adapter.identify(currentDistinctId);
			adapter.capture(eventName, {
				...projectedSharedContext,
				...projectedProperties,
			});
		},
	};
}

export type {
	AnalyticsIdentityInput,
	AnalyticsMode,
	SharedAnalyticsContextInput,
	ValidationEventName,
	ValidationEventProperties,
};
