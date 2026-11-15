import type { OnDeviceAnalysis, OnDeviceLabel } from "../modules/on-device-referee";

/**
 * The pure half of the on-device referee: given what Apple Vision saw in a photo and the task
 * the photo is meant to prove, decide what to tell the player before the server answers.
 *
 * This is a hint, never a verdict. It leans towards "looks fine": the only cost of a wrong
 * "looks fine" is the server verification that would have run anyway, while a wrong "doesn't
 * match" puts a needless question in front of the player. So a photo is called a mismatch
 * only when Vision is confident about something that fits neither the slot nor the title.
 *
 * Label identifiers are Vision's own, from the VNClassifyImageRequest taxonomy (about 1,300
 * labels, for example "barbell", "health_club", "printed_page"). A label that is misspelled
 * here simply never matches, so keep new ones to that list.
 */

export type Slot = "body" | "mind" | "recharge" | "chores" | "people" | "flex";

/** The part of a task the pre-check reads. `gesture` is the quick-time drop's, when there is one. */
export type PrecheckTask = { slot: Slot; title: string; gesture?: string };

export type Precheck = {
  /** What Vision saw, most confident first. Empty when the pre-check did not run. */
  labels: OnDeviceLabel[];
  /** False only when the photo plainly shows something else. Never awards or blocks points. */
  likelyMatch: boolean;
  /** One line for the capture screen, or "" when there is nothing worth saying. */
  hint: string;
};

/** A label at or above this confidence counts as seen. Vision's noise sits below it. */
const SEEN = 0.15;
/** A label at or above this confidence is something the photo plainly shows. */
const PLAIN = 0.6;
/** How many labels the hint names. More than three stops reading as a glance. */
const HINT_LABELS = 3;

/** What a proof for each slot usually shows. Flex tasks can be anything, so they expect nothing. */
const SLOT_LABELS: Record<Slot, readonly string[]> = {
  body: [
    "workout", "health_club", "barbell", "dumbbell", "treadmill", "sport", "sports_equipment",
    "athletics", "gymnastics", "yoga", "martial_arts", "boxing", "kickboxing", "wrestling",
    "cycling", "bicycle", "swimming", "pool", "hiking", "rock_climbing", "trail", "path", "park",
    "sidewalk", "basketball", "soccer", "football", "baseball", "softball", "tennis", "racquet",
    "volleyball", "badminton", "golf", "hockey", "rugby", "skating", "ice_skating",
    "skateboarding", "skiing", "snowboarding", "surfing", "rafting", "kayak", "dancing", "ballet",
    "stadium", "arena", "playground", "sneaker", "footwear", "shoes", "weight_scale", "stopwatch",
    "hurdle", "trampoline", "ball", "ballgames", "watersport", "winter_sport",
  ],
  mind: [
    "book", "bookshelf", "library", "document", "printed_page", "handwriting", "newspaper",
    "magazine", "laptop", "computer", "computer_keyboard", "computer_monitor", "screenshot",
    "phone", "chalkboard", "whiteboard", "flipchart", "classroom", "auditorium", "conference",
    "desk", "pen", "calculator", "diagram", "chart", "map", "calendar", "sticky_note",
    "office_supplies", "chess", "puzzles", "jigsaw", "board_game", "piano", "guitar", "violin",
    "musical_instrument", "headphones", "museum", "easel", "painting", "paintbrush", "microscope",
  ],
  recharge: [
    "bed", "bedroom", "bedding", "pillow", "sofa", "living_room", "hammock", "bath", "jacuzzi",
    "candle", "fireplace", "tea_drink", "coffee", "mug", "cup", "book", "yoga", "headphones",
    "television", "park", "garden", "forest", "beach", "ocean", "lake", "river", "waterfall",
    "mountain", "trail", "hiking", "camping", "tent", "sunset_sunrise", "night_sky", "tree",
    "flower", "grass", "outdoor", "bench", "patio", "deck", "balcony", "sunbathing", "dog", "cat",
  ],
  chores: [
    "laundry_machine", "clothesline", "clothespin", "iron_clothing", "clothing", "closet",
    "vacuum", "broom", "mop", "bucket", "trash_can", "dishwasher", "kitchen", "kitchen_room",
    "kitchen_sink", "kitchen_faucet", "kitchen_countertop", "kitchen_oven", "stove", "oven",
    "microwave", "refrigerator", "cookware", "pot_cooking", "pan", "cutting_board", "tableware",
    "plate", "food", "shopping_cart", "interior_shop", "storefront", "receipt", "paper_bag",
    "cardboard_box", "bed", "bedding", "bedroom", "living_room", "bathroom", "bathroom_room",
    "bathroom_faucet", "toilet_seat", "washbasin", "shower", "cabinet", "bookshelf", "desk",
    "toolbox", "tool", "mower", "rake", "watering_can", "garden", "car", "automobile", "garage",
    "mailbox", "envelope", "document", "printed_page", "laptop", "calculator", "credit_card",
    "checkbook",
  ],
  people: [
    "people", "adult", "teen", "child", "baby", "crowd", "restaurant", "bar", "coffee", "drink",
    "cocktail", "beer", "wine", "food", "table", "tableware", "dining_room", "living_room",
    "sofa", "celebration", "birthday_cake", "wedding", "concert", "performance", "karaoke",
    "nightclub", "bowling", "billiards", "stadium", "park", "board_game", "games", "play_card",
    "gift", "phone", "screenshot", "envelope", "handwriting",
  ],
  flex: [],
};

