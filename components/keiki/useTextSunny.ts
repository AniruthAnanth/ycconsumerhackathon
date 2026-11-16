import { useQuery } from "convex/react";
import { Linking } from "react-native";

import { api } from "@/convex/_generated/api";

import { formatLineNumber } from "./formatLineNumber";

/**
 * Texting Sunny, the league agent, at the shared number. open() starts Messages with "Hi Sunny"
 * and this account's link code typed: sending it links the phone to the account and opts it in,
 * so the first text already gets real answers. ready is false while the line loads or where no
 * number is configured.
 */
export function useTextSunny() {
  const line = useQuery(api.keiki.line);

  async function open() {
    if (!line) return;
    try {
      await Linking.openURL(line.smsUrl);
    } catch {}
  }

  return { ready: Boolean(line), number: line ? formatLineNumber(line.number) : "", open };
}
