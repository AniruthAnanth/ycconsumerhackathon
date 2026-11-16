const MIN_DIGITS = 8;
const MAX_DIGITS = 15;
/** National numbers in the countries we default to (NANP) are ten digits long. */
const NATIONAL_DIGITS = 10;

export const MAX_CONTACT_PHONES = 500;
export const MAX_INVITEES = 50;

/**
 * Normalises a typed or address-book number to E.164, or null when it cannot be
 * a phone number. The server matches contacts by this exact string, so the app
 * and the backend must agree on it: a leading + is kept as typed, a bare
 * national number gets the default country code, and anything else with 8 to 15
 * digits is assumed to already carry its country code.
 */
export function toE164(raw: string, defaultCountryCode = "1"): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null;
  if (raw.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === NATIONAL_DIGITS) return `+${defaultCountryCode}${digits}`;
  return `+${digits}`;
}

/**
 * The phone field's text as the player types: "(650) 555-7733". The field sits behind a fixed
 * "+1", so a pasted or autofilled "+1 650…" loses its country code here. Deleting only a
 * bracket, space or dash would leave the same digits and re-draw the same text, so it takes
 * the digit before it instead.
 */
export function formatPhoneInput(next: string, previous = ""): string {
  let digits = next.replace(/\D/g, "");
  if (digits.length === NATIONAL_DIGITS + 1 && digits.startsWith("1")) digits = digits.slice(1);
  if (next.length < previous.length && digits === previous.replace(/\D/g, "")) digits = digits.slice(0, -1);
  digits = digits.slice(0, NATIONAL_DIGITS);
  if (!digits) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * The line to show under the phone field, or null. It stays quiet while the
 * field is empty (or holds no digit yet) so a new player isn't scolded before
 * they've typed anything, and speaks once there are digits that toE164 rejects.
 */
export function phoneHint(raw: string): string | null {
  if (!/\d/.test(raw) || toE164(raw)) return null;
  return "Enter a 10-digit phone number";
}

/** The slice of an address-book entry the contacts step reads. */
export type DeviceContact = {
  fullName?: string | null;
  phones?: { number?: string; label?: string | null }[];
};

/** A person from the address book, with their usable numbers, mobile first. */
export type ContactPerson = { name: string; phones: string[] };

const MOBILE_LABEL = /mobile|cell|iphone/i;

/**
 * Turns the address book into the numbers to send to the server, normalised on
 * the device so raw contact data never leaves it, de-duplicated and capped. The
 * people stay on the device too: they label the friends we invite by text, one
 * row per person however many numbers they have.
 */
export function collectContactPhones(
  contacts: DeviceContact[],
  defaultCountryCode = "1",
): { phones: string[]; people: ContactPerson[] } {
  const seen = new Set<string>();
  const people: ContactPerson[] = [];
  for (const contact of contacts) {
    const numbers = [...(contact.phones ?? [])].sort((a, b) => Number(MOBILE_LABEL.test(b.label ?? "")) - Number(MOBILE_LABEL.test(a.label ?? "")));
    const phones: string[] = [];
    for (const { number } of numbers) {
      const phone = number ? toE164(number, defaultCountryCode) : null;
      // A number listed under two people belongs to the first; the second has one fewer.
      if (!phone || seen.has(phone)) continue;
      seen.add(phone);
      phones.push(phone);
    }
    if (phones.length > 0) people.push({ name: contact.fullName?.trim() || phones[0], phones });
  }
  return { phones: [...seen].slice(0, MAX_CONTACT_PHONES), people };
}

/** One person to text: the number the invite goes to, and their other numbers to show under the name. */
export type Invitee = { phone: string; name: string; otherPhones: string[] };

/**
 * The people to text, one per contact, ordered by name. A contact any of whose numbers is on
 * Lineup was added to the league already, so they are not invited. The invite goes to their
 * mobile number, or their first when none is marked mobile.
 */
export function inviteesFrom(notOnLineup: string[], people: ContactPerson[]): Invitee[] {
  const invitable = new Set(notOnLineup);
  return people
    .filter((person) => person.phones.length > 0 && person.phones.every((phone) => invitable.has(phone)))
    .map(({ name, phones: [phone, ...otherPhones] }) => ({ phone, name, otherPhones }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, MAX_INVITEES);
}