/**
 * Words in a task title and what a proof of them tends to show. A word matches the start of
 * any title word, so "run" also covers "running". These only ever widen what is expected,
 * which is the safe direction: a title the table doesn't know costs nothing.
 */
const TITLE_LABELS: readonly { words: readonly string[]; labels: readonly string[] }[] = [
  { words: ["gym", "lift", "leg day", "squat", "deadlift", "bench", "weights", "strength", "workout", "push", "pull", "plank", "burpee", "sit up", "abs"],
    labels: ["barbell", "dumbbell", "health_club", "workout", "sports_equipment", "treadmill", "sport", "gymnastics"] },
  { words: ["run", "jog", "5k", "10k", "mile", "walk", "steps", "hike"],
    labels: ["treadmill", "athletics", "sneaker", "footwear", "shoes", "road", "street", "sidewalk", "path", "trail", "park", "hiking", "forest", "mountain", "outdoor", "stopwatch", "watch", "screenshot"] },
  { words: ["yoga", "stretch", "pilates", "meditat", "breath"],
    labels: ["yoga", "workout", "health_club", "candle", "headphones", "living_room", "bedroom", "phone", "screenshot"] },
  { words: ["swim", "pool", "laps"], labels: ["swimming", "pool", "water", "swimsuit", "goggles"] },
  { words: ["bike", "cycl", "ride", "spin"], labels: ["bicycle", "cycling", "helmet", "road", "path"] },
  { words: ["read", "book", "chapter", "pages"],
    labels: ["book", "bookshelf", "library", "printed_page", "document", "magazine", "newspaper", "screenshot"] },
  { words: ["study", "homework", "assignment", "problem set", "pset", "essay", "exam", "notes", "flashcard", "lecture", "class", "course", "paper", "quiz"],
    labels: ["book", "document", "printed_page", "handwriting", "laptop", "computer", "computer_keyboard", "computer_monitor", "screenshot", "desk", "pen", "chalkboard", "whiteboard", "classroom", "library", "calculator", "sticky_note", "diagram", "chart"] },
  { words: ["code", "coding", "leetcode", "ship", "write", "blog", "journal", "email", "inbox", "bills", "taxes", "budget", "paperwork", "apply", "resume"],
    labels: ["laptop", "computer", "computer_keyboard", "computer_monitor", "screenshot", "document", "printed_page", "handwriting", "pen", "desk", "envelope", "receipt", "calculator", "phone"] },
  { words: ["sleep", "nap", "bed", "lights out", "wake"],
    labels: ["bed", "bedroom", "bedding", "pillow", "clock", "timepiece", "lamp", "night_sky", "screenshot", "phone"] },
  { words: ["laundry", "fold", "iron"],
    labels: ["laundry_machine", "clothesline", "clothespin", "clothing", "textile", "iron_clothing", "closet", "bedding"] },
  { words: ["dish", "kitchen"],
    labels: ["dishwasher", "kitchen_sink", "kitchen_faucet", "kitchen", "kitchen_room", "kitchen_countertop", "tableware", "plate", "bowl", "cookware", "drinking_glass", "utensil"] },
  { words: ["clean", "tidy", "vacuum", "mop", "sweep", "scrub", "declutter", "organize", "organise", "room", "desk"],
    labels: ["vacuum", "broom", "mop", "bucket", "interior_room", "living_room", "bedroom", "bed", "bathroom", "bathroom_room", "kitchen", "kitchen_room", "toilet_seat", "washbasin", "shower", "desk", "closet", "cabinet", "bookshelf", "furniture"] },
  { words: ["trash", "garbage", "recycl", "bins"], labels: ["trash_can", "cardboard_box", "paper_bag", "bag", "container"] },
  { words: ["grocer", "shop", "errand", "market", "costco"],
    labels: ["shopping_cart", "interior_shop", "storefront", "receipt", "food", "fruit", "vegetable", "paper_bag", "bag", "refrigerator"] },
  { words: ["cook", "meal", "dinner", "lunch", "breakfast", "brunch", "bake", "eat", "protein", "salad"],
    labels: ["food", "cookware", "pot_cooking", "pan", "stove", "oven", "kitchen", "kitchen_room", "cutting_board", "plate", "bowl", "tableware", "restaurant", "table"] },
  { words: ["coffee", "tea", "drinks", "beer", "boba"],
    labels: ["coffee", "tea_drink", "cup", "mug", "drink", "beer", "cocktail", "bubble_tea", "restaurant", "bar", "table"] },
  { words: ["call", "text", "facetime", "phone", "message"], labels: ["phone", "screenshot", "people", "adult", "laptop"] },
  { words: ["dog", "puppy", "cat", "pet", "vet"], labels: ["dog", "canine", "cat", "feline", "leash", "park", "animal"] },
  { words: ["plant", "garden", "water the", "flowers", "yard", "lawn", "mow"],
    labels: ["plant", "decorative_plant", "watering_can", "garden", "flower", "foliage", "grass", "mower", "rake"] },
  { words: ["car", "oil change", "tires", "gas"], labels: ["car", "automobile", "vehicle", "garage", "tire", "wheel", "dashboard"] },
  { words: ["water", "hydrate"], labels: ["bottle", "drinking_glass", "water", "cup", "thermos", "jug"] },
  { words: ["piano", "guitar", "practice", "music"],
    labels: ["piano", "guitar", "musical_instrument", "string_instrument", "music", "headphones"] },
  { words: ["floss", "teeth", "skincare", "shower", "vitamin", "meds"],
    labels: ["bathroom", "bathroom_room", "washbasin", "shower", "cosmetic_tool", "medicine", "bottle"] },
];

