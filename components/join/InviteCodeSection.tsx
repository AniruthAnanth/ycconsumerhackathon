import { useMutation } from "convex/react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { OutlinedPillButton, SectionLabel, TextField } from "@/components/ui";
import { backend } from "@/lib/backend";
import { spacing } from "@/theme";

import { ErrorLine } from "./ErrorLine";
import type { useJoinLeague } from "./useJoinLeague";

/** The second way into a league: a code a friend sent. The keyboard's Go key and the Join pill do the same thing. */
export function InviteCodeSection({ joining }: { joining: ReturnType<typeof useJoinLeague> }) {
  const joinByCode = useMutation(backend.leagues.joinByCode);
  const { join, busy, failure, clearFailure } = joining;
  const [code, setCode] = useState("");
  const inviteCode = code.trim();
  const submit = () => {
    if (inviteCode) void join("inviteCode", () => joinByCode({ inviteCode }));
  };
  return (
    <>
      <SectionLabel left="Invite code" />
      <View style={styles.body}>
        <View style={styles.row}>
          <View style={styles.field}>
            <TextField
              label="Code"
              value={code}
              onChangeText={(text) => {
                // An error is about the code that was sent, not the one being typed now.
                clearFailure();
                setCode(text);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!busy}
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          </View>
          <OutlinedPillButton label="Join" disabled={busy || !inviteCode} onPress={submit} />
        </View>
        {failure?.section === "inviteCode" ? <ErrorLine message={failure.message} /> : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "flex-end", gap: spacing.md },
  field: { flex: 1 },
});
