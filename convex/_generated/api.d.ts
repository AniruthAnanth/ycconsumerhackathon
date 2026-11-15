/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as canvas from "../canvas.js";
import type * as crons from "../crons.js";
import type * as drops from "../drops.js";
import type * as feed from "../feed.js";
import type * as http from "../http.js";
import type * as keiki from "../keiki.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_dropRules from "../lib/dropRules.js";
import type * as lib_settlement from "../lib/settlement.js";
import type * as profile from "../profile.js";
import type * as whop from "../whop.js";
import type * as wrapped from "../wrapped.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  canvas: typeof canvas;
  crons: typeof crons;
  drops: typeof drops;
  feed: typeof feed;
  http: typeof http;
  keiki: typeof keiki;
  "lib/auth": typeof lib_auth;
  "lib/dropRules": typeof lib_dropRules;
  "lib/settlement": typeof lib_settlement;
  profile: typeof profile;
  whop: typeof whop;
  wrapped: typeof wrapped;
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