/** A person in frame could be doing any task, so these never count as "something else". */
const PERSON_LABELS = new Set(["people", "adult", "teen", "child", "baby", "crowd"]);

/** True of nearly every photo, so they say nothing about a mismatch and make dull hints. */
const BROAD_LABELS = new Set([
  "outdoor", "interior_room", "structure", "building", "domicile", "material", "textile",
  "daytime", "sky", "blue_sky", "cloudy", "haze", "land", "liquid", "water", "machine",
  "container", "furniture", "housewares", "tool", "conveyance", "animal", "mammal", "plant",
  "foliage", "vegetation", "tree", "grass", "wood_processed", "wood_natural", "raw_glass",
  "polka_dots", "decoration", "light", "media", "frame", "illustrations", "art", "recreation",
  "consumer_electronics", "appliance", "clothing", "window", "door", "road", "street", "sign",
]);

/** Vision's identifiers are written for machines; these read better in a hint. */
const DISPLAY_NAMES: Record<string, string> = {
  health_club: "gym",
  interior_room: "indoors",
  interior_shop: "shop",
  outdoor: "outdoors",
  people: "person",
  adult: "person",
  computer_keyboard: "keyboard",
  computer_monitor: "monitor",
  kitchen_room: "kitchen",
  bathroom_room: "bathroom",
  laundry_machine: "washing machine",
  sports_equipment: "sports gear",
  tea_drink: "tea",
  pot_cooking: "cooking pot",
  footwear: "shoes",
  sneaker: "sneakers",
  timepiece: "clock",
  iron_clothing: "iron",
};

