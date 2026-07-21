import type { PostHogOptions } from "posthog-react-native";
import { logDiagnosticError } from "./diagnostics";
import { EXAM_TYPE_OPTIONS } from "./entry-options";
import { isSupportedGrade } from "./grades";
import { env } from "./runtime-config";
import { ACCEPTED_FILE_TYPES } from "./upload-policy";

const GERMAN_FEDERAL_STATES = new Set([
	"Baden-Württemberg",
	"Bayern",
	"Berlin",
	"Brandenburg",
	"Bremen",
	"Hamburg",
	"Hessen",
	"Mecklenburg-Vorpommern",
	"Niedersachsen",
	"Nordrhein-Westfalen",
	"Rheinland-Pfalz",
	"Saarland",
	"Sachsen",
	"Sachsen-Anhalt",
	"Schleswig-Holstein",
	"Thüringen",
]);

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

type PropertyRule<Value, Optional extends boolean = false> = {
	isValid: (value: unknown) => value is Value;
	optional: Optional;
};

type AnyPropertyRule = PropertyRule<unknown, boolean>;
type EventPropertyRules = Record<string, AnyPropertyRule>;

const required = <Value>(
	isValid: (value: unknown) => value is Value,
): PropertyRule<Value, false> => ({ isValid, optional: false });

const optional = <Value>(
	isValid: (value: unknown) => value is Value,
): PropertyRule<Value, true> => ({ isValid, optional: true });

const oneOf = <const Values extends readonly (string | number | boolean)[]>(
	values: Values,
) => {
	const allowed = new Set<string | number | boolean>(values);
	return (value: unknown): value is Values[number] =>
		(typeof value === "string" ||
			typeof value === "number" ||
			typeof value === "boolean") &&
		allowed.has(value);
};

const isNonEmptyString = (value: unknown): value is string =>
	typeof value === "string" && value.length > 0 && value.trim() === value;

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

const isPositiveInteger = (value: unknown): value is number =>
	typeof value === "number" && Number.isInteger(value) && value > 0;

const isTime = (value: unknown): value is string =>
	typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

const slotPropertyRules = {
	learning_plan_id: required(isNonEmptyString),
	learning_plan_session_id: required(isNonEmptyString),
	phase: required(oneOf(VALIDATION_SESSION_PHASES)),
	planned_day_key: required(isDayKey),
	planned_start_time: required(isTime),
	duration_minutes: required(isPositiveInteger),
	deadline_day_key: optional(isDayKey),
} as const satisfies EventPropertyRules;

const sharedContextRules = {
	validationStudentCode: {
		outputName: "validation_student_code",
		isValid: isNonEmptyString,
	},
	easUpdateId: { outputName: "eas_update_id", isValid: isNonEmptyString },
	easChannel: { outputName: "eas_channel", isValid: isNonEmptyString },
	easRuntimeVersion: {
		outputName: "eas_runtime_version",
		isValid: isNonEmptyString,
	},
	easIsEmbeddedLaunch: {
		outputName: "eas_is_embedded_launch",
		isValid: (value: unknown): value is boolean => typeof value === "boolean",
	},
} as const;

const sharedOutputRules = {
	analytics_schema_version: required(
		oneOf([ANALYTICS_SCHEMA_VERSION] as const),
	),
	validation_student_code: optional(isNonEmptyString),
	eas_update_id: optional(isNonEmptyString),
	eas_channel: optional(isNonEmptyString),
	eas_runtime_version: optional(isNonEmptyString),
	eas_is_embedded_launch: optional(
		(value: unknown): value is boolean => typeof value === "boolean",
	),
} as const satisfies EventPropertyRules;

const identityOutputRules = {
	convex_user_id: optional(isNonEmptyString),
	validation_student_code: optional(isNonEmptyString),
	grade: optional(isSupportedGrade),
	state: optional((value: unknown): value is string =>
		typeof value === "string" ? GERMAN_FEDERAL_STATES.has(value) : false,
	),
} as const satisfies EventPropertyRules;

