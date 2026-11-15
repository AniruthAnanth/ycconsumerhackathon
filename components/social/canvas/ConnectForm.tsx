import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, colors, OutlinedPillButton, TextField } from "../kit";
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
    <View>
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
  error: { color: colors.red, fontSize: 14, paddingHorizontal: 16, paddingTop: 8 },
  actions: { padding: 16, gap: 12, alignItems: "stretch" },
});
