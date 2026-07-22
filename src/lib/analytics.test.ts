import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
	createValidationAnalytics,
	getValidationFileSizeBucket,
	type AnalyticsIdentityInput,
	type ValidationEventName,
	validationAnalyticsBeforeSend,
} from "./analytics";

const createAdapter = () => ({
	identify: vi.fn(),
	capture: vi.fn(),
	reset: vi.fn(),
});

describe("validation analytics contract", () => {
	it("exposes exactly the eleven Validation Phase event names", () => {
		type ExpectedEventName =
			| "onboarding_completed"
			| "homework_created"
			| "exam_created"
			| "material_uploaded"
			| "study_plan_generated"
			| "study_slot_started"
			| "study_slot_completed"
			| "study_slot_partially_completed"
			| "study_slot_missed"
			| "plan_adjusted"
			| "user_returned_next_day";

		expectTypeOf<ValidationEventName>().toEqualTypeOf<ExpectedEventName>();
	});

	it("identifies with exactly the approved custom person properties", () => {
		const adapter = createAdapter();
		const analytics = createValidationAnalytics(adapter, {
			configured: true,
			mode: "development",
		});

		analytics.identify({
			distinctId: "clerk_user_123",
			convexUserId: "convex_user_456",
			validationStudentCode: "S1",
			grade: "13",
			state: "Sachsen",
		});

		expect(adapter.identify).toHaveBeenCalledWith("clerk_user_123", {
			convex_user_id: "convex_user_456",
			validation_student_code: "S1",
			grade: "13",
			state: "Sachsen",
		});
		expect(adapter.capture).not.toHaveBeenCalled();
	});

	it.each([
		"6",
		"7",
		"8",
		"9",
		"10",
		"11",
		"12",
		"13",
	])("records supported grade %s", (grade) => {
		const adapter = createAdapter();
		const analytics = createValidationAnalytics(adapter, {
			configured: true,
			mode: "development",
		});

		analytics.identify({ distinctId: "clerk_user_123", grade });

		expect(adapter.identify).toHaveBeenCalledWith("clerk_user_123", {
			grade,
		});
	});

	it.each([
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
	])("rejects prohibited identity property %s before it reaches PostHog", (key) => {
		const adapter = createAdapter();
		const analytics = createValidationAnalytics(adapter, {
			configured: true,
			mode: "development",
		});
		const input = {
			distinctId: "clerk_user_123",
			[key]: "private value",
		} as unknown as AnalyticsIdentityInput;

		expect(() => analytics.identify(input)).toThrow(key);
		expect(adapter.identify).not.toHaveBeenCalled();
	});

	it("throws on invalid bounded identity values in development", () => {
		const adapter = createAdapter();
		const analytics = createValidationAnalytics(adapter, {
			configured: true,
			mode: "development",
		});

		expect(() =>
			analytics.identify({ distinctId: "clerk_user_123", grade: "14" }),
		).toThrow("grade");
		expect(() =>
			analytics.identify({ distinctId: "clerk_user_123", state: "private" }),
		).toThrow("state");
		expect(adapter.identify).not.toHaveBeenCalled();
	});

	it("rejects an invalid required distinct ID", () => {
		const adapter = createAdapter();
		const analytics = createValidationAnalytics(adapter, {
			configured: true,
			mode: "development",
		});

		expect(() => analytics.identify({ distinctId: " " })).toThrow(
			"distinct_id",
		);
		expect(adapter.identify).not.toHaveBeenCalled();
	});

	it("omits invalid optional identity values in production without diagnosing their values", () => {
		const adapter = createAdapter();
		const reportDiagnostic = vi.fn();
		const analytics = createValidationAnalytics(adapter, {
			configured: true,
			mode: "production",
			reportDiagnostic,
		});
		const input = {
			distinctId: "clerk_user_123",
			grade: "14",
			state: "private state",
			avatar_url: "https://private.example/avatar.png",
		} as unknown as AnalyticsIdentityInput;

		analytics.identify(input);

		expect(adapter.identify).toHaveBeenCalledWith("clerk_user_123", {});
		expect(reportDiagnostic.mock.calls).toEqual([
			[{ eventName: "$identify", propertyName: "avatar_url" }],
			[{ eventName: "$identify", propertyName: "grade" }],
			[{ eventName: "$identify", propertyName: "state" }],
		]);
		expect(JSON.stringify(reportDiagnostic.mock.calls)).not.toContain(
			"private state",
		);
		expect(JSON.stringify(reportDiagnostic.mock.calls)).not.toContain(
			"private.example",
		);
	});

	it("captures onboarding completion with only its exact properties and central shared context", () => {
		const adapter = createAdapter();
		const analytics = createValidationAnalytics(adapter, {
			configured: true,
			mode: "development",
			distinctId: "clerk_user_123",
			sharedContext: {
				validationStudentCode: "S1",
				easUpdateId: "update-123",
				easChannel: "production",
				easRuntimeVersion: "1.0.3",
				easIsEmbeddedLaunch: false,
			},
		});

		analytics.capture("onboarding_completed", {
			local_day_key: "2026-07-21",
			onboarding_version: 1,
		});

		expect(adapter.identify).toHaveBeenCalledWith("clerk_user_123");
		expect(adapter.capture).toHaveBeenCalledWith("onboarding_completed", {
			analytics_schema_version: 1,
			validation_student_code: "S1",
			eas_update_id: "update-123",
			eas_channel: "production",
			eas_runtime_version: "1.0.3",
			eas_is_embedded_launch: false,
			local_day_key: "2026-07-21",
			onboarding_version: 1,
		});
	});

	it.each([
		[
			"homework_created",
			{
				day_entry_id: "entry-1",
				planned_day_key: "2026-07-21",
				due_day_key: "2026-07-23",
				duration_minutes: 30,
			},
		],
		[
			"exam_created",
			{
				day_entry_id: "entry-2",
				planned_day_key: "2026-07-22",
				duration_minutes: 45,
				exam_type: "Klausur",
			},
		],
		[
			"material_uploaded",
			{
				learning_plan_id: "plan-1",
				file_type: "application/pdf",
				file_size_bucket: "1_to_10_mb",
			},
		],
		["study_plan_generated", { learning_plan_id: "plan-1", session_count: 5 }],
	] as const)("captures %s with its exact activation payload", (eventName, properties) => {
		const adapter = createAdapter();
		const analytics = createValidationAnalytics(adapter, {
			configured: true,
			mode: "development",
			distinctId: "clerk_user_123",
		});

		const capture = analytics.capture as (
			name: string,
			payload: Record<string, unknown>,
		) => void;
		capture(eventName, properties);

		expect(adapter.capture).toHaveBeenCalledWith(eventName, {
			analytics_schema_version: 1,
			...properties,
		});
	});

	it("rejects event-specific properties outside the closed event map", () => {
		const adapter = createAdapter();
		const analytics = createValidationAnalytics(adapter, {
			configured: true,
			mode: "development",
			distinctId: "clerk_user_123",
		});
		const capture = analytics.capture as (
			name: string,
			payload: Record<string, unknown>,
		) => void;

		expect(() =>
			capture("homework_created", {
				day_entry_id: "entry-1",
				planned_day_key: "2026-07-21",
				due_day_key: "2026-07-23",
				duration_minutes: 30,
				subject: "Private tutoring topic",
			}),
		).toThrow("subject");
		expect(adapter.capture).not.toHaveBeenCalled();
	});

	it("rejects inherited object names as unknown events", () => {
		const adapter = createAdapter();
		const analytics = createValidationAnalytics(adapter, {
			configured: true,
			mode: "development",
			distinctId: "clerk_user_123",
		});
		const capture = analytics.capture as (
			name: string,
			payload: Record<string, unknown>,
		) => void;

		expect(() => capture("toString", {})).toThrow("Unknown analytics event");
		expect(adapter.capture).not.toHaveBeenCalled();
		expect(
			validationAnalyticsBeforeSend({ event: "toString", properties: {} }),
		).toBeNull();
	});

	it.each([
		[
			"study_slot_started",
			{
				learning_plan_id: "plan-1",
				learning_plan_session_id: "session-1",
				phase: "practice",
				planned_day_key: "2026-07-21",
				planned_start_time: "16:00",
				duration_minutes: 30,
				deadline_day_key: "2026-07-25",
				started_at: 1_753_110_000_000,
			},
		],
		[
			"study_slot_completed",
			{
				learning_plan_id: "plan-1",
				learning_plan_session_id: "session-1",
				phase: "rehearsal",
				planned_day_key: "2026-07-21",
				planned_start_time: "16:00",
				duration_minutes: 30,
				outcome_at: 1_753_111_800_000,
			},
		],
		[
			"study_slot_partially_completed",
			{
				learning_plan_id: "plan-1",
				learning_plan_session_id: "session-1",
				phase: "theory",
				planned_day_key: "2026-07-21",
				planned_start_time: "16:00",
				duration_minutes: 30,
				outcome_at: 1_753_111_800_000,
			},
		],
		[
			"study_slot_missed",
			{
				learning_plan_id: "plan-1",
				learning_plan_session_id: "session-1",
				phase: "practice",
				planned_day_key: "2026-07-21",
				planned_start_time: "16:00",
				duration_minutes: 30,
				outcome_at: 1_753_111_800_000,
				missed_reason: "no_time",
			},
		],
	] as const)("captures %s with the exact slot context", (eventName, properties) => {
		const adapter = createAdapter();
		const analytics = createValidationAnalytics(adapter, {
			configured: true,
			mode: "development",
			distinctId: "clerk_user_123",
		});
		const capture = analytics.capture as (
			name: string,
			payload: Record<string, unknown>,
		) => void;

		capture(eventName, properties);

		expect(adapter.capture).toHaveBeenCalledWith(eventName, {
			analytics_schema_version: 1,
			...properties,
		});
	});

	it.each([
		[
			"plan_adjusted",
			{
				original_session_id: "session-1",
				new_session_id: "session-2",
				adjustment_type: "rescheduled_and_shortened",
				old_planned_day_key: "2026-07-21",
				new_planned_day_key: "2026-07-22",
				old_duration_minutes: 60,
				new_duration_minutes: 30,
				missed_reason: "too_big",
			},
		],
		[
			"user_returned_next_day",
			{
				local_day_key: "2026-07-22",
				previous_activity_day_key: "2026-07-21",
			},
		],
	] as const)("captures %s with its exact recovery payload", (eventName, properties) => {
		const adapter = createAdapter();
		const analytics = createValidationAnalytics(adapter, {
			configured: true,
			mode: "development",
			distinctId: "clerk_user_123",
		});
		const capture = analytics.capture as (
			name: string,
			payload: Record<string, unknown>,
		) => void;

		capture(eventName, properties);

		expect(adapter.capture).toHaveBeenCalledWith(eventName, {
			analytics_schema_version: 1,
			...properties,
		});
	});

	it.each([
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
	])("rejects prohibited event property %s before it reaches PostHog", (key) => {
		const adapter = createAdapter();
		const analytics = createValidationAnalytics(adapter, {
			configured: true,
			mode: "development",
			distinctId: "clerk_user_123",
		});
		const capture = analytics.capture as (
			name: string,
			payload: Record<string, unknown>,
		) => void;

		expect(() =>
			capture("homework_created", {
				day_entry_id: "entry-1",
				planned_day_key: "2026-07-21",
				due_day_key: "2026-07-23",
				duration_minutes: 30,
				[key]: "private value",
			}),
		).toThrow(key);
		expect(adapter.capture).not.toHaveBeenCalled();
	});

	it("drops production events with invalid required values", () => {
		const adapter = createAdapter();
		const reportDiagnostic = vi.fn();
		const analytics = createValidationAnalytics(adapter, {
			configured: true,
			mode: "production",
			distinctId: "clerk_user_123",
			reportDiagnostic,
		});
		const capture = analytics.capture as (
			name: string,
			payload: Record<string, unknown>,
		) => void;

		capture("study_slot_started", {
			learning_plan_id: "plan-1",
			learning_plan_session_id: "session-1",
			phase: "private phase",
			planned_day_key: "2026-07-21",
			planned_start_time: "16:00",
			duration_minutes: 30,
			started_at: 1_753_110_000_000,
		});

		expect(adapter.capture).not.toHaveBeenCalled();
		expect(reportDiagnostic).toHaveBeenCalledWith({
			eventName: "study_slot_started",
			propertyName: "phase",
		});
		expect(JSON.stringify(reportDiagnostic.mock.calls)).not.toContain(
			"private phase",
		);
	});

	it.each([
		{
			eventName: "exam_created",
			propertyName: "exam_type",
			allowed: [
				"Test",
				"Kurzkontrolle",
				"Leistungskontrolle",
				"Klassenarbeit",
				"Klausur",
				"Mündliche Prüfung",
				"Präsentation",
			],
			properties: {
				day_entry_id: "entry-1",
				planned_day_key: "2026-07-21",
				duration_minutes: 45,
			},
		},
		{
			eventName: "material_uploaded",
			propertyName: "file_type",
			allowed: [
				"application/pdf",
				"application/msword",
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				"application/vnd.ms-powerpoint",
				"application/vnd.openxmlformats-officedocument.presentationml.presentation",
				"text/plain",
				"text/markdown",
				"text/csv",
				"application/json",
				"image/jpeg",
				"image/png",
				"image/webp",
				"application/octet-stream",
			],
			properties: {
				learning_plan_id: "plan-1",
				file_size_bucket: "1_to_10_mb",
			},
		},
		{
			eventName: "material_uploaded",
			propertyName: "file_size_bucket",
			allowed: ["lt_1_mb", "1_to_10_mb", "10_to_50_mb", "gte_50_mb"],
			properties: {
				learning_plan_id: "plan-1",
				file_type: "application/pdf",
			},
		},
		{
			eventName: "study_slot_started",
			propertyName: "phase",
			allowed: ["theory", "practice", "rehearsal"],
			properties: {
				learning_plan_id: "plan-1",
				learning_plan_session_id: "session-1",
				planned_day_key: "2026-07-21",
				planned_start_time: "16:00",
				duration_minutes: 30,
				started_at: 1_753_110_000_000,
			},
		},
		{
			eventName: "study_slot_missed",
			propertyName: "missed_reason",
			allowed: [
				"no_time",
				"forgot",
				"no_motivation",
				"too_hard",
				"too_big",
				"unclear",
				"other",
			],
			properties: {
				learning_plan_id: "plan-1",
				learning_plan_session_id: "session-1",
				phase: "practice",
				planned_day_key: "2026-07-21",
				planned_start_time: "16:00",
				duration_minutes: 30,
				outcome_at: 1_753_111_800_000,
			},
		},
		{
			eventName: "plan_adjusted",
			propertyName: "adjustment_type",
			allowed: ["rescheduled", "shortened", "rescheduled_and_shortened"],
			properties: {
				original_session_id: "session-1",
				new_session_id: "session-2",
				old_planned_day_key: "2026-07-21",
				new_planned_day_key: "2026-07-22",
				old_duration_minutes: 60,
				new_duration_minutes: 30,
			},
		},
	] as const)("enforces the exact $propertyName vocabulary", ({
		allowed,
		eventName,
		properties,
		propertyName,
	}) => {
		for (const allowedValue of allowed) {
			const adapter = createAdapter();
			const capture = createValidationAnalytics(adapter, {
				configured: true,
				mode: "development",
				distinctId: "clerk_user_123",
			}).capture as (name: string, payload: Record<string, unknown>) => void;

			capture(eventName, { ...properties, [propertyName]: allowedValue });
			expect(adapter.capture).toHaveBeenCalledOnce();
		}

		const adapter = createAdapter();
		const capture = createValidationAnalytics(adapter, {
			configured: true,
			mode: "development",
			distinctId: "clerk_user_123",
		}).capture as (name: string, payload: Record<string, unknown>) => void;
		expect(() =>
			capture(eventName, { ...properties, [propertyName]: "not-approved" }),
		).toThrow(propertyName);
		expect(adapter.capture).not.toHaveBeenCalled();
	});

	it("omits invalid optional and unknown production properties", () => {
		const adapter = createAdapter();
		const reportDiagnostic = vi.fn();
		const analytics = createValidationAnalytics(adapter, {
			configured: true,
			mode: "production",
			distinctId: "clerk_user_123",
			reportDiagnostic,
		});
		const capture = analytics.capture as (
			name: string,
			payload: Record<string, unknown>,
		) => void;

		capture("plan_adjusted", {
			original_session_id: "session-1",
			new_session_id: "session-2",
			adjustment_type: "shortened",
			old_planned_day_key: "2026-07-21",
			new_planned_day_key: "2026-07-21",
			old_duration_minutes: 60,
			new_duration_minutes: 30,
			missed_reason: "private reason",
			notes: "private note",
		});

		expect(adapter.capture).toHaveBeenCalledWith("plan_adjusted", {
			analytics_schema_version: 1,
			original_session_id: "session-1",
			new_session_id: "session-2",
			adjustment_type: "shortened",
			old_planned_day_key: "2026-07-21",
			new_planned_day_key: "2026-07-21",
			old_duration_minutes: 60,
			new_duration_minutes: 30,
		});
		expect(reportDiagnostic.mock.calls).toEqual([
			[{ eventName: "plan_adjusted", propertyName: "notes" }],
			[{ eventName: "plan_adjusted", propertyName: "missed_reason" }],
		]);
	});

	it("is disabled without configuration or an identified user and resets on logout", () => {
		const disabledAdapter = createAdapter();
		const disabled = createValidationAnalytics(disabledAdapter, {
			configured: false,
			mode: "development",
			distinctId: "clerk_user_123",
		});
		disabled.identify({ distinctId: "clerk_user_123" });
		disabled.capture("onboarding_completed", {
			local_day_key: "2026-07-21",
			onboarding_version: 1,
		});
		expect(disabledAdapter.identify).not.toHaveBeenCalled();
		expect(disabledAdapter.capture).not.toHaveBeenCalled();

		const adapter = createAdapter();
		const analytics = createValidationAnalytics(adapter, {
			configured: true,
			mode: "development",
		});
		analytics.capture("onboarding_completed", {
			local_day_key: "2026-07-21",
			onboarding_version: 1,
		});
		expect(adapter.capture).not.toHaveBeenCalled();

		analytics.identify({ distinctId: "clerk_user_123" });
		analytics.identify(null);
		analytics.capture("onboarding_completed", {
			local_day_key: "2026-07-21",
			onboarding_version: 1,
		});
		expect(adapter.reset).toHaveBeenCalledOnce();
		expect(adapter.capture).not.toHaveBeenCalled();
	});

	it("rejects attempts to widen the centrally generated shared context", () => {
		const adapter = createAdapter();
		const analytics = createValidationAnalytics(adapter, {
			configured: true,
			mode: "development",
			distinctId: "clerk_user_123",
			sharedContext: {
				validationStudentCode: "S1",
				avatar_url: "https://private.example/avatar.png",
			} as never,
		});

		expect(() =>
			analytics.capture("onboarding_completed", {
				local_day_key: "2026-07-21",
				onboarding_version: 1,
			}),
		).toThrow("avatar_url");
		expect(adapter.capture).not.toHaveBeenCalled();
	});

	it("omits invalid optional shared values in production", () => {
		const adapter = createAdapter();
		const reportDiagnostic = vi.fn();
		const analytics = createValidationAnalytics(adapter, {
			configured: true,
			mode: "production",
			distinctId: "clerk_user_123",
			reportDiagnostic,
			sharedContext: {
				easChannel: " ",
				easIsEmbeddedLaunch: "private" as never,
			},
		});

		analytics.capture("onboarding_completed", {
			local_day_key: "2026-07-21",
			onboarding_version: 1,
		});

		expect(adapter.capture).toHaveBeenCalledWith("onboarding_completed", {
			analytics_schema_version: 1,
			local_day_key: "2026-07-21",
			onboarding_version: 1,
		});
		expect(reportDiagnostic.mock.calls).toEqual([
			[{ eventName: "onboarding_completed", propertyName: "eas_channel" }],
			[
				{
					eventName: "onboarding_completed",
					propertyName: "eas_is_embedded_launch",
				},
			],
		]);
	});

	it("before_send re-projects allowed events while preserving PostHog system properties", () => {
		const guarded = validationAnalyticsBeforeSend({
			event: "onboarding_completed",
			$set: { avatar_url: "https://private.example/avatar.png" },
			$set_once: { email: "private@example.com" },
			properties: {
				token: "project-key",
				distinct_id: "clerk_user_123",
				$lib: "posthog-react-native",
				analytics_schema_version: 1,
				local_day_key: "2026-07-21",
				onboarding_version: 1,
				avatar_url: "https://private.example/avatar.png",
				answer_text: "private answer",
			},
		});

		expect(guarded).toEqual({
			event: "onboarding_completed",
			properties: {
				token: "project-key",
				distinct_id: "clerk_user_123",
				$lib: "posthog-react-native",
				analytics_schema_version: 1,
				local_day_key: "2026-07-21",
				onboarding_version: 1,
			},
		});
	});

	it("before_send re-projects identify person properties", () => {
		const guarded = validationAnalyticsBeforeSend({
			event: "$identify",
			properties: {
				token: "project-key",
				distinct_id: "clerk_user_123",
				$set: {
					convex_user_id: "convex_user_456",
					validation_student_code: "S1",
					grade: "13",
					state: "Sachsen",
					$app_version: "1.0.3",
					$email: "private@example.com",
					$name: "Private Name",
					$avatar: "https://private.example/avatar.png",
					avatar_url: "https://private.example/avatar.png",
					school_type: "Private school name",
				},
			},
			$set: {
				convex_user_id: "convex_user_456",
				validation_student_code: "S1",
				grade: "13",
				state: "Sachsen",
				$app_version: "1.0.3",
				$email: "private@example.com",
				$name: "Private Name",
				$avatar: "https://private.example/avatar.png",
				avatar_url: "https://private.example/avatar.png",
				school_type: "Private school name",
			},
		});

		expect(guarded).toEqual({
			event: "$identify",
			properties: {
				token: "project-key",
				distinct_id: "clerk_user_123",
			},
			$set: {
				convex_user_id: "convex_user_456",
				validation_student_code: "S1",
				grade: "13",
				state: "Sachsen",
				$app_version: "1.0.3",
			},
		});
	});

	it("before_send sanitizes nested person updates on PostHog system events", () => {
		const guarded = validationAnalyticsBeforeSend({
			event: "$screen",
			properties: {
				$screen_name: "Home",
				$set: {
					convex_user_id: "convex_user_456",
					email: "private@example.com",
					$email: "private@example.com",
				},
				$set_once: {
					state: "Sachsen",
					avatar_url: "https://private.example/avatar.png",
				},
			},
		});

		expect(guarded).toEqual({
			event: "$screen",
			properties: { $screen_name: "Home" },
			$set: { convex_user_id: "convex_user_456" },
			$set_once: { state: "Sachsen" },
		});
	});

	it("before_send drops custom events outside the Validation Phase taxonomy", () => {
		expect(
			validationAnalyticsBeforeSend({
				event: "dashboard_viewed",
				properties: { selected_day_key: "2026-07-21" },
			}),
		).toBeNull();
	});

	it.each([
		[1024 * 1024 - 1, "lt_1_mb"],
		[1024 * 1024, "1_to_10_mb"],
		[10 * 1024 * 1024, "10_to_50_mb"],
		[50 * 1024 * 1024, "gte_50_mb"],
	] as const)("buckets %s uploaded bytes as %s", (bytes, expected) => {
		expect(getValidationFileSizeBucket(bytes)).toBe(expected);
	});
});
