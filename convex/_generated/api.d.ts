/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as linkedinPeople from "../linkedinPeople.js";
import type * as linkedinPeopleActions from "../linkedinPeopleActions.js";
import type * as linkedinPeopleAi from "../linkedinPeopleAi.js";
import type * as linkedinPeopleNormalize from "../linkedinPeopleNormalize.js";
import type * as linkedinPeopleQueryBuilder from "../linkedinPeopleQueryBuilder.js";
import type * as search from "../search.js";
import type * as searchActions from "../searchActions.js";
import type * as searchConstants from "../searchConstants.js";
import type * as searchEnv from "../searchEnv.js";
import type * as searchExtract from "../searchExtract.js";
import type * as searchFacets from "../searchFacets.js";
import type * as searchFailure from "../searchFailure.js";
import type * as searchModel from "../searchModel.js";
import type * as searchNormalize from "../searchNormalize.js";
import type * as searchPipeline from "../searchPipeline.js";
import type * as searchProgress from "../searchProgress.js";
import type * as searchPrompts from "../searchPrompts.js";
import type * as searchSchemas from "../searchSchemas.js";
import type * as searchTavily from "../searchTavily.js";
import type * as searchValidators from "../searchValidators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  linkedinPeople: typeof linkedinPeople;
  linkedinPeopleActions: typeof linkedinPeopleActions;
  linkedinPeopleAi: typeof linkedinPeopleAi;
  linkedinPeopleNormalize: typeof linkedinPeopleNormalize;
  linkedinPeopleQueryBuilder: typeof linkedinPeopleQueryBuilder;
  search: typeof search;
  searchActions: typeof searchActions;
  searchConstants: typeof searchConstants;
  searchEnv: typeof searchEnv;
  searchExtract: typeof searchExtract;
  searchFacets: typeof searchFacets;
  searchFailure: typeof searchFailure;
  searchModel: typeof searchModel;
  searchNormalize: typeof searchNormalize;
  searchPipeline: typeof searchPipeline;
  searchProgress: typeof searchProgress;
  searchPrompts: typeof searchPrompts;
  searchSchemas: typeof searchSchemas;
  searchTavily: typeof searchTavily;
  searchValidators: typeof searchValidators;
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

export declare const components: {};
