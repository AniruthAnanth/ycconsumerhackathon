import { useQuery } from "convex/react";
import { Linking } from "react-native";

import { Banner } from "@/components/ui";
import { backend } from "@/lib/backend";

/**
 * The opt-in to playing by text. Drops, verdicts and standings can reach a
 * player in Messages, but the league agent's number may only text someone who
 * has texted it first, so nobody hears from it until they tap this once. It
 * opens Messages with the join text already typed; sending it is the opt-in.
 *
 * Renders nothing when the backend has no line configured.
 */
export function TextLineupBanner() {
  const line = useQuery(backend.keiki.line);
  if (!line) return null;
  return (
    <Banner
      icon="chatbubbles-outline"
      title="Text Lineup"
      subtitle={`Get drops in Messages from ${line.number}`}
      onPress={() => Linking.openURL(line.smsUrl)}
    />
  );
}
