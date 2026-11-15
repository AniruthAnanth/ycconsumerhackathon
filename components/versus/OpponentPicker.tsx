import { useQuery } from "convex/react";
import * as Contacts from "expo-contacts";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ErrorLine } from "@/components/join/ErrorLine";
import { PersonRow } from "@/components/join/PersonRow";
import { OutlinedPillButton, SectionLabel } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { toE164 } from "@/lib/phone";
import { SCREEN_MARGIN, spacing } from "@/theme";

import type { Opponent } from "./useChallenge";

type Props = { value: Opponent; onChange: (opponent: Opponent) => void };

/** One opponent, three sources: a Lineup friend, someone from the address book, or whoever opens the link. */
export function OpponentPicker({ value, onChange }: Props) {
  const friends = useQuery(api.versus.friends) ?? [];
  const [contactFailure, setContactFailure] = useState<string | null>(null);

  // The system picker needs no address-book permission and only the chosen
  // contact's first usable number leaves the device, normalised like contacts matching.
  async function pickContact() {
    setContactFailure(null);
    try {
      const contact = await Contacts.Contact.presentPicker();
      if (!contact) return;
      const phone = (await contact.getPhones()).map(({ number }) => (number ? toE164(number) : null)).find(Boolean);
      if (!phone) return setContactFailure("That contact has no phone number.");
      onChange({ kind: "contact", phone, name: (await contact.getFullName()).trim() || phone });
    } catch {
      setContactFailure("Contacts aren't available here. Send an invite link instead.");
    }
  }

  return (
    <>
      {friends.length > 0 ? <SectionLabel left="Friends on Lineup" /> : null}
      {friends.map((friend) => (
        <PersonRow
          key={friend.userId}
          name={friend.name}
          selected={value.kind === "friend" && value.userId === friend.userId}
          onToggle={() => onChange({ kind: "friend", ...friend })}
        />
      ))}
      <SectionLabel left="Anyone else" />
      {value.kind === "contact" ? <PersonRow name={value.name} detail={value.phone} selected onToggle={() => {}} /> : null}
      <PersonRow name="Send invite link" detail="Text or share a code" selected={value.kind === "link"} onToggle={() => onChange({ kind: "link" })} />
      <View style={styles.body}>
        <OutlinedPillButton label="Pick from contacts" icon="person-add-outline" onPress={pickContact} />
        {contactFailure ? <ErrorLine message={contactFailure} /> : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: SCREEN_MARGIN, paddingVertical: spacing.md, gap: spacing.sm },
});
