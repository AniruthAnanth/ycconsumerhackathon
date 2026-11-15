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
import OpenAI, { toFile } from "openai";
import { ConvexError } from "convex/values";

import { env } from "./_generated/server";
import type { DraftTask } from "./lib/lineupRules";
import type { Judgement } from "./lib/verdict";

// The owner's choice for every text and vision call.
const MODEL = "gpt-6-luna";

// gpt-6-luna answers "Audio input is not available", so speech goes through
// the transcription endpoint first and the model only ever sees text.
const TRANSCRIPTION_MODEL = "gpt-transcribe";

// Built per call, not at module load: Convex evaluates modules at deploy time,
// and a missing key must fail the one feature that needs it, not the deploy.
function client(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new ConvexError("The AI referee isn't set up yet (OPENAI_API_KEY is missing).");
  }
  // A player is waiting on every call, so fail fast rather than hang a screen.
  return new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 45_000, maxRetries: 1 });
}

// ---------------------------------------------------------------------------
// Structured answers
// ---------------------------------------------------------------------------

export type JsonRequest = {
  /** Names the schema in the API call, for example "mystery_task". Letters, digits and underscores. */
  name: string;
  /** The system prompt: who the model is and the rules it follows. */
  instructions: string;
  /** What this particular call is about. */
  text: string;
  /** Photos for the model to look at: https URLs (ctx.storage.getUrl) or data URLs. */
  imageUrls?: string[];
  /** Strict JSON Schema: every property listed in "required" and additionalProperties false. */
  schema: Record<string, unknown>;
};

/**
 * One call to the model that must come back as JSON matching a schema.
 * Strict structured output means the reply always parses, so callers get a
 * typed object and never have to repair model prose.
 */
export async function askJson<T>(request: JsonRequest): Promise<T> {
  const response = await client().responses.create({
    model: MODEL,
    // These are quick judgement calls, and low effort keeps them to a couple of seconds.
    reasoning: { effort: "low" },
    instructions: request.instructions,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: request.text },
          ...(request.imageUrls ?? []).map((url) => ({
            type: "input_image" as const,
            image_url: url,
            detail: "auto" as const,
          })),
        ],
      },
    ],
    text: {
      format: { type: "json_schema", name: request.name, strict: true, schema: request.schema },
    },
  });
  if (!response.output_text) {
    throw new Error(`The model returned no answer (status: ${response.status}).`);
  }
  return JSON.parse(response.output_text) as T;
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

