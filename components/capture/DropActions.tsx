import type { Id } from "@/convex/_generated/dataModel";
import type { Drop } from "@/lib/backend";

import { GroupActions } from "./drops/GroupActions";
import { SealedMysteryActions } from "./drops/SealedMysteryActions";
import { TimedActions } from "./drops/TimedActions";
import { dropView } from "./drops/dropView";
import { useNow } from "./drops/useNow";

type Props = { drop: Drop; leagueId: Id<"leagues"> };

/** The actions inside a live drop's banner on Roster. */
export function DropActions({ drop }: Props) {
  const view = dropView(drop, useNow());

  switch (view.type) {
    case "hidden":
      return null;
    case "sealed":
      return <SealedMysteryActions view={view} />;
    case "timed":
      return <TimedActions view={view} />;
    case "group":
      return <GroupActions view={view} />;
  }
}
