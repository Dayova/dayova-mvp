/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as dayEntries from "../dayEntries.js";
import type * as dayKeyVariants from "../dayKeyVariants.js";
import type * as env from "../env.js";
import type * as errors from "../errors.js";
import type * as fileStorage from "../fileStorage.js";
import type * as generatedGermanText from "../generatedGermanText.js";
import type * as generatedGermanTextRepair from "../generatedGermanTextRepair.js";
import type * as learningContentPlan from "../learningContentPlan.js";
import type * as learningPlanAi from "../learningPlanAi.js";
import type * as learningPlanPlanningHints from "../learningPlanPlanningHints.js";
import type * as learningPlans from "../learningPlans.js";
import type * as learningSessionComposition from "../learningSessionComposition.js";
import type * as learningSessionContent from "../learningSessionContent.js";
import type * as learningSessionContentConstraints from "../learningSessionContentConstraints.js";
import type * as learningSessionScheduleFormatting from "../learningSessionScheduleFormatting.js";
import type * as learningSessionSegmentation from "../learningSessionSegmentation.js";
import type * as learningTimes from "../learningTimes.js";
import type * as learningTopicMap from "../learningTopicMap.js";
import type * as notifications from "../notifications.js";
import type * as scheduleConflicts from "../scheduleConflicts.js";
import type * as theoryContent from "../theoryContent.js";
import type * as topicDescriptionValidation from "../topicDescriptionValidation.js";
import type * as users from "../users.js";
import type * as validationAnalytics from "../validationAnalytics.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  dayEntries: typeof dayEntries;
  dayKeyVariants: typeof dayKeyVariants;
  env: typeof env;
  errors: typeof errors;
  fileStorage: typeof fileStorage;
  generatedGermanText: typeof generatedGermanText;
  generatedGermanTextRepair: typeof generatedGermanTextRepair;
  learningContentPlan: typeof learningContentPlan;
  learningPlanAi: typeof learningPlanAi;
  learningPlanPlanningHints: typeof learningPlanPlanningHints;
  learningPlans: typeof learningPlans;
  learningSessionComposition: typeof learningSessionComposition;
  learningSessionContent: typeof learningSessionContent;
  learningSessionContentConstraints: typeof learningSessionContentConstraints;
  learningSessionScheduleFormatting: typeof learningSessionScheduleFormatting;
  learningSessionSegmentation: typeof learningSessionSegmentation;
  learningTimes: typeof learningTimes;
  learningTopicMap: typeof learningTopicMap;
  notifications: typeof notifications;
  scheduleConflicts: typeof scheduleConflicts;
  theoryContent: typeof theoryContent;
  topicDescriptionValidation: typeof topicDescriptionValidation;
  users: typeof users;
  validationAnalytics: typeof validationAnalytics;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  convexFilesControl: import("@gilhrpenner/convex-files-control/_generated/component.js").ComponentApi<"convexFilesControl">;
};
