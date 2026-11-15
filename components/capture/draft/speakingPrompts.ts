/**
 * What a week sounds like when you say it out loud. Each example names something for all five
 * slots (body, mind, people, chores, recharge), because a first-time player facing a bare
 * microphone does not know how much to say or that one sentence is enough.
 */
export const SPEAKING_PROMPTS = [
  "Gym Monday and Thursday, finish my problem set, call Mom Sunday, do laundry, read 30 minutes.",
  "Run three mornings, study for my midterm, dinner with my roommates, clean the kitchen, bed by midnight.",
  "Yoga twice, ship my side project, coffee with a friend, a grocery run, one evening with no screens.",
] as const;

/** Long enough to read an example through before the next one replaces it. */
export const PROMPT_ROTATE_MS = 6000;

/** The example for a given turn; the turns wrap around. */
export function promptAt(turn: number): string {
  const count = SPEAKING_PROMPTS.length;
  return SPEAKING_PROMPTS[((Math.trunc(turn) % count) + count) % count];
}
