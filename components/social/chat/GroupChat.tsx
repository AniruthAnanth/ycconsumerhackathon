import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Swipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { socialApi, type ChatPost, type LeagueMessageId } from "@/components/social/contract";
import { ScreenState } from "@/components/social/ScreenState";
import { SunnyAvatar } from "@/components/social/sunny/SunnyAvatar";
import { parseReply, type SunnyAction } from "@/components/social/sunny/sunnyLogic";
import { Avatar, EmptyState, Icon } from "@/components/ui";
import { useCurrentLeague } from "@/lib/currentLeague";
import { haptics } from "@/lib/native/haptics";
import { BORDER, colors, font, fontFamily, layout, radius, SCREEN_MARGIN, spacing, type } from "@/theme";

import { ChatInputBar } from "./ChatInputBar";
import { authorName, buildRows, formatTime, REACTION_EMOJI, snippet, type ChatRow } from "./groupChatLogic";
import { TypingIndicator } from "./TypingIndicator";

const ACTION_LABEL = { swap: "Swap a task", veto: "Open vetoes", nudge: "Nudge" } as const;
const AVATAR = layout.avatarCompact;
const REPLY_SWIPE = 64;

type ReplyTarget = { _id: LeagueMessageId; authorName: string; text: string };

/** The league's shared thread: every member plus Sunny, live from Convex. */
export function GroupChat() {
  const { leagueId } = useCurrentLeague();
  const thread = useQuery(socialApi.leagueChat.list, leagueId ? { leagueId } : "skip");
  const send = useMutation(socialApi.leagueChat.send);
  const react = useMutation(socialApi.leagueChat.react);
  const markRead = useMutation(socialApi.leagueChat.markRead);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<ChatRow>>(null);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [picking, setPicking] = useState<LeagueMessageId | null>(null);
  const [sending, setSending] = useState(false);

  const messages = thread?.messages;
  const rows = useMemo(() => (messages ? buildRows(messages, Date.now()) : []), [messages]);
  const lastId = messages?.at(-1)?._id;

  // Reading the thread while it is open clears the unread badge, including for posts that land meanwhile.
  useEffect(() => {
    if (leagueId) void markRead({ leagueId }).catch(() => {});
  }, [leagueId, lastId, markRead]);

  if (!leagueId || thread === undefined) return <ScreenState loading />;

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    try {
      await send({ leagueId, text, replyToId: replyTo?._id });
      haptics.success();
      setDraft("");
      setReplyTo(null);
    } catch {
      haptics.error();
    } finally {
      setSending(false);
    }
  };

  const toggle = (messageId: LeagueMessageId, emoji: string) => {
    haptics.select();
    setPicking(null);
    void react({ messageId, emoji }).catch(() => {});
  };

  const startReply = (post: ChatPost) => {
    haptics.select();
    setReplyTo({ _id: post._id, authorName: authorName(post), text: parseReply(post.text).text });
  };

  const act = (action: SunnyAction) => router.navigate(action.kind === "swap" ? "/" : action.kind === "veto" ? "/feed" : "/matchup");

  return (
    <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={insets.top}>
      {rows.length === 0 ? (
        <View style={styles.body}>
          <EmptyState message="Say hi to the league. Every member and Sunny read this thread." />
        </View>
      ) : (
        <FlatList
          ref={list}
          style={styles.body}
          contentContainerStyle={styles.messages}
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={({ item }) =>
            item.kind === "day" ? (
              <Text style={styles.day}>{item.label}</Text>
            ) : (
              <PostRow
                row={item}
                picking={picking === item.post._id}
                onLongPress={() => {
                  haptics.select();
                  setPicking(picking === item.post._id ? null : item.post._id);
                }}
                onReact={toggle}
                onReply={startReply}
                onAction={act}
              />
            )
          }
          ListFooterComponent={thread.sunnyTyping ? <TypingIndicator avatar={<SunnyAvatar size={AVATAR} />} /> : undefined}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          onScrollBeginDrag={() => setPicking(null)}
          keyboardShouldPersistTaps="handled"
        />
      )}
      {replyTo ? (
        <View style={styles.replyBar}>
          <View style={styles.replyAccent} />
          <View style={styles.replyBody}>
            <Text style={styles.replyName} numberOfLines={1}>
              Replying to {replyTo.authorName}
            </Text>
            <Text style={styles.replyText} numberOfLines={1}>
              {snippet(replyTo.text)}
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel reply" onPress={() => setReplyTo(null)} style={styles.replyClose}>
            <Icon name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}
      <ChatInputBar text={draft} pending={sending} onChangeText={setDraft} onSend={() => void submit()} />
    </KeyboardAvoidingView>
  );
}

