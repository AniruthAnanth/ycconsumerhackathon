import { useMutation } from "convex/react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { OutlinedPillButton, SectionLabel, TextField } from "@/components/ui";
import { backend } from "@/lib/backend";
import { spacing } from "@/theme";

import { ErrorLine } from "./ErrorLine";
import type { useJoinLeague } from "./useJoinLeague";

export function InviteCodeSection({ joining }: { joining: ReturnType<typeof useJoinLeague> }) {
  const joinByCode = useMutation(backend.leagues.joinByCode);
  const { join, busy, failure } = joining;
  const [code, setCode] = useState("");
  const inviteCode = code.trim();
  return (
    <>
      <SectionLabel left="Invite code" />
      <View style={styles.body}>
        <View style={styles.row}>
          <View style={styles.field}>
            <TextField
              label="Code"
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!busy}
              returnKeyType="go"
              onSubmitEditing={() => inviteCode && join("inviteCode", () => joinByCode({ inviteCode }))}
            />
          </View>
          <OutlinedPillButton
            label="Join"
            disabled={busy || !inviteCode}
            onPress={() => join("inviteCode", () => joinByCode({ inviteCode }))}
          />
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
