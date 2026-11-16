/**
 * The slice of the backend contract (API.md) that the capture screens call, as typed function
 * references: Voice Draft, the proof camera and verdict, the drop actions and the demo controls.
 *
 * These names and shapes are hand-kept mirrors of API.md, and nothing in the typecheck verifies
 * them: lib/backend.contract.ts compares only lib/backend.ts with the generated api. What the
 * shell also reads (users.me, lineup.roster, drops.active) lives in lib/backend.ts.
 */
import type { Id } from "@/convex/_generated/dataModel";
import { action, mutation, query, type NoArgs, type Place } from "@/lib/backend";
import type { ProofType, Slot } from "@/lib/slots";

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
  /** Machine tags such as "stale_capture" or "too_short". Absent from a backend older than the proof types. */
  flags?: string[];
  /** Neither passed nor failed: the task is held while the league votes on it. */
  needsVote?: boolean;
};

export type SeedPlayer = { _id: Id<"users">; name: string };

export const capture = {
  lineup: {
    /** Send the uploaded voice note, or a typed transcript; never both. */
    draft: action<{ audioStorageId?: Id<"_storage">; transcript?: string }, Draft>("lineup:draft"),
    lock: mutation<{ tasks: DraftTask[]; transcript?: string }, { weekStart: number }>("lineup:lock"),
    /** Gives a check-in task drafted without coordinates its place; allowed on a locked week, once. */
    pinPlace: mutation<{ taskId: Id<"tasks">; place: Place }, null>("lineup:pinPlace"),
    /** Applies a typed change to a lineup that isn't locked yet; untouched tasks come back as they were. */
    refine: action<{ previousLineup: DraftTask[]; instruction: string }, { tasks: DraftTask[] }>("lineup:refine"),
  },
  liveTranscribe: {
    /** One recorded segment's words while the player talks; "" when it can't be read. */
    chunk: action<{ storageId: Id<"_storage"> }, string>("liveTranscribe:chunk"),
    /** A phone's live clip as WAV bytes, skipping the upload; "" when it can't be read. */
    chunkWav: action<{ wav: ArrayBuffer }, string>("liveTranscribe:chunkWav"),
    /** Every segment in recording order, transcribed at full quality into the draft's text. */
    whole: action<{ storageIds: Id<"_storage">[] }, string>("liveTranscribe:whole"),
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
        /** Before/after: the before photo; storageId is the after. */
        beforeStorageId?: Id<"_storage">;
        /** Timelapse: how long it ran. */
        durationSec?: number;
        /** Epoch ms the shot was taken; the referee refuses one older than 15 minutes. */
        capturedAt?: number;
        /** Epoch ms of each frame, in the order of frameStorageIds. */
        frameTimes?: number[];
      },
      Verdict
    >("proofs:verify"),
  },
  canvas: {
    verify: action<{ taskId: Id<"tasks"> }, Verdict>("canvas:verify"),
  },
  drops: {
    /** Idempotent: a second RSVP is still one. */
    rsvp: mutation<{ dropId: Id<"drops"> }, null>("drops:rsvp"),
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
  demo: {
    /** Pins the player's open location check-in to these coordinates, adding one if they have none. */
    pinCheckIn: mutation<{ lat: number; lng: number }, Id<"tasks">>("demo:pinCheckIn"),
  },
} as const;
