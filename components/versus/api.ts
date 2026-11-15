import type { FunctionReturnType } from "convex/server";

import type { api } from "@/convex/_generated/api";

/** A versus as versus.get returns it to one of its two players. */
export type Versus = NonNullable<FunctionReturnType<typeof api.versus.get>>;
