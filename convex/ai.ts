/**
 * The only file that talks to OpenAI.
 *
 * It does four jobs: turn a voice note into text, turn that text into a
 * week's lineup, referee a proof, and answer any other one-off structured
 * question a module has (askJson). Each job is one function that takes plain
 * data and returns plain data, so no other module sees the SDK, and every
 * prompt sits next to the schema the model must fill.
 *
 * These are plain async helpers, not Convex functions: call them from inside
 * an action. They run in Convex's default runtime because the SDK only needs
 * fetch.
 */
import OpenAI, { APIError, toFile } from "openai";
import { ConvexError } from "convex/values";

import { env } from "./_generated/server";
import { withoutDashes, withoutDashesDeep } from "./lib/dashes";
import type { DraftTask } from "./lib/lineupRules";
import {
  CLOSE_CALL_CONFIDENCE,
  PASS_CONFIDENCE,
  VOTE_CONFIDENCE,
  type Judgement,
} from "./lib/verdict";

// The owner's choice for every text and vision call.
const MODEL = "gpt-6-luna";

// The referee's model: the strongest vision model on the key that answers a photo in about 3
// seconds (gpt-6-luna takes about 2.5). judgeProof falls back to MODEL when it fails.
const REVIEW_MODEL = "gpt-6.1-sol";

// gpt-6-luna answers "Audio input is not available", so speech goes through
// the transcription endpoint first and the model only ever sees text.
const TRANSCRIPTION_MODEL = "gpt-transcribe";

// Voice Draft's live words while the player talks: a short segment back in well under a second.
export const LIVE_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";

// Built per call, not at module load: Convex evaluates modules at deploy time,
// and a missing key must fail the one feature that needs it, not the deploy.
function client(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new ConvexError(
      "The AI referee isn't set up yet (OPENAI_API_KEY is missing).",
    );
  }
  // A player is waiting on every call, so fail fast rather than hang a screen.
  return new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    timeout: 45_000,
    maxRetries: 1,
  });
}

// ---------------------------------------------------------------------------
// Structured answers
// ---------------------------------------------------------------------------

export type JsonRequest = {
  /** Names the schema in the API call, for example "proof_judgement". Letters, digits and underscores. */
  name: string;
  /** The system prompt: who the model is and the rules it follows. */
  instructions: string;
  /** What this particular call is about. */
  text: string;
  /** Photos for the model to look at: https URLs (ctx.storage.getUrl) or data URLs. */
  imageUrls?: string[];
  /** Strict JSON Schema: every property listed in "required" and additionalProperties false. */
  schema: Record<string, unknown>;
  /** How long the model thinks before it answers. Defaults to "low". */
  effort?: "none" | "low";
  /** Defaults to MODEL. */
  model?: string;
};

// Players read what the models write, and the owner's rule is no em-dash or en-dash used as a
// dash. The prompt asks for it, and withoutDashesDeep enforces it on whatever comes back.
const NO_DASHES =
  "Never write an em-dash or an en-dash. Use a period, a comma, a colon or parentheses instead, and write a range as \"10 to 20\".";

/**
 * One call to the model that must come back as JSON matching a schema.
 * Strict structured output means the reply always parses, so callers get a
 * typed object and never have to repair model prose.
 */
export async function askJson<T>(request: JsonRequest): Promise<T> {
  const response = await client().responses.create({
    model: request.model ?? MODEL,
    // These are quick judgement calls, and low effort keeps them to a couple of seconds.
    reasoning: { effort: request.effort ?? "low" },
    instructions: `${request.instructions}\n\n${NO_DASHES}`,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: request.text },
          ...(request.imageUrls ?? []).map((url) => ({
            type: "input_image" as const,
            image_url: url,
            // "high" scales any photo down to a fixed budget of about 3,000 tokens. The default
            // reads a phone photo at full size: 14,000 tokens for 12 megapixels, and a hard
            // error ("requires 47628 patches") for a 48 megapixel one.
            detail: "high" as const,
          })),
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: request.name,
        strict: true,
        schema: request.schema,
      },
    },
  });
  if (!response.output_text) {
    throw new Error(
      `The model returned no answer (status: ${response.status}).`,
    );
  }
  return withoutDashesDeep(JSON.parse(response.output_text) as T);
}

