import { useMutation } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { uploadToConvex } from "@/components/capture/uploadToConvex";
import { ErrorLine } from "@/components/join/ErrorLine";
import { RecruiterBadge } from "@/components/invite";
import { Avatar, Button, OutlinedPillButton, TextField } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/lib/errorMessage";
import { haptics } from "@/lib/native/haptics";
import { colors, layout, spacing, type } from "@/theme";

import { nameProblem } from "./profileLogic";

const AVATAR_SIZE = layout.avatar * 1.6;
type PhotoChoice = "camera" | "library" | "remove";

/** Take photo / Choose from library / Remove, as the platform asks. The web has no sheet: it picks. */
function askPhotoChoice(hasPhoto: boolean): Promise<PhotoChoice | null> {
  const options: { label: string; choice: PhotoChoice }[] = [
    { label: "Take photo", choice: "camera" },
    { label: "Choose from library", choice: "library" },
    ...(hasPhoto ? [{ label: "Remove photo", choice: "remove" as const }] : []),
  ];
  if (Platform.OS === "web") return Promise.resolve("library");
  return new Promise((resolve) => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...options.map((option) => option.label), "Cancel"],
          cancelButtonIndex: options.length,
          ...(hasPhoto && { destructiveButtonIndex: options.length - 1 }),
        },
        (index) => resolve(options[index]?.choice ?? null),
      );
      return;
    }
    Alert.alert("Profile photo", undefined, [
      ...options.map((option) => ({ text: option.label, onPress: () => resolve(option.choice) })),
      { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
    ]);
  });
}

async function pickPhoto(choice: "camera" | "library") {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.6 };
  if (choice === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error("Allow camera access in Settings to take a photo.");
    return await ImagePicker.launchCameraAsync(options);
  }
  // The library picker needs no permission prompt on iOS 14+ and Android 13+, and works in Expo Go.
  return await ImagePicker.launchImageLibraryAsync(options);
}

/**
 * The decree's heading: avatar and name. On the player's own profile the avatar opens the photo
 * sheet and the name edits inline; users.updateProfile saves both.
 */
export function ProfileIdentity({
  userId,
  name,
  avatarUrl,
  own,
}: {
  userId: Id<"users">;
  name: string;
  avatarUrl?: string;
  own: boolean;
}) {
  const updateProfile = useMutation(api.users.updateProfile);
  const generateUploadUrl = useMutation(api.proofs.generateUploadUrl);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function changePhoto() {
    const choice = await askPhotoChoice(avatarUrl !== undefined);
    if (choice === null) return;
    await run(async () => {
      if (choice === "remove") {
        await updateProfile({ avatarStorageId: null });
        haptics.success();
        return;
      }
      const result = await pickPhoto(choice);
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return;
      const storageId = await uploadToConvex(await generateUploadUrl({}), asset.uri, asset.mimeType ?? "image/jpeg");
      await updateProfile({ avatarStorageId: storageId as Id<"_storage"> });
      haptics.success();
    });
  }

  async function saveName() {
    if (draft === null || nameProblem(draft)) return;
    await run(async () => {
      await updateProfile({ name: draft.trim() });
      haptics.success();
      setDraft(null);
    });
  }

  const avatar = <Avatar uri={avatarUrl} name={name} size={AVATAR_SIZE} />;
  const problem = draft === null ? null : nameProblem(draft);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {own ? (
          <Pressable
            onPress={busy ? undefined : () => void changePhoto()}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            testID="profile-avatar"
          >
            {avatar}
          </Pressable>
        ) : (
          avatar
        )}
        <View style={styles.nameBlock}>
          {draft === null ? (
            own ? (
              <Pressable
                onPress={() => setDraft(name)}
                accessibilityRole="button"
                accessibilityLabel="Edit name"
                accessibilityHint="Edits your display name"
                testID="profile-name"
              >
                <Text style={styles.name} numberOfLines={2}>
                  {name}
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.name} numberOfLines={2}>
                {name}
              </Text>
            )
          ) : (
            <TextField
              label="Name"
              value={draft}
              onChangeText={setDraft}
              autoCapitalize="words"
              autoComplete="name"
              autoFocus
              maxLength={60}
              editable={!busy}
              onSubmitEditing={() => void saveName()}
              returnKeyType="done"
            />
          )}
          {draft === null ? <RecruiterBadge userId={userId} /> : null}
        </View>
      </View>
      {draft !== null ? (
        <View style={styles.actions}>
          {problem ? <ErrorLine message={problem} /> : null}
          <Button label="Save" onPress={() => void saveName()} loading={busy} disabled={problem !== null} haptic="none" />
          <OutlinedPillButton label="Cancel" onPress={() => setDraft(null)} />
        </View>
      ) : null}
      {error ? <ErrorLine message={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  nameBlock: { flex: 1, gap: spacing.xs },
  name: { ...type.heading, color: colors.text },
  actions: { gap: spacing.sm },
});
