import { useAction } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { socialApi } from "@/components/social/contract";
import { leaveScreen } from "@/components/social/leave";
import { ScreenState } from "@/components/social/ScreenState";
import { useMyUserId } from "@/components/social/useMyUserId";
import { Header, OutlinedPillButton, Screen } from "@/components/ui";
import { SunnyAvatar } from "@/components/social/sunny/SunnyAvatar";
import { SUNNY, type SunnyAction } from "@/components/social/sunny/sunnyLogic";
import { markSunnySeen, useSunny } from "@/components/social/sunny/useSunny";
import { useCurrentLeague } from "@/lib/currentLeague";
import { colors, font, fontFamily, SCREEN_MARGIN, spacing, type } from "@/theme";

import { ChatInputBar } from "./ChatInputBar";
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
    <Screen>
      <Header title={SUNNY.name} onBack={leaveScreen} />
      {key ? (
        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={insets.top}
        >
          {state.messages.length === 0 ? (
            <View style={styles.suggestions}>
              <SunnyAvatar size={72} />
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  messages: { paddingVertical: spacing.sm },
  suggestions: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: SCREEN_MARGIN },
  intro: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: font.title, lineHeight: type.body.lineHeight, textAlign: "center", marginVertical: spacing.sm },
});
