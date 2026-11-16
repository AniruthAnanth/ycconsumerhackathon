/**
 * Proofs: a player submits a photo or a short video for a task and the AI
 * referee rules on it.
 *
 * One path serves the app and Keiki. The model describes what it sees
 * (ai.ts), pure code decides (lib/verdict.ts), and one mutation writes the
 * proof row and scores the task. A failed proof leaves the task open, so the
 * player can try again any time before the week ends.
 */
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  type ActionCtx,
} from "./_generated/server";
import { judgeProof } from "./ai";
import { requireUser } from "./lib/auth";
import { MAX_CLIP_SECONDS, clipSeconds, isClipTooLong } from "./lib/clip";
import { distanceMeters, isValidLatLng } from "./lib/geo";
import { DEFAULT_TARGET_MINUTES } from "./lib/lineupRules";
import { verdictReached } from "./lib/notificationContent";
import {
  decideVerdict,
  locationProblem,
  rejectWithoutJudging,
  type ProofRules,
  type Verdict,
} from "./lib/verdict";

/** The upload URL for proof media. Voice Draft uses it for its recording too. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

const proofArgs = {
  taskId: v.id("tasks"),
  /** The photo, or the whole video clip so the feed can play it. */
  storageId: v.id("_storage"),
  mediaType: v.union(v.literal("photo"), v.literal("video")),
  /** Where the phone was when the shutter fired. Needed for check-in tasks. */
  lat: v.optional(v.number()),
  lng: v.optional(v.number()),
  /**
   * For a video: up to three JPEG stills from the clip, in order. The model
   * can't take video on our OpenAI account and a Convex action can't cut
   * frames, so the app samples them before upload.
   */
  frameStorageIds: v.optional(v.array(v.id("_storage"))),
  /** Before/after: the before photo. storageId is the after photo. */
  beforeStorageId: v.optional(v.id("_storage")),
  /** Timelapse: seconds between the first and the last still. */
  durationSec: v.optional(v.number()),
  /** Epoch ms when the shot was taken (a timelapse's last still). Falls back to upload time. */
  capturedAt: v.optional(v.number()),
  /** Timelapse: epoch ms of each still, in the order of frameStorageIds. */
  frameTimes: v.optional(v.array(v.number())),
};

/** The app's entry point: verifies a proof for the signed-in player. */
export const verify = action({
  args: proofArgs,
  handler: async (ctx, args): Promise<Verdict> =>
    await runVerification(ctx, { ...args, via: "app" }),
});

/**
 * The same verification for a caller with no signed-in player: Keiki stores
 * a texted photo, works out who sent it and which task it is for, and passes
 * the user explicitly.
 */
export const verifyForUser = internalAction({
  args: {
    ...proofArgs,
    userId: v.id("users"),
    via: v.union(v.literal("app"), v.literal("keiki")),
  },
  handler: async (ctx, args): Promise<Verdict> =>
    await runVerification(ctx, args),
});

// The model reads these image types. Anything else (HEIC from iMessage, a
// PDF) is turned away with a reason instead of an API error.
const READABLE_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

type ProofSubmission = {
  taskId: Id<"tasks">;
  storageId: Id<"_storage">;
  mediaType: "photo" | "video";
  lat?: number;
  lng?: number;
  frameStorageIds?: Id<"_storage">[];
  beforeStorageId?: Id<"_storage">;
  durationSec?: number;
  capturedAt?: number;
  frameTimes?: number[];
  /** Omitted for the app, where the caller is the signed-in player. */
  userId?: Id<"users">;
  via: "app" | "keiki";
};