// ---------------------------------------------------------------------------
// Voice note to text
// ---------------------------------------------------------------------------

// The transcription endpoint picks its decoder from the file name, so the
// name has to carry an extension it knows. The app records AAC in an .m4a.
const AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/mp4": "m4a",
  "audio/aac": "m4a",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
};

export async function transcribe(audio: Blob, model: string = TRANSCRIPTION_MODEL): Promise<string> {
  const extension = AUDIO_EXTENSIONS[audio.type.split(";")[0]] ?? "m4a";
  const file = await toFile(audio, `voice-note.${extension}`, { type: audio.type });
  const result = await client().audio.transcriptions.create({ file, model });
  return withoutDashes(result.text.trim());
}

// ---------------------------------------------------------------------------
// Transcript to lineup
// ---------------------------------------------------------------------------

const DRAFT_INSTRUCTIONS = `You are the draft desk for Lineup, a fantasy league for a player's own life. The player just talked for about 30 seconds about their week. Turn what they said into this week's lineup of tasks.

The roster has five slots, and a lineup needs exactly one task in each:
- body: physical fitness (gym session, a run)
- mind: school or work (finish a problem set, ship a pull request)
- recharge: destress (read for 30 minutes, a long walk)
- chores: life admin (laundry, clean the room)
- people: connection (call mom, dinner with a friend)
Anything more the player mentioned goes in the "flex" slot, at most three flex tasks. So a lineup has 5 to 8 tasks.

Rules:
- First decide whether the player named at least one thing they mean to do this week. A greeting, small talk, a question, a mic test or a remark about their mood is not a plan: return an empty tasks list, whatever the notes say.
- Use the player's own plans and wording wherever they gave them. When they said nothing for a slot, add an easy, specific task for it rather than leaving it empty.
- Every task is one concrete thing the player can prove. Split "gym twice" into one body task and one flex task.
- title: at most six words, starts with a verb or names the activity, no day of the week unless the player gave one. Examples: "Leg day at the gym", "Finish OS problem set", "Call Mom".
- points: 10 to 50 in steps of 5, by effort. 10 is trivial (take out the trash), 20 is light (call a friend), 30 is solid (a gym session, an hour of study), 40 is hard (a long run, a full problem set), 50 is a major push (a 10k race, finishing a big project).
- proofType is the easiest credible proof for the task, so proving it takes seconds:
  - "photo_location" for a task done at a place: the gym, tennis, climbing, a class, the library, church, a run route, an office. A GPS check-in there is the proof.
  - "timelapse" for a sit-still activity filmed where the player does it: reading, studying, practising an instrument, meditating, tidying a room. targetMinutes is 5 (at most 10, only when the player asked for a longer stretch).
  - "photo" for a result shown in one moment: a cooked meal, meeting friends, a call with Mom, laundry done, a made bed.
  - "screenshot" for a result that lives in an app: screen time, Duolingo, Strava, a grade, a step count.
  - "before_after" only for a change to one place that a 5-minute timelapse can't show (deep-cleaning a whole room). Otherwise use a timelapse.
  targetMinutes is null unless proofType is "timelapse".
- place is set only on a photo_location task at a specific real-world place the player named and whose coordinates you know: a named park, landmark, campus building or company office. Then give its name as the player said it, with its latitude and longitude. A generic place such as "the gym" or "the library" gets place null, and the player pins it. "The YC office" is Y Combinator's San Francisco office at 580 20th Street in the Dogpatch, 37.7608, -122.3866.
- Otherwise place is null.
- Notes about past weeks are history, not this week's plan. Use them to set difficulty: when they show a slot was missed, make that slot's task easier and worth fewer points than the player's wording alone would suggest. Never add a task only because it appears in the notes; a slot the player did not mention gets a fresh easy task. Never mention the notes in a title.`;

