import { useAction } from "convex/react";
import { useRouter } from "expo-router";
import { useReducer, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { socialApi } from "@/components/social/contract";
import { errorMessage } from "@/components/social/errorMessage";
import { ScreenState } from "@/components/social/ScreenState";
import { Header, OutlinedPillButton, Screen } from "@/components/ui";
import { useCurrentLeague } from "@/lib/currentLeague";

import { ChatInputBar } from "./ChatInputBar";
import { chatReducer, initialChatState, SUGGESTIONS } from "./chatLogic";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";

export function ChatScreen() {
  const router = useRouter();
  const { leagueId } = useCurrentLeague();
  const chat = useAction(socialApi.keiki.chat);
  const insets = useSafeAreaInsets();
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const [draft, setDraft] = useState("");
  const list = useRef<FlatList>(null);
  const nextId = useRef(0);

  const newId = () => String(nextId.current++);

  const request = async (messageId: string, text: string) => {
    if (!leagueId) return;
    try {
      const { reply } = await chat({ leagueId, text });
      dispatch({ type: "reply", id: newId(), text: reply });
    } catch (error) {
      dispatch({ type: "fail", id: messageId, error: errorMessage(error, "The league agent didn't answer.") });
    }
  };

  const send = (text: string) => {
    const id = newId();
    dispatch({ type: "send", id, text });
    void request(id, text);
  };

  const submitDraft = () => {
    send(draft.trim());
    setDraft("");
  };

  const retry = (id: string) => {
    const message = state.messages.find((m) => m.id === id);
    if (!message || state.pending) return;
    dispatch({ type: "retry", id });
    void request(id, message.text);
  };

  return (
    <Screen>
      <Header title="League Agent" onBack={router.back} />
      {leagueId ? (
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
