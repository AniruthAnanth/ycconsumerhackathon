import type { ArtworkName } from "./artwork";

type Slot = "body" | "mind" | "recharge" | "chores" | "people" | "flex";

// A title keyword wins over the slot, so a tennis lesson in Mind still shows the racket.
const BY_KEYWORD: readonly [RegExp, ArtworkName][] = [
  [/tennis|racket|pickleball|padel/i, "tennis"],
  [/cook|meal|dinner|lunch|breakfast|bake|recipe|grocer/i, "cooking"],
  [/call|mom|dad|parent|grand|family|sister|brother/i, "familyCalls"],
  [/friend|hang|party|coffee with|meet up|meetup/i, "timeWithFriends"],
  [/read|book|study|learn|course|lesson|chapter/i, "readingLearning"],
  [/build|website|code|ship|make|craft|paint|draw|write|create/i, "buildingCreating"],
  [/sleep|bed|wind|meditat|stretch|yoga|journal|relax|bath/i, "windingDown"],
  [/run|gym|lift|walk|swim|bike|cycle|workout|exercise|hike|climb/i, "exercise"],
];

const BY_SLOT: Record<Slot, ArtworkName> = {
  body: "exercise",
  mind: "readingLearning",
  recharge: "windingDown",
  chores: "cooking",
  people: "timeWithFriends",
  flex: "buildingCreating",
};

/** The activity illustration for a task's hero: picked from its title, else its slot. */
export function artworkForTask(slot: Slot, title: string): ArtworkName {
  return BY_KEYWORD.find(([pattern]) => pattern.test(title))?.[1] ?? BY_SLOT[slot];
}
