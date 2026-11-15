import { useQuery } from "convex/react";

import type { Id } from "@/convex/_generated/dataModel";
import { socialApi } from "./contract";

/**
 * Who this device is playing as. Switch Player (demo controls) makes the backend
 * treat the device as a seeded player, so "mine" on a social screen has to follow
 * actingAs rather than the signed-in user.
 */
export function useMyUserId(): Id<"users"> | undefined {
  const me = useQuery(socialApi.users.me);
  return me?.actingAs?._id ?? me?._id;
}
