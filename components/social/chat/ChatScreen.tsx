import { useAction } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { socialApi } from "@/components/social/contract";
import { SunnyBreathe } from "@/components/motion";
import { leaveScreen } from "@/components/social/leave";
import { ScreenState } from "@/components/social/ScreenState";
import { useMyUserId } from "@/components/social/useMyUserId";
import { Header, OutlinedPillButton, Screen } from "@/components/ui";
import { SunnyAvatar } from "@/components/social/sunny/SunnyAvatar";
import { SUNNY, type SunnyAction } from "@/components/social/sunny/sunnyLogic";
import { markSunnySeen, useSunny } from "@/components/social/sunny/useSunny";
import { useCurrentLeague } from "@/lib/currentLeague";
import { colors, font, fontFamily, layout, radius, SCREEN_MARGIN, spacing, type } from "@/theme";

import { ChatInputBar } from "./ChatInputBar";
import { GroupChat } from "./GroupChat";
import { chatKey, chatStore, retryMessage, sendMessage } from "./chatStore";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";

type Tab = "league" | "private";

const TABS: { key: Tab; label: string }[] = [
  { key: "league", label: "League" },
  { key: "private", label: `Private with ${SUNNY.name}` },
];

/** The chat tab: the league's group thread by default, or the 1:1 with Sunny. A chip that asks Sunny something opens on Private. */
export function ChatScreen() {
  const { ask, draft } = useLocalSearchParams<{ ask?: string; draft?: string }>();
  const [tab, setTab] = useState<Tab>(ask || draft ? "private" : "league");
  useEffect(() => {
    if (ask || draft) setTab("private");
  }, [ask, draft]);

  return (
    <Screen>
      <Header title="Chat" onBack={leaveScreen} />
      <View style={styles.track} accessibilityRole="tablist">
        {TABS.map(({ key, label }) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            onPress={() => setTab(key)}
            style={[styles.segment, tab === key && styles.segmentOn]}
          >
            <Text style={[styles.segmentText, tab === key && styles.segmentTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {tab === "league" ? <GroupChat /> : <PrivateChat />}
    </Screen>
  );
}

function PrivateChat() {
  const { leagueId } = useCurrentLeague();
  const chat = useAction(socialApi.keiki.chat);
  const insets = useSafeAreaInsets();
  const userId = useMyUserId();
  const key = leagueId && userId ? chatKey(leagueId, userId) : "";
  const state = useSyncExternalStore(chatStore.subscribe, () => chatStore.get(key));
  const [draft, setDraft] = useState("");
  const list = useRef<FlatList>(null);
  const router = useRouter();
  const { brief } = useSunny();
  const { ask: asked } = useLocalSearchParams<{ ask?: string }>();

  const ask = (text: string) => chat({ leagueId: leagueId!, text });

  const send = (text: string) => void sendMessage(chatStore, key, ask, text);

  const submitDraft = () => {
    send(draft.trim());
    setDraft("");
  };

  const retry = (id: string) => void retryMessage(chatStore, key, ask, id);

  // Opening the chat reads Sunny's latest line, which clears the header's dot.
  useEffect(() => {
    if (leagueId && brief) markSunnySeen(leagueId, brief.line);
  }, [leagueId, brief]);

  // A chip on the Feed or Roster card opens the chat with its question, sent once.
  useEffect(() => {
    if (!key || !asked) return;
    router.setParams({ ask: undefined });
    send(asked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, asked]);

  const act = (action: SunnyAction) => router.navigate(action.kind === "swap" ? "/" : action.kind === "veto" ? "/feed" : "/matchup");

  return (
    <>
      {key ? (
        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={insets.top}
        >
          {state.messages.length === 0 ? (
            <View style={styles.suggestions}>
              <SunnyBreathe>
                <SunnyAvatar size={112} />
              </SunnyBreathe>
              <Text style={styles.intro}>{brief?.line ?? `${SUNNY.name}, your league's commissioner. Ask me anything about the week.`}</Text>
              {(brief?.chips ?? ["Who's on top of the league?"]).map((suggestion) => (
                <OutlinedPillButton key={suggestion} label={suggestion} onPress={() => send(suggestion)} />
              ))}
            </View>
          ) : (
            <FlatList
              ref={list}
              style={styles.body}
              contentContainerStyle={styles.messages}
              data={state.messages}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => <MessageBubble message={item} onRetry={retry} onAction={act} />}
              ListFooterComponent={state.pending ? <TypingIndicator /> : undefined}
              onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
              keyboardShouldPersistTaps="handled"
            />
          )}
          <ChatInputBar text={draft} pending={state.pending} onChangeText={setDraft} onSend={submitDraft} />
        </KeyboardAvoidingView>
      ) : (
        <ScreenState loading />
      )}
    </>
  );
}

const SEGMENT_INSET = 2;

const styles = StyleSheet.create({
  body: { flex: 1 },
  track: {
    flexDirection: "row",
    marginHorizontal: SCREEN_MARGIN,
    marginBottom: spacing.sm,
    padding: SEGMENT_INSET,
    minHeight: layout.rowMin,
    borderRadius: radius.pill,
    backgroundColor: colors.strip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  segment: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  segmentOn: { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.divider },
  segmentText: { color: colors.textMuted, fontFamily: fontFamily.semiBold, fontSize: font.body },
  segmentTextOn: { color: colors.text },
  messages: { paddingVertical: spacing.sm },
  suggestions: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: SCREEN_MARGIN },
  intro: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: font.title, lineHeight: type.body.lineHeight, textAlign: "center", marginVertical: spacing.sm },
});