const eventPropertyRules = {
	onboarding_completed: {
		local_day_key: required(isDayKey),
		onboarding_version: required(oneOf([1] as const)),
	},
	homework_created: {
		day_entry_id: required(isNonEmptyString),
		planned_day_key: required(isDayKey),
		due_day_key: required(isDayKey),
		duration_minutes: required(isPositiveInteger),
	},
	exam_created: {
		day_entry_id: required(isNonEmptyString),
		planned_day_key: required(isDayKey),
		duration_minutes: required(isPositiveInteger),
		exam_type: required(oneOf(EXAM_TYPE_OPTIONS)),
	},
	material_uploaded: {
		learning_plan_id: required(isNonEmptyString),
		file_type: required(oneOf(VALIDATION_FILE_TYPES)),
		file_size_bucket: required(oneOf(VALIDATION_FILE_SIZE_BUCKETS)),
	},
	study_plan_generated: {
		learning_plan_id: required(isNonEmptyString),
		session_count: required(isPositiveInteger),
	},
	study_slot_started: {
		...slotPropertyRules,
		started_at: required(isPositiveInteger),
	},
	study_slot_completed: {
		...slotPropertyRules,
		outcome_at: required(isPositiveInteger),
	},
	study_slot_partially_completed: {
		...slotPropertyRules,
		outcome_at: required(isPositiveInteger),
	},
	study_slot_missed: {
		...slotPropertyRules,
		outcome_at: required(isPositiveInteger),
		missed_reason: required(oneOf(VALIDATION_MISSED_REASONS)),
	},
	plan_adjusted: {
		original_session_id: required(isNonEmptyString),
		new_session_id: required(isNonEmptyString),
		adjustment_type: required(oneOf(VALIDATION_ADJUSTMENT_TYPES)),
		old_planned_day_key: required(isDayKey),
		new_planned_day_key: required(isDayKey),
		old_duration_minutes: required(isPositiveInteger),
		new_duration_minutes: required(isPositiveInteger),
		missed_reason: optional(oneOf(VALIDATION_MISSED_REASONS)),
	},
	user_returned_next_day: {
		local_day_key: required(isDayKey),
		previous_activity_day_key: required(isDayKey),
	},
} as const satisfies Record<string, EventPropertyRules>;

type RuleValue<Rule> =
	Rule extends PropertyRule<infer Value, boolean> ? Value : never;

type RequiredPropertyKeys<Rules extends EventPropertyRules> = {
	[Key in keyof Rules]: Rules[Key] extends PropertyRule<unknown, false>
		? Key
		: never;
}[keyof Rules];

type OptionalPropertyKeys<Rules extends EventPropertyRules> = Exclude<
	keyof Rules,
	RequiredPropertyKeys<Rules>
>;

type PropertiesFromRules<Rules extends EventPropertyRules> = {
	[Key in RequiredPropertyKeys<Rules>]: RuleValue<Rules[Key]>;
} & {
	[Key in OptionalPropertyKeys<Rules>]?: RuleValue<Rules[Key]>;
};

type ValidationEventProperties = {
	[EventName in keyof typeof eventPropertyRules]: PropertiesFromRules<
		(typeof eventPropertyRules)[EventName]
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
	rules: EventPropertyRules,
	input: Record<string, unknown>,
	options: {
		rejectUnknown?: boolean;
		onRejected?: (propertyName: string) => void;
	} = {},
): Record<string, AnalyticsProperty> | null => {
	const onRejected = options.onRejected ?? (() => undefined);
	if (options.rejectUnknown) {
		for (const propertyName of Object.keys(input)) {
			if (!Object.hasOwn(rules, propertyName)) onRejected(propertyName);
		}
	}

	const projected: Record<string, AnalyticsProperty> = {};
	for (const [propertyName, rule] of Object.entries(rules)) {
		const value = input[propertyName];
		if (value === undefined) {
			if (rule.optional) continue;
			onRejected(propertyName);
			return null;
		}
		if (!rule.isValid(value)) {
			onRejected(propertyName);
			if (rule.optional) continue;
			return null;
		}
		projected[propertyName] = value as AnalyticsProperty;
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
		...(projectProperties(identityOutputRules, properties) ?? {}),
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

	const eventRules = Object.hasOwn(eventPropertyRules, event.event)
		? (eventPropertyRules[
				event.event as ValidationEventName
			] as EventPropertyRules)
		: undefined;
	if (eventRules) {
		const shared = projectProperties(sharedOutputRules, properties);
		const specific = projectProperties(eventRules, properties);
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
				(!state || !GERMAN_FEDERAL_STATES.has(state))
			) {
				rejectProperty("$identify", "state");
			}

			adapter.identify(distinctId, {
				...(convexUserId ? { convex_user_id: convexUserId } : {}),
				...(validationStudentCode
					? { validation_student_code: validationStudentCode }
					: {}),
				...(grade && isSupportedGrade(grade) ? { grade } : {}),
				...(state && GERMAN_FEDERAL_STATES.has(state) ? { state } : {}),
			});
		},
		capture<EventName extends ValidationEventName>(
			eventName: EventName,
			properties: ValidationEventProperties[EventName],
		) {
			if (!configured || !currentDistinctId) return;
			const rules = Object.hasOwn(eventPropertyRules, eventName)
				? (eventPropertyRules[eventName] as EventPropertyRules)
				: undefined;
			if (!rules) {
				if (mode === "development") {
					throw new Error(`Unknown analytics event: ${eventName}`);
				}
				reportDiagnostic({ eventName });
				return;
			}

			const projectedProperties = projectProperties(
				rules,
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
				if (!Object.hasOwn(sharedContextRules, propertyName)) {
					rejectProperty(eventName, propertyName);
				}
			}
			for (const [inputName, rule] of Object.entries(sharedContextRules)) {
				const value = sharedContext[inputName];
				if (value === undefined || value === null) continue;
				if (!rule.isValid(value)) {
					rejectProperty(eventName, rule.outputName);
					continue;
				}
				projectedSharedContext[rule.outputName] = value as AnalyticsProperty;
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
	ValidationEventProperties,
	ValidationEventName,
};
