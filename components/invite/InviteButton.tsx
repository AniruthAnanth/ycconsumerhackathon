import { StyleSheet, Text, View } from "react-native";

import { Button, OutlinedPillButton } from "@/components/ui";
import type { Id } from "@/convex/_generated/dataModel";
import { colors, font, spacing } from "@/theme";

import { useShareInvite } from "./useShareInvite";

type Props = {
  leagueId: Id<"leagues"> | null | undefined;
  label?: string;
  /** primary: the screen's filled button. outlined: a full pill. compact: a small centred pill with room around it. */
  variant?: "primary" | "outlined" | "compact";
};

/** Shares the caller's invite link for a league in one tap. */
export function InviteButton({ leagueId, label = "Invite friends", variant = "outlined" }: Props) {
  const { share, busy, notice } = useShareInvite(leagueId);
  const shown = notice === "Link copied" ? notice : label;
  return (
    <View style={variant === "compact" ? styles.compact : styles.block}>
      {variant === "primary" ? (
        <Button label={shown} onPress={share} loading={busy} disabled={!leagueId} />
      ) : (
        <OutlinedPillButton label={shown} icon="share-outline" onPress={share} disabled={!leagueId || busy} />
      )}
      {notice && notice !== "Link copied" ? <Text style={styles.error}>{notice}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.xs },
  compact: { alignSelf: "center", margin: spacing.lg, gap: spacing.xs },
  error: { fontSize: font.meta, color: colors.danger },
});
