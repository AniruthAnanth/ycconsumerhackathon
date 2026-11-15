import { useQuery } from "convex/react";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

import type { Id } from "@/convex/_generated/dataModel";

import { backend, type League, type Me, type MyLeague } from "./backend";
import { readPreference, writePreference } from "./preference";
import { shiftWeekStart } from "./week";

type CurrentLeague = {
  /** users.me(): undefined while it loads. */
  me: Me | null | undefined;
  /** The league the header shows. Null while it loads or when the player has none: pass "skip" to useQuery then. */
  leagueId: Id<"leagues"> | null;
  setLeagueId: (leagueId: Id<"leagues">) => void;
  /** The player's own view of that league: its name, stake and whether they have paid. */
  membership: MyLeague | undefined;
  /** leagues.get for that league; undefined while it loads. */
  league: League | undefined;
  /** The week the WeekSelector shows. Undefined means the current week, which the server resolves. */
  weekStart: number | undefined;
  weekNumber: number | undefined;
  /** Step the WeekSelector. Undefined when there is no week in that direction. */
  showPreviousWeek: (() => void) | undefined;
  showNextWeek: (() => void) | undefined;
};

const CHOSEN_LEAGUE_KEY = "lineup.chosenLeague";

const CurrentLeagueContext = createContext<CurrentLeague | null>(null);

/**
 * A player can be in several leagues but looks at one at a time: the one named
 * in the header. Every tab and pushed screen reads that choice, and the week
 * on show, from here, so switching either in the header switches the whole app.
 */
export function CurrentLeagueProvider({ children }: { children: ReactNode }) {
  const me = useQuery(backend.users.me);
  // Undefined until the id saved on this device has been read, null when none was saved.
  const [chosenId, setChosenId] = useState<Id<"leagues"> | null | undefined>(undefined);
  useEffect(() => {
    void readPreference(CHOSEN_LEAGUE_KEY).then((saved) => setChosenId(saved as Id<"leagues"> | null));
  }, []);
  // 0 is the league's current week, -1 the one before, 1 the one being drafted next.
  const [weekOffset, setWeekOffset] = useState(0);

  // The choice only holds while the player is a member of it; otherwise fall
  // back to their first league, which is also the answer on first launch.
  // Until the saved choice is read there is no league, as while `me` loads, so
  // the first league never flashes before the saved one replaces it.
  const leagues = me?.leagues ?? [];
  const membership =
    chosenId === undefined ? undefined : (leagues.find((league) => league._id === chosenId) ?? leagues[0]);
  const leagueId = membership?._id ?? null;
  const league = useQuery(backend.leagues.get, leagueId ? { leagueId } : "skip");

  const weekNumber = league ? league.week.number + weekOffset : undefined;
  const value: CurrentLeague = {
    me,
    leagueId,
    setLeagueId: (id) => {
      setChosenId(id);
      setWeekOffset(0);
      void writePreference(CHOSEN_LEAGUE_KEY, id);
    },
    membership,
    league,
    weekStart: league && weekOffset !== 0 ? shiftWeekStart(league.week.startsAt, weekOffset) : undefined,
    weekNumber,
    showPreviousWeek: weekNumber !== undefined && weekNumber > 1 ? () => setWeekOffset(weekOffset - 1) : undefined,
    // Next week exists only as a draft target, so there is nothing to show beyond it.
    showNextWeek: weekNumber !== undefined && weekOffset < 1 ? () => setWeekOffset(weekOffset + 1) : undefined,
  };
  return <CurrentLeagueContext.Provider value={value}>{children}</CurrentLeagueContext.Provider>;
}

export function useCurrentLeague(): CurrentLeague {
  const value = useContext(CurrentLeagueContext);
  if (value === null) {
    throw new Error("useCurrentLeague must be used inside CurrentLeagueProvider");
  }
  return value;
}
