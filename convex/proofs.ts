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
import { distanceMeters, isValidLatLng } from "./lib/geo";
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
};

/** The app's entry point: verifies a proof for the signed-in player. */
export const verify = action({
  args: proofArgs,
  handler: async (ctx, args): Promise<Verdict> => await runVerification(ctx, { ...args, via: "app" }),
});

/**
 * The same verification for a caller with no signed-in player: Keiki stores
 * a texted photo, works out who sent it and which task it is for, and passes
 * the user explicitly.
 */
export const verifyForUser = internalAction({
  args: { ...proofArgs, userId: v.id("users"), via: v.union(v.literal("app"), v.literal("keiki")) },
  handler: async (ctx, args): Promise<Verdict> => await runVerification(ctx, args),
});

// The model reads these image types. Anything else (HEIC from iMessage, a
// PDF) is turned away with a reason instead of an API error.
const READABLE_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
const MAX_VIDEO_FRAMES = 3;

type ProofSubmission = {
  taskId: Id<"tasks">;
  storageId: Id<"_storage">;
  mediaType: "photo" | "video";
  lat?: number;
  lng?: number;
  frameStorageIds?: Id<"_storage">[];
  /** Omitted for the app, where the caller is the signed-in player. */
  userId?: Id<"users">;
  via: "app" | "keiki";
};

async function runVerification(ctx: ActionCtx, submission: ProofSubmission): Promise<Verdict> {
  // What the model looks at: the photo itself, or the stills of a video.
  const imageIds =
    submission.mediaType === "photo"
      ? [submission.storageId]
      : (submission.frameStorageIds ?? []).slice(0, MAX_VIDEO_FRAMES);

  const { userId, task, gesture, imageTypes }: ProofContext = await ctx.runQuery(internal.proofs.context, {
    taskId: submission.taskId,
    userId: submission.userId,
    imageIds,
  });

  const rules: ProofRules = { points: task.points, gesture };
  if (task.proofType === "photo_location" && task.place) {
    const phone = { lat: submission.lat ?? Number.NaN, lng: submission.lng ?? Number.NaN };
    rules.location = {
      placeName: task.place.name,
      distanceM: isValidLatLng(phone) ? distanceMeters(phone, task.place) : null,
    };
  }

  const verdict = (await rejectionBeforeJudging(ctx, submission, rules, imageTypes)) ??
    decideVerdict(
      await judgeProof({
        taskTitle: task.title,
        slot: task.slot,
        imageUrls: await imageUrls(ctx, imageIds),
        fromVideo: submission.mediaType === "video",
        gesture,
        placeName: rules.location?.placeName,
      }).catch((error) => {
        console.error("judgeProof failed:", error instanceof Error ? error.message : error);
        throw new ConvexError("The referee couldn't be reached. Try again in a moment.");
      }),
      rules,
    );

  await ctx.runMutation(internal.proofs.record, {
    taskId: submission.taskId,
    userId,
    storageId: submission.storageId,
    mediaType: submission.mediaType,
    lat: submission.lat,
    lng: submission.lng,
    via: submission.via,
    verdict,
  });
  return verdict;
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
    // A text message carries no GPS, so a check-in can only happen in the app.
    if (submission.via === "keiki") {
      return rejectWithoutJudging(
        `Check in at ${rules.location.placeName} from the app, so your location can be confirmed.`,
      );
    }
    const problem = locationProblem(rules.location);
    if (problem) return rejectWithoutJudging(problem);
  }
  if (imageTypes.length === 0) {
    // A video that arrived without stills, which is every texted video.
    return rejectWithoutJudging(
      submission.via === "keiki"
        ? "Videos can't be checked from a text yet. Send a photo instead."
        : "That video couldn't be read. Record it again, or send a photo instead.",
    );
  }
  if (imageTypes.some((type) => type === null)) {
    return rejectWithoutJudging("That upload didn't arrive. Take the shot again.");
  }
  if (imageTypes.some((type) => type !== "" && !READABLE_IMAGE_TYPES.includes(type as string))) {
    return rejectWithoutJudging("That file type can't be checked. Send a regular photo (JPEG or PNG).");
  }
  return null;
}

async function imageUrls(ctx: ActionCtx, imageIds: Id<"_storage">[]): Promise<string[]> {
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
    if (task.proofType === "canvas") {
      throw new ConvexError("This task is verified from Canvas, not with a photo.");
    }
    const drop = task.dropId ? await ctx.db.get("drops", task.dropId) : null;
    const files = await Promise.all(args.imageIds.map((id) => ctx.db.system.get("_storage", id)));
    return {
      userId,
      task,
      gesture: drop?.gesture,
      imageTypes: files.map((file) => (file ? (file.contentType ?? "").split(";")[0].toLowerCase() : null)),
    };
  },
});

const verdictFields = v.object({
  pass: v.boolean(),
  confidence: v.number(),
  reason: v.string(),
  highlight: v.number(),
  caption: v.string(),
  points: v.number(),
  closeCall: v.boolean(),
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
    verdict: verdictFields,
  },
  handler: async (ctx, args): Promise<null> => {
    const task = await ctx.db.get("tasks", args.taskId);
    // The model takes a few seconds. If the task was verified or closed in
    // that time, this proof must not score it a second time.
    if (task === null || task.status !== "open") {
      throw new ConvexError("This task closed while the referee was looking.");
    }
    const { pass, confidence, reason, highlight, caption } = args.verdict;
    await ctx.db.insert("proofs", {
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
    });
    if (pass) {
      await ctx.db.patch("tasks", task._id, { status: "verified" });
      // Drops price their own bonuses (first finisher, group check-ins) once the task is verified.
      if (task.dropId) {
        await ctx.scheduler.runAfter(0, internal.drops.onTaskVerified, { taskId: task._id });
      }
      // A pass can carry the player past a league mate. Check-ins tells whoever was passed; it
      // is scheduled after the drop bonus above so it compares the final points.
      await ctx.scheduler.runAfter(0, internal.checkins.afterProof, { taskId: task._id });
    }
    return null;
  },
});