const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tasks"],
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["slot", "title", "points", "proofType", "place", "targetMinutes"],
        properties: {
          slot: {
            type: "string",
            enum: ["body", "mind", "recharge", "chores", "people", "flex"],
          },
          title: { type: "string" },
          points: { type: "integer" },
          proofType: { type: "string", enum: ["photo_location", "timelapse", "photo", "screenshot", "before_after"] },
          targetMinutes: { type: ["integer", "null"] },
          place: {
            anyOf: [
              {
                type: "object",
                additionalProperties: false,
                required: ["name", "lat", "lng"],
                properties: {
                  name: { type: "string" },
                  lat: { type: "number" },
                  lng: { type: "number" },
                },
              },
              { type: "null" },
            ],
          },
        },
      },
    },
  },
};

type DraftedTask = Omit<DraftTask, "place" | "proofType" | "targetMinutes"> & {
  proofType: "photo_location" | "timelapse" | "photo" | "screenshot" | "before_after";
  place: DraftTask["place"] | null;
  targetMinutes: number | null;
};

/**
 * Drafts tasks from what the player said. The result is the model's raw
 * attempt: lineup.ts runs it through shapeDraft, which is what guarantees
 * slot coverage and the points range. An empty list means the player named
 * nothing to do, and lineup.ts asks them to try again.
 */
export async function draftLineup(input: {
  transcript: string;
  /** What Supermemory recalls about this player's past weeks. May be empty. */
  memories: string[];
  /** Today's date in the player's words, for example "Sunday, November 15". */
  today: string;
}): Promise<DraftTask[]> {
  const notes =
    input.memories.length > 0
      ? `Notes about this player's past weeks:\n${input.memories.map((memory) => `- ${memory}`).join("\n")}\n\n`
      : "";
  const ask = (effort: "none" | "low") =>
    askJson<{ tasks: DraftedTask[] }>({
      name: "lineup_draft",
      instructions: DRAFT_INSTRUCTIONS,
      text: `Today is ${input.today}.\n\n${notes}The player said:\n"""\n${input.transcript}\n"""`,
      schema: DRAFT_SCHEMA,
      effort,
    });
  // The player is watching a spinner. Without reasoning a full plan is sorted into slots in about
  // 3 seconds instead of 5.5, just as well. Its one weakness is calling a thin plan ("I've got a
  // midterm Thursday") no plan at all, so an empty draft is asked again with reasoning before it
  // is believed.
  let { tasks } = await ask("none");
  if (tasks.length === 0) ({ tasks } = await ask("low"));
  return tasks.map(({ place, targetMinutes, ...task }) => ({
    ...task,
    ...(place && { place }),
    ...(targetMinutes !== null && { targetMinutes }),
  }));
}

/**
 * Applies a typed instruction ("swap chores for laundry", "make the gym task harder") to a
 * drafted lineup. Same rules and shape as draftLineup; lineup.ts holds untouched tasks to what
 * they were, so the model only has to get the changed ones right.
 */
export async function refineLineup(input: { previous: DraftTask[]; instruction: string }): Promise<DraftTask[]> {
  const ask = (effort: "none" | "low") =>
    askJson<{ tasks: DraftedTask[] }>({
      name: "lineup_refine",
      instructions: `${DRAFT_INSTRUCTIONS}

You are refining a lineup the player already has. Apply their instruction and return the whole lineup. Copy every task the instruction does not touch exactly as given: same slot, title, points, proofType, place and targetMinutes. Give a changed or new task its points, proofType and targetMinutes by the rules above.`,
      text: `Current lineup:
${JSON.stringify(input.previous)}

The player's instruction:
"""
${input.instruction}
"""`,
      schema: DRAFT_SCHEMA,
      effort,
    });
  // As with the draft, no reasoning first; an empty answer is asked again with reasoning.
  let { tasks } = await ask("none");
  if (tasks.length === 0) ({ tasks } = await ask("low"));
  return tasks.map(({ place, targetMinutes, ...task }) => ({
    ...task,
    ...(place && { place }),
    ...(targetMinutes !== null && { targetMinutes }),
  }));
}

