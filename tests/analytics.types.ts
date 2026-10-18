import { expectTypeOf } from "vitest";
import type { ValidationEventName } from "../src/lib/analytics";

type ExpectedEventName =
	| "feature_interaction"
	| "app_screen_viewed"
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
