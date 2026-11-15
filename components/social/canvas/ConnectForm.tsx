import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, OutlinedPillButton, TextField } from "@/components/ui";
import { colors, font, fontFamily, SCREEN_MARGIN, spacing } from "@/theme";

import { normalizeBaseUrl } from "./canvasLogic";

export function ConnectForm({
  busy,
  error,
  onConnect,
}: {
  busy: boolean;
  error?: string;
  onConnect: (baseUrl: string, token: string) => void;
}) {
  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState("");
  const filled = baseUrl.trim() !== "" && token.trim() !== "";

  return (
    <View style={styles.form}>
      <TextField
        label="Base URL"
        placeholder="school.instructure.com"
        value={baseUrl}
        onChangeText={setBaseUrl}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextField
        label="Access Token"
        value={token}
        onChangeText={setToken}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Button
          label="Connect"
          loading={busy}
          disabled={!filled}
          onPress={() => onConnect(normalizeBaseUrl(baseUrl), token.trim())}
        />
        <OutlinedPillButton label="Use demo school" disabled={busy} onPress={() => onConnect("demo", "")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { padding: SCREEN_MARGIN, gap: spacing.md },
  error: { color: colors.danger, fontFamily: fontFamily.regular, fontSize: font.body },
  actions: { gap: spacing.md },
});
