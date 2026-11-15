import { useMutation } from "convex/react";
import * as Linking from "expo-linking";
import { useCallback, useState } from "react";
import { Platform } from "react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { haptics } from "@/lib/native/haptics";
import { shareText } from "@/lib/native/share";

/**
 * The invite text for a league, with its short link. appUrl is a prefix: the
 * server appends "/<token>", so the /i page can reopen this same app build
 * (Expo Go, lineup:// or the web) at /invite/<token>.
 */
export function useInviteMessage() {
  const createLink = useMutation(api.referrals.createLink);
  return useCallback(
    async (leagueId: Id<"leagues">) => (await createLink({ leagueId, appUrl: Linking.createURL("/invite") })).message,
    [createLink],
  );
}

/**
 * One tap: create (or fetch) the link, then open the share sheet. The web has
 * no share sheet in most browsers, so there the message goes to the clipboard
 * and the button says "Link copied".
 */
export function useShareInvite(leagueId: Id<"leagues"> | null | undefined) {
  const inviteMessage = useInviteMessage();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const share = useCallback(async () => {
    if (!leagueId || busy) return;
    haptics.tap();
    setBusy(true);
    setNotice(null);
    try {
      const message = await inviteMessage(leagueId);
      if (!(await shareText(message)) && Platform.OS === "web") {
        await navigator.clipboard.writeText(message);
        setNotice("Link copied");
      }
    } catch {
      setNotice("Couldn't make the link. Try again.");
    } finally {
      setBusy(false);
    }
  }, [leagueId, busy, inviteMessage]);

  return { share, busy, notice };
}
