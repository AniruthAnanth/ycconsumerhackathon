import { useAction } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FlatList, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { socialApi } from "@/components/social/contract";
import { PressScale } from "@/components/motion";
import { leaveScreen } from "@/components/social/leave";
import { ScreenState } from "@/components/social/ScreenState";
import { useMyUserId } from "@/components/social/useMyUserId";
import { Header, Screen } from "@/components/ui";
import { SUNNY, type SunnyAction } from "@/components/social/sunny/sunnyLogic";
import { markSunnySeen, useSunny } from "@/components/social/sunny/useSunny";
import { useCurrentLeague } from "@/lib/currentLeague";
import { colors, font, fontFamily, layout, radius, SCREEN_MARGIN, spacing } from "@/theme";

import { ChatInputBar } from "./ChatInputBar";
import type { ChatMessage } from "./chatLogic";
import { chatKey, chatStore, retryMessage, sendMessage } from "./chatStore";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";

export function ChatScreen() {
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
  const { ask: asked, draft: prefill } = useLocalSearchParams<{ ask?: string; draft?: string }>();

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

  // A prompt row between sections types its question for the player to send or edit.
  useEffect(() => {
    if (!prefill) return;
    router.setParams({ draft: undefined });
    setDraft(prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  // A question, never the Feed card's line word for word: the card already said what's happening.
  const greeting: ChatMessage = { id: "greeting", role: "agent", text: "What do you want to know? I've got the table, your matchup and every open task." };
  const chips = brief?.chips ?? ["Who's on top of the league?"];

  const act = (action: SunnyAction) => router.navigate(action.kind === "swap" ? "/" : action.kind === "veto" ? "/feed" : "/matchup");

  return (
    <Screen>
      <Header title={SUNNY.name} onBack={leaveScreen} />
      {key ? (
        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={insets.top}
        >
          <FlatList
            ref={list}
            style={styles.body}
            contentContainerStyle={styles.messages}
            data={[greeting, ...state.messages]}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => <MessageBubble message={item} onRetry={retry} onAction={act} />}
            ListFooterComponent={state.pending ? <TypingIndicator /> : undefined}
            onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled"
          />
          {/* Suggestions stay in one row above the composer, like iMessage, for the whole conversation. */}
          {state.pending ? null : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
              {chips.map((chip) => (
                <PressScale key={chip} accessibilityRole="button" onPress={() => send(chip)} style={styles.chip}>
                  <Text style={styles.chipText}>{chip}</Text>
                </PressScale>
              ))}
            </ScrollView>
          )}
          <ChatInputBar text={draft} pending={state.pending} onChangeText={setDraft} onSend={submitDraft} />
        </KeyboardAvoidingView>
      ) : (
        <ScreenState loading />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  messages: { paddingVertical: spacing.sm },
  chips: { gap: spacing.sm, paddingHorizontal: SCREEN_MARGIN, paddingVertical: spacing.sm },
  chip: { minHeight: layout.pillHeight, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.lime },
  chipText: { color: colors.accent, fontFamily: fontFamily.bold, fontSize: font.meta },
});