async function runVerification(
  ctx: ActionCtx,
  submission: ProofSubmission,
): Promise<Verdict> {
  const imageIds = timelapseFrames(submission);

  const {
    userId,
    task,
    gesture,
    imageTypes,
    imageHashes,
    reusedImage,
  }: ProofContext = await ctx.runQuery(internal.proofs.context, {
    taskId: submission.taskId,
    userId: submission.userId,
    imageIds,
  });

  // A group session is proven by GPS and by who is in the photo (drops.ts then counts them), so
  // its scene is not held to the pinned place: a stand-up on the lawn outside the office counts.
  const groupSession = task.source === "group";
  const rules: ProofRules = { points: task.points, gesture };
  if (task.place) {
    const phone = {
      lat: submission.lat ?? Number.NaN,
      lng: submission.lng ?? Number.NaN,
    };
    rules.location = {
      placeName: task.place.name,
      distanceM: isValidLatLng(phone)
        ? distanceMeters(phone, task.place)
        : null,
      anyScene: groupSession,
    };
  }

  let verdict =
    (await rejectionBeforeJudging(ctx, submission, rules, imageTypes)) ??
    antiCheatRejection(task, submission, imageIds, imageHashes, reusedImage);
  if (verdict === null) {
    const seconds = timelapseSeconds(submission) ?? 0;
    rules.footage = {
      label: isSurvey(submission) ? `Survey video ${Math.round(seconds)} s` : `Timelapse ${Math.round(seconds / 60)} min`,
      frames: imageIds.length,
    };
    const judgement = await judgeProof({
      taskTitle: task.title,
      slot: task.slot,
      imageUrls: await imageUrls(ctx, imageIds),
      fromVideo: submission.mediaType === "video",
      gesture,
      placeName: groupSession ? undefined : rules.location?.placeName,
      groupSession,
      survey: isSurvey(submission),
      targetMinutes: targetMinutes(task),
      durationSec: timelapseSeconds(submission),
      frameTimes: submission.frameTimes,
    }).catch((error) => {
      console.error(
        "judgeProof failed:",
        error instanceof Error ? error.message : error,
      );
      throw new ConvexError(
        "The referee couldn't be reached. Try again in a moment.",
      );
    });
    verdict = judgement
      ? decideVerdict(judgement, rules)
      : rejectWithoutJudging("That shot couldn't be read. Take it again.");
  }

  await ctx.runMutation(internal.proofs.record, {
    taskId: submission.taskId,
    userId,
    storageId: submission.storageId,
    mediaType: submission.mediaType,
    lat: submission.lat,
    lng: submission.lng,
    via: submission.via,
    beforeStorageId: submission.beforeStorageId,
    imageHashes,
    verdict,
  });
  return verdict;
}

// Every proof is a timelapse or a survey video (the owner's call): up to 8 stills from it.
const MAX_TIMELAPSE_FRAMES = 8;
// A survey video is a few seconds of panning; anything longer is judged as a timelapse.
const SURVEY_MIN_SECONDS = 3;
const SURVEY_MAX_SECONDS = 15;
const MIN_TIMELAPSE_FRAMES = 3;
// The app captures and submits within seconds; anything older was taken some other time.
const STALE_CAPTURE_MS = 15 * 60 * 1000;
// The stills must span at least this share of the task's minutes.
const TIMELAPSE_COVERAGE = 0.8;
const targetMinutes = (task: Doc<"tasks">): number =>
  task.targetMinutes ?? DEFAULT_TARGET_MINUTES;

/** What the model looks at: the timelapse's stills, or the one image sent when there are none. */
function timelapseFrames(submission: ProofSubmission): Id<"_storage">[] {
  const frames = submission.frameStorageIds ?? [];
  return frames.length > 0
    ? frames.slice(0, MAX_TIMELAPSE_FRAMES)
    : [submission.storageId];
}

/**
 * Judged by what was sent, not by the task's type: the capture screen offers both, so a short clip
 * is a survey video even on a timelapse task.
 */
function isSurvey(submission: ProofSubmission): boolean {
  const seconds = timelapseSeconds(submission);
  return submission.mediaType === "video" && seconds !== undefined && seconds <= SURVEY_MAX_SECONDS;
}

/** A timelapse's elapsed seconds: as the app measured it, else from the first and last still's times. */
function timelapseSeconds(submission: ProofSubmission): number | undefined {
  if (submission.durationSec !== undefined) return submission.durationSec;
  const times = submission.frameTimes;
  return times && times.length > 1
    ? (times[times.length - 1] - times[0]) / 1000
    : undefined;
}

/**
 * The rules that catch a recycled proof before the model is paid to look at it: an image the
 * player already used, a shot from earlier in the day, and the shape each proof type needs.
 */
function antiCheatRejection(
  task: Doc<"tasks">,
  submission: ProofSubmission,
  imageIds: Id<"_storage">[],
  imageHashes: string[],
  reusedImage: boolean,
): Verdict | null {
  if (reusedImage) {
    return rejectWithoutJudging(
      "That photo was already used for an earlier proof. Take a new one.",
      ["reused_image"],
    );
  }
  if (
    submission.capturedAt !== undefined &&
    Date.now() - submission.capturedAt > STALE_CAPTURE_MS
  ) {
    return rejectWithoutJudging(
      "That shot was taken too long ago. Take it again now.",
      ["stale_capture"],
    );
  }
  if (new Set(imageHashes).size < imageHashes.length) {
    return rejectWithoutJudging(
      "Some of those frames are the same image. Record it again.",
      ["static_frames"],
    );
  }
  const firstFrame = submission.frameTimes?.[0];
  if (firstFrame !== undefined && firstFrame < task._creationTime) {
    return rejectWithoutJudging(
      "That was recorded before this task was on your lineup. Record a new one.",
      ["stale_capture"],
    );
  }
  const seconds = timelapseSeconds(submission);
  if (isSurvey(submission)) {
    return seconds! < SURVEY_MIN_SECONDS
      ? rejectWithoutJudging(`That clip is too short. Pan across the place for about 5 seconds.`, ["too_short"])
      : null;
  }
  const target = targetMinutes(task);
  if (seconds === undefined || seconds < target * 60 * TIMELAPSE_COVERAGE) {
    const covered =
      seconds === undefined ? "no time" : `${Math.round(seconds / 60)} minutes`;
    return rejectWithoutJudging(
      `That timelapse covers ${covered}; this task needs ${target}.`,
      ["too_short"],
    );
  }
  return null;
}

