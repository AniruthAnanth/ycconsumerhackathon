import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentLeague } from "@/lib/currentLeague";

import { InviteButton } from "./InviteButton";

/** The verdict screen's invite: the same link, framed as a dare. Defaults to the league in the header. */
export function ShareChallenge({ leagueId }: { leagueId?: Id<"leagues"> | null }) {
  const current = useCurrentLeague();
  return <InviteButton leagueId={leagueId ?? current.leagueId} label="Challenge a friend to beat this" variant="outlined" />;
}