/** Every label a proof of this task could reasonably show: the slot's, plus the title's. */
export function expectedLabels(task: PrecheckTask): Set<string> {
  const expected = new Set<string>(SLOT_LABELS[task.slot] ?? []);
  // Padded with spaces so a word matches only at the start of a title word.
  const title = ` ${task.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  for (const entry of TITLE_LABELS) {
    if (entry.words.some((word) => title.includes(` ${word}`))) {
      entry.labels.forEach((label) => expected.add(label));
    }
  }
  return expected;
}

/**
 * How many extended fingers a gesture asks for ("three fingers up" is 3), or null when the
 * gesture isn't a finger count. The thumb counts as a finger, as it does in the Swift module.
 */
export function fingersWanted(gesture: string): number | null {
  const text = gesture.toLowerCase();
  if (/peace|v sign/.test(text)) return 2;
  if (/thumbs? up/.test(text)) return 1;
  if (/open palm|high five/.test(text)) return 5;
  const counted = text.match(/\b(one|two|three|four|five|[1-5])\s+fingers?\b/);
  if (!counted) return null;
  return ["one", "two", "three", "four", "five"].indexOf(counted[1]) + 1 || Number(counted[1]);
}

/** Turns one Vision analysis into the line the capture screen shows for this task. */
export function judgePhoto(
  analysis: Pick<OnDeviceAnalysis, "labels" | "people" | "fingersUp">,
  task: PrecheckTask,
): Precheck {
  const labels = analysis.labels.filter((label) => label.confidence >= SEEN);
  const expected = expectedLabels(task);
  const fits = (label: OnDeviceLabel) => expected.has(label.identifier);
  const isPerson = (label: OnDeviceLabel) => PERSON_LABELS.has(label.identifier);
  const isBroad = (label: OnDeviceLabel) => BROAD_LABELS.has(label.identifier);

  // Hint order: what fits the task first, then anything specific, then a person, then filler.
  const rank = (label: OnDeviceLabel) => {
    if (isBroad(label)) return 3;
    if (isPerson(label)) return 2;
    return fits(label) ? 0 : 1;
  };
  const named = [...labels].sort((a, b) => rank(a) - rank(b) || b.confidence - a.confidence).map(displayName);
  const seen = [...new Set(named)].slice(0, HINT_LABELS);

  const gesture = readGesture(analysis.fingersUp, task.gesture);
  if (gesture) {
    seen.unshift(gesture.seen);
  }
  if (seen.length === 0) {
    return { labels, likelyMatch: true, hint: "" };
  }
  const read = `On-device: ${seen.join(", ")}.`;

  if (gesture?.missing) {
    return { labels, likelyMatch: false, hint: `${read} The drop asks for ${task.gesture}.` };
  }

  const personInFrame = (analysis.people ?? 0) > 0 || labels.some(isPerson);
  const plainlySomethingElse =
    expected.size > 0 &&
    !personInFrame &&
    !labels.some(fits) &&
    labels.some((label) => label.confidence >= PLAIN && !isBroad(label));
  if (plainlySomethingElse) {
    return { labels, likelyMatch: false, hint: `${read} That doesn't look like "${task.title}".` };
  }
  return { labels, likelyMatch: true, hint: read };
}

/**
 * What to say about a finger-count gesture, or null when there is nothing to check: no
 * gesture, a gesture that isn't a finger count, or hand detection that did not run. Only a
 * photo with no hand at all is called missing. A different count is shown but not treated
 * as a mismatch, because counting fingers from one still photo is approximate.
 */
function readGesture(fingersUp: number[] | undefined, gesture: string | undefined) {
  if (!gesture || !fingersUp) return null;
  const wanted = fingersWanted(gesture);
  if (wanted === null) return null;
  if (fingersUp.length === 0) return { seen: "no hand in the photo", missing: true };
  const count = fingersUp.includes(wanted) ? wanted : Math.max(...fingersUp);
  return { seen: `${count} ${count === 1 ? "finger" : "fingers"} up`, missing: false };
}

function displayName(label: OnDeviceLabel): string {
  return DISPLAY_NAMES[label.identifier] ?? label.identifier.replace(/_/g, " ");
}
