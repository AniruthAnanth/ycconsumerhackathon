import { useMutation, useQuery } from "convex/react";
import { Linking } from "react-native";

import { api } from "@/convex/_generated/api";

import { formatLineNumber } from "./formatLineNumber";

/**
 * The Play by text opt-in, shared by the League tab's row and Settings. Turning it on also opens
 * Messages with the join text typed: on the shared number, sending that text is what lets the
 * agent text the player back. While the line loads, or where no number is configured, the
 * switch waits (ready false) instead of vanishing.
 */
export function usePlayByText() {
  const line = useQuery(api.keiki.line);
  const setOptIn = useMutation(api.keiki.setOptIn);

  async function onValueChange(optIn: boolean) {
    try {
      await setOptIn({ optIn });
    } catch {
      return;
    }
    if (!optIn || !line) return;
    try {
      await Linking.openURL(line.smsUrl);
    } catch {}
  }

  return {
    value: line?.optedIn ?? false,
    ready: Boolean(line),
    copy: line
      ? `Get drops and send proofs by text at ${formatLineNumber(line.number)}.`
      : "Get drops and send proofs by text.",
    onValueChange,
  };
}
