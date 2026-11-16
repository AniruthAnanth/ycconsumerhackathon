import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";

import { formatLineNumber } from "@/components/keiki/formatLineNumber";
import { PressScale } from "@/components/motion";
import { api } from "@/convex/_generated/api";
import { useCurrentLeague } from "@/lib/currentLeague";
import { BORDER, colors, font, fontFamily, layout, radius, SCREEN_MARGIN, spacing } from "@/theme";

import { socialApi } from "../contract";
import { SunnyAvatar } from "./SunnyAvatar";
import { sunnyPrompt } from "./sunnyLogic";

/** One slim card between sections: Sunny's face, a line and a lime call to action. */
function PromptRow({ line, cta, onPress }: { line: string; cta: string; onPress: () => void }) {
  return (
    <PressScale accessibilityRole="button" accessibilityLabel={`${line} ${cta}`} onPress={onPress} style={styles.card}>
      <SunnyAvatar size={32} />
      <Text style={styles.line} numberOfLines={2}>
        {line}
      </Text>
      <View style={styles.cta}>
        <Text style={styles.ctaText}>{cta}</Text>
      </View>
    </PressScale>
  );
}

/** Roster and Matchup: a question for Sunny, typed into the chat for the player to send. */
export function SunnyPrompt({ screen }: { screen: "roster" | "matchup" }) {
  const router = useRouter();
  const { leagueId } = useCurrentLeague();
  const matchup = useQuery(socialApi.standings.matchup, screen === "matchup" && leagueId ? { leagueId } : "skip");
  const prompt = sunnyPrompt(screen, matchup);
  return <PromptRow line={prompt.line} cta={prompt.cta} onPress={() => router.push({ pathname: "/chat", params: { draft: prompt.question } })} />;
}

/** League: Sunny is also a phone number, so this opens Messages with STANDINGS typed. */
export function SunnyTextPrompt() {
  const line = useQuery(api.keiki.line);
  if (!line) return null;
  const separator = Platform.OS === "ios" ? "&" : "?";
  return (
    <PromptRow
      line={`Text Sunny at ${formatLineNumber(line.number)} to play from your messages`}
      cta="Text"
      onPress={() => void Linking.openURL(`sms:${line.number}${separator}body=STANDINGS`).catch(() => {})}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: layout.rowMin,
    marginHorizontal: SCREEN_MARGIN,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: BORDER,
    borderColor: colors.divider,
  },
  line: { flex: 1, color: colors.text, fontFamily: fontFamily.semiBold, fontSize: font.body },
  cta: { minHeight: layout.pillHeight, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.lime },
  ctaText: { color: colors.accent, fontFamily: fontFamily.bold, fontSize: font.meta },
});
