import type { FunctionReturnType } from "convex/server";

import type { api } from "@/convex/_generated/api";

/** The season as seasons.overview returns it. Every shape the season components draw is a piece of it. */
export type Season = FunctionReturnType<typeof api.seasons.overview>;

export type SeasonWeek = Season["weeks"][number];
export type SeasonMatchup = SeasonWeek["matchups"][number];
export type SeasonPlayer = SeasonWeek["byes"][number];

export type SeasonTableRow = Season["table"][number];

export type Bracket = NonNullable<Season["bracket"]>;
export type BracketRound = Bracket["rounds"][number];
export type BracketMatch = BracketRound["matches"][number];
export type BracketSide = NonNullable<BracketMatch["a"]>;