/** Points for a flex task the player typed in, on the same 10 to 50 scale the draft uses. */
export async function rateTask(title: string): Promise<number> {
  const { points } = await askJson<{ points: number }>({
    name: "task_points",
    instructions:
      "You set the points for one task in Lineup, a league where players prove weekly tasks with a photo. " +
      "Answer 10 to 50 in steps of 5, by effort: 10 is trivial (take out the trash), 20 is light (call a friend), " +
      "30 is solid (a gym session, an hour of study), 40 is hard (a long run, a full problem set), 50 is a major push.",
    text: `Task: ${title}`,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["points"],
      properties: { points: { type: "integer" } },
    },
  });
  return points;
}

// ---------------------------------------------------------------------------
// Proof to judgement
// ---------------------------------------------------------------------------

const REFEREE_INSTRUCTIONS = `You are the referee for Lineup, a league where friends put money on finishing their own weekly tasks and prove each one with a photo taken live in the app. Decide whether this proof shows the player doing the task, or having just done it.

How to call it:
- Be a fair referee, not a detective. Nobody can photograph themselves mid-squat, and a finished problem set looks like a desk. Accept honest evidence of being there and doing it: the equipment, the place, the work in progress, the finished result, the meal, the person they met. A squat rack is fair proof of leg day, a laptop and course books are fair proof of a problem set, a washing machine or a pile of folded clothes is fair proof of laundry. The player does not need to be in the frame. Judge the kind of activity, not its fine print: a gym floor fits any workout whether or not it shows the exact exercise, and a study desk fits any assignment.
- Fail a photo that shows something unrelated to the task, that contradicts it, or that is too dark or blurred to tell what it shows.
- confidence is how sure you are that the player really did the task, from 0 to 1:
  - 0.85 to 1: what is visible fits the task directly. This is the normal score for an honest proof.
  - ${PASS_CONFIDENCE} to ${CLOSE_CALL_CONFIDENCE}: related but thin. It could be this task, and could as easily be something else.
  - ${VOTE_CONFIDENCE} to ${PASS_CONFIDENCE}: you genuinely can't tell either way. The league will vote on it.
  - under ${VOTE_CONFIDENCE}: unrelated, contradictory or unreadable.
  pass is true only when confidence is at least ${PASS_CONFIDENCE}.
- reason is the call the whole league will read: one sentence of at most 16 words that names what is actually visible and why it does or does not match. Like "Barbell rack and mirror visible, matches leg day." or "That's a cat chasing a lizard, not leg day." Never mention confidence, rules or GPS.
- highlight is 1 to 10: how impressive or entertaining this proof would be in the league feed. Most proofs are 3 to 6.
- caption is a short, dry feed caption of at most eight words. No hashtags, no emoji.
- gestureSeen: when a required gesture is given, true only if a person in the shot is clearly making it, otherwise false. A proof without its required gesture fails, and the reason says the gesture is missing. null when no gesture is required.
- flags: short tags for what is wrong, from the list in the schema; an empty list for a clean proof. The task's proof rubric below says which apply.
- sceneMatchesPlace: when a place is given, the task is a check-in and GPS has already confirmed the phone is there, so being there is the whole task. Do not look for a sign or a logo. The scene matches, with high confidence, unless it plainly shows a different kind of place (a beach for an office, a gym for a library). A desk or any indoor workspace fits an office, and a close-up that shows little of the surroundings still matches when nothing in it contradicts the place. null when no place is given.`;

/** What the referee may flag. lib/verdict.ts and proofs.ts add their own rule flags beside these. */
const JUDGEMENT_FLAGS = [
  "different_place",
  "no_change",
  "not_a_screenshot",
  "wrong_app",
  "wrong_date",
  "scene_changed",
  "not_doing_task",
  "too_short",
  "static_frames",
  "looks_edited",
] as const;

const BEFORE_AFTER_RUBRIC = [
  "Proof type: before and after. The first image is BEFORE the task, the second is AFTER.",
  'Pass only when both show the same place (the same room, furniture or fixtures; the angle may differ) and the after shows the real change the task asks for: a tidied room, folded laundry, an empty sink. Flag "different_place" when they are not the same place, and "no_change" when nothing the task asks for changed. Either one fails.',
];

