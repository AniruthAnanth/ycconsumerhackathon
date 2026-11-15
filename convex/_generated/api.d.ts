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
import type * as checkins from "../checkins.js";
import type * as crons from "../crons.js";
import type * as drops from "../drops.js";
import type * as feed from "../feed.js";
import type * as fixtures from "../fixtures.js";
import type * as http from "../http.js";
import type * as keiki from "../keiki.js";
import type * as keikiMedia from "../keikiMedia.js";
import type * as leadChange from "../leadChange.js";
import type * as leaderboards from "../leaderboards.js";
import type * as leagues from "../leagues.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_checkinRules from "../lib/checkinRules.js";
import type * as lib_clip from "../lib/clip.js";
import type * as lib_dropRules from "../lib/dropRules.js";
import type * as lib_geo from "../lib/geo.js";
import type * as lib_keikiProtocol from "../lib/keikiProtocol.js";
import type * as lib_keikiText from "../lib/keikiText.js";
import type * as lib_lineupRules from "../lib/lineupRules.js";
import type * as lib_mediaType from "../lib/mediaType.js";
import type * as lib_projection from "../lib/projection.js";
import type * as lib_ranking from "../lib/ranking.js";
import type * as lib_schedule from "../lib/schedule.js";
import type * as lib_scoring from "../lib/scoring.js";
import type * as lib_seedPhotos from "../lib/seedPhotos.js";
import type * as lib_settlement from "../lib/settlement.js";
import type * as lib_verdict from "../lib/verdict.js";
import type * as lib_versusSettlement from "../lib/versusSettlement.js";
import type * as lib_week from "../lib/week.js";
import type * as lib_weekTally from "../lib/weekTally.js";
import type * as lineup from "../lineup.js";
import type * as memory from "../memory.js";
import type * as profile from "../profile.js";
import type * as proofs from "../proofs.js";
import type * as seasons from "../seasons.js";
import type * as seed from "../seed.js";
import type * as standings from "../standings.js";
import type * as users from "../users.js";
import type * as versus from "../versus.js";
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
  checkins: typeof checkins;
  crons: typeof crons;
  drops: typeof drops;
  feed: typeof feed;
  fixtures: typeof fixtures;
  http: typeof http;
  keiki: typeof keiki;
  keikiMedia: typeof keikiMedia;
  leadChange: typeof leadChange;
  leaderboards: typeof leaderboards;
  leagues: typeof leagues;
  "lib/auth": typeof lib_auth;
  "lib/checkinRules": typeof lib_checkinRules;
  "lib/clip": typeof lib_clip;
  "lib/dropRules": typeof lib_dropRules;
  "lib/geo": typeof lib_geo;
  "lib/keikiProtocol": typeof lib_keikiProtocol;
  "lib/keikiText": typeof lib_keikiText;
  "lib/lineupRules": typeof lib_lineupRules;
  "lib/mediaType": typeof lib_mediaType;
  "lib/projection": typeof lib_projection;
  "lib/ranking": typeof lib_ranking;
  "lib/schedule": typeof lib_schedule;
  "lib/scoring": typeof lib_scoring;
  "lib/seedPhotos": typeof lib_seedPhotos;
  "lib/settlement": typeof lib_settlement;
  "lib/verdict": typeof lib_verdict;
  "lib/versusSettlement": typeof lib_versusSettlement;
  "lib/week": typeof lib_week;
  "lib/weekTally": typeof lib_weekTally;
  lineup: typeof lineup;
  memory: typeof memory;
  profile: typeof profile;
  proofs: typeof proofs;
  seasons: typeof seasons;
  seed: typeof seed;
  standings: typeof standings;
  users: typeof users;
  versus: typeof versus;
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
