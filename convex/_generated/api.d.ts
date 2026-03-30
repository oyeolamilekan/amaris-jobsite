/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as linkedin_actions from "../linkedin/actions.js";
import type * as linkedin_normalize from "../linkedin/normalize.js";
import type * as linkedin_parse from "../linkedin/parse.js";
import type * as linkedin_queries from "../linkedin/queries.js";
import type * as linkedin_queryBuilder from "../linkedin/queryBuilder.js";
import type * as search_actions from "../search/actions.js";
import type * as search_extract from "../search/extract.js";
import type * as search_facets from "../search/facets.js";
import type * as search_normalize from "../search/normalize.js";
import type * as search_pipeline from "../search/pipeline.js";
import type * as search_progress from "../search/progress.js";
import type * as search_queries from "../search/queries.js";
import type * as shared_constants from "../shared/constants.js";
import type * as shared_env from "../shared/env.js";
import type * as shared_failure from "../shared/failure.js";
import type * as shared_model from "../shared/model.js";
import type * as shared_prompts from "../shared/prompts.js";
import type * as shared_schemas from "../shared/schemas.js";
import type * as shared_tavily from "../shared/tavily.js";
import type * as shared_validators from "../shared/validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "linkedin/actions": typeof linkedin_actions;
  "linkedin/normalize": typeof linkedin_normalize;
  "linkedin/parse": typeof linkedin_parse;
  "linkedin/queries": typeof linkedin_queries;
  "linkedin/queryBuilder": typeof linkedin_queryBuilder;
  "search/actions": typeof search_actions;
  "search/extract": typeof search_extract;
  "search/facets": typeof search_facets;
  "search/normalize": typeof search_normalize;
  "search/pipeline": typeof search_pipeline;
  "search/progress": typeof search_progress;
  "search/queries": typeof search_queries;
  "shared/constants": typeof shared_constants;
  "shared/env": typeof shared_env;
  "shared/failure": typeof shared_failure;
  "shared/model": typeof shared_model;
  "shared/prompts": typeof shared_prompts;
  "shared/schemas": typeof shared_schemas;
  "shared/tavily": typeof shared_tavily;
  "shared/validators": typeof shared_validators;
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
