/** Mirrors the Slot and proofType unions in the backend contract. */
export type Slot = "body" | "mind" | "recharge" | "chores" | "people" | "flex";
export type ProofType = "photo" | "photo_location" | "canvas";

/** Roster order: the five slots a player must clear, then flex. */
export const SLOT_ORDER: readonly Slot[] = ["body", "mind", "recharge", "chores", "people", "flex"];

/** Three-letter position codes, as ESPN shows QB, RB, WR. */
export const SLOT_LABEL: Record<Slot, string> = {
  body: "BOD",
  mind: "MND",
  recharge: "RCH",
  chores: "CHR",
  people: "PPL",
  flex: "FLX",
};

export const SLOT_NAME: Record<Slot, string> = {
  body: "Body",
  mind: "Mind",
  recharge: "Recharge",
  chores: "Chores",
  people: "People",
  flex: "Flex",
};

export const PROOF_LABEL: Record<ProofType, string> = {
  photo: "Photo",
  photo_location: "Photo + location",
  canvas: "Canvas",
};