function screenshotRubric(today: string): string[] {
  return [
    `Proof type: screenshot from the player's phone. Today is ${today}.`,
    'Pass only when it is a real screenshot (not a photo of a screen) from an app that plausibly proves the task (Screen Time, Duolingo, Strava, a fitness app, a grade portal), the numbers shown meet the task, and any date shown falls this week. Flag "not_a_screenshot", "wrong_app" for an unrelated app, "wrong_date" for a date outside this week, and "looks_edited" only for clear signs of tampering on the numbers that matter (a digit in a different font or size, text pasted over the interface). Compression, odd rendering or a glitchy map label is not an edit. Any of these fails. If you cannot tell whether it was edited, give confidence between 0.3 and 0.6 so the league votes.',
  ];
}

/** How a proof is judged: the task's type, or a survey video sent for a photo task. */
export type ProofMode = "photo" | "before_after" | "timelapse" | "screenshot" | "survey";

/**
 * A survey video: about 5 stills from a clip of about 5 seconds panning the place. proofs.ts has
 * already checked the frame count, the clip's length, freshness and byte-identical frames.
 */
function surveyRubric(imageCount: number): string[] {
  return [
    `Proof type: survey video. These ${imageCount} stills are in order from one clip of a few seconds, the player panning the camera across the place to show the result.`,
    "Screen it hard. Pass only when all of these hold:",
    '- The stills show one real, consistent place, the view moving the way a hand-held pan moves. Flag "scene_changed" when they look like different places.',
    '- The result the task claims is plainly visible in most stills: the made bed and clear floor, the folded laundry, the cooked meal, the gym floor. Flag "not_doing_task" otherwise.',
    '- It is a live scene, not a photo of a screen or a printed picture, and the stills are not near-identical. Flag "static_frames" for those, and "looks_edited" for stills pasted together.',
    "Any flag fails.",
    'activityFrames is how many of the stills show the claimed result. scene is what they show in at most six words, addressed to the player, like "your made bed and clear floor" or "you at the gym".',
  ];
}

/**
 * A timelapse: up to 8 stills taken across the task. This rubric is what the referee holds them
 * to; proofs.ts has already checked the frame count, the time span, frames from before the task
 * existed and byte-identical frames.
 */
function timelapseRubric(input: {
  imageCount: number;
  targetMinutes: number;
  durationSec?: number;
  frameTimes?: number[];
}): string[] {
  const minutes =
    input.durationSec !== undefined
      ? Math.round(input.durationSec / 60)
      : undefined;
  const times = input.frameTimes?.length
    ? ` They were taken at these minutes from the first: ${input.frameTimes.map((t) => Math.round((t - input.frameTimes![0]) / 60000)).join(", ")}.`
    : "";
  return [
    `Proof type: timelapse. These ${input.imageCount} stills are in time order${minutes !== undefined ? ` and span ${minutes} minutes` : ""}.${times} The task needs ${input.targetMinutes} minutes.`,
    "Screen it hard. Pass only when all of these hold:",
    '- The same person or the same scene persists across the stills. Flag "scene_changed" when they look like different places or people.',
    '- The activity in the task is visibly happening in most stills: the player there and doing it, work or the chore progressing. Flag "not_doing_task" otherwise.',
    '- The stills change the way real time passing changes things: posture, hands, pages, light, objects moving. Flag "static_frames" when they are near-identical, the same image looped or a photo of a photo. Flag "looks_edited" for stills pasted together from different shots.',
    "Any flag fails.",
    'activityFrames is how many of the stills show the activity happening. scene is what the stills show in at most six words, addressed to the player, like "you at the desk reading" or "you on the treadmill".',
  ];
}

const JUDGEMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "pass",
    "confidence",
    "reason",
    "highlight",
    "caption",
    "gestureSeen",
    "sceneMatchesPlace",
    "flags",
    "activityFrames",
    "scene",
  ],
  properties: {
    pass: { type: "boolean" },
    confidence: { type: "number" },
    reason: { type: "string" },
    highlight: { type: "integer" },
    caption: { type: "string" },
    gestureSeen: { type: ["boolean", "null"] },
    sceneMatchesPlace: { type: ["boolean", "null"] },
    flags: {
      type: "array",
      items: { type: "string", enum: [...JUDGEMENT_FLAGS] },
    },
    activityFrames: { type: "integer" },
    scene: { type: "string" },
  },
};

