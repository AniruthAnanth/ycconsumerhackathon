/**
 * The slice of the backend contract (API.md) that the capture screens call, as typed function
 * references: Voice Draft, the proof camera and verdict, the drop actions and the demo controls.
 *
 * Backend modules land from several threads in no fixed order. Binding to the agreed names here
 * lets these screens typecheck against the contract rather than against whatever happens to be
 * on main, and keeps every shape they send or render readable in one place. Names and shapes
 * mirror API.md exactly; change them there first. What the shell also reads (users.me,
 * lineup.roster, drops.active) lives in lib/backend.ts.
 */
import { makeFunctionReference } from "convex/server";

import type { Id } from "@/convex/_generated/dataModel";
import type { Place } from "@/lib/backend";
import type { ProofType, Slot } from "@/lib/slots";

type NoArgs = Record<string, never>;

const query = <Args extends Record<string, unknown>, Result>(name: string) =>
  makeFunctionReference<"query", Args, Result>(name);
const mutation = <Args extends Record<string, unknown>, Result>(name: string) =>
  makeFunctionReference<"mutation", Args, Result>(name);
const action = <Args extends Record<string, unknown>, Result>(name: string) =>
  makeFunctionReference<"action", Args, Result>(name);

/** A task as Voice Draft proposes it, before Lock Lineup turns it into a roster row. */
export type DraftTask = { slot: Slot; title: string; points: number; proofType: ProofType; place?: Place };

export type Draft = { transcript: string; tasks: DraftTask[] };

/** The referee's ruling on one proof. `reason` is always written for the player to read. */
export type Verdict = {
  pass: boolean;
  confidence: number;
  reason: string;
  highlight: number;
  caption: string;
  /** Points awarded; 0 on a fail. */
  points: number;
  /** Passed, but narrowly enough that the feed invites a challenge. */
  closeCall: boolean;
};

export type SeedPlayer = { _id: Id<"users">; name: string };

export const capture = {
  lineup: {
    /** Send the uploaded voice note, or a typed transcript; never both. */
    draft: action<{ audioStorageId?: Id<"_storage">; transcript?: string }, Draft>("lineup:draft"),
    lock: mutation<{ tasks: DraftTask[]; transcript?: string }, { weekStart: number }>("lineup:lock"),
  },
  proofs: {
    /** Also used for the Voice Draft recording: it is the app's one upload path. */
    generateUploadUrl: mutation<NoArgs, string>("proofs:generateUploadUrl"),
    verify: action<
      {
        taskId: Id<"tasks">;
        storageId: Id<"_storage">;
        mediaType: "photo" | "video";
        /** One to three stills in clip order. Required for a video: the model cannot read video. */
        frameStorageIds?: Id<"_storage">[];
        lat?: number;
        lng?: number;
      },
      Verdict
    >("proofs:verify"),
  },
  canvas: {
    verify: action<{ taskId: Id<"tasks"> }, Verdict>("canvas:verify"),
  },
  drops: {
    acceptMystery: mutation<{ dropId: Id<"drops">; wager?: number }, null>("drops:acceptMystery"),
    passMystery: mutation<{ dropId: Id<"drops"> }, null>("drops:passMystery"),
    triggerQuickTime: mutation<{ leagueId: Id<"leagues"> }, Id<"drops">>("drops:triggerQuickTime"),
  },
  whop: {
    settleWeek: action<{ leagueId: Id<"leagues"> }, null>("whop:settleWeek"),
  },
  seed: {
    reset: mutation<NoArgs, null>("seed:reset"),
    players: query<NoArgs, SeedPlayer[]>("seed:players"),
    actAs: mutation<{ userId: Id<"users"> | null }, null>("seed:actAs"),
  },
} as const;
