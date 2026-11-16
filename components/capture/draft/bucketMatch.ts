import type { Slot } from "@/lib/slots";

/** The five buckets a lineup must cover. Flex takes anything, so it is never "mentioned". */
export type CoreSlot = Exclude<Slot, "flex">;
export const CORE_SLOTS: readonly CoreSlot[] = ["body", "mind", "recharge", "chores", "people"];

/**
 * Words that say a bucket was mentioned. A trailing "*" matches any ending (run* matches runs,
 * running), so one stem covers a verb's forms. Phrases match with any spacing between words.
 * Kept loose on purpose: a chip lighting early is a nudge, the draft itself decides the lineup.
 */
const KEYWORDS: Record<CoreSlot, string[]> = {
  body: [
    "gym", "run*", "ran", "jog*", "lift*", "yoga", "walk*", "workout*", "work out", "exercis*", "swim*",
    "bike", "biking", "cycl*", "hike", "hiking", "pushup*", "push ups", "pilates", "stretch*", "climb*",
    "tennis", "basketball", "soccer", "squat*", "cardio", "sport*", "train*", "steps",
  ],
  mind: [
    "study*", "studied", "read*", "book*", "problem set*", "pset*", "homework", "class*", "learn*",
    "lecture*", "exam*", "test", "quiz*", "essay*", "paper", "research*", "course*", "lesson*",
    "practice", "duolingo", "code", "coding", "write", "writing", "journal*", "podcast*",
  ],
  recharge: [
    "sleep*", "slept", "nap*", "meditat*", "bed", "bedtime", "relax*", "rest", "resting", "chill*",
    "bath", "spa", "unwind*", "self care", "breath*", "screen free", "offline", "day off", "recharg*",
  ],
  chores: [
    "laundry", "dishes", "clean*", "groceries", "grocery", "cook*", "vacuum*", "tidy*", "trash",
    "garbage", "chore*", "errand*", "meal prep*", "organiz*", "declutter*", "mop*", "sweep*",
    "wash*", "iron*", "bills", "fold*",
  ],
  people: [
    "mom", "mum", "dad", "parents", "call*", "friend*", "dinner with", "lunch with", "coffee with",
    "family", "brother*", "sister*", "sibling*", "grandma", "grandpa", "girlfriend", "boyfriend",
    "partner", "wife", "husband", "roommate*", "date", "text*", "visit*", "hang out", "hangout*", "party",
  ],
};

// Keywords are plain lowercase words, so they need no regex escaping.
function pattern(keyword: string): string {
  const stem = keyword.endsWith("*");
  const words = (stem ? keyword.slice(0, -1) : keyword).split(" ");
  return words.join("[\\s-]+") + (stem ? "[a-z']*" : "");
}

// Letters on either side mean the keyword is inside another word ("bed" in "described").
const MATCHERS = CORE_SLOTS.map(
  (slot) => [slot, new RegExp(`(?<![a-z])(?:${KEYWORDS[slot].map(pattern).join("|")})(?![a-z])`, "i")] as const,
);

/** The core buckets the text mentions something for, by keyword. Never includes flex. */
export function bucketsMentioned(text: string): Set<CoreSlot> {
  const found = new Set<CoreSlot>();
  for (const [slot, matcher] of MATCHERS) if (matcher.test(text)) found.add(slot);
  return found;
}