const PostRow = memo(function PostRow({
  row,
  picking,
  onLongPress,
  onReact,
  onReply,
  onAction,
}: {
  row: Extract<ChatRow, { kind: "post" }>;
  picking: boolean;
  onLongPress: () => void;
  onReact: (id: LeagueMessageId, emoji: string) => void;
  onReply: (post: ChatPost) => void;
  onAction: (action: SunnyAction) => void;
}) {
  const { post, first, last } = row;
  const swipeable = useRef<SwipeableMethods>(null);
  const sunny = post.author.kind === "sunny";
  const { text, action } = sunny ? parseReply(post.text) : { text: post.text, action: undefined };
  const name = authorName(post);

  const bubble = (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={300}
      accessibilityHint="Long press to react, swipe right to reply"
      style={[styles.bubble, post.mine ? styles.mine : sunny ? styles.sunny : styles.member]}
    >
      {post.replyTo ? (
        <View style={[styles.quote, post.mine && styles.quoteMine]}>
          <Text style={[styles.quoteName, post.mine && styles.onAccent]} numberOfLines={1}>
            {post.replyTo.authorName}
          </Text>
          <Text style={[styles.quoteText, post.mine && styles.onAccent]} numberOfLines={1}>
            {snippet(parseReply(post.replyTo.text).text)}
          </Text>
        </View>
      ) : null}
      <Text style={[styles.text, post.mine && styles.onAccent]}>{text}</Text>
    </Pressable>
  );

  return (
    <Swipeable
      ref={swipeable}
      enabled={Platform.OS !== "web"}
      friction={2}
      leftThreshold={REPLY_SWIPE}
      overshootLeft={false}
      renderLeftActions={() => (
        <View style={styles.swipeAction}>
          <Icon name="arrow-undo" size={20} color={colors.textMuted} />
        </View>
      )}
      onSwipeableWillOpen={() => {
        onReply(post);
        swipeable.current?.close();
      }}
    >
      <View style={[styles.row, post.mine ? styles.rowMine : styles.rowOther, first ? styles.rowFirst : styles.rowCont]}>
        {post.mine ? null : (
          <View style={styles.avatarColumn}>
            {first ? sunny ? <SunnyAvatar size={AVATAR} /> : <Avatar uri={post.author.kind === "member" ? post.author.avatarUrl : undefined} name={name} size={AVATAR} /> : null}
          </View>
        )}
        <View style={[styles.column, post.mine ? styles.columnMine : styles.columnOther]}>
          {first && !post.mine ? <Text style={styles.name}>{name}</Text> : null}
          {picking ? (
              <View style={[styles.picker, post.mine ? styles.pickerMine : styles.pickerOther]}>
                {REACTION_EMOJI.map((emoji) => (
                  <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`React ${emoji}`} onPress={() => onReact(post._id, emoji)} style={styles.pickerEmoji}>
                    <Text style={styles.pickerText}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
          ) : null}
          {bubble}
          {post.reactions.length > 0 ? (
            <View style={styles.reactions}>
              {post.reactions.map((r) => (
                <Pressable
                  key={r.emoji}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.emoji} ${r.count}`}
                  onPress={() => onReact(post._id, r.emoji)}
                  style={[styles.pill, r.mine && styles.pillMine]}
                >
                  <Text style={styles.pillText}>
                    {r.emoji} {r.count}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {action ? (
            <Pressable accessibilityRole="button" onPress={() => onAction(action)} style={styles.action}>
              <Text style={styles.actionText}>{action.kind === "nudge" ? `Nudge ${action.name}` : ACTION_LABEL[action.kind]}</Text>
            </Pressable>
          ) : null}
          {last ? <Text style={styles.time}>{formatTime(post.createdAt)}</Text> : null}
        </View>
      </View>
    </Swipeable>
  );
});

const styles = StyleSheet.create({
  body: { flex: 1 },
  messages: { paddingVertical: spacing.sm },
  day: { alignSelf: "center", color: colors.textMuted, fontFamily: fontFamily.semiBold, fontSize: font.meta, marginVertical: spacing.md },
  row: { flexDirection: "row", paddingHorizontal: SCREEN_MARGIN, gap: spacing.sm },
  rowMine: { justifyContent: "flex-end" },
  rowOther: { justifyContent: "flex-start" },
  rowFirst: { paddingTop: spacing.md },
  rowCont: { paddingTop: spacing.xs / 2 },
  avatarColumn: { width: AVATAR },
  column: { maxWidth: "80%", gap: spacing.xs },
  columnMine: { alignItems: "flex-end" },
  columnOther: { alignItems: "flex-start" },
  name: { color: colors.textMuted, fontFamily: fontFamily.semiBold, fontSize: font.meta, marginLeft: spacing.sm },
  bubble: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.control, gap: spacing.xs },
  mine: { backgroundColor: colors.accent },
  member: { backgroundColor: colors.surface, borderWidth: BORDER, borderColor: colors.divider },
  sunny: { backgroundColor: colors.lime },
  text: { color: colors.text, fontFamily: fontFamily.regular, fontSize: font.title, lineHeight: type.body.lineHeight },
  onAccent: { color: colors.onAccent },
  quote: { borderLeftWidth: 3, borderLeftColor: colors.accent, paddingLeft: spacing.sm, opacity: 0.85 },
  quoteMine: { borderLeftColor: colors.onAccent },
  quoteName: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: font.meta },
  quoteText: { color: colors.text, fontFamily: fontFamily.regular, fontSize: font.meta },
  time: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: font.label, marginHorizontal: spacing.sm },
  reactions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: BORDER,
    borderColor: colors.divider,
  },
  pillMine: { backgroundColor: colors.accentTint, borderColor: colors.accent },
  pillText: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: font.meta },
  picker: {
    flexDirection: "row",
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: BORDER,
    borderColor: colors.divider,
  },
  pickerMine: { alignSelf: "flex-end" },
  pickerOther: { alignSelf: "flex-start" },
  pickerEmoji: { minWidth: layout.rowMin, minHeight: layout.rowMin, alignItems: "center", justifyContent: "center" },
  pickerText: { fontSize: font.score },
  action: { minHeight: layout.rowMin, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.lime },
  actionText: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: font.meta },
  swipeAction: { width: REPLY_SWIPE, alignItems: "center", justifyContent: "center" },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingLeft: SCREEN_MARGIN,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
  },
  replyAccent: { width: 3, alignSelf: "stretch", borderRadius: radius.pill, backgroundColor: colors.accent },
  replyBody: { flex: 1 },
  replyName: { color: colors.accent, fontFamily: fontFamily.semiBold, fontSize: font.meta },
  replyText: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: font.meta },
  replyClose: { minWidth: layout.rowMin, minHeight: layout.rowMin, alignItems: "center", justifyContent: "center" },
});