export async function transcribe(audio: Blob): Promise<string> {
  const extension = AUDIO_EXTENSIONS[audio.type.split(";")[0]] ?? "m4a";
  const file = await toFile(audio, `voice-note.${extension}`, { type: audio.type });
  const result = await client().audio.transcriptions.create({ file, model: TRANSCRIPTION_MODEL });
  return result.text.trim();
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
Anything more the player mentioned goes in the "flex" slot, at most three flex tasks. So you return 5 to 8 tasks.

Rules:
- Use the player's own plans and wording wherever they gave them. When they said nothing for a slot, add an easy, specific task for it rather than leaving it empty.
- Every task is one concrete thing that can be proven with a single photo taken in the moment. Split "gym twice" into one body task and one flex task.
- title: at most six words, starts with a verb or names the activity, no day of the week unless the player gave one. Examples: "Leg day at the gym", "Finish OS problem set", "Call Mom".
- points: 10 to 50 in steps of 5, by effort. 10 is trivial (take out the trash), 20 is light (call a friend), 30 is solid (a gym session, an hour of study), 40 is hard (a long run, a full problem set), 50 is a major push (a 10k race, finishing a big project).
- proofType is "photo_location" only when the task happens at a specific real-world place the player named and whose coordinates you know: a named park, landmark, campus building or company office. Then set place to its name as the player said it, with its latitude and longitude. "The YC office" is Y Combinator's San Francisco office at Pier 70 in the Dogpatch, 37.7609, -122.3862.
- Everywhere else proofType is "photo" and place is null. Generic places such as the gym, home, a café or "the library" are "photo".
- When notes about past weeks are given, let them shape the lineup: keep habits that worked, and make a slot the player keeps skipping easier and worth fewer points. Never mention the notes in a title.`;

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
        required: ["slot", "title", "points", "proofType", "place"],
        properties: {
          slot: { type: "string", enum: ["body", "mind", "recharge", "chores", "people", "flex"] },
          title: { type: "string" },
          points: { type: "integer" },
          proofType: { type: "string", enum: ["photo", "photo_location"] },
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

type DraftedTask = Omit<DraftTask, "place"> & { place: DraftTask["place"] | null };

/**
 * Drafts tasks from what the player said. The result is the model's raw
 * attempt: lineup.ts runs it through shapeDraft, which is what guarantees
 * slot coverage and the points range.
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
  const { tasks } = await askJson<{ tasks: DraftedTask[] }>({
    name: "lineup_draft",
    instructions: DRAFT_INSTRUCTIONS,
    text: `Today is ${input.today}.\n\n${notes}The player said:\n"""\n${input.transcript}\n"""`,
    schema: DRAFT_SCHEMA,
  });
  return tasks.map(({ place, ...task }) => (place ? { ...task, place } : task));
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
- Be a fair referee, not a detective. Nobody can photograph themselves mid-squat. Accept honest evidence of being there and doing it: the equipment, the place, the finished result, the screen with the work on it, the meal, the person they met. A squat rack and a mirror is fair proof of leg day; a folded pile of clothes is fair proof of laundry.
- Fail a photo that shows something unrelated to the task, that contradicts it, or that is too dark or blurred to tell what it shows.
- confidence is how sure you are that the task was really done, from 0 to 1. 0.9 and up is clear evidence, 0.6 to 0.75 is plausible but thin, below 0.6 is not enough. pass is true only when confidence is at least 0.6.
- reason is the call the whole league will read: one sentence of at most 16 words that names what is actually visible and why it does or does not match. Like "Barbell rack and mirror visible, matches leg day." or "That's a cat chasing a lizard, not leg day." Never mention confidence, rules or the word "photo proof".
- highlight is 1 to 10: how impressive or entertaining this proof would be in the league feed. Most proofs are 3 to 6.
- caption is a short, dry feed caption of at most eight words. No hashtags, no emoji.
- gestureSeen: when a required gesture is given, true only if a person in the shot is clearly making it, otherwise false. null when no gesture is required.
- sceneMatchesPlace: when a place is given, true when the surroundings are consistent with being at that kind of place, otherwise false. GPS is checked separately, so judge only what is visible and give the benefit of the doubt to indoor shots. null when no place is given.
- When a gesture or place check fails, pass is false and the reason says so.`;

const JUDGEMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["pass", "confidence", "reason", "highlight", "caption", "gestureSeen", "sceneMatchesPlace"],
  properties: {
    pass: { type: "boolean" },
    confidence: { type: "number" },
    reason: { type: "string" },
    highlight: { type: "integer" },
    caption: { type: "string" },
    gestureSeen: { type: ["boolean", "null"] },
    sceneMatchesPlace: { type: ["boolean", "null"] },
  },
};

/**
 * Asks the vision model what a proof shows. This is the model's opinion only:
 * lib/verdict.ts applies the thresholds and the distance rule to it.
 */
export async function judgeProof(input: {
  taskTitle: string;
  slot: string;
  /** One photo, or up to three stills from a video, oldest first. */
  imageUrls: string[];
  /** True when imageUrls are frames sampled from a short clip rather than one photo. */
  fromVideo: boolean;
  gesture?: string;
  placeName?: string;
}): Promise<Judgement> {
  const lines = [`Task: ${input.taskTitle}`, `Roster slot: ${input.slot}`];
  if (input.gesture) lines.push(`Required gesture: ${input.gesture}`);
  if (input.placeName) lines.push(`Place the player must be at: ${input.placeName}`);
  if (input.fromVideo) {
    lines.push("These are stills from one clip of at most 10 seconds, in order. Judge them together as one proof.");
  }
  return await askJson<Judgement>({
    name: "proof_judgement",
    instructions: REFEREE_INSTRUCTIONS,
    text: lines.join("\n"),
    imageUrls: input.imageUrls,
    schema: JUDGEMENT_SCHEMA,
  });
}
