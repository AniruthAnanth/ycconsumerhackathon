import { useMutation } from "convex/react";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button, PositionPill } from "@/components/ui";
import { colors, font, spacing } from "@/theme";

import type { DropView } from "./dropView";
import { acceptMystery, passMystery } from "./dropsApi";
import { Envelope } from "./Envelope";
import { WagerStepper } from "./WagerStepper";

type SealedView = Extract<DropView, { type: "sealed" }>;
type Pending = "open" | "pass" | null;

/** A mystery task still in its envelope: wager if you like, then open it or pass. */
export function SealedMysteryActions({ view }: { view: SealedView }) {
  const accept = useMutation(acceptMystery);
  const pass = useMutation(passMystery);
  const [wager, setWager] = useState(0);
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "open" | "pass", call: () => Promise<null>) {
    setPending(action);
    setError(null);
    try {
      await call();
    } catch {
      setError(action === "open" ? "Couldn't open the envelope. Try again." : "Couldn't pass. Try again.");
    } finally {
      setPending(null);
    }
  }

  const busy = pending !== null;

  return (
    <View style={styles.column}>
      <View style={styles.row}>
        <Envelope />
        <PositionPill slot={view.slot} />
        <WagerStepper value={wager} onChange={setWager} disabled={busy} />
      </View>
      <View style={styles.row}>
        <Button
          label="Open"
          style={styles.open}
          loading={pending === "open"}
          disabled={busy}
          onPress={() => run("open", () => accept(wager > 0 ? { dropId: view.dropId, wager } : { dropId: view.dropId }))}
        />
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => run("pass", () => pass({ dropId: view.dropId }))}
          style={[styles.pass, busy && styles.passDisabled]}
        >
          <Text style={styles.passLabel}>Pass</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { flexShrink: 1, alignItems: "flex-end", gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  open: { height: 36, paddingHorizontal: spacing.xl },
  pass: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  passDisabled: { opacity: 0.4 },
  passLabel: { color: colors.divider, fontSize: font.body, fontWeight: "600" },
  error: { color: colors.background, fontSize: font.meta },
});
