/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountDeletion from "../accountDeletion.js";
import type * as adaptiveLearningPlan from "../adaptiveLearningPlan.js";
import type * as adaptiveLearningPlanPolicy from "../adaptiveLearningPlanPolicy.js";
import type * as answerEvaluation from "../answerEvaluation.js";
import type * as dayEntries from "../dayEntries.js";
import type * as dayKeyVariants from "../dayKeyVariants.js";
import type * as diagnosticReadiness from "../diagnosticReadiness.js";
import type * as entitlements from "../entitlements.js";
import type * as env from "../env.js";
import type * as errors from "../errors.js";
import type * as fileStorage from "../fileStorage.js";
import type * as generatedGermanText from "../generatedGermanText.js";
import type * as generatedGermanTextRepair from "../generatedGermanTextRepair.js";
import type * as http from "../http.js";
import type * as learningContentPlan from "../learningContentPlan.js";
import type * as learningPlanAi from "../learningPlanAi.js";
import type * as learningPlanAiCost from "../learningPlanAiCost.js";
import type * as learningPlanAiUsage from "../learningPlanAiUsage.js";
import type * as learningPlanAvailability from "../learningPlanAvailability.js";
import type * as learningPlanPlanningHints from "../learningPlanPlanningHints.js";
import type * as learningPlans from "../learningPlans.js";
import type * as learningPreparationPolicy from "../learningPreparationPolicy.js";
import type * as learningSessionComposition from "../learningSessionComposition.js";
import type * as learningSessionContent from "../learningSessionContent.js";
import type * as learningSessionContentConstraints from "../learningSessionContentConstraints.js";
import type * as learningSessionDurationText from "../learningSessionDurationText.js";
import type * as learningSessionScheduleFormatting from "../learningSessionScheduleFormatting.js";
import type * as learningSessionSegmentation from "../learningSessionSegmentation.js";
import type * as learningTimeAvailability from "../learningTimeAvailability.js";
import type * as learningTimes from "../learningTimes.js";
import type * as learningTimesBackfill from "../learningTimesBackfill.js";
import type * as learningTopicMap from "../learningTopicMap.js";
import type * as notifications from "../notifications.js";
import type * as questionNovelty from "../questionNovelty.js";
import type * as revenueCat from "../revenueCat.js";
import type * as scheduleConflicts from "../scheduleConflicts.js";
import type * as theoryContent from "../theoryContent.js";
import type * as timetableAi from "../timetableAi.js";
import type * as timetableOccurrences from "../timetableOccurrences.js";
import type * as timetablePolicy from "../timetablePolicy.js";
import type * as timetables from "../timetables.js";
import type * as topicDescriptionValidation from "../topicDescriptionValidation.js";
import type * as userAnalytics from "../userAnalytics.js";
import type * as users from "../users.js";
import type * as validationAnalytics from "../validationAnalytics.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountDeletion: typeof accountDeletion;
  adaptiveLearningPlan: typeof adaptiveLearningPlan;
  adaptiveLearningPlanPolicy: typeof adaptiveLearningPlanPolicy;
  answerEvaluation: typeof answerEvaluation;
  dayEntries: typeof dayEntries;
  dayKeyVariants: typeof dayKeyVariants;
  diagnosticReadiness: typeof diagnosticReadiness;
  entitlements: typeof entitlements;
  env: typeof env;
  errors: typeof errors;
  fileStorage: typeof fileStorage;
  generatedGermanText: typeof generatedGermanText;
  generatedGermanTextRepair: typeof generatedGermanTextRepair;
  http: typeof http;
  learningContentPlan: typeof learningContentPlan;
  learningPlanAi: typeof learningPlanAi;
  learningPlanAiCost: typeof learningPlanAiCost;
  learningPlanAiUsage: typeof learningPlanAiUsage;
  learningPlanAvailability: typeof learningPlanAvailability;
  learningPlanPlanningHints: typeof learningPlanPlanningHints;
  learningPlans: typeof learningPlans;
  learningPreparationPolicy: typeof learningPreparationPolicy;
  learningSessionComposition: typeof learningSessionComposition;
  learningSessionContent: typeof learningSessionContent;
  learningSessionContentConstraints: typeof learningSessionContentConstraints;
  learningSessionDurationText: typeof learningSessionDurationText;
  learningSessionScheduleFormatting: typeof learningSessionScheduleFormatting;
  learningSessionSegmentation: typeof learningSessionSegmentation;
  learningTimeAvailability: typeof learningTimeAvailability;
  learningTimes: typeof learningTimes;
  learningTimesBackfill: typeof learningTimesBackfill;
  learningTopicMap: typeof learningTopicMap;
  notifications: typeof notifications;
  questionNovelty: typeof questionNovelty;
  revenueCat: typeof revenueCat;
  scheduleConflicts: typeof scheduleConflicts;
  theoryContent: typeof theoryContent;
  timetableAi: typeof timetableAi;
  timetableOccurrences: typeof timetableOccurrences;
  timetablePolicy: typeof timetablePolicy;
  timetables: typeof timetables;
  topicDescriptionValidation: typeof topicDescriptionValidation;
  userAnalytics: typeof userAnalytics;
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
