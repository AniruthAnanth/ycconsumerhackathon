import type { Id } from "@/convex/_generated/dataModel";

import { InviteButton } from "./InviteButton";

/** The verdict screen's invite: the same link, framed as a dare. */
export function ShareChallenge({ leagueId }: { leagueId: Id<"leagues"> | null | undefined }) {
  return <InviteButton leagueId={leagueId} label="Challenge a friend to beat this" variant="outlined" />;
}
