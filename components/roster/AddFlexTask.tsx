import { useMutation } from "convex/react";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ErrorLine } from "@/components/join/ErrorLine";
import { errorMessage } from "@/components/join/errorMessage";
import { Icon, OutlinedPillButton } from "@/components/ui";
import { MAX_TITLE_LENGTH } from "@/convex/lib/lineupRules";
import { backend } from "@/lib/backend";
import { colors, font, fontFamily, hairline, layout, ROW_HEIGHT_COMPACT, SCREEN_MARGIN, spacing } from "@/theme";

/**
 * The one change a locked lineup still takes: an extra task, typed in. The row
 * opens into a field in place, so adding one never leaves the roster, and the
 * new task arrives through the roster query like any other row. Roster stops
 * drawing this once the week holds three flex tasks.
 */
export function AddFlexTask() {
  const addFlexTask = useMutation(backend.lineup.addFlexTask);
  // Null while the row is closed.
  const [title, setTitle] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (title === null) {
    return (
      <Pressable style={styles.row} onPress={() => setTitle("")} accessibilityRole="button" accessibilityLabel="Add flex task">
        <Icon name="add" size={20} color={colors.accent} />
        <Text style={styles.add}>Add flex task</Text>
      </Pressable>
    );
  }

  const ready = title.trim() !== "" && !saving;
  const submit = async () => {
    if (!ready) return;
    setSaving(true);
    setError(null);
    try {
      await addFlexTask({ title });
      setTitle(null);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.composer}>
      <View style={styles.line}>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={(text) => {
            setTitle(text);
            setError(null);
          }}
          placeholder="New flex task"
          placeholderTextColor={colors.textFaint}
          accessibilityLabel="Flex task title"
          autoFocus
          editable={!saving}
          // The backend cuts a title at this length, so the field stops there.
          maxLength={MAX_TITLE_LENGTH}
          returnKeyType="done"
          onSubmitEditing={submit}
          // Leaving an empty field is how the player backs out.
          onBlur={() => {
            if (title.trim() === "") setTitle(null);
          }}
        />
        <OutlinedPillButton label="Add" accessibilityLabel="Add this flex task" disabled={!ready} onPress={submit} />
      </View>
      {error ? <ErrorLine message={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: ROW_HEIGHT_COMPACT,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: SCREEN_MARGIN,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  add: { fontSize: font.title, fontFamily: fontFamily.bold, color: colors.accent },
  composer: {
    minHeight: ROW_HEIGHT_COMPACT,
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: SCREEN_MARGIN,
    paddingVertical: spacing.sm,
    borderBottomWidth: hairline,
    borderBottomColor: colors.divider,
  },
  line: { flexDirection: "row", alignItems: "center", gap: layout.columnGap },
  input: { flex: 1, height: 44, fontFamily: fontFamily.regular, fontSize: font.title, color: colors.text, padding: 0 },
});
