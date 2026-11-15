import type { Slot } from "@/lib/slots";

import type { IconName } from "./Icon";

/** Shown in a task's thumbnail until a verified proof photo replaces it. */
export const SLOT_ICON: Record<Slot, IconName> = {
  body: "barbell-outline",
  mind: "book-outline",
  recharge: "leaf-outline",
  chores: "home-outline",
  people: "people-outline",
  flex: "flash-outline",
};
