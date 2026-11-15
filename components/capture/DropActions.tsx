import type { Drop } from "@/lib/backend";
import { useNow } from "@/lib/useNow";

import { useMyUserId } from "@/components/social/useMyUserId";

import { GroupActions } from "./drops/GroupActions";
import { TimedActions } from "./drops/TimedActions";
import { dropView } from "./drops/dropView";

type Props = { drop: Drop };

/** The actions inside a live drop's banner on Roster. */
export function DropActions({ drop }: Props) {
  const view = dropView(drop, useNow(1000), useMyUserId());

  switch (view.type) {
    case "hidden":
      return null;
    case "timed":
      return <TimedActions view={view} />;
    case "group":
      return <GroupActions view={view} />;
  }
}
