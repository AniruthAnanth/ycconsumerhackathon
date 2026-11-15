import { useQuery } from "convex/react";

import type { Id } from "@/convex/_generated/dataModel";
import { socialApi } from "./contract";

/**
 * Who this device is playing as. users.me describes the player the device plays
 * as, Switch Player (demo controls) included, so its _id is already "mine" on a
 * social screen.
 */
export function useMyUserId(): Id<"users"> | undefined {
  const me = useQuery(socialApi.users.me);
  return me?._id;
}
