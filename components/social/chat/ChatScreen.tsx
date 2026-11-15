import { useAction } from "convex/react";
import { useRef, useState, useSyncExternalStore } from "react";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { socialApi } from "@/components/social/contract";
import { leaveScreen } from "@/components/social/leave";
import { ScreenState } from "@/components/social/ScreenState";
import { useMyUserId } from "@/components/social/useMyUserId";
import { Header, OutlinedPillButton, Screen } from "@/components/ui";
import { useCurrentLeague } from "@/lib/currentLeague";

import { ChatInputBar } from "./ChatInputBar";
import { SUGGESTIONS } from "./chatLogic";
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

  const ask = (text: string) => chat({ leagueId: leagueId!, text });

  const send = (text: string) => void sendMessage(chatStore, key, ask, text);

  const submitDraft = () => {
    send(draft.trim());
    setDraft("");
  };

  const retry = (id: string) => void retryMessage(chatStore, key, ask, id);

  return (
    <Screen>
      <Header title="League Agent" onBack={leaveScreen} />
      {key ? (
        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={insets.top}
        >
          {state.messages.length === 0 ? (
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((suggestion) => (
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
              renderItem={({ item }) => <MessageBubble message={item} onRetry={retry} />}
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
  messages: { paddingVertical: 8 },
  suggestions: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
});
