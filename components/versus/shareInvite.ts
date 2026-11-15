import * as Linking from "expo-linking";
import * as SMS from "expo-sms";
import { Share } from "react-native";

import { inviteMessage } from "./versusText";

/**
 * Sends the challenge: by text straight to the phone when we have one and the
 * device can text, otherwise through the share sheet. A cancelled or failed
 * share is not an error: the versus exists and the code stays on screen.
 */
export async function shareInvite(inviteCode: string, phone?: string) {
  // createURL yields lineup://versus/join in a build and an exp:// URL in Expo Go, so the link opens whichever app sent it.
  const message = inviteMessage(inviteCode, Linking.createURL("versus/join", { queryParams: { code: inviteCode } }));
  try {
    if (phone && (await SMS.isAvailableAsync())) await SMS.sendSMSAsync([phone], message);
    else await Share.share({ message });
  } catch {}
}
