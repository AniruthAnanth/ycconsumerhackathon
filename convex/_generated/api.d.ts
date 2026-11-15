/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as auth from "../auth.js";
import type * as canvas from "../canvas.js";
import type * as challenges from "../challenges.js";
import type * as crons from "../crons.js";
import type * as drops from "../drops.js";
import type * as feed from "../feed.js";
import type * as http from "../http.js";
import type * as keiki from "../keiki.js";
import type * as keikiMedia from "../keikiMedia.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_dropRules from "../lib/dropRules.js";
import type * as lib_geo from "../lib/geo.js";
import type * as lib_keikiProtocol from "../lib/keikiProtocol.js";
import type * as lib_keikiText from "../lib/keikiText.js";
import type * as lib_lineupRules from "../lib/lineupRules.js";
import type * as lib_mediaType from "../lib/mediaType.js";
import type * as lib_schedule from "../lib/schedule.js";
import type * as lib_settlement from "../lib/settlement.js";
import type * as lib_verdict from "../lib/verdict.js";
import type * as lineup from "../lineup.js";
import type * as memory from "../memory.js";
import type * as profile from "../profile.js";
import type * as proofs from "../proofs.js";
import type * as seasons from "../seasons.js";
import type * as whop from "../whop.js";
import type * as wrapped from "../wrapped.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  auth: typeof auth;
  canvas: typeof canvas;
  challenges: typeof challenges;
  crons: typeof crons;
  drops: typeof drops;
  feed: typeof feed;
  http: typeof http;
  keiki: typeof keiki;
  keikiMedia: typeof keikiMedia;
  "lib/auth": typeof lib_auth;
  "lib/dropRules": typeof lib_dropRules;
  "lib/geo": typeof lib_geo;
  "lib/keikiProtocol": typeof lib_keikiProtocol;
  "lib/keikiText": typeof lib_keikiText;
  "lib/lineupRules": typeof lib_lineupRules;
  "lib/mediaType": typeof lib_mediaType;
  "lib/schedule": typeof lib_schedule;
  "lib/settlement": typeof lib_settlement;
  "lib/verdict": typeof lib_verdict;
  lineup: typeof lineup;
  memory: typeof memory;
  profile: typeof profile;
  proofs: typeof proofs;
  seasons: typeof seasons;
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
