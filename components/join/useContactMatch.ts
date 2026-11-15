import { useMutation } from "convex/react";
import * as Contacts from "expo-contacts";
import { useState } from "react";

import type { Id } from "@/convex/_generated/dataModel";
import { backend } from "@/lib/backend";
import { errorMessage } from "@/lib/errorMessage";
import { collectContactPhones, inviteesFrom, type Invitee } from "@/lib/phone";

export type ContactMatchState =
  | { status: "idle" }
  | { status: "loading" }
  /** Permission denied, no contacts with numbers, or no address book at all (web). */
  | { status: "empty" }
  | { status: "error"; message: string }
  | { status: "done"; added: { userId: Id<"users">; name: string }[]; invitees: Invitee[] };

/**
 * Asks for contacts access, reads the address book, and has the server add
 * the members it recognises. Numbers are normalised here, so only E.164 strings
 * leave the device and the names of people not on Lineup never do.
 */
export function useContactMatch(leagueId: Id<"leagues"> | undefined) {
  const matchContacts = useMutation(backend.users.matchContacts);
  const [state, setState] = useState<ContactMatchState>({ status: "idle" });

  async function allowAccess() {
    if (!leagueId) return;
    setState({ status: "loading" });
    try {
      const permission = await Contacts.requestPermissionsAsync();
      if (!permission.granted) return setState({ status: "empty" });
      const details = await Contacts.Contact.getAllDetails([Contacts.ContactField.FULL_NAME, Contacts.ContactField.PHONES]);
      const { phones, people } = collectContactPhones(details);
      if (phones.length === 0) return setState({ status: "empty" });
      const { added, notOnLineup } = await matchContacts({ leagueId, phones });
      setState({ status: "done", added, invitees: inviteesFrom(notOnLineup, people) });
    } catch (error) {
      setState({ status: "error", message: errorMessage(error) });
    }
  }

  return { state, allowAccess };
}
