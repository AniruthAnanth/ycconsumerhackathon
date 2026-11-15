import { useMutation } from "convex/react";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Id } from "@/convex/_generated/dataModel";
import { type FeedItem, socialApi } from "@/components/social/contract";
import { confirmAction, notify } from "@/components/social/notify";
import { Avatar, PositionPill, Score } from "@/components/ui";
import { colors } from "@/theme";
import { ProofMedia } from "@/components/social/ProofMedia";
import { errorMessage } from "@/lib/errorMessage";
import { haptics } from "@/lib/native/haptics";
import { shareText } from "@/lib/native/share";

import { ChallengeBar } from "./ChallengeBar";
import { canChallenge, KIND_LABEL, proofShareText, REACTION_EMOJI, reactionButtons, timeAgo } from "./feedLogic";
import { ProofSwipeRow } from "./ProofSwipeRow";
import { ReactionBar } from "./ReactionBar";

/**
 * One verified proof in the feed: who did what for how many points, the photo
 * or video, what the referee said, and what the league makes of it.
 */
export function ProofPost({
  item,
  leagueId,
  memberCount,
  myUserId,
  now,
}: {
  item: FeedItem;
  leagueId: Id<"leagues">;
  memberCount: number | undefined;
  myUserId: Id<"users"> | undefined;
  now: number;
}) {
  const openChallenge = useMutation(socialApi.challenges.open);
  const react = useMutation(socialApi.feed.react);
  const challengeable = canChallenge(item, myUserId, now, memberCount);
  const toggleReaction = (emoji: string) => {
    haptics.select();
    react({ proofId: item.proofId, emoji }).catch((error) => notify(errorMessage(error)));
  };
  const kindLabel = KIND_LABEL[item.kind];

  // A failed challenge costs the challenger points, so it takes a second tap.
  const confirmChallenge = () =>
    confirmAction({
      title: "Challenge this proof?",
      message: "The league votes. If the vote goes against you, you lose 10 points.",
      confirmLabel: "Challenge",
      onConfirm: () =>
        openChallenge({ proofId: item.proofId, leagueId }).catch((error) => notify(errorMessage(error))),
    });

  return (
    <View>
      {/*
        Tapping the byline opens the profile; a long press opens the iOS context menu with the
        post's actions. Link.Menu is iOS-only and renders nothing elsewhere, so Android and the
        web keep the plain link and the buttons below.
      */}
      <ProofSwipeRow
        reactEmoji={REACTION_EMOJI[0]}
        onReact={() => toggleReaction(REACTION_EMOJI[0])}
        onChallenge={challengeable ? confirmChallenge : undefined}
      >
        <Link href={`/profile/${item.user._id}`} asChild>
          <Link.Trigger>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.user.name}'s profile`}
              style={styles.byline}
            >
              <Avatar uri={item.user.avatarUrl} name={item.user.name} size={40} />
              <View style={styles.who}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.user.name}
                  <Text style={styles.age}>{`  ${timeAgo(item.createdAt, now)}`}</Text>
                </Text>
                <View style={styles.task}>
                  <PositionPill slot={item.slot} />
                  <Text style={styles.taskTitle} numberOfLines={1}>
                    {item.taskTitle}
                  </Text>
                </View>
              </View>
              <Score value={item.points} />
            </Pressable>
          </Link.Trigger>
          <Link.Menu>
            <Link.Menu title="React" icon="face.smiling" palette>
              {reactionButtons(item.reactions).map(({ emoji, mine }) => (
                <Link.MenuAction key={emoji} isOn={mine} onPress={() => toggleReaction(emoji)}>
                  {emoji}
                </Link.MenuAction>
              ))}
            </Link.Menu>
            {challengeable ? (
              <Link.MenuAction icon="flag" onPress={confirmChallenge}>
                Challenge
              </Link.MenuAction>
            ) : null}
            <Link.MenuAction icon="square.and.arrow.up" onPress={() => shareText(proofShareText(item))}>
              Share
            </Link.MenuAction>
          </Link.Menu>
        </Link>
      </ProofSwipeRow>

      {item.mediaUrl && item.mediaType !== "canvas" ? (
        <ProofMedia uri={item.mediaUrl} mediaType={item.mediaType} style={styles.media} />
      ) : null}

      <View style={styles.body}>
        {kindLabel || item.closeCall ? (
          <View style={styles.flags}>
            {kindLabel ? <Text style={styles.kind}>{kindLabel}</Text> : null}
            {item.closeCall ? <Text style={styles.closeCall}>CLOSE CALL</Text> : null}
          </View>
        ) : null}
        {item.caption ? <Text style={styles.caption}>{item.caption}</Text> : null}
        <Text style={styles.reason}>
          <Text style={styles.referee}>REFEREE </Text>
          {item.reason}
        </Text>
        <View style={styles.actions}>
          <ReactionBar proofId={item.proofId} reactions={item.reactions} />
          {challengeable ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Challenge" hitSlop={8} onPress={confirmChallenge}>
              <Text style={styles.challenge}>Challenge</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {item.challenge ? <ChallengeBar challenge={item.challenge} votable={item.challenge.canVote} now={now} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  byline: { height: 72, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16 },
  who: { flex: 1, gap: 6 },
  name: { color: colors.text, fontSize: 15, fontWeight: "700" },
  age: { color: colors.textMuted, fontSize: 13, fontWeight: "400" },
  task: { flexDirection: "row", alignItems: "center", gap: 8 },
  taskTitle: { flex: 1, color: colors.textMuted, fontSize: 13 },
  media: { width: "100%", aspectRatio: 4 / 3 },
  body: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, gap: 8 },
  flags: { flexDirection: "row", gap: 12 },
  kind: { color: colors.accent, fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  closeCall: { color: colors.danger, fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  caption: { color: colors.text, fontSize: 15, fontWeight: "600" },
  reason: { color: colors.text, fontSize: 14, lineHeight: 20 },
  referee: { color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  actions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  challenge: { color: colors.accent, fontSize: 14, fontWeight: "600" },
});
