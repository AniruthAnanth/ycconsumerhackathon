/** Mirrors the Slot and proofType unions in the backend contract. */
export type Slot = "body" | "mind" | "recharge" | "chores" | "people" | "flex";
export type ProofType = "photo" | "photo_location" | "canvas" | "before_after" | "timelapse" | "screenshot";

/** Roster order: the five slots a player must clear, then flex. */
export const SLOT_ORDER: readonly Slot[] = ["body", "mind", "recharge", "chores", "people", "flex"];

export const SLOT_NAME: Record<Slot, string> = {
  body: "Body",
  mind: "Mind",
  recharge: "Recharge",
  chores: "Chores",
  people: "People",
  flex: "Flex",
};

/** The word on a position pill: the full slot name, never a code, so nobody has to learn BOD or RCH. */
export const SLOT_LABEL: Record<Slot, string> = SLOT_NAME;

export const PROOF_LABEL: Record<ProofType, string> = {
  photo: "Photo",
  photo_location: "Photo + location",
  canvas: "Canvas",
  before_after: "Before and after",
  timelapse: "Timelapse",
  screenshot: "Screenshot",
};
