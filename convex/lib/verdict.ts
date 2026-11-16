/**
 * Turns what the vision model saw into the verdict a player is shown.
 *
 * The model describes the evidence; this file decides. Keeping the pass line,
 * the close-call band, the gesture rule and the 150 m rule in pure code means
 * the model can't talk its way past them, and each rule has a test.
 */
import { CHECK_IN_RADIUS_M, formatDistance } from "./geo";

/** Below this confidence a proof fails, whatever the model concluded. */
export const PASS_CONFIDENCE = 0.6;

/** Passing proofs at or below this confidence are flagged "close call" in the feed to invite a challenge. */
export const CLOSE_CALL_CONFIDENCE = 0.75;

/**
 * Below PASS_CONFIDENCE the referee isn't sure, and an unsure call is the league's to make: from
 * here up to the pass line the proof goes to a vote instead of failing. Under this line the
 * referee is sure the task wasn't done (pizza for leg day), and the proof fails outright.
 */
export const VOTE_CONFIDENCE = 0.3;

/** What the vision model reports about one proof. Nulls mean "not asked". */
export type Judgement = {
  pass: boolean;
  /** 0 to 1: how sure the model is that the task was really done. */
  confidence: number;
  reason: string;
  /** 1 to 10: how feed-worthy the proof is. Wrapped uses it to pick the best proof. */
  highlight: number;
  caption: string;
  gestureSeen: boolean | null;
  sceneMatchesPlace: boolean | null;
  /** Short tags for what the referee found wrong, such as "static_frames" or "scene_changed". */
  flags: string[];
  /** How many of a timelapse's stills show the activity happening. */
  activityFrames: number | null;
  /** What a timelapse shows, addressed to the player: "you at the desk reading". */
  scene: string | null;
};

/** What the app, the feed and Keiki receive. Matches Verdict in API.md. */
export type Verdict = {
  pass: boolean;
  confidence: number;
  reason: string;
  highlight: number;
  caption: string;
  /** Points awarded by this proof: the task's points on a pass, otherwise 0. */
  points: number;
  closeCall: boolean;
  /** Machine tags: the referee's own, plus "reused_image", "stale_capture" or "too_short" from the rules here. */
  flags?: string[];
  /** The referee wasn't sure: no points yet, the task is held and the league votes. */
  needsVote?: boolean;
};

/** The rules a particular task puts on its proof. */
export type ProofRules = {
  points: number;
  /** Quick-time drops require a random gesture in the shot, which is what makes a texted photo trustworthy. */
  gesture?: string;
  /**
   * Present for photo_location tasks. distanceM is null when the phone sent no coordinates.
   * anyScene is set for a group session: GPS places it and the photo shows who came, so a
   * meet-up on the lawn outside the pinned office is not failed for its scenery.
   */
  location?: {
    placeName: string;
    distanceM: number | null;
    anyScene?: boolean;
  };
  /** A timelapse's measured length and how many stills the referee saw. */
  timelapse?: { minutes: number; frames: number };
};

/**
 * The location half of a check-in, decided before any model call: there is no
 * point paying for a scene check when the phone is across town.
 * Returns the reason to show, or null when the phone is close enough.
 */
export function locationProblem(
  location: NonNullable<ProofRules["location"]>,
): string | null {
  if (location.distanceM === null) {
    return `Location is needed to check in at ${location.placeName}. Turn it on and retake the photo.`;
  }
  if (location.distanceM > CHECK_IN_RADIUS_M) {
    return `You're ${formatDistance(location.distanceM)} from ${location.placeName}. Check in within ${CHECK_IN_RADIUS_M} m.`;
  }
  return null;
}

/** A failed verdict reached without the model, for example too far away or media it can't read. */
export function rejectWithoutJudging(
  reason: string,
  flags: string[] = [],
): Verdict {
  return {
    pass: false,
    confidence: 0,
    reason,
    highlight: 1,
    caption: "",
    points: 0,
    closeCall: false,
    flags,
    needsVote: false,
  };
}

/**
 * Applies the rules in order of how certain they are: GPS distance, the
 * required gesture, the scene check for a place, then the model's own call
 * and confidence. The first rule that fails supplies the reason.
 */
export function decideVerdict(
  judgement: Judgement,
  rules: ProofRules,
): Verdict {
  const confidence = clamp(judgement.confidence, 0, 1);
  const highlight = Math.round(clamp(judgement.highlight, 1, 10));
  const flags = judgement.flags ?? [];
  const fail = (reason: string): Verdict => ({
    pass: false,
    confidence,
    reason,
    highlight,
    caption: judgement.caption,
    points: 0,
    closeCall: false,
    flags,
    needsVote: false,
  });

  if (rules.location) {
    const problem = locationProblem(rules.location);
    if (problem) return fail(problem);
  }

  // When the model already failed the proof its reason explains why. When it
  // passed the proof but missed a required element, its reason would read
  // like a pass, so we say what was missing instead.
  if (rules.gesture && judgement.gestureSeen !== true) {
    return fail(
      judgement.pass
        ? `Couldn't see "${rules.gesture}" in the shot. Retake it with the gesture in frame.`
        : judgement.reason,
    );
  }

  if (
    rules.location &&
    !rules.location.anyScene &&
    judgement.sceneMatchesPlace !== true
  ) {
    return fail(
      judgement.pass
        ? `This doesn't look like ${rules.location.placeName}.`
        : judgement.reason,
    );
  }

  if (confidence < VOTE_CONFIDENCE) return fail(judgement.reason);

  if (confidence < PASS_CONFIDENCE) {
    // Recorded as a pass on hold: the league's vote either lets it stand or reopens the task.
    return {
      pass: true,
      confidence,
      reason: `Sent to the league for a vote. ${judgement.reason}`,
      highlight,
      caption: judgement.caption,
      points: 0,
      closeCall: false,
      flags,
      needsVote: true,
    };
  }

  if (!judgement.pass) return fail(judgement.reason);

  let reason = judgement.reason;
  if (rules.timelapse) {
    // The post shows what the timelapse proved in numbers the league can check at a glance.
    const { minutes, frames } = rules.timelapse;
    const seen = Math.round(clamp(judgement.activityFrames ?? 0, 0, frames));
    const summary = `Timelapse ${minutes} min · ${judgement.scene?.trim() || "the task"} in ${seen}/${frames} frames`;
    if (seen * 2 <= frames)
      return {
        ...fail(`${summary}. It has to show in most of them.`),
        flags: [...flags, "not_doing_task"],
      };
    reason = summary;
  }

  return {
    pass: true,
    confidence,
    // A check-in's reason carries the distance so the feed shows both halves of the proof.
    reason:
      rules.location && rules.location.distanceM !== null
        ? `${reason} (${formatDistance(rules.location.distanceM)} from ${rules.location.placeName})`
        : reason,
    highlight,
    caption: judgement.caption,
    points: rules.points,
    closeCall: confidence <= CLOSE_CALL_CONFIDENCE,
    flags,
    needsVote: false,
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
