import { useMutation } from "convex/react";
import { Image } from "expo-image";
import { PressScale } from "@/components/motion";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Id } from "@/convex/_generated/dataModel";
import { type FeedItem, socialApi } from "@/components/social/contract";
import { confirmAction, notify } from "@/components/social/notify";
import { Avatar, cardStyle, PositionPill, Score } from "@/components/ui";
import { colors, font, fontFamily, layout, MIN_TARGET, radius, ROW_HEIGHT, SCREEN_MARGIN, spacing } from "@/theme";
import { ProofMedia } from "@/components/social/ProofMedia";
import { errorMessage } from "@/lib/errorMessage";
import { haptics } from "@/lib/native/haptics";
import { shareText } from "@/lib/native/share";

import { ChallengeBar } from "./ChallengeBar";
import { canChallenge, KIND_LABEL, postCaption, proofShareText, proofVisual, REACTION_EMOJI, reactionButtons, timeAgo } from "./feedLogic";
import { ProofSwipeRow } from "./ProofSwipeRow";
import { ReactionBar } from "./ReactionBar";

/**
 * One verified proof in the feed: who did what for how many points, the photo or
 * video, one short caption, and what the league makes of it. A proof with no picture
 * (a Canvas proof) puts its caption on a card instead.
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
  const visual = proofVisual(item);
  const words = (
    <>
      {kindLabel || item.closeCall ? (
        <View style={styles.flags}>
          {kindLabel ? <Text style={styles.kind}>{kindLabel}</Text> : null}
          {item.closeCall ? <Text style={styles.closeCall}>CLOSE CALL</Text> : null}
        </View>
      ) : null}
      <Text style={visual.kind === "none" ? styles.cardCaption : styles.caption}>{postCaption(item)}</Text>
    </>
  );

  // A failed challenge costs the challenger points, so it takes a second tap.
  const confirmChallenge = () =>
    confirmAction({
      title: "Veto this proof?",
      message: "The league votes. If the vote goes against you, you lose 10 points.",
      confirmLabel: "Veto",
      onConfirm: () => {
        haptics.veto();
        openChallenge({ proofId: item.proofId, leagueId }).catch((error) => notify(errorMessage(error)));
      },
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
              <Avatar uri={item.user.avatarUrl} name={item.user.name} size={layout.avatar} />
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
                Veto
              </Link.MenuAction>
            ) : null}
            <Link.MenuAction icon="square.and.arrow.up" onPress={() => shareText(proofShareText(item))}>
              Share
            </Link.MenuAction>
          </Link.Menu>
        </Link>
      </ProofSwipeRow>

      {visual.kind === "media" && item.mediaType !== "canvas" ? (
        <ProofMedia uri={visual.uri} mediaType={item.mediaType} style={styles.media} />
      ) : null}
      {visual.kind === "filmstrip" ? (
        <View style={styles.filmstrip} accessibilityLabel={`Timelapse, ${visual.frames.length} frames`}>
          {visual.frames.map((uri) => (
            <Image key={uri} source={{ uri }} style={styles.frame} contentFit="cover" transition={150} />
          ))}
        </View>
      ) : null}

      {visual.kind === "none" ? <View style={styles.card}>{words}</View> : null}

      <View style={styles.body}>
        {visual.kind === "none" ? null : words}
        <View style={styles.actions}>
          <ReactionBar proofId={item.proofId} reactions={item.reactions} />
          {challengeable ? (
            <PressScale accessibilityRole="button" accessibilityLabel="Veto" style={styles.challengeHit} onPress={confirmChallenge}>
              <Text style={styles.challenge}>Veto</Text>
            </PressScale>
          ) : null}
        </View>
      </View>

      {item.challenge ? <ChallengeBar challenge={item.challenge} votable={item.challenge.canVote} now={now} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  byline: { minHeight: ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: layout.columnGap, paddingHorizontal: SCREEN_MARGIN, paddingVertical: spacing.sm },
  who: { flex: 1, gap: spacing.xs },
  name: { color: colors.text, fontSize: font.body, fontFamily: fontFamily.bold },
  age: { color: colors.textMuted, fontSize: font.meta, fontFamily: fontFamily.regular },
  task: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  taskTitle: { flex: 1, color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: font.meta },
  media: { width: "100%", aspectRatio: 4 / 3 },
  filmstrip: { flexDirection: "row", gap: spacing.xs, paddingHorizontal: SCREEN_MARGIN },
  frame: { flex: 1, aspectRatio: 3 / 4, borderRadius: radius.sm, backgroundColor: colors.strip },
  card: { ...cardStyle, marginHorizontal: SCREEN_MARGIN, padding: spacing.lg, gap: spacing.sm },
  cardCaption: { color: colors.text, fontSize: font.header, fontFamily: fontFamily.bold },
  body: { paddingHorizontal: SCREEN_MARGIN, paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.sm },
  flags: { flexDirection: "row", gap: spacing.md },
  kind: { color: colors.accent, fontSize: font.label, fontFamily: fontFamily.bold, letterSpacing: 0.6 },
  closeCall: { color: colors.danger, fontSize: font.label, fontFamily: fontFamily.bold, letterSpacing: 0.6 },
  caption: { color: colors.text, fontSize: font.body, fontFamily: fontFamily.semiBold },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xs },
  challengeHit: { minHeight: MIN_TARGET, justifyContent: "center" },
  challenge: { color: colors.accent, fontSize: font.body, fontFamily: fontFamily.semiBold },
});