/**
 * The cases decided without paying for a model call: the phone is too far
 * from the place, or there is nothing the model can read. Returns null when
 * the proof should go to the referee.
 */
async function rejectionBeforeJudging(
  ctx: ActionCtx,
  submission: ProofSubmission,
  rules: ProofRules,
  imageTypes: (string | null)[],
): Promise<Verdict | null> {
  if (rules.location) {
    // A text message carries no GPS. Keiki passes the player's last in-app arrival when there
    // is one within the hour (checkins.recentArrival); without it the check-in happens in the app.
    if (submission.via === "keiki" && rules.location.distanceM === null) {
      return rejectWithoutJudging(
        `Check in at ${rules.location.placeName} from the app, so your location can be confirmed.`,
      );
    }
    const problem = locationProblem(rules.location);
    if (problem) return rejectWithoutJudging(problem);
  }
  if (imageTypes.length < MIN_TIMELAPSE_FRAMES) {
    // One photo or a clip with no stills, which is everything texted to Keiki.
    return rejectWithoutJudging(
      "Proofs are a timelapse or a survey video now. Record one in the app.",
      ["too_short"],
    );
  }
  if (imageTypes.some((type) => type === null)) {
    return rejectWithoutJudging(
      "That upload didn't arrive. Take the shot again.",
    );
  }
  if (submission.mediaType === "video") {
    // The app's recorder stops at 10 seconds; this holds any other client to the same limit.
    const clip = await ctx.storage.get(submission.storageId);
    if (
      clip !== null &&
      isClipTooLong(clipSeconds(new Uint8Array(await clip.arrayBuffer())))
    ) {
      return rejectWithoutJudging(
        `Clips can be up to ${MAX_CLIP_SECONDS} seconds. Record a shorter one.`,
      );
    }
  }
  if (
    imageTypes.some(
      (type) => type !== "" && !READABLE_IMAGE_TYPES.includes(type as string),
    )
  ) {
    return rejectWithoutJudging(
      "That file type can't be checked. Send a regular photo (JPEG or PNG).",
    );
  }
  return null;
}

async function imageUrls(
  ctx: ActionCtx,
  imageIds: Id<"_storage">[],
): Promise<string[]> {
  const urls = await Promise.all(imageIds.map((id) => ctx.storage.getUrl(id)));
  return urls.filter((url): url is string => url !== null);
}

// ---------------------------------------------------------------------------
// Database halves of a verification (actions can't touch the database)
// ---------------------------------------------------------------------------

type ProofContext = {
  userId: Id<"users">;
  task: Doc<"tasks">;
  /** The gesture a quick-time drop demands in the shot. */
  gesture?: string;
  /** Content type of each image, "" when the upload declared none, null when the file is missing. */
  imageTypes: (string | null)[];
  /** sha256 of each image, as the file store recorded it. */
  imageHashes: string[];
  /** One of the images is byte for byte an image from one of the player's earlier proofs. */
  reusedImage: boolean;
};

const NOT_OPEN: Record<Exclude<Doc<"tasks">["status"], "open">, string> = {
  verified: "This task is already verified.",
  held: "This proof is under review by the league.",
  failed: "This task has closed.",
};

