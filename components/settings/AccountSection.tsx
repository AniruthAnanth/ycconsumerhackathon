import { useMutation, useQuery } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { uploadToConvex } from "@/components/capture/uploadToConvex";
import { ErrorLine } from "@/components/join/ErrorLine";
import { Avatar, Button, TextField } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Me } from "@/lib/backend";
import { errorMessage } from "@/lib/errorMessage";
import { formatPhoneInput, phoneHint, toE164 } from "@/lib/phone";
import { layout, spacing } from "@/theme";

import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";

/** "+16505557733" as the phone field shows it, "(650) 555-7733"; other countries stay as stored. */
function displayPhone(phone: string | undefined): string {
  if (!phone) return "";
  return phone.startsWith("+1") ? formatPhoneInput(phone.slice(2)) : phone;
}

/**
 * Name, phone and photo. Name and phone save through users.createUser, the same mutation
 * onboarding uses, so the number moves to this account by the same rule. While Switch Player
 * has the phone playing as a seeded player the rows show that player and are read-only: every
 * write here lands on the device's own account.
 */
export function AccountSection({ me }: { me: Me }) {
  const createUser = useMutation(api.users.createUser);
  const generateUploadUrl = useMutation(api.proofs.generateUploadUrl);
  const setAvatar = useMutation(api.users.setAvatar);
  const profile = useQuery(api.profile.get, { userId: me._id });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(me.name ?? "");
  const [phone, setPhone] = useState(displayPhone(me.phone));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const readOnly = me.actingAs !== undefined;
  const e164 = toE164(phone);
  const hint = phoneHint(phone);

  function startEditing() {
    setName(me.name ?? "");
    setPhone(displayPhone(me.phone));
    setError(null);
    setEditing(true);
  }

  async function save() {
    if (!e164) return;
    setBusy(true);
    try {
      await createUser({ name: name.trim(), phone: e164 });
      setEditing(false);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function pickPhoto() {
    // The library picker needs no permission prompt on iOS 14+ and Android 13+, and works in Expo Go.
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;
    setBusy(true);
    try {
      const storageId = await uploadToConvex(await generateUploadUrl({}), asset.uri, asset.mimeType ?? "image/jpeg");
      await setAvatar({ storageId: storageId as Id<"_storage"> });
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <SettingsGroup title="Account">
        <View style={styles.form}>
          <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" editable={!busy} />
          <TextField
            label="Phone"
            value={phone}
            onChangeText={(text) => setPhone(formatPhoneInput(text, phone))}
            prefix="+1"
            keyboardType="phone-pad"
            autoComplete="tel"
            editable={!busy}
          />
          {hint ? <ErrorLine message={hint} /> : null}
          {error ? <ErrorLine message={error} /> : null}
          <Button label="Save" onPress={() => void save()} loading={busy} disabled={!name.trim() || !e164} />
        </View>
        <SettingsRow title="Cancel" onPress={() => setEditing(false)} testID="settings-account-cancel" />
      </SettingsGroup>
    );
  }

  return (
    <SettingsGroup
      title="Account"
      footer={readOnly ? `Playing as ${me.actingAs?.name} from Demo controls. Switch back there to edit your own account.` : undefined}
    >
      <SettingsRow
        title="Photo"
        accessory={<Avatar uri={profile?.avatarUrl} name={me.name} size={layout.avatarCompact} />}
        onPress={readOnly || busy ? undefined : () => void pickPhoto()}
        accessibilityLabel="Change photo"
        testID="settings-avatar"
      />
      <SettingsRow title="Name" value={me.name ?? "Not set"} onPress={readOnly ? undefined : startEditing} testID="settings-name" />
      <SettingsRow title="Phone" value={displayPhone(me.phone) || "Not set"} onPress={readOnly ? undefined : startEditing} testID="settings-phone" />
      {error ? (
        <View style={styles.form}>
          <ErrorLine message={error} />
        </View>
      ) : null}
    </SettingsGroup>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, padding: spacing.lg },
});