/**
 * Asks the vision model what a proof shows. This is the model's opinion only:
 * lib/verdict.ts applies the thresholds and the distance rule to it.
 *
 * Returns null when the model refuses the media itself (a corrupt or
 * unsupported file), which is the player's problem to fix by retaking the
 * shot. Every other failure throws, because it is ours.
 */
export async function judgeProof(input: {
  taskTitle: string;
  slot: string;
  /** The photo, the before then the after, or a timelapse's or clip's stills, oldest first. */
  imageUrls: string[];
  /** True when imageUrls are frames sampled from a short clip rather than one photo. */
  fromVideo: boolean;
  gesture?: string;
  /** The place of a check-in whose scene should fit it. Leave out for a group session. */
  placeName?: string;
  /** True for a group session's check-in, where the proof is the people who came. */
  groupSession?: boolean;
  mode: ProofMode;
  targetMinutes: number;
  durationSec?: number;
  frameTimes?: number[];
  /** Today's date in words, for a screenshot's date check. */
  today: string;
}): Promise<Judgement | null> {
  const lines = [`Task: ${input.taskTitle}`, `Roster slot: ${input.slot}`];
  if (input.gesture) lines.push(`Required gesture: ${input.gesture}`);
  if (input.placeName)
    lines.push(`Place the player must be at: ${input.placeName}`);
  if (input.groupSession) {
    lines.push(
      "This is the check-in for a group session, a meet-up the league scheduled. GPS has already confirmed the phone is at the place, so the proof is the people who came. Pass when at least one person is in the shot, wherever it was taken, and fail a shot with nobody in it. Do not judge the scenery, or whether the activity in the title is visible.",
    );
  }
  if (input.fromVideo && input.mode === "photo") {
    lines.push("These are stills from one clip of at most 10 seconds, in order. Judge them together as one proof.");
  }
  const rubric: Record<ProofMode, string[]> = {
    photo: [],
    before_after: BEFORE_AFTER_RUBRIC,
    screenshot: screenshotRubric(input.today),
    survey: surveyRubric(input.imageUrls.length),
    timelapse: timelapseRubric({ imageCount: input.imageUrls.length, ...input }),
  };
  lines.push(...rubric[input.mode]);
  const ask = (model: string) =>
    askJson<Judgement>({
      name: "proof_judgement",
      instructions: REFEREE_INSTRUCTIONS,
      text: lines.join("\n"),
      imageUrls: input.imageUrls,
      schema: JUDGEMENT_SCHEMA,
      model,
    });
  try {
    // The stronger model first. A failure that isn't about the photo (an outage, a limit on the
    // key) falls back to the everyday model, so the referee is never down while one model is.
    return await ask(REVIEW_MODEL).catch((error) => {
      if (isUnreadableImage(error)) throw error;
      console.warn(
        `${REVIEW_MODEL} failed, falling back to ${MODEL}:`,
        error instanceof Error ? error.message : error,
      );
      return ask(MODEL);
    });
  } catch (error) {
    if (isUnreadableImage(error)) {
      console.warn("The model could not read a proof:", error.message);
      return null;
    }
    throw error;
  }
}

/**
 * Whether the model turned a request down because of the photo itself: bytes that are not an
 * image, a format it can't decode, an upload it couldn't fetch. OpenAI gives these no code of
 * their own (they share "invalid_value" with every other bad field), so the test is what the
 * error points at. A 400 about our own request, such as the schema or the reasoning effort,
 * points at that field instead. It must surface as a failure, not be blamed on the player's shot.
 */
export function isUnreadableImage(error: unknown): error is APIError {
  if (!(error instanceof APIError) || error.status !== 400) return false;
  const param = error.param ?? "";
  return (
    param === "url" || param.startsWith("input") || /image/i.test(error.message)
  );
}