/** Everything a verification needs to know before it looks at the media. */
export const context = internalQuery({
  args: {
    taskId: v.id("tasks"),
    userId: v.optional(v.id("users")),
    imageIds: v.array(v.id("_storage")),
  },
  handler: async (ctx, args): Promise<ProofContext> => {
    const userId = args.userId ?? (await requireUser(ctx))._id;
    const task = await ctx.db.get("tasks", args.taskId);
    if (task === null || task.userId !== userId) {
      throw new ConvexError("That task isn't on your lineup.");
    }
    if (task.status !== "open") throw new ConvexError(NOT_OPEN[task.status]);
    const drop = task.dropId ? await ctx.db.get("drops", task.dropId) : null;
    const files = await Promise.all(
      args.imageIds.map((id) => ctx.db.system.get("_storage", id)),
    );
    // Identical bytes, not a look-alike: the same file re-sent or re-uploaded from the camera roll.
    const imageHashes = files.flatMap((file) => (file ? [file.sha256] : []));
    const earlier = await ctx.db
      .query("proofs")
      .withIndex("by_user_week", (q) => q.eq("userId", userId))
      .order("desc")
      .take(1000);
    return {
      userId,
      task,
      gesture: drop?.gesture,
      imageTypes: files.map((file) =>
        file ? (file.contentType ?? "").split(";")[0].toLowerCase() : null,
      ),
      imageHashes,
      // Only an image that already scored (or waits on a vote) counts as used: a player whose
      // proof failed may send the same shots again once they fix what was wrong.
      reusedImage: earlier.some(
        (proof) =>
          proof.pass &&
          proof.imageHashes?.some((hash) => imageHashes.includes(hash)),
      ),
    };
  },
});

export const verdictFields = v.object({
  pass: v.boolean(),
  confidence: v.number(),
  reason: v.string(),
  highlight: v.number(),
  caption: v.string(),
  points: v.number(),
  closeCall: v.boolean(),
  flags: v.optional(v.array(v.string())),
  needsVote: v.optional(v.boolean()),
});

/**
 * Writes the proof row and, on a pass, scores the task. Both happen in one
 * transaction so standings (computed from tasks and proofs) can never see a
 * verified task without its proof.
 */
export const record = internalMutation({
  args: {
    taskId: v.id("tasks"),
    userId: v.id("users"),
    storageId: v.id("_storage"),
    mediaType: v.union(v.literal("photo"), v.literal("video")),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    via: v.union(v.literal("app"), v.literal("keiki")),
    beforeStorageId: v.optional(v.id("_storage")),
    imageHashes: v.optional(v.array(v.string())),
    verdict: verdictFields,
  },
  handler: async (ctx, args): Promise<null> => {
    const task = await ctx.db.get("tasks", args.taskId);
    // The model takes a few seconds. If the task was verified or closed in
    // that time, this proof must not score it a second time.
    if (task === null || task.status !== "open") {
      throw new ConvexError("This task closed while the referee was looking.");
    }
    const { pass, confidence, reason, highlight, caption, flags, needsVote } =
      args.verdict;
    const proofId = await ctx.db.insert("proofs", {
      taskId: task._id,
      userId: args.userId,
      weekStart: task.weekStart,
      storageId: args.storageId,
      mediaType: args.mediaType,
      lat: args.lat,
      lng: args.lng,
      pass,
      confidence,
      reason,
      highlight,
      caption,
      via: args.via,
      createdAt: Date.now(),
      beforeStorageId: args.beforeStorageId,
      imageHashes: args.imageHashes,
      flags,
      ...(needsVote && { needsVote: true }),
    });
    if (needsVote) {
      // The referee wasn't sure, so the league decides. The task is held, scoring nothing, until
      // challenges.ts settles the vote: the proof stands or the task reopens.
      await ctx.db.patch("tasks", task._id, { status: "held" });
      await ctx.scheduler.runAfter(0, internal.challenges.refereeVote, {
        proofId,
      });
      return null;
    }
    // The prover hears the call, pass or fail, on a phone where the app is closed: a proof
    // texted to the league agent, or one the referee was still judging when they left. Scheduled
    // rather than called, like the follow-ups below, so a push can never undo a proof.
    await ctx.scheduler.runAfter(0, internal.push.send, {
      userId: args.userId,
      notification: verdictReached({
        taskId: task._id,
        title: task.title,
        points: task.points,
        pass,
        reason,
      }),
    });
    if (pass) {
      await ctx.db.patch("tasks", task._id, { status: "verified" });
      // Drops price their own bonuses (first finisher, group check-ins) once the task is verified.
      if (task.dropId) {
        await ctx.scheduler.runAfter(0, internal.drops.onTaskVerified, {
          taskId: task._id,
        });
      }
      // The league is texted when this proof changes who is in front. Both follow-ups are
      // scheduled rather than called, so a problem in either can never undo a verified proof.
      await ctx.scheduler.runAfter(0, internal.leadChange.afterProof, {
        userId: args.userId,
      });
      // A pass can carry the player past a league mate. Check-ins tells whoever was passed; it
      // is scheduled after the drop bonus above so it compares the final points.
      await ctx.scheduler.runAfter(0, internal.checkins.afterProof, {
        taskId: task._id,
      });
      // Leaderboards keep a stored copy of each player's week; this rebuilds theirs.
      await ctx.scheduler.runAfter(0, internal.leaderboards.refresh, {
        userId: args.userId,
        weekStart: task.weekStart,
      });
    }
    return null;
  },
});
