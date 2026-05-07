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
import type * as env from "../env.js";
import type * as fileStorage from "../fileStorage.js";
import type * as learningPlanAi from "../learningPlanAi.js";
import type * as learningPlans from "../learningPlans.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  dayEntries: typeof dayEntries;
  env: typeof env;
  fileStorage: typeof fileStorage;
  learningPlanAi: typeof learningPlanAi;
  learningPlans: typeof learningPlans;
  users: typeof users;
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
