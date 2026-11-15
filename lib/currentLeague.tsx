import { createContext, type ReactNode, useContext, useMemo, useState } from "react";

import type { Id } from "@/convex/_generated/dataModel";

type CurrentLeague = {
  /** The league the header shows. Null while it loads or when the player has none: pass "skip" to useQuery then. */
  leagueId: Id<"leagues"> | null;
  setLeagueId: (leagueId: Id<"leagues">) => void;
  /** The week the WeekSelector shows. Undefined means the current week, which the server resolves. */
  weekStart: number | undefined;
  weekNumber: number | undefined;
};

const CurrentLeagueContext = createContext<CurrentLeague | null>(null);

/**
 * A player can be in several leagues but looks at one at a time: the one named
 * in the header. Every tab and pushed screen reads that choice from here, so
 * switching league in the header switches the whole app.
 */
export function CurrentLeagueProvider({ children }: { children: ReactNode }) {
  const [leagueId, setLeagueId] = useState<Id<"leagues"> | null>(null);
  const value = useMemo<CurrentLeague>(
    () => ({ leagueId, setLeagueId, weekStart: undefined, weekNumber: undefined }),
    [leagueId],
  );
  return <CurrentLeagueContext.Provider value={value}>{children}</CurrentLeagueContext.Provider>;
}

export function useCurrentLeague(): CurrentLeague {
  const value = useContext(CurrentLeagueContext);
  if (value === null) {
    throw new Error("useCurrentLeague must be used inside CurrentLeagueProvider");
  }
  return value;
}
